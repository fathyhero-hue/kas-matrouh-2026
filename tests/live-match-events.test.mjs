import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync("supabase/proposals/20261010180000_match_live_events.sql", "utf8");
const eventsRoute = fs.readFileSync("app/api/admin/live/events/route.ts", "utf8");
const liveRoute = fs.readFileSync("app/api/admin/live/route.ts", "utf8");
const liveManager = fs.readFileSync("components/admin/live-match-manager.tsx", "utf8");
const homeMatchesRoute = fs.readFileSync("app/api/home/matches/route.ts", "utf8");
const matchAdminRoute = fs.readFileSync("app/api/admin/matches/route.ts", "utf8");

test("goal event schema is match-, tournament-, team-, player- and minute-specific with unique idempotency", () => {
  assert.match(migration, /create table if not exists public\.match_goal_events/i);
  for (const field of ["bracket_id", "match_id", "team_roster_id", "roster_player_id", "event_type", "match_minute", "idempotency_key"]) {
    assert.match(migration, new RegExp(`\\b${field}\\b`, "i"));
  }
  assert.match(migration, /idempotency_key uuid not null unique/i);
  assert.match(migration, /revoked_at timestamptz/i);
  assert.match(migration, /revoke_match_goal_event/i);
});

test("cards continue to use card_events and receive a minute without creating a second card log", () => {
  assert.match(migration, /alter table public\.card_events\s+add column if not exists match_minute/i);
  assert.match(migration, /create_live_card_event/i);
  assert.match(migration, /public\.create_card_event\(/i);
  assert.doesNotMatch(migration, /create table if not exists public\.match_card_events/i);
  assert.match(eventsRoute, /rpc\("create_live_card_event"/);
  assert.match(eventsRoute, /from\("card_events"\)/);
});

test("goal score changes are atomic, based on explicit snapshots, and cannot be manually overwritten afterward", () => {
  assert.match(migration, /enable_match_live_events/);
  assert.match(migration, /live_event_base_home_goals = coalesce\(home_goals, 0\)/);
  assert.match(migration, /live_event_base_away_goals = coalesce\(away_goals, 0\)/);
  assert.match(migration, /INVALID_SCORE_BASELINE/);
  assert.match(migration, /home_goals = live_event_base_home_goals \+ home_event_count/);
  assert.match(migration, /away_goals = live_event_base_away_goals \+ away_event_count/);
  assert.match(matchAdminRoute, /live_events_enabled/);
  assert.match(eventsRoute, /authorizeAdminRequest\(request, "matches\.live\.manage"\)/);
});

test("public live match API reads active goals and the canonical card event stream", () => {
  assert.match(homeMatchesRoute, /from\("match_goal_events"\)/);
  assert.match(homeMatchesRoute, /\.is\("revoked_at", null\)/);
  assert.match(homeMatchesRoute, /from\("card_events"\)/);
  assert.match(homeMatchesRoute, /roster_players/);
});

test("venue lookup is optional until the venue column is added", () => {
  assert.match(migration, /add column if not exists venue text/i);
  assert.match(homeMatchesRoute, /\.select\("id, venue"\)/);
  assert.match(homeMatchesRoute, /matches\.venue column is not available yet/);
  assert.match(matchAdminRoute, /يلزم تطبيق تحديث مخطط الملعب/);
});

test("second-yellow dismissal stays a distinct canonical card_events type", () => {
  assert.match(migration, /second_yellow_red/);
  assert.match(eventsRoute, /second_yellow_red/);
  assert.match(migration, /grant execute on function public\.create_card_event[^;]*to service_role/i);
  assert.doesNotMatch(migration, /create table if not exists public\.match_card_events/i);
});

test("live score writes are trigger-guarded and only enabled by event RPCs", () => {
  assert.match(migration, /guard_match_live_event_scores/);
  assert.match(migration, /LIVE_EVENT_BASELINE_IMMUTABLE/);
  assert.match(migration, /MATCH_SCORE_CONTROLLED_BY_LIVE_EVENTS/);
  assert.match(migration, /live_events_private\.match_score_update_authorizations/);
  assert.match(migration, /returning true into score_update_authorized/i);
  assert.doesNotMatch(migration, /set_config\('app\.match_event_score_update'/);
  assert.match(migration, /grant select on table public\.match_goal_events to service_role/i);
  assert.doesNotMatch(migration, /grant all on table public\.match_goal_events to service_role/i);
});

test("score corrections require their own permission and are granted to super_admin only by default", () => {
  const permissions = fs.readFileSync("lib/admin/permissions.ts", "utf8");
  const matchRoleStart = permissions.indexOf('  match_manager: [');
  const supervisorStart = permissions.indexOf('  supervisor: operationalPermissions,');
  const overrideStart = permissions.indexOf('  registration_manager: [');
  assert.match(permissions, /"matches\.live\.correct_score"/);
  assert.ok(!permissions.slice(matchRoleStart, overrideStart).includes("matches.live.correct_score"));
  assert.ok(!permissions.slice(supervisorStart, matchRoleStart).includes("matches.live.correct_score"));
  assert.match(migration, /select 'super_admin', 'matches\.live\.correct_score'/);
  assert.match(liveRoute, /action === "correct_score"[\s\S]*?"matches\.live\.correct_score"/);
  assert.match(liveRoute, /authorizeAdminRequest\(request, permission\)/);
});

test("score correction RPC locks the match, validates RBAC and audit fields, and preserves active goals", () => {
  assert.match(migration, /function public\.correct_match_live_score\(/i);
  assert.match(migration, /where id = p_match_id\s+for update/i);
  assert.match(migration, /SCORE_CORRECTION_FORBIDDEN/);
  assert.match(migration, /INVALID_SCORE_BASELINE/);
  assert.match(migration, /SCORE_CORRECTION_REASON_REQUIRED/);
  assert.match(migration, /e\.revoked_at is null/);
  assert.match(migration, /recalculated_home := p_new_base_home_goals::bigint \+ active_goal_count_home/);
  assert.match(migration, /recalculated_away := p_new_base_away_goals::bigint \+ active_goal_count_away/);
  assert.match(migration, /insert into live_events_private\.match_score_corrections/);
  assert.match(migration, /old_base_home_goals, old_base_away_goals/);
  assert.match(migration, /old_home_goals, old_away_goals, new_home_goals, new_away_goals/);
  assert.match(migration, /before update or delete on live_events_private\.match_score_corrections/);
  assert.match(migration, /revoke all on function public\.correct_match_live_score\(uuid, integer, integer, text, uuid\) from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.correct_match_live_score\(uuid, integer, integer, text, uuid\) to service_role/i);
  assert.match(liveRoute, /rpc\("correct_match_live_score"/);
  assert.match(liveRoute, /action: "matches\.live\.score\.correct"/);
});

test("live manager exposes score correction only when the caller has the independent permission", () => {
  assert.match(liveManager, /canCorrectScore && match\.live_events_enabled/);
  assert.match(liveManager, /تصحيح النتيجة/);
  assert.match(liveManager, /body: JSON\.stringify\(\{[\s\S]*?action: "correct_score"/);
  assert.match(liveManager, /reason,/);
  assert.match(liveManager, /action: "correct_score"/);
});

test("active baseline changes and enabling tracking are blocked outside their RPCs", () => {
  assert.match(migration, /LIVE_EVENT_BASELINE_IMMUTABLE/);
  assert.match(migration, /LIVE_EVENT_ENABLE_REQUIRES_RPC/);
  assert.match(migration, /LIVE_EVENTS_CANNOT_BE_DISABLED/);
  assert.match(migration, /operation = expected_operation/);
  assert.match(migration, /operation = 'correct_score'/);
});

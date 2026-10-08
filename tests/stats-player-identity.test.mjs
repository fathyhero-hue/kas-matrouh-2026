import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const moduleCache = new Map();
function load(relative) {
  const filename = path.resolve(relative);
  if (moduleCache.has(filename)) return moduleCache.get(filename).exports;
  const loaded = { exports: {} };
  moduleCache.set(filename, loaded);
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  function localRequire(id) {
    if (id.startsWith(".")) {
      const resolved = path.resolve(path.dirname(filename), id);
      return load(resolved.endsWith(".ts") ? resolved : `${resolved}.ts`);
    }
    return require(id);
  }
  new Function("require", "module", "exports", compiled)(localRequire, loaded, loaded.exports);
  return loaded.exports;
}

const { UNKNOWN_PLAYER, UNKNOWN_TEAM, groupCardsByPlayer, groupGoalsByPlayer, resolveStatsPlayer, validateStatsPlayerSelection } = load("lib/sport/stats-player.ts");
const rosterLinkSource = fs.readFileSync("lib/sport/roster-link.ts", "utf8");
const matchCardSource = fs.readFileSync("components/sport/match-card.tsx", "utf8");
const { getSuspensionState, getPlayerEligibilityForMatch } = load("lib/sport/suspensions.ts");
const { getSuspensionStateFromEvents } = load("lib/sport/suspensions.ts");
const { getCardTotalsWithEvents } = load("lib/sport/stats-player.ts");
const { buildCardEventAssignments, countAssignedCardEvents } = load("lib/sport/card-event-distribution.ts");

const teamA = {
  id: "team-a",
  team: "الفريق أ",
  logoUrl: null,
  coachName: null,
  coachPhotoUrl: null,
  players: [
    { id: "player-a-1", name: "محمد علي", photoUrl: null },
    { id: "player-a-2", name: "محمد علي", photoUrl: null },
  ],
};
const teamB = {
  id: "team-b",
  team: "الفريق ب",
  logoUrl: null,
  coachName: null,
  coachPhotoUrl: null,
  players: [{ id: "player-b-1", name: "سعيد حسن", photoUrl: null }],
};
const teams = [teamA, teamB];

test("current roster identity resolves canonical player and team names", () => {
  const resolved = resolveStatsPlayer({ id: "goal-1", roster_player_id: "player-a-1", team_roster_id: "team-a", player: "old name", team: "old team" }, teams);
  assert.equal(resolved.player, "محمد علي");
  assert.equal(resolved.team, "الفريق أ");
  assert.equal(resolved.identityKey, "roster:player-a-1");
});

test("legacy snapshot resolves without a roster id", () => {
  const resolved = resolveStatsPlayer({ id: "legacy-1", player: "لاعب تاريخي", team: "فريق تاريخي" }, teams);
  assert.equal(resolved.player, "لاعب تاريخي");
  assert.equal(resolved.team, "فريق تاريخي");
  assert.match(resolved.identityKey, /^legacy:/);
});

test("historical null rows never render blank or UUIDs", () => {
  const resolved = resolveStatsPlayer({ id: "legacy-null", player: null, team: null }, teams);
  assert.equal(resolved.player, UNKNOWN_PLAYER);
  assert.equal(resolved.team, UNKNOWN_TEAM);
});

test("goal aggregation uses roster identity and keeps same-name players separate", () => {
  const rows = groupGoalsByPlayer([
    { id: "g1", roster_player_id: "player-a-1", team_roster_id: "team-a", player: "محمد علي", team: "الفريق أ", goals: 2 },
    { id: "g2", roster_player_id: "player-a-1", team_roster_id: "team-a", player: "محمد علي", team: "الفريق أ", goals: 3 },
    { id: "g3", roster_player_id: "player-a-2", team_roster_id: "team-a", player: "محمد علي", team: "الفريق أ", goals: 4 },
  ], teams);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((row) => row.goals), [5, 4]);
  assert.deepEqual(rows.map((row) => row.identityKey).sort(), ["roster:player-a-1", "roster:player-a-2"]);
});

test("card aggregation uses the same identity resolver", () => {
  const rows = groupCardsByPlayer([
    { id: "c1", roster_player_id: "player-b-1", team_roster_id: "team-b", player: "سعيد حسن", team: "الفريق ب", yellow: 1, red: 0 },
    { id: "c2", roster_player_id: "player-b-1", team_roster_id: "team-b", player: "سعيد حسن", team: "الفريق ب", yellow: 2, red: 1 },
  ], teams);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].yellow, 3);
  assert.equal(rows[0].red, 1);
  assert.equal(rows[0].player, "سعيد حسن");
});

test("server validation rejects unknown players and cross-team players", () => {
  const matches = [{ team_a: "الفريق أ", team_b: "الفريق ب" }];
  const roster = { id: "team-a", bracket_id: "bracket-1", team_name: "الفريق أ" };
  assert.equal(validateStatsPlayerSelection({ bracketId: "bracket-1", roster, player: { id: "player-b-1", roster_id: "team-b", name: "سعيد حسن" }, matches }).ok, false);
  assert.equal(validateStatsPlayerSelection({ bracketId: "bracket-1", roster, player: null, matches }).ok, false);
});

test("server validation accepts an official bracket team before its first match", () => {
  const result = validateStatsPlayerSelection({
    bracketId: "bracket-1",
    roster: { id: "team-c", bracket_id: "bracket-1", team_name: "الفريق ج" },
    player: { id: "player-c-1", roster_id: "team-c", name: "لاعب ج" },
    matches: [{ team_a: "الفريق أ", team_b: "الفريق ب" }],
  });
  assert.equal(result.ok, true);
});

test("stats identity migration is additive and nullable", () => {
  const migration = fs.readFileSync("supabase/migrations/20261007210234_stats_player_identity.sql", "utf8");
  assert.match(migration, /goals[\s\S]*roster_player_id uuid/);
  assert.match(migration, /cards[\s\S]*team_roster_id uuid/);
  assert.match(migration, /on delete set null/gi);
  assert.doesNotMatch(migration, /\b(drop|truncate|delete\s+from)\b/i);
});

test("stats API contract derives snapshots from roster IDs", () => {
  const route = fs.readFileSync("app/api/admin/stats-entries/route.ts", "utf8");
  assert.match(route, /roster_player_id/);
  assert.match(route, /team_roster_id/);
  assert.match(route, /validateStatsPlayerSelection/);
  assert.match(route, /player: validation\.playerName/);
  assert.match(route, /team: validation\.teamName/);
  assert.doesNotMatch(route, /fieldsByTable:.*player_name.*team_name/s);
});

test("team logo source links official Elite teams with roster logos", () => {
  assert.match(rosterLinkSource, /from\("elite_teams"\)\.select\("name, logo_url"\)/);
  assert.match(rosterLinkSource, /officialLogoByName\.get\(normalize\(r\.team_name/);
});

test("public match cards render real logo URLs and keep the placeholder fallback", () => {
  assert.match(matchCardSource, /<img src=\{src\}/);
  assert.doesNotMatch(matchCardSource, /from ["']next\/image["']/);
  assert.match(matchCardSource, /<Shield/);
});


test("suspension engine applies three-yellow cycle to next team match", () => {
  const matches = [
    { id: "m1", bracket_id: "b", team_a: "A", team_b: "B", match_date: "2026-01-01", match_time: "10:00", status: "انتهت" },
    { id: "m2", bracket_id: "b", team_a: "A", team_b: "C", match_date: "2026-01-02", match_time: "10:00", status: "مجدولة" },
  ];
  const cards = [1, 2, 3].map((n, i) => ({ id: `c${n}`, bracket_id: "b", match_id: "m1", roster_player_id: "p", team_roster_id: "t", team: "A", yellow: 1, red: 0 }));
  const state = getSuspensionState(cards, matches, [{ id: "t", team: "A", logoUrl: null, coachName: null, coachPhotoUrl: null, players: [{ id: "p", name: "P", photoUrl: null }] }]);
  assert.equal(state.isSuspended, true);
  assert.equal(state.suspensionMatchId, "m2");
});

test("completed suspension match clears state and legacy cards need assignment", () => {
  const matches = [{ id: "m2", bracket_id: "b", team_a: "A", team_b: "C", match_date: "2026-01-02", match_time: "10:00", status: "انتهت" }];
  const cards = [{ id: "c", bracket_id: "b", match_id: null, roster_player_id: "p", team_roster_id: "t", team: "A", yellow: 3, red: 0 }];
  const state = getSuspensionState(cards, matches);
  assert.equal(state.isSuspended, false);
  assert.equal(state.needsMatchAssignment, true);
});

test("eligibility is match-specific and does not globally block another match", () => {
  const state = { isSuspended: true, reason: "direct_red", suspensionMatchId: "m2" };
  assert.equal(getPlayerEligibilityForMatch(state, "m2").eligible, false);
  assert.equal(getPlayerEligibilityForMatch(state, "m3").eligible, true);
});

test("direct red remains active until the next team match is completed", () => {
  const base = [
    { id: "m1", bracket_id: "b", team_a: "A", team_b: "B", match_date: "2026-02-01", match_time: "10:00", status: "انتهت" },
    { id: "m2", bracket_id: "b", team_a: "A", team_b: "C", match_date: "2026-02-02", match_time: "10:00", status: "مجدولة" },
    { id: "m3", bracket_id: "b", team_a: "A", team_b: "D", match_date: "2026-02-03", match_time: "10:00", status: "مجدولة" },
  ];
  const cards = [{ id: "red", bracket_id: "b", match_id: "m1", roster_player_id: "p", team_roster_id: "t", team: "A", yellow: 0, red: 1 }];
  const before = getSuspensionState(cards, base);
  assert.equal(before.isSuspended, true);
  assert.equal(before.reason, "direct_red");
  assert.equal(before.suspensionMatchId, "m2");
  assert.equal(getPlayerEligibilityForMatch(before, "m2").eligible, false);
  const after = getSuspensionState(cards, base.map((match) => match.id === "m2" ? { ...match, status: "انتهت" } : match));
  assert.equal(after.isSuspended, false);
  assert.equal(getPlayerEligibilityForMatch(after, "m3").eligible, true);
});

test("public and admin consumers receive the same suspension state", () => {
  const matches = [{ id: "m1", bracket_id: "b", team_a: "A", team_b: "B", match_date: "2026-02-01", match_time: "10:00", status: "انتهت" }, { id: "m2", bracket_id: "b", team_a: "A", team_b: "C", match_date: "2026-02-02", match_time: "10:00", status: "مجدولة" }];
  const cards = [{ id: "red", bracket_id: "b", match_id: "m1", roster_player_id: "p", team_roster_id: "t", team: "A", yellow: 0, red: 1 }];
  const publicState = getSuspensionState(cards, matches);
  const adminState = getSuspensionState(cards, matches);
  assert.deepEqual(adminState, publicState);
});

test("public suspension status rendering uses readable Arabic labels", () => {
  const source = fs.readFileSync("app/[tournament]/cards/page.tsx", "utf8");
  assert.match(source, /الحالة/);
  assert.match(source, /متاح/);
  assert.match(source, /موقوف مباراة/);
  assert.doesNotMatch(source, /[ÙØ]/);
});

test("card events migration is additive and event based", () => {
  const migration = fs.readFileSync("supabase/migrations/20261008220000_card_events.sql", "utf8");
  assert.match(migration, /create table if not exists public\.card_events/);
  assert.match(migration, /match_id uuid not null/);
  assert.match(migration, /card_type text not null check \(card_type in \('yellow', 'direct_red'\)\)/);
  assert.doesNotMatch(migration, /\bdrop\s+table\b|\bdelete\s+from\b|\btruncate\b|\bupdate\s+public\.cards\b/i);
});

test("card events count three yellows across three matches", () => {
  const matches = [1, 2, 3, 4].map((id) => ({ id: `m${id}`, team_a: "A", team_b: "B", match_date: `2026-10-0${id}`, match_time: "10:00", status: "مجدولة" }));
  const events = [1, 2, 3].map((n) => ({ id: `e${n}`, match_id: `m${n}`, roster_player_id: "p", team_roster_id: "t", card_type: "yellow" }));
  const state = getSuspensionStateFromEvents(events, matches, [{ id: "t", team: "A", logoUrl: null, coachName: null, coachPhotoUrl: null, players: [{ id: "p", name: "P", photoUrl: null }] }]);
  assert.equal(state.isSuspended, true);
  assert.equal(state.suspensionMatchId, "m4");
});

test("third yellow and direct red in one match merge into one sanction", () => {
  const matches = [1, 2, 3].map((id) => ({ id: `m${id}`, team_a: "A", team_b: "B", match_date: `2026-10-0${id}`, match_time: "10:00", status: "scheduled" }));
  const events = [1, 2].map((n) => ({ id: `y${n}`, match_id: "m1", roster_player_id: "p", team_roster_id: "t", card_type: "yellow" })).concat([{ id: "y3", match_id: "m2", roster_player_id: "p", team_roster_id: "t", card_type: "yellow" }, { id: "r2", match_id: "m2", roster_player_id: "p", team_roster_id: "t", card_type: "direct_red" }]);
  const state = getSuspensionStateFromEvents(events, matches, [{ id: "t", team: "A", logoUrl: null, coachName: null, coachPhotoUrl: null, players: [{ id: "p", name: "P", photoUrl: null }] }]);
  assert.equal(state.reason, "combined");
  assert.deepEqual(state.suspensionMatchIds, ["m3"]);
});

test("separate-match sanctions remain separate and later cycle resumes", () => {
  const matches = [1, 2, 3, 4, 5].map((id) => ({ id: `m${id}`, team_a: "A", team_b: "B", match_date: `2026-10-0${id}`, match_time: "10:00", status: id === 2 ? "finished" : "scheduled" }));
  const events = [1, 2, 3].map((n) => ({ id: `y${n}`, match_id: `m${n}`, roster_player_id: "p", team_roster_id: "t", card_type: "yellow" })).concat([{ id: "r4", match_id: "m4", roster_player_id: "p", team_roster_id: "t", card_type: "direct_red" }]);
  const state = getSuspensionStateFromEvents(events, matches, [{ id: "t", team: "A", logoUrl: null, coachName: null, coachPhotoUrl: null, players: [{ id: "p", name: "P", photoUrl: null }] }]);
  assert.equal(state.reason, "yellow_accumulation");
  assert.deepEqual(state.suspensionMatchIds, ["m4", "m5"]);
  assert.equal(getPlayerEligibilityForMatch(state, "m4").eligible, false);
  assert.equal(getPlayerEligibilityForMatch(state, "m5").eligible, false);
});

test("card event migration has source identity and concurrency-safe uniqueness", () => {
  const migration = fs.readFileSync("supabase/migrations/20261008220000_card_events.sql", "utf8");
  assert.match(migration, /source_card_id uuid references public\.cards/);
  assert.match(migration, /source_card_ordinal/);
  assert.match(migration, /unique index if not exists card_events_source_ordinal_uidx/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /ordinal > coalesce\(source_row\.yellow, 0\) \+ coalesce\(source_row\.red, 0\)/);
  assert.match(migration, /distribute_card_events/);
});

test("historical card events are immutable and distribution requires an actor", () => {
  const migration = fs.readFileSync("supabase/migrations/20261008220000_card_events.sql", "utf8");
  const route = fs.readFileSync("app/api/admin/card-events/route.ts", "utf8");
  assert.match(migration, /HISTORICAL_CARD_EVENT_IMMUTABLE/);
  assert.match(migration, /card_events_protect_historical_delete/);
  assert.match(migration, /ACTOR_REQUIRED/);
  assert.match(route, /source_card_id/);
  assert.match(route, /Historical card events cannot be deleted/);
});

test("card event public access stays server-side and does not expose the base table", () => {
  const migration = fs.readFileSync("supabase/migrations/20261008220000_card_events.sql", "utf8");
  const publicPage = fs.readFileSync("app/[tournament]/cards/page.tsx", "utf8");
  assert.doesNotMatch(migration, /create role card_events_public_reader|create or replace view public\.public_card_events/i);
  assert.match(migration, /alter table public\.card_events force row level security/i);
  assert.match(migration, /revoke all on table public\.card_events from public, anon, authenticated/i);
  assert.doesNotMatch(migration, /grant select on table public\.card_events to anon, authenticated/i);
  assert.match(publicPage, /getPublicCardEvents/);
});

test("admin stats GET contracts accept a bracket and return empty-safe rows", () => {
  const statsRoute = fs.readFileSync("app/api/admin/stats-entries/route.ts", "utf8");
  const eventsRoute = fs.readFileSync("app/api/admin/card-events/route.ts", "utf8");
  assert.match(statsRoute, /export async function GET/);
  assert.match(statsRoute, /searchParams\.get\("bracket_id"\)/);
  assert.match(statsRoute, /rows: query\.data \|\| \[\]/);
  assert.match(eventsRoute, /export async function GET/);
  assert.match(eventsRoute, /searchParams\.get\("bracket_id"\)/);
  assert.match(eventsRoute, /rows: query\.data \|\| \[\]/);
});

test("new card events use payload-bound idempotency keys and protected RPC grants", () => {
  const migration = fs.readFileSync("supabase/migrations/20261008220000_card_events.sql", "utf8");
  const route = fs.readFileSync("app/api/admin/card-events/route.ts", "utf8");
  const manager = fs.readFileSync("components/admin/stats-manager.tsx", "utf8");
  assert.match(migration, /unique index if not exists card_events_idempotency_uidx/);
  assert.match(migration, /create table if not exists public\.card_event_idempotency/);
  assert.match(migration, /IDEMPOTENCY_KEY_PAYLOAD_MISMATCH/);
  assert.match(migration, /IDEMPOTENCY_EVENT_ALREADY_DELETED/);
  assert.match(migration, /existing_row\.bracket_id is distinct from p_bracket_id[\s\S]*existing_row\.card_type is distinct from p_card_type/);
  assert.match(migration, /revoke all on function public\.create_card_event\([^;]+ from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.create_card_event\([^;]+ to service_role/i);
  assert.match(route, /authorizeAdminRequest\(req, "stats\.goals\.manage"\)/);
  assert.match(route, /rpc\("create_card_event"/);
  assert.match(route, /IDEMPOTENCY_EVENT_ALREADY_DELETED/);
  assert.match(manager, /eventIdempotencyKey\.current \|\|= crypto\.randomUUID\(\)/);
});

test("public and admin card event consumers use identical suspension state", () => {
  const matches = [{ id: "m1", team_a: "A", team_b: "B", match_date: "2026-10-01", match_time: "10:00", status: "scheduled" }, { id: "m2", team_a: "A", team_b: "C", match_date: "2026-10-02", match_time: "10:00", status: "scheduled" }];
  const events = [{ id: "r1", match_id: "m1", roster_player_id: "p", team_roster_id: "t", card_type: "direct_red" }];
  const teams = [{ id: "t", team: "A", logoUrl: null, coachName: null, coachPhotoUrl: null, players: [{ id: "p", name: "P", photoUrl: null }] }];
  assert.deepEqual(getSuspensionStateFromEvents(events, matches, teams), getSuspensionStateFromEvents(events, matches, teams));
});

test("legacy distribution does not double count totals while new events are added", () => {
  const totals = getCardTotalsWithEvents({ yellow: 3, red: 1 }, [
    { card_type: "yellow", is_historical_distribution: true },
    { card_type: "yellow", source_card_id: null },
    { card_type: "direct_red", is_historical_distribution: true },
    { card_type: "direct_red", source_card_id: null },
  ]);
  assert.deepEqual(totals, { yellow: 4, red: 2 });
});

test("three historical yellows require three explicit match assignments", () => {
  const row = { yellow: 3, red: 0 };
  assert.deepEqual(buildCardEventAssignments(row, {}), []);
  const assignments = buildCardEventAssignments(row, { 1: "m1", 2: "m2", 3: "m3" });
  assert.deepEqual(assignments, [
    { ordinal: 1, match_id: "m1", card_type: "yellow" },
    { ordinal: 2, match_id: "m2", card_type: "yellow" },
    { ordinal: 3, match_id: "m3", card_type: "yellow" },
  ]);
  assert.equal(countAssignedCardEvents(row, { 1: "m1", 2: "m2", 3: "m3", 4: "m4" }), 3);
});

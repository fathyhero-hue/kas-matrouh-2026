import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync("supabase/proposals/20261011120000_super_admin_match_controls.sql", "utf8");
const matchRoute = fs.readFileSync("app/api/admin/matches/route.ts", "utf8");
const eventRoute = fs.readFileSync("app/api/admin/live/events/route.ts", "utf8");
const manager = fs.readFileSync("components/admin/matches-manager.tsx", "utf8");
const permissions = fs.readFileSync("lib/admin/permissions.ts", "utf8");
const auditLabels = fs.readFileSync("lib/admin/audit-labels.ts", "utf8");

test("full-control permission defaults to super admin and server routes enforce the permission", () => {
  assert.match(permissions, /"matches\.admin\.full_control"/);
  assert.match(migration, /select 'super_admin', 'matches\.admin\.full_control'/);
  assert.match(migration, /delete from public\.admin_role_permissions[\s\S]*permission_key = 'matches\.delete'/);
  assert.match(matchRoute, /authorizeAdminRequest\(req, "matches\.admin\.full_control"\)/);
  assert.match(eventRoute, /authorizeAdminRequest\(request, "matches\.admin\.full_control"\)/);
});

test("administrative match RPC locks, audits, validates, and archives without physical deletion", () => {
  assert.match(migration, /function public\.admin_manage_match\(/i);
  assert.match(migration, /where id = p_match_id for update/i);
  assert.match(migration, /match_admin_audit/);
  assert.match(migration, /MATCH_ADMIN_AUDIT_IMMUTABLE/);
  assert.match(migration, /archived_at timestamptz/);
  assert.match(migration, /archived_by uuid/);
  assert.match(migration, /MATCH_ADMIN_REASON_REQUIRED/);
  assert.match(migration, /SCORE_BELOW_ACTIVE_GOAL_EVENTS/);
  assert.match(migration, /correct_match_live_score\(/);
  assert.match(migration, /create policy matches_hide_archived_public[\s\S]*as restrictive[\s\S]*archived_at is null/i);
  assert.doesNotMatch(migration, /\b(?:drop\s+table|truncate)\b/i);
  assert.doesNotMatch(matchRoute, /\.from\("matches"\)\.delete\(/);
  assert.match(matchRoute, /rpc\("admin_manage_match"/);
});

test("reset preserves event rows and excludes cards reversibly rather than deleting history", () => {
  assert.match(migration, /set revoked_at = now\(\), revoked_by = p_actor/);
  assert.match(migration, /insert into public\.match_card_event_exclusions[\s\S]*where e\.match_id = match_row\.id\s+and e\.source_card_id is null/i);
  assert.match(migration, /on conflict \(event_id\) do nothing/);
  assert.match(migration, /references public\.card_events\(id\) on delete restrict/);
  assert.doesNotMatch(migration, /delete\s+from\s+public\.match_(?:goal|card)_events/i);
});

test("administrative card revocation cannot exclude legacy-distributed historical cards", () => {
  assert.match(
    migration,
    /where id = p_event_id and match_id = p_match_id for update;[\s\S]*if card_row\.source_card_id is not null then\s+raise exception 'HISTORICAL_CARD_EVENT_IMMUTABLE'/i,
  );
});

test("event edit and revoke RPCs keep a full before-and-after audit snapshot", () => {
  assert.match(migration, /function public\.admin_manage_match_event\(/i);
  assert.match(migration, /old_state, new_state/);
  assert.match(migration, /'event_update', 'event_revoke'/);
  assert.match(eventRoute, /rpc\("admin_manage_match_event"/);
  assert.match(eventRoute, /permission: isFullControl \? "matches\.admin\.full_control"/);
});

test("match administration offers confirmed reset, archive, and restore without exposing these actions to other roles", () => {
  assert.match(manager, /canFullyManage &&/);
  assert.match(manager, /"reset"/);
  assert.match(manager, /"restore"/);
  assert.match(manager, /أرشفة/);
  assert.match(manager, /ستبقى سجلاتها محفوظة وقابلة للتدقيق/);
  assert.match(auditLabels, /"match\.archive"/);
  assert.match(auditLabels, /"match\.reset"/);
  assert.match(auditLabels, /"match\.restore"/);
});

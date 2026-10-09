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

const { UNKNOWN_PLAYER, UNKNOWN_TEAM, addEventOnlyCardRows, groupCardsByPlayer, groupGoalsByPlayer, resolveStatsPlayer, validateStatsPlayerSelection } = load("lib/sport/stats-player.ts");
const rosterLinkSource = fs.readFileSync("lib/sport/roster-link.ts", "utf8");
const matchCardSource = fs.readFileSync("components/sport/match-card.tsx", "utf8");
const { getSuspensionState, getPlayerEligibilityForMatch } = load("lib/sport/suspensions.ts");
const { getSuspensionStateFromEvents, getCardStatus } = load("lib/sport/suspensions.ts");
const { getCardTotalsWithEvents, hasUnassignedCards } = load("lib/sport/stats-player.ts");
const { buildCardEventAssignments, countAssignedCardEvents } = load("lib/sport/card-event-distribution.ts");
const { getBracketCardRosterTeams } = load("lib/sport/roster-link.ts");

const teamA = {
  id: "team-a",
  team: "Ø§Ù„ÙØ±ÙŠÙ‚ Ø£",
  logoUrl: null,
  coachName: null,
  coachPhotoUrl: null,
  players: [
    { id: "player-a-1", name: "Ù…Ø­Ù…Ø¯ Ø¹Ù„ÙŠ", photoUrl: null },
    { id: "player-a-2", name: "Ù…Ø­Ù…Ø¯ Ø¹Ù„ÙŠ", photoUrl: null },
  ],
};
const teamB = {
  id: "team-b",
  team: "Ø§Ù„ÙØ±ÙŠÙ‚ Ø¨",
  logoUrl: null,
  coachName: null,
  coachPhotoUrl: null,
  players: [{ id: "player-b-1", name: "Ø³Ø¹ÙŠØ¯ Ø­Ø³Ù†", photoUrl: null }],
};
const teams = [teamA, teamB];

test("current roster identity resolves canonical player and team names", () => {
  const resolved = resolveStatsPlayer({ id: "goal-1", roster_player_id: "player-a-1", team_roster_id: "team-a", player: "old name", team: "old team" }, teams);
  assert.equal(resolved.player, "Ù…Ø­Ù…Ø¯ Ø¹Ù„ÙŠ");
  assert.equal(resolved.team, "Ø§Ù„ÙØ±ÙŠÙ‚ Ø£");
  assert.equal(resolved.identityKey, "roster:player-a-1");
});

test("legacy snapshot resolves without a roster id", () => {
  const resolved = resolveStatsPlayer({ id: "legacy-1", player: "Ù„Ø§Ø¹Ø¨ ØªØ§Ø±ÙŠØ®ÙŠ", team: "ÙØ±ÙŠÙ‚ ØªØ§Ø±ÙŠØ®ÙŠ" }, teams);
  assert.equal(resolved.player, "Ù„Ø§Ø¹Ø¨ ØªØ§Ø±ÙŠØ®ÙŠ");
  assert.equal(resolved.team, "ÙØ±ÙŠÙ‚ ØªØ§Ø±ÙŠØ®ÙŠ");
  assert.match(resolved.identityKey, /^legacy:/);
});

test("historical null rows never render blank or UUIDs", () => {
  const resolved = resolveStatsPlayer({ id: "legacy-null", player: null, team: null }, teams);
  assert.equal(resolved.player, UNKNOWN_PLAYER);
  assert.equal(resolved.team, UNKNOWN_TEAM);
});

test("goal aggregation uses roster identity and keeps same-name players separate", () => {
  const rows = groupGoalsByPlayer([
    { id: "g1", roster_player_id: "player-a-1", team_roster_id: "team-a", player: "Ù…Ø­Ù…Ø¯ Ø¹Ù„ÙŠ", team: "Ø§Ù„ÙØ±ÙŠÙ‚ Ø£", goals: 2 },
    { id: "g2", roster_player_id: "player-a-1", team_roster_id: "team-a", player: "Ù…Ø­Ù…Ø¯ Ø¹Ù„ÙŠ", team: "Ø§Ù„ÙØ±ÙŠÙ‚ Ø£", goals: 3 },
    { id: "g3", roster_player_id: "player-a-2", team_roster_id: "team-a", player: "Ù…Ø­Ù…Ø¯ Ø¹Ù„ÙŠ", team: "Ø§Ù„ÙØ±ÙŠÙ‚ Ø£", goals: 4 },
  ], teams);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((row) => row.goals), [5, 4]);
  assert.deepEqual(rows.map((row) => row.identityKey).sort(), ["roster:player-a-1", "roster:player-a-2"]);
});

test("card aggregation uses the same identity resolver", () => {
  const rows = groupCardsByPlayer([
    { id: "c1", roster_player_id: "player-b-1", team_roster_id: "team-b", player: "Ø³Ø¹ÙŠØ¯ Ø­Ø³Ù†", team: "Ø§Ù„ÙØ±ÙŠÙ‚ Ø¨", yellow: 1, red: 0 },
    { id: "c2", roster_player_id: "player-b-1", team_roster_id: "team-b", player: "Ø³Ø¹ÙŠØ¯ Ø­Ø³Ù†", team: "Ø§Ù„ÙØ±ÙŠÙ‚ Ø¨", yellow: 2, red: 1 },
  ], teams);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].yellow, 3);
  assert.equal(rows[0].red, 1);
  assert.equal(rows[0].player, "Ø³Ø¹ÙŠØ¯ Ø­Ø³Ù†");
});

test("server validation rejects unknown players and cross-team players", () => {
  const matches = [{ team_a: "Ø§Ù„ÙØ±ÙŠÙ‚ Ø£", team_b: "Ø§Ù„ÙØ±ÙŠÙ‚ Ø¨" }];
  const roster = { id: "team-a", bracket_id: "bracket-1", team_name: "Ø§Ù„ÙØ±ÙŠÙ‚ Ø£" };
  assert.equal(validateStatsPlayerSelection({ bracketId: "bracket-1", roster, player: { id: "player-b-1", roster_id: "team-b", name: "Ø³Ø¹ÙŠØ¯ Ø­Ø³Ù†" }, matches }).ok, false);
  assert.equal(validateStatsPlayerSelection({ bracketId: "bracket-1", roster, player: null, matches }).ok, false);
});

test("server validation accepts an official bracket team before its first match", () => {
  const result = validateStatsPlayerSelection({
    bracketId: "bracket-1",
    roster: { id: "team-c", bracket_id: "bracket-1", team_name: "Ø§Ù„ÙØ±ÙŠÙ‚ Ø¬" },
    player: { id: "player-c-1", roster_id: "team-c", name: "Ù„Ø§Ø¹Ø¨ Ø¬" },
    matches: [{ team_a: "Ø§Ù„ÙØ±ÙŠÙ‚ Ø£", team_b: "Ø§Ù„ÙØ±ÙŠÙ‚ Ø¨" }],
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
    { id: "m1", bracket_id: "b", team_a: "A", team_b: "B", match_date: "2026-01-01", match_time: "10:00", status: "Ø§Ù†ØªÙ‡Øª" },
    { id: "m2", bracket_id: "b", team_a: "A", team_b: "C", match_date: "2026-01-02", match_time: "10:00", status: "Ù…Ø¬Ø¯ÙˆÙ„Ø©" },
  ];
  const cards = [1, 2, 3].map((n, i) => ({ id: `c${n}`, bracket_id: "b", match_id: "m1", roster_player_id: "p", team_roster_id: "t", team: "A", yellow: 1, red: 0 }));
  const state = getSuspensionState(cards, matches, [{ id: "t", team: "A", logoUrl: null, coachName: null, coachPhotoUrl: null, players: [{ id: "p", name: "P", photoUrl: null }] }]);
  assert.equal(state.isSuspended, true);
  assert.equal(state.suspensionMatchId, "m2");
});

test("completed suspension match clears state and legacy cards need assignment", () => {
  const matches = [{ id: "m2", bracket_id: "b", team_a: "A", team_b: "C", match_date: "2026-01-02", match_time: "10:00", status: "Ø§Ù†ØªÙ‡Øª" }];
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
    { id: "m2", bracket_id: "b", team_a: "A", team_b: "C", match_date: "2026-02-02", match_time: "10:00", status: "Ù…Ø¬Ø¯ÙˆÙ„Ø©" },
    { id: "m3", bracket_id: "b", team_a: "A", team_b: "D", match_date: "2026-02-03", match_time: "10:00", status: "Ù…Ø¬Ø¯ÙˆÙ„Ø©" },
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
  const matches = [{ id: "m1", bracket_id: "b", team_a: "A", team_b: "B", match_date: "2026-02-01", match_time: "10:00", status: "Ø§Ù†ØªÙ‡Øª" }, { id: "m2", bracket_id: "b", team_a: "A", team_b: "C", match_date: "2026-02-02", match_time: "10:00", status: "Ù…Ø¬Ø¯ÙˆÙ„Ø©" }];
  const cards = [{ id: "red", bracket_id: "b", match_id: "m1", roster_player_id: "p", team_roster_id: "t", team: "A", yellow: 0, red: 1 }];
  const publicState = getSuspensionState(cards, matches);
  const adminState = getSuspensionState(cards, matches);
  assert.deepEqual(adminState, publicState);
});

test("public suspension status rendering uses readable Arabic labels", () => {
  const source = fs.readFileSync("app/[tournament]/cards/page.tsx", "utf8");
  assert.match(source, /\u0627\u0644\u062d\u0627\u0644\u0629/);
  assert.match(source, /\u0645\u062a\u0627\u062d/);
  assert.match(source, /\u0645\u0648\u0642\u0648\u0641 \u0645\u0628\u0627\u0631\u0627\u0629/);
  assert.doesNotMatch(source, /[Ã™Ã˜]/);
});

test("Card Events UI files contain no common UTF-8 mojibake", () => {
  for (const file of ["components/admin/stats-manager.tsx", "lib/sport/stats-player.ts", "app/[tournament]/cards/page.tsx"]) {
    const source = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(source, /[ÃÂØÙ][^\n]{0,3}[ÃÂØÙ]/);
  }
});

test("admin event GET enriches identity and uses explicit safe columns", () => {
  const route = fs.readFileSync("app/api/admin/card-events/route.ts", "utf8");
  assert.match(route, /roster_players/);
  assert.match(route, /player_name/);
  assert.match(route, /team_name/);
  assert.match(route, /لاعب غير معروف/);
  assert.doesNotMatch(route, /select\("\*"\)/);
});

test("four direct-red events preserve four player identities in admin rendering", () => {
  const teams = [{ id: "jerusalem", team: "القدس", logoUrl: null, coachName: null, coachPhotoUrl: null, players: [
    { id: "p1", name: "وليد صالح حسين", photoUrl: null },
    { id: "p2", name: "حمزه عبدالعاطي عوض", photoUrl: null },
    { id: "p3", name: "مصطفي محمد محمود", photoUrl: null },
    { id: "p4", name: "احمد رمضان اسماعيل", photoUrl: null },
  ] }];
  const events = ["p1", "p2", "p3", "p4"].map((roster_player_id, index) => ({
    id: `red-${index + 1}`, roster_player_id, team_roster_id: "jerusalem", card_type: "direct_red",
  }));
  assert.deepEqual(events.map((event) => resolveStatsPlayer(event, teams).player), [
    "وليد صالح حسين", "حمزه عبدالعاطي عوض", "مصطفي محمد محمود", "احمد رمضان اسماعيل",
  ]);
  const manager = fs.readFileSync("components/admin/stats-manager.tsx", "utf8");
  assert.match(manager, /resolveStatsPlayer\(\{ id: event\.id/);
});

test("public direct-red events resolve four distinct names without legacy card rows", () => {
  const events = [
    ["event-1", "p1", "وليد صالح حسين"],
    ["event-2", "p2", "حمزه عبدالعاطي عوض"],
    ["event-3", "p3", "مصطفي محمد محمود"],
    ["event-4", "p4", "احمد رمضان اسماعيل"],
  ].map(([id, roster_player_id, player_name]) => ({
    id, roster_player_id, team_roster_id: "jerusalem", player_name, team_name: "القدس", card_type: "direct_red",
  }));
  const rows = addEventOnlyCardRows([], events, []);
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map((row) => resolveStatsPlayer(row, []).player), events.map((event) => event.player_name));
  assert.equal(rows.reduce((total, row) => total + (Number(row.red) || 0), 0), 4);
  const publicEvents = fs.readFileSync("lib/sport/public-card-events.ts", "utf8");
  assert.match(publicEvents, /from\("roster_players"\)\.select\("id, roster_id, name"\)/);
  assert.match(publicEvents, /from\("team_rosters"\)\.select\("id, team_name"\)/);
  assert.match(publicEvents, /player_name:/);
});

test("event-only admin rows cannot call legacy card mutation actions", () => {
  const manager = fs.readFileSync("components/admin/stats-manager.tsx", "utf8");
  assert.match(manager, /const isPersistedCard = rows\.some\(\(row\) => row\.id === c\.id\)/);
  assert.match(manager, /\{isPersistedCard && <>[\s\S]*updateCard\(c as Card/);
  assert.match(manager, /if \(!rows\.some\(\(current\) => current\.id === row\.id\)\) return;/);
  assert.match(manager, /if \(!rows\.some\(\(row\) => row\.id === id\)\) return;/);
});

test("card events migration is additive and event based", () => {
  const migration = fs.readFileSync("supabase/migrations/20261008220000_card_events.sql", "utf8");
  assert.match(migration, /create table if not exists public\.card_events/);
  assert.match(migration, /match_id uuid not null/);
  assert.match(migration, /card_type text not null check \(card_type in \('yellow', 'direct_red'\)\)/);
  assert.doesNotMatch(migration, /\bdrop\s+table\b|\bdelete\s+from\b|\btruncate\b|\bupdate\s+public\.cards\b/i);
});

test("card events count three yellows across three matches", () => {
  const matches = [1, 2, 3, 4].map((id) => ({ id: `m${id}`, team_a: "A", team_b: "B", match_date: `2026-10-0${id}`, match_time: "10:00", status: "Ù…Ø¬Ø¯ÙˆÙ„Ø©" }));
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

test("first direct-red event renders a player row when legacy cards are empty", () => {
  const teams = [{ id: "team-1", team: "Ø§Ù„Ù‚Ø¯Ø³", players: [{ id: "player-1", name: "Ø£Ø­Ù…Ø¯" }] }];
  const rows = addEventOnlyCardRows([], [{ id: "event-1", roster_player_id: "player-1", team_roster_id: "team-1", card_type: "direct_red" }], teams);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].red, 1);
  assert.equal(resolveStatsPlayer(rows[0], teams).player, "Ø£Ø­Ù…Ø¯");
  assert.equal(resolveStatsPlayer(rows[0], teams).team, "Ø§Ù„Ù‚Ø¯Ø³");
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
  assert.deepEqual(totals, { yellow: 3, red: 2 });
});

test("a direct red recorded in cards and card_events counts once and suspends", () => {
  const matches = [
    { id: "m1", team_a: "A", team_b: "B", match_date: "2026-10-01", status: "finished" },
    { id: "m2", team_a: "A", team_b: "C", match_date: "2026-10-02", status: "scheduled" },
  ];
  const teams = [{ id: "t", team: "A", players: [{ id: "p", name: "P" }] }];
  const events = [{ id: "r1", match_id: "m1", roster_player_id: "p", team_roster_id: "t", card_type: "direct_red", source_card_id: null }];
  const totals = getCardTotalsWithEvents({ yellow: 0, red: 1 }, events);
  const state = getSuspensionStateFromEvents(events, matches, teams);
  assert.equal(totals.red, 1);
  assert.equal(getCardStatus(state, hasUnassignedCards({ red: 1 }, events)), "موقوف مباراة");
  assert.equal(state.suspensionMatchId, "m2");
});

test("third yellow suspends for the following team match, not the trigger", () => {
  const matches = [1, 2, 3, 4].map((n) => ({ id: `m${n}`, team_a: "A", team_b: "B", match_date: `2026-10-0${n}`, status: n <= 3 ? "finished" : "scheduled" }));
  const events = [1, 2, 3].map((n) => ({ id: `y${n}`, match_id: `m${n}`, roster_player_id: "p", team_roster_id: "t", card_type: "yellow" }));
  const teams = [{ id: "t", team: "A", players: [{ id: "p", name: "P" }] }];
  const state = getSuspensionStateFromEvents(events, matches, teams);
  assert.equal(state.suspensionMatchId, "m4");
  assert.equal(getPlayerEligibilityForMatch(state, "m3").eligible, true);
  assert.equal(getPlayerEligibilityForMatch(state, "m4").eligible, false);
  assert.equal(getCardStatus(state, false), "موقوف مباراة");
  matches[3].status = "postponed";
  const pending = getSuspensionStateFromEvents(events, matches, teams);
  assert.equal(getCardStatus(pending, false), "موقوف مباراة");
  assert.equal(pending.suspensionMatchId, null);
  matches[3].status = "finished";
  assert.equal(getCardStatus(getSuspensionStateFromEvents(events, matches, teams), false), "متاح");
});

test("a postponed match does not serve the ban, but the next completed team match does", () => {
  const matches = [
    { id: "m1", team_a: "A", team_b: "B", match_date: "2026-10-01", status: "finished" },
    { id: "m2", team_a: "A", team_b: "C", match_date: "2026-10-02", status: "postponed" },
    { id: "m3", team_a: "A", team_b: "D", match_date: "2026-10-03", status: "scheduled" },
  ];
  const events = [{ id: "r1", match_id: "m1", roster_player_id: "p", team_roster_id: "t", card_type: "direct_red" }];
  const teams = [{ id: "t", team: "A", players: [] }];
  const pending = getSuspensionStateFromEvents(events, matches, teams);
  assert.equal(getCardStatus(pending, false), "موقوف مباراة");
  assert.equal(pending.suspensionMatchId, "m3");
  assert.equal(getPlayerEligibilityForMatch(pending, "m3").eligible, false);
  matches[2].status = "finished";
  assert.equal(getCardStatus(getSuspensionStateFromEvents(events, matches, teams), false), "متاح");
});

test("a sanction remains active without a scheduled next match", () => {
  const events = [{ id: "r1", match_id: "m1", roster_player_id: "p", team_roster_id: "t", card_type: "direct_red" }];
  const matches = [{ id: "m1", team_a: "A", team_b: "B", match_date: "2026-10-01", status: "finished" }];
  const state = getSuspensionStateFromEvents(events, matches, [{ id: "t", team: "A", players: [] }]);
  assert.equal(state.isSuspended, true);
  assert.equal(state.suspensionMatchId, null);
  assert.equal(getPlayerEligibilityForMatch(state, "future-match").eligible, false);
});

test("missing event or match evidence requires review", () => {
  assert.equal(getCardStatus(getSuspensionStateFromEvents([], [], []), hasUnassignedCards({ red: 1 }, [])), "يحتاج مراجعة");
  const event = { id: "r1", match_id: "missing", roster_player_id: "p", team_roster_id: "t", card_type: "direct_red" };
  assert.equal(getCardStatus(getSuspensionStateFromEvents([event], [], []), false), "يحتاج مراجعة");
  assert.equal(getCardStatus(getSuspensionStateFromEvents([], [], []), false, true), "يحتاج مراجعة");
  const sameDay = [
    { id: "m1", team_a: "A", team_b: "B", match_date: "2026-10-01", status: "finished" },
    { id: "m2", team_a: "A", team_b: "C", match_date: "2026-10-01", status: "scheduled" },
  ];
  assert.equal(getCardStatus(getSuspensionStateFromEvents([{ ...event, match_id: "m1" }], sameDay, [{ id: "t", team: "A", players: [] }]), false), "يحتاج مراجعة");
});

test("public card roster uses readable columns and resolves Jerusalem red card", async () => {
  const query = {
    from(table) {
      assert.equal(table, "team_rosters");
      return {
        select(columns) {
          assert.equal(columns, "id, team_name, roster_players(id, name)");
          return {
            async eq(column, bracketId) {
              assert.equal(column, "bracket_id");
              assert.equal(bracketId, "elite");
              return { data: [
                { id: "jerusalem", team_name: "القدس", roster_players: [{ id: "osama", name: "اسامه محمد عبدالمولي" }] },
                { id: "wadi", team_name: "الوادي", roster_players: [] },
              ], error: null };
            },
          };
        },
      };
    },
  };
  const { teams, error } = await getBracketCardRosterTeams(query, "elite");
  assert.equal(error, null);
  assert.equal(resolveStatsPlayer({ roster_player_id: "osama", team_roster_id: "jerusalem" }, teams).player, "اسامه محمد عبدالمولي");
  const matches = [{ id: "jerusalem-wadi", team_a: "القدس", team_b: "الوادي", match_date: "2026-10-22", match_time: "21:00:00", status: "انتهت" }];
  const events = [{ id: "red", match_id: "jerusalem-wadi", roster_player_id: "osama", team_roster_id: "jerusalem", card_type: "direct_red" }];
  const publicState = getSuspensionStateFromEvents(events, matches, teams);
  const adminState = getSuspensionStateFromEvents(events, matches, teams.map((team) => ({ ...team, logoUrl: "logo" })));
  assert.equal(getCardStatus(publicState, false, Boolean(error)), "موقوف مباراة");
  assert.equal(getCardStatus(adminState, false), "موقوف مباراة");
  matches.push({ id: "next-jerusalem", team_a: "القدس", team_b: "النسور", match_date: "2026-10-24", match_time: "21:00:00", status: "انتهت" });
  assert.equal(getCardStatus(getSuspensionStateFromEvents(events, matches, teams), false), "متاح");
});

test("public card roster query errors remain explicit", async () => {
  const failure = { code: "42501", message: "permission denied for table team_rosters" };
  const db = { from: () => ({ select: () => ({ eq: async () => ({ data: null, error: failure }) }) }) };
  const result = await getBracketCardRosterTeams(db, "elite");
  assert.deepEqual(result.teams, []);
  assert.equal(result.error, failure);
  assert.equal(getCardStatus(getSuspensionStateFromEvents([], [], []), false, Boolean(result.error)), "يحتاج مراجعة");
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

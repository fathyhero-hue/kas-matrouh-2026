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

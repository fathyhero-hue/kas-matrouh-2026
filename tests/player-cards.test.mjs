import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { calculateA4Pages } from "../lib/player-cards/pagination.ts";
import { renderCardSvg } from "../lib/player-cards/renderer.ts";

test("A4 pagination never exceeds four cards", () => {
  const expected = new Map([[1, 1], [4, 1], [5, 2], [8, 2], [9, 3], [16, 4], [20, 5], [22, 6]]);
  for (const [count, pages] of expected) assert.equal(calculateA4Pages(count), pages);
});

test("self-contained renderer has no CSSOM or foreignObject dependency", () => {
  const svg = renderCardSvg({ fullName: "لاعب تجريبي", role: "player", roleLabel: "لاعب", team: "فريق تجريبي", tournament: "كأس النخبة", serial: "MTR-TEST", qrPayload: "test" }, "front");
  assert.match(svg, /<svg/);
  assert.match(svg, /لاعب تجريبي/);
  assert.doesNotMatch(svg, /styleSheets|cssRules|foreignObject/);
});

test("player cards migration is additive and service-role-only", () => {
  const sql = fs.readFileSync("supabase/migrations/20260930212849_player_cards.sql", "utf8");
  for (const column of ["roster_player_id", "team_roster_id", "bracket_id", "player_registration_id", "card_number", "display_overrides", "created_by", "updated_by"]) assert.match(sql, new RegExp(`\\b${column}\\b`));
  assert.match(sql, /alter table public\.player_cards enable row level security/);
  assert.match(sql, /revoke all on table public\.player_cards from anon, authenticated/);
  assert.doesNotMatch(sql, /\b(drop\s+table|truncate\s+table|delete\s+from)\b/i);
});

test("renderer and export source do not import html-to-image", () => {
  const source = `${fs.readFileSync("lib/player-cards/renderer.ts", "utf8")}\n${fs.readFileSync("lib/player-cards/export.ts", "utf8")}`;
  assert.doesNotMatch(source, /html-to-image/);
});

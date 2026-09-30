import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { calculateA4Pages } from "../lib/player-cards/pagination.ts";
import { renderCardSvg } from "../lib/player-cards/renderer.ts";
import { A4_CARD_WIDTH_MM, A4_HEIGHT_MM, A4_WIDTH_MM, containRect, getA4CardRect, getContainScale } from "../lib/player-cards/layout.ts";

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

test("canonical dimensions and preview containment preserve aspect ratio", () => {
  const svg = renderCardSvg({ fullName: "test", role: "player", roleLabel: "player", team: "team", tournament: "tournament", serial: "MTR-TEST", qrPayload: "test" }, "front");
  assert.match(svg, /width="640" height="404" viewBox="0 0 640 404"/);
  assert.equal(getContainScale(320, 202, 640, 404), 0.5);
  assert.equal(getContainScale(1600, 1600, 640, 404), 1);
  const rect = containRect(640, 404, 180, 277);
  assert.ok(rect.width <= 180);
  assert.ok(rect.height <= 277);
  assert.equal(Number((rect.width / rect.height).toFixed(6)), Number((640 / 404).toFixed(6)));
});

test("A4 card rectangles stay inside the printable safe area", () => {
  for (let index = 0; index < 4; index += 1) {
    const rect = getA4CardRect(index, 640 / 404);
    assert.ok(rect.x >= 0 && rect.y >= 0);
    assert.ok(rect.x + rect.width <= A4_WIDTH_MM);
    assert.ok(rect.y + rect.height <= A4_HEIGHT_MM);
    assert.equal(rect.width, A4_CARD_WIDTH_MM);
    assert.equal(rect.height, 92 / (640 / 404));
  }
});

test("export and print paths do not use viewport or DOM preview dimensions", () => {
  const exportSource = fs.readFileSync("lib/player-cards/export.ts", "utf8");
  const printSource = fs.readFileSync("app/admin/(protected)/player-cards/[teamId]/print/page.tsx", "utf8");
  assert.doesNotMatch(exportSource, /getBoundingClientRect|clientWidth|clientHeight/);
  assert.match(exportSource, /renderCardFacePng\(item, "back"\)/);
  assert.match(printSource, /grid-template-columns: repeat\(2/);
  assert.match(printSource, /face: "front"/);
  assert.match(printSource, /face: "back"/);
  assert.match(printSource, /chunk\(cards, 4\)/);
});

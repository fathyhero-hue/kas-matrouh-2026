import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { calculateA4Pages } from "../lib/player-cards/pagination.ts";
import { CARD_HEIGHT, CARD_WIDTH, PRINT_HEIGHT, PRINT_WIDTH, renderCardSvg } from "../lib/player-cards/renderer.ts";
import {
  A4_CARD_FACES_PER_PAGE,
  A4_HEIGHT_MM,
  A4_WIDTH_MM,
  PRINT_CARD_HEIGHT_MM,
  PRINT_CARD_WIDTH_MM,
  containRect,
  getA4CardRect,
  getA4SheetRects,
  getContainScale,
  getCutGuideRect,
} from "../lib/player-cards/layout.ts";

const sample = {
  fullName: "\u0644\u0627\u0639\u0628 \u062a\u062c\u0631\u064a\u0628\u064a",
  role: "player",
  roleLabel: "\u0644\u0627\u0639\u0628",
  team: "\u0641\u0631\u064a\u0642 \u062a\u062c\u0631\u064a\u0628\u064a",
  tournament: "\u0643\u0623\u0633 \u0627\u0644\u0646\u062e\u0628\u0629",
  serial: "MTR-TEST",
  qrPayload: "test",
};

test("A4 pagination is four players per sheet", () => {
  const expected = new Map([[1, 1], [4, 1], [5, 2], [8, 2], [9, 3], [12, 3], [16, 4], [20, 5], [22, 6]]);
  for (const [count, pages] of expected) assert.equal(calculateA4Pages(count), pages);
  assert.equal(A4_CARD_FACES_PER_PAGE, 8);
});

test("print master is exact 9:5 and remains self-contained", () => {
  const front = renderCardSvg(sample, "front");
  const back = renderCardSvg(sample, "back");
  assert.match(front, /width="900" height="500" viewBox="0 0 900 500"/);
  assert.match(back, /width="900" height="500" viewBox="0 0 900 500"/);
  assert.equal(PRINT_WIDTH / PRINT_HEIGHT, 1.8);
  assert.doesNotMatch(`${front}${back}`, /styleSheets|cssRules|foreignObject/);
  assert.doesNotMatch(fs.readFileSync("lib/player-cards/export.ts", "utf8"), /html-to-image/);
});

test("browser preview dimensions remain separate from print master", () => {
  assert.equal(CARD_WIDTH, 640);
  assert.equal(CARD_HEIGHT, 404);
  assert.equal(getContainScale(320, 202, CARD_WIDTH, CARD_HEIGHT), 0.5);
  const rect = containRect(CARD_WIDTH, CARD_HEIGHT, 180, 277);
  assert.ok(rect.width <= 180);
  assert.ok(rect.height <= 277);
  assert.equal(Number((rect.width / rect.height).toFixed(6)), Number((CARD_WIDTH / CARD_HEIGHT).toFixed(6)));
});

test("A4 sheet places exact 90x50mm faces in a 2x4 front/back layout", () => {
  const rects = getA4SheetRects(4);
  assert.equal(rects.length, 8);
  for (const rect of rects) {
    assert.equal(rect.width, PRINT_CARD_WIDTH_MM);
    assert.equal(rect.height, PRINT_CARD_HEIGHT_MM);
    assert.ok(rect.x >= 0 && rect.y >= 0);
    assert.ok(rect.x + rect.width <= A4_WIDTH_MM);
    assert.ok(rect.y + rect.height <= A4_HEIGHT_MM);
    const guide = getCutGuideRect(rect);
    assert.ok(guide.x >= 0 && guide.y >= 0);
    assert.ok(guide.x + guide.width <= A4_WIDTH_MM);
    assert.ok(guide.y + guide.height <= A4_HEIGHT_MM);
  }
  assert.deepEqual(getA4CardRect(0, "front"), { x: 10, y: 20.5, width: 90, height: 50, face: "front", playerIndex: 0 });
  assert.deepEqual(getA4CardRect(1, "front"), { x: 110, y: 20.5, width: 90, height: 50, face: "front", playerIndex: 1 });
  assert.deepEqual(getA4CardRect(0, "back"), { x: 10, y: 168.5, width: 90, height: 50, face: "back", playerIndex: 0 });
  assert.deepEqual(getA4CardRect(3, "back"), { x: 110, y: 226.5, width: 90, height: 50, face: "back", playerIndex: 3 });
});

test("single export is a 90x50mm two-page PDF, bulk export shares each A4 page", () => {
  const exportSource = fs.readFileSync("lib/player-cards/export.ts", "utf8");
  assert.match(exportSource, /format: \[PRINT_CARD_WIDTH_MM, PRINT_CARD_HEIGHT_MM\]/);
  assert.match(exportSource, /doc\.addPage\(\[PRINT_CARD_WIDTH_MM, PRINT_CARD_HEIGHT_MM\]/);
  assert.match(exportSource, /const pages = chunk\(faces, 4\)/);
  assert.match(exportSource, /getA4CardRect\(playerIndex, "front"\)/);
  assert.match(exportSource, /getA4CardRect\(playerIndex, "back"\)/);
  assert.doesNotMatch(exportSource, /addFacePages|doc\.addPage\(\);\s*addFacePages/);
});

test("print preview is a scaled A4 sheet, not a responsive card grid", () => {
  const printSource = fs.readFileSync("app/admin/(protected)/player-cards/[teamId]/print/page.tsx", "utf8");
  const previewSource = fs.readFileSync("components/admin/player-cards-print-preview.tsx", "utf8");
  assert.match(printSource, /PlayerCardsPrintPreview/);
  assert.match(printSource, /chunk\(cards, 4\)/);
  assert.doesNotMatch(printSource, /<IdCard/);
  assert.match(previewSource, /aspect-ratio: 210 \/ 297/);
  assert.match(previewSource, /showCutGuides, setShowCutGuides\] = useState\(true\)/);
  assert.match(previewSource, /getA4CardRect\(playerIndex, "front"\)/);
});

test("front renderer wraps long names and masks national IDs", () => {
  const data = {
    ...sample,
    fullName: "\u0639\u0628\u062f\u0627\u0644\u0631\u062d\u0645\u0646 \u0645\u062d\u0645\u062f \u0639\u0628\u062f\u0627\u0644\u0631\u062d\u0645\u0646 \u0627\u0644\u0633\u0646\u0648\u0633\u064a",
    team: "\u0641\u0631\u064a\u0642 \u063a\u0648\u0637 \u0631\u0628\u0627\u062d \u0627\u0644\u0631\u064a\u0627\u0636\u064a",
    nationalId: "12345678901234",
  };
  const svg = renderCardSvg(data, "front");
  assert.match(svg, new RegExp(`width="${PRINT_WIDTH}" height="${PRINT_HEIGHT}" viewBox="0 0 ${PRINT_WIDTH} ${PRINT_HEIGHT}"`));
  assert.equal((svg.match(/<tspan /g) || []).length >= 5, true);
  assert.match(svg, /\*{10}1234/);
  assert.doesNotMatch(svg, /12345678901234/);
  assert.match(renderCardSvg(data, "back"), /viewBox="0 0 900 500"/);
  assert.equal(PRINT_CARD_WIDTH_MM / PRINT_CARD_HEIGHT_MM, 1.8);
});

export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;
export const PRINT_CARD_WIDTH_MM = 90;
export const PRINT_CARD_HEIGHT_MM = 50;
export const PRINT_CARD_ASPECT_RATIO = PRINT_CARD_WIDTH_MM / PRINT_CARD_HEIGHT_MM;
export const A4_CARD_COLUMNS = 2;
export const A4_CARD_ROWS = 4;
export const A4_CARDS_PER_PAGE = 4;
export const A4_CARD_FACES_PER_PAGE = A4_CARDS_PER_PAGE * 2;
export const A4_HORIZONTAL_MARGIN_MM = 10;
export const A4_HORIZONTAL_GAP_MM = 10;
export const A4_VERTICAL_GAP_MM = 8;
export const A4_FRONT_BACK_GAP_MM = 40;
export const A4_VERTICAL_MARGIN_MM = (A4_HEIGHT_MM - (PRINT_CARD_HEIGHT_MM * A4_CARD_ROWS) - (A4_VERTICAL_GAP_MM * 2) - A4_FRONT_BACK_GAP_MM) / 2;
export const CUT_GUIDE_OFFSET_MM = 1;

export type CardFace = "front" | "back";
export type A4CardRect = { x: number; y: number; width: number; height: number; face: CardFace; playerIndex: number };

export type ContainedRect = { x: number; y: number; width: number; height: number; scale: number };

export function containRect(contentWidth: number, contentHeight: number, availableWidth: number, availableHeight: number): ContainedRect {
  if (contentWidth <= 0 || contentHeight <= 0 || availableWidth <= 0 || availableHeight <= 0) {
    return { x: 0, y: 0, width: 0, height: 0, scale: 0 };
  }
  const scale = Math.min(availableWidth / contentWidth, availableHeight / contentHeight);
  const width = contentWidth * scale;
  const height = contentHeight * scale;
  return { x: (availableWidth - width) / 2, y: (availableHeight - height) / 2, width, height, scale };
}

export function getContainScale(availableWidth: number, availableHeight: number, contentWidth: number, contentHeight: number, maxScale = 1) {
  if (availableWidth <= 0 || availableHeight <= 0) return 0;
  return Math.min(availableWidth / contentWidth, availableHeight / contentHeight, maxScale);
}

export function getContainedRect(availableWidth: number, availableHeight: number, contentWidth: number, contentHeight: number): ContainedRect {
  const scale = getContainScale(availableWidth, availableHeight, contentWidth, contentHeight);
  const width = contentWidth * scale;
  const height = contentHeight * scale;
  return { x: (availableWidth - width) / 2, y: (availableHeight - height) / 2, width, height, scale };
}

export function getA4CardRect(playerIndex: number, face: CardFace): A4CardRect {
  const slot = Math.max(0, Math.min(A4_CARDS_PER_PAGE - 1, playerIndex));
  const rowWithinFace = Math.floor(slot / A4_CARD_COLUMNS);
  const column = slot % A4_CARD_COLUMNS;
  const faceStartY = face === "front"
    ? A4_VERTICAL_MARGIN_MM
    : A4_VERTICAL_MARGIN_MM + PRINT_CARD_HEIGHT_MM * 2 + A4_VERTICAL_GAP_MM + A4_FRONT_BACK_GAP_MM;
  return {
    x: A4_HORIZONTAL_MARGIN_MM + column * (PRINT_CARD_WIDTH_MM + A4_HORIZONTAL_GAP_MM),
    y: faceStartY + rowWithinFace * (PRINT_CARD_HEIGHT_MM + A4_VERTICAL_GAP_MM),
    width: PRINT_CARD_WIDTH_MM,
    height: PRINT_CARD_HEIGHT_MM,
    face,
    playerIndex: slot,
  };
}

export function getA4SheetRects(playerCount: number) {
  const count = Math.max(0, Math.min(A4_CARDS_PER_PAGE, playerCount));
  return Array.from({ length: count }, (_, playerIndex) => [
    getA4CardRect(playerIndex, "front"),
    getA4CardRect(playerIndex, "back"),
  ]).flat();
}

export function getCutGuideRect(rect: Pick<A4CardRect, "x" | "y" | "width" | "height">) {
  return {
    x: rect.x - CUT_GUIDE_OFFSET_MM,
    y: rect.y - CUT_GUIDE_OFFSET_MM,
    width: rect.width + CUT_GUIDE_OFFSET_MM * 2,
    height: rect.height + CUT_GUIDE_OFFSET_MM * 2,
  };
}

export function chunk<T>(items: T[], size: number) {
  const pages: T[][] = [];
  for (let index = 0; index < items.length; index += size) pages.push(items.slice(index, index + size));
  return pages;
}

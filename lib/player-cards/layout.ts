export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;
export const A4_CARD_GAP_MM = 6;
export const A4_CARD_WIDTH_MM = 92;
export const A4_CARD_COLUMNS = 2;
export const A4_CARD_ROWS = 2;
export const A4_CARDS_PER_PAGE = A4_CARD_COLUMNS * A4_CARD_ROWS;

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

export function getA4CardRect(index: number, cardAspectRatio: number) {
  const position = index % A4_CARDS_PER_PAGE;
  const row = Math.floor(position / A4_CARD_COLUMNS);
  const column = position % A4_CARD_COLUMNS;
  const marginX = 10;
  const marginY = 10;
  const cellWidth = (A4_WIDTH_MM - marginX * 2 - A4_CARD_GAP_MM) / A4_CARD_COLUMNS;
  const cellHeight = (A4_HEIGHT_MM - marginY * 2 - A4_CARD_GAP_MM) / A4_CARD_ROWS;
  const cardHeight = A4_CARD_WIDTH_MM / cardAspectRatio;
  return {
    x: marginX + column * (cellWidth + A4_CARD_GAP_MM) + (cellWidth - A4_CARD_WIDTH_MM) / 2,
    y: marginY + row * (cellHeight + A4_CARD_GAP_MM) + (cellHeight - cardHeight) / 2,
    width: A4_CARD_WIDTH_MM,
    height: cardHeight,
  };
}

export function chunk<T>(items: T[], size: number) {
  const pages: T[][] = [];
  for (let index = 0; index < items.length; index += size) pages.push(items.slice(index, index + size));
  return pages;
}

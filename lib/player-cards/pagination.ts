export const cardsPerA4Page = 4;

export function calculateA4Pages(cardCount: number) {
  return Math.max(0, Math.ceil(Math.max(0, cardCount) / cardsPerA4Page));
}

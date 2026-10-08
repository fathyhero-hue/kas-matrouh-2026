export type LegacyCardTotals = { yellow?: number | null; red?: number | null };
export type CardEventAssignment = { ordinal: number; match_id: string; card_type: "yellow" | "direct_red" };

export function buildCardEventAssignments(row: LegacyCardTotals, selectedMatches: Record<number, string>): CardEventAssignment[] {
  const yellowCount = Math.max(0, Number(row.yellow) || 0);
  const redCount = Math.max(0, Number(row.red) || 0);
  const types = [...Array(yellowCount).fill("yellow" as const), ...Array(redCount).fill("direct_red" as const)];
  return types.flatMap((card_type, index) => {
    const match_id = selectedMatches[index + 1]?.trim();
    return match_id ? [{ ordinal: index + 1, match_id, card_type }] : [];
  });
}

export function countAssignedCardEvents(row: LegacyCardTotals, selectedMatches: Record<number, string>): number {
  return buildCardEventAssignments(row, selectedMatches).length;
}

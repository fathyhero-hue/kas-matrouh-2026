export type TournamentSlug = "matrouh-cup" | "elite-cup" | "ramadan-cup";

export type Edition = { key: string; suffix: string; label: string };

export const TOURNAMENTS: Record<
  TournamentSlug,
  { tournament: string; label: string; icon: string; editions: Edition[]; defaultEdition: string }
> = {
  "matrouh-cup": {
    tournament: "matrouh_cup",
    label: "كأس مطروح",
    icon: "🏆",
    defaultEdition: "ed3",
    editions: [
      { key: "ed3", suffix: "", label: "النسخة الثالثة" },
      { key: "ed4", suffix: "_ed4", label: "النسخة الرابعة" },
    ],
  },
  "elite-cup": {
    tournament: "elite_cup",
    label: "كأس النخبة",
    icon: "⭐",
    defaultEdition: "main",
    editions: [{ key: "main", suffix: "_elite", label: "كأس النخبة" }],
  },
  "ramadan-cup": {
    tournament: "ramadan_cup",
    label: "بطولة حزب الشعب الجمهوري",
    icon: "🌙",
    defaultEdition: "main",
    editions: [{ key: "main", suffix: "_ramadan", label: "البطولة الرمضانية" }],
  },
};

export function isTournamentSlug(value: string): value is TournamentSlug {
  return value in TOURNAMENTS;
}

// Max roster size per tournament — shared by the submit form, the admin
// roster manager, and the public rosters list (for the completeness badge).
export const ROSTER_MAX_PLAYERS: Partial<Record<TournamentSlug, number>> = {
  "elite-cup": 11,
};
export const DEFAULT_ROSTER_MAX_PLAYERS = 12;

export function getRosterMaxPlayers(slug: TournamentSlug): number {
  return ROSTER_MAX_PLAYERS[slug] ?? DEFAULT_ROSTER_MAX_PLAYERS;
}

// Tournaments with a real roster/access-code system — public roster
// submission, the admin's per-tournament registration-settings panel (shared
// code + deadline), and the player-card gate all key off this same set.
export const ROSTER_SUBMISSION_TOURNAMENTS: TournamentSlug[] = ["matrouh-cup", "elite-cup", "ramadan-cup"];

export function supportsRosterSubmission(slug: TournamentSlug): boolean {
  return ROSTER_SUBMISSION_TOURNAMENTS.includes(slug);
}

export type TournamentPageProps = {
  params: Promise<{ tournament: string }>;
  searchParams: Promise<{ edition?: string }>;
};

export function resolveEdition(slug: TournamentSlug, editionKey?: string): Edition {
  const config = TOURNAMENTS[slug];
  const found = editionKey && config.editions.find((e) => e.key === editionKey);
  return found || config.editions.find((e) => e.key === config.defaultEdition) || config.editions[0];
}

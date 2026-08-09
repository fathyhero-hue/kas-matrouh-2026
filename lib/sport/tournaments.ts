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

export type TournamentPageProps = {
  params: Promise<{ tournament: string }>;
  searchParams: Promise<{ edition?: string }>;
};

export function resolveEdition(slug: TournamentSlug, editionKey?: string): Edition {
  const config = TOURNAMENTS[slug];
  const found = editionKey && config.editions.find((e) => e.key === editionKey);
  return found || config.editions.find((e) => e.key === config.defaultEdition) || config.editions[0];
}

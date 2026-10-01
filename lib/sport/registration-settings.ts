export const REGISTRATION_KEYS = ["matrouh", "elite", "ramadan"] as const;

export type RegistrationKey = (typeof REGISTRATION_KEYS)[number];

const REGISTRATION_KEY_BY_TOURNAMENT: Record<string, RegistrationKey> = {
  matrouh: "matrouh",
  matrouh_cup: "matrouh",
  "matrouh-cup": "matrouh",
  elite: "elite",
  elite_cup: "elite",
  "elite-cup": "elite",
  ramadan: "ramadan",
  ramadan_cup: "ramadan",
  "ramadan-cup": "ramadan",
};

const TOURNAMENT_BY_REGISTRATION_KEY: Record<RegistrationKey, string> = {
  matrouh: "matrouh_cup",
  elite: "elite_cup",
  ramadan: "ramadan_cup",
};

export function parseRegistrationKey(value: unknown): RegistrationKey | null {
  return typeof value === "string" && (REGISTRATION_KEYS as readonly string[]).includes(value)
    ? (value as RegistrationKey)
    : null;
}

export function getRegistrationKeyForTournament(value: unknown): RegistrationKey | null {
  return typeof value === "string" ? REGISTRATION_KEY_BY_TOURNAMENT[value] || null : null;
}

export function getTournamentStorageValue(value: unknown): string | null {
  const key = getRegistrationKeyForTournament(value);
  return key ? TOURNAMENT_BY_REGISTRATION_KEY[key] : null;
}

export function isDateOnly(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return date.getUTCFullYear() === Number(value.slice(0, 4))
    && date.getUTCMonth() + 1 === Number(value.slice(5, 7))
    && date.getUTCDate() === Number(value.slice(8, 10));
}

function dateKeyInTimeZone(value: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function isRegistrationOpen(deadline: string | null | undefined, now = new Date()): boolean {
  if (!deadline) return true;

  // Date-only deadlines are inclusive through the end of the calendar day in
  // the application's timezone, rather than UTC midnight.
  if (isDateOnly(deadline)) return dateKeyInTimeZone(now, "Africa/Cairo") <= deadline;

  const timestamp = new Date(deadline).getTime();
  return Number.isFinite(timestamp) && now.getTime() <= timestamp;
}

export function parseDeadline(value: unknown): string | null | undefined {
  if (value === "" || value === null || value === undefined) return null;
  return isDateOnly(value) ? value : undefined;
}

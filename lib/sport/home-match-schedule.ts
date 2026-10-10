export type ScheduledMatch = {
  id: string;
  bracket_id: string;
  team_a: string;
  team_a_logo: string | null;
  team_b: string;
  team_b_logo: string | null;
  match_date: string | null;
  match_time: string | null;
  venue?: string | null;
  status: string | null;
  is_live: boolean | null;
  home_goals: number | null;
  away_goals: number | null;
  round: string | null;
  live_minute: number | null;
  live_minute_base: number | null;
  timer_started_at: string | null;
  timer_paused_total: number | null;
  is_timer_running: boolean | null;
  tournament_label: string;
  tournament_href: string | null;
  events?: PublicMatchEvent[];
};

export type PublicMatchEvent = {
  id: string;
  event_type: "goal" | "yellow" | "direct_red" | "second_yellow_red";
  team_name: string;
  player_name: string;
  match_minute: number | null;
};

export type ScheduledMatchWithKickoff = ScheduledMatch & { kickoffAt: string };

export type HomeMatchSections = {
  broadcastMatches: Array<ScheduledMatchWithKickoff & { broadcastState: "starting_soon" | "live" }>;
  upcomingMatches: ScheduledMatchWithKickoff[];
};

const CAIRO_TIME_ZONE = "Africa/Cairo";
const TERMINAL_STATUSES = new Set(["انتهت", "ملغاة", "ملغي", "تأجلت", "مؤجلة", "مؤجل", "postponed", "cancelled", "canceled"]);
const NOT_STARTED_STATUSES = new Set(["لم تبدأ", "ستبدأ بعد قليل"]);
const OFFICIAL_LIVE_STATUSES = new Set(["الشوط الأول", "استراحة", "الشوط الثاني", "ضربات جزاء"]);
const BROADCAST_LEAD_MS = 2 * 60 * 60 * 1000;

function formatParts(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
}

function wallClockMilliseconds(date: string, time: string): number | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time);
  if (!dateMatch || !timeMatch) return null;

  const [, yearText, monthText, dayText] = dateMatch;
  const [, hourText, minuteText, secondText = "0"] = timeMatch;
  const parts = [yearText, monthText, dayText, hourText, minuteText, secondText].map(Number);
  const [year, month, day, hour, minute, second] = parts;
  const value = Date.UTC(year, month - 1, day, hour, minute, second);
  const parsed = new Date(value);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day ||
    parsed.getUTCHours() !== hour ||
    parsed.getUTCMinutes() !== minute ||
    parsed.getUTCSeconds() !== second
  ) return null;
  return value;
}

export function parseCairoKickoff(date: string | null, time: string | null): Date | null {
  if (!date || !time) return null;
  const targetWallClock = wallClockMilliseconds(date, time);
  if (targetWallClock === null) return null;

  let instant = targetWallClock;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = formatParts(new Date(instant), CAIRO_TIME_ZONE);
    const values = new Map(parts.map(({ type, value }) => [type, value]));
    const renderedWallClock = Date.UTC(
      Number(values.get("year")),
      Number(values.get("month")) - 1,
      Number(values.get("day")),
      Number(values.get("hour")),
      Number(values.get("minute")),
      Number(values.get("second")),
    );
    const adjustment = targetWallClock - renderedWallClock;
    if (adjustment === 0) return new Date(instant);
    instant += adjustment;
  }

  return null;
}

export function formatCairoMatchDateTime(date: string | null, time: string | null): string {
  if (!date) return "موعد غير محدد";
  const wallClock = wallClockMilliseconds(date, time || "00:00");
  if (wallClock === null) return "موعد غير صالح";
  const value = new Date(wallClock);
  const dateLabel = new Intl.DateTimeFormat("ar-EG", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(value);
  if (!time) return dateLabel;
  const timeLabel = new Intl.DateTimeFormat("ar-EG", {
    timeZone: "UTC",
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h12",
  }).format(value);
  return `${dateLabel}، ${timeLabel}`;
}

export function getHomeMatchSections(
  matches: readonly ScheduledMatch[],
  now: Date,
): HomeMatchSections {
  const broadcastMatches: HomeMatchSections["broadcastMatches"] = [];
  const upcomingMatches: ScheduledMatchWithKickoff[] = [];

  for (const match of matches) {
    const status = match.status?.trim() || "";
    if (TERMINAL_STATUSES.has(status)) continue;
    const kickoff = parseCairoKickoff(match.match_date, match.match_time);
    if (!kickoff) continue;

    const scheduled = { ...match, kickoffAt: kickoff.toISOString() };
    const officiallyLive = match.is_live === true || OFFICIAL_LIVE_STATUSES.has(status);
    if (officiallyLive) {
      broadcastMatches.push({ ...scheduled, broadcastState: "live" });
      continue;
    }

    if (!NOT_STARTED_STATUSES.has(status) || match.is_live === true) continue;
    const remaining = kickoff.getTime() - now.getTime();
    if (remaining > 0) upcomingMatches.push(scheduled);
    if (remaining >= 0 && remaining <= BROADCAST_LEAD_MS) {
      broadcastMatches.push({ ...scheduled, broadcastState: "starting_soon" });
    }
  }

  const byKickoff = (left: ScheduledMatchWithKickoff, right: ScheduledMatchWithKickoff) =>
    Date.parse(left.kickoffAt) - Date.parse(right.kickoffAt) || left.id.localeCompare(right.id);
  broadcastMatches.sort((left, right) =>
    (left.broadcastState === "live" ? 0 : 1) - (right.broadcastState === "live" ? 0 : 1) ||
    byKickoff(left, right),
  );
  upcomingMatches.sort(byKickoff);

  return { broadcastMatches, upcomingMatches: upcomingMatches.slice(0, 2) };
}

export type LiveMatchSnapshot = {
  status: string | null;
  is_live: boolean | null;
  live_minute: number | null;
  live_minute_base: number | null;
  timer_started_at: string | null;
  timer_paused_total: number | null;
  is_timer_running: boolean | null;
};

export type LiveMatchAction = "start" | "halftime" | "resume" | "finish";

export function getLiveMinute(match: LiveMatchSnapshot, now: Date): number {
  const base = Number(match.live_minute_base ?? match.live_minute ?? 0) || 0;
  const startedAt = match.timer_started_at ? Date.parse(match.timer_started_at) : 0;
  const pausedTotal = Number(match.timer_paused_total || 0) || 0;
  if (!match.is_timer_running || !startedAt || !Number.isFinite(startedAt)) {
    return Number(match.live_minute ?? base) || 0;
  }
  return base + Math.floor(Math.max(0, now.getTime() - startedAt - pausedTotal) / 60_000);
}

export function createLiveMatchTransition(
  match: LiveMatchSnapshot,
  action: LiveMatchAction,
  now: Date,
): Record<string, unknown> | null {
  const status = match.status?.trim() || "";
  const minute = getLiveMinute(match, now);
  const timestamp = now.toISOString();

  if (action === "start" && NOT_STARTED_STATUSES.has(status) && match.is_live !== true) {
    return {
      status: "الشوط الأول",
      is_live: true,
      live_minute: 0,
      live_minute_base: 0,
      timer_started_at: timestamp,
      timer_paused_total: 0,
      is_timer_running: true,
    };
  }
  if (action === "halftime" && status === "الشوط الأول" && match.is_live === true) {
    return {
      status: "استراحة",
      is_live: true,
      live_minute: minute,
      live_minute_base: minute,
      timer_started_at: null,
      timer_paused_total: 0,
      is_timer_running: false,
    };
  }
  if (action === "resume" && status === "استراحة" && match.is_live === true) {
    return {
      status: "الشوط الثاني",
      is_live: true,
      live_minute: minute,
      live_minute_base: minute,
      timer_started_at: timestamp,
      timer_paused_total: 0,
      is_timer_running: true,
    };
  }
  if (action === "finish" && match.is_live === true && OFFICIAL_LIVE_STATUSES.has(status)) {
    return {
      status: "انتهت",
      is_live: false,
      live_minute: minute,
      live_minute_base: minute,
      timer_started_at: null,
      timer_paused_total: 0,
      is_timer_running: false,
    };
  }
  return null;
}

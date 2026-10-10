import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  createLiveMatchTransition,
  getHomeMatchSections,
  getLiveMinute,
  parseCairoKickoff,
} from "../lib/sport/home-match-schedule.ts";

function match(id, overrides = {}) {
  return {
    id,
    bracket_id: `bracket-${id}`,
    team_a: "الفريق أ",
    team_a_logo: null,
    team_b: "الفريق ب",
    team_b_logo: null,
    match_date: "2026-10-10",
    match_time: "17:00:00",
    status: "لم تبدأ",
    is_live: false,
    home_goals: 0,
    away_goals: 0,
    round: "دور المجموعات",
    tournament_label: `بطولة ${id}`,
    tournament_href: `/${id}`,
    ...overrides,
  };
}

test("Egypt wall-clock schedule is converted with the date-specific Cairo offset", () => {
  assert.equal(parseCairoKickoff("2026-04-05", "21:00:00")?.toISOString(), "2026-04-05T19:00:00.000Z");
  assert.equal(parseCairoKickoff("2026-10-22", "21:00:00")?.toISOString(), "2026-10-22T18:00:00.000Z");
  assert.equal(parseCairoKickoff("2026-10-30", "21:00:00")?.toISOString(), "2026-10-30T19:00:00.000Z");
  assert.equal(parseCairoKickoff("2026-02-30", "21:00"), null);
  assert.equal(parseCairoKickoff("2026-10-10", "25:00"), null);
  assert.equal(parseCairoKickoff(null, "21:00"), null);
});

test("upcoming list is globally sorted across brackets and limited to the nearest two future kickoffs", () => {
  const now = new Date("2026-10-10T12:00:00.000Z");
  const result = getHomeMatchSections([
    match("later-bracket", { match_date: "2026-10-11", match_time: "20:00:00" }),
    match("other-tournament", { match_date: "2026-10-10", match_time: "18:00:00" }),
    match("third", { match_date: "2026-10-12", match_time: "20:00:00" }),
  ], now);
  assert.deepEqual(result.upcomingMatches.map(({ id }) => id), ["other-tournament", "later-bracket"]);
  assert.deepEqual(result.broadcastMatches.map(({ id }) => id), []);
});

test("past, finished, postponed, cancelled, and malformed matches are not upcoming", () => {
  const now = new Date("2026-10-10T12:00:00.000Z");
  const result = getHomeMatchSections([
    match("old", { match_date: "2026-04-05", match_time: "21:00:00" }),
    match("finished", { status: "انتهت", match_date: "2026-10-11" }),
    match("postponed", { status: "تأجلت", match_date: "2026-10-11" }),
    match("postponed-variant", { status: "مؤجلة", match_date: "2026-10-11" }),
    match("cancelled", { status: "ملغاة", match_date: "2026-10-11" }),
    match("cancelled-english", { status: "cancelled", match_date: "2026-10-11" }),
    match("no-time", { match_time: null }),
    match("unknown", { status: "حالة غير معروفة", match_date: "2026-10-11" }),
  ], now);
  assert.deepEqual(result.upcomingMatches, []);
  assert.deepEqual(result.broadcastMatches, []);
});

test("broadcast window begins two hours before kickoff without auto-starting a match", () => {
  const kickoff = "2026-10-10T14:00:00.000Z";
  const scheduled = match("soon");
  scheduled.match_date = "2026-10-10";
  scheduled.match_time = "17:00:00";
  const beforeWindow = getHomeMatchSections([scheduled], new Date("2026-10-10T11:59:59.000Z"));
  const withinWindow = getHomeMatchSections([scheduled], new Date("2026-10-10T12:00:00.000Z"));
  assert.deepEqual(beforeWindow.broadcastMatches, []);
  assert.equal(withinWindow.broadcastMatches[0].broadcastState, "starting_soon");
  assert.equal(withinWindow.broadcastMatches[0].kickoffAt, kickoff);
  assert.equal(withinWindow.upcomingMatches[0].id, "soon");
});

test("official active statuses and is_live identify live matches but kickoff time alone does not", () => {
  const now = new Date("2026-10-10T12:00:00.000Z");
  const scheduled = match("scheduled", { match_date: "2026-10-10", match_time: "15:00:00" });
  const explicitLive = match("explicit", { status: "الشوط الأول", is_live: true });
  const halftime = match("halftime", { status: "استراحة", is_live: true });
  const result = getHomeMatchSections([scheduled, explicitLive, halftime], now);
  assert.deepEqual(result.broadcastMatches.map(({ id, broadcastState }) => [id, broadcastState]), [
    ["explicit", "live"],
    ["halftime", "live"],
    ["scheduled", "starting_soon"],
  ]);
});

test("live controls enforce start, halftime, resume, and finish state transitions", () => {
  const now = new Date("2026-10-10T12:00:00.000Z");
  const scheduled = {
    status: "لم تبدأ",
    is_live: false,
    live_minute: 0,
    live_minute_base: 0,
    timer_started_at: null,
    timer_paused_total: 0,
    is_timer_running: false,
  };
  assert.deepEqual(createLiveMatchTransition(scheduled, "start", now), {
    status: "الشوط الأول",
    is_live: true,
    live_minute: 0,
    live_minute_base: 0,
    timer_started_at: now.toISOString(),
    timer_paused_total: 0,
    is_timer_running: true,
  });
  assert.equal(createLiveMatchTransition(scheduled, "halftime", now), null);
  assert.equal(createLiveMatchTransition({ ...scheduled, status: "انتهت" }, "start", now), null);
  const halftime = { ...scheduled, status: "استراحة", is_live: true, live_minute: 45, live_minute_base: 45 };
  assert.equal(createLiveMatchTransition(halftime, "resume", now).status, "الشوط الثاني");
  assert.deepEqual(createLiveMatchTransition(halftime, "finish", now), {
    status: "انتهت",
    is_live: false,
    live_minute: 45,
    live_minute_base: 45,
    timer_started_at: null,
    timer_paused_total: 0,
    is_timer_running: false,
  });
});

test("live minute uses the explicitly controlled timer and pauses at halftime", () => {
  const now = new Date("2026-10-10T12:46:00.000Z");
  assert.equal(getLiveMinute({
    status: "الشوط الأول",
    is_live: true,
    live_minute: 0,
    live_minute_base: 0,
    timer_started_at: "2026-10-10T12:00:00.000Z",
    timer_paused_total: 0,
    is_timer_running: true,
  }, now), 46);
  assert.equal(getLiveMinute({
    status: "استراحة",
    is_live: true,
    live_minute: 45,
    live_minute_base: 45,
    timer_started_at: null,
    timer_paused_total: 0,
    is_timer_running: false,
  }, now), 45);
});

test("legacy match updates require live permission for live-state and score-finalizing changes", () => {
  const route = fs.readFileSync("app/api/admin/matches/route.ts", "utf8");
  assert.match(route, /authorizeAdminRequest\(req, "matches\.live\.manage"\)/);
  assert.match(route, /requiresLivePermission/);
  assert.match(route, /Object\.prototype\.hasOwnProperty\.call\(patch, "is_live"\)/);
  assert.match(route, /"الشوط الأول".*"استراحة".*"الشوط الثاني".*"ضربات جزاء".*"انتهت"/s);
});

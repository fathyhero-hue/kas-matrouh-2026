import { normalize, type RosterTeamLite } from "./roster-link";

export type SuspensionMatch = { id: string; bracket_id?: string; team_a: string | null; team_b: string | null; match_date?: string | null; match_time?: string | null; status?: string | null };
export type SuspensionCard = { id: string; bracket_id?: string | null; match_id?: string | null; roster_player_id?: string | null; team_roster_id?: string | null; player?: string | null; team?: string | null; yellow?: number | null; red?: number | null };
export type CardEvent = { id: string; bracket_id?: string | null; match_id: string; roster_player_id: string; team_roster_id: string; card_type: "yellow" | "direct_red"; source_card_id?: string | null; source_card_ordinal?: number | null; created_at?: string | null };
export type SuspensionReason = "yellow_accumulation" | "direct_red" | "combined";
export type SuspensionState = { isSuspended: boolean; reason: SuspensionReason | null; yellowCountInCycle: number; triggerMatchId: string | null; suspensionMatchId: string | null; suspensionMatchIds?: string[]; served: boolean; needsMatchAssignment: boolean };

const COMPLETED = new Set(["انتهت", "Ø§Ù†ØªÙ‡Øª", "finished", "completed"]);
const matchSortKey = (match: SuspensionMatch) => `${match.match_date || "9999-99-99"}T${match.match_time || "99:99:99"}::${match.id}`;
const isCompleted = (match: SuspensionMatch) => COMPLETED.has(String(match.status || "").trim().toLowerCase());
const nextTeamMatch = (matches: SuspensionMatch[], team: string, from: SuspensionMatch) => matches.filter((match) => normalize(match.team_a || "") === normalize(team) || normalize(match.team_b || "") === normalize(team)).sort((a, b) => matchSortKey(a).localeCompare(matchSortKey(b))).find((match) => matchSortKey(match) > matchSortKey(from));

export function getSuspensionState(cards: SuspensionCard[], matches: SuspensionMatch[], teams: RosterTeamLite[] = []): SuspensionState {
  const assigned = cards.filter((card) => card.match_id && card.roster_player_id && card.team_roster_id);
  const needsMatchAssignment = cards.some((card) => !card.match_id && !!card.roster_player_id);
  const events = assigned.map((card) => ({ card, match: matches.find((match) => match.id === card.match_id) })).filter((event): event is { card: SuspensionCard; match: SuspensionMatch } => !!event.match).sort((a, b) => matchSortKey(a.match).localeCompare(matchSortKey(b.match)));
  let yellowCountInCycle = 0;
  let pending: { reason: SuspensionReason; triggerMatchId: string; suspensionMatchId: string } | null = null;
  for (const event of events) {
    if (pending && event.match.id === pending.suspensionMatchId && isCompleted(event.match)) { pending = null; yellowCountInCycle = 0; }
    const team = teams.find((candidate) => candidate.id === event.card.team_roster_id)?.team || event.card.team || "";
    if (!team || ![event.match.team_a, event.match.team_b].map((name) => normalize(name || "")).includes(normalize(team))) continue;
    const red = Number(event.card.red) || 0;
    const yellow = Number(event.card.yellow) || 0;
    const reachesThirdYellow = yellowCountInCycle + yellow >= 3;
    yellowCountInCycle = reachesThirdYellow ? 0 : yellowCountInCycle + yellow;
    const next = nextTeamMatch(matches, team, event.match);
    if (next && red > 0 && reachesThirdYellow) pending = { reason: "combined", triggerMatchId: event.match.id, suspensionMatchId: next.id };
    else if (next && red > 0 && !pending) pending = { reason: "direct_red", triggerMatchId: event.match.id, suspensionMatchId: next.id };
    else if (next && reachesThirdYellow && !pending) pending = { reason: "yellow_accumulation", triggerMatchId: event.match.id, suspensionMatchId: next.id };
  }
  const pendingMatchId = pending?.suspensionMatchId;
  if (pending && pendingMatchId && isCompleted(matches.find((match) => match.id === pendingMatchId) || { id: pendingMatchId, team_a: null, team_b: null, status: null })) pending = null;
  return pending ? { isSuspended: true, reason: pending.reason, yellowCountInCycle, triggerMatchId: pending.triggerMatchId, suspensionMatchId: pending.suspensionMatchId, suspensionMatchIds: [pending.suspensionMatchId], served: false, needsMatchAssignment } : { isSuspended: false, reason: null, yellowCountInCycle, triggerMatchId: null, suspensionMatchId: null, suspensionMatchIds: [], served: true, needsMatchAssignment };
}

export function getPlayerEligibilityForMatch(state: SuspensionState, targetMatchId: string) {
  const isSuspended = state.isSuspended && (state.suspensionMatchIds?.includes(targetMatchId) || state.suspensionMatchId === targetMatchId);
  return { eligible: !isSuspended, isSuspended, reason: isSuspended ? state.reason : null, suspensionMatchId: state.suspensionMatchId };
}

export function getSuspensionStateFromEvents(events: CardEvent[], matches: SuspensionMatch[], teams: RosterTeamLite[] = []): SuspensionState {
  const grouped = new Map<string, { match: SuspensionMatch; events: CardEvent[] }>();
  for (const event of events) {
    const match = matches.find((candidate) => candidate.id === event.match_id);
    if (!match) continue;
    const group = grouped.get(match.id) || { match, events: [] };
    group.events.push(event);
    grouped.set(match.id, group);
  }
  const sanctions: { reason: SuspensionReason; triggerMatchId: string; suspensionMatchId: string }[] = [];
  let yellowCountInCycle = 0;
  for (const group of [...grouped.values()].sort((a, b) => matchSortKey(a.match).localeCompare(matchSortKey(b.match)))) {
    while (sanctions[0] && sanctions[0].suspensionMatchId === group.match.id && isCompleted(group.match)) sanctions.shift();
    const first = group.events[0];
    const team = teams.find((candidate) => candidate.id === first.team_roster_id)?.team || "";
    if (!team || ![group.match.team_a, group.match.team_b].map((name) => normalize(name || "")).includes(normalize(team))) continue;
    const yellow = group.events.filter((event) => event.card_type === "yellow").length;
    const directRed = group.events.some((event) => event.card_type === "direct_red");
    const reachesThirdYellow = yellowCountInCycle + yellow >= 3;
    yellowCountInCycle = reachesThirdYellow ? 0 : yellowCountInCycle + yellow;
    const next = nextTeamMatch(matches, team, group.match);
    if (!next) continue;
    if (directRed && reachesThirdYellow) sanctions.push({ reason: "combined", triggerMatchId: group.match.id, suspensionMatchId: next.id });
    else if (directRed) sanctions.push({ reason: "direct_red", triggerMatchId: group.match.id, suspensionMatchId: next.id });
    else if (reachesThirdYellow) sanctions.push({ reason: "yellow_accumulation", triggerMatchId: group.match.id, suspensionMatchId: next.id });
  }
  const active = sanctions.filter((sanction) => !isCompleted(matches.find((match) => match.id === sanction.suspensionMatchId) || { id: sanction.suspensionMatchId, team_a: null, team_b: null, status: null }));
  return active.length ? { isSuspended: true, reason: active[0].reason, yellowCountInCycle, triggerMatchId: active[0].triggerMatchId, suspensionMatchId: active[0].suspensionMatchId, suspensionMatchIds: active.map((sanction) => sanction.suspensionMatchId), served: false, needsMatchAssignment: false } : { isSuspended: false, reason: null, yellowCountInCycle, triggerMatchId: null, suspensionMatchId: null, suspensionMatchIds: [], served: true, needsMatchAssignment: false };
}

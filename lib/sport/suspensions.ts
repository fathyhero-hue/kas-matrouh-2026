import { normalize, type RosterTeamLite } from "./roster-link";

export type SuspensionMatch = {
  id: string;
  bracket_id?: string;
  team_a: string | null;
  team_b: string | null;
  match_date?: string | null;
  match_time?: string | null;
  status?: string | null;
};

export type SuspensionCard = {
  id: string;
  bracket_id?: string | null;
  match_id?: string | null;
  roster_player_id?: string | null;
  team_roster_id?: string | null;
  player?: string | null;
  team?: string | null;
  yellow?: number | null;
  red?: number | null;
};

export type SuspensionState = {
  isSuspended: boolean;
  reason: "yellow_accumulation" | "direct_red" | null;
  yellowCountInCycle: number;
  triggerMatchId: string | null;
  suspensionMatchId: string | null;
  served: boolean;
  needsMatchAssignment: boolean;
};

const COMPLETED = new Set(["انتهت", "finished", "completed"]);

function matchSortKey(match: SuspensionMatch): string {
  return `${match.match_date || "9999-99-99"}T${match.match_time || "99:99:99"}::${match.id}`;
}

function isCompleted(match: SuspensionMatch): boolean {
  return COMPLETED.has(String(match.status || "").trim().toLowerCase());
}

function playerTeam(card: SuspensionCard, teams: RosterTeamLite[]): string {
  const byRoster = card.team_roster_id ? teams.find((team) => team.id === card.team_roster_id)?.team : undefined;
  return byRoster || card.team || "";
}

export function getSuspensionState(cards: SuspensionCard[], matches: SuspensionMatch[], teams: RosterTeamLite[] = []): SuspensionState {
  const assigned = cards.filter((card) => card.match_id && card.roster_player_id && card.team_roster_id);
  const needsMatchAssignment = cards.some((card) => !card.match_id && !!card.roster_player_id);
  const events = assigned
    .map((card) => ({ card, match: matches.find((match) => match.id === card.match_id) }))
    .filter((event): event is { card: SuspensionCard; match: SuspensionMatch } => !!event.match)
    .sort((a, b) => matchSortKey(a.match).localeCompare(matchSortKey(b.match)));
  let yellowCountInCycle = 0;
  let pending: { reason: "yellow_accumulation" | "direct_red"; triggerMatchId: string; suspensionMatchId: string; served: boolean } | null = null;
  for (const event of events) {
    if (pending && event.match.id === pending.suspensionMatchId && isCompleted(event.match)) {
      pending = null;
      yellowCountInCycle = 0;
    }
    const red = Number(event.card.red) || 0;
    const yellow = Number(event.card.yellow) || 0;
    const team = playerTeam(event.card, teams);
    if (!team || (!normalize(event.match.team_a || "").includes(normalize(team)) && !normalize(event.match.team_b || "").includes(normalize(team)))) continue;
    if (red > 0 && !pending) {
      const next = matches.filter((m) => m.id !== event.match.id && (normalize(m.team_a || "") === normalize(team) || normalize(m.team_b || "") === normalize(team))).sort((a, b) => matchSortKey(a).localeCompare(matchSortKey(b))).find((m) => matchSortKey(m) > matchSortKey(event.match));
      if (next) pending = { reason: "direct_red", triggerMatchId: event.match.id, suspensionMatchId: next.id, served: false };
    }
    yellowCountInCycle += yellow;
    if (yellowCountInCycle >= 3 && !pending) {
      const next = matches.filter((m) => m.id !== event.match.id && (normalize(m.team_a || "") === normalize(team) || normalize(m.team_b || "") === normalize(team))).sort((a, b) => matchSortKey(a).localeCompare(matchSortKey(b))).find((m) => matchSortKey(m) > matchSortKey(event.match));
      if (next) pending = { reason: "yellow_accumulation", triggerMatchId: event.match.id, suspensionMatchId: next.id, served: false };
      yellowCountInCycle = 0;
    }
  }
  if (pending) {
    const suspensionMatch = matches.find((match) => match.id === pending?.suspensionMatchId);
    if (suspensionMatch && isCompleted(suspensionMatch)) pending = null;
  }
  return pending ? { isSuspended: true, reason: pending.reason, yellowCountInCycle, triggerMatchId: pending.triggerMatchId, suspensionMatchId: pending.suspensionMatchId, served: false, needsMatchAssignment } : { isSuspended: false, reason: null, yellowCountInCycle, triggerMatchId: null, suspensionMatchId: null, served: true, needsMatchAssignment };
}

export function getPlayerEligibilityForMatch(state: SuspensionState, targetMatchId: string) {
  const isSuspended = state.isSuspended && state.suspensionMatchId === targetMatchId;
  return { eligible: !isSuspended, isSuspended, reason: isSuspended ? state.reason : null, suspensionMatchId: state.suspensionMatchId };
}

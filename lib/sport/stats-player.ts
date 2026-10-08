import { normalize, type RosterTeamLite } from "./roster-link";

export const UNKNOWN_PLAYER = "لاعب غير محدد";
export const UNKNOWN_TEAM = "فريق غير محدد";

export type StatsIdentityRow = {
  id?: string | null;
  roster_player_id?: string | null;
  team_roster_id?: string | null;
  player?: string | null;
  team?: string | null;
};

export type ResolvedStatsPlayer = {
  player: string;
  team: string;
  rosterPlayerId: string | null;
  teamRosterId: string | null;
  identityKey: string;
};

export function resolveStatsPlayer(row: StatsIdentityRow, teams: RosterTeamLite[]): ResolvedStatsPlayer {
  const roster = row.team_roster_id ? teams.find((team) => team.id === row.team_roster_id) : undefined;
  const rosterPlayer = row.roster_player_id
    ? teams.flatMap((team) => team.players).find((player) => player.id === row.roster_player_id)
    : undefined;
  const playerTeam = rosterPlayer ? teams.find((team) => team.players.some((player) => player.id === rosterPlayer.id)) : undefined;
  const player = rosterPlayer?.name?.trim() || row.player?.trim() || UNKNOWN_PLAYER;
  const team = roster?.team?.trim() || playerTeam?.team?.trim() || row.team?.trim() || UNKNOWN_TEAM;
  const rosterPlayerId = rosterPlayer?.id || row.roster_player_id || null;
  const teamRosterId = roster?.id || playerTeam?.id || row.team_roster_id || null;

  let identityKey = `unknown:${row.id || "row"}`;
  if (rosterPlayerId) identityKey = `roster:${rosterPlayerId}`;
  else if (row.player?.trim() || row.team?.trim()) identityKey = `legacy:${normalize(team)}::${normalize(player)}`;

  return { player, team, rosterPlayerId, teamRosterId, identityKey };
}

export type GoalStatsRow = StatsIdentityRow & { goals?: number | null; image_url?: string | null };
export type CardStatsRow = StatsIdentityRow & { yellow?: number | null; red?: number | null };

export function groupGoalsByPlayer(rows: GoalStatsRow[], teams: RosterTeamLite[]) {
  const grouped = new Map<string, GoalStatsRow & ResolvedStatsPlayer>();
  for (const row of rows) {
    const goals = Number(row.goals) || 0;
    if (goals <= 0) continue;
    const resolved = resolveStatsPlayer(row, teams);
    const current = grouped.get(resolved.identityKey);
    if (current) {
      current.goals = (Number(current.goals) || 0) + goals;
      if (!current.image_url && row.image_url) current.image_url = row.image_url;
    } else {
      grouped.set(resolved.identityKey, { ...row, goals, ...resolved });
    }
  }
  return [...grouped.values()].sort((a, b) => (Number(b.goals) || 0) - (Number(a.goals) || 0));
}

export function groupCardsByPlayer(rows: CardStatsRow[], teams: RosterTeamLite[]) {
  const grouped = new Map<string, CardStatsRow & ResolvedStatsPlayer>();
  for (const row of rows) {
    const resolved = resolveStatsPlayer(row, teams);
    const current = grouped.get(resolved.identityKey);
    if (current) {
      current.yellow = (Number(current.yellow) || 0) + (Number(row.yellow) || 0);
      current.red = (Number(current.red) || 0) + (Number(row.red) || 0);
    } else {
      grouped.set(resolved.identityKey, { ...row, ...resolved });
    }
  }
  return [...grouped.values()].sort((a, b) => (Number(b.red) || 0) - (Number(a.red) || 0) || (Number(b.yellow) || 0) - (Number(a.yellow) || 0));
}

export function addEventOnlyCardRows(rows: CardStatsRow[], events: { id: string; roster_player_id: string; team_roster_id: string; card_type: "yellow" | "direct_red" }[], teams: RosterTeamLite[]) {
  const known = new Set(rows.map((row) => resolveStatsPlayer(row, teams).rosterPlayerId).filter(Boolean));
  const synthetic = new Map<string, CardStatsRow>();
  for (const event of events) {
    if (known.has(event.roster_player_id)) continue;
    const current = synthetic.get(event.roster_player_id) || { id: `event:${event.roster_player_id}`, roster_player_id: event.roster_player_id, team_roster_id: event.team_roster_id, yellow: 0, red: 0 };
    if (event.card_type === "yellow") current.yellow = (Number(current.yellow) || 0) + 1;
    else current.red = (Number(current.red) || 0) + 1;
    synthetic.set(event.roster_player_id, current);
  }
  return [...rows, ...synthetic.values()];
}

export function getCardTotalsWithEvents(legacy: { yellow?: number | null; red?: number | null }, events: { card_type: "yellow" | "direct_red"; source_card_id?: string | null; is_historical_distribution?: boolean }[]) {
  const newEvents = events.filter((event) => !(event.is_historical_distribution ?? Boolean(event.source_card_id)));
  return {
    yellow: (Number(legacy.yellow) || 0) + newEvents.filter((event) => event.card_type === "yellow").length,
    red: (Number(legacy.red) || 0) + newEvents.filter((event) => event.card_type === "direct_red").length,
  };
}

export type ValidationRoster = { id: string; bracket_id: string; team_name: string | null };
export type ValidationPlayer = { id: string; roster_id: string; name: string | null };
export type ValidationMatch = { team_a: string | null; team_b: string | null };

export function validateStatsPlayerSelection({
  bracketId,
  roster,
  player,
}: {
  bracketId: string;
  roster: ValidationRoster | null;
  player: ValidationPlayer | null;
  matches?: ValidationMatch[];
}) {
  if (!roster || roster.bracket_id !== bracketId || !roster.team_name?.trim()) {
    return { ok: false as const, error: "الفريق غير مشارك في هذه البطولة." };
  }
  if (!player || !player.name?.trim()) return { ok: false as const, error: "اللاعب غير موجود." };
  if (player.roster_id !== roster.id) return { ok: false as const, error: "اللاعب لا ينتمي إلى قائمة الفريق." };
  return { ok: true as const, playerName: player.name.trim(), teamName: roster.team_name.trim() };
}

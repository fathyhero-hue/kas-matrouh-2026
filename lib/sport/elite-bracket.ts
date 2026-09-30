import type { SupabaseClient } from "@supabase/supabase-js";
import { buildStandings, type MatchRow, type StandingsRow } from "./standings";
import { getBracketTeamLogos, normalize } from "./roster-link";

export const ELITE_CUP_TEAM_COUNT = 9;
export const ELITE_CUP_MATCHES_PER_TEAM = 4;
export const ELITE_CUP_GROUP_MATCHES = 18;

export type BracketMatch = {
  team_a: string | null;
  team_b: string | null;
  home_goals: number | null;
  away_goals: number | null;
  home_penalty_goals?: number | null;
  away_penalty_goals?: number | null;
  status: string | null;
  match_label?: string | null;
  qualified_team?: string | null;
};

export type SlotResult = {
  teamA: string;
  teamB: string;
  played: boolean;
  homeGoals?: number;
  awayGoals?: number;
  winner?: string;
};

const normalizeTeamName = (name: string) => normalize(name);

export function resolveSlot(matches: BracketMatch[], teamA: string, teamB: string): SlotResult {
  const match = matches.find((m) => {
    const a = normalizeTeamName(m.team_a || "");
    const b = normalizeTeamName(m.team_b || "");
    return (a === normalizeTeamName(teamA) && b === normalizeTeamName(teamB)) || (a === normalizeTeamName(teamB) && b === normalizeTeamName(teamA));
  });

  if (!match || match.status !== "\u0627\u0646\u062a\u0647\u062a") return { teamA, teamB, played: false };

  const hg = Number(match.home_goals || 0);
  const ag = Number(match.away_goals || 0);
  let winner: string | undefined;
  if (hg > ag) winner = match.team_a || undefined;
  else if (ag > hg) winner = match.team_b || undefined;
  else {
    const hp = Number(match.home_penalty_goals || 0);
    const ap = Number(match.away_penalty_goals || 0);
    if (hp > ap) winner = match.team_a || undefined;
    else if (ap > hp) winner = match.team_b || undefined;
  }
  if (!winner && match.qualified_team) winner = match.qualified_team;

  return { teamA: match.team_a || teamA, teamB: match.team_b || teamB, played: true, homeGoals: hg, awayGoals: ag, winner };
}

export async function getEliteCupTeamRecords(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("elite_teams")
    .select("id, legacy_id, name, logo_url")
    .order("name", { ascending: true });

  if (error) throw error;
  return (data || []) as Array<{ id: string; legacy_id: string | null; name: string; logo_url: string | null }>;
}

export async function getEliteCupTeams(supabase: SupabaseClient, _bracketId: string): Promise<string[]> {
  void _bracketId;
  const records = await getEliteCupTeamRecords(supabase);
  return records.map((team) => team.name).filter(Boolean);
}

export function getEliteQualificationZone(rank: number): "qualify" | "playoff" | "danger" {
  if (rank <= 2) return "qualify";
  if (rank <= 6) return "playoff";
  return "danger";
}

export function isEliteGroupStageComplete(matches: MatchRow[], teamNames: string[]): boolean {
  if (teamNames.length !== ELITE_CUP_TEAM_COUNT) return false;
  const finished = matches.filter((m) => m.stage === "group" && m.status === "\u0627\u0646\u062a\u0647\u062a" && m.team_a && m.team_b);
  if (finished.length !== ELITE_CUP_GROUP_MATCHES) return false;
  const appearances = new Map<string, number>();
  for (const match of finished) {
    appearances.set(normalize(match.team_a!), (appearances.get(normalize(match.team_a!)) || 0) + 1);
    appearances.set(normalize(match.team_b!), (appearances.get(normalize(match.team_b!)) || 0) + 1);
  }
  return teamNames.every((team) => (appearances.get(normalize(team)) || 0) === ELITE_CUP_MATCHES_PER_TEAM);
}

export async function getEliteStandings(supabase: SupabaseClient, bracketId: string) {
  const [{ data: matches }, logos, teams] = await Promise.all([
    supabase.from("matches").select("*").eq("bracket_id", bracketId),
    getBracketTeamLogos(supabase, bracketId),
    getEliteCupTeams(supabase, bracketId),
  ]);
  const allMatches = (matches || []) as (MatchRow & BracketMatch)[];
  return { teams, allMatches, logos, standings: buildStandings(allMatches, logos, teams) };
}

export type EliteBracket = {
  seeds: Array<string | undefined>;
  playoff1: SlotResult;
  playoff2: SlotResult;
  semi1: SlotResult;
  semi2: SlotResult;
  final: SlotResult;
};

const placeholderSeed = (rank: number) => "\u0627\u0644\u0645\u0631\u0643\u0632 " + rank;
const placeholderWinner = (label: string) => "\u0627\u0644\u0641\u0627\u0626\u0632 \u0645\u0646 " + label;

function findLabeledMatch(matches: BracketMatch[], label: string) {
  return matches.find((match) => String(match.match_label || "").trim().toUpperCase() === label);
}

function resolveProgressionSlot(matches: BracketMatch[], label: string, teamA: string, teamB: string): SlotResult {
  const labeled = findLabeledMatch(matches, label);
  return labeled ? resolveSlot([labeled], teamA, teamB) : resolveSlot(matches, teamA, teamB);
}

export function computeEliteBracket(standings: StandingsRow[], matches: BracketMatch[]): EliteBracket {
  const seeds = Array.from({ length: 6 }, (_, index) => standings[index]?.team);
  const seed = (rank: number) => seeds[rank - 1] || placeholderSeed(rank);
  const playoff1 = resolveProgressionSlot(matches, "P1", seed(3), seed(6));
  const playoff2 = resolveProgressionSlot(matches, "P2", seed(4), seed(5));
  const semi1 = resolveProgressionSlot(matches, "SF1", seed(1), playoff1.winner || placeholderWinner("P1"));
  const semi2 = resolveProgressionSlot(matches, "SF2", seed(2), playoff2.winner || placeholderWinner("P2"));
  const final = resolveProgressionSlot(matches, "FINAL", semi1.winner || placeholderWinner("SF1"), semi2.winner || placeholderWinner("SF2"));
  return { seeds, playoff1, playoff2, semi1, semi2, final };
}

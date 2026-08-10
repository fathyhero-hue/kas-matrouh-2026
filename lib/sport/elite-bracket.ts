import type { StandingsRow } from "./standings";

export type BracketMatch = {
  team_a: string | null;
  team_b: string | null;
  home_goals: number | null;
  away_goals: number | null;
  home_penalty_goals?: number | null;
  away_penalty_goals?: number | null;
  status: string | null;
};

export type SlotResult = {
  teamA: string;
  teamB: string;
  played: boolean;
  homeGoals?: number;
  awayGoals?: number;
  winner?: string;
};

function normalizeTeamName(name: string): string {
  return String(name || "").trim().toLowerCase();
}

// Finds a finished match between two named teams (in any round/order) and
// resolves the winner — by goals, falling back to a penalty shootout if tied.
export function resolveSlot(matches: BracketMatch[], teamA: string, teamB: string): SlotResult {
  const match = matches.find((m) => {
    const a = normalizeTeamName(m.team_a || "");
    const b = normalizeTeamName(m.team_b || "");
    return (a === normalizeTeamName(teamA) && b === normalizeTeamName(teamB)) || (a === normalizeTeamName(teamB) && b === normalizeTeamName(teamA));
  });

  if (!match || match.status !== "انتهت") return { teamA, teamB, played: false };

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

  return { teamA: match.team_a || teamA, teamB: match.team_b || teamB, played: true, homeGoals: hg, awayGoals: ag, winner };
}

export type EliteBracket = {
  groupA: { first?: string; second?: string; third?: string };
  groupB: { first?: string; second?: string; third?: string };
  playoff1: SlotResult | null; // 3rd Group A vs 2nd Group B
  playoff2: SlotResult | null; // 2nd Group A vs 3rd Group B
  semi1: SlotResult | null; // 1st Group A vs winner(playoff1)
  semi2: SlotResult | null; // 1st Group B vs winner(playoff2)
  final: SlotResult | null;
};

const TBD = "لم يتحدد بعد";

export function computeEliteBracket(groupAStandings: StandingsRow[], groupBStandings: StandingsRow[], matches: BracketMatch[]): EliteBracket {
  const a1 = groupAStandings[0]?.team;
  const a2 = groupAStandings[1]?.team;
  const a3 = groupAStandings[2]?.team;
  const b1 = groupBStandings[0]?.team;
  const b2 = groupBStandings[1]?.team;
  const b3 = groupBStandings[2]?.team;

  const playoff1 = a3 && b2 ? resolveSlot(matches, a3, b2) : null;
  const playoff2 = a2 && b3 ? resolveSlot(matches, a2, b3) : null;

  const playoff1Winner = playoff1?.winner || TBD;
  const playoff2Winner = playoff2?.winner || TBD;

  const semi1 = a1 ? resolveSlot(matches, a1, playoff1Winner) : null;
  const semi2 = b1 ? resolveSlot(matches, b1, playoff2Winner) : null;

  const semi1Winner = semi1?.winner || TBD;
  const semi2Winner = semi2?.winner || TBD;

  const final = semi1Winner !== TBD && semi2Winner !== TBD ? resolveSlot(matches, semi1Winner, semi2Winner) : null;

  return {
    groupA: { first: a1, second: a2, third: a3 },
    groupB: { first: b1, second: b2, third: b3 },
    playoff1,
    playoff2,
    semi1,
    semi2,
    final,
  };
}

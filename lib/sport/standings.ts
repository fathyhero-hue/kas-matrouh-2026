export type MatchRow = {
  team_a: string | null;
  team_b: string | null;
  home_goals: number | null;
  away_goals: number | null;
  status: string | null;
  stage: string | null;
};

export type StandingsRow = {
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
};

// Group-stage, finished matches only — mirrors the points/tiebreak rules the
// admin panel has always used (3/1/0, then goal difference, then goals for).
export function buildStandings(matches: MatchRow[]): StandingsRow[] {
  const teams = new Map<string, Omit<StandingsRow, "team" | "points">>();
  const ensure = (name: string) => {
    if (!teams.has(name)) teams.set(name, { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 });
    return teams.get(name)!;
  };

  for (const m of matches) {
    if (m.stage !== "group" || m.status !== "انتهت" || !m.team_a || !m.team_b) continue;
    const a = ensure(m.team_a);
    const b = ensure(m.team_b);
    const hg = m.home_goals ?? 0;
    const ag = m.away_goals ?? 0;

    a.played++;
    b.played++;
    a.goalsFor += hg;
    a.goalsAgainst += ag;
    b.goalsFor += ag;
    b.goalsAgainst += hg;

    if (hg > ag) {
      a.won++;
      b.lost++;
    } else if (hg < ag) {
      b.won++;
      a.lost++;
    } else {
      a.drawn++;
      b.drawn++;
    }
  }

  return [...teams.entries()]
    .map(([team, s]) => ({ team, ...s, points: s.won * 3 + s.drawn }))
    .sort((x, y) => y.points - x.points || (y.goalsFor - y.goalsAgainst) - (x.goalsFor - x.goalsAgainst) || y.goalsFor - x.goalsFor);
}

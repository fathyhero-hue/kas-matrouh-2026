import type { SupabaseClient } from "@supabase/supabase-js";

export type RosterPlayerLite = { name: string; photoUrl: string | null };
export type RosterTeamLite = { team: string; logoUrl: string | null; players: RosterPlayerLite[] };

// Same normalization strategy used elsewhere for team-name matching
// (elite-bracket.ts, roster/submit route) — trim + collapse spaces + lowercase.
// Exported so callers building/looking up the same maps (e.g. buildStandings)
// stay consistent with each other.
export function normalize(value: string): string {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

// The single source of truth for "who's really registered" in a bracket —
// real team logos and real player photos, as uploaded at roster submission.
export async function getBracketRosterTeams(supabase: SupabaseClient, bracketId: string): Promise<RosterTeamLite[]> {
  const { data } = await supabase
    .from("team_rosters")
    .select("team_name, logo_url, roster_players(name, personal_image_url)")
    .eq("bracket_id", bracketId);

  return (data || [])
    .filter((r: any) => r.team_name)
    .map((r: any) => ({
      team: r.team_name as string,
      logoUrl: (r.logo_url as string) || null,
      players: ((r.roster_players || []) as any[])
        .filter((p) => p.name)
        .map((p) => ({ name: p.name as string, photoUrl: (p.personal_image_url as string) || null })),
    }));
}

export function buildTeamLogoMap(teams: RosterTeamLite[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const t of teams) if (t.logoUrl) map.set(normalize(t.team), t.logoUrl);
  return map;
}

export function lookupTeamLogo(logos: Map<string, string>, team?: string | null): string | null {
  if (!team) return null;
  return logos.get(normalize(team)) || null;
}

// Convenience wrapper for pages that only need the team->logo map.
export async function getBracketTeamLogos(supabase: SupabaseClient, bracketId: string): Promise<Map<string, string>> {
  return buildTeamLogoMap(await getBracketRosterTeams(supabase, bracketId));
}

// Returns a (team, player) -> photoUrl lookup function, built once per page load.
export function buildPlayerPhotoResolver(teams: RosterTeamLite[]) {
  const map = new Map<string, string>();
  for (const t of teams) {
    for (const p of t.players) {
      if (p.photoUrl) map.set(`${normalize(t.team)}::${normalize(p.name)}`, p.photoUrl);
    }
  }
  return (team?: string | null, player?: string | null): string | null => {
    if (!team || !player) return null;
    return map.get(`${normalize(team)}::${normalize(player)}`) || null;
  };
}

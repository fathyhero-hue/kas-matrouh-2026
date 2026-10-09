import type { SupabaseClient } from "@supabase/supabase-js";

export type RosterPlayerLite = { id: string; name: string; photoUrl: string | null };
export type RosterTeamLite = {
  id: string;
  team: string;
  logoUrl: string | null;
  coachName: string | null;
  coachPhotoUrl: string | null;
  players: RosterPlayerLite[];
};

type RosterQueryPlayer = { id: string; name: string | null; personal_image_url: string | null };
type RosterQueryRow = { id: string; team_name: string | null; logo_url: string | null; coach_name: string | null; coach_photo_url: string | null; roster_players: RosterQueryPlayer[] | null };
type CardRosterQueryRow = { id: string; team_name: string | null; roster_players: { id: string; name: string | null }[] | null };
type OfficialTeamRow = { name: string | null; logo_url: string | null };

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
  const [{ data }, { data: officialTeams }] = await Promise.all([
    supabase
      .from("team_rosters")
      .select("id, team_name, logo_url, coach_name, coach_photo_url, roster_players(id, name, personal_image_url)")
      .eq("bracket_id", bracketId),
    supabase.from("elite_teams").select("name, logo_url"),
  ]);

  const rows = (data as RosterQueryRow[] | null) || [];
  const officialLogoByName = new Map(
    ((officialTeams as OfficialTeamRow[] | null) || [])
      .filter((team) => team.name && team.logo_url)
      .map((team) => [normalize(team.name as string), team.logo_url as string]),
  );
  return rows
    .filter((r) => r.team_name)
    .map((r) => ({
      id: r.id as string,
      team: r.team_name as string,
      logoUrl: (r.logo_url as string) || officialLogoByName.get(normalize(r.team_name as string)) || null,
      coachName: (r.coach_name as string) || null,
      coachPhotoUrl: (r.coach_photo_url as string) || null,
      players: (r.roster_players || [])
        .filter((p) => p.name)
        .map((p) => ({ id: p.id as string, name: p.name as string, photoUrl: (p.personal_image_url as string) || null })),
    }));
}

export async function getBracketCardRosterTeams(supabase: SupabaseClient, bracketId: string) {
  const { data, error } = await supabase
    .from("team_rosters")
    .select("id, team_name, roster_players(id, name)")
    .eq("bracket_id", bracketId);

  const teams: RosterTeamLite[] = ((data as CardRosterQueryRow[] | null) || [])
    .filter((row) => row.team_name)
    .map((row) => ({
      id: row.id,
      team: row.team_name as string,
      logoUrl: null,
      coachName: null,
      coachPhotoUrl: null,
      players: (row.roster_players || [])
        .filter((player) => player.name)
        .map((player) => ({ id: player.id, name: player.name as string, photoUrl: null })),
    }));
  return { teams, error };
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
  const [{ data: rosters, error: rosterError }, { data: officialTeams, error: officialError }] = await Promise.all([
    supabase.from("team_rosters").select("team_name, logo_url").eq("bracket_id", bracketId),
    supabase.from("elite_teams").select("name, logo_url"),
  ]);
  if (rosterError) throw rosterError;
  if (officialError) throw officialError;

  const logos = new Map<string, string>();
  for (const team of (officialTeams as OfficialTeamRow[] | null) || []) {
    if (team.name && team.logo_url) logos.set(normalize(team.name), team.logo_url);
  }
  for (const roster of (rosters as Pick<RosterQueryRow, "team_name" | "logo_url">[] | null) || []) {
    if (roster.team_name && roster.logo_url) logos.set(normalize(roster.team_name), roster.logo_url);
  }
  return logos;
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

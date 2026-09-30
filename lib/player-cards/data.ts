import type { SupabaseClient } from "@supabase/supabase-js";
import { normalize } from "@/lib/sport/roster-link";

export const PLAYER_CARDS_PERMISSION = "tournaments.player-cards.manage" as const;

export type PlayerCardRecord = {
  id: string;
  roster_player_id: string | null;
  team_roster_id: string | null;
  bracket_id: string | null;
  player_registration_id: string | null;
  card_number: string;
  status: "draft" | "ready" | "needs_update" | "archived";
  template_key: string;
  template_version: number;
  display_overrides: Record<string, unknown>;
};

export type PlayerCardPlayer = {
  id: string;
  rosterId: string;
  name: string;
  number: string | null;
  photoUrl: string | null;
  card: PlayerCardRecord | null;
};

export type PlayerCardTeam = {
  id: string;
  bracketId: string | null;
  teamName: string;
  teamSlug: string | null;
  logoUrl: string | null;
  rosterId: string | null;
  rosterSubmitted: boolean;
  players: PlayerCardPlayer[];
};

type RosterPlayerRow = {
  id: string;
  roster_id: string;
  slot_index: number;
  name: string | null;
  number: string | null;
  personal_image_url: string | null;
};

type RosterRow = {
  id: string;
  bracket_id: string;
  team_name: string;
  team_slug: string | null;
  logo_url: string | null;
  is_submitted: boolean | null;
  roster_players: RosterPlayerRow[] | null;
};

type EliteTeamRow = { id: string; name: string; logo_url: string | null };

function cardMap(cards: PlayerCardRecord[]) {
  return new Map(cards.filter((card) => card.roster_player_id).map((card) => [card.roster_player_id, card]));
}

function toPlayers(roster: RosterRow | null, cards: PlayerCardRecord[]): PlayerCardPlayer[] {
  if (!roster) return [];
  const byPlayer = cardMap(cards);
  return (roster.roster_players || [])
    .filter((player) => Boolean(player.name?.trim()))
    .sort((a, b) => a.slot_index - b.slot_index)
    .map((player) => ({
      id: player.id,
      rosterId: roster.id,
      name: player.name!.trim(),
      number: player.number || null,
      photoUrl: player.personal_image_url || null,
      card: byPlayer.get(player.id) || null,
    }));
}

function mapTeam(official: EliteTeamRow, roster: RosterRow | null, cards: PlayerCardRecord[]): PlayerCardTeam {
  return {
    id: official.id,
    bracketId: roster?.bracket_id || null,
    teamName: official.name,
    teamSlug: roster?.team_slug || null,
    logoUrl: roster?.logo_url || official.logo_url || null,
    rosterId: roster?.id || null,
    rosterSubmitted: Boolean(roster?.is_submitted),
    players: toPlayers(roster, cards),
  };
}

export async function getElitePlayerCardContext(supabase: SupabaseClient) {
  const [{ data: bracket, error: bracketError }, { data: officialTeams, error: teamsError }] = await Promise.all([
    supabase.from("brackets").select("id").eq("legacy_suffix", "_elite").maybeSingle(),
    supabase.from("elite_teams").select("id, name, logo_url").order("name", { ascending: true }),
  ]);
  if (bracketError) throw bracketError;
  if (teamsError) throw teamsError;

  const bracketId = bracket?.id as string | undefined;
  const teams = (officialTeams || []) as EliteTeamRow[];
  if (!bracketId) return teams.map((team) => mapTeam(team, null, []));

  const { data: rosters, error: rosterError } = await supabase
    .from("team_rosters")
    .select("id, bracket_id, team_name, team_slug, logo_url, is_submitted, roster_players(id, roster_id, slot_index, name, number, personal_image_url)")
    .eq("bracket_id", bracketId);
  if (rosterError) throw rosterError;

  const rosterRows = (rosters || []) as RosterRow[];
  const rosterByName = new Map(rosterRows.map((roster) => [normalize(roster.team_name), roster]));
  const rosterIds = rosterRows.map((roster) => roster.id);
  const cards = rosterIds.length ? await getCardsForRosters(supabase, rosterIds) : [];

  return teams.map((team) => mapTeam(team, rosterByName.get(normalize(team.name)) || null, cards));
}

export async function getRosterPlayerCardContext(supabase: SupabaseClient, bracketId: string) {
  const { data: rosters, error } = await supabase
    .from("team_rosters")
    .select("id, bracket_id, team_name, team_slug, logo_url, is_submitted, roster_players(id, roster_id, slot_index, name, number, personal_image_url)")
    .eq("bracket_id", bracketId)
    .order("team_name", { ascending: true });
  if (error) throw error;
  const rosterRows = (rosters || []) as RosterRow[];
  const cards = await getCardsForRosters(supabase, rosterRows.map((roster) => roster.id));
  return rosterRows.map((roster) => ({
    id: roster.id,
    bracketId: roster.bracket_id,
    teamName: roster.team_name,
    teamSlug: roster.team_slug,
    logoUrl: roster.logo_url,
    rosterId: roster.id,
    rosterSubmitted: Boolean(roster.is_submitted),
    players: toPlayers(roster, cards),
  }));
}

export async function getCardsForRosters(supabase: SupabaseClient, rosterIds: string[]) {
  if (rosterIds.length === 0) return [];
  const { data, error } = await supabase
    .from("player_cards")
    .select("id, roster_player_id, team_roster_id, bracket_id, player_registration_id, card_number, status, template_key, template_version, display_overrides")
    .in("team_roster_id", rosterIds);
  if (error) throw error;
  return (data || []) as PlayerCardRecord[];
}

export async function getPlayerCardTeamById(supabase: SupabaseClient, teamId: string, bracketId?: string) {
  const eliteTeams = await getElitePlayerCardContext(supabase);
  const eliteTeam = eliteTeams.find((team) => team.id === teamId);
  if (eliteTeam) return eliteTeam;

  const { data: roster, error } = await supabase
    .from("team_rosters")
    .select("id, bracket_id, team_name, team_slug, logo_url, is_submitted, roster_players(id, roster_id, slot_index, name, number, personal_image_url)")
    .eq("id", teamId)
    .maybeSingle();
  if (error) throw error;
  if (!roster || (bracketId && roster.bracket_id !== bracketId)) return null;
  const row = roster as RosterRow;
  const cards = await getCardsForRosters(supabase, [row.id]);
  return {
    id: row.id,
    bracketId: row.bracket_id,
    teamName: row.team_name,
    teamSlug: row.team_slug,
    logoUrl: row.logo_url,
    rosterId: row.id,
    rosterSubmitted: Boolean(row.is_submitted),
    players: toPlayers(row, cards),
  } satisfies PlayerCardTeam;
}

export function getCardCounts(team: PlayerCardTeam) {
  const players = team.players.length;
  const ready = team.players.filter((player) => player.card?.status === "ready").length;
  return { players, ready, missing: Math.max(0, players - ready) };
}

export function createCardNumber() {
  const token = crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase();
  return `MTR-${new Date().getFullYear()}-${token}`;
}

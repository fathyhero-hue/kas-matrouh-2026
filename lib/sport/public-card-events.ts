import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";

export async function getPublicCardEvents(bracketId: string) {
  const db = createServiceRoleClient();
  const { data, error } = await db
    .from("card_events")
    .select("id, bracket_id, match_id, roster_player_id, team_roster_id, card_type, created_at, source_card_id")
    .eq("bracket_id", bracketId)
    .order("created_at");

  if (error || !data?.length) return { data: [], error };

  const playerIds = [...new Set(data.map((event) => event.roster_player_id))];
  const teamIds = [...new Set(data.map((event) => event.team_roster_id))];
  const [{ data: players, error: playersError }, { data: teams, error: teamsError }] = await Promise.all([
    db.from("roster_players").select("id, roster_id, name").in("id", playerIds),
    db.from("team_rosters").select("id, team_name").eq("bracket_id", bracketId).in("id", teamIds),
  ]);

  if (playersError || teamsError) return { data: [], error: playersError || teamsError };

  const playerById = new Map((players || []).map((player) => [player.id, player]));
  const teamById = new Map((teams || []).map((team) => [team.id, team]));
  return {
    data: data.map(({ source_card_id, ...event }) => {
      const player = playerById.get(event.roster_player_id);
      const team = teamById.get(event.team_roster_id);
      const validPlayer = player?.roster_id === event.team_roster_id ? player : null;
      return {
        ...event,
        player_name: validPlayer?.name || "لاعب غير معروف — يحتاج مراجعة",
        team_name: team?.team_name || "فريق غير معروف — يحتاج مراجعة",
        is_historical_distribution: source_card_id !== null,
      };
    }),
    error,
  };
}

import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";

export async function getPublicCardEvents(bracketId: string) {
  const { data, error } = await createServiceRoleClient()
    .from("card_events")
    .select("id, bracket_id, match_id, roster_player_id, team_roster_id, card_type, created_at, source_card_id")
    .eq("bracket_id", bracketId)
    .order("created_at");

  return {
    data: (data || []).map(({ source_card_id, ...event }) => ({
      ...event,
      is_historical_distribution: source_card_id !== null,
    })),
    error,
  };
}

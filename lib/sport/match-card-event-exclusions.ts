import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";

export async function filterExcludedMatchCardEvents<T extends { id: string }>(events: T[]) {
  if (!events.length) return events;
  const db = createServiceRoleClient();
  const { data, error } = await db
    .from("match_card_event_exclusions")
    .select("event_id")
    .in("event_id", events.map((event) => event.id));
  if (error) throw error;
  const excluded = new Set((data || []).map((row) => row.event_id));
  return events.filter((event) => !excluded.has(event.id));
}

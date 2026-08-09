import type { SupabaseClient } from "@supabase/supabase-js";

function slugify(name: string) {
  return name.trim().replace(/\s+/g, "_").replace(/[^\p{L}\p{N}_-]/gu, "").slice(0, 80) || "team";
}

// Called whenever an elite_cup registration becomes active (paid, or manually
// granted by an admin) so the team shows up immediately in the roster admin
// screen instead of only appearing once someone submits players.
export async function ensureEliteTeamRoster(supabase: SupabaseClient, params: { teamName: string; managerName?: string | null; phone?: string | null }) {
  const teamName = String(params.teamName || "").trim();
  if (!teamName) return;

  const { data: bracket } = await supabase.from("brackets").select("id").eq("legacy_suffix", "_elite").maybeSingle();
  if (!bracket) return;

  const teamSlug = slugify(teamName);
  const { data: existing } = await supabase.from("team_rosters").select("id").eq("bracket_id", bracket.id).eq("team_slug", teamSlug).maybeSingle();
  if (existing) return;

  await supabase.from("team_rosters").insert({
    bracket_id: bracket.id,
    team_name: teamName,
    team_slug: teamSlug,
    manager_name: params.managerName || null,
    manager_phone: params.phone || null,
    is_submitted: false,
  });
}

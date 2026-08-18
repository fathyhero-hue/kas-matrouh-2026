import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { normalize } from "@/lib/sport/roster-link";

export const runtime = "nodejs";

// Looks up a team's own already-submitted roster (if any) so the submit form
// can resume/edit it instead of starting blank and risking overwriting what
// was already sent in — called right after unlocking with the access code.
export async function GET(req: NextRequest) {
  try {
    const suffix = req.nextUrl.searchParams.get("suffix") || "";
    const teamName = req.nextUrl.searchParams.get("teamName") || "";
    if (!teamName.trim()) return NextResponse.json({ found: false });

    const supabase = createServiceRoleClient();
    const { data: bracket } = await supabase.from("brackets").select("id").eq("legacy_suffix", suffix).maybeSingle();
    if (!bracket) return NextResponse.json({ found: false });

    const { data: rosters } = await supabase
      .from("team_rosters")
      .select("id, team_name, manager_name, manager_phone, logo_url, coach_name, coach_photo_url, roster_players(slot_index, name, number, personal_image_url, id_image_url)")
      .eq("bracket_id", bracket.id);

    const roster = (rosters || []).find((r: any) => normalize(r.team_name) === normalize(teamName));
    if (!roster) return NextResponse.json({ found: false });

    const players = ((roster as any).roster_players || []).sort((a: any, b: any) => a.slot_index - b.slot_index);

    return NextResponse.json({
      found: true,
      rosterId: roster.id,
      teamName: roster.team_name,
      managerName: roster.manager_name || "",
      managerPhone: roster.manager_phone || "",
      logoUrl: roster.logo_url || "",
      coachName: roster.coach_name || "",
      coachPhotoUrl: roster.coach_photo_url || "",
      players,
    });
  } catch (error: any) {
    console.error("My-roster fetch error:", error);
    return NextResponse.json({ found: false });
  }
}

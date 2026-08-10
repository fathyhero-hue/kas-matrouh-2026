import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getBracketRosterTeams } from "@/lib/sport/roster-link";

export const runtime = "nodejs";

// Returns the real registered teams/players/coach for a bracket, called by
// the player-card form after a team unlocks with their roster access code —
// the same team/player names and photos are already public on the
// /[tournament]/rosters pages, so this carries no new data exposure.
export async function GET(req: NextRequest) {
  try {
    const suffix = req.nextUrl.searchParams.get("suffix") || "";
    const supabase = createServiceRoleClient();
    const { data: bracket } = await supabase.from("brackets").select("id").eq("legacy_suffix", suffix).maybeSingle();
    if (!bracket) return NextResponse.json({ error: "بطولة غير معروفة." }, { status: 400 });

    const teams = await getBracketRosterTeams(supabase, bracket.id as string);
    return NextResponse.json({ ok: true, teams });
  } catch (error: any) {
    console.error("Roster team-players fetch error:", error);
    return NextResponse.json({ error: error?.message || "تعذر جلب بيانات الفريق." }, { status: 500 });
  }
}

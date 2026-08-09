import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, players, ...patch } = body;
    const supabase = createServiceRoleClient();

    let rosterId = id as string | undefined;
    let roster;
    if (rosterId) {
      const { data, error } = await supabase.from("team_rosters").update(patch).eq("id", rosterId).select().single();
      if (error) throw error;
      roster = data;
    } else {
      const { data, error } = await supabase.from("team_rosters").insert(patch).select().single();
      if (error) throw error;
      roster = data;
      rosterId = data.id;
    }

    if (Array.isArray(players)) {
      await supabase.from("roster_players").delete().eq("roster_id", rosterId);
      if (players.length) {
        await supabase.from("roster_players").insert(
          players.map((p: any, i: number) => ({
            roster_id: rosterId,
            slot_index: i,
            name: p.name || "",
            number: p.number || "",
            personal_image_url: p.personal_image_url || "",
            id_image_url: p.id_image_url || "",
          }))
        );
      }
    }

    return NextResponse.json({ ok: true, roster });
  } catch (error: any) {
    console.error("Admin roster save error:", error);
    return NextResponse.json({ error: error?.message || "فشل حفظ القائمة." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "معرّف الفريق مفقود." }, { status: 400 });
    const supabase = createServiceRoleClient();
    await supabase.from("roster_players").delete().eq("roster_id", id);
    const { error } = await supabase.from("team_rosters").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Admin roster delete error:", error);
    return NextResponse.json({ error: error?.message || "فشل حذف الفريق." }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { id, players, ...patch } = await req.json();
    const supabase = createServiceRoleClient();

    let formationId = id as string | undefined;
    let formation;
    if (formationId) {
      const { data, error } = await supabase.from("formations").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", formationId).select().single();
      if (error) throw error;
      formation = data;
    } else {
      const { data, error } = await supabase.from("formations").insert({ ...patch, updated_at: new Date().toISOString() }).select().single();
      if (error) throw error;
      formation = data;
      formationId = data.id;
    }

    if (Array.isArray(players)) {
      await supabase.from("formation_players").delete().eq("formation_id", formationId);
      if (players.length) {
        await supabase.from("formation_players").insert(
          players.map((p: any, i: number) => ({ formation_id: formationId, slot_index: i, name: p.name || "", team: p.team || "", image_url: p.image_url || "", rating: p.rating || null }))
        );
      }
    }

    return NextResponse.json({ ok: true, formation });
  } catch (error: any) {
    console.error("Admin formation save error:", error);
    return NextResponse.json({ error: error?.message || "فشل حفظ التشكيلة." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "معرّف مفقود." }, { status: 400 });
    const supabase = createServiceRoleClient();
    await supabase.from("formation_players").delete().eq("formation_id", id);
    const { error } = await supabase.from("formations").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Admin formation delete error:", error);
    return NextResponse.json({ error: error?.message || "فشل الحذف." }, { status: 500 });
  }
}

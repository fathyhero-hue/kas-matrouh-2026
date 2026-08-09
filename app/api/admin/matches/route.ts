import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...patch } = body;
    const supabase = createServiceRoleClient();

    if (id) {
      const { data, error } = await supabase.from("matches").update(patch).eq("id", id).select().single();
      if (error) throw error;
      return NextResponse.json({ ok: true, match: data });
    }

    if (!patch.team_a?.trim() || !patch.team_b?.trim()) {
      return NextResponse.json({ error: "يجب إدخال أسماء الفرق." }, { status: 400 });
    }
    const { data, error } = await supabase.from("matches").insert(patch).select().single();
    if (error) throw error;
    return NextResponse.json({ ok: true, match: data });
  } catch (error: any) {
    console.error("Admin match save error:", error);
    return NextResponse.json({ error: error?.message || "فشل حفظ المباراة." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "معرّف المباراة مفقود." }, { status: 400 });
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from("matches").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Admin match delete error:", error);
    return NextResponse.json({ error: error?.message || "فشل حذف المباراة." }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { id, ...patch } = await req.json();
    const supabase = createServiceRoleClient();
    const query = id
      ? await supabase.from("media").update(patch).eq("id", id).select().single()
      : await supabase.from("media").insert(patch).select().single();
    if (query.error) throw query.error;
    return NextResponse.json({ ok: true, row: query.data });
  } catch (error: any) {
    console.error("Admin media save error:", error);
    return NextResponse.json({ error: error?.message || "فشل الحفظ." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "معرّف مفقود." }, { status: 400 });
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from("media").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Admin media delete error:", error);
    return NextResponse.json({ error: error?.message || "فشل الحذف." }, { status: 500 });
  }
}

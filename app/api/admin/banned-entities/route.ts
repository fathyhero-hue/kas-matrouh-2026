import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { name, type } = await req.json();
    if (!name?.trim() || !["player", "team"].includes(type)) {
      return NextResponse.json({ error: "بيانات غير صحيحة." }, { status: 400 });
    }
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.from("banned_entities").insert({ name: name.trim(), type }).select().single();
    if (error) throw error;
    return NextResponse.json({ ok: true, row: data });
  } catch (error: any) {
    console.error("Admin banned entity save error:", error);
    return NextResponse.json({ error: error?.message || "فشل الحفظ." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "معرّف مفقود." }, { status: 400 });
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from("banned_entities").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Admin banned entity delete error:", error);
    return NextResponse.json({ error: error?.message || "فشل الحذف." }, { status: 500 });
  }
}

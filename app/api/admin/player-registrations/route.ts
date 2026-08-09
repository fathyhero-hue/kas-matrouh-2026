import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "معرّف التسجيل مفقود." }, { status: 400 });
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from("player_registrations").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Admin player registration delete error:", error);
    return NextResponse.json({ error: error?.message || "فشل الحذف." }, { status: 500 });
  }
}

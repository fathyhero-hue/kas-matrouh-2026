import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from("app_settings").upsert({ key: "ticker", value: { text: text || "" }, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Admin ticker save error:", error);
    return NextResponse.json({ error: error?.message || "فشل الحفظ." }, { status: 500 });
  }
}

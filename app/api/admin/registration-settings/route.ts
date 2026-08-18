import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { tournament, deadline, password, price } = await req.json();
    if (!tournament) return NextResponse.json({ error: "بطولة غير معروفة." }, { status: 400 });
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("registration_settings")
      .upsert({ tournament, deadline, password, price }, { onConflict: "tournament" })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, settings: data });
  } catch (error: any) {
    console.error("Admin registration settings save error:", error);
    return NextResponse.json({ error: error?.message || "فشل حفظ الإعدادات." }, { status: 500 });
  }
}

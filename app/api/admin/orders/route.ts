import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest) {
  try {
    const { id, ...patch } = await req.json();
    if (!id) return NextResponse.json({ error: "معرّف الطلب مفقود." }, { status: 400 });
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.from("orders").update(patch).eq("id", id).select().single();
    if (error) throw error;
    return NextResponse.json({ ok: true, order: data });
  } catch (error: any) {
    console.error("Admin order update error:", error);
    return NextResponse.json({ error: error?.message || "فشل تحديث الطلب." }, { status: 500 });
  }
}

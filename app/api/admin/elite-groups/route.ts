import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { ELITE_CUP_ELIGIBLE_TEAMS } from "@/lib/sport/elite-registration";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { groupA, groupB } = await req.json();
    const a = Array.isArray(groupA) ? groupA.filter((t: string) => ELITE_CUP_ELIGIBLE_TEAMS.includes(t)) : [];
    const b = Array.isArray(groupB) ? groupB.filter((t: string) => ELITE_CUP_ELIGIBLE_TEAMS.includes(t)) : [];

    const supabase = createServiceRoleClient();
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "elite_cup_groups", value: { groupA: a, groupB: b }, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Elite groups save error:", error);
    return NextResponse.json({ error: error?.message || "فشل حفظ المجموعات." }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const REGISTRATION_KEY: Record<string, string> = {
  matrouh_cup: "matrouh",
  elite_cup: "elite",
};

export async function POST(req: NextRequest) {
  try {
    const { tournament, code } = await req.json();
    const registrationKey = REGISTRATION_KEY[String(tournament || "")];
    const trimmedCode = String(code || "").trim();

    if (!registrationKey) {
      return NextResponse.json({ error: "التسجيل غير متاح لهذه البطولة حالياً." }, { status: 400 });
    }
    if (!trimmedCode) {
      return NextResponse.json({ error: "الرجاء إدخال الرقم السري." }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    const { data: settings } = await supabase
      .from("registration_settings")
      .select("deadline, password")
      .eq("tournament", registrationKey)
      .maybeSingle();

    if (!settings) {
      return NextResponse.json({ error: "التسجيل غير متاح لهذه البطولة حالياً." }, { status: 400 });
    }
    if (settings.deadline && Date.now() > new Date(settings.deadline).getTime()) {
      return NextResponse.json({ error: "عذراً، لقد انتهى موعد التسجيل في البطولة." }, { status: 400 });
    }

    if (settings.password && trimmedCode === settings.password) {
      return NextResponse.json({ ok: true, managerName: "" });
    }

    const { data: candidates } = await supabase.rpc("find_orders_by_access_code", { p_code: trimmedCode });
    const paidOrder = (candidates || []).find((o: any) => {
      const sameTournament = String(o.tournament || "") === tournament;
      const hasAccess = o.payment_status === "paid" || o.payment_status === "manual_access" || o.roster_access_active === true || o.admin_manual_access === true;
      return sameTournament && hasAccess;
    });

    if (!paidOrder) {
      return NextResponse.json({ error: "الرقم السري غير صحيح أو غير مفعل لهذه البطولة." }, { status: 400 });
    }

    return NextResponse.json({ ok: true, managerName: paidOrder.team_name || "" });
  } catch (error: any) {
    console.error("Roster unlock error:", error);
    return NextResponse.json({ error: "تعذر التحقق من الرقم السري حالياً. حاول مرة أخرى." }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { hasRegistrationAccess } from "@/lib/sport/registration-payment";
import { getRegistrationKeyForTournament, getTournamentStorageValue, isRegistrationOpen } from "@/lib/sport/registration-settings";

export const runtime = "nodejs";

type AccessCodeOrder = {
  tournament?: string | null;
  team_name?: string | null;
  payment_status?: string | null;
  payment_method?: string | null;
  paid_at?: string | null;
  manual_access?: boolean | null;
  admin_manual_access?: boolean | null;
  roster_access_active?: boolean | null;
};

export async function POST(req: NextRequest) {
  try {
    const { tournament, code } = await req.json();
    const tournamentValue = String(tournament || "");
    const registrationKey = getRegistrationKeyForTournament(tournamentValue);
    const tournamentStorageValue = getTournamentStorageValue(tournamentValue);
    const trimmedCode = String(code || "").trim();

    if (!registrationKey || !tournamentStorageValue) {
      return NextResponse.json({ error: "التسجيل غير متاح لهذه البطولة حالياً." }, { status: 400 });
    }
    if (!trimmedCode) {
      return NextResponse.json({ error: "الرجاء إدخال الرقم السري." }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    const { data: settings, error: settingsError } = await supabase
      .from("registration_settings")
      .select("deadline, password")
      .eq("tournament", registrationKey)
      .maybeSingle();

    if (settingsError) throw settingsError;

    if (!settings) {
      return NextResponse.json({ error: "التسجيل غير متاح لهذه البطولة حالياً." }, { status: 400 });
    }
    if (!isRegistrationOpen(settings.deadline)) {
      return NextResponse.json({ error: "انتهت فترة تقديم وتعديل القوائم" }, { status: 400 });
    }

    if (settings.password && trimmedCode === settings.password) {
      return NextResponse.json({ ok: true, teamName: "", deadline: settings.deadline || null });
    }

    const { data: candidates, error: candidatesError } = await supabase.rpc("find_orders_by_access_code", { p_code: trimmedCode });
    if (candidatesError) throw candidatesError;
    const paidOrder = ((candidates || []) as AccessCodeOrder[]).find((o) => {
      const sameTournament = String(o.tournament || "") === tournamentStorageValue;
      return sameTournament && hasRegistrationAccess(o);
    });

    if (!paidOrder) {
      return NextResponse.json({ error: "الرقم السري غير صحيح" }, { status: 400 });
    }

    return NextResponse.json({ ok: true, teamName: paidOrder.team_name || "", deadline: settings.deadline || null });
  } catch (error: unknown) {
    console.error("Roster unlock error:", error);
    return NextResponse.json({ error: "تعذر التحقق من الرقم السري حالياً. حاول مرة أخرى." }, { status: 500 });
  }
}

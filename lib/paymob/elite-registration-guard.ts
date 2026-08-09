import type { SupabaseClient } from "@supabase/supabase-js";
import { ELITE_CUP_ELIGIBLE_TEAMS, ELITE_CUP_MAX_TEAMS } from "@/lib/sport/elite-registration";

function normalizeTeamName(name: string): string {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/أ|إ|آ/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .toLowerCase();
}

// Server-side gate for elite_cup registration payments: only the fixed list of
// eligible teams may pay, one paid slot per team, capped at ELITE_CUP_MAX_TEAMS total.
export async function guardEliteRegistration(supabase: SupabaseClient, teamNameRaw: string) {
  const teamName = String(teamNameRaw || "").trim();
  if (!teamName) return { ok: false as const, error: "اختر اسم الفريق." };

  const match = ELITE_CUP_ELIGIBLE_TEAMS.find((t) => normalizeTeamName(t) === normalizeTeamName(teamName));
  if (!match) return { ok: false as const, error: "هذا الفريق غير مدرج ضمن الفرق المسموح لها بالاشتراك في كأس النخبة." };

  const { data: paidOrders } = await supabase
    .from("orders")
    .select("team_name")
    .eq("tournament", "elite_cup")
    .eq("type", "tournament_registration")
    .eq("payment_status", "paid");

  const paidTeams = new Set((paidOrders || []).map((o: any) => normalizeTeamName(o.team_name || "")));

  if (paidTeams.has(normalizeTeamName(match))) {
    return { ok: false as const, error: `فريق "${match}" سجّل ودفع الاشتراك بالفعل.` };
  }
  if (paidTeams.size >= ELITE_CUP_MAX_TEAMS) {
    return { ok: false as const, error: "اكتمل عدد الفرق المشتركة في كأس النخبة (10 فرق)." };
  }

  const { data: settings } = await supabase.from("registration_settings").select("price, deadline").eq("tournament", "elite").maybeSingle();
  if (settings?.deadline && Date.now() > new Date(settings.deadline).getTime()) {
    return { ok: false as const, error: "انتهى موعد التسجيل في كأس النخبة." };
  }

  return { ok: true as const, teamName: match, price: Number(settings?.price || 1500) };
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { ELITE_CUP_MAX_TEAMS } from "@/lib/sport/elite-registration";
import { isRegistrationOpen } from "@/lib/sport/registration-settings";

function normalizeTeamName(name: string): string {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/أ|إ|آ/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .toLowerCase();
}

// Server-side gate for elite_cup registration payments. Official participants
// come from elite_teams; registrations only reserve payment/access slots.
export async function guardEliteRegistration(supabase: SupabaseClient, teamNameRaw: string) {
  const teamName = String(teamNameRaw || "").trim();
  if (!teamName) return { ok: false as const, error: "اختر اسم الفريق." };

  const { data: officialTeams, error: teamsError } = await supabase.from("elite_teams").select("name").order("name", { ascending: true });
  if (teamsError) return { ok: false as const, error: "تعذر تحميل فرق كأس النخبة حالياً." };
  const match = (officialTeams || []).map((row: { name: string }) => row.name).find((t) => normalizeTeamName(t) === normalizeTeamName(teamName));
  if (!match) return { ok: false as const, error: "هذا الفريق غير مدرج ضمن الفرق المسموح لها بالاشتراك في كأس النخبة." };

  const { data: paidOrders } = await supabase
    .from("orders")
    .select("team_name")
    .eq("tournament", "elite_cup")
    .eq("type", "tournament_registration")
    .in("payment_status", ["paid", "manual_access"]);

  const paidTeams = new Set((paidOrders || []).map((o: { team_name: string | null }) => normalizeTeamName(o.team_name || "")));

  if (paidTeams.has(normalizeTeamName(match))) {
    return { ok: false as const, error: `فريق "${match}" لديه تسجيل نشط بالفعل.` };
  }
  if (paidTeams.size >= ELITE_CUP_MAX_TEAMS) {
    return { ok: false as const, error: `اكتمل عدد الفرق المشتركة في كأس النخبة (${ELITE_CUP_MAX_TEAMS} فرق).` };
  }

  const { data: settings } = await supabase.from("registration_settings").select("price, deadline").eq("tournament", "elite").maybeSingle();
  if (!isRegistrationOpen(settings?.deadline)) {
    return { ok: false as const, error: "انتهى موعد التسجيل في كأس النخبة." };
  }

  return { ok: true as const, teamName: match, price: Number(settings?.price || 1500) };
}

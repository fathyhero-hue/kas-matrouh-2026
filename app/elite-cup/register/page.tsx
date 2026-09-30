import { Trophy } from "lucide-react";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { ELITE_CUP_MAX_TEAMS } from "@/lib/sport/elite-registration";
import { getEliteCupTeams } from "@/lib/sport/elite-bracket";
import { EliteRegistrationForm } from "@/components/elite/registration-form";
import { EmptyState } from "@/components/sport/empty-state";

export const dynamic = "force-dynamic";

function normalizeTeamName(name: string): string {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/أ|إ|آ/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .toLowerCase();
}

export default async function EliteRegisterPage() {
  const supabase = createServiceRoleClient();
  const [{ data: settings }, { data: paidOrders }, officialTeams] = await Promise.all([
    supabase.from("registration_settings").select("price, deadline").eq("tournament", "elite").maybeSingle(),
    supabase.from("orders").select("team_name").eq("tournament", "elite_cup").eq("type", "tournament_registration").in("payment_status", ["paid", "manual_access"]),
    getEliteCupTeams(supabase, ""),
  ]);

  const paidTeamKeys = new Set((paidOrders || []).map((o: { team_name: string | null }) => normalizeTeamName(o.team_name || "")));
  const teams = officialTeams.map((name) => ({ name, taken: paidTeamKeys.has(normalizeTeamName(name)) }));
  const availableTeams = teams.filter((t) => !t.taken).map((t) => t.name);
  const price = Number(settings?.price || 1500);
  // This is a server-rendered page; the deadline is intentionally evaluated per request.
  // eslint-disable-next-line react-hooks/purity
  const deadlinePassed = settings?.deadline ? Date.now() > new Date(settings.deadline).getTime() : false;

  return (
    <main dir="rtl" className="mx-auto max-w-xl px-4 pb-16 pt-8 sm:px-6">
      <div className="mb-6 flex items-center gap-3">
        <Trophy className="h-8 w-8 text-accent-blue" />
        <div>
          <h1 className="text-h1 font-black">فتح اشتراك كأس النخبة</h1>
          <p className="text-caption text-muted-foreground">
            {availableTeams.length} من {ELITE_CUP_MAX_TEAMS} أماكن متاحة — {price.toLocaleString("ar-EG")} ج.م للفريق
          </p>
        </div>
      </div>

      {officialTeams.length === 0 ? (
        <EmptyState message="لم يتم تجهيز قائمة فرق كأس النخبة للتسجيل بعد." />
      ) : deadlinePassed ? (
        <EmptyState message="عذراً، انتهى موعد التسجيل في كأس النخبة." />
      ) : availableTeams.length === 0 ? (
        <EmptyState message={`اكتمل عدد الفرق المشتركة (${ELITE_CUP_MAX_TEAMS} فرق). التسجيل مقفول.`} />
      ) : (
        <EliteRegistrationForm teams={teams} price={price} />
      )}
    </main>
  );
}

import { IdCard } from "lucide-react";
import { createPublicClient } from "@/lib/supabase/public";
import { RegistrationForm } from "@/components/player-card/registration-form";
import { EmptyState } from "@/components/sport/empty-state";

export const revalidate = 30;

export default async function PlayerCardPage() {
  const supabase = createPublicClient();
  const { data: tournaments } = await supabase
    .from("player_registration_tournaments")
    .select("id, name, logo_url")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const rows = tournaments || [];

  return (
    <main dir="rtl" className="mx-auto max-w-xl px-4 pb-16 pt-8 sm:px-6">
      <div className="mb-8 flex items-center gap-3">
        <IdCard className="h-8 w-8 text-accent-blue" />
        <h1 className="text-h1 font-black">تسجيل كارت اللاعب</h1>
      </div>

      {rows.length === 0 ? (
        <EmptyState message="لسه مفيش بطولات مفتوحة للتسجيل" />
      ) : (
        <RegistrationForm tournaments={rows} />
      )}
    </main>
  );
}

import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { RegistrationsManager } from "@/components/admin/registrations-manager";
import { PlayerTournamentsManager } from "@/components/admin/player-tournaments-manager";

export const dynamic = "force-dynamic";

export default async function AdminRegistrationsPage() {
  const supabase = createServiceRoleClient();
  const [{ data: registrations }, { data: tournaments }] = await Promise.all([
    supabase.from("player_registrations").select("*").order("created_at", { ascending: false }).limit(300),
    supabase.from("player_registration_tournaments").select("*").order("sort_order", { ascending: true }),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 font-black">تسجيل اللاعبين الفردي</h1>
          <p className="mt-1 text-caption text-muted-foreground">كل بطاقات اللاعبين والمديرين الفنيين المسجّلة عبر الموقع</p>
        </div>
        <Link href="/admin/rosters" className="rounded-full bg-accent-blue/15 px-3 py-1.5 text-caption font-bold text-accent-blue">
          ← قوائم الفرق
        </Link>
      </div>

      <PlayerTournamentsManager initial={(tournaments || []) as any} />

      <RegistrationsManager initialRegistrations={registrations || []} tournaments={(tournaments || []).map((t) => ({ id: t.id, name: t.name }))} />
    </div>
  );
}

import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { TOURNAMENTS, resolveEdition, isTournamentSlug, type TournamentSlug } from "@/lib/sport/tournaments";
import { MediaManager } from "@/components/admin/media-manager";
import { NotificationsManager } from "@/components/admin/notifications-manager";

export const dynamic = "force-dynamic";

export default async function AdminMediaPage({
  searchParams,
}: {
  searchParams: Promise<{ tournament?: string; edition?: string }>;
}) {
  const { tournament: rawSlug, edition: editionKey } = await searchParams;
  const slug: TournamentSlug = isTournamentSlug(rawSlug || "") ? (rawSlug as TournamentSlug) : "matrouh-cup";
  const edition = resolveEdition(slug, editionKey);

  const supabase = createServiceRoleClient();
  const { data: bracket } = await supabase.from("brackets").select("id").eq("legacy_suffix", edition.suffix).maybeSingle();
  const bracketId = bracket?.id as string | undefined;

  const [{ data: media }, { data: tickerRow }] = await Promise.all([
    supabase.from("media").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("app_settings").select("value").eq("key", "ticker").maybeSingle(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-h1 font-black">الإعلام والإشعارات</h1>
        <p className="mt-1 text-caption text-muted-foreground">الأخبار، شريط الأخبار المتحرك، والإشعارات الفورية للمتابعين</p>
      </div>

      <NotificationsManager />

      <MediaManager initialMedia={media || []} initialTicker={((tickerRow?.value as any)?.text as string) || ""} bracketId={bracketId} />

      {!bracketId && (
        <p className="text-caption text-red-400">تعذر تحديد بطولة افتراضية لإضافة الأخبار. جرّب رابط: <Link href="/admin/media?tournament=matrouh-cup&edition=ed3" className="underline">هنا</Link></p>
      )}
    </div>
  );
}

import Link from "next/link";
import { requireAdminPagePermission } from "@/lib/admin/authorization";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getElitePlayerCardContext, getRosterPlayerCardContext } from "@/lib/player-cards/data";
import { TOURNAMENTS, isTournamentSlug, resolveEdition, type TournamentSlug } from "@/lib/sport/tournaments";
import { PlayerCardTeamsManager } from "@/components/admin/player-card-teams-manager";

export const dynamic = "force-dynamic";

export default async function PlayerCardsPage({ searchParams }: { searchParams: Promise<{ tournament?: string; edition?: string }> }) {
  await requireAdminPagePermission("tournaments.player-cards.manage");
  const params = await searchParams;
  const slug: TournamentSlug = isTournamentSlug(params.tournament || "") ? params.tournament as TournamentSlug : "elite-cup";
  const edition = resolveEdition(slug, params.edition);
  const supabase = createServiceRoleClient();
  const teams = slug === "elite-cup"
    ? await getElitePlayerCardContext(supabase)
    : await (async () => {
      const { data: bracket, error } = await supabase.from("brackets").select("id").eq("legacy_suffix", edition.suffix).maybeSingle();
      if (error) throw error;
      return bracket?.id ? getRosterPlayerCardContext(supabase, bracket.id) : [];
    })();

  return <div className="space-y-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-h1 font-black">بطاقات اللاعبين</h1><p className="mt-1 text-caption text-muted-foreground">إدارة بطاقات {TOURNAMENTS[slug].label} دون تعديل مصدر بيانات القوائم.</p></div><div className="flex gap-2 overflow-x-auto">{(Object.keys(TOURNAMENTS) as TournamentSlug[]).map((item) => <Link key={item} href={`/admin/player-cards?tournament=${item}`} className={`shrink-0 rounded-xl px-3 py-2 text-caption font-black ${item === slug ? "bg-primary text-primary-foreground" : "bg-white/10 text-muted-foreground"}`}>{TOURNAMENTS[item].label}</Link>)}</div></div><PlayerCardTeamsManager teams={teams} tournament={slug} /></div>;
}

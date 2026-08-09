import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import { isTournamentSlug, resolveEdition, type TournamentPageProps } from "@/lib/sport/tournaments";
import { getBracketIdBySuffix } from "@/lib/sport/data";
import { EmptyState } from "@/components/sport/empty-state";

export const revalidate = 30;

export default async function CardsPage({ params, searchParams }: TournamentPageProps) {
  const { tournament: slug } = await params;
  if (!isTournamentSlug(slug)) notFound();
  const { edition: editionKey } = await searchParams;
  const edition = resolveEdition(slug, editionKey);

  const bracketId = await getBracketIdBySuffix(edition.suffix);
  const supabase = createPublicClient();
  const { data: cards } = await supabase.from("cards").select("*").eq("bracket_id", bracketId);

  const rows = (cards || []).filter((c) => (c.yellow || 0) > 0 || (c.red || 0) > 0).sort((a, b) => (b.red || 0) - (a.red || 0) || (b.yellow || 0) - (a.yellow || 0));
  if (rows.length === 0) return <EmptyState message="لسه مفيش بطاقات مسجّلة" />;

  return (
    <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-white/10">
      <table className="w-full text-center text-body">
        <thead>
          <tr className="border-b border-white/10 text-caption font-bold text-muted-foreground">
            <th className="px-3 py-3 text-right">اللاعب</th>
            <th className="px-3 py-3 text-right">الفريق</th>
            <th className="px-3 py-3">🟨</th>
            <th className="px-3 py-3">🟥</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} className="border-b border-white/5 last:border-0">
              <td className="px-3 py-3 text-right font-black">{c.player}</td>
              <td className="px-3 py-3 text-right text-muted-foreground">{c.team}</td>
              <td className="px-3 py-3 font-bold">{c.yellow || 0}</td>
              <td className="px-3 py-3 font-bold text-destructive">{c.red || 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

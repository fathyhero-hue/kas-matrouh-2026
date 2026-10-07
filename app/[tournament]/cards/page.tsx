import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import { isTournamentSlug, resolveEdition, type TournamentPageProps } from "@/lib/sport/tournaments";
import { getBracketIdBySuffix } from "@/lib/sport/data";
import { EmptyState } from "@/components/sport/empty-state";
import { getBracketRosterTeams } from "@/lib/sport/roster-link";
import { groupCardsByPlayer } from "@/lib/sport/stats-player";
import { getSuspensionState } from "@/lib/sport/suspensions";

export const revalidate = 30;

export default async function CardsPage({ params, searchParams }: TournamentPageProps) {
  const { tournament: slug } = await params;
  if (!isTournamentSlug(slug)) notFound();
  const { edition: editionKey } = await searchParams;
  const edition = resolveEdition(slug, editionKey);

  const bracketId = await getBracketIdBySuffix(edition.suffix);
  const supabase = createPublicClient();
  const [{ data: cards }, { data: matches }, rosterTeams] = await Promise.all([
    supabase.from("cards").select("*").eq("bracket_id", bracketId),
    supabase.from("matches").select("id, bracket_id, team_a, team_b, match_date, match_time, status").eq("bracket_id", bracketId),
    getBracketRosterTeams(supabase, bracketId),
  ]);

  const rows = groupCardsByPlayer(cards || [], rosterTeams).filter((c) => (c.yellow || 0) > 0 || (c.red || 0) > 0);
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
            <th className="px-3 py-3">الحالة</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} className="border-b border-white/5 last:border-0">
              <td className="px-3 py-3 text-right font-black">{c.player}</td>
              <td className="px-3 py-3 text-right text-muted-foreground">{c.team}</td>
              <td className="px-3 py-3 font-bold">{c.yellow || 0}</td>
              <td className="px-3 py-3 font-bold text-destructive">{c.red || 0}</td>
              <td className="px-3 py-3 text-caption font-bold">{getSuspensionState((cards || []).filter((card) => card.roster_player_id === c.rosterPlayerId), matches || [], rosterTeams).isSuspended ? <span className="text-destructive">موقوف مباراة</span> : <span className="text-accent-green">متاح</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

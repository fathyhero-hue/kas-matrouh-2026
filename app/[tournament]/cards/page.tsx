import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import { isTournamentSlug, resolveEdition, type TournamentPageProps } from "@/lib/sport/tournaments";
import { getBracketIdBySuffix } from "@/lib/sport/data";
import { EmptyState } from "@/components/sport/empty-state";
import { getBracketRosterTeams } from "@/lib/sport/roster-link";
import { addEventOnlyCardRows, getCardTotalsWithEvents, groupCardsByPlayer, resolveStatsPlayer } from "@/lib/sport/stats-player";
import { getSuspensionStateFromEvents } from "@/lib/sport/suspensions";
import { getPublicCardEvents } from "@/lib/sport/public-card-events";

export const revalidate = 30;

export default async function CardsPage({ params, searchParams }: TournamentPageProps) {
  const { tournament: slug } = await params;
  if (!isTournamentSlug(slug)) notFound();
  const { edition: editionKey } = await searchParams;
  const edition = resolveEdition(slug, editionKey);

  const bracketId = await getBracketIdBySuffix(edition.suffix);
  const supabase = createPublicClient();
  const [{ data: cards }, { data: matches }, publicEvents, rosterTeams] = await Promise.all([
    supabase.from("cards").select("*").eq("bracket_id", bracketId),
    supabase.from("matches").select("id, bracket_id, team_a, team_b, match_date, match_time, status").eq("bracket_id", bracketId),
    getPublicCardEvents(bracketId),
    getBracketRosterTeams(supabase, bracketId),
  ]);
  const cardEvents = publicEvents.data;
  const cardEventsError = publicEvents.error;

  const rows = addEventOnlyCardRows(groupCardsByPlayer(cards || [], rosterTeams), cardEvents || [], rosterTeams).filter((c) => (c.yellow || 0) > 0 || (c.red || 0) > 0);
  if (rows.length === 0) return <EmptyState message="لا توجد بطاقات مسجلة" />;

  return (
    <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-white/10">
      <table className="w-full text-center text-body">
        <thead>
          <tr className="border-b border-white/10 text-caption font-bold text-muted-foreground">
            <th className="px-3 py-3 text-right">اللاعب</th>
            <th className="px-3 py-3 text-right">الفريق</th>
            <th className="px-3 py-3">ðŸŸ¨</th>
            <th className="px-3 py-3">ðŸŸ¥</th>
            <th className="px-3 py-3">الحالة</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} className="border-b border-white/5 last:border-0">
              <td className="px-3 py-3 text-right font-black">{resolveStatsPlayer(c, rosterTeams).player}</td>
              <td className="px-3 py-3 text-right text-muted-foreground">{resolveStatsPlayer(c, rosterTeams).team}</td>
              <td className="px-3 py-3 font-bold"><div>{getCardTotalsWithEvents(c, (cardEvents || []).filter((event) => event.roster_player_id === c.roster_player_id)).yellow}</div><div className="text-[10px] text-muted-foreground">موثق {((cardEvents || []).filter((event) => event.roster_player_id === c.roster_player_id && event.card_type === "yellow")).length}</div></td>
              <td className="px-3 py-3 font-bold text-destructive"><div>{getCardTotalsWithEvents(c, (cardEvents || []).filter((event) => event.roster_player_id === c.roster_player_id)).red}</div><div className="text-[10px] text-muted-foreground">موثق {((cardEvents || []).filter((event) => event.roster_player_id === c.roster_player_id && event.card_type === "direct_red")).length}</div></td>
              <td className="px-3 py-3 text-caption font-bold">{(() => { const playerEvents = (cardEvents || []).filter((event) => event.roster_player_id === c.roster_player_id); const hasUnresolvedLegacyCards = (Number(c.yellow) || 0) + (Number(c.red) || 0) > 0 && playerEvents.length === 0; const status = getSuspensionStateFromEvents(playerEvents, matches || [], rosterTeams); return cardEventsError || hasUnresolvedLegacyCards ? <span className="text-accent-orange">يحتاج تحديد المباراة</span> : status.isSuspended ? <span className="text-destructive">موقوف مباراة</span> : <span className="text-accent-green">متاح</span>; })()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

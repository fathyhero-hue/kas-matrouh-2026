import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import { isTournamentSlug, resolveEdition, type TournamentPageProps } from "@/lib/sport/tournaments";
import { getBracketIdBySuffix } from "@/lib/sport/data";
import { EmptyState } from "@/components/sport/empty-state";
import { getBracketCardRosterTeams } from "@/lib/sport/roster-link";
import { addEventOnlyCardRows, getCardTotalsWithEvents, groupCardsByPlayer, hasUnassignedCards, resolveStatsPlayer } from "@/lib/sport/stats-player";
import { getCardStatus, getSuspensionStateFromEvents } from "@/lib/sport/suspensions";
import { getPublicCardEvents } from "@/lib/sport/public-card-events";

export const revalidate = 30;

export default async function CardsPage({ params, searchParams }: TournamentPageProps) {
  const { tournament: slug } = await params;
  if (!isTournamentSlug(slug)) notFound();
  const { edition: editionKey } = await searchParams;
  const edition = resolveEdition(slug, editionKey);

  const bracketId = await getBracketIdBySuffix(edition.suffix);
  const supabase = createPublicClient();
  const [{ data: cards, error: cardsError }, { data: matches, error: matchesError }, publicEvents, cardRoster] = await Promise.all([
    supabase.from("cards").select("*").eq("bracket_id", bracketId),
    supabase.from("matches").select("id, bracket_id, team_a, team_b, match_date, match_time, status").eq("bracket_id", bracketId),
    getPublicCardEvents(bracketId),
    getBracketCardRosterTeams(supabase, bracketId),
  ]);
  const rosterTeams = cardRoster.teams;
  const cardEvents = publicEvents.data;
  const cardEventsError = publicEvents.error;

  const rows = addEventOnlyCardRows(groupCardsByPlayer(cards || [], rosterTeams), cardEvents, rosterTeams).filter((card) => {
    const events = cardEvents.filter((event) => event.roster_player_id === resolveStatsPlayer(card, rosterTeams).rosterPlayerId);
    const totals = getCardTotalsWithEvents(card, events);
    return totals.yellow > 0 || totals.red > 0;
  });
  if (rows.length === 0) return <EmptyState message="لا توجد بطاقات مسجلة" />;

  return (
    <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-white/10">
      <table className="w-full text-center text-body">
        <thead>
          <tr className="border-b border-white/10 text-caption font-bold text-muted-foreground">
            <th className="px-3 py-3 text-right">اللاعب</th>
            <th className="px-3 py-3 text-right">الفريق</th>
            <th className="px-3 py-3">الإنذارات</th>
            <th className="px-3 py-3">الطرد المباشر</th>
            <th className="px-3 py-3">الحالة</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((card) => {
            const identity = resolveStatsPlayer(card, rosterTeams);
            const playerEvents = cardEvents.filter((event) => event.roster_player_id === identity.rosterPlayerId);
            const totals = getCardTotalsWithEvents(card, playerEvents);
            const status = getCardStatus(getSuspensionStateFromEvents(playerEvents, matches || [], rosterTeams), hasUnassignedCards(card, playerEvents), Boolean(cardsError || matchesError || cardEventsError || cardRoster.error));
            return <tr key={identity.identityKey} className="border-b border-white/5 last:border-0">
              <td className="px-3 py-3 text-right font-black">{identity.player}</td>
              <td className="px-3 py-3 text-right text-muted-foreground">{identity.team}</td>
              <td className="px-3 py-3 font-bold">{totals.yellow}</td>
              <td className="px-3 py-3 font-bold text-destructive">{totals.red}</td>
              <td className={`px-3 py-3 text-caption font-bold ${status === "موقوف مباراة" ? "text-destructive" : status === "متاح" ? "text-accent-green" : "text-accent-orange"}`}>{status}</td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  );
}

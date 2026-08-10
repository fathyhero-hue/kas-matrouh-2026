import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import { isTournamentSlug, resolveEdition, type TournamentPageProps } from "@/lib/sport/tournaments";
import { getBracketIdBySuffix } from "@/lib/sport/data";
import { MatchCard } from "@/components/sport/match-card";
import { EmptyState } from "@/components/sport/empty-state";
import { getBracketTeamLogos, lookupTeamLogo } from "@/lib/sport/roster-link";

export const revalidate = 30;

export default async function MatchesPage({ params, searchParams }: TournamentPageProps) {
  const { tournament: slug } = await params;
  if (!isTournamentSlug(slug)) notFound();
  const { edition: editionKey } = await searchParams;
  const edition = resolveEdition(slug, editionKey);

  const bracketId = await getBracketIdBySuffix(edition.suffix);
  const supabase = createPublicClient();
  const [{ data: matches }, logos] = await Promise.all([
    supabase
      .from("matches")
      .select("*")
      .eq("bracket_id", bracketId)
      .order("match_date", { ascending: false })
      .order("match_time", { ascending: false }),
    getBracketTeamLogos(supabase, bracketId),
  ]);

  const allMatches = matches || [];
  if (allMatches.length === 0) return <EmptyState message="لسه مفيش مباريات مسجّلة" />;

  const rounds = Array.from(new Set(allMatches.map((m) => m.round || "")));

  return (
    <div className="space-y-8">
      {rounds.map((round) => (
        <section key={round}>
          <h2 className="mb-3 text-h3 font-black text-muted-foreground">{round || "بدون دور"}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {allMatches
              .filter((m) => (m.round || "") === round)
              .map((m) => (
                <MatchCard
                  key={m.id}
                  teamA={m.team_a}
                  teamALogo={lookupTeamLogo(logos, m.team_a) || m.team_a_logo}
                  teamB={m.team_b}
                  teamBLogo={lookupTeamLogo(logos, m.team_b) || m.team_b_logo}
                  homeGoals={m.home_goals}
                  awayGoals={m.away_goals}
                  status={m.status}
                  matchDate={m.match_date}
                  matchTime={m.match_time}
                  round={m.round}
                  isLive={m.is_live}
                  liveMinute={m.live_minute}
                />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

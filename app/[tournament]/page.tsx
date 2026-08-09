import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import { isTournamentSlug, resolveEdition } from "@/lib/sport/tournaments";
import { getBracketIdBySuffix } from "@/lib/sport/data";
import { buildStandings } from "@/lib/sport/standings";
import { MatchCard } from "@/components/sport/match-card";
import { StandingsTable } from "@/components/sport/standings-table";

export const revalidate = 30;

type PageProps = {
  params: Promise<{ tournament: string }>;
  searchParams: Promise<{ edition?: string }>;
};

export default async function TournamentOverviewPage({ params, searchParams }: PageProps) {
  const { tournament: slug } = await params;
  if (!isTournamentSlug(slug)) notFound();
  const { edition: editionKey } = await searchParams;
  const edition = resolveEdition(slug, editionKey);

  const bracketId = await getBracketIdBySuffix(edition.suffix);
  const supabase = createPublicClient();

  const { data: matches } = await supabase
    .from("matches")
    .select("*")
    .eq("bracket_id", bracketId)
    .order("match_date", { ascending: false })
    .order("match_time", { ascending: false });

  const allMatches = matches || [];
  const standings = buildStandings(allMatches);
  const live = allMatches.find((m) => m.is_live);
  const upcoming = !live
    ? [...allMatches].filter((m) => m.status !== "انتهت").sort((a, b) => (a.match_date || "").localeCompare(b.match_date || ""))[0]
    : null;
  const featured = live || upcoming;
  const recentResults = allMatches.filter((m) => m.status === "انتهت").slice(0, 5);

  if (allMatches.length === 0) {
    return (
      <div className="rounded-2xl bg-card p-10 text-center ring-1 ring-white/10">
        <p className="text-h3 font-black text-muted-foreground">لسه مفيش مباريات مسجّلة للبطولة دي</p>
        <p className="mt-2 text-body text-muted-foreground">تابعونا قريبًا لأول تحديث.</p>
      </div>
    );
  }

  return (
    <div>
      {featured && (
        <section className="mb-8">
          <h2 className="mb-3 text-h3 font-black text-muted-foreground">{live ? "جارية الآن" : "المباراة القادمة"}</h2>
          <MatchCard
            teamA={featured.team_a}
            teamALogo={featured.team_a_logo}
            teamB={featured.team_b}
            teamBLogo={featured.team_b_logo}
            homeGoals={featured.home_goals}
            awayGoals={featured.away_goals}
            status={featured.status}
            matchDate={featured.match_date}
            matchTime={featured.match_time}
            round={featured.round}
            isLive={featured.is_live}
            liveMinute={featured.live_minute}
          />
        </section>
      )}

      {standings.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-h3 font-black text-muted-foreground">الترتيب</h2>
          <StandingsTable rows={standings} />
        </section>
      )}

      {recentResults.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-h3 font-black text-muted-foreground">آخر النتائج</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {recentResults.map((m) => (
              <MatchCard
                key={m.id}
                teamA={m.team_a}
                teamALogo={m.team_a_logo}
                teamB={m.team_b}
                teamBLogo={m.team_b_logo}
                homeGoals={m.home_goals}
                awayGoals={m.away_goals}
                status={m.status}
                matchDate={m.match_date}
                matchTime={m.match_time}
                round={m.round}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

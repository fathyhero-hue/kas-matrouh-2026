import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { Trophy, ArrowLeft } from "lucide-react";
import { createPublicClient } from "@/lib/supabase/public";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { isTournamentSlug, resolveEdition } from "@/lib/sport/tournaments";
import { getBracketIdBySuffix } from "@/lib/sport/data";
import { buildStandings } from "@/lib/sport/standings";
import { MatchCard } from "@/components/sport/match-card";
import { StandingsTable } from "@/components/sport/standings-table";
import { EliteBracketDiagram } from "@/components/sport/elite-bracket-diagram";
import { computeEliteBracket, getEliteCupTeams, getEliteQualificationZone, getEliteStandings, ELITE_CUP_TEAM_COUNT, type BracketMatch } from "@/lib/sport/elite-bracket";
import { getBracketTeamLogos, lookupTeamLogo } from "@/lib/sport/roster-link";

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

  let eliteRegistrationBanner: ReactNode = null;
  if (slug === "elite-cup") {
    const service = createServiceRoleClient();
    const [{ data: paidOrders }, officialTeams] = await Promise.all([
      service
        .from("orders")
        .select("team_name")
        .eq("tournament", "elite_cup")
        .eq("type", "tournament_registration")
        .in("payment_status", ["paid", "manual_access"]),
      getEliteCupTeams(service, bracketId),
    ]);
    const officialKeys = new Set(officialTeams.map((team) => team.trim().toLowerCase()));
    const paidCount = new Set(
      (paidOrders || [])
        .map((o: { team_name: string | null }) => String(o.team_name || "").trim().toLowerCase())
        .filter((name) => officialKeys.has(name))
    ).size;
    const remaining = Math.max(0, (officialTeams.length || ELITE_CUP_TEAM_COUNT) - paidCount);
    eliteRegistrationBanner = remaining > 0 ? (
      <Link
        href="/elite-cup/register"
        className="mb-6 flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-l from-accent-green/20 to-accent-green/5 p-5 ring-1 ring-accent-green/30 transition-all hover:ring-accent-green/60"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-green">
            <Trophy className="h-5 w-5 text-background" />
          </div>
          <div>
            <div className="text-body font-black">الاشتراك في كأس النخبة مفتوح الآن</div>
            <div className="text-caption text-muted-foreground">{remaining} من {ELITE_CUP_TEAM_COUNT} أماكن متاحة - 1,500 ج.م للفريق</div>
          </div>
        </div>
        <ArrowLeft className="h-5 w-5 shrink-0 text-muted-foreground" />
      </Link>
    ) : null;
  }

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
  const teamLogo = (team: string | null, fallback: string | null) => lookupTeamLogo(logos, team) || fallback;
  const standings = buildStandings(allMatches, logos);
  const live = allMatches.find((m) => m.is_live);
  const upcoming = !live
    ? [...allMatches].filter((m) => m.status !== "انتهت").sort((a, b) => (a.match_date || "").localeCompare(b.match_date || ""))[0]
    : null;
  const featured = live || upcoming;
  const recentResults = allMatches.filter((m) => m.status === "انتهت").slice(0, 5);

  if (slug === "elite-cup") {
    const elite = await getEliteStandings(createServiceRoleClient(), bracketId);
    const bracket = computeEliteBracket(elite.standings, allMatches as BracketMatch[]);
    const eliteStandings = elite.standings.map((row, index) => ({ ...row, zone: getEliteQualificationZone(index + 1) }));

    return (
      <div>
        {eliteRegistrationBanner}

        {featured && (
          <section className="mb-8">
            <h2 className="mb-3 text-h3 font-black text-muted-foreground">{live ? "جارية الآن" : "المباراة القادمة"}</h2>
            <MatchCard
              teamA={featured.team_a}
              teamALogo={teamLogo(featured.team_a, featured.team_a_logo)}
              teamB={featured.team_b}
              teamBLogo={teamLogo(featured.team_b, featured.team_b_logo)}
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

        <section className="mb-8">
          <h2 className="mb-3 text-h3 font-black text-muted-foreground">نظام كأس النخبة</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-card p-4 ring-1 ring-white/10"><div className="text-h3 font-black">9</div><div className="text-caption text-muted-foreground">فرق في مجموعة واحدة</div></div>
            <div className="rounded-xl bg-card p-4 ring-1 ring-white/10"><div className="text-h3 font-black">4</div><div className="text-caption text-muted-foreground">مباريات لكل فريق</div></div>
            <div className="rounded-xl bg-card p-4 ring-1 ring-white/10"><div className="text-h3 font-black">18</div><div className="text-caption text-muted-foreground">مباراة في مرحلة المجموعة</div></div>
            <div className="rounded-xl bg-card p-4 ring-1 ring-white/10"><div className="text-caption font-black text-accent-green">1-2 نصف النهائي</div><div className="mt-1 text-caption text-accent-blue">3-6 الملحق</div><div className="mt-1 text-caption text-destructive">7-9 خروج</div></div>
          </div>
        </section>

        {eliteStandings.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-h3 font-black text-muted-foreground">الترتيب الموحد</h2>
            <StandingsTable rows={eliteStandings} />
          </section>
        )}

        <section className="mb-8">
          <h2 className="mb-3 text-h3 font-black text-muted-foreground">مخطط الأدوار الإقصائية</h2>
          <EliteBracketDiagram bracket={bracket} />
        </section>

        {recentResults.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-h3 font-black text-muted-foreground">آخر النتائج</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {recentResults.map((m) => (
                <MatchCard
                  key={m.id}
                  teamA={m.team_a}
                  teamALogo={teamLogo(m.team_a, m.team_a_logo)}
                  teamB={m.team_b}
                  teamBLogo={teamLogo(m.team_b, m.team_b_logo)}
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

  if (allMatches.length === 0) {
    return (
      <div>
        {eliteRegistrationBanner}
        <div className="rounded-2xl bg-card p-10 text-center ring-1 ring-white/10">
          <p className="text-h3 font-black text-muted-foreground">لسه مفيش مباريات مسجلة للبطولة دي</p>
          <p className="mt-2 text-body text-muted-foreground">تابعونا قريبًا لأول تحديث.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {eliteRegistrationBanner}
      {featured && (
        <section className="mb-8">
          <h2 className="mb-3 text-h3 font-black text-muted-foreground">{live ? "جارية الآن" : "المباراة القادمة"}</h2>
          <MatchCard
            teamA={featured.team_a}
            teamALogo={teamLogo(featured.team_a, featured.team_a_logo)}
            teamB={featured.team_b}
            teamBLogo={teamLogo(featured.team_b, featured.team_b_logo)}
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
                teamALogo={teamLogo(m.team_a, m.team_a_logo)}
                teamB={m.team_b}
                teamBLogo={teamLogo(m.team_b, m.team_b_logo)}
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

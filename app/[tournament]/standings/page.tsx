import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import { isTournamentSlug, resolveEdition, type TournamentPageProps } from "@/lib/sport/tournaments";
import { getBracketIdBySuffix } from "@/lib/sport/data";
import { buildStandings } from "@/lib/sport/standings";
import { getEliteGroupStandings } from "@/lib/sport/elite-bracket";
import { getBracketTeamLogos } from "@/lib/sport/roster-link";
import { StandingsTable } from "@/components/sport/standings-table";
import { EmptyState } from "@/components/sport/empty-state";

export const revalidate = 30;

export default async function StandingsPage({ params, searchParams }: TournamentPageProps) {
  const { tournament: slug } = await params;
  if (!isTournamentSlug(slug)) notFound();
  const { edition: editionKey } = await searchParams;
  const edition = resolveEdition(slug, editionKey);

  const bracketId = await getBracketIdBySuffix(edition.suffix);
  const supabase = createPublicClient();

  if (slug === "elite-cup") {
    const { groupA, groupB, groupAStandings, groupBStandings } = await getEliteGroupStandings(supabase, bracketId);
    if (groupA.length === 0 && groupB.length === 0) return <EmptyState message="لسه المجموعات ما اتحددتش" />;
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-2 text-caption font-black text-accent-blue">المجموعة الأولى</div>
          <StandingsTable rows={groupAStandings} />
        </div>
        <div>
          <div className="mb-2 text-caption font-black text-accent-green">المجموعة الثانية</div>
          <StandingsTable rows={groupBStandings} />
        </div>
      </div>
    );
  }

  const [{ data: matches }, logos] = await Promise.all([
    supabase.from("matches").select("team_a, team_b, home_goals, away_goals, status, stage").eq("bracket_id", bracketId),
    getBracketTeamLogos(supabase, bracketId),
  ]);

  const standings = buildStandings(matches || [], logos);
  if (standings.length === 0) return <EmptyState message="لسه مفيش نتائج كفاية لعرض الترتيب" />;

  return <StandingsTable rows={standings} />;
}

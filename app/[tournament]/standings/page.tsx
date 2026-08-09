import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import { isTournamentSlug, resolveEdition, type TournamentPageProps } from "@/lib/sport/tournaments";
import { getBracketIdBySuffix } from "@/lib/sport/data";
import { buildStandings } from "@/lib/sport/standings";
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
  const { data: matches } = await supabase.from("matches").select("team_a, team_b, home_goals, away_goals, status, stage").eq("bracket_id", bracketId);

  const standings = buildStandings(matches || []);
  if (standings.length === 0) return <EmptyState message="لسه مفيش نتائج كفاية لعرض الترتيب" />;

  return <StandingsTable rows={standings} />;
}

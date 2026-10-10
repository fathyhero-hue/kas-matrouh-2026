import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import { isTournamentSlug, resolveEdition, type TournamentPageProps } from "@/lib/sport/tournaments";
import { getBracketIdBySuffix } from "@/lib/sport/data";
import { EmptyState } from "@/components/sport/empty-state";
import { PredictionBoard } from "@/components/sport/prediction-form";
import { PredictionLeaderboard } from "@/components/sport/prediction-leaderboard";

export const revalidate = 30;

export default async function FantasyPage({ params, searchParams }: TournamentPageProps) {
  const { tournament: slug } = await params;
  if (!isTournamentSlug(slug)) notFound();
  const { edition: editionKey } = await searchParams;
  const edition = resolveEdition(slug, editionKey);

  const bracketId = await getBracketIdBySuffix(edition.suffix);
  const supabase = createPublicClient();
  const { data: matches } = await supabase
    .from("matches")
    .select("id, team_a, team_b, match_date, match_time, status, is_live")
    .eq("bracket_id", bracketId)
    .neq("status", "انتهت")
    .order("match_date", { ascending: true })
    .limit(10);

  const rows = matches || [];
  return (
    <div className="space-y-8">
      {rows.length > 0
        ? <PredictionBoard matches={rows} bracketId={bracketId} />
        : <EmptyState message="لسه مفيش مباريات قادمة تقدر تتوقعها" />}
      <PredictionLeaderboard bracketId={bracketId} />
    </div>
  );
}

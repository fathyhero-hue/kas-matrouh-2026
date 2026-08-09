import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import { isTournamentSlug, resolveEdition, type TournamentPageProps } from "@/lib/sport/tournaments";
import { getBracketIdBySuffix } from "@/lib/sport/data";
import { EmptyState } from "@/components/sport/empty-state";
import { PredictionForm } from "@/components/sport/prediction-form";

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
    .select("id, team_a, team_b, match_date, match_time")
    .eq("bracket_id", bracketId)
    .neq("status", "انتهت")
    .order("match_date", { ascending: true })
    .limit(10);

  const rows = matches || [];
  if (rows.length === 0) return <EmptyState message="لسه مفيش مباريات قادمة تقدر تتوقعها" />;

  return (
    <div className="space-y-3">
      {rows.map((m) => (
        <div key={m.id} className="rounded-2xl bg-card p-4 ring-1 ring-white/10">
          <div className="mb-3 text-center text-body font-black">
            {m.team_a} <span className="text-muted-foreground">vs</span> {m.team_b}
          </div>
          <PredictionForm matchId={m.id} matchName={`${m.team_a} vs ${m.team_b}`} />
        </div>
      ))}
    </div>
  );
}

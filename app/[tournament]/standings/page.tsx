import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { isTournamentSlug, resolveEdition, type TournamentPageProps } from "@/lib/sport/tournaments";
import { getBracketIdBySuffix } from "@/lib/sport/data";
import { buildStandings } from "@/lib/sport/standings";
import { getEliteQualificationZone, getEliteStandings } from "@/lib/sport/elite-bracket";
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

  if (slug === "elite-cup") {
    const elite = await getEliteStandings(createServiceRoleClient(), bracketId);
    if (elite.standings.length === 0) return <EmptyState message="لا توجد فرق مسجلة في كأس النخبة" />;
    const rows = elite.standings.map((row, index) => ({ ...row, zone: getEliteQualificationZone(index + 1) }));
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-h3 font-black">ترتيب كأس النخبة</h2>
          <p className="mt-1 text-caption text-muted-foreground">مجموعة واحدة وتأهل مبني على المراكز الفعلية.</p>
        </div>
        <StandingsTable rows={rows} />
        <div className="grid gap-2 text-caption font-bold sm:grid-cols-3">
          <div className="rounded-xl bg-accent-green/10 p-3 text-accent-green ring-1 ring-accent-green/30">1-2: تأهل مباشر إلى نصف النهائي</div>
          <div className="rounded-xl bg-accent-blue/10 p-3 text-accent-blue ring-1 ring-accent-blue/30">3-6: الملحق المؤهل لنصف النهائي</div>
          <div className="rounded-xl bg-destructive/10 p-3 text-destructive ring-1 ring-destructive/30">7-9: خارج البطولة</div>
        </div>
      </div>
    );
  }

  const supabase = createPublicClient();
  const [{ data: matches }, logos] = await Promise.all([
    supabase.from("matches").select("team_a, team_b, home_goals, away_goals, status, stage").eq("bracket_id", bracketId),
    getBracketTeamLogos(supabase, bracketId),
  ]);
  const standings = buildStandings(matches || [], logos);
  if (standings.length === 0) return <EmptyState message="لا توجد نتائج كفاية لعرض الترتيب" />;
  return <StandingsTable rows={standings} />;
}

import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import { isTournamentSlug, resolveEdition, type TournamentPageProps } from "@/lib/sport/tournaments";
import { getBracketIdBySuffix } from "@/lib/sport/data";
import { MatchCard } from "@/components/sport/match-card";
import { EmptyState } from "@/components/sport/empty-state";

export const revalidate = 30;

export default async function KnockoutPage({ params, searchParams }: TournamentPageProps) {
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
    .eq("stage", "knockout")
    .order("match_date", { ascending: true });

  const rows = matches || [];
  if (rows.length === 0) return <EmptyState message="لسه مفيش أدوار إقصائية بدأت" />;

  const rounds = Array.from(new Set(rows.map((m) => m.round || "")));

  return (
    <div className="space-y-8">
      {rounds.map((round) => (
        <section key={round}>
          <h2 className="mb-3 text-h3 font-black text-muted-foreground">{round || "دور إقصائي"}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {rows
              .filter((m) => (m.round || "") === round)
              .map((m) => (
                <div key={m.id}>
                  <MatchCard
                    teamA={m.team_a}
                    teamALogo={m.team_a_logo}
                    teamB={m.team_b}
                    teamBLogo={m.team_b_logo}
                    homeGoals={m.home_goals}
                    awayGoals={m.away_goals}
                    status={m.status}
                    matchDate={m.match_date}
                    matchTime={m.match_time}
                    round={m.match_label}
                    isLive={m.is_live}
                    liveMinute={m.live_minute}
                  />
                  {m.qualified_team && (
                    <p className="mt-1.5 text-center text-caption font-bold text-accent-green">✓ تأهل: {m.qualified_team}</p>
                  )}
                </div>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

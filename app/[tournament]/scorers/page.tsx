import { notFound } from "next/navigation";
import Image from "next/image";
import { Trophy } from "lucide-react";
import { createPublicClient } from "@/lib/supabase/public";
import { isTournamentSlug, resolveEdition, type TournamentPageProps } from "@/lib/sport/tournaments";
import { getBracketIdBySuffix } from "@/lib/sport/data";
import { EmptyState } from "@/components/sport/empty-state";
import { getBracketRosterTeams, buildPlayerPhotoResolver } from "@/lib/sport/roster-link";

export const revalidate = 30;

export default async function ScorersPage({ params, searchParams }: TournamentPageProps) {
  const { tournament: slug } = await params;
  if (!isTournamentSlug(slug)) notFound();
  const { edition: editionKey } = await searchParams;
  const edition = resolveEdition(slug, editionKey);

  const bracketId = await getBracketIdBySuffix(edition.suffix);
  const supabase = createPublicClient();
  const [{ data: goals }, rosterTeams] = await Promise.all([
    supabase.from("goals").select("*").eq("bracket_id", bracketId).order("goals", { ascending: false }),
    getBracketRosterTeams(supabase, bracketId),
  ]);
  const resolvePhoto = buildPlayerPhotoResolver(rosterTeams);

  const scorers = (goals || []).filter((g) => (g.goals || 0) > 0).map((g) => ({ ...g, image_url: g.image_url || resolvePhoto(g.team, g.player) }));
  if (scorers.length === 0) return <EmptyState message="لسه مفيش أهداف مسجّلة" />;

  return (
    <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-white/10">
      {scorers.map((g, i) => (
        <div key={g.id} className="flex items-center gap-3 border-b border-white/5 px-4 py-3 last:border-0">
          <span className="w-6 text-center text-caption font-bold text-muted-foreground">{i + 1}</span>
          {g.image_url ? (
            <Image src={g.image_url} alt={g.player} width={40} height={40} className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-caption font-bold">{g.player?.[0]}</div>
          )}
          <div className="flex-1">
            <div className="text-body font-black">{g.player}</div>
            <div className="text-caption text-muted-foreground">{g.team}</div>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-accent-orange/15 px-3 py-1 text-caption font-black text-accent-orange">
            <Trophy className="h-3.5 w-3.5" />
            {g.goals}
          </div>
        </div>
      ))}
    </div>
  );
}

import { notFound } from "next/navigation";
import Image from "next/image";
import { Trophy } from "lucide-react";
import { createPublicClient } from "@/lib/supabase/public";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { isTournamentSlug, resolveEdition, type TournamentPageProps } from "@/lib/sport/tournaments";
import { getBracketIdBySuffix } from "@/lib/sport/data";
import { EmptyState } from "@/components/sport/empty-state";
import { getBracketRosterTeams, buildPlayerPhotoResolver } from "@/lib/sport/roster-link";
import { groupGoalsByPlayer } from "@/lib/sport/stats-player";

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
  const { data: matchGoalEvents, error: matchGoalEventsError } = await createServiceRoleClient()
    .from("match_goal_events")
    .select("roster_player_id, team_roster_id")
    .eq("bracket_id", bracketId)
    .is("revoked_at", null);
  if (matchGoalEventsError) throw matchGoalEventsError;

  const rosterPlayerById = new Map(rosterTeams.flatMap((team) =>
    team.players.map((player) => [player.id, { player, team }] as const),
  ));
  const eventScorerTotals = new Map<string, { playerId: string; teamId: string; name: string; team: string; goals: number }>();
  for (const event of matchGoalEvents || []) {
    const roster = rosterPlayerById.get(event.roster_player_id);
    if (!roster || roster.team.id !== event.team_roster_id) continue;
    const key = `${event.team_roster_id}:${event.roster_player_id}`;
    const current = eventScorerTotals.get(key);
    eventScorerTotals.set(key, {
      playerId: event.roster_player_id,
      teamId: event.team_roster_id,
      name: roster.player.name,
      team: roster.team.team,
      goals: (current?.goals || 0) + 1,
    });
  }
  const eventScorers = [...eventScorerTotals.values()].sort((left, right) =>
    right.goals - left.goals || left.name.localeCompare(right.name),
  );
  const resolvePhoto = buildPlayerPhotoResolver(rosterTeams);

  const scorers = groupGoalsByPlayer(goals || [], rosterTeams).map((g) => ({ ...g, image_url: g.image_url || resolvePhoto(g.team, g.player) }));
  if (scorers.length === 0 && eventScorers.length === 0) return <EmptyState message="لسه مفيش أهداف مسجّلة" />;

  return (
    <div className="space-y-6">
      {scorers.length > 0 && (
        <section>
          <h2 className="mb-3 text-h3 font-black">ترتيب الهدافين المسجل</h2>
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
        </section>
      )}

      {eventScorers.length > 0 && (
        <section>
          <h2 className="mb-3 text-h3 font-black">أهداف أحداث المباريات</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            أهداف مسجلة بمعرّفات اللاعبين في نظام أحداث المباريات، معروضة مستقلًا عن أرشيف الهدافين القديم غير المرتبط بهوية لاعب.
          </p>
          <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-white/10">
            {eventScorers.map((scorer, index) => {
              const photo = resolvePhoto(scorer.team, scorer.name);
              return (
                <div key={`${scorer.teamId}:${scorer.playerId}`} className="flex items-center gap-3 border-b border-white/5 px-4 py-3 last:border-0">
                  <span className="w-6 text-center text-caption font-bold text-muted-foreground">{index + 1}</span>
                  {photo ? (
                    <Image src={photo} alt={scorer.name} width={40} height={40} className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-caption font-bold">{scorer.name[0]}</div>
                  )}
                  <div className="flex-1">
                    <div className="text-body font-black">{scorer.name}</div>
                    <div className="text-caption text-muted-foreground">{scorer.team}</div>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full bg-accent-orange/15 px-3 py-1 text-caption font-black text-accent-orange">
                    <Trophy className="h-3.5 w-3.5" />
                    {scorer.goals}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

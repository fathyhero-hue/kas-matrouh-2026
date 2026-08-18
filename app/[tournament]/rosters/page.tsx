import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Shield, CheckCircle2, ClipboardList, Trophy } from "lucide-react";
import { createPublicClient } from "@/lib/supabase/public";
import { isTournamentSlug, resolveEdition, getRosterMaxPlayers, supportsRosterSubmission, type TournamentPageProps } from "@/lib/sport/tournaments";
import { getBracketIdBySuffix } from "@/lib/sport/data";
import { EmptyState } from "@/components/sport/empty-state";

export const revalidate = 30;

export default async function RostersPage({ params, searchParams }: TournamentPageProps) {
  const { tournament: slug } = await params;
  if (!isTournamentSlug(slug)) notFound();
  const { edition: editionKey } = await searchParams;
  const edition = resolveEdition(slug, editionKey);

  const bracketId = await getBracketIdBySuffix(edition.suffix);
  const supabase = createPublicClient();
  const { data: rosters } = await supabase
    .from("team_rosters")
    .select("id, team_name, team_slug, logo_url, is_submitted, roster_players(name)")
    .eq("bracket_id", bracketId);

  const maxPlayers = getRosterMaxPlayers(slug);
  const rows = rosters || [];
  const editionQs = editionKey ? `?edition=${editionKey}` : "";
  const registerLink = slug === "elite-cup" && (
    <Link
      href="/elite-cup/register"
      className="mb-3 flex items-center justify-center gap-2 rounded-2xl bg-accent-green/15 py-3 text-body font-black text-accent-green ring-1 ring-accent-green/30 transition-colors hover:bg-accent-green/25"
    >
      <Trophy className="h-4 w-4" />
      لسه ما اشتركتش؟ سجّل فريقك وادفع الاشتراك هنا
    </Link>
  );
  const submitLink = supportsRosterSubmission(slug) && (
    <Link
      href={`/${slug}/rosters/submit${editionQs}`}
      className="mb-4 flex items-center justify-center gap-2 rounded-2xl bg-accent-blue/15 py-3 text-body font-black text-accent-blue ring-1 ring-accent-blue/30 transition-colors hover:bg-accent-blue/25"
    >
      <ClipboardList className="h-4 w-4" />
      تقديم قائمة فريقك
    </Link>
  );

  if (rows.length === 0) {
    return (
      <div>
        {registerLink}
        {submitLink}
        <EmptyState message="لسه مفيش قوائم فرق مسجّلة" />
      </div>
    );
  }

  return (
    <div>
      {submitLink}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r: any) => {
          const playerCount = (r.roster_players || []).filter((p: any) => p.name?.trim()).length;
          const isComplete = playerCount >= maxPlayers;
          return (
            <Link
              key={r.id}
              href={`/${slug}/rosters/${r.team_slug}${editionQs}`}
              className="flex items-center gap-3 rounded-2xl bg-card p-4 ring-1 ring-white/10 transition-colors hover:ring-accent-blue/50"
            >
              {r.logo_url ? (
                <Image src={r.logo_url} alt={r.team_name} width={48} height={48} className="h-12 w-12 rounded-full object-contain" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                  <Shield className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1">
                <div className="text-body font-black">{r.team_name}</div>
                <div className="text-caption text-muted-foreground">{playerCount}/{maxPlayers} لاعب</div>
              </div>
              {isComplete && <CheckCircle2 className="h-5 w-5 text-accent-green" />}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

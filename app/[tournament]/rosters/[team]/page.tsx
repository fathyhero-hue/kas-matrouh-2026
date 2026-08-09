import { notFound } from "next/navigation";
import { Shield, User } from "lucide-react";
import { createPublicClient } from "@/lib/supabase/public";
import { isTournamentSlug, resolveEdition } from "@/lib/sport/tournaments";
import { getBracketIdBySuffix } from "@/lib/sport/data";

export const revalidate = 30;

type PageProps = {
  params: Promise<{ tournament: string; team: string }>;
  searchParams: Promise<{ edition?: string }>;
};

export default async function RosterDetailPage({ params, searchParams }: PageProps) {
  const { tournament: slug, team } = await params;
  if (!isTournamentSlug(slug)) notFound();
  const { edition: editionKey } = await searchParams;
  const edition = resolveEdition(slug, editionKey);

  // Next.js does not auto-decode dynamic segments in this version — team
  // slugs contain Arabic text, so this arrives as a raw percent-encoded
  // string (e.g. "%D8%BA...") and must be decoded before use.
  const teamSlug = decodeURIComponent(team);

  const bracketId = await getBracketIdBySuffix(edition.suffix);
  const supabase = createPublicClient();
  const { data: roster } = await supabase
    .from("team_rosters")
    .select("id, team_name, logo_url, manager_name, is_submitted, roster_players(slot_index, name, number, personal_image_url)")
    .eq("bracket_id", bracketId)
    .eq("team_slug", teamSlug)
    .maybeSingle();

  if (!roster) notFound();

  const players = ((roster as any).roster_players || [])
    .filter((p: any) => p.name)
    .sort((a: any, b: any) => a.slot_index - b.slot_index);

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        {roster.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={roster.logo_url} alt={roster.team_name} className="h-16 w-16 rounded-full object-contain" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
            <Shield className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
        <div>
          <h2 className="text-h2 font-black">{roster.team_name}</h2>
          {roster.manager_name && <p className="text-caption text-muted-foreground">مسئول الفريق: {roster.manager_name}</p>}
        </div>
      </div>

      {players.length === 0 ? (
        <p className="text-center text-body text-muted-foreground">لسه القائمة مش متسجّلة</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {players.map((p: any, i: number) => (
            <div key={i} className="rounded-2xl bg-card p-3 text-center ring-1 ring-white/10">
              {p.personal_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.personal_image_url} alt={p.name} className="mx-auto h-16 w-16 rounded-full object-cover" />
              ) : (
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
                  <User className="h-7 w-7 text-muted-foreground" />
                </div>
              )}
              <div className="mt-2 text-caption font-black">{p.name}</div>
              {p.number && <div className="text-caption text-muted-foreground">#{p.number}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

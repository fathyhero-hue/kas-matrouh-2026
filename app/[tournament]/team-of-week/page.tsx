import { notFound } from "next/navigation";
import Image from "next/image";
import { createPublicClient } from "@/lib/supabase/public";
import { isTournamentSlug, resolveEdition, type TournamentPageProps } from "@/lib/sport/tournaments";
import { getBracketIdBySuffix } from "@/lib/sport/data";
import { EmptyState } from "@/components/sport/empty-state";

export const revalidate = 30;

export default async function TeamOfWeekPage({ params, searchParams }: TournamentPageProps) {
  const { tournament: slug } = await params;
  if (!isTournamentSlug(slug)) notFound();
  const { edition: editionKey } = await searchParams;
  const edition = resolveEdition(slug, editionKey);

  const bracketId = await getBracketIdBySuffix(edition.suffix);
  const supabase = createPublicClient();
  const { data: formations } = await supabase
    .from("formations")
    .select("*, formation_players(*)")
    .eq("bracket_id", bracketId)
    .order("updated_at", { ascending: false });

  const rows = formations || [];
  if (rows.length === 0) return <EmptyState message="لسه مفيش تشكيلة جولة منشورة" />;

  const latest = rows[0];
  const players = (latest.formation_players || []).sort((a: any, b: any) => a.slot_index - b.slot_index);

  return (
    <div>
      <h2 className="mb-4 text-h3 font-black text-muted-foreground">{latest.round}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {players.map((p: any) => (
          <div key={p.id} className="rounded-2xl bg-card p-3 text-center ring-1 ring-white/10">
            {p.image_url ? (
              <Image src={p.image_url} alt={p.name} width={64} height={64} className="mx-auto h-16 w-16 rounded-full object-cover" />
            ) : (
              <div className="mx-auto h-16 w-16 rounded-full bg-secondary" />
            )}
            <div className="mt-2 text-caption font-black">{p.name}</div>
            <div className="text-caption text-muted-foreground">{p.team}</div>
          </div>
        ))}
        {latest.coach_name && (
          <div className="rounded-2xl bg-primary/10 p-3 text-center ring-1 ring-primary/30">
            {latest.coach_image_url ? (
              <Image src={latest.coach_image_url} alt={latest.coach_name} width={64} height={64} className="mx-auto h-16 w-16 rounded-full object-cover" />
            ) : (
              <div className="mx-auto h-16 w-16 rounded-full bg-secondary" />
            )}
            <div className="mt-2 text-caption font-black">{latest.coach_name}</div>
            <div className="text-caption text-accent-blue">المدرب</div>
          </div>
        )}
      </div>
    </div>
  );
}

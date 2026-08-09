import { notFound } from "next/navigation";
import Image from "next/image";
import { Star } from "lucide-react";
import { createPublicClient } from "@/lib/supabase/public";
import { isTournamentSlug, resolveEdition, type TournamentPageProps } from "@/lib/sport/tournaments";
import { getBracketIdBySuffix } from "@/lib/sport/data";
import { EmptyState } from "@/components/sport/empty-state";

export const revalidate = 30;

export default async function MotmPage({ params, searchParams }: TournamentPageProps) {
  const { tournament: slug } = await params;
  if (!isTournamentSlug(slug)) notFound();
  const { edition: editionKey } = await searchParams;
  const edition = resolveEdition(slug, editionKey);

  const bracketId = await getBracketIdBySuffix(edition.suffix);
  const supabase = createPublicClient();
  const { data: items } = await supabase.from("motm").select("*").eq("bracket_id", bracketId);

  const rows = items || [];
  if (rows.length === 0) return <EmptyState message="لسه مفيش نجوم مباريات معلنة" />;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((m) => (
        <div key={m.id} className="rounded-2xl bg-card p-4 text-center ring-1 ring-white/10">
          {m.image_url ? (
            <Image src={m.image_url} alt={m.player} width={80} height={80} className="mx-auto h-20 w-20 rounded-full object-cover" />
          ) : (
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-secondary">
              <Star className="h-8 w-8 text-accent-orange" />
            </div>
          )}
          <div className="mt-3 text-body font-black">{m.player}</div>
          <div className="text-caption text-muted-foreground">{m.team}</div>
          {m.match_name && <div className="mt-1 text-caption text-muted-foreground">{m.match_name}</div>}
          {m.rating ? (
            <div className="mt-2 inline-flex rounded-full bg-accent-orange/15 px-3 py-1 text-caption font-black text-accent-orange">
              تقييم {m.rating}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

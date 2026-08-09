import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { TOURNAMENTS, resolveEdition, isTournamentSlug, type TournamentSlug } from "@/lib/sport/tournaments";
import { MatchesManager } from "@/components/admin/matches-manager";

export const dynamic = "force-dynamic";

export default async function AdminMatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ tournament?: string; edition?: string }>;
}) {
  const { tournament: rawSlug, edition: editionKey } = await searchParams;
  const slug: TournamentSlug = isTournamentSlug(rawSlug || "") ? (rawSlug as TournamentSlug) : "matrouh-cup";
  const config = TOURNAMENTS[slug];
  const edition = resolveEdition(slug, editionKey);

  const supabase = createServiceRoleClient();
  const { data: bracket } = await supabase.from("brackets").select("id").eq("legacy_suffix", edition.suffix).maybeSingle();
  const bracketId = bracket?.id as string | undefined;

  const { data: matches } = bracketId
    ? await supabase.from("matches").select("*").eq("bracket_id", bracketId).order("match_date", { ascending: false }).order("match_time", { ascending: false })
    : { data: [] };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-h1 font-black">إدارة المباريات</h1>
        <p className="mt-1 text-caption text-muted-foreground">التحكم في النتائج، اللايف، والعداد لحظة بلحظة</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(TOURNAMENTS) as TournamentSlug[]).map((s) => {
          const c = TOURNAMENTS[s];
          return c.editions.map((e) => (
            <Link
              key={`${s}-${e.key}`}
              href={`/admin/matches?tournament=${s}&edition=${e.key}`}
              className={`rounded-full px-3 py-1.5 text-caption font-bold transition-colors ${
                s === slug && e.key === edition.key ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {c.icon} {c.label}
              {c.editions.length > 1 ? ` — ${e.label}` : ""}
            </Link>
          ));
        })}
      </div>

      {!bracketId ? (
        <div className="rounded-2xl bg-card p-8 text-center text-caption text-muted-foreground ring-1 ring-white/10">
          لا يوجد براكيت مطابق لهذه البطولة/النسخة.
        </div>
      ) : (
        <MatchesManager bracketId={bracketId} initialMatches={matches || []} />
      )}
    </div>
  );
}

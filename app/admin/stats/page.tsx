import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { TOURNAMENTS, resolveEdition, isTournamentSlug, type TournamentSlug } from "@/lib/sport/tournaments";
import { StatsManager } from "@/components/admin/stats-manager";
import { getBracketRosterTeams } from "@/lib/sport/roster-link";

export const dynamic = "force-dynamic";

export default async function AdminStatsPage({
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

  const [goals, cards, motm, formations] = bracketId
    ? await Promise.all([
        supabase.from("goals").select("*").eq("bracket_id", bracketId).order("goals", { ascending: false }),
        supabase.from("cards").select("*").eq("bracket_id", bracketId),
        supabase.from("motm").select("*").eq("bracket_id", bracketId),
        supabase.from("formations").select("*, formation_players(*)").eq("bracket_id", bracketId).order("updated_at", { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const rosterTeams = bracketId ? await getBracketRosterTeams(supabase, bracketId) : [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-h1 font-black">الهدافين والكروت ونجم المباراة</h1>
        <p className="mt-1 text-caption text-muted-foreground">إحصائيات اللاعبين لكل بطولة/نسخة</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(TOURNAMENTS) as TournamentSlug[]).map((s) => {
          const c = TOURNAMENTS[s];
          return c.editions.map((e) => (
            <Link
              key={`${s}-${e.key}`}
              href={`/admin/stats?tournament=${s}&edition=${e.key}`}
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
        <div className="rounded-2xl bg-card p-8 text-center text-caption text-muted-foreground ring-1 ring-white/10">لا يوجد براكيت مطابق لهذه البطولة/النسخة.</div>
      ) : (
        <StatsManager
          bracketId={bracketId}
          initialGoals={(goals.data || []) as any}
          initialCards={(cards.data || []) as any}
          initialMotm={(motm.data || []) as any}
          initialFormations={(formations.data || []) as any}
          rosterTeams={rosterTeams}
        />
      )}
    </div>
  );
}

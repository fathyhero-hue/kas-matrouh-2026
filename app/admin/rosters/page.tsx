import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { TOURNAMENTS, resolveEdition, isTournamentSlug, type TournamentSlug } from "@/lib/sport/tournaments";
import { RostersManager } from "@/components/admin/rosters-manager";
import { BannedListManager } from "@/components/admin/banned-list-manager";

export const dynamic = "force-dynamic";

const REGISTRATION_KEY: Record<string, string> = { "matrouh-cup": "matrouh", "elite-cup": "elite" };
const MAX_PLAYERS: Record<string, number> = { "elite-cup": 10 };

export default async function AdminRostersPage({
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

  const { data: rosters } = bracketId
    ? await supabase
        .from("team_rosters")
        .select("*, roster_players(*)")
        .eq("bracket_id", bracketId)
        .order("team_name", { ascending: true })
    : { data: [] };

  const registrationKey = REGISTRATION_KEY[slug];
  const { data: settings } = registrationKey
    ? await supabase.from("registration_settings").select("*").eq("tournament", registrationKey).maybeSingle()
    : { data: null };

  const { data: banned } = await supabase.from("banned_entities").select("*").order("name", { ascending: true });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-h1 font-black">القوائم والتسجيل</h1>
        <p className="mt-1 text-caption text-muted-foreground">مراجعة قوائم الفرق وإعدادات التسجيل</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(TOURNAMENTS) as TournamentSlug[]).map((s) => {
            const c = TOURNAMENTS[s];
            return c.editions.map((e) => (
              <Link
                key={`${s}-${e.key}`}
                href={`/admin/rosters?tournament=${s}&edition=${e.key}`}
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
        <Link href="/admin/registrations" className="mr-auto rounded-full bg-accent-blue/15 px-3 py-1.5 text-caption font-bold text-accent-blue">
          تسجيل اللاعبين الفردي ←
        </Link>
      </div>

      {!bracketId ? (
        <div className="rounded-2xl bg-card p-8 text-center text-caption text-muted-foreground ring-1 ring-white/10">لا يوجد براكيت مطابق لهذه البطولة/النسخة.</div>
      ) : (
        <RostersManager
          bracketId={bracketId}
          initialRosters={(rosters || []) as any}
          registrationKey={registrationKey}
          initialSettings={settings as any}
          maxPlayers={MAX_PLAYERS[slug] || 12}
        />
      )}

      <BannedListManager initial={(banned || []) as any} />
    </div>
  );
}

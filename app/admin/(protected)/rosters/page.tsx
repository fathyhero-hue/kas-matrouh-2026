import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { TOURNAMENTS, resolveEdition, isTournamentSlug, getRosterMaxPlayers, type TournamentSlug } from "@/lib/sport/tournaments";
import { RostersManager } from "@/components/admin/rosters-manager";
import { BannedListManager } from "@/components/admin/banned-list-manager";
import { EliteTeamsStatus } from "@/components/admin/elite-teams-status";
import { getEliteCupTeams } from "@/lib/sport/elite-bracket";
import { normalize } from "@/lib/sport/roster-link";

const STATUS_PRIORITY: Record<string, number> = { paid: 3, manual_access: 3, pending_payment: 2, failed: 1, payment_init_failed: 1 };

export const dynamic = "force-dynamic";

const REGISTRATION_KEY: Record<string, string> = { "matrouh-cup": "matrouh", "elite-cup": "elite", "ramadan-cup": "ramadan" };

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
  const { data: bracket, error: bracketError } = await supabase.from("brackets").select("id").eq("legacy_suffix", edition.suffix).maybeSingle();
  if (bracketError) {
    console.error("[admin-rosters] bracket query failed", {
      code: bracketError.code,
      message: bracketError.message,
    });
    throw new Error("Failed to load tournament bracket");
  }

  const bracketId = bracket?.id as string | undefined;
  if (!bracketId) {
    console.error("[admin-rosters] bracket not found", {
      tournament: config.tournament,
      edition: edition.key,
      legacySuffix: edition.suffix,
    });
    throw new Error("Failed to load tournament bracket");
  }

  const { data: rosters, error: rostersError } = await supabase
    .from("team_rosters")
    .select("*, roster_players(*)")
    .eq("bracket_id", bracketId)
    .order("team_name", { ascending: true });
  if (rostersError) {
    console.error("[admin-rosters] roster query failed", {
      code: rostersError.code,
      message: rostersError.message,
    });
    throw new Error("Failed to load team rosters");
  }

  const registrationKey = REGISTRATION_KEY[slug];
  const { data: settings } = registrationKey
    ? await supabase.from("registration_settings").select("*").eq("tournament", registrationKey).maybeSingle()
    : { data: null };

  const { data: banned } = await supabase.from("banned_entities").select("*").order("name", { ascending: true });

  let eliteTeams: { name: string; order: any; roster: { is_submitted: boolean; playerCount: number } | null }[] | null = null;
  if (slug === "elite-cup") {
    const { data: eliteOrders } = await supabase
      .from("orders")
      .select("id, team_name, payment_status, payment_method, paid_at, confirmed_by, manager_name, phone, access_password, admin_manual_access")
      .eq("tournament", "elite_cup")
      .eq("type", "tournament_registration");

    const bestOrderByTeam = new Map<string, any>();
    for (const o of eliteOrders || []) {
      const key = normalize(o.team_name || "");
      if (!key) continue;
      const current = bestOrderByTeam.get(key);
      if (!current || (STATUS_PRIORITY[o.payment_status || ""] || 0) > (STATUS_PRIORITY[current.payment_status || ""] || 0)) {
        bestOrderByTeam.set(key, o);
      }
    }

    const rosterByTeam = new Map<string, { is_submitted: boolean; playerCount: number }>();
    for (const r of (rosters || []) as any[]) {
      rosterByTeam.set(normalize(r.team_name || ""), { is_submitted: r.is_submitted, playerCount: (r.roster_players || []).filter((p: any) => p.name?.trim()).length });
    }

    const participatingTeams = await getEliteCupTeams(supabase, bracketId);
    eliteTeams = participatingTeams.map((name) => ({
      name,
      order: bestOrderByTeam.get(normalize(name)) || null,
      roster: rosterByTeam.get(normalize(name)) || null,
    }));
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-h1 font-black">القوائم والتسجيل</h1>
        <p className="mt-1 text-caption text-muted-foreground">مراجعة قوائم الفرق وإعدادات التسجيل</p>
      </div>

      <div className="-mx-1 flex min-w-0 gap-2 overflow-x-auto px-1 pb-1">
        {(Object.keys(TOURNAMENTS) as TournamentSlug[]).map((s) => {
          const c = TOURNAMENTS[s];
          return c.editions.map((e) => (
            <Link
              key={`${s}-${e.key}`}
              href={`/admin/rosters?tournament=${s}&edition=${e.key}`}
              className={`shrink-0 rounded-full px-3 py-1.5 text-caption font-bold transition-colors ${
                s === slug && e.key === edition.key ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {c.icon} {c.label}
              {c.editions.length > 1 ? ` — ${e.label}` : ""}
            </Link>
          ));
        })}
      </div>

      {eliteTeams && <EliteTeamsStatus teams={eliteTeams} price={Number(settings?.price || 1500)} />}

      {!bracketId ? (
        <div className="rounded-2xl bg-card p-8 text-center text-caption text-muted-foreground ring-1 ring-white/10">لا يوجد براكيت مطابق لهذه البطولة/النسخة.</div>
      ) : (
        <RostersManager
          bracketId={bracketId}
          initialRosters={rosters as any}
          registrationKey={registrationKey}
          initialSettings={settings as any}
          maxPlayers={getRosterMaxPlayers(slug)}
          allowCreate={slug !== "elite-cup"}
        />
      )}

      <BannedListManager initial={(banned || []) as any} />
    </div>
  );
}

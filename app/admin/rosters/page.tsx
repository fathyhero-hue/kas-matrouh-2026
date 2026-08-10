import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { TOURNAMENTS, resolveEdition, isTournamentSlug, type TournamentSlug } from "@/lib/sport/tournaments";
import { ELITE_CUP_ELIGIBLE_TEAMS } from "@/lib/sport/elite-registration";
import { RostersManager } from "@/components/admin/rosters-manager";
import { BannedListManager } from "@/components/admin/banned-list-manager";
import { EliteTeamsStatus } from "@/components/admin/elite-teams-status";
import { EliteGroupsManager } from "@/components/admin/elite-groups-manager";

function normalizeTeamName(name: string): string {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/أ|إ|آ/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .toLowerCase();
}

const STATUS_PRIORITY: Record<string, number> = { paid: 3, manual_access: 3, pending_payment: 2, failed: 1, payment_init_failed: 1 };

export const dynamic = "force-dynamic";

const REGISTRATION_KEY: Record<string, string> = { "matrouh-cup": "matrouh", "elite-cup": "elite" };
const MAX_PLAYERS: Record<string, number> = { "elite-cup": 11 };

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

  let eliteTeams: { name: string; order: any; roster: { is_submitted: boolean; playerCount: number } | null }[] | null = null;
  let eliteGroups: { groupA: string[]; groupB: string[] } | null = null;
  if (slug === "elite-cup") {
    const { data: groupsSetting } = await supabase.from("app_settings").select("value").eq("key", "elite_cup_groups").maybeSingle();
    eliteGroups = { groupA: (groupsSetting?.value as any)?.groupA || [], groupB: (groupsSetting?.value as any)?.groupB || [] };
    const { data: eliteOrders } = await supabase
      .from("orders")
      .select("id, team_name, payment_status, manager_name, phone, access_password, admin_manual_access")
      .eq("tournament", "elite_cup")
      .eq("type", "tournament_registration");

    const bestOrderByTeam = new Map<string, any>();
    for (const o of eliteOrders || []) {
      const key = normalizeTeamName(o.team_name || "");
      if (!key) continue;
      const current = bestOrderByTeam.get(key);
      if (!current || (STATUS_PRIORITY[o.payment_status || ""] || 0) > (STATUS_PRIORITY[current.payment_status || ""] || 0)) {
        bestOrderByTeam.set(key, o);
      }
    }

    const rosterByTeam = new Map<string, { is_submitted: boolean; playerCount: number }>();
    for (const r of (rosters || []) as any[]) {
      rosterByTeam.set(normalizeTeamName(r.team_name || ""), { is_submitted: r.is_submitted, playerCount: (r.roster_players || []).filter((p: any) => p.name?.trim()).length });
    }

    eliteTeams = ELITE_CUP_ELIGIBLE_TEAMS.map((name) => ({
      name,
      order: bestOrderByTeam.get(normalizeTeamName(name)) || null,
      roster: rosterByTeam.get(normalizeTeamName(name)) || null,
    }));
  }

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

      {eliteTeams && <EliteTeamsStatus teams={eliteTeams} price={Number(settings?.price || 1500)} />}
      {eliteGroups && <EliteGroupsManager initialGroupA={eliteGroups.groupA} initialGroupB={eliteGroups.groupB} />}

      {!bracketId ? (
        <div className="rounded-2xl bg-card p-8 text-center text-caption text-muted-foreground ring-1 ring-white/10">لا يوجد براكيت مطابق لهذه البطولة/النسخة.</div>
      ) : (
        <RostersManager
          bracketId={bracketId}
          initialRosters={(rosters || []) as any}
          registrationKey={registrationKey}
          initialSettings={settings as any}
          maxPlayers={MAX_PLAYERS[slug] || 12}
          allowCreate={slug !== "elite-cup"}
        />
      )}

      <BannedListManager initial={(banned || []) as any} />
    </div>
  );
}

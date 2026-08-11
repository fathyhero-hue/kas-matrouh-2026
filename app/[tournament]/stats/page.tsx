import { notFound } from "next/navigation";
import Image from "next/image";
import { Swords, Shield, ShieldAlert, TrendingDown, Trophy, Star, Goal } from "lucide-react";
import { createPublicClient } from "@/lib/supabase/public";
import { isTournamentSlug, resolveEdition, type TournamentPageProps } from "@/lib/sport/tournaments";
import { getBracketIdBySuffix } from "@/lib/sport/data";
import { EmptyState } from "@/components/sport/empty-state";
import { getBracketTeamLogos, getBracketRosterTeams, buildPlayerPhotoResolver, lookupTeamLogo, normalize } from "@/lib/sport/roster-link";

export const revalidate = 30;

type TeamGoalStat = { team: string; gf: number; ga: number };

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string | number; accent: string }) {
  return (
    <div className="rounded-2xl bg-card p-4 ring-1 ring-white/10">
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-full ${accent}`}>{icon}</div>
      <div className="text-h2 font-black">{value}</div>
      <div className="text-caption text-muted-foreground">{label}</div>
    </div>
  );
}

function TeamStatCard({
  title, icon, accent, team, value, unit, logoUrl,
}: {
  title: string; icon: React.ReactNode; accent: string; team: string; value: number; unit: string; logoUrl: string | null;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card p-4 ring-1 ring-white/10">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${accent}`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-bold text-muted-foreground">{title}</div>
        {logoUrl ? (
          <Image src={logoUrl} alt={team} width={20} height={20} className="mb-0.5 inline-block h-5 w-5 rounded-full object-contain align-middle" />
        ) : null}
        <span className="truncate align-middle text-body font-black"> {team}</span>
      </div>
      <div className="shrink-0 text-h3 font-black text-accent-orange">{value} <span className="text-[10px] font-bold text-muted-foreground">{unit}</span></div>
    </div>
  );
}

function SpotlightCard({ label, name, team, value, valueLabel, photoUrl, icon }: { label: string; name: string; team: string; value: number; valueLabel: string; photoUrl: string | null; icon: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-bl from-primary/25 via-card to-card p-5 ring-1 ring-primary/30">
      <div className="mb-3 flex items-center gap-1.5 text-caption font-black text-accent-orange">{icon} {label}</div>
      <div className="flex items-center gap-4">
        {photoUrl ? (
          <Image src={photoUrl} alt={name} width={72} height={72} className="h-[72px] w-[72px] shrink-0 rounded-full object-cover ring-2 ring-accent-orange/50" />
        ) : (
          <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-secondary ring-2 ring-white/10">
            <Star className="h-7 w-7 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0">
          <div className="truncate text-h3 font-black">{name || "—"}</div>
          <div className="truncate text-caption text-muted-foreground">{team}</div>
          <div className="mt-1 text-caption font-black text-accent-orange">{value} {valueLabel}</div>
        </div>
      </div>
    </div>
  );
}

export default async function TournamentStatsPage({ params, searchParams }: TournamentPageProps) {
  const { tournament: slug } = await params;
  if (!isTournamentSlug(slug)) notFound();
  const { edition: editionKey } = await searchParams;
  const edition = resolveEdition(slug, editionKey);

  const bracketId = await getBracketIdBySuffix(edition.suffix);
  const supabase = createPublicClient();

  const [{ data: matches }, { data: goals }, { data: cards }, { data: motm }, logos, rosterTeams] = await Promise.all([
    supabase.from("matches").select("team_a, team_b, home_goals, away_goals, status").eq("bracket_id", bracketId),
    supabase.from("goals").select("player, team, goals, image_url").eq("bracket_id", bracketId).order("goals", { ascending: false }),
    supabase.from("cards").select("yellow, red").eq("bracket_id", bracketId),
    supabase.from("motm").select("player, team, image_url").eq("bracket_id", bracketId),
    getBracketTeamLogos(supabase, bracketId),
    getBracketRosterTeams(supabase, bracketId),
  ]);

  const finished = (matches || []).filter((m) => m.status === "انتهت");
  if (finished.length === 0 && !(goals || []).length && !(cards || []).length) {
    return <EmptyState message="لسه مفيش بيانات كفاية لعرض إحصائيات البطولة" />;
  }

  let totalGoals = 0;
  let draws00 = 0;
  let drawsPositive = 0;
  let wins = 0;
  const teamStats = new Map<string, TeamGoalStat>();
  const ensureTeam = (name: string) => {
    const key = normalize(name);
    if (!teamStats.has(key)) teamStats.set(key, { team: name, gf: 0, ga: 0 });
    return teamStats.get(key)!;
  };

  for (const m of finished) {
    const hg = Number(m.home_goals) || 0;
    const ag = Number(m.away_goals) || 0;
    totalGoals += hg + ag;
    if (hg === ag) {
      if (hg === 0) draws00++;
      else drawsPositive++;
    } else {
      wins++;
    }
    if (m.team_a) {
      const t = ensureTeam(m.team_a);
      t.gf += hg;
      t.ga += ag;
    }
    if (m.team_b) {
      const t = ensureTeam(m.team_b);
      t.gf += ag;
      t.ga += hg;
    }
  }

  const totalMatches = finished.length;
  const totalYellow = (cards || []).reduce((sum, c) => sum + (Number(c.yellow) || 0), 0);
  const totalRed = (cards || []).reduce((sum, c) => sum + (Number(c.red) || 0), 0);
  const goalsPerMatch = totalMatches > 0 ? (totalGoals / totalMatches).toFixed(1) : "0";

  const teams = Array.from(teamStats.values());
  const byAttack = [...teams].sort((a, b) => b.gf - a.gf);
  const byDefense = [...teams].sort((a, b) => a.ga - b.ga);
  const bestAttack = byAttack[0];
  const worstAttack = byAttack[byAttack.length - 1];
  const bestDefense = byDefense[0];
  const worstDefense = byDefense[byDefense.length - 1];

  const topScorer = (goals || [])[0] || null;
  const resolvePlayerPhoto = buildPlayerPhotoResolver(rosterTeams);
  const topScorerPhoto = topScorer ? topScorer.image_url || resolvePlayerPhoto(topScorer.team, topScorer.player) : null;

  const motmCounts = new Map<string, { player: string; team: string; count: number; image_url: string | null }>();
  for (const m of motm || []) {
    const player = String(m.player || "").trim();
    if (!player) continue;
    const key = `${normalize(player)}::${normalize(m.team || "")}`;
    if (!motmCounts.has(key)) motmCounts.set(key, { player, team: m.team || "", count: 0, image_url: m.image_url || null });
    motmCounts.get(key)!.count++;
  }
  const topMotm = [...motmCounts.values()].sort((a, b) => b.count - a.count)[0] || null;
  const topMotmPhoto = topMotm ? topMotm.image_url || resolvePlayerPhoto(topMotm.team, topMotm.player) : null;

  const winPct = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;
  const draw00Pct = totalMatches > 0 ? Math.round((draws00 / totalMatches) * 100) : 0;
  const drawPosPct = Math.max(0, 100 - winPct - draw00Pct);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-h3 font-black text-muted-foreground">نظرة عامة</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={<Trophy className="h-4 w-4 text-background" />} accent="bg-accent-blue" label="مباريات لعبت" value={totalMatches} />
          <StatCard icon={<Goal className="h-4 w-4 text-background" />} accent="bg-accent-green" label="إجمالي الأهداف" value={totalGoals} />
          <StatCard icon={<Swords className="h-4 w-4 text-background" />} accent="bg-accent-orange" label="معدل الأهداف/مباراة" value={goalsPerMatch} />
          <StatCard icon={<ShieldAlert className="h-4 w-4 text-background" />} accent="bg-destructive" label="إجمالي البطاقات" value={totalYellow + totalRed} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-h3 font-black text-muted-foreground">نتائج المباريات</h2>
        <div className="rounded-2xl bg-card p-4 ring-1 ring-white/10">
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-secondary">
            {winPct > 0 && <div className="h-full bg-accent-green" style={{ width: `${winPct}%` }} />}
            {drawPosPct > 0 && <div className="h-full bg-accent-orange" style={{ width: `${drawPosPct}%` }} />}
            {draw00Pct > 0 && <div className="h-full bg-white/20" style={{ width: `${draw00Pct}%` }} />}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-h3 font-black text-accent-green">{wins}</div>
              <div className="text-[11px] text-muted-foreground">مباريات حُسمت بالفوز</div>
            </div>
            <div>
              <div className="text-h3 font-black text-accent-orange">{drawsPositive}</div>
              <div className="text-[11px] text-muted-foreground">تعادل إيجابي</div>
            </div>
            <div>
              <div className="text-h3 font-black text-muted-foreground">{draws00}</div>
              <div className="text-[11px] text-muted-foreground">تعادل سلبي (0-0)</div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-h3 font-black text-muted-foreground">البطاقات</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-3 rounded-2xl bg-card p-4 ring-1 ring-white/10">
            <span className="text-3xl">🟨</span>
            <div>
              <div className="text-h3 font-black">{totalYellow}</div>
              <div className="text-[11px] text-muted-foreground">بطاقة صفراء</div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-card p-4 ring-1 ring-white/10">
            <span className="text-3xl">🟥</span>
            <div>
              <div className="text-h3 font-black">{totalRed}</div>
              <div className="text-[11px] text-muted-foreground">بطاقة حمراء</div>
            </div>
          </div>
        </div>
      </section>

      {teams.length > 0 && (
        <section>
          <h2 className="mb-3 text-h3 font-black text-muted-foreground">أقوى وأضعف الفرق</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <TeamStatCard title="أقوى هجوم" icon={<Swords className="h-5 w-5 text-background" />} accent="bg-accent-green" team={bestAttack.team} value={bestAttack.gf} unit="هدف" logoUrl={lookupTeamLogo(logos, bestAttack.team)} />
            <TeamStatCard title="أضعف هجوم" icon={<TrendingDown className="h-5 w-5 text-background" />} accent="bg-white/10" team={worstAttack.team} value={worstAttack.gf} unit="هدف" logoUrl={lookupTeamLogo(logos, worstAttack.team)} />
            <TeamStatCard title="أقوى دفاع" icon={<Shield className="h-5 w-5 text-background" />} accent="bg-accent-blue" team={bestDefense.team} value={bestDefense.ga} unit="هدف استقبلها" logoUrl={lookupTeamLogo(logos, bestDefense.team)} />
            <TeamStatCard title="أضعف دفاع" icon={<ShieldAlert className="h-5 w-5 text-background" />} accent="bg-destructive" team={worstDefense.team} value={worstDefense.ga} unit="هدف استقبلها" logoUrl={lookupTeamLogo(logos, worstDefense.team)} />
          </div>
        </section>
      )}

      {(topScorer || topMotm) && (
        <section>
          <h2 className="mb-3 text-h3 font-black text-muted-foreground">أبطال البطولة</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {topScorer && (
              <SpotlightCard label="هداف البطولة" icon={<Goal className="h-4 w-4" />} name={topScorer.player} team={topScorer.team} value={topScorer.goals} valueLabel="هدف" photoUrl={topScorerPhoto} />
            )}
            {topMotm && (
              <SpotlightCard label="الأكثر حصولاً على نجم المباراة" icon={<Star className="h-4 w-4" />} name={topMotm.player} team={topMotm.team} value={topMotm.count} valueLabel="مرة" photoUrl={topMotmPhoto} />
            )}
          </div>
        </section>
      )}
    </div>
  );
}

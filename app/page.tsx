import Link from "next/link";
import { Trophy, Radio, ShoppingBag, IdCard, ArrowLeft } from "lucide-react";
import { createPublicClient } from "@/lib/supabase/public";
import { MatchCard } from "@/components/sport/match-card";
import { NewsTicker } from "@/components/home/news-ticker";
import { NewsSection } from "@/components/home/news-section";
import { SponsorsMarquee } from "@/components/home/sponsors-marquee";
import { TOURNAMENTS, type TournamentSlug } from "@/lib/sport/tournaments";

export const revalidate = 15;

const TOURNAMENT_CARDS = [
  { href: "/matrouh-cup", title: "كأس مطروح", subtitle: "البطولة الرئيسية", icon: "🏆" },
  { href: "/elite-cup", title: "كأس النخبة", subtitle: "بطولة النخبة", icon: "⭐" },
  { href: "/ramadan-cup", title: "بطولة حزب الشعب الجمهوري", subtitle: "البطولة الرمضانية", icon: "🌙" },
];

function resolveTournamentLink(suffix: string): { href: string; label: string } | null {
  for (const slug of Object.keys(TOURNAMENTS) as TournamentSlug[]) {
    const config = TOURNAMENTS[slug];
    const edition = config.editions.find((e) => e.suffix === suffix);
    if (edition) {
      const qs = edition.key !== config.defaultEdition ? `?edition=${edition.key}` : "";
      return { href: `/${slug}${qs}`, label: config.editions.length > 1 ? `${config.label} — ${edition.label}` : config.label };
    }
  }
  return null;
}

async function getTicker() {
  const supabase = createPublicClient();
  const { data } = await supabase.from("app_settings").select("value").eq("key", "ticker").maybeSingle();
  return ((data?.value as any)?.text as string) || "";
}

async function getNews() {
  const supabase = createPublicClient();
  const { data } = await supabase.from("media").select("id, type, title, url, image_url, body").order("created_at", { ascending: false }).limit(6);
  return data || [];
}

async function getLiveMatches() {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("matches")
    .select("*, brackets(legacy_suffix)")
    .eq("is_live", true)
    .order("match_date", { ascending: true });
  return data || [];
}

async function getUpcomingMatch() {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("matches")
    .select("*, brackets(legacy_suffix)")
    .eq("is_live", false)
    .neq("status", "انتهت")
    .order("match_date", { ascending: true })
    .order("match_time", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data || null;
}

export default async function NewHomePage() {
  const [ticker, liveMatches, news] = await Promise.all([getTicker(), getLiveMatches(), getNews()]);
  const upcomingMatch = liveMatches.length === 0 ? await getUpcomingMatch() : null;

  return (
    <main dir="rtl" className="min-h-screen">
      <NewsTicker text={ticker} />

      <section className="mx-auto max-w-5xl px-4 pb-10 pt-12 text-center sm:px-6">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary shadow-[0_0_30px_rgba(75,22,144,0.5)]">
          <Trophy className="h-8 w-8 text-primary-foreground" />
        </div>
        <h1 className="text-display font-black">مطروح الرياضية</h1>
        <p className="mx-auto mt-2 max-w-md text-body font-medium text-muted-foreground">
          كل البطولات، النتائج، والإحصائيات في مكان واحد
        </p>
      </section>

      {liveMatches.length > 0 && (
        <section className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="mb-3 flex items-center gap-1.5 text-caption font-bold text-destructive">
            <Radio className="h-3.5 w-3.5 animate-pulse" />
            <span>مباريات جارية الآن ({liveMatches.length})</span>
          </div>
          <div className={`grid gap-4 ${liveMatches.length > 1 ? "sm:grid-cols-2 lg:grid-cols-3" : "mx-auto max-w-md"}`}>
            {liveMatches.map((match: any) => {
              const link = resolveTournamentLink(match.brackets?.legacy_suffix ?? "");
              const card = (
                <MatchCard
                  teamA={match.team_a}
                  teamALogo={match.team_a_logo}
                  teamB={match.team_b}
                  teamBLogo={match.team_b_logo}
                  homeGoals={match.home_goals}
                  awayGoals={match.away_goals}
                  status={match.status}
                  matchDate={match.match_date}
                  matchTime={match.match_time}
                  round={link?.label || match.round}
                  isLive={match.is_live}
                  liveMinute={match.live_minute}
                  className={link ? "transition-all hover:-translate-y-0.5 hover:ring-destructive/40" : undefined}
                />
              );
              return link ? (
                <Link key={match.id} href={link.href}>{card}</Link>
              ) : (
                <div key={match.id}>{card}</div>
              );
            })}
          </div>
        </section>
      )}

      {!liveMatches.length && upcomingMatch && (
        <section className="mx-auto max-w-md px-4 sm:px-6">
          <div className="mb-2 flex items-center gap-1.5 text-caption font-bold text-accent-orange">
            <Radio className="h-3.5 w-3.5" />
            <span>المباراة القادمة</span>
          </div>
          <MatchCard
            teamA={upcomingMatch.team_a}
            teamALogo={upcomingMatch.team_a_logo}
            teamB={upcomingMatch.team_b}
            teamBLogo={upcomingMatch.team_b_logo}
            homeGoals={upcomingMatch.home_goals}
            awayGoals={upcomingMatch.away_goals}
            status={upcomingMatch.status}
            matchDate={upcomingMatch.match_date}
            matchTime={upcomingMatch.match_time}
            round={resolveTournamentLink(upcomingMatch.brackets?.legacy_suffix ?? "")?.label || upcomingMatch.round}
            isLive={upcomingMatch.is_live}
            liveMinute={upcomingMatch.live_minute}
          />
        </section>
      )}

      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <h2 className="mb-5 text-h2 font-black">اختر البطولة</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {TOURNAMENT_CARDS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="group rounded-2xl bg-card p-6 text-center ring-1 ring-white/10 transition-all hover:-translate-y-1 hover:ring-accent-blue/50"
            >
              <div className="text-4xl">{t.icon}</div>
              <div className="mt-3 text-h3 font-black">{t.title}</div>
              <div className="mt-1 text-caption text-muted-foreground">{t.subtitle}</div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-3 px-4 pb-4 sm:grid-cols-2 sm:px-6">
        <Link
          href="/shop"
          className="group flex items-center justify-between rounded-2xl bg-gradient-to-l from-primary/20 to-primary/5 p-5 ring-1 ring-primary/30 transition-all hover:ring-primary/60"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary">
              <ShoppingBag className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <div className="text-body font-black">المتجر الرياضي</div>
              <div className="text-caption text-muted-foreground">تيشرتات، كابات، ومنتجات رسمية</div>
            </div>
          </div>
          <ArrowLeft className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-1" />
        </Link>

        <Link
          href="/player-card"
          className="group flex items-center justify-between rounded-2xl bg-gradient-to-l from-accent-blue/20 to-accent-blue/5 p-5 ring-1 ring-accent-blue/30 transition-all hover:ring-accent-blue/60"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-blue">
              <IdCard className="h-5 w-5 text-background" />
            </div>
            <div>
              <div className="text-body font-black">تسجيل كارت اللاعب</div>
              <div className="text-caption text-muted-foreground">اعمل بطاقتك التعريفية الرسمية</div>
            </div>
          </div>
          <ArrowLeft className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-1" />
        </Link>
      </section>

      <NewsSection items={news} />

      <SponsorsMarquee />
    </main>
  );
}

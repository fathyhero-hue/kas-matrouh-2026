"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Radio } from "lucide-react";
import {
  formatCairoMatchDateTime,
  getLiveMinute,
  type HomeMatchSections,
  type ScheduledMatchWithKickoff,
} from "@/lib/sport/home-match-schedule";

type BroadcastMatch = HomeMatchSections["broadcastMatches"][number];
type HomeMatchesResponse = HomeMatchSections & { updatedAt: string };

async function fetchHomeMatches(): Promise<HomeMatchesResponse> {
  const response = await fetch("/api/home/matches", { cache: "no-store" });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
      ? payload.error
      : "تعذر تحميل مواعيد المباريات.";
    throw new Error(message);
  }
  if (!payload || typeof payload !== "object" ||
    !("broadcastMatches" in payload) || !Array.isArray(payload.broadcastMatches) ||
    !("upcomingMatches" in payload) || !Array.isArray(payload.upcomingMatches) ||
    !("updatedAt" in payload) || typeof payload.updatedAt !== "string") {
    throw new Error("استجابة مواعيد المباريات غير صالحة.");
  }
  return payload as HomeMatchesResponse;
}

function Team({ name, logo, goals }: { name: string; logo: string | null; goals?: number | null }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
      {logo
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={logo} alt="" className="h-12 w-12 rounded-full object-contain sm:h-14 sm:w-14" />
        : <div className="h-12 w-12 rounded-full bg-secondary sm:h-14 sm:w-14" />}
      <span className="line-clamp-2 text-sm font-black">{name}</span>
      {goals !== undefined && <span className="text-h2 font-black tabular-nums">{goals ?? 0}</span>}
    </div>
  );
}

function MatchLink({ match, children }: { match: ScheduledMatchWithKickoff; children: React.ReactNode }) {
  if (!match.tournament_href) return <div>{children}</div>;
  return <Link href={match.tournament_href} className="block">{children}</Link>;
}

function MatchDetails({ match }: { match: ScheduledMatchWithKickoff }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-1 text-xs font-bold text-muted-foreground">
      <span>{match.tournament_label}</span>
      <span>{formatCairoMatchDateTime(match.match_date, match.match_time)}</span>
      {match.venue && <span className="basis-full">{match.venue}</span>}
    </div>
  );
}

function Countdown({ kickoffAt, now }: { kickoffAt: string; now: number }) {
  const seconds = Math.max(0, Math.floor((Date.parse(kickoffAt) - now) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return (
    <span className="tabular-nums" dir="ltr">
      {hours > 0 ? `${hours}:` : ""}{String(minutes).padStart(hours > 0 ? 2 : 1, "0")}:{String(remainder).padStart(2, "0")}
    </span>
  );
}

function BroadcastCard({ match, now }: { match: BroadcastMatch; now: number }) {
  const live = match.broadcastState === "live";
  const status = live ? match.status || "مباشر" : "تبدأ قريبًا";
  return (
    <MatchLink match={match}>
      <article className="rounded-2xl bg-card p-4 ring-1 ring-white/10">
        <MatchDetails match={match} />
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <Team name={match.team_a} logo={match.team_a_logo} goals={live ? match.home_goals : undefined} />
          <div className="min-w-20 text-center">
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black ${live ? "bg-destructive/15 text-destructive" : "bg-accent-orange/15 text-accent-orange"}`}>
              {live && <Radio className="h-3.5 w-3.5 animate-pulse" />}
              {status}
            </span>
            {!live && <div className="mt-2 text-lg font-black"><Countdown kickoffAt={match.kickoffAt} now={now} /></div>}
            {live && (
              <div className="mt-2 text-xs font-bold text-muted-foreground">
                {match.round || "مباراة"} · {getLiveMinute(match, new Date(now))}′
              </div>
            )}
          </div>
          <Team name={match.team_b} logo={match.team_b_logo} goals={live ? match.away_goals : undefined} />
        </div>
        {live && (
          <div className="mt-3 border-t border-white/10 pt-3">
            {match.events?.length ? (
              <ul className="space-y-2" aria-label="أحداث المباراة">
                {match.events.map((event) => (
                  <li key={`${event.event_type}-${event.id}`} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className={`font-black ${event.event_type === "goal" ? "text-accent-orange" : event.event_type === "yellow" ? "text-yellow-400" : "text-destructive"}`}>
                      {event.event_type === "goal" ? "هدف" : event.event_type === "yellow" ? "إنذار" : event.event_type === "direct_red" ? "طرد مباشر" : "طرد بعد الإنذار الثاني"}
                      {" · "}{event.player_name} · {event.team_name}
                    </span>
                    <span className="font-bold tabular-nums text-muted-foreground">
                      {event.match_minute === null ? "الدقيقة غير مسجلة" : `${event.match_minute}′`}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-center text-xs text-muted-foreground">لا توجد أحداث مسجلة للمباراة حتى الآن.</p>
            )}
          </div>
        )}
      </article>
    </MatchLink>
  );
}

function UpcomingCard({ match }: { match: ScheduledMatchWithKickoff }) {
  return (
    <MatchLink match={match}>
      <article className="rounded-2xl bg-card p-4 ring-1 ring-white/10 transition hover:ring-accent-blue/40">
        <MatchDetails match={match} />
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <Team name={match.team_a} logo={match.team_a_logo} />
          <span className="text-xl font-black text-muted-foreground">VS</span>
          <Team name={match.team_b} logo={match.team_b_logo} />
        </div>
      </article>
    </MatchLink>
  );
}

export function LiveMatchSections() {
  const [matches, setMatches] = useState<HomeMatchesResponse | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const result = await fetchHomeMatches();
        if (!cancelled) {
          setMatches(result);
          setError("");
        }
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "تعذر تحميل مواعيد المباريات.");
      }
    };
    void refresh();
    const poll = window.setInterval(() => void refresh(), 15_000);
    const clock = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
      window.clearInterval(clock);
    };
  }, []);

  if (error && !matches) return <p role="alert" className="mx-auto max-w-5xl px-4 text-sm font-bold text-destructive sm:px-6">{error}</p>;
  if (!matches) return <p className="mx-auto max-w-5xl px-4 text-center text-sm text-muted-foreground sm:px-6">جارٍ تحميل مواعيد المباريات...</p>;

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 sm:px-6">
      <section aria-labelledby="live-broadcast-heading">
        <div className="mb-3 flex items-center gap-2 text-caption font-black text-destructive">
          <Radio className="h-4 w-4 animate-pulse" />
          <h2 id="live-broadcast-heading" className="text-h3">البث المباشر</h2>
        </div>
        {matches.broadcastMatches.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {matches.broadcastMatches.map((match) => <BroadcastCard key={match.id} match={match} now={now} />)}
          </div>
        ) : (
          <p className="rounded-xl bg-card p-5 text-center text-sm text-muted-foreground ring-1 ring-white/10">
            لا توجد مباريات مباشرة أو تبدأ خلال الساعتين القادمتين.
          </p>
        )}
      </section>

      <section aria-labelledby="upcoming-matches-heading">
        <h2 id="upcoming-matches-heading" className="mb-3 text-h3 font-black">المباريات القادمة</h2>
        {matches.upcomingMatches.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {matches.upcomingMatches.map((match) => <UpcomingCard key={match.id} match={match} />)}
          </div>
        ) : (
          <p className="rounded-xl bg-card p-5 text-center text-sm text-muted-foreground ring-1 ring-white/10">
            لا توجد مباريات قادمة بموعد مؤكد حاليًا.
          </p>
        )}
        {error && <p role="alert" className="mt-2 text-sm font-bold text-destructive">{error}</p>}
      </section>
    </div>
  );
}

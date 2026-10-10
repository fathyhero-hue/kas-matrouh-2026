"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Pause, Play, Radio, Square } from "lucide-react";
import { LiveMatchEvents } from "@/components/admin/live-match-events";
import { formatCairoMatchDateTime, getLiveMinute, type LiveMatchAction } from "@/lib/sport/home-match-schedule";

type LiveMatchRow = {
  id: string;
  bracket_id: string;
  tournament: string;
  team_a: string;
  team_a_logo: string | null;
  team_b: string;
  team_b_logo: string | null;
  match_date: string | null;
  match_time: string | null;
  venue: string | null;
  status: string | null;
  is_live: boolean | null;
  home_goals: number | null;
  away_goals: number | null;
  live_events_enabled: boolean;
  live_event_base_home_goals: number | null;
  live_event_base_away_goals: number | null;
  live_minute: number | null;
  live_minute_base: number | null;
  timer_started_at: string | null;
  timer_paused_total: number | null;
  is_timer_running: boolean | null;
};

type LiveResponse = { matches: LiveMatchRow[]; updatedAt: string; canCorrectScore: boolean };

function isOfficiallyLive(match: LiveMatchRow) {
  return match.is_live === true ||
    ["الشوط الأول", "استراحة", "الشوط الثاني", "ضربات جزاء"].includes(match.status || "");
}

function getAction(match: LiveMatchRow): { action: LiveMatchAction; label: string; icon: typeof Play }[] {
  if (match.status === "لم تبدأ" || match.status === "ستبدأ بعد قليل") {
    return [{ action: "start", label: "بدء المباراة", icon: Play }];
  }
  if (match.status === "الشوط الأول" && isOfficiallyLive(match)) {
    return [{ action: "halftime", label: "استراحة", icon: Pause }, { action: "finish", label: "إنهاء المباراة", icon: Square }];
  }
  if (match.status === "استراحة" && isOfficiallyLive(match)) {
    return [{ action: "resume", label: "استئناف المباراة", icon: Play }, { action: "finish", label: "إنهاء المباراة", icon: Square }];
  }
  if (["الشوط الثاني", "ضربات جزاء"].includes(match.status || "") && isOfficiallyLive(match)) {
    return [{ action: "finish", label: "إنهاء المباراة", icon: Square }];
  }
  return [];
}

async function getMatches(): Promise<LiveResponse> {
  const response = await fetch("/api/admin/live", { cache: "no-store" });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload &&
      typeof payload.error === "string" ? payload.error : "تعذر تحميل المباريات.";
    throw new Error(message);
  }
  if (!payload || typeof payload !== "object" || !("matches" in payload) ||
    !Array.isArray(payload.matches) || !("updatedAt" in payload) || typeof payload.updatedAt !== "string" ||
    !("canCorrectScore" in payload) || typeof payload.canCorrectScore !== "boolean") {
    throw new Error("استجابة قائمة المباريات غير صالحة.");
  }
  return payload as LiveResponse;
}

export function LiveMatchManager() {
  const [matches, setMatches] = useState<LiveMatchRow[]>([]);
  const [bracketId, setBracketId] = useState("all");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [canCorrectScore, setCanCorrectScore] = useState(false);
  const [correctingMatch, setCorrectingMatch] = useState<LiveMatchRow | null>(null);
  const [correctedHomeGoals, setCorrectedHomeGoals] = useState("");
  const [correctedAwayGoals, setCorrectedAwayGoals] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [correctionSaving, setCorrectionSaving] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const result = await getMatches();
        if (!cancelled) {
          setMatches(result.matches);
          setCanCorrectScore(result.canCorrectScore);
          setError("");
        }
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "تعذر تحميل المباريات.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15_000);
    const clock = window.setInterval(() => setNow(new Date()), 1_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.clearInterval(clock);
    };
  }, []);

  const brackets = useMemo(() => [...new Map(matches.map((match) =>
    [match.bracket_id, match.tournament],
  )).entries()], [matches]);

  const visible = useMemo(() => matches
    .filter((match) => bracketId === "all" || match.bracket_id === bracketId)
    .filter((match) => !date || match.match_date === date)
    .sort((left, right) => {
      const leftPriority = isOfficiallyLive(left) ? 0 : 1;
      const rightPriority = isOfficiallyLive(right) ? 0 : 1;
      if (leftPriority !== rightPriority) return leftPriority - rightPriority;
      return `${left.match_date || ""}T${left.match_time || ""}`.localeCompare(`${right.match_date || ""}T${right.match_time || ""}`);
    }), [matches, bracketId, date]);

  const transition = async (match: LiveMatchRow, action: LiveMatchAction) => {
    setSavingId(match.id);
    try {
      const response = await fetch("/api/admin/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: match.id, action }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload && typeof payload === "object" && "error" in payload &&
          typeof payload.error === "string" ? payload.error : "تعذر تحديث حالة المباراة.";
        throw new Error(message);
      }
      const result = await getMatches();
      setMatches(result.matches);
      setCanCorrectScore(result.canCorrectScore);
      toast.success("تم تحديث حالة المباراة.");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "تعذر تحديث حالة المباراة.");
    } finally {
      setSavingId("");
    }
  };

  const refreshMatchList = async () => {
    try {
      const result = await getMatches();
      setMatches(result.matches);
      setCanCorrectScore(result.canCorrectScore);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "تعذر تحديث نتيجة المباراة.");
    }
  };

  const openScoreCorrection = (match: LiveMatchRow) => {
    setCorrectedHomeGoals(String(match.live_event_base_home_goals ?? ""));
    setCorrectedAwayGoals(String(match.live_event_base_away_goals ?? ""));
    setCorrectionReason("");
    setCorrectingMatch(match);
  };

  const correctScore = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!correctingMatch) return;
    const homeGoals = Number(correctedHomeGoals);
    const awayGoals = Number(correctedAwayGoals);
    const reason = correctionReason.trim();
    if (!Number.isSafeInteger(homeGoals) || homeGoals < 0 ||
      !Number.isSafeInteger(awayGoals) || awayGoals < 0 || !reason || reason.length > 1000) {
      toast.error("أدخل نتيجة غير سالبة وسببًا للتصحيح.");
      return;
    }

    setCorrectionSaving(true);
    try {
      const response = await fetch("/api/admin/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId: correctingMatch.id,
          action: "correct_score",
          homeGoals,
          awayGoals,
          reason,
        }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload && typeof payload === "object" && "error" in payload &&
          typeof payload.error === "string" ? payload.error : "تعذر تصحيح النتيجة.";
        throw new Error(message);
      }
      const result = await getMatches();
      setMatches(result.matches);
      setCanCorrectScore(result.canCorrectScore);
      setCorrectingMatch(null);
      toast.success("تم تصحيح رصيد النتيجة وإعادة احتساب الأهداف النشطة.");
    } catch (reasonError) {
      toast.error(reasonError instanceof Error ? reasonError.message : "تعذر تصحيح النتيجة.");
    } finally {
      setCorrectionSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-h1 font-black"><Radio className="h-6 w-6 text-destructive" />البث المباشر</h1>
        <p className="mt-1 text-caption text-muted-foreground">إدارة حالة المباراة وأحداثها يدويًا. قرب موعد المباراة لا يبدأها تلقائيًا.</p>
      </header>

      <section className="grid gap-3 rounded-xl bg-card p-4 ring-1 ring-white/10 sm:grid-cols-2" aria-label="تصفية المباريات">
        <select value={bracketId} onChange={(event) => setBracketId(event.target.value)}
          className="h-11 rounded-lg bg-secondary px-3 text-sm font-bold">
          <option value="all">كل البطولات</option>
          {brackets.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm font-bold">
          التاريخ
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)}
            className="h-11 flex-1 rounded-lg bg-secondary px-3" />
        </label>
      </section>

      {error && <p role="alert" className="rounded-xl bg-destructive/10 p-4 text-sm font-bold text-destructive">{error}</p>}
      {loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">جارٍ تحميل المباريات...</p>
      ) : visible.length === 0 ? (
        <p className="rounded-xl bg-card p-6 text-center text-sm text-muted-foreground">لا توجد مباريات مطابقة.</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {visible.map((match) => (
            <article key={match.id} className="rounded-xl bg-card p-4 ring-1 ring-white/10">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-accent-blue">{match.tournament}</span>
                <span className="text-xs text-muted-foreground">{formatCairoMatchDateTime(match.match_date, match.match_time)}</span>
                {match.venue && <span className="basis-full text-xs text-muted-foreground">{match.venue}</span>}
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <span className="text-center text-sm font-black">{match.team_a}</span>
                <strong className="text-xl tabular-nums">{match.home_goals ?? 0} - {match.away_goals ?? 0}</strong>
                <span className="text-center text-sm font-black">{match.team_b}</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
                <span className={`text-xs font-black ${isOfficiallyLive(match) ? "text-destructive" : "text-muted-foreground"}`}>
                  {match.status || "حالة غير محددة"}{isOfficiallyLive(match) ? ` · ${getLiveMinute(match, now)}'` : ""}
                </span>
                <div className="flex flex-wrap gap-2">
                  {getAction(match).map(({ action, label, icon: Icon }) => (
                    <button key={action} type="button" onClick={() => void transition(match, action)}
                      disabled={savingId === match.id}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-black text-primary-foreground disabled:opacity-50">
                      <Icon className="h-3.5 w-3.5" />{savingId === match.id ? "جارٍ الحفظ..." : label}
                    </button>
                  ))}
                  {canCorrectScore && match.live_events_enabled && (
                    <button type="button" onClick={() => openScoreCorrection(match)}
                      className="h-9 rounded-lg border border-amber-500/50 px-3 text-xs font-black text-amber-300">
                      تصحيح النتيجة
                    </button>
                  )}
                </div>
              </div>
              <LiveMatchEvents matchId={match.id} onMatchUpdated={() => void refreshMatchList()} />
            </article>
          ))}
        </div>
      )}
      {correctingMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <form onSubmit={correctScore} role="dialog" aria-modal="true" aria-labelledby="score-correction-title"
            className="w-full max-w-md space-y-4 rounded-2xl bg-card p-5 shadow-2xl ring-1 ring-white/15">
            <div>
              <h2 id="score-correction-title" className="text-lg font-black">تصحيح رصيد النتيجة الأساسي</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {correctingMatch.team_a} × {correctingMatch.team_b}. ستبقى أحداث الأهداف كما هي وتُعاد إضافة الأهداف النشطة.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1 text-xs font-bold">{correctingMatch.team_a}
                <input type="number" min={0} step={1} required value={correctedHomeGoals}
                  onChange={(event) => setCorrectedHomeGoals(event.target.value)}
                  className="h-11 w-full rounded-lg bg-secondary px-3 text-center text-lg" />
              </label>
              <label className="space-y-1 text-xs font-bold">{correctingMatch.team_b}
                <input type="number" min={0} step={1} required value={correctedAwayGoals}
                  onChange={(event) => setCorrectedAwayGoals(event.target.value)}
                  className="h-11 w-full rounded-lg bg-secondary px-3 text-center text-lg" />
              </label>
            </div>
            <label className="block space-y-1 text-xs font-bold">سبب التصحيح
              <textarea required maxLength={1000} value={correctionReason}
                onChange={(event) => setCorrectionReason(event.target.value)}
                className="min-h-24 w-full rounded-lg bg-secondary p-3 text-sm" />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCorrectingMatch(null)} disabled={correctionSaving}
                className="h-10 rounded-lg bg-secondary px-4 text-sm font-bold disabled:opacity-50">إلغاء</button>
              <button type="submit" disabled={correctionSaving}
                className="h-10 rounded-lg bg-amber-600 px-4 text-sm font-black text-white disabled:opacity-50">
                {correctionSaving ? "جارٍ التصحيح..." : "حفظ التصحيح"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

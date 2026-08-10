"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Edit, Trash2, Play, Pause, Search } from "lucide-react";

type Match = {
  id: string;
  bracket_id: string;
  team_a: string;
  team_a_logo: string | null;
  team_b: string;
  team_b_logo: string | null;
  home_goals: number;
  away_goals: number;
  home_penalty_goals: number;
  away_penalty_goals: number;
  round: string;
  stage: string;
  match_date: string;
  match_time: string;
  status: string;
  day_name: string | null;
  is_live: boolean;
  live_minute: number;
  live_minute_base: number;
  timer_started_at: string | null;
  timer_paused_total: number;
  is_timer_running: boolean;
};

const ROUNDS = ["دور المجموعات", "دور الأربعة", "نصف النهائي", "دور الـ 16", "دور الثمانية", "دور الـ 4", "النهائي"];
const STATUSES = ["لم تبدأ", "ستبدأ بعد قليل", "الشوط الأول", "استراحة", "الشوط الثاني", "ضربات جزاء", "انتهت", "تأجلت", "ملغاة"];

const DAY_NAMES = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function emptyForm(bracketId: string) {
  return {
    bracket_id: bracketId,
    team_a: "",
    team_a_logo: "",
    team_b: "",
    team_b_logo: "",
    home_goals: 0,
    away_goals: 0,
    home_penalty_goals: 0,
    away_penalty_goals: 0,
    round: "دور المجموعات",
    status: "لم تبدأ",
    match_date: new Date().toISOString().slice(0, 10),
    match_time: "15:30",
  };
}

function getAccurateLiveMinute(m: Match, now: number) {
  const base = Number(m.live_minute_base ?? m.live_minute ?? 0) || 0;
  const startedAt = m.timer_started_at ? new Date(m.timer_started_at).getTime() : 0;
  const pausedTotal = Number(m.timer_paused_total || 0) || 0;
  if (!m.is_timer_running || !startedAt) return Number(m.live_minute ?? base) || 0;
  const elapsed = Math.max(0, now - startedAt - pausedTotal);
  return base + Math.floor(elapsed / 60000);
}

const inputCls = "h-10 w-full rounded-lg bg-secondary px-3 text-caption font-bold outline-none ring-1 ring-white/10 focus:ring-accent-blue";

export function MatchesManager({ bracketId, initialMatches }: { bracketId: string; initialMatches: Match[] }) {
  const [matches, setMatches] = useState<Match[]>(initialMatches);
  const [form, setForm] = useState<any>(emptyForm(bracketId));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setMatches(initialMatches);
    setForm(emptyForm(bracketId));
    setEditingId(null);
  }, [bracketId]); // eslint-disable-line react-hooks/exhaustive-deps

  const patchLocal = (id: string, patch: Partial<Match>) => {
    setMatches((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };

  const saveApi = async (id: string | undefined, patch: any) => {
    const res = await fetch("/api/admin/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(id ? { id, ...patch } : patch),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || "فشلت العملية");
    return data.match as Match;
  };

  const submitForm = async () => {
    if (!form.team_a.trim() || !form.team_b.trim()) return toast.error("يجب إدخال أسماء الفرق!");
    setSaving(true);
    try {
      const dayName = DAY_NAMES[new Date(form.match_date).getDay()];
      const stage = form.round === "دور المجموعات" ? "group" : "knockout";
      const payload = { ...form, day_name: dayName, stage };
      const saved = await saveApi(editingId || undefined, payload);
      if (editingId) {
        patchLocal(editingId, saved);
        toast.success("تم تعديل بيانات المباراة بنجاح");
      } else {
        setMatches((prev) => [saved, ...prev]);
        toast.success("تم إضافة المباراة بنجاح");
      }
      setForm(emptyForm(bracketId));
      setEditingId(null);
    } catch (e: any) {
      toast.error(e?.message || "فشل حفظ المباراة");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (m: Match) => {
    setEditingId(m.id);
    setForm({
      bracket_id: m.bracket_id,
      team_a: m.team_a,
      team_a_logo: m.team_a_logo || "",
      team_b: m.team_b,
      team_b_logo: m.team_b_logo || "",
      home_goals: m.home_goals || 0,
      away_goals: m.away_goals || 0,
      home_penalty_goals: m.home_penalty_goals || 0,
      away_penalty_goals: m.away_penalty_goals || 0,
      round: m.round || "دور المجموعات",
      status: m.status || "لم تبدأ",
      match_date: m.match_date,
      match_time: m.match_time?.slice(0, 5) || "15:30",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm(bracketId));
  };

  const quickUpdate = async (m: Match, updates: Partial<Match>) => {
    const nextUpdates: any = { ...updates };
    if (Object.prototype.hasOwnProperty.call(nextUpdates, "is_timer_running")) {
      if (nextUpdates.is_timer_running) {
        const base = getAccurateLiveMinute(m, now);
        nextUpdates.live_minute = base;
        nextUpdates.live_minute_base = base;
        nextUpdates.timer_started_at = new Date().toISOString();
        nextUpdates.timer_paused_total = 0;
      } else {
        const paused = getAccurateLiveMinute(m, now);
        nextUpdates.live_minute = paused;
        nextUpdates.live_minute_base = paused;
        nextUpdates.timer_started_at = null;
        nextUpdates.timer_paused_total = 0;
      }
    } else if (Object.prototype.hasOwnProperty.call(nextUpdates, "live_minute") && m.is_timer_running) {
      nextUpdates.live_minute_base = Number(nextUpdates.live_minute) || 0;
      nextUpdates.timer_started_at = new Date().toISOString();
      nextUpdates.timer_paused_total = 0;
    }

    patchLocal(m.id, nextUpdates);
    try {
      await saveApi(m.id, nextUpdates);
    } catch (e: any) {
      toast.error(e?.message || "فشل تحديث المباراة");
    }
  };

  const deleteMatch = async (id: string) => {
    if (!confirm("متأكد من حذف هذه المباراة نهائياً؟")) return;
    try {
      const res = await fetch(`/api/admin/matches?id=${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "فشل الحذف");
      setMatches((prev) => prev.filter((m) => m.id !== id));
      toast.success("تم حذف المباراة");
    } catch (e: any) {
      toast.error(e?.message || "فشل حذف المباراة");
    }
  };

  const isKnockout = (m: { round: string; stage?: string }) => m.stage === "knockout" || m.round !== "دور المجموعات";
  const showPenalty = (m: Match) => Number(m.home_goals) === Number(m.away_goals) && isKnockout(m);

  const grouped = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = term ? matches.filter((m) => m.team_a?.toLowerCase().includes(term) || m.team_b?.toLowerCase().includes(term)) : matches;
    const byRound = new Map<string, Match[]>();
    filtered.forEach((m) => {
      const key = m.round || "دور المجموعات";
      if (!byRound.has(key)) byRound.set(key, []);
      byRound.get(key)!.push(m);
    });
    return Array.from(byRound.entries());
  }, [matches, search]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-card p-4 ring-1 ring-white/10 sm:p-5">
        <h2 className="mb-4 text-h3 font-black">{editingId ? "تعديل بيانات ونتيجة المباراة" : "إنشاء مباراة جديدة"}</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <input value={form.team_a} onChange={(e) => setForm({ ...form, team_a: e.target.value })} placeholder="الفريق الأول" className={inputCls} />
          <input type="number" value={form.home_goals} onChange={(e) => setForm({ ...form, home_goals: Number(e.target.value) })} className={`${inputCls} text-center text-h3 font-black text-accent-orange`} />
          <input type="number" value={form.away_goals} onChange={(e) => setForm({ ...form, away_goals: Number(e.target.value) })} className={`${inputCls} text-center text-h3 font-black text-accent-orange`} />
          <input value={form.team_b} onChange={(e) => setForm({ ...form, team_b: e.target.value })} placeholder="الفريق الثاني" className={inputCls} />
        </div>

        {form.round !== "دور المجموعات" && Number(form.home_goals) === Number(form.away_goals) && (
          <div className="mt-3 rounded-xl bg-accent-orange/10 p-3 ring-1 ring-accent-orange/30">
            <div className="mb-2 text-caption font-black text-accent-orange">ضربات الجزاء عند التعادل</div>
            <div className="grid grid-cols-2 gap-3">
              <input type="number" min={0} value={form.home_penalty_goals} onChange={(e) => setForm({ ...form, home_penalty_goals: Number(e.target.value) })} className={inputCls} placeholder="جزاء الفريق الأول" />
              <input type="number" min={0} value={form.away_penalty_goals} onChange={(e) => setForm({ ...form, away_penalty_goals: Number(e.target.value) })} className={inputCls} placeholder="جزاء الفريق الثاني" />
            </div>
          </div>
        )}

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input value={form.team_a_logo} onChange={(e) => setForm({ ...form, team_a_logo: e.target.value })} placeholder="رابط شعار الفريق الأول (اختياري)" dir="ltr" className={inputCls} />
          <input value={form.team_b_logo} onChange={(e) => setForm({ ...form, team_b_logo: e.target.value })} placeholder="رابط شعار الفريق الثاني (اختياري)" dir="ltr" className={inputCls} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <input type="date" value={form.match_date} onChange={(e) => setForm({ ...form, match_date: e.target.value })} className={inputCls} />
          <input type="time" value={form.match_time} onChange={(e) => setForm({ ...form, match_time: e.target.value })} className={`${inputCls} text-center`} />
          <select value={form.round} onChange={(e) => setForm({ ...form, round: e.target.value })} className={inputCls}>
            {ROUNDS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputCls}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="mt-4 flex gap-3">
          <button onClick={submitForm} disabled={saving} className="flex-1 rounded-xl bg-primary py-3 text-caption font-black text-primary-foreground disabled:opacity-60">
            {editingId ? "تأكيد وتحديث المباراة" : "حفظ وإضافة المباراة"}
          </button>
          {editingId && (
            <button onClick={cancelEdit} className="rounded-xl bg-white/5 px-5 py-3 text-caption font-black text-muted-foreground">
              إلغاء
            </button>
          )}
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالفريق..." className={`${inputCls} pr-9`} />
      </div>

      {grouped.length === 0 ? (
        <div className="rounded-2xl bg-card p-8 text-center text-caption text-muted-foreground ring-1 ring-white/10">لا توجد مباريات</div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([round, items]) => (
            <div key={round} className="space-y-3">
              <div className="sticky top-14 z-10 flex items-center justify-between rounded-xl bg-brand-dark/95 px-4 py-2 ring-1 ring-accent-blue/20 backdrop-blur">
                <span className="text-caption font-black text-accent-blue">{round}</span>
                <span className="rounded-full bg-accent-blue/15 px-2 py-0.5 text-[10px] font-black text-accent-blue">{items.length} مباراة</span>
              </div>
              {items.map((m) => (
                <div key={m.id} className={`overflow-hidden rounded-2xl ring-1 ${m.is_live ? "bg-red-950/20 ring-red-500/50" : "bg-card ring-white/10"}`}>
                  <div className={`flex items-center justify-between px-4 py-2 text-[10px] font-bold ${m.is_live ? "bg-red-600 text-white" : "bg-secondary text-muted-foreground"}`}>
                    <span>{m.day_name} • {m.match_date} • {m.match_time?.slice(0, 5)}</span>
                    {m.is_live && <span className="animate-pulse font-black">🔴 مباشر</span>}
                  </div>
                  <div className="grid grid-cols-1 gap-3 p-4 xl:grid-cols-2">
                    <div className="flex flex-col justify-between rounded-xl bg-secondary/60 p-3">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex-1 text-center text-caption font-black">{m.team_a}</div>
                        <div className="mx-2 rounded-lg bg-secondary px-4 py-1.5 text-center text-h3 font-black text-accent-orange">
                          {m.home_goals || 0} - {m.away_goals || 0}
                          {showPenalty(m) && (Number(m.home_penalty_goals) > 0 || Number(m.away_penalty_goals) > 0) && (
                            <div className="text-[10px] font-bold text-accent-orange/80">جزاء: {m.home_penalty_goals} - {m.away_penalty_goals}</div>
                          )}
                        </div>
                        <div className="flex-1 text-center text-caption font-black">{m.team_b}</div>
                      </div>
                      <div className="flex flex-wrap justify-center gap-2">
                        <button onClick={() => startEdit(m)} className="flex items-center gap-1 rounded-lg bg-accent-blue/15 px-3 py-1.5 text-[11px] font-black text-accent-blue">
                          <Edit className="h-3 w-3" /> تعديل
                        </button>
                        <button onClick={() => quickUpdate(m, { is_live: !m.is_live })} className={`rounded-lg px-3 py-1.5 text-[11px] font-black ${m.is_live ? "bg-red-500/20 text-red-400" : "bg-white/5 text-muted-foreground"}`}>
                          {m.is_live ? "إيقاف اللايف" : "تشغيل اللايف"}
                        </button>
                        <button onClick={() => quickUpdate(m, { status: "انتهت", is_live: false, is_timer_running: false })} className="rounded-lg bg-accent-green/15 px-3 py-1.5 text-[11px] font-black text-accent-green">
                          إنهاء
                        </button>
                        <button onClick={() => deleteMatch(m.id)} className="flex items-center gap-1 rounded-lg bg-red-500/15 px-3 py-1.5 text-[11px] font-black text-red-400">
                          <Trash2 className="h-3 w-3" /> حذف
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-2 rounded-xl bg-secondary/60 p-3">
                        <div className="text-[10px] font-bold text-muted-foreground">تعديل سريع للأهداف</div>
                        {[{ label: m.team_a, key: "home_goals", val: m.home_goals }, { label: m.team_b, key: "away_goals", val: m.away_goals }].map((g) => (
                          <div key={g.key} className="flex items-center justify-between gap-2">
                            <span className="flex-1 truncate text-[11px] text-muted-foreground">{g.label}</span>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <button onClick={() => quickUpdate(m, { [g.key]: Math.max(0, (g.val || 0) - 1) } as any)} className="h-6 w-6 rounded bg-red-500/15 font-black text-red-400">−</button>
                              <span className="w-4 text-center text-caption font-black">{g.val || 0}</span>
                              <button onClick={() => quickUpdate(m, { [g.key]: (g.val || 0) + 1 } as any)} className="h-6 w-6 rounded bg-accent-green/15 font-black text-accent-green">+</button>
                            </div>
                          </div>
                        ))}
                        <select value={m.status || "لم تبدأ"} onChange={(e) => quickUpdate(m, { status: e.target.value })} className="h-8 w-full rounded-lg bg-secondary px-2 text-[11px] font-bold ring-1 ring-white/10">
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2 rounded-xl bg-secondary/60 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-muted-foreground">العداد</span>
                          <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-black text-white" dir="ltr">{getAccurateLiveMinute(m, now)}'</span>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={m.live_minute || 0}
                            onChange={(e) => quickUpdate(m, { live_minute: parseInt(e.target.value) || 0 })}
                            className="h-8 w-16 rounded-lg bg-secondary text-center text-[11px] font-bold ring-1 ring-white/10"
                          />
                          <button
                            onClick={() => quickUpdate(m, { is_timer_running: !m.is_timer_running } as any)}
                            className={`flex flex-1 items-center justify-center gap-1 rounded-lg text-[11px] font-black ${m.is_timer_running ? "bg-red-500/20 text-red-400" : "bg-accent-green/15 text-accent-green"}`}
                          >
                            {m.is_timer_running ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                            {m.is_timer_running ? "إيقاف" : "تشغيل"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

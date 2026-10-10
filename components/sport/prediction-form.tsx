"use client";

import { useEffect, useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import { isPredictionOpen, validatePrediction } from "@/lib/sport/predictions";

type Match = {
  id: string; team_a: string; team_b: string;
  match_date: string | null; match_time: string | null;
  status: string | null; is_live: boolean | null;
};
type Draft = {
  name: string; phone: string; homeScore: string; awayScore: string;
  nameError: string; phoneError: string; error: string; saved: boolean; loading: boolean;
};
const empty: Draft = {
  name: "", phone: "", homeScore: "", awayScore: "",
  nameError: "", phoneError: "", error: "", saved: false, loading: false,
};
const inputClass = "h-10 rounded-md bg-background px-3 text-sm outline-none ring-1 ring-white/15 focus:ring-accent-blue";

export function PredictionBoard({ matches, bracketId }: { matches: Match[]; bracketId: string }) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const draftFor = (id: string) => drafts[id] || empty;
  const update = (id: string, patch: Partial<Draft>) =>
    setDrafts((current) => ({ ...current, [id]: { ...empty, ...current[id], ...patch } }));

  const submit = async (match: Match) => {
    const draft = draftFor(match.id);
    const fields = validatePrediction({ name: draft.name, phone: draft.phone, homeScore: draft.homeScore, awayScore: draft.awayScore });
    update(match.id, { nameError: fields.name, phoneError: fields.phone });
    if (Object.values(fields).some(Boolean)) {
      update(match.id, { error: [fields.homeScore, fields.awayScore].filter(Boolean).join(" ") || "أكمل الاسم ورقم الموبايل أعلاه لهذه المباراة." });
      return;
    }
    update(match.id, { loading: true, error: "" });
    try {
      const response = await fetch("/api/predictions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: match.id, bracketId, name: draft.name, phone: draft.phone, homeScore: draft.homeScore, awayScore: draft.awayScore }),
      });
      const payload: unknown = await response.json().catch(() => null);
      const result = payload && typeof payload === "object" ? payload : {};
      if (!response.ok || !("saved" in result && result.saved === true)) {
        if ("fields" in result && result.fields && typeof result.fields === "object") {
          const fields = result.fields;
          update(match.id, {
            nameError: "name" in fields && typeof fields.name === "string" ? fields.name : "",
            phoneError: "phone" in fields && typeof fields.phone === "string" ? fields.phone : "",
          });
        }
        const message = "error" in result && typeof result.error === "string"
          ? result.error
          : `تعذر حفظ التوقع (HTTP ${response.status}). حاول مرة أخرى.`;
        update(match.id, { error: message });
        return;
      }
      update(match.id, { saved: true });
    } catch {
      update(match.id, { error: "تعذر الاتصال بالخادم. حاول مرة أخرى." });
    } finally {
      update(match.id, { loading: false });
    }
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {matches.map((match) => {
          const draft = draftFor(match.id);
          return (
            <section key={match.id} className="rounded-md bg-card p-4 ring-1 ring-white/10">
              <div className="mb-2 text-center text-sm font-black">{match.team_a} <span className="text-muted-foreground">×</span> {match.team_b}</div>
              <div className="mb-3 text-center text-xs text-muted-foreground" dir="ltr">{match.match_date} {match.match_time?.slice(0, 5)}</div>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold">بيانات التوقع</h2>
                <button type="button" title="مسح بيانات هذه المباراة" aria-label={`مسح بيانات توقع ${match.team_a} و${match.team_b}`}
                  onClick={() => setDrafts((current) => ({ ...current, [match.id]: { ...empty } }))}
                  disabled={draft.loading || draft.saved || !isPredictionOpen(match, now)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-white/10">
                  <RotateCcw className="h-4 w-4" />
                </button>
              </div>
              {draft.saved ? (
                <p role="status" className="flex items-center justify-center gap-2 text-sm font-bold text-accent-green"><Check className="h-4 w-4" />تم حفظ توقعك لهذه المباراة</p>
              ) : !isPredictionOpen(match, now) ? (
                <p className="text-center text-sm font-bold text-muted-foreground">التوقع مغلق لهذه المباراة</p>
              ) : (
                <div className="space-y-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="grid gap-1 text-sm font-bold">الاسم
                      <input value={draft.name} onChange={(e) => update(match.id, { name: e.target.value, nameError: "" })}
                        className={`${inputClass} ${draft.nameError ? "ring-destructive" : ""}`} aria-invalid={!!draft.nameError} autoComplete="name" />
                      {draft.nameError && <span className="text-xs text-destructive">{draft.nameError}</span>}
                    </label>
                    <label className="grid gap-1 text-sm font-bold">رقم الموبايل
                      <input value={draft.phone} onChange={(e) => update(match.id, { phone: e.target.value, phoneError: "" })}
                        className={`${inputClass} ${draft.phoneError ? "ring-destructive" : ""}`} aria-invalid={!!draft.phoneError} autoComplete="tel" inputMode="tel" dir="ltr" />
                      {draft.phoneError && <span className="text-xs text-destructive">{draft.phoneError}</span>}
                    </label>
                  </div>
                  <div className="flex items-end justify-center gap-3">
                    <label className="grid gap-1 text-center text-xs font-bold">{match.team_a}
                      <input type="number" min="0" max="99" inputMode="numeric" value={draft.homeScore}
                        onChange={(e) => update(match.id, { homeScore: e.target.value, error: "" })}
                        className={`${inputClass} w-16 text-center ${draft.error && !draft.homeScore ? "ring-destructive" : ""}`} aria-label={`نتيجة ${match.team_a}`} />
                    </label>
                    <span className="pb-2">-</span>
                    <label className="grid gap-1 text-center text-xs font-bold">{match.team_b}
                      <input type="number" min="0" max="99" inputMode="numeric" value={draft.awayScore}
                        onChange={(e) => update(match.id, { awayScore: e.target.value, error: "" })}
                        className={`${inputClass} w-16 text-center ${draft.error && !draft.awayScore ? "ring-destructive" : ""}`} aria-label={`نتيجة ${match.team_b}`} />
                    </label>
                  </div>
                  {draft.error && <p role="alert" className="text-center text-xs text-destructive">{draft.error}</p>}
                  <button type="button" onClick={() => submit(match)} disabled={draft.loading}
                    className="h-10 w-full rounded-md bg-primary text-sm font-bold text-primary-foreground disabled:opacity-60">
                    {draft.loading ? "جارٍ الحفظ..." : "توقع"}
                  </button>
                </div>
              )}
            </section>
          );
      })}
    </div>
  );
}

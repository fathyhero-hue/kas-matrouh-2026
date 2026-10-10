"use client";

import { useEffect, useMemo, useState } from "react";

type Bracket = { id: string; label: string };
type RankingEntry = {
  rank: number;
  name: string;
  points: number;
  exactPredictions: number;
  correctPredictions: number;
  totalPredictions: number;
};
type PredictionRow = {
  id: string;
  bracket_id: string | null;
  match_id: string;
  match_name: string | null;
  team_a: string | null;
  team_b: string | null;
  match_date: string | null;
  match_time: string | null;
  status: string | null;
  home_score: number | null;
  away_score: number | null;
  home_goals: number | null;
  away_goals: number | null;
  name: string | null;
  phone: string | null;
  submitted_at: string | null;
  counted: boolean;
  outcome: "pending" | "exact" | "correct" | "wrong" | "duplicate" | "unmatched" | "invalid" | "review";
  points: number | null;
};

const OUTCOME_LABELS: Record<PredictionRow["outcome"], string> = {
  pending: "بانتظار اعتماد النتيجة",
  exact: "نتيجة دقيقة · 3 نقاط",
  correct: "توقع صحيح · نقطة",
  wrong: "توقع خاطئ · 0",
  duplicate: "توقع مكرر · غير محتسب",
  unmatched: "المباراة غير مرتبطة · غير محتسب",
  invalid: "نتيجة غير صالحة · غير محتسبة",
  review: "تحتاج مراجعة · الهوية غير متاحة",
};
const inputClass = "h-11 w-full rounded-lg bg-secondary px-3 text-sm font-bold outline-none ring-1 ring-white/10 focus:ring-accent-blue";

export function PredictionsManager() {
  const [brackets, setBrackets] = useState<Bracket[]>([]);
  const [predictions, setPredictions] = useState<PredictionRow[]>([]);
  const [leaderboards, setLeaderboards] = useState<Record<string, RankingEntry[]>>({});
  const [search, setSearch] = useState("");
  const [bracketFilter, setBracketFilter] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState("all");
  const [rankingLimit, setRankingLimit] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/predictions", { cache: "no-store" })
      .then(async (response) => {
        const result: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          const message = result && typeof result === "object" && "error" in result && typeof result.error === "string"
            ? result.error
            : "تعذر تحميل التوقعات.";
          throw new Error(message);
        }
        if (!result || typeof result !== "object" || !("predictions" in result) || !Array.isArray(result.predictions) ||
          !("brackets" in result) || !Array.isArray(result.brackets)) {
          throw new Error("استجابة بيانات التوقعات غير صالحة.");
        }
        if (!("leaderboards" in result) || !result.leaderboards || typeof result.leaderboards !== "object") {
          throw new Error("استجابة ترتيب المتوقعين غير صالحة.");
        }
        if (!cancelled) {
          setPredictions(result.predictions as PredictionRow[]);
          setBrackets(result.brackets as Bracket[]);
          setLeaderboards(result.leaderboards as Record<string, RankingEntry[]>);
          setBracketFilter(result.brackets[0]?.id || "all");
          setError("");
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "تعذر تحميل التوقعات.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const visible = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return predictions.filter((prediction) => {
      if (bracketFilter !== "all" && prediction.bracket_id !== bracketFilter) return false;
      if (outcomeFilter !== "all" && prediction.outcome !== outcomeFilter) return false;
      if (!normalizedSearch) return true;
      return [
        prediction.name,
        prediction.phone,
        prediction.match_name,
        prediction.team_a,
        prediction.team_b,
      ].some((value) => value?.toLocaleLowerCase().includes(normalizedSearch));
    });
  }, [predictions, bracketFilter, outcomeFilter, search]);

  const counts = useMemo(() => ({
    total: visible.length,
    counted: visible.filter((prediction) => prediction.counted).length,
    exact: visible.filter((prediction) => prediction.counted && prediction.outcome === "exact").length,
    correct: visible.filter((prediction) => prediction.counted && prediction.outcome === "correct").length,
    wrong: visible.filter((prediction) => prediction.counted && prediction.outcome === "wrong").length,
    pending: visible.filter((prediction) => prediction.counted && prediction.outcome === "pending").length,
    duplicate: visible.filter((prediction) => prediction.outcome === "duplicate").length,
    unmatched: visible.filter((prediction) => prediction.outcome === "unmatched").length,
    invalid: visible.filter((prediction) => prediction.outcome === "invalid").length,
    review: visible.filter((prediction) => prediction.outcome === "review").length,
  }), [visible]);
  const ranking = bracketFilter === "all" ? [] : leaderboards[bracketFilter] || [];
  const unidentifiedForBracket = predictions.filter((prediction) =>
    (bracketFilter === "all" || prediction.bracket_id === bracketFilter) &&
    prediction.outcome === "review",
  ).length;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-h1 font-black">إدارة التوقعات</h1>
        <p className="mt-1 text-caption text-muted-foreground">مراجعة توقعات المشاركين ونتائج احتساب النقاط.</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="إحصائيات التوقعات الظاهرة">
        {[
          ["التوقعات", counts.total],
          ["التوقعات الفريدة", counts.counted],
          ["نتيجة دقيقة · 3 نقاط", counts.exact],
          ["صحيحة غير دقيقة · نقطة", counts.correct],
          ["خاطئة · 0", counts.wrong],
          ["بانتظار النتيجة", counts.pending],
          ["مكررة غير محتسبة", counts.duplicate],
          ["مباراة غير مرتبطة", counts.unmatched],
          ["نتيجة غير صالحة", counts.invalid],
          ["تحتاج مراجعة", counts.review],
        ].map(([label, count]) => (
          <div key={label} className="rounded-xl bg-card p-4 ring-1 ring-white/10">
            <div className="text-xs font-bold text-muted-foreground">{label}</div>
            <div className="mt-1 text-2xl font-black" dir="ltr">{count}</div>
          </div>
        ))}
      </section>
      {unidentifiedForBracket > 0 && (
        <p className="rounded-xl bg-card p-4 text-sm text-muted-foreground ring-1 ring-white/10">
          يوجد {unidentifiedForBracket} سجل توقع بلا رقم هاتف موحّد؛ حُفظت السجلات كما هي، لكنها غير مدرجة في ترتيب المشاركين لتعذّر ربطها بهوية ثابتة.
        </p>
      )}

      <section className="grid gap-3 rounded-xl bg-card p-4 ring-1 ring-white/10 sm:grid-cols-3" aria-label="تصفية التوقعات">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="بحث بالاسم أو الهاتف أو المباراة" className={inputClass} />
        <select value={bracketFilter} onChange={(event) => { setBracketFilter(event.target.value); setRankingLimit(50); }} className={inputClass}>
          <option value="all">كل البطولات والنسخ</option>
          {brackets.map((bracket) => <option key={bracket.id} value={bracket.id}>{bracket.label}</option>)}
        </select>
        <select value={outcomeFilter} onChange={(event) => setOutcomeFilter(event.target.value)} className={inputClass}>
          <option value="all">كل الحالات</option>
          <option value="pending">بانتظار اعتماد النتيجة</option>
          <option value="exact">نتيجة دقيقة</option>
          <option value="correct">توقع صحيح غير دقيق</option>
          <option value="wrong">توقع خاطئ</option>
          <option value="duplicate">توقع مكرر غير محتسب</option>
          <option value="unmatched">مباراة غير مرتبطة</option>
          <option value="invalid">نتيجة غير صالحة</option>
          <option value="review">تحتاج مراجعة</option>
        </select>
      </section>

      {bracketFilter === "all" ? (
        <p className="rounded-xl bg-card p-4 text-sm text-muted-foreground">اختر بطولة لعرض ترتيب المشاركين الخاص بها.</p>
      ) : (
        <section className="space-y-3">
          <header>
            <h2 className="text-h2 font-black">ترتيب المشاركين في {brackets.find((bracket) => bracket.id === bracketFilter)?.label}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              يشمل أصحاب الهوية الموحّدة، حتى من لم يحصلوا على نقاط؛ السجلات بلا هاتف موحّد محفوظة لكنها غير مدرجة لتعذّر تحديد أصحابها بأمان.
            </p>
          </header>
          {ranking.length === 0 ? (
            <p className="rounded-xl bg-card p-5 text-center text-sm text-muted-foreground">لا يوجد مشاركون في هذه البطولة بعد.</p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl ring-1 ring-white/10">
                <table className="w-full min-w-[500px] border-collapse text-right text-sm">
                  <thead className="bg-card text-xs text-muted-foreground">
                    <tr>
                      <th className="p-3">الترتيب</th>
                      <th className="p-3">المشارك</th>
                      <th className="p-3">النقاط</th>
                      <th className="p-3">الدقيقة</th>
                      <th className="p-3">الصحيحة</th>
                      <th className="p-3">التوقعات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranking.slice(0, rankingLimit).map((participant) => (
                      <tr key={participant.rank} className="border-t border-white/10">
                        <td className="p-3 font-black" dir="ltr">#{participant.rank}</td>
                        <td className="p-3 font-bold">{participant.name}</td>
                        <td className="p-3 font-black" dir="ltr">{participant.points}</td>
                        <td className="p-3" dir="ltr">{participant.exactPredictions}</td>
                        <td className="p-3" dir="ltr">{participant.correctPredictions}</td>
                        <td className="p-3" dir="ltr">{participant.totalPredictions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rankingLimit < ranking.length && (
                <button type="button" onClick={() => setRankingLimit((limit) => limit + 50)}
                  className="w-full rounded-xl bg-card px-4 py-3 text-sm font-bold ring-1 ring-white/10">
                  عرض المزيد ({rankingLimit} من {ranking.length})
                </button>
              )}
            </>
          )}
        </section>
      )}

      {error && <p role="alert" className="rounded-xl bg-destructive/10 p-4 text-sm font-bold text-destructive">{error}</p>}
      {loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">جارٍ تحميل التوقعات...</p>
      ) : !error && visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">لا توجد توقعات مطابقة للفلاتر.</p>
      ) : visible.length > 0 ? (
        <div className="overflow-x-auto rounded-xl ring-1 ring-white/10">
          <table className="w-full min-w-[950px] border-collapse text-right text-sm">
            <thead className="bg-card text-xs text-muted-foreground">
              <tr>
                <th className="p-3">المشارك</th>
                <th className="p-3">المباراة</th>
                <th className="p-3">التوقع</th>
                <th className="p-3">النتيجة المعتمدة</th>
                <th className="p-3">الحالة والنقاط</th>
                <th className="p-3">وقت المشاركة</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((prediction) => (
                <tr key={prediction.id} className="border-t border-white/10">
                  <td className="p-3">
                    <div className="font-bold">{prediction.name || "بدون اسم"}</div>
                    <div dir="ltr" className="mt-1 text-left text-xs text-muted-foreground">{prediction.phone || "بدون رقم هاتف"}</div>
                  </td>
                  <td className="p-3">{prediction.match_name || `مباراة غير مرتبطة (${prediction.match_id})`}</td>
                  <td className="p-3 font-black" dir="ltr">{prediction.home_score ?? "—"} - {prediction.away_score ?? "—"}</td>
                  <td className="p-3 font-black" dir="ltr">
                    {prediction.home_goals == null || prediction.away_goals == null ? "—" : `${prediction.home_goals} - ${prediction.away_goals}`}
                  </td>
                  <td className="p-3">
                    <span className={`font-bold ${prediction.outcome === "pending" || prediction.outcome === "duplicate" || prediction.outcome === "unmatched" || prediction.outcome === "invalid" || prediction.outcome === "review" ? "text-muted-foreground" : prediction.points ? "text-accent-green" : "text-destructive"}`}>
                      {OUTCOME_LABELS[prediction.outcome]}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground" dir="ltr">
                    {prediction.submitted_at ? new Date(prediction.submitted_at).toLocaleString("ar-EG") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

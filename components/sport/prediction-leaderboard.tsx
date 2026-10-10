"use client";

import { useEffect, useRef, useState } from "react";

type LeaderboardEntry = {
  rank: number;
  name: string;
  points: number;
  exactPredictions: number;
  correctPredictions: number;
  totalPredictions: number;
};
type LeaderboardResponse = { entries: LeaderboardEntry[]; total: number };
const PAGE_SIZE = 50;

async function fetchLeaderboardPage(bracketId: string, offset: number, signal?: AbortSignal) {
  const query = new URLSearchParams({
    bracketId,
    offset: String(offset),
    limit: String(PAGE_SIZE),
  });
  const response = await fetch(`/api/predictions/leaderboard?${query}`, { cache: "no-store", signal });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
      ? payload.error
      : "تعذر تحميل ترتيب المتوقعين.";
    throw new Error(message);
  }
  if (!payload || typeof payload !== "object" || !("entries" in payload) || !Array.isArray(payload.entries) ||
    !("total" in payload) || typeof payload.total !== "number") {
    throw new Error("استجابة ترتيب المتوقعين غير صالحة.");
  }
  return payload as LeaderboardResponse;
}

export function PredictionLeaderboard({ bracketId }: { bracketId: string }) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMoreBracketId, setLoadingMoreBracketId] = useState("");
  const [error, setError] = useState("");
  const [loadedBracketId, setLoadedBracketId] = useState("");
  const requestVersion = useRef(0);

  useEffect(() => {
    requestVersion.current += 1;
    const version = requestVersion.current;
    const controller = new AbortController();
    fetchLeaderboardPage(bracketId, 0, controller.signal)
      .then((result) => {
        if (requestVersion.current !== version) return;
        setEntries(result.entries);
        setTotal(result.total);
        setLoadedBracketId(bracketId);
        setLoadingMoreBracketId("");
        setError("");
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted && requestVersion.current === version) {
          setError(reason instanceof Error ? reason.message : "تعذر تحميل ترتيب المتوقعين.");
          setLoadedBracketId(bracketId);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted && requestVersion.current === version) setLoading(false);
      });
    return () => controller.abort();
  }, [bracketId]);

  const currentEntries = loadedBracketId === bracketId ? entries : [];
  const currentTotal = loadedBracketId === bracketId ? total : 0;
  const currentError = loadedBracketId === bracketId ? error : "";
  const currentLoading = loading || loadedBracketId !== bracketId;
  const currentLoadingMore = loadingMoreBracketId === bracketId;

  const loadMore = async () => {
    const version = requestVersion.current;
    setLoadingMoreBracketId(bracketId);
    setError("");
    try {
      const result = await fetchLeaderboardPage(bracketId, entries.length);
      if (requestVersion.current !== version) return;
      setEntries((current) => [...current, ...result.entries]);
      setTotal(result.total);
    } catch (reason) {
      if (requestVersion.current === version) {
        setError(reason instanceof Error ? reason.message : "تعذر تحميل بقية الترتيب.");
      }
    } finally {
      if (requestVersion.current === version) setLoadingMoreBracketId("");
    }
  };

  return (
    <section className="space-y-3">
      <header>
        <h2 className="text-h2 font-black">ترتيب المتوقعين</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          يُحتسب أقدم توقع صالح واحد لكل مشارك في المباراة، ولا تُحتسب النقاط إلا بعد اعتماد النتيجة. عند التساوي يُقدَّم الأكثر دقة، ثم الأكثر توقعًا صحيحًا، ثم الأسبق في أول مشاركة، ويُحسم التطابق الكامل بمعيار ثابت.
        </p>
      </header>
      {currentLoading ? (
        <p className="rounded-xl bg-card p-6 text-center text-sm text-muted-foreground">جارٍ تحميل الترتيب...</p>
      ) : currentError && currentEntries.length === 0 ? (
        <p role="alert" className="rounded-xl bg-destructive/10 p-4 text-sm font-bold text-destructive">{currentError}</p>
      ) : currentTotal === 0 ? (
        <p className="rounded-xl bg-card p-6 text-center text-sm text-muted-foreground">لا توجد توقعات في هذه البطولة بعد.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl ring-1 ring-white/10">
            <table className="w-full min-w-[520px] border-collapse text-right text-sm">
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
                {currentEntries.map((participant) => (
                  <tr key={participant.rank} className="border-t border-white/10">
                    <td className="p-3 font-black" dir="ltr">#{participant.rank}</td>
                    <td className="p-3 font-bold">{participant.name}</td>
                    <td className="p-3 font-black text-accent-green" dir="ltr">{participant.points}</td>
                    <td className="p-3" dir="ltr">{participant.exactPredictions}</td>
                    <td className="p-3" dir="ltr">{participant.correctPredictions}</td>
                    <td className="p-3" dir="ltr">{participant.totalPredictions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {currentError && <p role="alert" className="text-sm font-bold text-destructive">{currentError}</p>}
          {currentEntries.length < currentTotal && (
            <button type="button" onClick={loadMore} disabled={currentLoadingMore}
              className="w-full rounded-xl bg-card px-4 py-3 text-sm font-bold ring-1 ring-white/10 disabled:opacity-60">
              {currentLoadingMore ? "جارٍ تحميل بقية الترتيب..." : `عرض المزيد (${currentEntries.length} من ${currentTotal})`}
            </button>
          )}
        </>
      )}
    </section>
  );
}

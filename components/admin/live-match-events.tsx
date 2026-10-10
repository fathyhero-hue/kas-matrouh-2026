"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type TeamOption = {
  id: string;
  name: string;
  players: Array<{ id: string; name: string }>;
};

type LiveEvent = {
  id: string;
  kind: "goal" | "card";
  eventType: "goal" | "yellow" | "direct_red" | "second_yellow_red";
  teamRosterId: string;
  playerId: string;
  teamName: string;
  playerName: string;
  minute: number | null;
  createdAt: string;
  editable: boolean;
};

type EventData = {
  match: { liveEventsEnabled: boolean };
  canFullyManage?: boolean;
  teams: TeamOption[];
  events: LiveEvent[];
};

type Props = {
  matchId: string;
  onMatchUpdated: () => void;
};

const EVENT_LABELS: Record<LiveEvent["eventType"], string> = {
  goal: "هدف",
  yellow: "إنذار",
  direct_red: "طرد",
  second_yellow_red: "طرد بعد الإنذار الثاني",
};

async function readResponse(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function responseError(payload: unknown, fallback: string) {
  return payload && typeof payload === "object" && "error" in payload &&
    typeof payload.error === "string" ? payload.error : fallback;
}

export function LiveMatchEvents({ matchId, onMatchUpdated }: Props) {
  const [data, setData] = useState<EventData | null>(null);
  const [teamRosterId, setTeamRosterId] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [eventType, setEventType] = useState<LiveEvent["eventType"]>("goal");
  const [minute, setMinute] = useState("1");
  const [editing, setEditing] = useState<LiveEvent | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [opened, setOpened] = useState(false);
  const pendingIdempotency = useRef<{ fingerprint: string; key: string } | null>(null);

  const selectedTeam = useMemo(
    () => data?.teams.find((team) => team.id === teamRosterId),
    [data, teamRosterId],
  );

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/live/events?match_id=${encodeURIComponent(matchId)}`, { cache: "no-store" });
      const payload = await readResponse(response);
      if (!response.ok) throw new Error(responseError(payload, "تعذر تحميل أحداث المباراة."));
      if (!payload || typeof payload !== "object" || !("teams" in payload) || !Array.isArray(payload.teams) ||
        !("events" in payload) || !Array.isArray(payload.events) || !("match" in payload)) {
        throw new Error("استجابة أحداث المباراة غير صالحة.");
      }
      const result = payload as EventData;
      setData(result);
      setError("");
      if (!teamRosterId && result.teams[0]) {
        setTeamRosterId(result.teams[0].id);
        setPlayerId(result.teams[0].players[0]?.id || "");
      }
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "تعذر تحميل أحداث المباراة.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const onToggle = (event: React.SyntheticEvent<HTMLDetailsElement>) => {
    const nextOpen = event.currentTarget.open;
    setOpened(nextOpen);
    if (nextOpen && !data && !loading) void load();
  };

  const enableGoalTracking = async () => {
    if (!window.confirm("سيُحفظ رصيد المباراة الحالي كأساس للأهداف، ثم ستحدّث الأحداث المسجلة النتيجة. هل تريد المتابعة؟")) return;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/live/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, action: "enable" }),
      });
      const payload = await readResponse(response);
      if (!response.ok) throw new Error(responseError(payload, "تعذر تفعيل أحداث الأهداف."));
      await load();
      onMatchUpdated();
      toast.success("تم تفعيل تسجيل الأهداف دون تغيير النتيجة الحالية.");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "تعذر تفعيل أحداث الأهداف.");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setEditing(null);
    setEventType("goal");
    setMinute("1");
    setPlayerId(selectedTeam?.players[0]?.id || "");
  };

  const saveEvent = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!teamRosterId || !playerId) {
      toast.error("اختر الفريق واللاعب أولًا.");
      return;
    }
    const parsedMinute = Number(minute);
    if (!Number.isInteger(parsedMinute) || parsedMinute < 1 || parsedMinute > 150) {
      toast.error("أدخل دقيقة بين 1 و150.");
      return;
    }
    const reason = editing && data?.canFullyManage
      ? window.prompt("اكتب سبب تعديل الحدث:")
      : "";
    if (editing && data?.canFullyManage && !reason?.trim()) return;
    setSaving(true);
    try {
      const fingerprint = JSON.stringify([matchId, eventType, teamRosterId, playerId, parsedMinute]);
      if (!editing && pendingIdempotency.current?.fingerprint !== fingerprint) {
        pendingIdempotency.current = { fingerprint, key: crypto.randomUUID() };
      }
      const editingPayload = {
        matchId,
        eventId: editing?.id,
        kind: editing?.kind,
        eventType,
        teamRosterId,
        playerId,
        minute: parsedMinute,
        ...(editing && data?.canFullyManage ? { reason: reason?.trim() } : {}),
      };
      const response = await fetch("/api/admin/live/events", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing
          ? editingPayload
          : { ...editingPayload, idempotencyKey: pendingIdempotency.current?.key }),
      });
      const payload = await readResponse(response);
      if (!response.ok) throw new Error(responseError(payload, "تعذر حفظ الحدث."));
      if (!editing) pendingIdempotency.current = null;
      resetForm();
      await load();
      onMatchUpdated();
      toast.success(editing ? "تم تعديل الحدث." : "تم تسجيل الحدث.");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "تعذر حفظ الحدث.");
    } finally {
      setSaving(false);
    }
  };

  const editEvent = (event: LiveEvent) => {
    setEditing(event);
    setTeamRosterId(event.teamRosterId);
    setPlayerId(event.playerId);
    setEventType(event.eventType);
    setMinute(String(event.minute || 1));
  };

  const revokeEvent = async (event: LiveEvent) => {
    if (!window.confirm("هل تريد إلغاء هذا الحدث؟ سيُحفظ أثره في سجل التدقيق.")) return;
    const reason = data?.canFullyManage ? window.prompt("اكتب سبب إلغاء الحدث:") : "";
    if (data?.canFullyManage && !reason?.trim()) return;
    setSaving(true);
    try {
      const params = new URLSearchParams({ match_id: matchId, event_id: event.id, kind: event.kind });
      const response = await fetch(`/api/admin/live/events?${params}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        ...(data?.canFullyManage ? { body: JSON.stringify({ reason: reason?.trim() }) } : {}),
      });
      const payload = await readResponse(response);
      if (!response.ok) throw new Error(responseError(payload, "تعذر إلغاء الحدث."));
      if (editing?.id === event.id) resetForm();
      await load();
      onMatchUpdated();
      toast.success("تم إلغاء الحدث.");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "تعذر إلغاء الحدث.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <details className="mt-4 border-t border-white/10 pt-3" onToggle={onToggle}>
      <summary className="cursor-pointer text-sm font-black">إدارة الأهداف والبطاقات</summary>
      {opened && (
        <div className="mt-3 space-y-4">
          {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-xs font-bold text-destructive">{error}</p>}
          {loading && !data ? (
            <p className="text-xs text-muted-foreground">جارٍ تحميل أحداث المباراة...</p>
          ) : data && (
            <>
              {!data.match.liveEventsEnabled && (
                <div className="rounded-lg bg-secondary/60 p-3">
                  <p className="mb-2 text-xs text-muted-foreground">
                    التفعيل يحفظ النتيجة الحالية كأساس، ثم تُحدّث النتيجة تلقائيًا لكل هدف جديد أو ملغى.
                  </p>
                  <button type="button" onClick={() => void enableGoalTracking()} disabled={saving}
                    className="h-9 rounded-lg bg-primary px-3 text-xs font-black text-primary-foreground disabled:opacity-50">
                    تفعيل تسجيل الأهداف
                  </button>
                </div>
              )}

              <form onSubmit={saveEvent} className="grid gap-2 sm:grid-cols-2">
                <select aria-label="نوع الحدث" value={eventType}
                  onChange={(event) => setEventType(event.target.value as LiveEvent["eventType"])}
                  className="h-10 rounded-lg bg-secondary px-2 text-sm font-bold">
                  <option value="goal" disabled={!data.match.liveEventsEnabled}>هدف</option>
                  <option value="yellow">إنذار</option>
                  <option value="direct_red">طرد مباشر</option>
                  <option value="second_yellow_red">طرد بعد الإنذار الثاني</option>
                </select>
                <select aria-label="الفريق" value={teamRosterId}
                  onChange={(event) => {
                    const teamId = event.target.value;
                    setTeamRosterId(teamId);
                    setPlayerId(data.teams.find((team) => team.id === teamId)?.players[0]?.id || "");
                  }}
                  className="h-10 rounded-lg bg-secondary px-2 text-sm font-bold">
                  {data.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                </select>
                <select aria-label="اللاعب" value={playerId}
                  onChange={(event) => setPlayerId(event.target.value)}
                  className="h-10 rounded-lg bg-secondary px-2 text-sm font-bold">
                  {selectedTeam?.players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
                </select>
                <label className="flex items-center gap-2 text-xs font-bold">
                  الدقيقة
                  <input type="number" min={1} max={150} required value={minute}
                    onChange={(event) => setMinute(event.target.value)}
                    className="h-10 min-w-0 flex-1 rounded-lg bg-secondary px-2 text-sm" />
                </label>
                <div className="flex gap-2 sm:col-span-2">
                  <button type="submit" disabled={saving || !selectedTeam?.players.length || (eventType === "goal" && !data.match.liveEventsEnabled)}
                    className="h-9 rounded-lg bg-primary px-3 text-xs font-black text-primary-foreground disabled:opacity-50">
                    {saving ? "جارٍ الحفظ..." : editing ? "حفظ التعديل" : "تسجيل الحدث"}
                  </button>
                  {editing && <button type="button" onClick={resetForm} className="h-9 rounded-lg bg-secondary px-3 text-xs font-bold">إلغاء التعديل</button>}
                </div>
              </form>

              <ul className="divide-y divide-white/10">
                {data.events.map((event) => (
                  <li key={`${event.kind}-${event.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                    <span className="font-bold">
                      {EVENT_LABELS[event.eventType]} · {event.playerName} · {event.teamName} · {event.minute ? `${event.minute}′` : "الدقيقة غير مسجلة"}
                    </span>
                    {event.editable && (
                      <span className="flex gap-2">
                        <button type="button" onClick={() => editEvent(event)} className="font-black text-accent-blue">تعديل</button>
                        <button type="button" onClick={() => void revokeEvent(event)} disabled={saving}
                          className="font-black text-destructive disabled:opacity-50">إلغاء الحدث</button>
                      </span>
                    )}
                  </li>
                ))}
                {!data.events.length && <li className="py-2 text-muted-foreground">لا توجد أحداث مسجلة.</li>}
              </ul>
            </>
          )}
        </div>
      )}
    </details>
  );
}

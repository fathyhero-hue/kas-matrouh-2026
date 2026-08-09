"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Trash2, Plus, Star } from "lucide-react";

type Goal = { id: string; player: string; team: string; goals: number; image_url: string | null };
type Card = { id: string; player: string; team: string; yellow: number; red: number };
type Motm = { id: string; player: string; team: string; match_name: string | null; image_url: string | null; rating: number | null };
type FormationPlayer = { id?: string; name: string; team: string; image_url: string; slot_index: number };
type Formation = { id: string; round: string; coach_name: string | null; coach_team: string | null; coach_image_url: string | null; formation_players: FormationPlayer[] };

const inputCls = "h-10 w-full rounded-lg bg-secondary px-3 text-caption font-bold outline-none ring-1 ring-white/10 focus:ring-accent-blue";
const TABS = [
  { key: "goals", label: "الهدافين" },
  { key: "cards", label: "الكروت" },
  { key: "motm", label: "نجم المباراة" },
  { key: "totw", label: "تشكيلة الجولة" },
] as const;

export function StatsManager({
  bracketId,
  initialGoals,
  initialCards,
  initialMotm,
  initialFormations,
}: {
  bracketId: string;
  initialGoals: Goal[];
  initialCards: Card[];
  initialMotm: Motm[];
  initialFormations: Formation[];
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("goals");

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 rounded-2xl bg-card p-1.5 ring-1 ring-white/10">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-xl py-2 text-caption font-bold transition-colors ${tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "goals" && <GoalsTab bracketId={bracketId} initial={initialGoals} />}
      {tab === "cards" && <CardsTab bracketId={bracketId} initial={initialCards} />}
      {tab === "motm" && <MotmTab bracketId={bracketId} initial={initialMotm} />}
      {tab === "totw" && <FormationTab bracketId={bracketId} initial={initialFormations[0] || null} />}
    </div>
  );
}

function GoalsTab({ bracketId, initial }: { bracketId: string; initial: Goal[] }) {
  const [rows, setRows] = useState(initial);
  const [form, setForm] = useState({ player: "", team: "", goals: "1", image_url: "" });

  const add = async () => {
    if (!form.player.trim() || !form.team.trim()) return toast.error("اكتب اسم اللاعب والفريق");
    try {
      const res = await fetch("/api/admin/stats-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table: "goals", bracket_id: bracketId, player: form.player.trim(), team: form.team.trim(), goals: Number(form.goals) || 1, image_url: form.image_url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "فشل الحفظ");
      setRows((prev) => [...prev, data.row].sort((a, b) => (b.goals || 0) - (a.goals || 0)));
      setForm({ player: "", team: "", goals: "1", image_url: "" });
    } catch (e: any) {
      toast.error(e?.message || "فشل الحفظ");
    }
  };

  const updateGoals = async (row: Goal, delta: number) => {
    const newGoals = Math.max(0, (row.goals || 0) + delta);
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, goals: newGoals } : r)));
    try {
      await fetch("/api/admin/stats-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table: "goals", id: row.id, goals: newGoals }),
      });
    } catch {
      toast.error("فشل التحديث");
    }
  };

  const remove = async (id: string) => {
    try {
      await fetch(`/api/admin/stats-entries?table=goals&id=${id}`, { method: "DELETE" });
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch {
      toast.error("فشل الحذف");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 rounded-2xl bg-card p-4 ring-1 ring-white/10">
        <input value={form.player} onChange={(e) => setForm({ ...form, player: e.target.value })} placeholder="اسم اللاعب" className={`${inputCls} flex-1`} />
        <input value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value })} placeholder="الفريق" className={`${inputCls} flex-1`} />
        <input type="number" value={form.goals} onChange={(e) => setForm({ ...form, goals: e.target.value })} className={`${inputCls} w-20`} />
        <button onClick={add} className="rounded-lg bg-primary px-4 text-caption font-black text-primary-foreground"><Plus className="h-4 w-4" /></button>
      </div>
      <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-white/10">
        {rows.length === 0 ? (
          <div className="p-8 text-center text-caption text-muted-foreground">لا يوجد هدافين</div>
        ) : (
          rows.map((g) => (
            <div key={g.id} className="flex items-center gap-3 border-b border-white/5 px-4 py-2.5 last:border-0">
              <div className="min-w-0 flex-1">
                <div className="truncate text-caption font-black">{g.player}</div>
                <div className="truncate text-[11px] text-muted-foreground">{g.team}</div>
              </div>
              <button onClick={() => updateGoals(g, -1)} className="h-7 w-7 rounded bg-red-500/15 font-black text-red-400">−</button>
              <span className="w-6 text-center text-caption font-black text-accent-orange">{g.goals}</span>
              <button onClick={() => updateGoals(g, 1)} className="h-7 w-7 rounded bg-accent-green/15 font-black text-accent-green">+</button>
              <button onClick={() => remove(g.id)} className="rounded-lg bg-red-500/15 p-1.5 text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CardsTab({ bracketId, initial }: { bracketId: string; initial: Card[] }) {
  const [rows, setRows] = useState(initial);
  const [form, setForm] = useState({ player: "", team: "" });

  const add = async () => {
    if (!form.player.trim() || !form.team.trim()) return toast.error("اكتب اسم اللاعب والفريق");
    try {
      const res = await fetch("/api/admin/stats-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table: "cards", bracket_id: bracketId, player: form.player.trim(), team: form.team.trim(), yellow: 0, red: 0 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "فشل الحفظ");
      setRows((prev) => [...prev, data.row]);
      setForm({ player: "", team: "" });
    } catch (e: any) {
      toast.error(e?.message || "فشل الحفظ");
    }
  };

  const updateCard = async (row: Card, field: "yellow" | "red", delta: number) => {
    const value = Math.max(0, (row[field] || 0) + delta);
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, [field]: value } : r)));
    try {
      await fetch("/api/admin/stats-entries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ table: "cards", id: row.id, [field]: value }) });
    } catch {
      toast.error("فشل التحديث");
    }
  };

  const remove = async (id: string) => {
    try {
      await fetch(`/api/admin/stats-entries?table=cards&id=${id}`, { method: "DELETE" });
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch {
      toast.error("فشل الحذف");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 rounded-2xl bg-card p-4 ring-1 ring-white/10">
        <input value={form.player} onChange={(e) => setForm({ ...form, player: e.target.value })} placeholder="اسم اللاعب" className={`${inputCls} flex-1`} />
        <input value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value })} placeholder="الفريق" className={`${inputCls} flex-1`} />
        <button onClick={add} className="rounded-lg bg-primary px-4 text-caption font-black text-primary-foreground"><Plus className="h-4 w-4" /></button>
      </div>
      <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-white/10">
        {rows.length === 0 ? (
          <div className="p-8 text-center text-caption text-muted-foreground">لا توجد بطاقات</div>
        ) : (
          rows.map((c) => (
            <div key={c.id} className="flex items-center gap-3 border-b border-white/5 px-4 py-2.5 last:border-0">
              <div className="min-w-0 flex-1">
                <div className="truncate text-caption font-black">{c.player}</div>
                <div className="truncate text-[11px] text-muted-foreground">{c.team}</div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => updateCard(c, "yellow", -1)} className="h-6 w-6 rounded bg-white/5 text-[11px] font-black">−</button>
                <span className="w-8 text-center text-[11px] font-black">🟨{c.yellow || 0}</span>
                <button onClick={() => updateCard(c, "yellow", 1)} className="h-6 w-6 rounded bg-white/5 text-[11px] font-black">+</button>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => updateCard(c, "red", -1)} className="h-6 w-6 rounded bg-white/5 text-[11px] font-black">−</button>
                <span className="w-8 text-center text-[11px] font-black">🟥{c.red || 0}</span>
                <button onClick={() => updateCard(c, "red", 1)} className="h-6 w-6 rounded bg-white/5 text-[11px] font-black">+</button>
              </div>
              <button onClick={() => remove(c.id)} className="rounded-lg bg-red-500/15 p-1.5 text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function MotmTab({ bracketId, initial }: { bracketId: string; initial: Motm[] }) {
  const [rows, setRows] = useState(initial);
  const [form, setForm] = useState({ player: "", team: "", match_name: "", image_url: "" });

  const add = async () => {
    if (!form.player.trim() || !form.team.trim()) return toast.error("اكتب اسم اللاعب والفريق");
    try {
      const res = await fetch("/api/admin/stats-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table: "motm", bracket_id: bracketId, player: form.player.trim(), team: form.team.trim(), match_name: form.match_name, image_url: form.image_url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "فشل الحفظ");
      setRows((prev) => [...prev, data.row]);
      setForm({ player: "", team: "", match_name: "", image_url: "" });
    } catch (e: any) {
      toast.error(e?.message || "فشل الحفظ");
    }
  };

  const remove = async (id: string) => {
    try {
      await fetch(`/api/admin/stats-entries?table=motm&id=${id}`, { method: "DELETE" });
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch {
      toast.error("فشل الحذف");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 rounded-2xl bg-card p-4 ring-1 ring-white/10">
        <input value={form.player} onChange={(e) => setForm({ ...form, player: e.target.value })} placeholder="اسم اللاعب" className={`${inputCls} flex-1`} />
        <input value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value })} placeholder="الفريق" className={`${inputCls} flex-1`} />
        <input value={form.match_name} onChange={(e) => setForm({ ...form, match_name: e.target.value })} placeholder="اسم المباراة (اختياري)" className={`${inputCls} flex-1`} />
        <button onClick={add} className="rounded-lg bg-primary px-4 text-caption font-black text-primary-foreground"><Plus className="h-4 w-4" /></button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.length === 0 ? (
          <div className="col-span-full rounded-2xl bg-card p-8 text-center text-caption text-muted-foreground ring-1 ring-white/10">لا يوجد نجوم مباريات</div>
        ) : (
          rows.map((m) => (
            <div key={m.id} className="flex items-center gap-3 rounded-2xl bg-card p-3 ring-1 ring-white/10">
              <Star className="h-6 w-6 shrink-0 text-accent-orange" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-caption font-black">{m.player}</div>
                <div className="truncate text-[11px] text-muted-foreground">{m.team} {m.match_name ? `• ${m.match_name}` : ""}</div>
              </div>
              <button onClick={() => remove(m.id)} className="shrink-0 rounded-lg bg-red-500/15 p-1.5 text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function FormationTab({ bracketId, initial }: { bracketId: string; initial: Formation | null }) {
  const [round, setRound] = useState(initial?.round || "");
  const [coachName, setCoachName] = useState(initial?.coach_name || "");
  const [coachTeam, setCoachTeam] = useState(initial?.coach_team || "");
  const [players, setPlayers] = useState<FormationPlayer[]>(
    initial?.formation_players?.length ? [...initial.formation_players].sort((a, b) => a.slot_index - b.slot_index) : Array.from({ length: 7 }, (_, i) => ({ name: "", team: "", image_url: "", slot_index: i }))
  );
  const [formationId, setFormationId] = useState(initial?.id || null);
  const [saving, setSaving] = useState(false);

  const updatePlayer = (i: number, field: keyof FormationPlayer, value: string) => {
    setPlayers((prev) => prev.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));
  };

  const save = async () => {
    if (!round.trim()) return toast.error("اكتب اسم الجولة/الدور");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/formations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: formationId, bracket_id: bracketId, round: round.trim(), coach_name: coachName, coach_team: coachTeam, players }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "فشل الحفظ");
      setFormationId(data.formation.id);
      toast.success("تم حفظ تشكيلة الجولة");
    } catch (e: any) {
      toast.error(e?.message || "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 rounded-2xl bg-card p-4 ring-1 ring-white/10 sm:grid-cols-3">
        <input value={round} onChange={(e) => setRound(e.target.value)} placeholder="اسم الجولة/الدور" className={inputCls} />
        <input value={coachName} onChange={(e) => setCoachName(e.target.value)} placeholder="اسم المدرب (اختياري)" className={inputCls} />
        <input value={coachTeam} onChange={(e) => setCoachTeam(e.target.value)} placeholder="فريق المدرب" className={inputCls} />
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {players.map((p, i) => (
          <div key={i} className="flex items-center gap-2 rounded-xl bg-card p-2 ring-1 ring-white/10">
            <span className="w-5 shrink-0 text-center text-[11px] font-black text-muted-foreground">{i + 1}</span>
            <input value={p.name} onChange={(e) => updatePlayer(i, "name", e.target.value)} placeholder="اسم اللاعب" className="h-8 flex-1 rounded-lg bg-secondary px-2 text-[12px] font-bold outline-none ring-1 ring-white/10" />
            <input value={p.team} onChange={(e) => updatePlayer(i, "team", e.target.value)} placeholder="الفريق" className="h-8 flex-1 rounded-lg bg-secondary px-2 text-[12px] font-bold outline-none ring-1 ring-white/10" />
          </div>
        ))}
      </div>
      <button onClick={save} disabled={saving} className="rounded-xl bg-primary px-5 py-2.5 text-caption font-black text-primary-foreground disabled:opacity-60">
        حفظ تشكيلة الجولة
      </button>
    </div>
  );
}

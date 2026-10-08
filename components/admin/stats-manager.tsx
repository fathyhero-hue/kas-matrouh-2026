"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Trash2, Plus, Star, Upload, Pencil, Check, X } from "lucide-react";
import { addEventOnlyCardRows, getCardTotalsWithEvents, resolveStatsPlayer } from "@/lib/sport/stats-player";
import type { GoalCreatePayload, CardCreatePayload } from "@/lib/sport/stats-contract";
import { getSuspensionStateFromEvents } from "@/lib/sport/suspensions";
import { buildCardEventAssignments, countAssignedCardEvents } from "@/lib/sport/card-event-distribution";

type Goal = { id: string; player: string | null; team: string | null; roster_player_id?: string | null; team_roster_id?: string | null; goals: number; image_url: string | null };
type Card = { id: string; bracket_id?: string | null; player: string | null; team: string | null; match_id?: string | null; roster_player_id?: string | null; team_roster_id?: string | null; yellow: number; red: number };
type CardEvent = { id: string; bracket_id: string; match_id: string; roster_player_id: string; team_roster_id: string; card_type: "yellow" | "direct_red"; source_card_id?: string | null; source_card_ordinal?: number | null; created_at?: string | null };
type Motm = { id: string; player: string; team: string; match_name: string | null; image_url: string | null; rating: number | null };
type FormationPlayer = { id?: string; name: string; team: string; image_url: string; slot_index: number };
type Formation = { id: string; round: string; coach_name: string | null; coach_team: string | null; coach_image_url: string | null; formation_players: FormationPlayer[] };
type RosterTeam = {
  id: string;
  team: string;
  logoUrl: string | null;
  coachName: string | null;
  coachPhotoUrl: string | null;
  players: { id: string; name: string; photoUrl: string | null }[];
};

const inputCls = "h-10 w-full rounded-lg bg-secondary px-3 text-caption font-bold outline-none ring-1 ring-white/10 focus:ring-accent-blue";
function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
const TABS = [
  { key: "goals", label: "Ø§Ù„Ù‡Ø¯Ø§ÙÙŠÙ†" },
  { key: "cards", label: "Ø§Ù„ÙƒØ±ÙˆØª" },
  { key: "motm", label: "Ù†Ø¬Ù… Ø§Ù„Ù…Ø¨Ø§Ø±Ø§Ø©" },
  { key: "totw", label: "ØªØ´ÙƒÙŠÙ„Ø© Ø§Ù„Ø¬ÙˆÙ„Ø©" },
] as const;

// Manual-upload button used whenever a player isn't in any submitted roster â€”
// replaces what used to be a free-text "image URL" field everywhere.
function PhotoUploadButton({ onUploaded }: { onUploaded: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("photo", file);
      const res = await fetch("/api/admin/stats-photo", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "ÙØ´Ù„ Ø±ÙØ¹ Ø§Ù„ØµÙˆØ±Ø©");
      onUploaded(data.url);
      toast.success("ØªÙ… Ø±ÙØ¹ Ø§Ù„ØµÙˆØ±Ø©");
    } catch (e: unknown) {
      toast.error(errorMessage(e, "ÙØ´Ù„ Ø±ÙØ¹ Ø§Ù„ØµÙˆØ±Ø©"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-accent-blue/15 px-3 py-2 text-[11px] font-black text-accent-blue disabled:opacity-60"
      >
        <Upload className="h-3.5 w-3.5" /> {uploading ? "Ø¬Ø§Ø±ÙŠ Ø§Ù„Ø±ÙØ¹..." : "Ø±ÙØ¹ ØµÙˆØ±Ø©"}
      </button>
    </>
  );
}

// Team â†’ player picker sourced from real submitted rosters, with a manual
// fallback (free-text name + real photo upload) for players not in any
// roster yet. `trackPhoto=false` skips the photo UI entirely for tables that
// don't store one (e.g. cards).
function TeamPlayerPicker({
  rosterTeams,
  team,
  player,
  teamRosterId,
  rosterPlayerId,
  imageUrl,
  requireRoster = false,
  trackPhoto = true,
  onChange,
}: {
  rosterTeams: RosterTeam[];
  team: string;
  player: string;
  teamRosterId?: string | null;
  rosterPlayerId?: string | null;
  imageUrl?: string;
  requireRoster?: boolean;
  trackPhoto?: boolean;
  onChange: (patch: { team?: string; player?: string; team_roster_id?: string; roster_player_id?: string; image_url?: string }) => void;
}) {
  const [manual, setManual] = useState(!requireRoster && rosterTeams.length === 0);
  const selectedTeam = rosterTeams.find((t) => t.id === teamRosterId) || rosterTeams.find((t) => t.team === team);
  const players = selectedTeam?.players || [];
  const selectedTeamValue = teamRosterId || selectedTeam?.id || "";
  const selectedPlayerValue = rosterPlayerId || players.find((p) => p.name === player)?.id || "";

  return (
    <div className="flex-1 space-y-2">
      <div className="flex flex-wrap gap-2">
        {manual ? (
          <>
            <input value={team} onChange={(e) => onChange({ team: e.target.value, team_roster_id: "", roster_player_id: "" })} placeholder="Ø§Ø³Ù… Ø§Ù„ÙØ±ÙŠÙ‚" className={`${inputCls} flex-1`} />
            <input value={player} onChange={(e) => onChange({ player: e.target.value, roster_player_id: "" })} placeholder="Ø§Ø³Ù… Ø§Ù„Ù„Ø§Ø¹Ø¨" className={`${inputCls} flex-1`} />
          </>
        ) : (
          <>
            <select value={selectedTeamValue} onChange={(e) => { const t = rosterTeams.find((item) => item.id === e.target.value); onChange({ team: t?.team || "", team_roster_id: t?.id || "", player: "", roster_player_id: "", image_url: "" }); }} className={`${inputCls} flex-1`}>
              <option value="">Ø§Ø®ØªØ± Ø§Ù„ÙØ±ÙŠÙ‚</option>
              {rosterTeams.map((t) => (
                <option key={t.id} value={t.id}>{t.team}</option>
              ))}
            </select>
            <select
              value={selectedPlayerValue}
              onChange={(e) => {
                const p = players.find((pl) => pl.id === e.target.value);
                onChange({ player: p?.name || "", roster_player_id: p?.id || "", image_url: p?.photoUrl || "" });
              }}
              disabled={!selectedTeamValue}
              className={`${inputCls} flex-1 disabled:opacity-50`}
            >
              <option value="">Ø§Ø®ØªØ± Ø§Ù„Ù„Ø§Ø¹Ø¨</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </>
        )}
      </div>
      {!requireRoster && (rosterTeams.length > 0 || (trackPhoto && manual)) && (
        <div className="flex items-center gap-2">
          {rosterTeams.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setManual((m) => !m);
                onChange({ team: "", team_roster_id: "", player: "", roster_player_id: "", image_url: "" });
              }}
              className="text-[11px] font-bold text-muted-foreground underline"
            >
              {manual ? "Ø§Ø®ØªÙŠØ§Ø± Ù…Ù† Ø§Ù„Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„Ù…Ø³Ø¬Ù‘Ù„Ø©" : "Ø§Ù„Ù„Ø§Ø¹Ø¨ Ù…Ø´ Ù…ÙˆØ¬ÙˆØ¯ ÙÙ‰ Ø§Ù„Ù‚Ø§Ø¦Ù…Ø©"}
            </button>
          )}
          {trackPhoto && manual && <PhotoUploadButton onUploaded={(url) => onChange({ image_url: url })} />}
          {trackPhoto && imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={player} className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-white/10" />
          )}
        </div>
      )}
    </div>
  );
}

export function StatsManager({
  bracketId,
  initialGoals,
  initialCards,
  initialCardEvents,
  initialMotm,
  initialFormations,
  rosterTeams,
  matches,
}: {
  bracketId: string;
  initialGoals: Goal[];
  initialCards: Card[];
  initialCardEvents: CardEvent[];
  initialMotm: Motm[];
  initialFormations: Formation[];
  rosterTeams: RosterTeam[];
  matches: { id: string; team_a: string; team_b: string; match_date: string | null; match_time: string | null; status: string | null }[];
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

      {tab === "goals" && <GoalsTab bracketId={bracketId} initial={initialGoals} rosterTeams={rosterTeams} />}
      {tab === "cards" && <CardsTab bracketId={bracketId} initial={initialCards} initialEvents={initialCardEvents} rosterTeams={rosterTeams} matches={matches} />}
      {tab === "motm" && <MotmTab bracketId={bracketId} initial={initialMotm} rosterTeams={rosterTeams} />}
      {tab === "totw" && <FormationTab bracketId={bracketId} initial={initialFormations[0] || null} rosterTeams={rosterTeams} />}
    </div>
  );
}

function GoalsTab({ bracketId, initial, rosterTeams }: { bracketId: string; initial: Goal[]; rosterTeams: RosterTeam[] }) {
  const [rows, setRows] = useState(initial);
  const [form, setForm] = useState({ player: "", team: "", roster_player_id: "", team_roster_id: "", goals: "1", image_url: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ player: "", team: "", roster_player_id: "", team_roster_id: "" });

  const add = async () => {
    if (!form.roster_player_id || !form.team_roster_id) return toast.error("Ø§Ø®ØªØ± Ù„Ø§Ø¹Ø¨Ù‹Ø§ Ù…Ù† Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„ÙØ±ÙŠÙ‚ Ø§Ù„Ø±Ø³Ù…ÙŠØ©");
    try {
      const payload: GoalCreatePayload = {
        table: "goals",
        bracket_id: bracketId,
        roster_player_id: form.roster_player_id,
        team_roster_id: form.team_roster_id,
        player_name: form.player,
        team_name: form.team,
        goals: Number(form.goals) || 1,
        image_url: form.image_url,
      };
      const res = await fetch("/api/admin/stats-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "ÙØ´Ù„ Ø§Ù„Ø­ÙØ¸");
      setRows((prev) => [...prev, data.row].sort((a, b) => (b.goals || 0) - (a.goals || 0)));
      setForm({ player: "", team: "", roster_player_id: "", team_roster_id: "", goals: "1", image_url: "" });
    } catch (e: unknown) {
      toast.error(errorMessage(e, "ÙØ´Ù„ Ø§Ù„Ø­ÙØ¸"));
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
      toast.error("ÙØ´Ù„ Ø§Ù„ØªØ­Ø¯ÙŠØ«");
    }
  };

  const remove = async (id: string) => {
    try {
      await fetch(`/api/admin/stats-entries?table=goals&id=${id}`, { method: "DELETE" });
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch {
      toast.error("ÙØ´Ù„ Ø§Ù„Ø­Ø°Ù");
    }
  };

  const beginEdit = (row: Goal) => {
    const team = rosterTeams.find((item) => item.id === row.team_roster_id) || rosterTeams.find((item) => item.team === row.team);
    const player = team?.players.find((item) => item.id === row.roster_player_id) || team?.players.find((item) => item.name === row.player);
    setEditingId(row.id);
    setEditForm({ player: player?.name || row.player || "", team: team?.team || row.team || "", roster_player_id: player?.id || row.roster_player_id || "", team_roster_id: team?.id || row.team_roster_id || "" });
  };

  const saveEdit = async (id: string) => {
    if (!editForm.roster_player_id || !editForm.team_roster_id) return toast.error("Ø§Ø®ØªØ± Ù„Ø§Ø¹Ø¨Ù‹Ø§ Ù…Ù† Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„ÙØ±ÙŠÙ‚ Ø§Ù„Ø±Ø³Ù…ÙŠØ©");
    const res = await fetch("/api/admin/stats-entries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ table: "goals", id, ...editForm, player_name: editForm.player, team_name: editForm.team }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(data?.error || "ÙØ´Ù„ ØªØ­Ø¯ÙŠØ« Ø§Ù„Ù„Ø§Ø¹Ø¨");
    setRows((prev) => prev.map((row) => row.id === id ? data.row : row));
    setEditingId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-2 rounded-2xl bg-card p-4 ring-1 ring-white/10">
        <TeamPlayerPicker
          rosterTeams={rosterTeams}
          team={form.team}
          player={form.player}
          rosterPlayerId={form.roster_player_id}
          teamRosterId={form.team_roster_id}
          imageUrl={form.image_url}
          requireRoster
          onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
        />
        <input type="number" value={form.goals} onChange={(e) => setForm({ ...form, goals: e.target.value })} className={`${inputCls} w-20 shrink-0`} />
        <button onClick={add} className="shrink-0 rounded-lg bg-primary px-4 py-2.5 text-caption font-black text-primary-foreground"><Plus className="h-4 w-4" /></button>
      </div>
      <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-white/10">
        {rows.length === 0 ? (
          <div className="p-8 text-center text-caption text-muted-foreground">Ù„Ø§ ÙŠÙˆØ¬Ø¯ Ù‡Ø¯Ø§ÙÙŠÙ†</div>
        ) : (
          rows.map((g) => {
            const display = resolveStatsPlayer(g, rosterTeams);
            return (
            <div key={g.id} className="relative flex items-center gap-3 border-b border-white/5 px-4 py-2.5 last:border-0">
              {g.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={g.image_url} alt={display.player} className="h-8 w-8 shrink-0 rounded-full object-cover" />
              ) : null}
              <div className="min-w-0 flex-1">
                <div className="truncate text-caption font-black">{display.player}</div>
                <div className="truncate text-[11px] text-muted-foreground">{display.team}</div>
              </div>
              <button onClick={() => updateGoals(g, -1)} className="h-7 w-7 rounded bg-red-500/15 font-black text-red-400">âˆ’</button>
              <span className="w-6 text-center text-caption font-black text-accent-orange">{g.goals}</span>
              <button onClick={() => updateGoals(g, 1)} className="h-7 w-7 rounded bg-accent-green/15 font-black text-accent-green">+</button>
              <button onClick={() => beginEdit(g)} aria-label="ØªØ¹Ø¯ÙŠÙ„ Ø§Ù„Ù„Ø§Ø¹Ø¨" className="rounded-lg bg-white/5 p-1.5 text-muted-foreground"><Pencil className="h-3.5 w-3.5" /></button>
              <button onClick={() => remove(g.id)} className="rounded-lg bg-red-500/15 p-1.5 text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
              {editingId === g.id && (
                <div className="absolute inset-x-2 z-10 mt-24 flex flex-wrap items-center gap-2 rounded-xl bg-card p-3 ring-1 ring-accent-blue/40">
                  <TeamPlayerPicker rosterTeams={rosterTeams} team={editForm.team} player={editForm.player} rosterPlayerId={editForm.roster_player_id} teamRosterId={editForm.team_roster_id} requireRoster onChange={(patch) => setEditForm((current) => ({ ...current, ...patch }))} />
                  <button onClick={() => void saveEdit(g.id)} aria-label="Ø­ÙØ¸ Ø§Ù„Ù„Ø§Ø¹Ø¨" className="rounded-lg bg-accent-green/15 p-2 text-accent-green"><Check className="h-4 w-4" /></button>
                  <button onClick={() => setEditingId(null)} aria-label="Ø¥Ù„ØºØ§Ø¡ ØªØ¹Ø¯ÙŠÙ„ Ø§Ù„Ù„Ø§Ø¹Ø¨" className="rounded-lg bg-white/5 p-2 text-muted-foreground"><X className="h-4 w-4" /></button>
                </div>
              )}
            </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function HistoricalCardDistribution({ row, events, matches, onSaved }: { row: Card; events: CardEvent[]; matches: { id: string; team_a: string; team_b: string; match_date: string | null; match_time: string | null; status: string | null }[]; onSaved: (events: CardEvent[]) => void }) {
  const total = Math.max(0, Number(row.yellow) || 0) + Math.max(0, Number(row.red) || 0);
  const sourceEvents = events.filter((event) => event.source_card_id === row.id);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Record<number, string>>(() => Object.fromEntries(sourceEvents.map((event) => [event.source_card_ordinal || 0, event.match_id])));
  const [saving, setSaving] = useState(false);
  if (!row.roster_player_id || !row.team_roster_id || total === 0) return null;
  const team = row.team || "";
  const options = matches.filter((match) => match.team_a === team || match.team_b === team);
  const types = [...Array(Math.max(0, Number(row.yellow) || 0)).fill("yellow" as const), ...Array(Math.max(0, Number(row.red) || 0)).fill("direct_red" as const)];
  const distributed = countAssignedCardEvents(row, selected);
  const save = async () => {
    setSaving(true);
    try {
      const eventsToSave = buildCardEventAssignments(row, selected);
      const res = await fetch("/api/admin/card-events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source_card_id: row.id, events: eventsToSave }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return toast.error(data?.error || "ØªØ¹Ø°Ø± ØªÙˆØ²ÙŠØ¹ Ø§Ù„Ø¨Ø·Ø§Ù‚Ø§Øª");
      onSaved(data.rows || []);
      setOpen(false);
    } finally { setSaving(false); }
  };
  return <div className="basis-full rounded-lg bg-secondary/50 p-2 text-[11px]" dir="rtl">
    <button type="button" className="font-bold underline" onClick={() => setOpen((value) => !value)}>{open ? "Ø¥Ø®ÙØ§Ø¡ ØªÙˆØ²ÙŠØ¹ Ø§Ù„Ø¨Ø·Ø§Ù‚Ø§Øª" : "ØªÙˆØ²ÙŠØ¹ Ø§Ù„Ø¨Ø·Ø§Ù‚Ø§Øª Ø§Ù„ØªØ§Ø±ÙŠØ®ÙŠØ©"}</button>
    <span className="mr-2 text-muted-foreground">Ù…ÙˆØ«Ù‚: {distributed} / {total} Â· Ù…ØªØ¨Ù‚Ù: {total - distributed}</span>
    {open && <div className="mt-2 space-y-2"><div className="text-muted-foreground">Ø§Ø®ØªØ± Ø§Ù„Ù…Ø¨Ø§Ø±Ø§Ø© Ø§Ù„ØµØ­ÙŠØ­Ø© Ù„ÙƒÙ„ Ø¨Ø·Ø§Ù‚Ø©. Ù„Ø§ ÙŠØªÙ… Ø§Ø®ØªÙŠØ§Ø± Ø£ÙŠ Ù…Ø¨Ø§Ø±Ø§Ø© ØªÙ„Ù‚Ø§Ø¦ÙŠÙ‹Ø§.</div>{types.map((card_type, index) => <label key={`${row.id}-${index + 1}`} className="flex items-center gap-2"><span className="w-20">{card_type === "yellow" ? "Ø¥Ù†Ø°Ø§Ø±" : "Ø·Ø±Ø¯ Ù…Ø¨Ø§Ø´Ø±"} {index + 1}</span><select value={selected[index + 1] || ""} onChange={(event) => setSelected((current) => ({ ...current, [index + 1]: event.target.value }))} className={`${inputCls} max-w-sm`}><option value="">Ø§Ø®ØªØ± Ø§Ù„Ù…Ø¨Ø§Ø±Ø§Ø©</option>{options.map((match) => <option key={match.id} value={match.id}>{match.team_a} Ã— {match.team_b} â€” {match.match_date || ""}</option>)}</select></label>)}<button type="button" disabled={saving} onClick={() => void save()} className="rounded-lg bg-primary px-3 py-2 font-bold text-primary-foreground">{saving ? "Ø¬Ø§Ø±Ù Ø§Ù„Ø­ÙØ¸..." : "Ø­ÙØ¸ Ø§Ù„ØªÙˆØ²ÙŠØ¹"}</button>{distributed < total && <div className="font-bold text-accent-orange">Ø§Ù„ØªÙˆØ²ÙŠØ¹ ØºÙŠØ± Ù…ÙƒØªÙ…Ù„ØŒ ÙˆÙ‚Ø¯ ØªÙƒÙˆÙ† Ø­Ø§Ù„Ø© Ø§Ù„Ø¥ÙŠÙ‚Ø§Ù ØºÙŠØ± Ù…ÙƒØªÙ…Ù„Ø©.</div>}</div>}
  </div>;
}

function CardsTab({ bracketId, initial, initialEvents, rosterTeams, matches }: { bracketId: string; initial: Card[]; initialEvents: CardEvent[]; rosterTeams: RosterTeam[]; matches: { id: string; team_a: string; team_b: string; match_date: string | null; match_time: string | null; status: string | null }[] }) {
  const [rows, setRows] = useState(initial);
  const [events, setEvents] = useState(initialEvents);
  const [eventForm, setEventForm] = useState({ team: "", player: "", roster_player_id: "", team_roster_id: "", match_id: "", card_type: "yellow" as "yellow" | "direct_red" });
  const eventIdempotencyKey = useRef<string | null>(null);
  const [form, setForm] = useState({ player: "", team: "", roster_player_id: "", team_roster_id: "", match_id: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ player: "", team: "", roster_player_id: "", team_roster_id: "", match_id: "" });

  const displayRows = addEventOnlyCardRows(rows, events, rosterTeams);

  const add = async () => {
    if (!form.roster_player_id || !form.team_roster_id || !form.match_id) return toast.error("Ø§Ø®ØªØ± Ø§Ù„Ù„Ø§Ø¹Ø¨ ÙˆØ§Ù„Ù…Ø¨Ø§Ø±Ø§Ø©");
    try {
      const payload: CardCreatePayload = {
        table: "cards",
        bracket_id: bracketId,
        roster_player_id: form.roster_player_id,
        team_roster_id: form.team_roster_id,
        match_id: form.match_id,
        player_name: form.player,
        team_name: form.team,
        yellow: 0,
        red: 0,
      };
      const res = await fetch("/api/admin/stats-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "ÙØ´Ù„ Ø§Ù„Ø­ÙØ¸");
      setRows((prev) => [...prev, data.row]);
      setForm({ player: "", team: "", roster_player_id: "", team_roster_id: "", match_id: "" });
    } catch (e: unknown) {
      toast.error(errorMessage(e, "ÙØ´Ù„ Ø§Ù„Ø­ÙØ¸"));
    }
  };

  const addEvent = async () => {
    if (!eventForm.roster_player_id || !eventForm.team_roster_id || !eventForm.match_id) return toast.error("Ø§Ø®ØªØ± Ø§Ù„ÙØ±ÙŠÙ‚ ÙˆØ§Ù„Ù„Ø§Ø¹Ø¨ ÙˆØ§Ù„Ù…Ø¨Ø§Ø±Ø§Ø©");
    eventIdempotencyKey.current ||= crypto.randomUUID();
    const res = await fetch("/api/admin/card-events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bracket_id: bracketId, ...eventForm, idempotency_key: eventIdempotencyKey.current }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(data?.error || "ØªØ¹Ø°Ø± Ø­ÙØ¸ Ø§Ù„Ø­Ø¯Ø«");
    setEvents((current) => current.some((event) => event.id === data.row.id) ? current : [...current, data.row]);
    eventIdempotencyKey.current = null;
    setEventForm({ team: "", player: "", roster_player_id: "", team_roster_id: "", match_id: "", card_type: "yellow" });
  };

  const removeEvent = async (id: string) => {
    const res = await fetch(`/api/admin/card-events?id=${id}`, { method: "DELETE" });
    if (!res.ok) return toast.error("ØªØ¹Ø°Ø± Ø­Ø°Ù Ø§Ù„Ø­Ø¯Ø«");
    setEvents((current) => current.filter((event) => event.id !== id));
  };

  const updateCard = async (row: Card, field: "yellow" | "red", delta: number) => {
    const value = Math.max(0, (row[field] || 0) + delta);
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, [field]: value } : r)));
    try {
      await fetch("/api/admin/stats-entries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ table: "cards", id: row.id, [field]: value }) });
    } catch {
      toast.error("ÙØ´Ù„ Ø§Ù„ØªØ­Ø¯ÙŠØ«");
    }
  };

  const remove = async (id: string) => {
    try {
      await fetch(`/api/admin/stats-entries?table=cards&id=${id}`, { method: "DELETE" });
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch {
      toast.error("ÙØ´Ù„ Ø§Ù„Ø­Ø°Ù");
    }
  };

  const beginEdit = (row: Card) => {
    const team = rosterTeams.find((item) => item.id === row.team_roster_id) || rosterTeams.find((item) => item.team === row.team);
    const player = team?.players.find((item) => item.id === row.roster_player_id) || team?.players.find((item) => item.name === row.player);
    setEditingId(row.id);
    setEditForm({ player: player?.name || row.player || "", team: team?.team || row.team || "", roster_player_id: player?.id || row.roster_player_id || "", team_roster_id: team?.id || row.team_roster_id || "", match_id: row.match_id || "" });
  };

  const saveEdit = async (id: string) => {
    if (!editForm.roster_player_id || !editForm.team_roster_id) return toast.error("Ø§Ø®ØªØ± Ù„Ø§Ø¹Ø¨Ù‹Ø§ Ù…Ù† Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„ÙØ±ÙŠÙ‚ Ø§Ù„Ø±Ø³Ù…ÙŠØ©");
    const res = await fetch("/api/admin/stats-entries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ table: "cards", id, ...editForm, player_name: editForm.player, team_name: editForm.team }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(data?.error || "ÙØ´Ù„ ØªØ­Ø¯ÙŠØ« Ø§Ù„Ù„Ø§Ø¹Ø¨");
    setRows((prev) => prev.map((row) => row.id === id ? data.row : row));
    setEditingId(null);
  };

  const updateDistributed = (cardId: string, next: CardEvent[]) => setEvents((current) => [...current.filter((event) => event.source_card_id !== cardId), ...next]);

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-2xl bg-card p-4 ring-1 ring-white/10">
        <div className="text-caption font-black">Ø£Ø­Ø¯Ø§Ø« Ø§Ù„Ø¨Ø·Ø§Ù‚Ø§Øª Ø§Ù„Ù…ÙˆØ«Ù‚Ø© Ù„ÙƒÙ„ Ù…Ø¨Ø§Ø±Ø§Ø©</div>
        <div className="flex flex-wrap items-start gap-2">
          <TeamPlayerPicker rosterTeams={rosterTeams} team={eventForm.team} player={eventForm.player} rosterPlayerId={eventForm.roster_player_id} teamRosterId={eventForm.team_roster_id} requireRoster trackPhoto={false} onChange={(patch) => { eventIdempotencyKey.current = null; setEventForm((current) => ({ ...current, ...patch, match_id: "" })); }} />
          <select value={eventForm.match_id} onChange={(e) => { eventIdempotencyKey.current = null; setEventForm((current) => ({ ...current, match_id: e.target.value })); }} className={`${inputCls} min-w-56`}><option value="">Ø§Ø®ØªØ± Ø§Ù„Ù…Ø¨Ø§Ø±Ø§Ø©</option>{matches.filter((match) => eventForm.team && (match.team_a === eventForm.team || match.team_b === eventForm.team)).map((match) => <option key={match.id} value={match.id}>{match.team_a} Ã— {match.team_b} â€” {match.match_date || ""}</option>)}</select>
          <select value={eventForm.card_type} onChange={(e) => { eventIdempotencyKey.current = null; setEventForm((current) => ({ ...current, card_type: e.target.value as "yellow" | "direct_red" })); }} className={`${inputCls} min-w-40`}><option value="yellow">Ø¥Ù†Ø°Ø§Ø±</option><option value="direct_red">Ø·Ø±Ø¯ Ù…Ø¨Ø§Ø´Ø±</option></select>
          <button onClick={() => void addEvent()} className="shrink-0 rounded-lg bg-primary px-4 py-2.5 text-caption font-black text-primary-foreground"><Plus className="h-4 w-4" /></button>
        </div>
        <div className="space-y-1 text-[11px] text-muted-foreground">{events.map((event) => <div key={event.id} className="flex items-center justify-between"><span>{event.card_type === "yellow" ? "Ø¥Ù†Ø°Ø§Ø±" : "Ø·Ø±Ø¯ Ù…Ø¨Ø§Ø´Ø±"} Â· {matches.find((match) => match.id === event.match_id)?.team_a} Ã— {matches.find((match) => match.id === event.match_id)?.team_b}</span><button onClick={() => void removeEvent(event.id)} aria-label="Ø­Ø°Ù Ø§Ù„Ø­Ø¯Ø«"><Trash2 className="h-3.5 w-3.5 text-red-400" /></button></div>)}</div>
      </div>
      <div className="flex flex-wrap items-start gap-2 rounded-2xl bg-card p-4 ring-1 ring-white/10">
        <TeamPlayerPicker
          rosterTeams={rosterTeams}
          team={form.team}
          player={form.player}
          rosterPlayerId={form.roster_player_id}
          teamRosterId={form.team_roster_id}
          requireRoster
          trackPhoto={false}
          onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
        />
        <select value={form.match_id} onChange={(e) => setForm((f) => ({ ...f, match_id: e.target.value }))} className={`${inputCls} min-w-56`}>
          <option value="">Ø§Ø®ØªØ± Ø§Ù„Ù…Ø¨Ø§Ø±Ø§Ø©</option>
          {matches.map((match) => <option key={match.id} value={match.id}>{match.team_a} - {match.team_b} ({match.match_date || ""})</option>)}
        </select>
        <button onClick={add} className="shrink-0 rounded-lg bg-primary px-4 py-2.5 text-caption font-black text-primary-foreground"><Plus className="h-4 w-4" /></button>
      </div>
      <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-white/10">
        {displayRows.length === 0 ? (
          <div className="p-8 text-center text-caption text-muted-foreground">Ù„Ø§ ØªÙˆØ¬Ø¯ Ø¨Ø·Ø§Ù‚Ø§Øª</div>
        ) : (
          displayRows.map((c) => {
            const display = resolveStatsPlayer(c, rosterTeams);
            const suspension = getSuspensionStateFromEvents(events.filter((event) => event.roster_player_id === c.roster_player_id), matches, rosterTeams);
            const totals = getCardTotalsWithEvents(c, events.filter((event) => event.roster_player_id === c.roster_player_id));
            return (
            <div key={c.id} className="relative flex items-center gap-3 border-b border-white/5 px-4 py-2.5 last:border-0">
              <div className="min-w-0 flex-1">
                <div className="truncate text-caption font-black">{display.player}</div>
                <div className="truncate text-[11px] text-muted-foreground">{display.team}</div>
                <div className="text-[10px] text-muted-foreground">Ø§Ù„Ø¥Ø¬Ù…Ø§Ù„ÙŠ: {totals.yellow} Ø¥Ù†Ø°Ø§Ø± Â· {totals.red} Ø·Ø±Ø¯ Â· Ø£Ø­Ø¯Ø§Ø« Ù…ÙˆØ«Ù‚Ø©: {events.filter((event) => event.roster_player_id === c.roster_player_id).length}</div>
                {suspension.needsMatchAssignment && <div className="text-[11px] font-bold text-accent-orange">ÙŠØ­ØªØ§Ø¬ ØªØ­Ø¯ÙŠØ¯ Ø§Ù„Ù…Ø¨Ø§Ø±Ø§Ø©</div>}
                {!suspension.needsMatchAssignment && (suspension.isSuspended ? <div className="text-[11px] font-bold text-destructive">Ù…ÙˆÙ‚ÙˆÙ Ù…Ø¨Ø§Ø±Ø§Ø© Â· {suspension.reason === "combined" ? "ØªØ±Ø§ÙƒÙ… 3 Ø¥Ù†Ø°Ø§Ø±Ø§Øª ÙˆØ·Ø±Ø¯ Ù…Ø¨Ø§Ø´Ø±" : suspension.reason === "direct_red" ? "Ø¨Ø·Ø§Ù‚Ø© Ø­Ù…Ø±Ø§Ø¡ Ù…Ø¨Ø§Ø´Ø±Ø©" : "ØªØ±Ø§ÙƒÙ… 3 Ø¥Ù†Ø°Ø§Ø±Ø§Øª"}</div> : <div className="text-[11px] font-bold text-accent-green">Ù…ØªØ§Ø­</div>)}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => updateCard(c as Card, "yellow", -1)} className="h-6 w-6 rounded bg-white/5 text-[11px] font-black">âˆ’</button>
                <span className="w-8 text-center text-[11px] font-black">ðŸŸ¨{c.yellow || 0}</span>
                <button onClick={() => updateCard(c as Card, "yellow", 1)} className="h-6 w-6 rounded bg-white/5 text-[11px] font-black">+</button>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => updateCard(c as Card, "red", -1)} className="h-6 w-6 rounded bg-white/5 text-[11px] font-black">âˆ’</button>
                <span className="w-8 text-center text-[11px] font-black">ðŸŸ¥{c.red || 0}</span>
                <button onClick={() => updateCard(c as Card, "red", 1)} className="h-6 w-6 rounded bg-white/5 text-[11px] font-black">+</button>
              </div>
              <button onClick={() => beginEdit(c as Card)} aria-label="ØªØ¹Ø¯ÙŠÙ„ Ø§Ù„Ù„Ø§Ø¹Ø¨" className="rounded-lg bg-white/5 p-1.5 text-muted-foreground"><Pencil className="h-3.5 w-3.5" /></button>
               <button onClick={() => remove(c.id || "")} className="rounded-lg bg-red-500/15 p-1.5 text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
               <HistoricalCardDistribution row={c as Card} events={events} matches={matches} onSaved={(next) => updateDistributed(c.id || "", next)} />
              {editingId === c.id && (
                <div className="absolute inset-x-2 z-10 mt-24 flex flex-wrap items-center gap-2 rounded-xl bg-card p-3 ring-1 ring-accent-blue/40">
                  <TeamPlayerPicker rosterTeams={rosterTeams} team={editForm.team} player={editForm.player} rosterPlayerId={editForm.roster_player_id} teamRosterId={editForm.team_roster_id} requireRoster trackPhoto={false} onChange={(patch) => setEditForm((current) => ({ ...current, ...patch }))} />
                  <select value={editForm.match_id} onChange={(e) => setEditForm((current) => ({ ...current, match_id: e.target.value }))} className={`${inputCls} min-w-56`}><option value="">Ø§Ø®ØªØ± Ø§Ù„Ù…Ø¨Ø§Ø±Ø§Ø©</option>{matches.map((match) => <option key={match.id} value={match.id}>{match.team_a} - {match.team_b} ({match.match_date || ""})</option>)}</select>
                  <button onClick={() => void saveEdit(c.id || "")} aria-label="Ø­ÙØ¸ Ø§Ù„Ù„Ø§Ø¹Ø¨" className="rounded-lg bg-accent-green/15 p-2 text-accent-green"><Check className="h-4 w-4" /></button>
                  <button onClick={() => setEditingId(null)} aria-label="Ø¥Ù„ØºØ§Ø¡ ØªØ¹Ø¯ÙŠÙ„ Ø§Ù„Ù„Ø§Ø¹Ø¨" className="rounded-lg bg-white/5 p-2 text-muted-foreground"><X className="h-4 w-4" /></button>
                </div>
              )}
            </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function MotmTab({ bracketId, initial, rosterTeams }: { bracketId: string; initial: Motm[]; rosterTeams: RosterTeam[] }) {
  const [rows, setRows] = useState(initial);
  const [form, setForm] = useState({ player: "", team: "", match_name: "", image_url: "" });

  const add = async () => {
    if (!form.player.trim() || !form.team.trim()) return toast.error("Ø§ÙƒØªØ¨ Ø§Ø³Ù… Ø§Ù„Ù„Ø§Ø¹Ø¨ ÙˆØ§Ù„ÙØ±ÙŠÙ‚");
    try {
      const res = await fetch("/api/admin/stats-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table: "motm", bracket_id: bracketId, player: form.player.trim(), team: form.team.trim(), match_name: form.match_name, image_url: form.image_url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "ÙØ´Ù„ Ø§Ù„Ø­ÙØ¸");
      setRows((prev) => [...prev, data.row]);
      setForm({ player: "", team: "", match_name: "", image_url: "" });
    } catch (e: unknown) {
      toast.error(errorMessage(e, "ÙØ´Ù„ Ø§Ù„Ø­ÙØ¸"));
    }
  };

  const remove = async (id: string) => {
    try {
      await fetch(`/api/admin/stats-entries?table=motm&id=${id}`, { method: "DELETE" });
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch {
      toast.error("ÙØ´Ù„ Ø§Ù„Ø­Ø°Ù");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-2 rounded-2xl bg-card p-4 ring-1 ring-white/10">
        <TeamPlayerPicker
          rosterTeams={rosterTeams}
          team={form.team}
          player={form.player}
          imageUrl={form.image_url}
          onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
        />
        <input value={form.match_name} onChange={(e) => setForm({ ...form, match_name: e.target.value })} placeholder="Ø§Ø³Ù… Ø§Ù„Ù…Ø¨Ø§Ø±Ø§Ø© (Ø§Ø®ØªÙŠØ§Ø±ÙŠ)" className={`${inputCls} flex-1`} />
        <button onClick={add} className="shrink-0 rounded-lg bg-primary px-4 py-2.5 text-caption font-black text-primary-foreground"><Plus className="h-4 w-4" /></button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.length === 0 ? (
          <div className="col-span-full rounded-2xl bg-card p-8 text-center text-caption text-muted-foreground ring-1 ring-white/10">Ù„Ø§ ÙŠÙˆØ¬Ø¯ Ù†Ø¬ÙˆÙ… Ù…Ø¨Ø§Ø±ÙŠØ§Øª</div>
        ) : (
          rows.map((m) => {
            const display = resolveStatsPlayer(m, rosterTeams);
            return (
            <div key={m.id} className="flex items-center gap-3 rounded-2xl bg-card p-3 ring-1 ring-white/10">
              {m.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.image_url} alt={display.player} className="h-6 w-6 shrink-0 rounded-full object-cover" />
              ) : (
                <Star className="h-6 w-6 shrink-0 text-accent-orange" />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-caption font-black">{display.player}</div>
                <div className="truncate text-[11px] text-muted-foreground">{display.team} {m.match_name ? `â€¢ ${m.match_name}` : ""}</div>
              </div>
              <button onClick={() => remove(m.id)} className="shrink-0 rounded-lg bg-red-500/15 p-1.5 text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function FormationTab({ bracketId, initial, rosterTeams }: { bracketId: string; initial: Formation | null; rosterTeams: RosterTeam[] }) {
  const [round, setRound] = useState(initial?.round || "");
  const [coachName, setCoachName] = useState(initial?.coach_name || "");
  const [coachTeam, setCoachTeam] = useState(initial?.coach_team || "");
  const [coachImageUrl, setCoachImageUrl] = useState(initial?.coach_image_url || "");
  const [players, setPlayers] = useState<FormationPlayer[]>(
    initial?.formation_players?.length ? [...initial.formation_players].sort((a, b) => a.slot_index - b.slot_index) : Array.from({ length: 7 }, (_, i) => ({ name: "", team: "", image_url: "", slot_index: i }))
  );
  const [formationId, setFormationId] = useState(initial?.id || null);
  const [saving, setSaving] = useState(false);

  const updatePlayer = (i: number, patch: Partial<FormationPlayer>) => {
    setPlayers((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  };

  const save = async () => {
    if (!round.trim()) return toast.error("Ø§ÙƒØªØ¨ Ø§Ø³Ù… Ø§Ù„Ø¬ÙˆÙ„Ø©/Ø§Ù„Ø¯ÙˆØ±");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/formations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: formationId, bracket_id: bracketId, round: round.trim(), coach_name: coachName, coach_team: coachTeam, coach_image_url: coachImageUrl, players }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "ÙØ´Ù„ Ø§Ù„Ø­ÙØ¸");
      setFormationId(data.formation.id);
      toast.success("ØªÙ… Ø­ÙØ¸ ØªØ´ÙƒÙŠÙ„Ø© Ø§Ù„Ø¬ÙˆÙ„Ø©");
    } catch (e: unknown) {
      toast.error(errorMessage(e, "ÙØ´Ù„ Ø§Ù„Ø­ÙØ¸"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 rounded-2xl bg-card p-4 ring-1 ring-white/10 sm:grid-cols-3">
        <input value={round} onChange={(e) => setRound(e.target.value)} placeholder="Ø§Ø³Ù… Ø§Ù„Ø¬ÙˆÙ„Ø©/Ø§Ù„Ø¯ÙˆØ±" className={inputCls} />
        <input value={coachName} onChange={(e) => setCoachName(e.target.value)} placeholder="Ø§Ø³Ù… Ø§Ù„Ù…Ø¯Ø±Ø¨ (Ø§Ø®ØªÙŠØ§Ø±ÙŠ)" className={inputCls} />
        <input value={coachTeam} onChange={(e) => setCoachTeam(e.target.value)} placeholder="ÙØ±ÙŠÙ‚ Ø§Ù„Ù…Ø¯Ø±Ø¨" className={inputCls} />
      </div>
      {(() => {
        const registeredCoach = rosterTeams.find((t) => t.team === coachTeam && t.coachName);
        if (!registeredCoach) return null;
        return (
          <button
            type="button"
            onClick={() => {
              setCoachName(registeredCoach.coachName || "");
              setCoachImageUrl(registeredCoach.coachPhotoUrl || "");
            }}
            className="flex w-full items-center justify-between gap-2 rounded-xl bg-accent-blue/10 px-4 py-2.5 text-caption font-bold text-accent-blue ring-1 ring-accent-blue/30"
          >
            Ø§Ø³ØªØ®Ø¯Ø§Ù… Ø§Ù„Ù…Ø¯Ø±Ø¨ Ø§Ù„Ù…Ø³Ø¬Ù‘Ù„: {registeredCoach.coachName}
          </button>
        );
      })()}
      {coachName.trim() && (
        <div className="flex items-center gap-2 rounded-2xl bg-card p-3 ring-1 ring-white/10">
          <PhotoUploadButton onUploaded={setCoachImageUrl} />
          {coachImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coachImageUrl} alt={coachName} className="h-8 w-8 rounded-full object-cover ring-1 ring-white/10" />
          )}
          <span className="text-[11px] text-muted-foreground">ØµÙˆØ±Ø© Ø§Ù„Ù…Ø¯Ø±Ø¨ (Ø§Ø®ØªÙŠØ§Ø±ÙŠ)</span>
        </div>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {players.map((p, i) => (
          <div key={i} className="flex gap-2 rounded-xl bg-card p-2 ring-1 ring-white/10">
            <span className="mt-2 w-5 shrink-0 text-center text-[11px] font-black text-muted-foreground">{i + 1}</span>
            <TeamPlayerPicker
              rosterTeams={rosterTeams}
              team={p.team}
              player={p.name}
              imageUrl={p.image_url}
              onChange={(patch) =>
                updatePlayer(i, {
                  ...(patch.team !== undefined ? { team: patch.team } : {}),
                  ...(patch.player !== undefined ? { name: patch.player } : {}),
                  ...(patch.image_url !== undefined ? { image_url: patch.image_url } : {}),
                })
              }
            />
          </div>
        ))}
      </div>
      <button onClick={save} disabled={saving} className="rounded-xl bg-primary px-5 py-2.5 text-caption font-black text-primary-foreground disabled:opacity-60">
        Ø­ÙØ¸ ØªØ´ÙƒÙŠÙ„Ø© Ø§Ù„Ø¬ÙˆÙ„Ø©
      </button>
    </div>
  );
}

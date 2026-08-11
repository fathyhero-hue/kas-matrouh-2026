"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Edit, Trash2, Lock, Unlock, Save, Plus, Upload, X } from "lucide-react";

type Player = { id?: string; name: string; number: string; personal_image_url: string; id_image_url: string };
type Roster = {
  id: string;
  bracket_id: string;
  team_name: string;
  team_slug: string;
  manager_name: string | null;
  manager_phone: string | null;
  logo_url: string | null;
  coach_name: string | null;
  coach_photo_url: string | null;
  access_password: string | null;
  is_submitted: boolean;
  roster_players: Player[];
};

const inputCls = "h-10 w-full rounded-lg bg-secondary px-3 text-caption font-bold outline-none ring-1 ring-white/10 focus:ring-accent-blue";

function slugify(name: string) {
  return name.trim().replace(/\s+/g, "_").replace(/[^\p{L}\p{N}_-]/gu, "").slice(0, 80) || "team";
}

// Uploads straight to /api/roster/upload-photo (same endpoint the public
// roster form uses) and hands the resulting URL back — used for the team
// logo, the coach photo, and each player's two photos.
function PhotoUploadButton({ rosterId, kind, playerId, onUploaded, small }: { rosterId: string; kind: "logo" | "coach" | "personal" | "id"; playerId?: string; onUploaded: (url: string) => void; small?: boolean }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("rosterId", rosterId);
      fd.set("kind", kind);
      if (playerId) fd.set("playerId", playerId);
      fd.set("file", file);
      const res = await fetch("/api/roster/upload-photo", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "فشل رفع الصورة");
      onUploaded(data.url);
      toast.success("تم رفع الصورة");
    } catch (e: any) {
      toast.error(e?.message || "فشل رفع الصورة");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={`flex shrink-0 items-center gap-1 rounded-lg bg-accent-blue/15 font-black text-accent-blue disabled:opacity-60 ${small ? "px-2 py-1 text-[10px]" : "px-3 py-2 text-[11px]"}`}
      >
        <Upload className={small ? "h-3 w-3" : "h-3.5 w-3.5"} /> {uploading ? "..." : "رفع صورة"}
      </button>
    </>
  );
}

export function RostersManager({
  bracketId,
  initialRosters,
  registrationKey,
  initialSettings,
  maxPlayers,
  allowCreate = true,
}: {
  bracketId: string;
  initialRosters: Roster[];
  registrationKey?: string;
  initialSettings: { deadline: string; password: string; price: number } | null;
  maxPlayers: number;
  allowCreate?: boolean;
}) {
  const [rosters, setRosters] = useState<Roster[]>(initialRosters);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<any>(null);
  const [settings, setSettings] = useState(initialSettings || { deadline: "", password: "", price: 0 });
  const [savingSettings, setSavingSettings] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");

  const saveSettings = async () => {
    if (!registrationKey) return;
    setSavingSettings(true);
    try {
      const res = await fetch("/api/admin/registration-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournament: registrationKey, ...settings }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "فشل الحفظ");
      toast.success("تم حفظ إعدادات التسجيل");
    } catch (e: any) {
      toast.error(e?.message || "فشل حفظ الإعدادات");
    } finally {
      setSavingSettings(false);
    }
  };

  const startEdit = (r: Roster) => {
    setEditingId(r.id);
    setDraft({
      manager_name: r.manager_name || "",
      manager_phone: r.manager_phone || "",
      logo_url: r.logo_url || "",
      coach_name: r.coach_name || "",
      coach_photo_url: r.coach_photo_url || "",
      access_password: r.access_password || "",
      is_submitted: r.is_submitted,
      players: Array.from({ length: maxPlayers }, (_, i) => {
        const existing = (r.roster_players || []).find((p: any) => p.slot_index === i) || r.roster_players?.[i];
        return existing
          ? { id: existing.id, name: existing.name || "", number: existing.number || "", personal_image_url: existing.personal_image_url || "", id_image_url: existing.id_image_url || "" }
          : { name: "", number: "", personal_image_url: "", id_image_url: "" };
      }),
    });
  };

  // Saving keeps the panel open (rather than closing it) — the returned
  // player ids are merged in immediately so the photo-upload buttons below
  // become usable in the same session without reopening the editor.
  const saveRoster = async (id: string, { silent = false }: { silent?: boolean } = {}) => {
    try {
      const res = await fetch("/api/admin/rosters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          manager_name: draft.manager_name,
          manager_phone: draft.manager_phone,
          logo_url: draft.logo_url,
          coach_name: draft.coach_name,
          coach_photo_url: draft.coach_photo_url,
          access_password: draft.access_password,
          is_submitted: draft.is_submitted,
          players: draft.players,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "فشل الحفظ");
      const playerIds = (data.playerIds || []) as string[];
      setDraft((prev: any) => ({ ...prev, players: prev.players.map((p: Player, i: number) => ({ ...p, id: playerIds[i] || p.id })) }));
      setRosters((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, ...data.roster, roster_players: draft.players.map((p: Player, i: number) => ({ ...p, id: playerIds[i] || p.id, slot_index: i })) }
            : r
        )
      );
      if (!silent) toast.success("تم حفظ القائمة");
    } catch (e: any) {
      toast.error(e?.message || "فشل حفظ القائمة");
    }
  };

  const closeEdit = () => {
    setEditingId(null);
    setDraft(null);
  };

  const toggleLock = async (r: Roster) => {
    try {
      const res = await fetch("/api/admin/rosters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: r.id, is_submitted: !r.is_submitted }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "فشلت العملية");
      setRosters((prev) => prev.map((x) => (x.id === r.id ? { ...x, is_submitted: !r.is_submitted } : x)));
    } catch (e: any) {
      toast.error(e?.message || "فشلت العملية");
    }
  };

  const deleteRoster = async (id: string) => {
    if (!confirm("متأكد من حذف قائمة هذا الفريق نهائياً؟")) return;
    try {
      const res = await fetch(`/api/admin/rosters?id=${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "فشل الحذف");
      setRosters((prev) => prev.filter((r) => r.id !== id));
      toast.success("تم حذف الفريق");
    } catch (e: any) {
      toast.error(e?.message || "فشل حذف الفريق");
    }
  };

  const createRoster = async () => {
    if (!newTeamName.trim()) return toast.error("اكتب اسم الفريق");
    try {
      const res = await fetch("/api/admin/rosters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bracket_id: bracketId,
          team_name: newTeamName.trim(),
          team_slug: slugify(newTeamName),
          is_submitted: false,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "فشل الإنشاء");
      setRosters((prev) => [...prev, { ...data.roster, roster_players: [] }]);
      setNewTeamName("");
      setCreating(false);
      toast.success("تم إضافة الفريق");
    } catch (e: any) {
      toast.error(e?.message || "فشل إضافة الفريق");
    }
  };

  const updateDraftPlayer = (i: number, field: keyof Player, value: string) => {
    setDraft((prev: any) => {
      const players = [...prev.players];
      players[i] = { ...players[i], [field]: value };
      return { ...prev, players };
    });
  };

  return (
    <div className="space-y-6">
      {registrationKey && (
        <div className="rounded-2xl bg-card p-4 ring-1 ring-white/10 sm:p-5">
          <h2 className="mb-3 text-h3 font-black">إعدادات التسجيل</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-[10px] font-bold text-muted-foreground">آخر موعد للتسجيل</label>
              <input type="date" value={settings.deadline || ""} onChange={(e) => setSettings({ ...settings, deadline: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold text-muted-foreground">كلمة سر التسجيل العامة</label>
              <input value={settings.password || ""} onChange={(e) => setSettings({ ...settings, password: e.target.value })} dir="ltr" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold text-muted-foreground">سعر التسجيل (ج.م)</label>
              <input type="number" value={settings.price || 0} onChange={(e) => setSettings({ ...settings, price: Number(e.target.value) })} className={inputCls} />
            </div>
          </div>
          <button onClick={saveSettings} disabled={savingSettings} className="mt-3 rounded-xl bg-primary px-5 py-2 text-caption font-black text-primary-foreground disabled:opacity-60">
            حفظ الإعدادات
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-h3 font-black">قوائم الفرق ({rosters.length})</h2>
        {allowCreate && (
          <button onClick={() => setCreating((v) => !v)} className="flex items-center gap-1.5 rounded-full bg-accent-blue/15 px-3 py-1.5 text-caption font-black text-accent-blue">
            <Plus className="h-3.5 w-3.5" /> إضافة فريق
          </button>
        )}
      </div>

      {allowCreate && creating && (
        <div className="flex gap-2 rounded-2xl bg-card p-4 ring-1 ring-white/10">
          <input value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} placeholder="اسم الفريق الجديد" className={inputCls} />
          <button onClick={createRoster} className="shrink-0 rounded-xl bg-primary px-4 py-2 text-caption font-black text-primary-foreground">إضافة</button>
        </div>
      )}

      {rosters.length === 0 ? (
        <div className="rounded-2xl bg-card p-8 text-center text-caption text-muted-foreground ring-1 ring-white/10">لا توجد فرق مسجّلة</div>
      ) : (
        <div className="space-y-3">
          {rosters.map((r) => {
            const registeredCount = (r.roster_players || []).filter((p) => p.name?.trim()).length;
            const isEditing = editingId === r.id;
            return (
              <div key={r.id} className="overflow-hidden rounded-2xl bg-card ring-1 ring-white/10">
                <div className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-body font-black">{r.team_name}</div>
                    <div className="text-[11px] text-muted-foreground">{r.manager_name || "—"} <span dir="ltr">{r.manager_phone || ""}</span></div>
                  </div>
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-black text-accent-orange">{registeredCount}/{maxPlayers}</span>
                  {r.is_submitted ? (
                    <span className="rounded-full bg-accent-green/15 px-2.5 py-1 text-[10px] font-black text-accent-green">مقفولة</span>
                  ) : (
                    <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-black text-muted-foreground">مفتوحة</span>
                  )}
                  <div className="flex shrink-0 gap-1.5">
                    <button onClick={() => (isEditing ? closeEdit() : startEdit(r))} className="rounded-lg bg-accent-blue/15 p-2 text-accent-blue">
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => toggleLock(r)} className={`rounded-lg p-2 ${r.is_submitted ? "bg-accent-orange/15 text-accent-orange" : "bg-accent-green/15 text-accent-green"}`}>
                      {r.is_submitted ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                    </button>
                    <button onClick={() => deleteRoster(r.id)} className="rounded-lg bg-red-500/15 p-2 text-red-400">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {isEditing && draft && (
                  <div className="space-y-3 border-t border-white/10 p-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <input value={draft.manager_name} onChange={(e) => setDraft({ ...draft, manager_name: e.target.value })} placeholder="اسم المسئول" className={inputCls} />
                      <input value={draft.manager_phone} onChange={(e) => setDraft({ ...draft, manager_phone: e.target.value })} placeholder="رقم الهاتف" dir="ltr" className={inputCls} />
                      <input value={draft.access_password} onChange={(e) => setDraft({ ...draft, access_password: e.target.value })} placeholder="باسورد الفريق" dir="ltr" className={inputCls} />
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="flex items-center gap-2 rounded-xl bg-secondary/60 p-2">
                        {draft.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={draft.logo_url} alt="" className="h-9 w-9 shrink-0 rounded-full object-contain ring-1 ring-white/10" />
                        ) : (
                          <div className="h-9 w-9 shrink-0 rounded-full bg-white/5" />
                        )}
                        <span className="flex-1 text-[11px] font-bold text-muted-foreground">شعار الفريق</span>
                        <PhotoUploadButton rosterId={r.id} kind="logo" onUploaded={(url) => setDraft({ ...draft, logo_url: url })} />
                      </div>
                      <div className="flex items-center gap-2 rounded-xl bg-secondary/60 p-2">
                        {draft.coach_photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={draft.coach_photo_url} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-white/10" />
                        ) : (
                          <div className="h-9 w-9 shrink-0 rounded-full bg-white/5" />
                        )}
                        <input value={draft.coach_name} onChange={(e) => setDraft({ ...draft, coach_name: e.target.value })} placeholder="اسم المدرب" className="h-8 flex-1 rounded-lg bg-secondary px-2 text-[12px] font-bold outline-none ring-1 ring-white/10" />
                        <PhotoUploadButton rosterId={r.id} kind="coach" onUploaded={(url) => setDraft({ ...draft, coach_photo_url: url })} small />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {draft.players.map((p: Player, i: number) => (
                        <div key={i} className="space-y-1.5 rounded-xl bg-secondary/60 p-2">
                          <div className="flex items-center gap-2">
                            <span className="w-5 shrink-0 text-center text-[11px] font-black text-muted-foreground">{i + 1}</span>
                            {p.personal_image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.personal_image_url} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                            ) : (
                              <div className="h-8 w-8 shrink-0 rounded-full bg-white/5" />
                            )}
                            <input value={p.name} onChange={(e) => updateDraftPlayer(i, "name", e.target.value)} placeholder="اسم اللاعب" className="h-8 flex-1 rounded-lg bg-secondary px-2 text-[12px] font-bold outline-none ring-1 ring-white/10" />
                            <input value={p.number} onChange={(e) => updateDraftPlayer(i, "number", e.target.value)} placeholder="#" className="h-8 w-10 rounded-lg bg-secondary px-1 text-center text-[12px] font-bold outline-none ring-1 ring-white/10" />
                          </div>
                          {p.id ? (
                            <div className="flex items-center gap-1.5 pr-7">
                              <PhotoUploadButton rosterId={r.id} kind="personal" playerId={p.id} onUploaded={(url) => updateDraftPlayer(i, "personal_image_url", url)} small />
                              <PhotoUploadButton rosterId={r.id} kind="id" playerId={p.id} onUploaded={(url) => updateDraftPlayer(i, "id_image_url", url)} small />
                              {p.id_image_url && (
                                <a href={p.id_image_url} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-accent-blue underline">عرض البطاقة</a>
                              )}
                            </div>
                          ) : (
                            <div className="pr-7 text-[10px] text-muted-foreground">احفظ اسم اللاعب الأول عشان ترفع صوره</div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-3">
                      <button onClick={() => saveRoster(r.id)} className="flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-caption font-black text-primary-foreground">
                        <Save className="h-3.5 w-3.5" /> حفظ بيانات القائمة
                      </button>
                      <button onClick={closeEdit} className="flex items-center gap-1.5 rounded-xl bg-white/5 px-5 py-2.5 text-caption font-black text-muted-foreground">
                        <X className="h-3.5 w-3.5" /> تم
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Trash2, Plus, Trophy } from "lucide-react";

type PlayerTournament = { id: string; name: string; logo_url: string | null; sort_order: number | null; is_active: boolean };

const inputCls = "h-10 w-full rounded-lg bg-secondary px-3 text-caption font-bold outline-none ring-1 ring-white/10 focus:ring-accent-blue";

export function PlayerTournamentsManager({ initial }: { initial: PlayerTournament[] }) {
  const [rows, setRows] = useState(initial);
  const [name, setName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const add = async () => {
    if (!name.trim()) return toast.error("اكتب اسم البطولة");
    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("name", name.trim());
      fd.set("sort_order", String(rows.length));
      fd.set("is_active", "true");
      if (logoFile) fd.set("logo", logoFile);
      const res = await fetch("/api/admin/player-tournaments", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "فشل الحفظ");
      setRows((prev) => [...prev, data.tournament]);
      setName("");
      setLogoFile(null);
      setLogoPreview("");
      if (fileRef.current) fileRef.current.value = "";
      toast.success("تم إضافة البطولة");
    } catch (e: any) {
      toast.error(e?.message || "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (t: PlayerTournament) => {
    try {
      const res = await fetch("/api/admin/player-tournaments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: t.id, is_active: !t.is_active }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "فشلت العملية");
      setRows((prev) => prev.map((x) => (x.id === t.id ? { ...x, is_active: !t.is_active } : x)));
    } catch (e: any) {
      toast.error(e?.message || "فشلت العملية");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("متأكد من حذف هذه البطولة من صفحة تسجيل اللاعبين؟")) return;
    try {
      const res = await fetch(`/api/admin/player-tournaments?id=${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "فشل الحذف");
      setRows((prev) => prev.filter((t) => t.id !== id));
      toast.success("تم الحذف");
    } catch (e: any) {
      toast.error(e?.message || "فشل الحذف");
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-h3 font-black">بطولات تسجيل اللاعبين (تظهر في صفحة /player-card)</h2>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-card p-4 ring-1 ring-white/10">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary">
          {logoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoPreview} alt="" className="h-full w-full object-contain" />
          ) : (
            <Trophy className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setLogoFile(f);
            setLogoPreview(URL.createObjectURL(f));
          }}
        />
        <button onClick={() => fileRef.current?.click()} className="rounded-lg bg-accent-blue/15 p-2.5 text-accent-blue"><Camera className="h-4 w-4" /></button>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم البطولة" className={`${inputCls} flex-1`} />
        <button onClick={add} disabled={saving} className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-caption font-black text-primary-foreground disabled:opacity-60">
          <Plus className="h-4 w-4" /> إضافة
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.length === 0 ? (
          <div className="col-span-full rounded-2xl bg-card p-8 text-center text-caption text-muted-foreground ring-1 ring-white/10">لا توجد بطولات تسجيل بعد</div>
        ) : (
          rows.map((t) => (
            <div key={t.id} className="flex items-center gap-3 rounded-2xl bg-card p-3 ring-1 ring-white/10">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary">
                {t.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.logo_url} alt="" className="h-full w-full object-contain" />
                ) : (
                  <Trophy className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1 truncate text-caption font-black">{t.name}</div>
              <button onClick={() => toggleActive(t)} className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[10px] font-black ${t.is_active === false ? "bg-accent-green/15 text-accent-green" : "bg-white/5 text-muted-foreground"}`}>
                {t.is_active === false ? "إظهار" : "إخفاء"}
              </button>
              <button onClick={() => remove(t.id)} className="shrink-0 rounded-lg bg-red-500/15 p-1.5 text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

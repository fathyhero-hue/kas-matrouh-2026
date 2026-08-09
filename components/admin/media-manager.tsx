"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Trash2, Plus, Newspaper } from "lucide-react";

type Media = { id: string; type: string | null; title: string | null; url: string | null; image_url: string | null; body: string | null };

const inputCls = "h-10 w-full rounded-lg bg-secondary px-3 text-caption font-bold outline-none ring-1 ring-white/10 focus:ring-accent-blue";

export function MediaManager({ initialMedia, initialTicker, bracketId }: { initialMedia: Media[]; initialTicker: string; bracketId?: string }) {
  const [items, setItems] = useState(initialMedia);
  const [form, setForm] = useState({ type: "news", title: "", url: "", image_url: "", body: "" });
  const [ticker, setTicker] = useState(initialTicker);
  const [savingTicker, setSavingTicker] = useState(false);

  const saveTicker = async () => {
    setSavingTicker(true);
    try {
      const res = await fetch("/api/admin/ticker", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: ticker }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "فشل الحفظ");
      toast.success("تم حفظ شريط الأخبار");
    } catch (e: any) {
      toast.error(e?.message || "فشل الحفظ");
    } finally {
      setSavingTicker(false);
    }
  };

  const add = async () => {
    if (!form.title.trim()) return toast.error("اكتب عنوان الخبر");
    if (!bracketId) return toast.error("تعذر تحديد بطولة لإضافة الخبر");
    try {
      const res = await fetch("/api/admin/media", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, bracket_id: bracketId }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "فشل الحفظ");
      setItems((prev) => [data.row, ...prev]);
      setForm({ type: "news", title: "", url: "", image_url: "", body: "" });
      toast.success("تم إضافة الخبر");
    } catch (e: any) {
      toast.error(e?.message || "فشل الحفظ");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("متأكد من حذف هذا الخبر؟")) return;
    try {
      await fetch(`/api/admin/media?id=${id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch {
      toast.error("فشل الحذف");
    }
  };

  return (
    <div className="space-y-8">
      <div className="rounded-2xl bg-card p-4 ring-1 ring-white/10 sm:p-5">
        <h2 className="mb-3 text-h3 font-black">شريط الأخبار المتحرك</h2>
        <div className="flex gap-2">
          <input value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="النص اللي يظهر أعلى الصفحة الرئيسية" className={inputCls} />
          <button onClick={saveTicker} disabled={savingTicker} className="shrink-0 rounded-xl bg-primary px-5 text-caption font-black text-primary-foreground disabled:opacity-60">حفظ</button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl bg-card p-4 ring-1 ring-white/10 sm:p-5">
          <h2 className="mb-3 text-h3 font-black">إضافة خبر جديد</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={inputCls}>
              <option value="news">خبر</option>
              <option value="videos">فيديو</option>
            </select>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="العنوان" className={inputCls} />
            <input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="رابط الصورة" dir="ltr" className={inputCls} />
            <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="رابط الخبر/الفيديو (اختياري)" dir="ltr" className={inputCls} />
            <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="نص مختصر" className="h-20 rounded-lg bg-secondary px-3 py-2 text-caption font-bold outline-none ring-1 ring-white/10 focus:ring-accent-blue sm:col-span-2" />
          </div>
          <button onClick={add} className="mt-3 flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-caption font-black text-primary-foreground">
            <Plus className="h-4 w-4" /> إضافة الخبر
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.length === 0 ? (
            <div className="col-span-full rounded-2xl bg-card p-8 text-center text-caption text-muted-foreground ring-1 ring-white/10">لا توجد أخبار بعد</div>
          ) : (
            items.map((m) => (
              <div key={m.id} className="overflow-hidden rounded-2xl bg-card ring-1 ring-white/10">
                <div className="flex h-24 items-center justify-center bg-secondary">
                  {m.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Newspaper className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="space-y-1.5 p-3">
                  <div className="truncate text-caption font-black">{m.title}</div>
                  <button onClick={() => remove(m.id)} className="w-full rounded-lg bg-red-500/15 py-1.5 text-[10px] font-black text-red-400">
                    <Trash2 className="mx-auto h-3 w-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

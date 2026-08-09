"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Trash2, Ban } from "lucide-react";

type Banned = { id: string; name: string; type: "player" | "team" };

const inputCls = "h-10 w-full rounded-lg bg-secondary px-3 text-caption font-bold outline-none ring-1 ring-white/10 focus:ring-accent-blue";

export function BannedListManager({ initial }: { initial: Banned[] }) {
  const [rows, setRows] = useState(initial);
  const [name, setName] = useState("");
  const [type, setType] = useState<"player" | "team">("player");

  const add = async () => {
    if (!name.trim()) return toast.error("اكتب الاسم");
    try {
      const res = await fetch("/api/admin/banned-entities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), type }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "فشل الحفظ");
      setRows((prev) => [...prev, data.row]);
      setName("");
    } catch (e: any) {
      toast.error(e?.message || "فشل الحفظ");
    }
  };

  const remove = async (id: string) => {
    try {
      await fetch(`/api/admin/banned-entities?id=${id}`, { method: "DELETE" });
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch {
      toast.error("فشل الحذف");
    }
  };

  return (
    <div className="rounded-2xl bg-card p-4 ring-1 ring-white/10 sm:p-5">
      <h2 className="mb-3 flex items-center gap-2 text-h3 font-black">
        <Ban className="h-4 w-4 text-red-400" /> قائمة الحظر (فرق ولاعبين مستبعدين من التسجيل)
      </h2>
      <div className="flex gap-2">
        <select value={type} onChange={(e) => setType(e.target.value as any)} className={`${inputCls} w-28`}>
          <option value="player">لاعب</option>
          <option value="team">فريق</option>
        </select>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم" className={`${inputCls} flex-1`} />
        <button onClick={add} className="shrink-0 rounded-xl bg-red-500/15 px-4 text-caption font-black text-red-400">حظر</button>
      </div>
      <div className="mt-3 max-h-56 space-y-1.5 overflow-y-auto">
        {rows.length === 0 ? (
          <div className="py-4 text-center text-[11px] text-muted-foreground">لا يوجد محظورين</div>
        ) : (
          rows.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-xl bg-secondary/60 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${b.type === "team" ? "bg-primary/20 text-primary" : "bg-accent-orange/15 text-accent-orange"}`}>{b.type === "team" ? "فريق" : "لاعب"}</span>
                <span className="text-caption font-bold">{b.name}</span>
              </div>
              <button onClick={() => remove(b.id)} className="rounded-lg bg-red-500/15 p-1.5 text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

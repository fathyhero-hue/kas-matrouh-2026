"use client";

import { useState } from "react";
import { toast } from "sonner";
import { BellRing, Loader2 } from "lucide-react";

const inputCls = "h-10 w-full rounded-lg bg-secondary px-3 text-caption font-bold outline-none ring-1 ring-white/10 focus:ring-accent-blue";

export function NotificationsManager() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const send = async (t?: string, b?: string) => {
    const finalTitle = (t ?? title).trim();
    const finalBody = (b ?? body).trim();
    if (!finalTitle || !finalBody) return toast.error("اكتب عنوان الإشعار والتفاصيل");
    setSending(true);
    try {
      const res = await fetch("/api/push-service", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: finalTitle, body: finalBody }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data?.error || "فشل إرسال الإشعار");
      toast.success(`تم الإرسال${typeof data.recipients === "number" ? ` لـ ${data.recipients} متابع` : ""}`);
      setTitle("");
      setBody("");
    } catch (e: any) {
      toast.error(e?.message || "فشل إرسال الإشعار");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4 rounded-2xl bg-card p-4 ring-1 ring-white/10 sm:p-5">
      <h2 className="flex items-center gap-2 text-h3 font-black">
        <BellRing className="h-4 w-4 text-accent-orange" /> إرسال إشعار فوري
      </h2>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => send("⚽ هدف جديد!", "تم تسجيل هدف الآن.")} disabled={sending} className="rounded-full bg-accent-green/15 px-3 py-1.5 text-caption font-black text-accent-green disabled:opacity-60">
          ⚽ هدف
        </button>
        <button onClick={() => send("🔴 مباراة بدأت!", "المباراة بدأت لايف حالياً.")} disabled={sending} className="rounded-full bg-red-500/15 px-3 py-1.5 text-caption font-black text-red-400 disabled:opacity-60">
          🔴 لايف
        </button>
      </div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان الإشعار" className={inputCls} />
      <input value={body} onChange={(e) => setBody(e.target.value)} placeholder="التفاصيل" className={inputCls} />
      <button onClick={() => send()} disabled={sending} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-caption font-black text-primary-foreground disabled:opacity-60">
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
        إرسال للجميع
      </button>
    </div>
  );
}

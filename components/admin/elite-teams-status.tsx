"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Clock, Copy, ShieldCheck, XCircle } from "lucide-react";

type TeamOrder = {
  id: string;
  payment_status: string | null;
  manager_name: string | null;
  phone: string | null;
  access_password: string | null;
  admin_manual_access: boolean | null;
};

type TeamRosterInfo = { is_submitted: boolean; playerCount: number } | null;

type TeamRow = { name: string; order: TeamOrder | null; roster: TeamRosterInfo };

const inputCls = "h-9 w-full rounded-lg bg-secondary px-3 text-[12px] font-bold outline-none ring-1 ring-white/10 focus:ring-accent-blue";

function statusBadge(order: TeamOrder | null) {
  if (!order) return { label: "لسه ماسجلش", tone: "bg-white/5 text-muted-foreground", Icon: Clock };
  if (order.payment_status === "paid") return { label: "دفع الاشتراك", tone: "bg-accent-green/15 text-accent-green", Icon: CheckCircle2 };
  if (order.payment_status === "manual_access") return { label: "تفعيل يدوي", tone: "bg-accent-blue/15 text-accent-blue", Icon: ShieldCheck };
  if (order.payment_status === "pending_payment") return { label: "بانتظار الدفع", tone: "bg-accent-orange/15 text-accent-orange", Icon: Clock };
  return { label: "فشل الدفع", tone: "bg-red-500/15 text-red-400", Icon: XCircle };
}

export function EliteTeamsStatus({ teams: initialTeams, price }: { teams: TeamRow[]; price: number }) {
  const [teams, setTeams] = useState(initialTeams);
  const [activatingFor, setActivatingFor] = useState<string | null>(null);
  const [managerName, setManagerName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const activate = async (teamName: string) => {
    if (!managerName.trim()) return toast.error("اكتب اسم مسئول الفريق");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/elite-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamName, managerName: managerName.trim(), phone: phone.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "فشل التفعيل");
      setTeams((prev) => prev.map((t) => (t.name === teamName ? { ...t, order: data.order } : t)));
      setActivatingFor(null);
      setManagerName("");
      setPhone("");
      toast.success(`تم تفعيل فريق ${teamName}`);
    } catch (e: any) {
      toast.error(e?.message || "فشل التفعيل");
    } finally {
      setSaving(false);
    }
  };

  const copyPassword = (password: string) => {
    navigator.clipboard.writeText(password).then(() => toast.success("تم نسخ الرقم السري"));
  };

  const activeCount = teams.filter((t) => t.order?.payment_status === "paid" || t.order?.payment_status === "manual_access").length;

  return (
    <div className="space-y-3 rounded-2xl bg-card p-4 ring-1 ring-white/10 sm:p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-h3 font-black">فرق كأس النخبة ({activeCount}/{teams.length} مفعّلة)</h2>
        <span className="text-caption font-bold text-muted-foreground">{price.toLocaleString("ar-EG")} ج.م / فريق</span>
      </div>

      <div className="space-y-2">
        {teams.map((t) => {
          const badge = statusBadge(t.order);
          const isActive = t.order?.payment_status === "paid" || t.order?.payment_status === "manual_access";
          return (
            <div key={t.name} className="rounded-xl bg-secondary/60 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-caption font-black">{t.name}</div>
                  {t.order?.manager_name && (
                    <div className="text-[11px] text-muted-foreground">{t.order.manager_name} {t.order.phone ? <span dir="ltr">— {t.order.phone}</span> : ""}</div>
                  )}
                </div>
                <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black ${badge.tone}`}>
                  <badge.Icon className="h-3 w-3" /> {badge.label}
                </span>
                {isActive && (
                  <span className="text-[11px] text-muted-foreground">
                    القائمة: {t.roster ? (t.roster.is_submitted ? `مقفولة (${t.roster.playerCount})` : `قيد التسجيل (${t.roster.playerCount})`) : "لسه"}
                  </span>
                )}
                {isActive && t.order?.access_password && (
                  <button onClick={() => copyPassword(t.order!.access_password!)} className="flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-[11px] font-black text-accent-blue">
                    <Copy className="h-3 w-3" /> <span dir="ltr">{t.order.access_password}</span>
                  </button>
                )}
                {!isActive && (
                  <button
                    onClick={() => setActivatingFor(activatingFor === t.name ? null : t.name)}
                    className="rounded-lg bg-accent-green/15 px-3 py-1.5 text-[11px] font-black text-accent-green"
                  >
                    تفعيل يدوي
                  </button>
                )}
              </div>

              {activatingFor === t.name && (
                <div className="mt-2 flex flex-wrap gap-2 border-t border-white/5 pt-2">
                  <input value={managerName} onChange={(e) => setManagerName(e.target.value)} placeholder="اسم مسئول الفريق" className={`${inputCls} flex-1`} />
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="رقم الهاتف" dir="ltr" className={`${inputCls} flex-1`} />
                  <button onClick={() => activate(t.name)} disabled={saving} className="shrink-0 rounded-lg bg-primary px-4 text-[11px] font-black text-primary-foreground disabled:opacity-60">
                    تأكيد
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

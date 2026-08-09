"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CreditCard, Wallet, Loader2, CheckCircle2 } from "lucide-react";

type Team = { name: string; taken: boolean };

const PAYMENT_METHODS = [
  { key: "card", label: "بطاقة بنكية", icon: CreditCard },
  { key: "wallet", label: "محفظة إلكترونية", icon: Wallet },
];

const inputCls = "h-12 w-full rounded-xl bg-card px-4 text-body font-bold outline-none ring-1 ring-white/10 focus:ring-accent-blue";

export function EliteRegistrationForm({ teams, price }: { teams: Team[]; price: number }) {
  const [teamName, setTeamName] = useState(teams.find((t) => !t.taken)?.name || "");
  const [managerName, setManagerName] = useState("");
  const [phone, setPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "wallet">("card");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!teamName) return toast.error("اختر اسم الفريق");
    if (!managerName.trim()) return toast.error("اكتب اسم مسئول الفريق");
    if (!phone.trim() || phone.replace(/\D/g, "").length < 10) return toast.error("اكتب رقم موبايل صحيح");

    setLoading(true);
    try {
      const endpoint = paymentMethod === "wallet" ? "/api/paymob/wallet" : "/api/paymob/initiate";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournament: "elite_cup",
          teamName,
          managerName: managerName.trim(),
          phone: phone.trim(),
          paymobMethod: paymentMethod,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || data?.message || "فشل تجهيز الدفع");

      const checkoutUrl = data.url || data.checkoutUrl || data.redirectUrl;
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
        return;
      }
      if (data.ok && data.message) {
        toast.success(data.message);
        return;
      }
      throw new Error("لم يتم إنشاء رابط الدفع");
    } catch (e: any) {
      toast.error(e?.message || "حدث خطأ أثناء تجهيز الدفع");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-caption font-bold text-muted-foreground">اسم الفريق</label>
        <select value={teamName} onChange={(e) => setTeamName(e.target.value)} className={inputCls}>
          {teams.map((t) => (
            <option key={t.name} value={t.name} disabled={t.taken}>
              {t.name} {t.taken ? "— (مكتمل)" : ""}
            </option>
          ))}
        </select>
      </div>

      <input value={managerName} onChange={(e) => setManagerName(e.target.value)} placeholder="اسم مسئول الفريق" className={inputCls} />
      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="رقم الموبايل" dir="ltr" className={inputCls} />

      <div>
        <label className="mb-1.5 block text-caption font-bold text-muted-foreground">طريقة الدفع</label>
        <div className="grid grid-cols-2 gap-2">
          {PAYMENT_METHODS.map((m) => (
            <button
              key={m.key}
              onClick={() => setPaymentMethod(m.key as "card" | "wallet")}
              className={`flex items-center justify-center gap-2 rounded-xl py-3 text-caption font-black transition-colors ${
                paymentMethod === m.key ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground ring-1 ring-white/10"
              }`}
            >
              <m.icon className="h-4 w-4" />
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-accent-green/10 px-4 py-3 ring-1 ring-accent-green/30">
        <span className="text-caption font-bold text-muted-foreground">قيمة الاشتراك</span>
        <span className="text-h3 font-black text-accent-green">{price.toLocaleString("ar-EG")} ج.م</span>
      </div>

      <button
        onClick={submit}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-body font-black text-primary-foreground disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        {loading ? "جاري التجهيز..." : "ادفع وسجّل الفريق"}
      </button>
      <p className="text-center text-[11px] text-muted-foreground">
        بعد الدفع هيتبعتلك رقم سري لاستخدامه في تسجيل قائمة فريقك.
      </p>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CreditCard, Wallet, Truck, Landmark } from "lucide-react";
import { useCart } from "@/lib/shop/cart-context";
import { cn } from "@/lib/utils";

const PAYMENT_METHODS = [
  { key: "paymob_card", label: "بطاقة بنكية", icon: CreditCard },
  { key: "paymob_wallet", label: "محفظة إلكترونية", icon: Wallet },
  { key: "cash", label: "الدفع عند الاستلام", icon: Truck },
  { key: "manual", label: "تحويل بنكي", icon: Landmark },
];

export default function CheckoutPage() {
  const { items, total, clear } = useCart();
  const router = useRouter();
  const [form, setForm] = useState({ name: "", phone: "", address: "", email: "", notes: "" });
  const [paymentMethod, setPaymentMethod] = useState("paymob_card");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const orderItems = items.map((i) => ({ id: i.id, title: i.title, price: i.price, qty: i.qty, imageUrl: i.imageUrl }));

  const submit = async () => {
    if (items.length === 0) return toast.error("السلة فارغة");
    if (!form.name.trim() || !form.phone.trim() || !form.address.trim()) return toast.error("يرجى إكمال البيانات");

    setLoading(true);
    try {
      if (paymentMethod === "paymob_card" || paymentMethod === "paymob_wallet") {
        const isWallet = paymentMethod === "paymob_wallet";
        const res = await fetch(isWallet ? "/api/paymob/wallet" : "/api/paymob/create-intention", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customer: { name: form.name, phone: form.phone, address: form.address, email: form.email || "customer@matrouhcup.online" },
            items: orderItems,
            total,
            notes: form.notes,
            paymobMethod: isWallet ? "wallet" : "card",
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "تعذر إنشاء الدفع");

        const checkoutUrl = data.checkoutUrl || data.url || data.redirectUrl;
        if (checkoutUrl) {
          clear();
          window.location.href = checkoutUrl;
          return;
        }
        if (data.ok && data.message) {
          toast.success(data.message);
          clear();
          router.push("/shop");
          return;
        }
        throw new Error(data?.error || "تعذر إنشاء رابط الدفع");
      }

      const fd = new FormData();
      fd.set("name", form.name);
      fd.set("phone", form.phone);
      fd.set("address", form.address);
      fd.set("paymentMethod", paymentMethod);
      fd.set("notes", form.notes);
      fd.set("items", JSON.stringify(orderItems));
      fd.set("total", String(total));
      if (receiptFile) fd.set("receiptImage", receiptFile);

      const res = await fetch("/api/orders/manual", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "تعذر إرسال الطلب");

      toast.success("✅ تم إرسال الطلب بنجاح!");
      clear();
      router.push("/shop");
    } catch (e: any) {
      toast.error(e?.message || "حدث خطأ أثناء إرسال الطلب");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main dir="rtl" className="mx-auto max-w-2xl px-4 pb-16 pt-8 sm:px-6">
      <h1 className="mb-8 text-h1 font-black">إتمام الطلب</h1>

      <div className="space-y-4 rounded-2xl bg-card p-5 ring-1 ring-white/10">
        <input
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          placeholder="الاسم"
          className="h-12 w-full rounded-xl bg-background px-4 text-body font-bold outline-none ring-1 ring-white/10 focus:ring-accent-blue"
        />
        <input
          value={form.phone}
          onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
          placeholder="رقم الموبايل"
          className="h-12 w-full rounded-xl bg-background px-4 text-body font-bold outline-none ring-1 ring-white/10 focus:ring-accent-blue"
        />
        <input
          value={form.address}
          onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
          placeholder="العنوان"
          className="h-12 w-full rounded-xl bg-background px-4 text-body font-bold outline-none ring-1 ring-white/10 focus:ring-accent-blue"
        />
        <textarea
          value={form.notes}
          onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          placeholder="ملاحظات (اختياري)"
          className="w-full rounded-xl bg-background px-4 py-3 text-body font-bold outline-none ring-1 ring-white/10 focus:ring-accent-blue"
          rows={2}
        />
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-h3 font-black text-muted-foreground">طريقة الدفع</h2>
        <div className="grid grid-cols-2 gap-3">
          {PAYMENT_METHODS.map((m) => {
            const Icon = m.icon;
            const active = paymentMethod === m.key;
            return (
              <button
                key={m.key}
                onClick={() => setPaymentMethod(m.key)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-2xl p-4 ring-1 transition-colors",
                  active ? "bg-primary/15 ring-primary text-primary" : "bg-card ring-white/10 text-muted-foreground"
                )}
              >
                <Icon className="h-6 w-6" />
                <span className="text-caption font-bold">{m.label}</span>
              </button>
            );
          })}
        </div>

        {paymentMethod === "manual" && (
          <div className="mt-4 rounded-2xl bg-card p-4 ring-1 ring-white/10">
            <p className="mb-2 text-caption font-bold text-muted-foreground">ارفق صورة إيصال التحويل (اختياري)</p>
            <input type="file" accept="image/*" onChange={(e) => setReceiptFile(e.target.files?.[0] || null)} className="text-caption" />
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between rounded-2xl bg-card p-4 ring-1 ring-white/10">
        <span className="text-body font-bold text-muted-foreground">الإجمالي</span>
        <span className="text-h2 font-black text-accent-blue" dir="ltr">
          {total} ج.م
        </span>
      </div>

      <button
        onClick={submit}
        disabled={loading}
        className="mt-6 w-full rounded-2xl bg-primary py-4 text-body font-black text-primary-foreground disabled:opacity-60"
      >
        {loading ? "جاري الإرسال..." : "تأكيد الطلب"}
      </button>
    </main>
  );
}

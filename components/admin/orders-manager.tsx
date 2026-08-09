"use client";

import { useState } from "react";
import { toast } from "sonner";

type OrderItem = { id: string; title: string; price: number; qty: number };
type Order = {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  total: number;
  payment_method: string | null;
  payment_status: string | null;
  status_label: string | null;
  customer_receipt_image_url: string | null;
  paymob_transaction_id: string | null;
  paymob_checkout_url: string | null;
  created_at: string;
  order_items: OrderItem[];
};

const FULFILLMENT_STATUSES = ["طلب جديد", "قيد التأكيد", "قيد التجهيز", "تم الشحن", "تم التسليم", "ملغي"];

const PAYMENT_LABELS: Record<string, string> = {
  paid: "مدفوع",
  pending_payment: "بانتظار الدفع",
  failed: "فشل الدفع",
  payment_init_failed: "فشل إنشاء الدفع",
  cash_on_delivery: "دفع عند الاستلام",
  manual_review: "مراجعة يدوية",
};

const PAYMENT_TONE: Record<string, string> = {
  paid: "bg-accent-green/15 text-accent-green",
  pending_payment: "bg-accent-orange/15 text-accent-orange",
  failed: "bg-red-500/15 text-red-400",
  payment_init_failed: "bg-red-500/15 text-red-400",
};

export function OrdersManager({ initialOrders }: { initialOrders: Order[] }) {
  const [orders, setOrders] = useState(initialOrders);

  const updateStatus = async (id: string, status_label: string) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status_label } : o)));
    try {
      const res = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status_label }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "فشل التحديث");
    } catch (e: any) {
      toast.error(e?.message || "فشل تحديث حالة الطلب");
    }
  };

  return (
    <div>
      <h2 className="mb-3 text-h3 font-black">الطلبات ({orders.length})</h2>
      {orders.length === 0 ? (
        <div className="rounded-2xl bg-card p-8 text-center text-caption text-muted-foreground ring-1 ring-white/10">لا توجد طلبات حالياً</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl ring-1 ring-white/10">
          <table className="w-full min-w-[860px] text-right text-caption">
            <thead className="bg-secondary text-[11px] text-muted-foreground">
              <tr>
                {["الطلب", "العميل", "المنتجات", "الإجمالي", "الدفع", "حالة الدفع", "الإيصال", "حالة الطلب"].map((h) => (
                  <th key={h} className="px-3 py-2.5 font-bold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-white/5">
                  <td className="px-3 py-2.5">
                    <div className="font-black" dir="ltr">{o.id.slice(-6).toUpperCase()}</div>
                    <div className="text-[10px] text-muted-foreground">{o.created_at ? new Date(o.created_at).toLocaleDateString("ar-EG") : "—"}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-bold">{o.customer_name || "—"}</div>
                    <div className="text-[10px] text-muted-foreground" dir="ltr">{o.customer_phone || ""}</div>
                  </td>
                  <td className="max-w-[200px] px-3 py-2.5 text-[11px] text-muted-foreground">
                    {(o.order_items || []).map((it, i) => (
                      <div key={i} className="truncate">{it.title} × {it.qty}</div>
                    ))}
                  </td>
                  <td className="px-3 py-2.5 font-black text-accent-orange">{Number(o.total || 0).toLocaleString("ar-EG")} ج.م</td>
                  <td className="px-3 py-2.5 text-[11px]">{o.payment_method === "cash" ? "عند الاستلام" : o.payment_method || "—"}</td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-full px-2 py-1 text-[10px] font-black ${PAYMENT_TONE[o.payment_status || ""] || "bg-white/5 text-muted-foreground"}`}>
                      {PAYMENT_LABELS[o.payment_status || ""] || o.payment_status || "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-[11px]">
                    {o.customer_receipt_image_url ? (
                      <a href={o.customer_receipt_image_url} target="_blank" rel="noreferrer" className="font-bold text-accent-blue underline">الإيصال</a>
                    ) : o.paymob_transaction_id ? (
                      <span className="font-bold text-accent-green" dir="ltr">#{o.paymob_transaction_id}</span>
                    ) : o.paymob_checkout_url ? (
                      <a href={o.paymob_checkout_url} target="_blank" rel="noreferrer" className="font-bold text-accent-orange underline">رابط الدفع</a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <select value={o.status_label || "طلب جديد"} onChange={(e) => updateStatus(o.id, e.target.value)} className="h-8 rounded-lg bg-secondary px-2 text-[11px] font-bold outline-none ring-1 ring-white/10">
                      {FULFILLMENT_STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

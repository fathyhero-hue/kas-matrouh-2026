"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isTrue(value: string | null) {
  return value === "true" || value === "1" || value === "True";
}

type OrderStatus = {
  id: string;
  tournament: string | null;
  payment_status: string | null;
  access_password: string | null;
  customer_phone: string | null;
};

function PaymentResultInner() {
  const params = useSearchParams();
  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [error, setError] = useState("");
  const [polling, setPolling] = useState(true);

  const rawOrderId = params.get("orderId") || params.get("merchant_order_id") || params.get("special_reference") || "";
  const successValue = params.get("success");
  const pendingValue = params.get("pending");

  const result = useMemo(() => {
    const success = isTrue(successValue);
    const pending = isTrue(pendingValue);
    if (success) return { title: "تم الدفع بنجاح", status: "paid", icon: "✅", color: "text-emerald-400" };
    if (pending) return { title: "الدفع قيد المعالجة", status: "pending_payment", icon: "⏳", color: "text-yellow-400" };
    return { title: "لم تكتمل عملية الدفع", status: "failed", icon: "❌", color: "text-red-400" };
  }, [successValue, pendingValue]);

  // This page is read-only: the Paymob webhook (app/api/paymob/webhook) is the
  // sole writer of payment status. We just poll briefly in case the webhook
  // hasn't landed yet by the time the customer's browser redirects back here.
  useEffect(() => {
    if (!rawOrderId || !UUID_RE.test(rawOrderId)) {
      setError("تعذّر قراءة رقم الطلب من نتيجة الدفع.");
      setPolling(false);
      return;
    }

    let cancelled = false;
    let attempts = 0;
    const supabase = createClient();

    async function poll() {
      attempts++;
      const { data, error: rpcError } = await supabase.rpc("get_order_status_by_id", { p_order_id: rawOrderId }).single();
      if (cancelled) return;

      if (rpcError || !data) {
        if (attempts >= 8) {
          setError("تعذّر العثور على الطلب. راجع الإدارة برقم العملية.");
          setPolling(false);
        }
        return;
      }

      const row = data as any;
      setOrder({
        id: row.id,
        tournament: row.tournament,
        payment_status: row.payment_status,
        access_password: row.access_password,
        customer_phone: row.customer_phone,
      });

      // Stop polling once the webhook has recorded a final status, or after
      // enough attempts that we should stop waiting either way.
      if (row.payment_status === "paid" || row.payment_status === "failed" || attempts >= 8) {
        setPolling(false);
      }
    }

    poll();
    const interval = setInterval(() => {
      if (!cancelled) poll();
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [rawOrderId]);

  const accessPassword = order?.access_password || "";
  const tournament = order?.tournament || "matrouh_cup";
  const returnUrl = accessPassword
    ? `/?paid=1&tournament=${encodeURIComponent(tournament)}&accessPassword=${encodeURIComponent(accessPassword)}`
    : "/";

  return (
    <section className="w-full max-w-xl bg-[#13213a] border border-white/10 rounded-3xl shadow-2xl p-8 text-center space-y-5">
      <div className="text-7xl">{result.icon}</div>
      <h1 className={`text-3xl font-black ${result.color}`}>{result.title}</h1>

      <p className="text-gray-300 font-bold leading-7">
        رقم الطلب: <span className="text-yellow-300" dir="ltr">{rawOrderId || "جارٍ الربط..."}</span>
      </p>

      {polling && !accessPassword && <p className="text-gray-400 font-bold">جاري تأكيد حالة الدفع...</p>}

      {order?.payment_status === "paid" && accessPassword && (
        <div className="rounded-3xl border border-emerald-400/40 bg-emerald-500/10 p-5 space-y-3">
          <p className="text-emerald-300 font-black text-lg">رقم الدخول لاستمارة قائمة الفريق</p>
          <div className="text-5xl font-black tracking-[0.25em] text-yellow-300" dir="ltr">{accessPassword}</div>
          <p className="text-gray-200 font-bold text-sm leading-7">
            احفظ الرقم. استخدمه للرجوع إلى استمارة تسجيل قائمة الفريق.
            {order.customer_phone ? ` الرقم مربوط بالموبايل ${order.customer_phone}.` : ""}
          </p>
        </div>
      )}

      {result.status === "pending_payment" && !accessPassword && (
        <p className="text-yellow-200 font-bold leading-7">
          العملية قيد الانتظار. أكمل تأكيد الدفع من المحفظة، ثم ارجع للصفحة أو افتح التطبيق مرة أخرى.
        </p>
      )}

      {error && <p className="text-red-300 font-bold leading-7">{error}</p>}

      <a href={returnUrl} className="inline-flex items-center justify-center rounded-2xl bg-yellow-400 text-black font-black px-8 py-4 hover:bg-yellow-300 transition-colors">
        الرجوع للتطبيق وفتح التسجيل
      </a>
    </section>
  );
}

export default function PaymentResultPage() {
  return (
    <main dir="rtl" className="min-h-screen bg-[#0a1428] text-white flex items-center justify-center p-6">
      <Suspense fallback={<div className="text-yellow-300 font-black">جاري قراءة نتيجة الدفع...</div>}>
        <PaymentResultInner />
      </Suspense>
    </main>
  );
}

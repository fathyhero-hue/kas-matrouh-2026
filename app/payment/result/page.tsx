"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Clock, XCircle, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TOURNAMENT_ROSTER_LINK: Record<string, string> = {
  elite_cup: "/elite-cup/rosters/submit",
  matrouh_cup: "/matrouh-cup/rosters/submit",
};

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
    if (success) return { title: "تم الدفع بنجاح", status: "paid", Icon: CheckCircle2, tone: "text-accent-green" };
    if (pending) return { title: "الدفع قيد المعالجة", status: "pending_payment", Icon: Clock, tone: "text-accent-orange" };
    return { title: "لم تكتمل عملية الدفع", status: "failed", Icon: XCircle, tone: "text-destructive" };
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
  const tournament = order?.tournament || "";
  const returnUrl = accessPassword ? TOURNAMENT_ROSTER_LINK[tournament] || "/" : "/";

  return (
    <section className="w-full max-w-md rounded-3xl bg-card p-8 text-center ring-1 ring-white/10">
      <result.Icon className={`mx-auto h-14 w-14 ${result.tone}`} />
      <h1 className={`mt-3 text-h1 font-black ${result.tone}`}>{result.title}</h1>

      <p className="mt-3 text-caption font-bold text-muted-foreground">
        رقم الطلب: <span className="text-accent-orange" dir="ltr">{rawOrderId || "جارٍ الربط..."}</span>
      </p>

      {polling && !accessPassword && (
        <p className="mt-4 flex items-center justify-center gap-2 text-caption font-bold text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> جاري تأكيد حالة الدفع...
        </p>
      )}

      {order?.payment_status === "paid" && accessPassword && (
        <div className="mt-5 space-y-3 rounded-2xl bg-accent-green/10 p-5 ring-1 ring-accent-green/30">
          <p className="text-body font-black text-accent-green">الرقم السري لتسجيل قائمة الفريق</p>
          <div className="text-display font-black tracking-[0.25em] text-accent-orange" dir="ltr">{accessPassword}</div>
          <p className="text-caption font-bold leading-6 text-muted-foreground">
            احفظ الرقم ده كويس، هتحتاجه عشان تدخل تسجّل قائمة لاعبين فريقك.
            {order.customer_phone ? ` الرقم مربوط بموبايل ${order.customer_phone}.` : ""}
          </p>
        </div>
      )}

      {result.status === "pending_payment" && !accessPassword && (
        <p className="mt-4 text-caption font-bold leading-6 text-accent-orange">
          العملية قيد الانتظار. أكمل تأكيد الدفع من المحفظة، ثم ارجع لهذه الصفحة.
        </p>
      )}

      {error && <p className="mt-4 text-caption font-bold text-destructive">{error}</p>}

      <a
        href={returnUrl}
        className="mt-6 inline-flex items-center justify-center rounded-2xl bg-primary px-8 py-3.5 text-body font-black text-primary-foreground transition-colors hover:opacity-90"
      >
        {accessPassword ? "روح لتسجيل قائمة الفريق" : "الرجوع للموقع"}
      </a>
    </section>
  );
}

export default function PaymentResultPage() {
  return (
    <main dir="rtl" className="flex min-h-screen items-center justify-center p-6">
      <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />}>
        <PaymentResultInner />
      </Suspense>
    </main>
  );
}

"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

function truthy(value: string | null) {
  return value === "true" || value === "1";
}

function PaymentResultInner() {
  const params = useSearchParams();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const orderId =
    params.get("orderId") ||
    params.get("merchant_order_id") ||
    params.get("special_reference") ||
    params.get("order") ||
    "";

  const transactionId = params.get("id") || params.get("transaction_id") || "";
  const successValue = params.get("success");
  const pendingValue = params.get("pending");

  const result = useMemo(() => {
    const success = truthy(successValue);
    const pending = truthy(pendingValue);
    if (success) return { title: "تم الدفع بنجاح", status: "paid", orderStatus: "تم الدفع", icon: "✅", color: "text-emerald-400" };
    if (pending) return { title: "الدفع قيد المعالجة", status: "pending_payment", orderStatus: "في انتظار الدفع", icon: "⏳", color: "text-yellow-400" };
    return { title: "لم تكتمل عملية الدفع", status: "failed", orderStatus: "فشل الدفع", icon: "❌", color: "text-red-400" };
  }, [successValue, pendingValue]);

  useEffect(() => {
    if (!orderId || saved) return;

    setDoc(
      doc(db, "orders", orderId),
      {
        id: orderId,
        paymentStatus: result.status,
        status: result.orderStatus,
        paymentMethod: "paymob",
        paymobTransactionId: transactionId,
        paymobReturnParams: Object.fromEntries(params.entries()),
        paidAt: result.status === "paid" ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    )
      .then(() => setSaved(true))
      .catch((e) => setError(e?.message || "تعذر تحديث الطلب."));
  }, [orderId, saved, result.status, result.orderStatus, transactionId, params]);

  return (
    <section className="w-full max-w-xl bg-[#13213a] border border-white/10 rounded-3xl shadow-2xl p-8 text-center space-y-5">
      <div className="text-7xl">{result.icon}</div>
      <h1 className={`text-3xl font-black ${result.color}`}>{result.title}</h1>
      <p className="text-gray-300 font-bold leading-7">
        رقم الطلب: <span className="text-yellow-300" dir="ltr">{orderId || "غير متاح"}</span>
      </p>
      {transactionId && <p className="text-gray-400 text-sm" dir="ltr">Paymob Transaction: {transactionId}</p>}
      {saved && <p className="text-emerald-300 font-bold">تم تحديث حالة الطلب في لوحة الإدارة.</p>}
      {error && <p className="text-red-300 font-bold">{error}</p>}
      <a href="/" className="inline-flex items-center justify-center rounded-2xl bg-yellow-400 text-black font-black px-8 py-4 hover:bg-yellow-300 transition-colors">
        الرجوع للتطبيق
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

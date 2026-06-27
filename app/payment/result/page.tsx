"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { collection, doc, getDoc, getDocs, limit, query, setDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

function generateAccessPassword() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function isTrue(value: string | null) {
  return value === "true" || value === "1" || value === "True";
}

function isPending(value: string | null) {
  return value === "true" || value === "1" || value === "True";
}

function PaymentResultInner() {
  const params = useSearchParams();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [resolvedOrderId, setResolvedOrderId] = useState("");
  const [accessPassword, setAccessPassword] = useState("");
  const [tournament, setTournament] = useState("matrouh_cup");
  const [customerPhone, setCustomerPhone] = useState("");

  const rawOrderId =
    params.get("orderId") ||
    params.get("merchant_order_id") ||
    params.get("merchantOrderId") ||
    params.get("special_reference") ||
    "";

  const successValue = params.get("success");
  const pendingValue = params.get("pending");
  const transactionId = params.get("id") || params.get("transaction_id") || params.get("txn_id") || "";

  const result = useMemo(() => {
    const success = isTrue(successValue);
    const pending = isPending(pendingValue);
    if (success) return { title: "تم الدفع بنجاح", status: "paid", orderStatus: "تم الدفع", icon: "✅", color: "text-emerald-400" };
    if (pending) return { title: "الدفع قيد المعالجة", status: "pending_payment", orderStatus: "في انتظار الدفع", icon: "⏳", color: "text-yellow-400" };
    return { title: "لم تكتمل عملية الدفع", status: "failed", orderStatus: "فشل الدفع", icon: "❌", color: "text-red-400" };
  }, [successValue, pendingValue]);

  useEffect(() => {
    let cancelled = false;

    async function resolveAndSave() {
      if (saved) return;
      setError("");

      try {
        let orderId = rawOrderId;
        let orderData: any = null;

        if (orderId) {
          const snap = await getDoc(doc(db, "orders", orderId));
          if (snap.exists()) orderData = { id: snap.id, ...snap.data() };
        }

        // في مسار المحافظ القديم قد يرجع Paymob بدون merchant_order_id.
        // لذلك نحاول ربط العملية بالطلب عن طريق رقم Transaction المحفوظ مسبقاً.
        if (!orderData && transactionId) {
          const q = query(collection(db, "orders"), where("paymobTransactionId", "==", transactionId), limit(1));
          const qs = await getDocs(q);
          if (!qs.empty) {
            const found = qs.docs[0];
            orderId = found.id;
            orderData = { id: found.id, ...found.data() };
          }
        }

        if (!orderId) {
          if (!cancelled) setError("تمت قراءة نتيجة الدفع، لكن لم يصل رقم الطلب من Paymob. راجع الإدارة برقم العملية.");
          return;
        }

        const finalTournament = String(orderData?.tournament || (orderId.includes("elite") ? "elite_cup" : "matrouh_cup"));
        let finalPassword = String(orderData?.accessPassword || "");

        // الرقم السري يظهر فقط بعد الدفع الناجح، ويخزن في الطلب.
        if (result.status === "paid" && !finalPassword) {
          finalPassword = generateAccessPassword();
        }

        await setDoc(
          doc(db, "orders", orderId),
          {
            paymentStatus: result.status,
            status: result.orderStatus,
            paymobTransactionId: transactionId,
            paymobReturnParams: Object.fromEntries(params.entries()),
            paidAt: result.status === "paid" ? new Date().toISOString() : null,
            updatedAt: new Date().toISOString(),
            ...(result.status === "paid"
              ? {
                  accessPassword: finalPassword,
                  rosterAccessPassword: finalPassword,
                  rosterAccessActive: true,
                }
              : {}),
          },
          { merge: true }
        );

        if (!cancelled) {
          setResolvedOrderId(orderId);
          setTournament(finalTournament);
          setAccessPassword(finalPassword);
          setCustomerPhone(String(orderData?.customer?.phone || ""));
          setSaved(true);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "تعذر تحديث الطلب.");
      }
    }

    resolveAndSave();
    return () => {
      cancelled = true;
    };
  }, [rawOrderId, transactionId, saved, result.status, result.orderStatus, params]);

  const returnUrl = accessPassword
    ? `/?paid=1&tournament=${encodeURIComponent(tournament)}&accessPassword=${encodeURIComponent(accessPassword)}`
    : "/";

  return (
    <section className="w-full max-w-xl bg-[#13213a] border border-white/10 rounded-3xl shadow-2xl p-8 text-center space-y-5">
      <div className="text-7xl">{result.icon}</div>
      <h1 className={`text-3xl font-black ${result.color}`}>{result.title}</h1>

      <p className="text-gray-300 font-bold leading-7">
        رقم الطلب: <span className="text-yellow-300" dir="ltr">{resolvedOrderId || rawOrderId || "جارٍ الربط..."}</span>
      </p>
      {transactionId && <p className="text-gray-400 text-sm" dir="ltr">Paymob Transaction: {transactionId}</p>}

      {result.status === "paid" && accessPassword && (
        <div className="rounded-3xl border border-emerald-400/40 bg-emerald-500/10 p-5 space-y-3">
          <p className="text-emerald-300 font-black text-lg">رقم الدخول لاستمارة قائمة الفريق</p>
          <div className="text-5xl font-black tracking-[0.25em] text-yellow-300" dir="ltr">{accessPassword}</div>
          <p className="text-gray-200 font-bold text-sm leading-7">
            احفظ الرقم. استخدمه للرجوع إلى استمارة تسجيل قائمة الفريق.
            {customerPhone ? ` الرقم مربوط بالموبايل ${customerPhone}.` : ""}
          </p>
        </div>
      )}

      {result.status === "pending_payment" && (
        <p className="text-yellow-200 font-bold leading-7">
          العملية قيد الانتظار. أكمل تأكيد الدفع من المحفظة، ثم ارجع للصفحة أو افتح التطبيق مرة أخرى.
        </p>
      )}

      {saved && <p className="text-emerald-300 font-bold">تم تحديث حالة الطلب في لوحة الإدارة.</p>}
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

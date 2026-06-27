import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export const runtime = "nodejs";

function deepGet(obj: any, path: string) {
  return path.split(".").reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

function stringifyForHmac(value: any) {
  if (value === undefined || value === null) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function getPaymobObject(body: any) {
  return body?.obj || body?.transaction || body;
}

function truthy(value: any) {
  return value === true || value === "true" || value === "1" || value === 1;
}

function extractOrderId(body: any, req: NextRequest) {
  const obj = getPaymobObject(body);
  const params = req.nextUrl.searchParams;

  return String(
    params.get("orderId") ||
      params.get("merchant_order_id") ||
      params.get("special_reference") ||
      params.get("order") ||
      body?.orderId ||
      body?.merchant_order_id ||
      body?.special_reference ||
      body?.extras?.orderId ||
      obj?.extras?.orderId ||
      obj?.special_reference ||
      obj?.merchant_order_id ||
      obj?.order?.merchant_order_id ||
      obj?.order?.special_reference ||
      ""
  );
}

function verifyHmacIfPossible(body: any, req: NextRequest) {
  const hmacSecret = process.env.PAYMOB_HMAC_SECRET;
  const provided = req.nextUrl.searchParams.get("hmac") || body?.hmac || body?.obj?.hmac;
  if (!hmacSecret || !provided) return { checked: false, valid: true };

  const obj = getPaymobObject(body);
  const fields = [
    "amount_cents",
    "created_at",
    "currency",
    "error_occured",
    "has_parent_transaction",
    "id",
    "integration_id",
    "is_3d_secure",
    "is_auth",
    "is_capture",
    "is_refunded",
    "is_standalone_payment",
    "is_voided",
    "order.id",
    "owner",
    "pending",
    "source_data.pan",
    "source_data.sub_type",
    "source_data.type",
    "success",
  ];

  const message = fields.map((f) => stringifyForHmac(deepGet(obj, f))).join("");
  const computed = crypto.createHmac("sha512", hmacSecret).update(message).digest("hex");
  return { checked: true, valid: computed === String(provided) };
}

export async function GET(req: NextRequest) {
  return handleCallback(req, Object.fromEntries(req.nextUrl.searchParams.entries()), "GET");
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return handleCallback(req, body, "POST");
}

async function handleCallback(req: NextRequest, body: any, method: "GET" | "POST") {
  try {
    const hmac = verifyHmacIfPossible(body, req);
    if (hmac.checked && !hmac.valid) {
      return NextResponse.json({ ok: false, error: "Invalid Paymob HMAC" }, { status: 401 });
    }

    const obj = getPaymobObject(body);
    const params = req.nextUrl.searchParams;
    const orderId = extractOrderId(body, req);

    const success = truthy(obj?.success ?? body?.success ?? params.get("success"));
    const pending = truthy(obj?.pending ?? body?.pending ?? params.get("pending"));
    const transactionId = String(obj?.id || body?.id || params.get("id") || "");
    const amountCents = Number(obj?.amount_cents || body?.amount_cents || params.get("amount_cents") || 0);

    const paymentStatus = success ? "paid" : pending ? "pending_payment" : "failed";
    const status = success ? "تم الدفع" : pending ? "في انتظار الدفع" : "فشل الدفع";

    if (!orderId) {
      return NextResponse.json({ ok: true, ignored: true, reason: "No order id in Paymob callback", transactionId });
    }

    // setDoc + merge بدل updateDoc حتى لا يحدث خطأ NOT_FOUND إذا رجع Paymob قبل إنشاء/حفظ الوثيقة أو كان الطلب خاصًا بالتسجيل.
    await setDoc(
      doc(db, "orders", orderId),
      {
        id: orderId,
        paymentStatus,
        status,
        paymentMethod: "paymob",
        paymobTransactionId: transactionId,
        paymobAmountCents: amountCents,
        paymobCallbackMethod: method,
        paymobCallback: body,
        paidAt: success ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true, orderId, success, pending, transactionId, paymentStatus });
  } catch (error: any) {
    console.error("Paymob webhook error:", error);
    return NextResponse.json({ ok: false, error: error?.message || "Webhook error" }, { status: 500 });
  }
}

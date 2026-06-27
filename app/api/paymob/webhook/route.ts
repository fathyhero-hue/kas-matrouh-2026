import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { doc, updateDoc } from "firebase/firestore";
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

function extractOrderId(body: any, req: NextRequest) {
  const obj = getPaymobObject(body);
  return (
    req.nextUrl.searchParams.get("orderId") ||
    body?.orderId ||
    body?.extras?.orderId ||
    obj?.extras?.orderId ||
    obj?.special_reference ||
    obj?.merchant_order_id ||
    obj?.order?.merchant_order_id ||
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
  return handleCallback(req, Object.fromEntries(req.nextUrl.searchParams.entries()));
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return handleCallback(req, body);
}

async function handleCallback(req: NextRequest, body: any) {
  try {
    const hmac = verifyHmacIfPossible(body, req);
    if (hmac.checked && !hmac.valid) {
      return NextResponse.json({ ok: false, error: "Invalid Paymob HMAC" }, { status: 401 });
    }

    const obj = getPaymobObject(body);
    const orderId = String(extractOrderId(body, req));
    const successRaw = obj?.success ?? body?.success ?? req.nextUrl.searchParams.get("success");
    const success = successRaw === true || successRaw === "true" || successRaw === "1";
    const pendingRaw = obj?.pending ?? body?.pending ?? req.nextUrl.searchParams.get("pending");
    const pending = pendingRaw === true || pendingRaw === "true" || pendingRaw === "1";
    const transactionId = String(obj?.id || body?.id || req.nextUrl.searchParams.get("id") || "");

    if (orderId) {
      await updateDoc(doc(db, "orders", orderId), {
        paymentStatus: success ? "paid" : pending ? "pending_payment" : "failed",
        status: success ? "تم الدفع" : pending ? "في انتظار الدفع" : "فشل الدفع",
        paymobTransactionId: transactionId,
        paymobCallback: body,
        paidAt: success ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ ok: true, orderId, success, pending, transactionId });
  } catch (error: any) {
    console.error("Paymob webhook error:", error);
    return NextResponse.json({ ok: false, error: error?.message || "Webhook error" }, { status: 500 });
  }
}

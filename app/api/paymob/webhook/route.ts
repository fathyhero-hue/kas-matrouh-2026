import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function deepGet(obj: any, path: string) {
  return path.split(".").reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

function stringifyForHmac(value: any) {
  if (value === undefined || value === null) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function generateAccessPassword() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getPaymobObject(body: any) {
  return body?.obj || body?.transaction || body;
}

function extractOrderId(body: any, req: NextRequest) {
  const obj = getPaymobObject(body);
  const candidates = [
    req.nextUrl.searchParams.get("orderId"),
    req.nextUrl.searchParams.get("merchant_order_id"),
    body?.orderId,
    body?.merchant_order_id,
    body?.extras?.orderId,
    obj?.extras?.orderId,
    obj?.special_reference,
    obj?.merchant_order_id,
    obj?.order?.merchant_order_id,
  ];
  return String(candidates.find((v) => v && UUID_RE.test(String(v))) || "");
}

// HMAC verification is mandatory whenever PAYMOB_HMAC_SECRET is configured.
// A missing `hmac` parameter is treated as an INVALID signature, not skipped —
// closing the bypass where an attacker could omit the param entirely.
function verifyHmac(body: any, req: NextRequest): { valid: boolean; reason?: string } {
  const hmacSecret = process.env.PAYMOB_HMAC_SECRET;
  if (!hmacSecret) return { valid: false, reason: "PAYMOB_HMAC_SECRET غير مضبوط على السيرفر." };

  const provided = req.nextUrl.searchParams.get("hmac") || body?.hmac || body?.obj?.hmac;
  if (!provided) return { valid: false, reason: "hmac مفقود من الطلب." };

  const obj = getPaymobObject(body);
  const fields = [
    "amount_cents", "created_at", "currency", "error_occured", "has_parent_transaction", "id",
    "integration_id", "is_3d_secure", "is_auth", "is_capture", "is_refunded", "is_standalone_payment",
    "is_voided", "order.id", "owner", "pending", "source_data.pan", "source_data.sub_type", "source_data.type", "success",
  ];
  const message = fields.map((f) => stringifyForHmac(deepGet(obj, f))).join("");
  const computed = crypto.createHmac("sha512", hmacSecret).update(message).digest("hex");
  const validBuf = Buffer.from(computed, "hex");
  const providedBuf = Buffer.from(String(provided), "hex");
  const valid = validBuf.length === providedBuf.length && crypto.timingSafeEqual(validBuf, providedBuf);
  return { valid, reason: valid ? undefined : "hmac غير متطابق." };
}

export async function GET(req: NextRequest) {
  // Paymob's "transaction response" redirect can also hit this URL with query
  // params only (no body) — still requires a valid hmac to update anything.
  return handleCallback(req, Object.fromEntries(req.nextUrl.searchParams.entries()));
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return handleCallback(req, body);
}

async function handleCallback(req: NextRequest, body: any) {
  try {
    const hmac = verifyHmac(body, req);
    if (!hmac.valid) {
      console.warn("Rejected Paymob webhook: invalid HMAC —", hmac.reason);
      return NextResponse.json({ ok: false, error: "Invalid Paymob HMAC" }, { status: 401 });
    }

    const obj = getPaymobObject(body);
    const orderId = extractOrderId(body, req);
    const successRaw = obj?.success ?? body?.success ?? req.nextUrl.searchParams.get("success");
    const success = successRaw === true || successRaw === "true" || successRaw === "1";
    const pendingRaw = obj?.pending ?? body?.pending ?? req.nextUrl.searchParams.get("pending");
    const pending = pendingRaw === true || pendingRaw === "true" || pendingRaw === "1";
    const transactionId = String(obj?.id || body?.id || req.nextUrl.searchParams.get("id") || "");

    const supabase = createServiceRoleClient();
    let order: any = null;

    if (orderId) {
      const { data } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
      order = data;
    }
    if (!order && transactionId) {
      const { data } = await supabase.from("orders").select("*").eq("paymob_transaction_id", transactionId).maybeSingle();
      order = data;
    }

    if (!order) {
      return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });
    }

    let accessPassword = order.access_password || "";
    if (success && !accessPassword) accessPassword = generateAccessPassword();

    await supabase
      .from("orders")
      .update({
        payment_status: success ? "paid" : pending ? "pending_payment" : "failed",
        status_label: success ? "تم الدفع" : pending ? "في انتظار الدفع" : "فشل الدفع",
        paymob_transaction_id: transactionId || order.paymob_transaction_id,
        paymob_callback: body,
        paid_at: success ? new Date().toISOString() : null,
        ...(success ? { access_password: accessPassword, roster_access_password: accessPassword, roster_access_active: true } : {}),
      })
      .eq("id", order.id);

    return NextResponse.json({ ok: true, orderId: order.id, success, pending, transactionId, accessPassword: success ? accessPassword : "" });
  } catch (error: any) {
    console.error("Paymob webhook error:", error);
    return NextResponse.json({ ok: false, error: error?.message || "Webhook error" }, { status: 500 });
  }
}

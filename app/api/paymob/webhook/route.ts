import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { collection, doc, getDoc, getDocs, limit, query, setDoc, where } from "firebase/firestore";
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

function generateAccessPassword() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getPaymobObject(body: any) {
  return body?.obj || body?.transaction || body;
}

function extractOrderId(body: any, req: NextRequest) {
  const obj = getPaymobObject(body);
  return (
    req.nextUrl.searchParams.get("orderId") ||
    req.nextUrl.searchParams.get("merchant_order_id") ||
    body?.orderId ||
    body?.merchant_order_id ||
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

async function resolveOrderRef(orderId: string, transactionId: string) {
  if (orderId) return { orderId, ref: doc(db, "orders", orderId), data: null as any };

  if (transactionId) {
    const q = query(collection(db, "orders"), where("paymobTransactionId", "==", transactionId), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const found = snap.docs[0];
      return { orderId: found.id, ref: doc(db, "orders", found.id), data: { id: found.id, ...(found.data() as Record<string, any>) } as any };
    }
  }

  return { orderId: "", ref: null as any, data: null as any };
}

async function handleCallback(req: NextRequest, body: any) {
  try {
    const hmac = verifyHmacIfPossible(body, req);
    if (hmac.checked && !hmac.valid) {
      return NextResponse.json({ ok: false, error: "Invalid Paymob HMAC" }, { status: 401 });
    }

    const obj = getPaymobObject(body);
    const initialOrderId = String(extractOrderId(body, req));
    const successRaw = obj?.success ?? body?.success ?? req.nextUrl.searchParams.get("success");
    const success = successRaw === true || successRaw === "true" || successRaw === "1";
    const pendingRaw = obj?.pending ?? body?.pending ?? req.nextUrl.searchParams.get("pending");
    const pending = pendingRaw === true || pendingRaw === "true" || pendingRaw === "1";
    const transactionId = String(obj?.id || body?.id || req.nextUrl.searchParams.get("id") || "");

    const resolved = await resolveOrderRef(initialOrderId, transactionId);
    let accessPassword = "";

    if (resolved.ref) {
      let current = resolved.data;
      if (!current) {
        const snap = await getDoc(resolved.ref);
        current = snap.exists() ? ({ id: snap.id, ...(snap.data() as Record<string, any>) } as any) : null;
      }

      accessPassword = String(current?.accessPassword || current?.rosterAccessPassword || "");
      if (success && !accessPassword) accessPassword = generateAccessPassword();

      await setDoc(
        resolved.ref,
        {
          paymentStatus: success ? "paid" : pending ? "pending_payment" : "failed",
          status: success ? "تم الدفع" : pending ? "في انتظار الدفع" : "فشل الدفع",
          paymobTransactionId: transactionId,
          paymobCallback: body,
          paidAt: success ? new Date().toISOString() : null,
          updatedAt: new Date().toISOString(),
          ...(success
            ? {
                accessPassword,
                rosterAccessPassword: accessPassword,
                rosterAccessActive: true,
              }
            : {}),
        },
        { merge: true }
      );
    }

    return NextResponse.json({ ok: true, orderId: resolved.orderId, success, pending, transactionId, accessPassword: success ? accessPassword : "" });
  } catch (error: any) {
    console.error("Paymob webhook error:", error);
    return NextResponse.json({ ok: false, error: error?.message || "Webhook error" }, { status: 500 });
  }
}

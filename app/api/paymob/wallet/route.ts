import { NextRequest, NextResponse } from "next/server";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export const runtime = "nodejs";

type ShopCustomer = {
  name?: string;
  managerName?: string;
  email?: string;
  phone?: string;
  address?: string;
};

type ShopItem = {
  id?: string;
  title?: string;
  name?: string;
  price?: number | string;
  qty?: number | string;
  imageUrl?: string;
};

const paymobBaseUrl = () => (process.env.PAYMOB_BASE_URL || "https://accept.paymob.com").replace(/\/$/, "");
const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || "https://matrouhcup.online").replace(/\/$/, "");

function generateAccessPassword() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function toAmountCents(amount: any) {
  const pounds = Number(amount || 0);
  return Math.max(0, Math.round(pounds * 100));
}

function cleanPhone(phone: any) {
  let value = String(phone || "").replace(/[^0-9+]/g, "");
  if (value.startsWith("+20")) value = "0" + value.slice(3);
  if (value.startsWith("20") && value.length === 12) value = "0" + value.slice(2);
  return value;
}

function splitName(name?: string) {
  const parts = String(name || "عميل مطروح").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "عميل",
    lastName: parts.slice(1).join(" ") || "مطروح",
  };
}

function tournamentLabel(tournament: string) {
  if (tournament === "elite_cup") return "بطولة كأس النخبة";
  if (tournament === "matrouh_cup") return "كأس مطروح";
  return "مطروح الرياضية";
}

async function readPaymobJson(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function paymobPost(path: string, payload: any, bearerToken?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (bearerToken) headers.Authorization = `Bearer ${bearerToken}`;

  const res = await fetch(`${paymobBaseUrl()}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const data = await readPaymobJson(res);
  if (!res.ok) {
    const message = data?.detail || data?.message || data?.error || `Paymob request failed: ${path}`;
    const err: any = new Error(message);
    err.status = res.status;
    err.details = data;
    throw err;
  }
  return data;
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.PAYMOB_API_KEY || process.env.PAYMOB_ACCEPT_API_KEY || process.env.PAYMOB_LEGACY_API_KEY;
    const walletIntegrationId = Number(process.env.PAYMOB_WALLET_INTEGRATION_ID || "");

    if (!apiKey || !Number.isFinite(walletIntegrationId) || walletIntegrationId <= 0) {
      return NextResponse.json(
        {
          error:
            "دفع المحافظ غير مكتمل. أضف PAYMOB_API_KEY و PAYMOB_WALLET_INTEGRATION_ID في .env.local وعلى Vercel ثم اعمل Redeploy.",
        },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const isShopOrder = !!body.orderId;

    const tournament = String(body.tournament || "matrouh_cup");
    const shopCustomer: ShopCustomer = body.customer || {};
    const customerName = String(
      shopCustomer.name || shopCustomer.managerName || body.managerName || body.name || "عميل مطروح"
    ).trim();
    const email = String(shopCustomer.email || body.email || "customer@matrouhcup.online").trim();
    const phone = cleanPhone(shopCustomer.phone || body.phone);
    const address = String(shopCustomer.address || body.address || "Matrouh").trim();

    const orderId = String(body.orderId || `${tournament}_${Date.now()}`);
    const accessPassword = String(body.accessPassword || generateAccessPassword());
    const rawItems: ShopItem[] = Array.isArray(body.items) ? body.items : [];
    const price = Number(body.price || body.total || 0);
    const items: ShopItem[] = rawItems.length
      ? rawItems
      : [
          {
            id: tournament,
            title: `اشتراك ${tournamentLabel(tournament)}`,
            price,
            qty: 1,
          },
        ];

    const total = Number(body.total || price || items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 1), 0));
    const amountCents = toAmountCents(total);

    if (!phone || phone.length < 10) {
      return NextResponse.json({ error: "رقم المحفظة غير صحيح. اكتب رقم موبايل مصري صحيح." }, { status: 400 });
    }

    if (!customerName || amountCents <= 0 || !items.length) {
      return NextResponse.json({ error: "بيانات طلب المحفظة غير مكتملة." }, { status: 400 });
    }

    const { firstName, lastName } = splitName(customerName);

    const orderData: any = {
      id: orderId,
      type: isShopOrder ? "shop_order" : "tournament_registration",
      customer: {
        name: customerName,
        managerName: customerName,
        email,
        phone,
        address,
      },
      items: items.map((item) => ({
        id: item.id || "item",
        title: String(item.title || item.name || "منتج رياضي"),
        price: Number(item.price || 0),
        qty: Number(item.qty || 1),
        imageUrl: item.imageUrl || "",
      })),
      total,
      paymentMethod: "paymob_wallet",
      paymobMethod: "wallet_direct_api",
      paymentStatus: "pending_payment",
      status: "في انتظار دفع المحفظة",
      accessPassword,
      rosterAccessPassword: accessPassword,
      rosterAccessActive: false,
      updatedAt: new Date().toISOString(),
    };

    // Firestore لا يقبل قيمة undefined نهائيًا.
    // لذلك نضيف حقول البطولة فقط في تسجيل البطولات، ولا نرسلها في طلبات المتجر.
    if (!isShopOrder) {
      orderData.tournament = tournament;
      orderData.tournamentLabel = tournamentLabel(tournament);
    }

    if (!body.orderId) {
      orderData.createdAt = new Date().toISOString();
    }

    await setDoc(doc(db, "orders", orderId), orderData, { merge: true });

    const auth = await paymobPost("/api/auth/tokens", { api_key: apiKey });
    const authToken = auth?.token;
    if (!authToken) throw new Error("Paymob لم يرجع auth token.");

    const paymobOrder = await paymobPost(
      "/api/ecommerce/orders",
      {
        auth_token: authToken,
        delivery_needed: false,
        amount_cents: amountCents,
        currency: "EGP",
        merchant_order_id: orderId,
        items: items.map((item) => ({
          name: String(item.title || item.name || "منتج رياضي").slice(0, 120),
          amount_cents: toAmountCents(Number(item.price || 0) * Number(item.qty || 1)),
          description: String(item.title || item.name || "مطروح الرياضية").slice(0, 255),
          quantity: String(Number(item.qty || 1)),
        })),
      },
      authToken
    );

    const paymentKeyRes = await paymobPost(
      "/api/acceptance/payment_keys",
      {
        auth_token: authToken,
        amount_cents: amountCents,
        expiration: Number(process.env.PAYMOB_INTENTION_EXPIRATION || 3600),
        order_id: paymobOrder.id,
        billing_data: {
          apartment: "NA",
          email,
          floor: "NA",
          first_name: firstName,
          street: address || "Matrouh",
          building: "NA",
          phone_number: phone,
          shipping_method: "NA",
          postal_code: "NA",
          city: "Matrouh",
          country: "EG",
          last_name: lastName,
          state: "Matrouh",
        },
        currency: "EGP",
        integration_id: walletIntegrationId,
        lock_order_when_paid: false,
      },
      authToken
    );

    const paymentToken = paymentKeyRes?.token;
    if (!paymentToken) throw new Error("Paymob لم يرجع payment key للمحفظة.");

    const walletPay = await paymobPost(
      "/api/acceptance/payments/pay",
      {
        source: {
          identifier: phone,
          subtype: "WALLET",
        },
        payment_token: paymentToken,
      },
      authToken
    );

    const redirectUrl = walletPay?.redirect_url || walletPay?.iframe_redirection_url || walletPay?.url || walletPay?.payment_url || "";

    await setDoc(
      doc(db, "orders", orderId),
      {
        paymobOrderId: paymobOrder.id || "",
        paymobTransactionId: walletPay.id || walletPay.transaction_id || "",
        paymobWalletResponse: walletPay,
        paymobCheckoutUrl: redirectUrl,
        paymentStatus: walletPay?.success === true ? "paid" : "pending_payment",
        status: walletPay?.success === true ? "مدفوع" : "في انتظار تأكيد المحفظة",
        rosterAccessActive: walletPay?.success === true ? true : false,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    if (!redirectUrl) {
      return NextResponse.json({
        ok: true,
        orderId,
        paymobOrderId: paymobOrder.id || "",
        transactionId: walletPay.id || walletPay.transaction_id || "",
        message:
          "تم إرسال طلب الدفع للمحفظة. راجع الموبايل وأكمل الدفع من تطبيق/رسالة المحفظة، ثم ارجع للتطبيق لمتابعة حالة الطلب.",
        raw: walletPay,
      });
    }

    return NextResponse.json({
      ok: true,
      orderId,
      paymobOrderId: paymobOrder.id || "",
      transactionId: walletPay.id || walletPay.transaction_id || "",
      redirectUrl,
      url: redirectUrl,
      checkoutUrl: redirectUrl,
    });
  } catch (error: any) {
    console.error("Paymob wallet error:", error);
    return NextResponse.json(
      { error: error?.message || "فشل إنشاء دفع المحفظة.", details: error?.details || null },
      { status: error?.status || 500 }
    );
  }
}

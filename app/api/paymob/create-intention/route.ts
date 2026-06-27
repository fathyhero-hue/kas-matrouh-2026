import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type PaymobCustomer = {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
};

type PaymobItem = {
  id?: string;
  title?: string;
  name?: string;
  price?: number | string;
  qty?: number | string;
  imageUrl?: string;
};

const paymobBaseUrl = () => (process.env.PAYMOB_BASE_URL || "https://accept.paymob.com").replace(/\/$/, "");
const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || "https://matrouhcup.online").replace(/\/$/, "");

function parsePaymentMethods() {
  const raw =
    process.env.PAYMOB_INTEGRATION_IDS ||
    [process.env.PAYMOB_CARD_INTEGRATION_ID, process.env.PAYMOB_WALLET_INTEGRATION_ID].filter(Boolean).join(",");

  return String(raw || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : v;
    });
}

function toAmountCents(amount: any) {
  const pounds = Number(amount || 0);
  return Math.max(0, Math.round(pounds * 100));
}

function splitArabicName(name?: string) {
  const parts = String(name || "عميل مطروح").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "عميل",
    lastName: parts.slice(1).join(" ") || "مطروح",
  };
}

export async function POST(req: NextRequest) {
  try {
    const secretKey = process.env.PAYMOB_SECRET_KEY;
    const publicKey = process.env.PAYMOB_PUBLIC_KEY;
    const paymentMethods = parsePaymentMethods();

    if (!secretKey || !publicKey || paymentMethods.length === 0) {
      return NextResponse.json(
        {
          error:
            "Paymob غير مكتمل. أضف PAYMOB_SECRET_KEY و PAYMOB_PUBLIC_KEY و PAYMOB_INTEGRATION_IDS في .env.local وعلى Vercel.",
        },
        { status: 500 }
      );
    }

    const body = await req.json();
    const orderId = String(body.orderId || "");
    const customer: PaymobCustomer = body.customer || {};
    const items: PaymobItem[] = Array.isArray(body.items) ? body.items : [];
    const total = Number(body.total || 0);
    const amount = toAmountCents(total);

    if (!orderId || amount <= 0 || items.length === 0) {
      return NextResponse.json({ error: "بيانات الطلب غير مكتملة." }, { status: 400 });
    }

    const { firstName, lastName } = splitArabicName(customer.name);
    const phone = String(customer.phone || "01000000000").replace(/\s+/g, "");
    const email = String(customer.email || "customer@matrouhcup.online");
    const address = String(customer.address || "Matrouh");

    const payload = {
      amount,
      currency: "EGP",
      payment_methods: paymentMethods,
      special_reference: orderId,
      expiration: Number(process.env.PAYMOB_INTENTION_EXPIRATION || 3600),
      notification_url: `${siteUrl()}/api/paymob/webhook`,
      redirection_url: `${siteUrl()}/payment/result?orderId=${encodeURIComponent(orderId)}`,
      items: items.map((item) => ({
        name: String(item.title || item.name || "منتج رياضي").slice(0, 120),
        amount: toAmountCents(Number(item.price || 0) * Number(item.qty || 1)),
        description: String(item.title || item.name || "منتج من متجر مطروح الرياضية").slice(0, 255),
        quantity: Number(item.qty || 1),
        image: item.imageUrl || undefined,
      })),
      billing_data: {
        first_name: firstName,
        last_name: lastName,
        email,
        phone_number: phone,
        apartment: "NA",
        floor: "NA",
        street: address,
        building: "NA",
        city: "Matrouh",
        country: "EG",
        state: "Matrouh",
      },
      extras: {
        orderId,
        source: "matrouhcup-shop",
        notes: body.notes || "",
      },
    };

    const paymobRes = await fetch(`${paymobBaseUrl()}/v1/intention/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${secretKey}`,
      },
      body: JSON.stringify(payload),
    });

    const text = await paymobRes.text();
    let data: any = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!paymobRes.ok) {
      console.error("Paymob create intention failed:", data);
      return NextResponse.json(
        { error: data?.detail || data?.message || "فشل إنشاء عملية الدفع في Paymob.", details: data },
        { status: paymobRes.status }
      );
    }

    const clientSecret = data.client_secret || data.clientSecret;
    if (!clientSecret) {
      return NextResponse.json({ error: "Paymob لم يرجع client_secret.", details: data }, { status: 502 });
    }

    const checkoutUrl = `${paymobBaseUrl()}/unifiedcheckout/?publicKey=${encodeURIComponent(publicKey)}&clientSecret=${encodeURIComponent(clientSecret)}`;

    return NextResponse.json({
      ok: true,
      checkoutUrl,
      clientSecret,
      intentionId: data.id || "",
      intentionOrderId: data.intention_order_id || "",
      specialReference: data.special_reference || orderId,
      rawStatus: data.status || "",
    });
  } catch (error: any) {
    console.error("Create Paymob intention error:", error);
    return NextResponse.json({ error: error?.message || "حدث خطأ أثناء تجهيز الدفع." }, { status: 500 });
  }
}

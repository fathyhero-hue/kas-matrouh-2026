import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const paymobBaseUrl = () => (process.env.PAYMOB_BASE_URL || "https://accept.paymob.com").replace(/\/$/, "");
const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || "https://matrouhcup.online").replace(/\/$/, "");

function generateAccessPassword() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function normalizeIntegrationIds(raw: string) {
  return String(raw || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : v;
    });
}

function getSelectedPaymentMethods(method?: string) {
  const selectedMethod = String(method || "").toLowerCase();
  const cardId = process.env.PAYMOB_CARD_INTEGRATION_ID;
  const walletId = process.env.PAYMOB_WALLET_INTEGRATION_ID;
  if (selectedMethod === "wallet" && walletId) return normalizeIntegrationIds(walletId);
  if (selectedMethod === "card" && cardId) return normalizeIntegrationIds(cardId);
  const raw = process.env.PAYMOB_INTEGRATION_IDS || [cardId, walletId].filter(Boolean).join(",");
  return normalizeIntegrationIds(raw);
}

function toAmountCents(amount: any) {
  const pounds = Number(amount || 0);
  return Math.max(0, Math.round(pounds * 100));
}

function splitArabicName(name?: string) {
  const parts = String(name || "مسئول الفريق").trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || "مسئول", lastName: parts.slice(1).join(" ") || "الفريق" };
}

function tournamentLabel(tournament: string) {
  if (tournament === "elite_cup") return "بطولة كأس النخبة";
  if (tournament === "matrouh_cup") return "كأس مطروح";
  return "مطروح الرياضية";
}

export async function POST(req: NextRequest) {
  try {
    const secretKey = process.env.PAYMOB_SECRET_KEY;
    const publicKey = process.env.PAYMOB_PUBLIC_KEY;
    const body = await req.json().catch(() => ({}));
    const paymentMethods = getSelectedPaymentMethods(body.paymobMethod || body.paymentMethodType);

    if (!secretKey || !publicKey || paymentMethods.length === 0) {
      return NextResponse.json(
        { message: "Paymob غير مكتمل. أضف PAYMOB_SECRET_KEY و PAYMOB_PUBLIC_KEY و PAYMOB_CARD_INTEGRATION_ID و PAYMOB_WALLET_INTEGRATION_ID." },
        { status: 500 }
      );
    }

    const tournament = String(body.tournament || "matrouh_cup");
    const price = Number(body.price || 0);
    const amount = toAmountCents(price);
    const managerName = String(body.managerName || "").trim();
    const email = String(body.email || "customer@matrouhcup.online").trim();
    const phone = String(body.phone || "01000000000").replace(/\s+/g, "");

    if (!managerName || !phone || amount <= 0) {
      return NextResponse.json({ message: "بيانات الدفع غير مكتملة." }, { status: 400 });
    }

    const { firstName, lastName } = splitArabicName(managerName);
    const accessPassword = generateAccessPassword();

    const supabase = createServiceRoleClient();
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        type: "tournament_registration",
        tournament,
        tournament_label: tournamentLabel(tournament),
        customer_name: managerName,
        customer_manager_name: managerName,
        customer_email: email,
        customer_phone: phone,
        manager_name: managerName,
        phone,
        total: price,
        currency: "EGP",
        payment_method: "paymob",
        paymob_method: String(body.paymobMethod || body.paymentMethodType || "all"),
        payment_status: "pending_payment",
        status_label: "في انتظار الدفع",
        access_password: accessPassword,
        roster_access_password: accessPassword,
        roster_access_active: false,
      })
      .select("id")
      .single();

    if (orderErr || !order) {
      console.error("Order insert failed:", orderErr);
      return NextResponse.json({ message: "فشل إنشاء الطلب." }, { status: 500 });
    }
    const orderId = order.id as string;

    await supabase.from("order_items").insert({
      order_id: orderId,
      title: `اشتراك ${tournamentLabel(tournament)}`,
      price,
      qty: 1,
    });

    const payload = {
      amount,
      currency: "EGP",
      payment_methods: paymentMethods,
      special_reference: orderId,
      expiration: Number(process.env.PAYMOB_INTENTION_EXPIRATION || 3600),
      notification_url: `${siteUrl()}/api/paymob/webhook`,
      redirection_url: `${siteUrl()}/payment/result?orderId=${encodeURIComponent(orderId)}`,
      items: [
        {
          name: `اشتراك ${tournamentLabel(tournament)}`.slice(0, 120),
          amount,
          description: `رسوم تسجيل ${tournamentLabel(tournament)}`.slice(0, 255),
          quantity: 1,
        },
      ],
      billing_data: {
        first_name: firstName,
        last_name: lastName,
        email,
        phone_number: phone,
        apartment: "NA",
        floor: "NA",
        street: "Matrouh",
        building: "NA",
        city: "Matrouh",
        country: "EG",
        state: "Matrouh",
      },
      extras: { orderId, source: "matrouhcup-registration", tournament, paymobMethod: String(body.paymobMethod || body.paymentMethodType || "all") },
    };

    const paymobRes = await fetch(`${paymobBaseUrl()}/v1/intention/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Token ${secretKey}` },
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
      await supabase.from("orders").update({ payment_status: "payment_init_failed", status_label: "فشل إنشاء رابط الدفع", paymob_error: data }).eq("id", orderId);
      return NextResponse.json({ message: data?.detail || data?.message || "فشل إنشاء عملية الدفع في Paymob.", details: data }, { status: paymobRes.status });
    }

    const clientSecret = data.client_secret || data.clientSecret;
    if (!clientSecret) {
      return NextResponse.json({ message: "Paymob لم يرجع client_secret.", details: data }, { status: 502 });
    }

    const url = `${paymobBaseUrl()}/unifiedcheckout/?publicKey=${encodeURIComponent(publicKey)}&clientSecret=${encodeURIComponent(clientSecret)}`;
    await supabase.from("orders").update({ paymob_intention_id: data.id || "", paymob_client_secret: clientSecret, paymob_checkout_url: url }).eq("id", orderId);

    return NextResponse.json({ ok: true, url, checkoutUrl: url, orderId });
  } catch (error: any) {
    console.error("Paymob initiate error:", error);
    return NextResponse.json({ message: error?.message || "حدث خطأ أثناء تجهيز الدفع." }, { status: 500 });
  }
}

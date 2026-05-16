import { NextResponse } from 'next/server';

// 🛑 تم إضافة رقم الـ Integration ID الخاص بالمحافظ الإلكترونية بنجاح
const PAYMOB_API_KEY = "ZXlKaGJHY2lPaUpJVXpVeE1pSXNJblI1Y0NJNklrcFhWQ0o5LmV5SmpiR0Z6Y3lJNklrMWxjbU5vWVc1MElpd2ljSEp2Wm1sc1pWOXdheUk2TVRFMk1EZ3lPQ3dpYm1GdFpTSTZJbWx1YVhScFlXd2lmUS5xRGRkVmlLSnlTMV9oNUxDSlZ4WEtNSFdyV21IenJqWHNzUDZXbWpoUGNDcnZCRVVfQTlVVG1IeC1zU0o3MXE0Zm1YazFlOFZkRG9PQTBXbkJDaVk2Zw==";
const INTEGRATION_ID = "5670563"; // رقم المحافظ الإلكترونية الخاص بك
const AMOUNT_CENTS = 50000; // مثال: 500 جنيه (المبلغ مضروب في 100)

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { managerName, email, phone, tournament } = body;

    // 1. تسجيل الدخول لبيموب والحصول على الـ Token
    const authRes = await fetch('https://accept.paymob.com/api/auth/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: PAYMOB_API_KEY })
    });
    const authData = await authRes.json();
    const token = authData.token;

    // 2. تسجيل الطلب (Order)
    const orderRes = await fetch('https://accept.paymob.com/api/ecommerce/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_token: token,
        delivery_needed: "false",
        amount_cents: AMOUNT_CENTS,
        currency: "EGP",
        merchant_order_id: `${tournament}_${Date.now()}`,
        items: []
      })
    });
    const orderData = await orderRes.json();
    const orderId = orderData.id;

    // 3. إصدار مفتاح الدفع (Payment Key)
    const paymentKeyRes = await fetch('https://accept.paymob.com/api/acceptance/payment_keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_token: token,
        amount_cents: AMOUNT_CENTS,
        expiration: 3600,
        order_id: orderId,
        billing_data: {
          apartment: "NA", email: email, floor: "NA", first_name: managerName,
          street: "NA", building: "NA", phone_number: phone, shipping_method: "NA",
          postal_code: "NA", city: "Matrouh", country: "EG", last_name: "Manager",
          state: "NA"
        },
        currency: "EGP",
        integration_id: INTEGRATION_ID
      })
    });
    const paymentKeyData = await paymentKeyRes.json();
    const paymentToken = paymentKeyData.token;

    // 4. طلب رابط الدفع المباشر الخاص بالمحافظ الإلكترونية (فودافون كاش)
    const walletRes = await fetch('https://accept.paymob.com/api/acceptance/payments/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: {
          identifier: phone, // رقم الهاتف الذي سيقوم بالدفع
          subtype: "WALLET"
        },
        payment_token: paymentToken
      })
    });
    const walletData = await walletRes.json();

    // الرابط المباشر لصفحة فودافون كاش والمحافظ
    const redirectUrl = walletData.iframe_redirection_url;

    if (redirectUrl) {
      return NextResponse.json({ url: redirectUrl });
    } else {
      return NextResponse.json({ message: "فشل في إنشاء رابط محفظة الدفع." }, { status: 400 });
    }

  } catch (error) {
    console.error("Payment Error:", error);
    return NextResponse.json({ message: "حدث خطأ أثناء الاتصال بالدفع." }, { status: 500 });
  }
}
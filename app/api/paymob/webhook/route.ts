import { NextResponse } from 'next/server';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

// 🛑 حط الأرقام بتاعتك هنا
const HMAC_SECRET = "9CF3BFD0D4FC8F06E5CF1B20F4FCADD4";
const EMAIL_USER = "fathyhero@gmail.com"; // إيميلك اللي هتبعت منه
const EMAIL_PASS = "gxor rjql gwyn sbls";

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const hmacReceived = url.searchParams.get('hmac') || req.headers.get('hmac');
    const body = await req.json();
    const { obj } = body;

    // إذا كانت العملية ناجحة
    if (obj && obj.success === true) {
      const email = obj.order.billing_data.email;
      const managerName = obj.order.billing_data.first_name;
      const merchantOrderId = obj.order.merchant_order_id || "";
      const tournament = merchantOrderId.split('_')[0]; // بنعرف هو دفع لأي بطولة

      // جلب الباسورد السري من قاعدة البيانات
      const settingsDoc = tournament === 'elite_cup' ? 'registration_elite' : 'registration_matrouh';
      const docRef = doc(db, "settings", settingsDoc);
      const docSnap = await getDoc(docRef);
      
      let passwordToSent = "لم يتم تحديد باسورد في الإدارة بعد";
      let tournamentName = tournament === 'elite_cup' ? 'كأس النخبة' : 'كأس مطروح';

      if (docSnap.exists() && docSnap.data().password) {
        passwordToSent = docSnap.data().password;
      }

      // إعداد مرسل الإيميلات
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: EMAIL_USER, pass: EMAIL_PASS }
      });

      // إرسال الإيميل للمدير الفني
      await transporter.sendMail({
        from: `"مطروح الرياضية" <${EMAIL_USER}>`,
        to: email,
        subject: `تأكيد الدفع والرقم السري لبطولة ${tournamentName}`,
        html: `
          <div dir="rtl" style="font-family: Arial; text-align: center; color: #333;">
            <h2>أهلاً بك كابتن ${managerName}! ⚽</h2>
            <p>لقد تم تأكيد دفع رسوم الاشتراك في <strong>${tournamentName}</strong> بنجاح.</p>
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 10px; margin: 20px 0;">
               <p style="font-size: 18px; margin: 0;">الرقم السري الخاص بالتسجيل هو:</p>
               <h1 style="color: #2563eb; letter-spacing: 2px;">${passwordToSent}</h1>
            </div>
            <p>يرجى التوجه للمنصة فوراً وإدخال الرقم لاستكمال تسجيل قائمة فريقك.</p>
            <p>مع تحيات إدارة مطروح الرياضية 🦅</p>
          </div>
        `
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook Error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
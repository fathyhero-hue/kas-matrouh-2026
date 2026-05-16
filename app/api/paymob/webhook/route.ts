import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

const EMAIL_USER = "fathyhero66@gmail.com"; 
const EMAIL_PASS = "gxor rjql gwyn sbls";

// 🎙️ دالة لإرسال الإيميل بشكل موحد نستخدمها في الـ GET والـ POST
async function sendPasswordEmail(email: string, managerName: string, tournament: string) {
  try {
    // جلب الباسورد السري من قاعدة البيانات
    const settingsDoc = tournament === 'elite_cup' ? 'registration_elite' : 'registration_matrouh';
    const docRef = doc(db, "settings", settingsDoc);
    const docSnap = await getDoc(docRef);
    
    let passwordToSent = "لم يتم تحديد باسورد في الإدارة بعد";
    let tournamentName = tournament === 'elite_cup' ? 'كأس النخبة' : 'كأس مطروح';

    if (docSnap.exists() && docSnap.data().password) {
      passwordToSent = docSnap.data().password;
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: EMAIL_USER, pass: EMAIL_PASS }
    });

    // إرسال الإيميل العربي الاحترافي
    await transporter.sendMail({
      from: `"منصة مطروح الرياضية" <${EMAIL_USER}>`,
      to: email,
      subject: `🔒 الرقم السري لتسجيل قائمة بطولة ${tournamentName}`,
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; text-align: center; background-color: #0a1428; padding: 30px; color: #ffffff; border-radius: 20px;">
          <h2 style="color: #facc15; font-size: 26px; margin-bottom: 5px;">أهلاً بك كابتن ${managerName}! ⚽</h2>
          <p style="color: #67e8f9; font-size: 16px;">لقد تم تأكيد الاشتراك بنجاح في <strong>${tournamentName}</strong>.</p>
          
          <div style="background-color: #13213a; border: 2px solid #2563eb; padding: 25px; border-radius: 15px; margin: 25px 0;">
             <p style="font-size: 16px; color: #ffffff; margin: 0 0 10px 0;">الرقم السري المخصص لتسجيل فريقك هو:</p>
             <h1 style="color: #facc15; font-size: 36px; letter-spacing: 2px; margin: 0; font-weight: 900;">${passwordToSent}</h1>
          </div>
          
          <p style="font-size: 14px; color: #9ca3af;">يرجى التوجه فوراً للمنصة والدخول إلى "قوائم الفرق" -> "تسجيل فريق جديد"، ثم إدخال هذا الرقم السري لفتح استمارة التسكين ورفع صور اللاعبين الأوراق الرسمية.</p>
          <hr style="border: none; border-top: 1px solid #1e2a4a; margin: 20px 0;" />
          <p style="font-size: 13px; color: #fa5252;">إدارة المنصة: فتحي هيرو 🦅</p>
        </div>
      `
    });
    return true;
  } catch (err) {
    console.error("Email Sender Error:", err);
    return false;
  }
}

// 🟩 1. استقبال الـ GET Request (وهو حل مشكلة شاشة الـ 405 بالصورة)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const success = searchParams.get('success');
    
    // إذا كانت بيموب تؤكد أن الدفع نجح عبر الرابط
    if (success === 'true') {
      const email = searchParams.get('billing_data.email') || "";
      const firstName = searchParams.get('billing_data.first_name') || "المسئول";
      const merchantOrderId = searchParams.get('merchant_order_id') || "";
      const tournament = merchantOrderId.split('_')[0] || "matrouh_cup";

      if (email) {
        await sendPasswordEmail(email, firstName, tournament);
      }
    }

    // بعد الانتهاء، نحوله تلقائياً لصفحة النجاح العربي الفخمة اللي صممناها!
    return NextResponse.redirect(new URL('/paymob-success', req.url));

  } catch (error) {
    console.error("Webhook GET Error:", error);
    return NextResponse.json({ message: "Internal Error" }, { status: 500 });
  }
}

// 🟦 2. استقبال الـ POST Request (Callback في الخلفية لتأكيد البيانات)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { obj } = body;

    if (obj && obj.success === true) {
      const email = obj.order.billing_data.email;
      const managerName = obj.order.billing_data.first_name;
      const merchantOrderId = obj.order.merchant_order_id || "";
      const tournament = merchantOrderId.split('_')[0] || "matrouh_cup";

      if (email) {
        await sendPasswordEmail(email, managerName, tournament);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook POST Error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
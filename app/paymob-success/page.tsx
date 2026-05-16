import Link from 'next/link';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

// دالة لجلب الباسورد الحقيقي لعرضه على الشاشة فوراً بعد الدفع
async function getTournamentPassword(tournament: string) {
  try {
    const settingsDoc = tournament === 'elite_cup' ? 'registration_elite' : 'registration_matrouh';
    const docRef = doc(db, "settings", settingsDoc);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists() && docSnap.data().password) {
      return docSnap.data().password;
    }
  } catch (e) {
    console.error(e);
  }
  return "123456"; // باسورد افتراضي احتياطي في حال حدوث خطأ
}

export default async function PaymobSuccessPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const success = searchParams.get?.('success') || searchParams.success;
  const isSuccess = success === 'true';
  const merchantOrderId = (searchParams.get?.('merchant_order_id') || searchParams.merchant_order_id || "") as string;
  const tournament = merchantOrderId.split('_')[0] || "matrouh_cup";
  
  const tournamentName = tournament === 'elite_cup' ? 'كأس النخبة' : 'كأس مطروح';
  const password = await getTournamentPassword(tournament);

  return (
    <div dir="rtl" className="min-h-screen bg-[#0a1428] text-white flex flex-col items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-[#111c35] border-2 border-emerald-500 rounded-2xl p-8 text-center shadow-2xl space-y-6">
        
        {/* أيقونة النجاح */}
        <div className="mx-auto w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500 animate-pulse">
          <svg className="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        {/* نصوص التأكيد بالعربي */}
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-emerald-400">تمت عملية الدفع بنجاح! 🦅</h1>
          <p className="text-gray-300 text-sm leading-relaxed">
            مرحباً بك في <span className="text-cyan-400 font-bold">{tournamentName}</span>. تم تأكيد اشتراك فريقك بالكامل في السيستم بنجاح.
          </p>
        </div>

        {/* عرض كود التسجيل المباشر الاحترافي */}
        <div className="bg-[#172544] border-2 border-dashed border-blue-500 p-5 rounded-xl space-y-2">
          <span className="text-xs text-gray-400 block font-medium">الرقم السري الخاص بتسجيل قائمتك:</span>
          <span className="text-3xl font-black text-yellow-400 tracking-widest block font-mono select-all">
            {password}
          </span>
          <span className="text-[11px] text-cyan-300 block">قم بنسخ هذا الرقم لاستخدامه في لوحة تسجيل الفرق</span>
        </div>

        {/* تنويه إضافي للإيميل */}
        <p className="text-[12px] text-gray-400 leading-normal">
          💡 تم إرسال نسخة من هذا الرقم السري وإرشادات التسكين إلى بريدك الإلكتروني المسجل الآن.
        </p>

        {/* أزرار التوجيه */}
        <div className="pt-2">
          <Link 
            href="/teams/register" 
            className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition duration-200 shadow-lg text-sm"
          >
            الانتقال لتسجيل قائمة اللاعبين فوراً ⚽
          </Link>
          <Link 
            href="/" 
            className="block w-full text-gray-400 hover:text-white text-xs mt-4 underline transition"
          >
            العودة للرئيسية
          </Link>
        </div>

      </div>
    </div>
  );
}
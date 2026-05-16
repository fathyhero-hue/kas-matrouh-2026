import Link from 'next/link';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

// دالة سحابية ديناميكية لجلب الباسورد المحدث مباشرة من الفايربيز للبطولة المحددة
async function getTournamentPassword(tournament: string) {
  try {
    const settingsDoc = tournament === 'elite_cup' ? 'registration_elite' : 'registration_matrouh';
    const docRef = doc(db, "settings", settingsDoc);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists() && docSnap.data().password) {
      return docSnap.data().password;
    }
  } catch (e) {
    console.error("Firebase Password Fetch Error: ", e);
  }
  return "Matrouh2026"; // قيمة احتياطية مأمنة في حال عدم القراءة
}

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function PaymobSuccessPage({ searchParams }: PageProps) {
  // قراءة الـ searchParams بشكل آمن يتوافق مع معايير الـ TypeScript و Next.js المحدثة
  const resolvedParams = await searchParams;
  
  const success = resolvedParams.success;
  const isSuccess = success === 'true';
  const merchantOrderId = (resolvedParams.merchant_order_id || "") as string;
  
  // معرفة نوع البطولة ديناميكياً بناءً على ما سجلناه في الـ Order Id أثناء الدفع
  const tournament = merchantOrderId.split('_')[0] || "matrouh_cup";
  const tournamentName = tournament === 'elite_cup' ? 'كأس النخبة' : 'كأس مطروح';
  
  // سحب الباسورد الفعلي ليعرض فوراً للكابتن على الشاشة بعد الدفع
  const password = await getTournamentPassword(tournament);

  return (
    <div dir="rtl" className="min-h-screen bg-[#0a1428] text-white flex flex-col items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-[#111c35] border-2 border-emerald-500 rounded-3xl p-8 text-center shadow-2xl space-y-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-emerald-500/5 blur-3xl pointer-events-none"></div>
        
        {/* أيقونة النجاح والاعتماد */}
        <div className="mx-auto w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500 animate-pulse relative z-10">
          <svg className="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        {/* رسائل التأكيد باللغة العربية المفهومة */}
        <div className="space-y-2 relative z-10">
          <h1 className="text-2xl font-black text-emerald-400">تمت عملية الدفع بنجاح! 🦅</h1>
          <p className="text-gray-300 text-sm leading-relaxed">
            مرحباً بك في بطولة <span className="text-cyan-400 font-bold">{tournamentName}</span> الرسمية. لقد تم تأكيد اشتراك فريقك المالي في السيستم بنجاح وأمان.
          </p>
        </div>

        {/* لوحة عرض كود التسجيل السري الموزع */}
        <div className="bg-[#172544] border-2 border-dashed border-blue-500 p-5 rounded-xl space-y-2 relative z-10">
          <span className="text-xs text-gray-400 block font-bold">الرقم السري المخصص لتسجيل قائمتك:</span>
          <span className="text-3xl font-black text-yellow-400 tracking-widest block font-mono select-all">
            {password}
          </span>
          <span className="text-[11px] text-cyan-300 block font-medium">اضغط مطولاً على الرقم لنسخه مباشرة</span>
        </div>

        {/* التنويه الخاص بالبريد الإلكتروني للعميل */}
        <p className="text-[12px] text-gray-400 leading-normal relative z-10">
          💡 تم إرسال نسخة احتياطية من هذا الرقم السري وإرشادات التسكين الشاملة إلى بريدك الإلكتروني المسجل في الفاتورة الآن.
        </p>

        {/* أزرار التنقل السري العريضة */}
        <div className="pt-2 relative z-10 space-y-3">
          <Link 
            href="/" 
            className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 px-4 rounded-xl transition duration-200 shadow-lg text-sm text-center"
          >
            الانتقال لتسجيل قائمة اللاعبين بالمنصة ⚽
          </Link>
          <Link 
            href="/" 
            className="block w-full text-gray-400 hover:text-white text-xs underline text-center transition"
          >
            العودة للشاشة الرئيسية
          </Link>
        </div>

      </div>
    </div>
  );
}
import React from "react";
import { ShieldCheck } from "lucide-react";

export const metadata = {
  title: "سياسة الخصوصية | بطولة كأس مطروح",
  description: "سياسة الخصوصية واستخدام البيانات لتطبيق بطولة كأس مطروح",
};

export default function PrivacyPolicy() {
  return (
    <div dir="rtl" className="min-h-screen bg-[#0a1428] text-white p-6 md:p-12 font-sans">
      <div className="max-w-3xl mx-auto bg-[#13213a] rounded-3xl p-8 border border-yellow-400/30 shadow-2xl">
        <div className="flex items-center justify-center gap-3 mb-8">
          <ShieldCheck className="h-10 w-10 text-yellow-400" />
          <h1 className="text-3xl font-black text-yellow-300">سياسة الخصوصية</h1>
        </div>

        <div className="space-y-6 text-gray-300 leading-relaxed text-sm md:text-base">
          <p>مرحباً بكم في التطبيق الرسمي لـ <strong>بطولة كأس مطروح</strong>. نحن نولي أهمية كبرى لخصوصية مستخدمينا ومشجعينا. توضح هذه السياسة كيفية تعاملنا مع المعلومات داخل التطبيق.</p>

          <h2 className="text-xl font-bold text-cyan-300 mt-6 border-b border-white/10 pb-2">1. جمع البيانات واستخدامها</h2>
          <ul className="list-disc list-inside space-y-2 pr-4">
            <li><strong>مسابقة التوقعات:</strong> عند المشاركة في التوقعات، نطلب (الاسم ورقم الهاتف) فقط لغرض التواصل مع الفائزين لتسليم الجوائز. لا يتم مشاركة هذه البيانات مع أي أطراف خارجية أو استخدامها في أغراض تسويقية.</li>
            <li><strong>الإشعارات (Push Notifications):</strong> عند موافقتك على تفعيل الإشعارات، نقوم بحفظ رمز معرف الجهاز (Token) لإرسال تحديثات المباريات والأهداف. يمكنك إلغاء هذا الإذن في أي وقت من إعدادات هاتفك.</li>
          </ul>

          <h2 className="text-xl font-bold text-cyan-300 mt-6 border-b border-white/10 pb-2">2. حماية البيانات</h2>
          <p>تتم استضافة قاعدة بيانات التطبيق على خوادم Google Firebase الآمنة والمشفرة، ونحن نتخذ كافة الإجراءات التقنية اللازمة لحماية بياناتك من الوصول غير المصرح به.</p>

          <h2 className="text-xl font-bold text-cyan-300 mt-6 border-b border-white/10 pb-2">3. ملفات تعريف الارتباط (Cookies)</h2>
          <p>يستخدم التطبيق تقنيات التخزين المحلي (Local Storage) البسيطة فقط لحفظ حالة توقعاتك السابقة على جهازك لتسهيل تجربة الاستخدام، ولا نستخدم أي تقنيات تتبع لتصفحك.</p>

          <h2 className="text-xl font-bold text-cyan-300 mt-6 border-b border-white/10 pb-2">4. التواصل معنا</h2>
          <p>إذا كان لديك أي استفسارات حول سياسة الخصوصية، يمكنك التواصل مع إدارة البطولة والمركز الإعلامي عبر قنواتنا الرسمية.</p>

          <div className="mt-10 pt-6 border-t border-white/10 text-center text-xs opacity-60">
            آخر تحديث: أبريل ٢٠٢٦ • إعداد وتطوير: فتحي هيرو
          </div>
        </div>
      </div>
    </div>
  );
}
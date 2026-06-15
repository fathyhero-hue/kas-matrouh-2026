export const metadata = {
  title: "Privacy Policy | Matrouh Sports",
  description: "Privacy Policy for Matrouh Sports.",
};

export default function PrivacyPolicyPage() {
  return (
    <main dir="rtl" className="min-h-screen bg-[#071124] px-4 py-10 text-white">
      <section className="mx-auto max-w-4xl rounded-3xl border border-cyan-500/20 bg-[#0b1528] p-6 shadow-2xl">
        <h1 className="text-3xl font-black text-cyan-300">Privacy Policy — سياسة الخصوصية</h1>
        <p className="mt-4 text-sm text-slate-400">Last updated: 15 June 2026</p>

        <div className="mt-6 space-y-6 leading-8 text-slate-200">
          <p>
            تحترم منصة مطروح الرياضية خصوصية المستخدمين، ونوضح في هذه السياسة كيفية التعامل مع البيانات التي يتم تقديمها أو استخدامها داخل الموقع والتطبيق.
          </p>

          <section>
            <h2 className="text-xl font-black text-emerald-300">البيانات التي قد نجمعها</h2>
            <p className="mt-2">قد نقوم بجمع بيانات مثل الاسم، رقم الهاتف، البريد الإلكتروني، بيانات الفريق، بيانات الاشتراك، وبيانات الطلبات عند استخدام خدمات المنصة.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-emerald-300">استخدام البيانات</h2>
            <p className="mt-2">نستخدم البيانات لإدارة البطولات، تأكيد الاشتراكات، التواصل مع المستخدمين، عرض النتائج، تحسين الخدمة، ومعالجة طلبات الدعم.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-emerald-300">الإشعارات</h2>
            <p className="mt-2">قد يطلب الموقع إذن إرسال إشعارات فورية للمستخدمين حول المباريات، النتائج، أو تحديثات البطولة. يمكن للمستخدم إيقاف الإشعارات من إعدادات المتصفح أو الجهاز في أي وقت.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-emerald-300">حماية البيانات</h2>
            <p className="mt-2">نستخدم إجراءات مناسبة لحماية البيانات، ولا نقوم ببيع بيانات المستخدمين لأطراف خارجية.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-emerald-300">التواصل</h2>
            <p className="mt-2" dir="ltr">Email: fathyhero@gmail.com — Phone: 01222264993 — Address: Matrouh, Egypt</p>
          </section>
        </div>
      </section>
    </main>
  );
}

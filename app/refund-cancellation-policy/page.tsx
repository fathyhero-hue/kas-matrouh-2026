export const metadata = {
  title: "Refund & Cancellation Policy | Matrouh Sports",
  description: "Refund and cancellation policy for Matrouh Sports.",
};

export default function RefundCancellationPolicyPage() {
  return (
    <main dir="rtl" className="min-h-screen bg-[#071124] px-4 py-10 text-white">
      <section className="mx-auto max-w-4xl rounded-3xl border border-cyan-500/20 bg-[#0b1528] p-6 shadow-2xl">
        <h1 className="text-3xl font-black text-cyan-300">Refund & Cancellation Policy — سياسة الاسترجاع والإلغاء</h1>
        <p className="mt-4 text-sm text-slate-400">Last updated: 15 June 2026</p>

        <div className="mt-6 space-y-6 leading-8 text-slate-200">
          <p>
            يمكن للعميل طلب إلغاء أو استرجاع قيمة الاشتراك خلال 14 يومًا من تاريخ الشراء، وفقًا للشروط الموضحة أدناه.
          </p>

          <section>
            <h2 className="text-xl font-black text-emerald-300">شروط الاسترجاع</h2>
            <ul className="mt-2 list-inside list-disc space-y-2">
              <li>يجب تقديم طلب الاسترجاع خلال 14 يومًا من تاريخ الشراء.</li>
              <li>يجب ألا تكون خدمة الاشتراك قد بدأت فعليًا أو تم اعتماد مشاركة الفريق بشكل نهائي في البطولة.</li>
              <li>يجب تقديم بيانات الطلب أو وسيلة إثبات الدفع عند طلب الاسترجاع.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-black text-emerald-300">الإلغاء</h2>
            <p className="mt-2">يمكن طلب إلغاء الاشتراك قبل بدء البطولة أو قبل اعتماد تسجيل الفريق بشكل نهائي.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-emerald-300">مدة معالجة الطلب</h2>
            <p className="mt-2">يتم مراجعة طلبات الاسترجاع أو الإلغاء بعد التواصل مع الدعم، وقد تختلف مدة المعالجة حسب وسيلة الدفع المستخدمة.</p>
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

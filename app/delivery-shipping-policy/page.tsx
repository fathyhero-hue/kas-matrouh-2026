export const metadata = {
  title: "Delivery & Shipping Policy | Matrouh Sports",
  description: "Delivery and shipping policy for Matrouh Sports.",
};

export default function DeliveryShippingPolicyPage() {
  return (
    <main dir="rtl" className="min-h-screen bg-[#071124] px-4 py-10 text-white">
      <section className="mx-auto max-w-4xl rounded-3xl border border-cyan-500/20 bg-[#0b1528] p-6 shadow-2xl">
        <h1 className="text-3xl font-black text-cyan-300">Delivery & Shipping Policy — سياسة التوصيل والشحن</h1>
        <p className="mt-4 text-sm text-slate-400">Last updated: 15 June 2026</p>

        <div className="mt-6 space-y-6 leading-8 text-slate-200">
          <p>
            الخدمات الحالية على منصة مطروح الرياضية هي خدمات اشتراك في بطولات كرة قدم، ولا يوجد شحن أو توصيل لمنتجات مادية في الوقت الحالي.
          </p>

          <section>
            <h2 className="text-xl font-black text-emerald-300">طبيعة التسليم</h2>
            <p className="mt-2">بعد إتمام الطلب أو الدفع، يتم التواصل مع العميل لتأكيد الاشتراك وتسجيل بيانات الفريق أو الطلب حسب نوع الخدمة.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-emerald-300">الشحن</h2>
            <p className="mt-2">لا توجد رسوم شحن حاليًا، لأن المنتجات المتاحة عبارة عن خدمات اشتراك وليست منتجات مادية يتم توصيلها.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-emerald-300">الدعم والتواصل</h2>
            <p className="mt-2" dir="ltr">Email: fathyhero@gmail.com — Phone: 01222264993 — Address: Matrouh, Egypt</p>
          </section>
        </div>
      </section>
    </main>
  );
}

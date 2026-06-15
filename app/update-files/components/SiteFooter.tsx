import Link from "next/link";

const footerLinks = [
  { href: "/products", label: "المنتجات والأسعار" },
  { href: "/about", label: "من نحن" },
  { href: "/contact", label: "تواصل معنا" },
  { href: "/privacy-policy", label: "سياسة الخصوصية" },
  { href: "/delivery-shipping-policy", label: "سياسة التوصيل والخدمة" },
  { href: "/refund-cancellation-policy", label: "سياسة الاسترجاع والإلغاء" },
];

const products = [
  {
    name: "اشتراك فى بطولة كأس النخبة",
    price: "1200 جنيه",
    description: "اشتراك في بطولة كرة قدم",
  },
  {
    name: "اشتراك بطولة كأس مطروح",
    price: "1500 جنيه",
    description: "اشتراك في بطولة كرة قدم",
  },
];

export default function SiteFooter() {
  return (
    <footer dir="rtl" className="mt-16 border-t border-cyan-500/20 bg-[#061226] text-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] border border-cyan-500/20 bg-gradient-to-br from-[#0b1d39] via-[#08172f] to-[#050f20] p-5 shadow-2xl sm:p-7 lg:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr_1fr_1fr]">
            <section className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-yellow-400/30 bg-yellow-400/10 px-4 py-2 text-sm font-black text-yellow-300">
                🏆 منصة بطولات كرة القدم
              </div>

              <div>
                <h2 className="text-2xl font-black text-cyan-300 sm:text-3xl">
                  مطروح الرياضية
                </h2>
                <p className="mt-3 max-w-xl text-sm font-semibold leading-8 text-slate-300">
                  منصة رياضية لعرض البطولات، المباريات، النتائج، الإحصائيات، وخدمات الاشتراك في بطولات كرة القدم داخل مطروح بشكل منظم وواضح.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="text-xs font-black text-slate-400">العنوان</div>
                  <div className="mt-1 text-sm font-bold text-white">Matrouh, Egypt</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="text-xs font-black text-slate-400">نوع المنتجات</div>
                  <div className="mt-1 text-sm font-bold text-white">خدمات اشتراك في بطولات كرة قدم</div>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-lg font-black text-emerald-300">بيانات التواصل</h3>
              <div className="space-y-3 rounded-2xl border border-white/10 bg-[#07152c] p-4">
                <div>
                  <div className="text-xs font-black text-slate-400">البريد الإلكتروني</div>
                  <a
                    href="mailto:fathyhero@gmail.com"
                    className="mt-1 block break-all text-sm font-bold text-cyan-300 transition hover:text-cyan-200"
                    dir="ltr"
                  >
                    fathyhero@gmail.com
                  </a>
                </div>
                <div className="h-px bg-white/10" />
                <div>
                  <div className="text-xs font-black text-slate-400">رقم الهاتف</div>
                  <a
                    href="tel:+201222264993"
                    className="mt-1 block text-sm font-bold text-cyan-300 transition hover:text-cyan-200"
                    dir="ltr"
                  >
                    01222264993
                  </a>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-lg font-black text-emerald-300">روابط مهمة</h3>
              <nav className="rounded-2xl border border-white/10 bg-[#07152c] p-4" aria-label="روابط مهمة">
                <ul className="space-y-3">
                  {footerLinks.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="group flex items-center justify-between rounded-xl px-3 py-2 text-sm font-bold text-slate-200 transition hover:bg-cyan-500/10 hover:text-cyan-300"
                      >
                        <span>{link.label}</span>
                        <span className="text-cyan-500 opacity-60 transition group-hover:translate-x-[-3px] group-hover:opacity-100">←</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </section>

            <section className="space-y-4">
              <h3 className="text-lg font-black text-emerald-300">المنتجات والأسعار</h3>
              <div className="space-y-3">
                {products.map((product) => (
                  <article
                    key={product.name}
                    className="rounded-2xl border border-yellow-400/20 bg-yellow-400/[0.06] p-4"
                  >
                    <h4 className="text-sm font-black leading-7 text-white">{product.name}</h4>
                    <p className="mt-1 text-xs font-semibold text-slate-400">{product.description}</p>
                    <div className="mt-3 inline-flex rounded-full border border-yellow-400/30 bg-yellow-400/10 px-3 py-1 text-sm font-black text-yellow-300">
                      {product.price}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <div className="mt-8 flex flex-col gap-3 border-t border-white/10 pt-5 text-center text-xs font-bold text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:text-start">
            <p>© 2026 مطروح الرياضية. جميع الحقوق محفوظة.</p>
            <p>منصة رياضية لإدارة وعرض البطولات والاشتراكات الرياضية.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

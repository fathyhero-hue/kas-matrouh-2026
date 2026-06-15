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
    name: "اشتراك بطولة كأس النخبة",
    price: "1200 جنيه",
  },
  {
    name: "اشتراك بطولة كأس مطروح",
    price: "1500 جنيه",
  },
];

export default function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-cyan-500/20 bg-[#06142a] text-white">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-10 md:grid-cols-2 xl:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-black text-cyan-300">
                مطروح الرياضية
              </h2>
              <p className="mt-3 text-sm leading-8 text-gray-300">
                منصة رياضية لعرض البطولات، المباريات، النتائج، الإحصائيات،
                وخدمات الاشتراك في بطولات كرة القدم بشكل منظم واحترافي.
              </p>
            </div>

            <div className="rounded-2xl border border-cyan-500/20 bg-[#0b1d39] p-4">
              <div className="text-sm font-bold text-cyan-300">
                العنوان
              </div>
              <div className="mt-2 text-sm text-gray-300">
                Matrouh, Egypt
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h3 className="text-xl font-black text-cyan-300">بيانات التواصل</h3>

            <div className="rounded-2xl border border-white/10 bg-[#0b1d39] p-4 space-y-4">
              <div>
                <div className="text-sm font-bold text-gray-400">البريد الإلكتروني</div>
                <a
                  href="mailto:fathyhero@gmail.com"
                  className="mt-1 block text-base font-semibold text-white hover:text-cyan-300 transition"
                >
                  fathyhero@gmail.com
                </a>
              </div>

              <div>
                <div className="text-sm font-bold text-gray-400">رقم الهاتف</div>
                <a
                  href="tel:01222264993"
                  className="mt-1 block text-base font-semibold text-white hover:text-cyan-300 transition"
                >
                  01222264993
                </a>
              </div>

              <div>
                <div className="text-sm font-bold text-gray-400">نوع الخدمة</div>
                <div className="mt-1 text-sm text-gray-300">
                  اشتراكات بطولات كرة قدم
                </div>
              </div>
            </div>
          </div>

          {/* Links */}
          <div className="space-y-4">
            <h3 className="text-xl font-black text-cyan-300">روابط مهمة</h3>

            <div className="rounded-2xl border border-white/10 bg-[#0b1d39] p-4">
              <ul className="space-y-3">
                {footerLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm font-semibold text-gray-200 hover:text-cyan-300 transition"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Products */}
          <div className="space-y-4">
            <h3 className="text-xl font-black text-cyan-300">المنتجات والأسعار</h3>

            <div className="space-y-4">
              {products.map((product) => (
                <div
                  key={product.name}
                  className="rounded-2xl border border-white/10 bg-[#0b1d39] p-4"
                >
                  <div className="text-sm font-bold text-white leading-7">
                    {product.name}
                  </div>
                  <div className="mt-2 inline-flex rounded-full bg-cyan-500/10 px-3 py-1 text-sm font-black text-cyan-300">
                    {product.price}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 border-t border-white/10 pt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-gray-400">
            © 2026 مطروح الرياضية. جميع الحقوق محفوظة.
          </p>

          <p className="text-sm text-gray-500">
            تم تطوير المنصة لخدمة البطولات والاشتراكات الرياضية في مطروح.
          </p>
        </div>
      </div>
    </footer>
  );
}
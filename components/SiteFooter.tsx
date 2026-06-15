import Link from "next/link";

const links = [
  { href: "/products", label: "Products & Prices" },
  { href: "/about", label: "About Us" },
  { href: "/contact", label: "Contact Us" },
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/delivery-shipping-policy", label: "Delivery & Shipping" },
  { href: "/refund-cancellation-policy", label: "Refund & Cancellation" },
];

export default function SiteFooter() {
  return (
    <footer dir="rtl" className="mt-12 border-t border-cyan-500/20 bg-[#071124] text-white">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-6 md:grid-cols-3">
          <div>
            <h2 className="text-xl font-black text-cyan-300">مطروح الرياضية</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              منصة رياضية لعرض البطولات، المباريات، النتائج، الإحصائيات، وخدمات الاشتراك في بطولات كرة القدم.
            </p>
          </div>

          <div>
            <h3 className="font-black text-emerald-300">بيانات التواصل</h3>
            <div className="mt-3 space-y-2 text-sm text-slate-300" dir="ltr">
              <p>Email: <a className="text-cyan-300 underline" href="mailto:fathyhero@gmail.com">fathyhero@gmail.com</a></p>
              <p>Phone: <a className="text-cyan-300 underline" href="tel:+201222264993">01222264993</a></p>
              <p>Address: Matrouh, Egypt</p>
            </div>
          </div>

          <div>
            <h3 className="font-black text-emerald-300">روابط مهمة</h3>
            <div className="mt-3 grid gap-2 text-sm text-slate-300">
              {links.map((link) => (
                <Link key={link.href} href={link.href} className="hover:text-cyan-300">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-white/10 pt-4 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} Matrouh Sports. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

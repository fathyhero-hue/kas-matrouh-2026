import Link from "next/link";
import Image from "next/image";
import { Mail, Phone, MapPin } from "lucide-react";

const links = [
  { href: "/products", label: "المنتجات والأسعار" },
  { href: "/about", label: "من نحن" },
  { href: "/contact", label: "تواصل معنا" },
  { href: "/privacy-policy", label: "سياسة الخصوصية" },
  { href: "/delivery-shipping-policy", label: "سياسة التوصيل والخدمة" },
  { href: "/refund-cancellation-policy", label: "سياسة الاسترجاع والإلغاء" },
];

export default function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-white/10 bg-brand-dark text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
        {/* Brand */}
        <div className="flex flex-col items-center gap-2 text-center">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="مطروح الرياضية" width={32} height={32} className="rounded-full" />
            <span className="text-h3 font-black">مطروح الرياضية</span>
          </Link>
          <p className="max-w-xs text-caption leading-6 text-muted-foreground">
            منصة رياضية لعرض البطولات، المباريات، النتائج، والإحصائيات بشكل منظم واحترافي.
          </p>
        </div>

        {/* Links — single wrapped row, compact on mobile */}
        <nav className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2.5 border-y border-white/10 py-6">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="text-caption font-bold text-muted-foreground transition-colors hover:text-foreground">
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Contact — compact chips, wrap on mobile */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a
            href="mailto:fathyhero@gmail.com"
            className="flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-caption font-bold text-muted-foreground transition-colors hover:text-foreground"
          >
            <Mail className="h-3.5 w-3.5" />
            fathyhero@gmail.com
          </a>
          <a
            href="tel:01222264993"
            dir="ltr"
            className="flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-caption font-bold text-muted-foreground transition-colors hover:text-foreground"
          >
            <Phone className="h-3.5 w-3.5" />
            01222264993
          </a>
          <span className="flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-caption font-bold text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            مطروح، مصر
          </span>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 flex flex-col items-center gap-1.5 text-center">
          <p className="text-caption text-muted-foreground">© 2026 مطروح الرياضية. جميع الحقوق محفوظة.</p>
          <p className="text-caption text-muted-foreground">تم تطوير المنصة لخدمة البطولات والاشتراكات الرياضية في مطروح.</p>
        </div>
      </div>
    </footer>
  );
}

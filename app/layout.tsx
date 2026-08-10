import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";
import SiteFooter from "@/components/SiteFooter";
import { Toaster } from "@/components/ui/sonner";
import { ConfirmDialogHost } from "@/components/ui/confirm-dialog";
import { CartProvider } from "@/lib/shop/cart-context";
import { CartButton } from "@/components/home/cart-button";
import { NotifyButton } from "@/components/home/notify-button";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "مطروح الرياضية",
  description: "منصة مطروح الرياضية للبطولات والنتائج والإحصائيات",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className={`dark ${cairo.variable}`}>
      <body className="bg-background text-foreground font-sans">
        <CartProvider>
          <header className="print:hidden sticky top-0 z-40 border-b border-white/10 bg-brand-dark/95 backdrop-blur-lg">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
              <Link href="/" className="flex items-center gap-2.5">
                <Image src="/logo.png" alt="مطروح الرياضية" width={36} height={36} className="rounded-full" priority />
                <span className="text-h3 font-black">مطروح الرياضية</span>
              </Link>
              <div className="flex items-center gap-2">
                <Link href="/player-card" className="hidden rounded-full px-4 py-2 text-caption font-bold text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground sm:block">
                  تسجيل اللاعبين
                </Link>
                <Link href="/shop" className="rounded-full px-4 py-2 text-caption font-bold text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground">
                  المتجر
                </Link>
                <NotifyButton />
                <CartButton />
              </div>
            </div>
          </header>

          {children}

          <SiteFooter />
          <Toaster />
          <ConfirmDialogHost />
        </CartProvider>
      </body>
    </html>
  );
}

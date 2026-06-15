import type { Metadata } from "next";
import "./globals.css";
import SiteFooter from "@/components/SiteFooter";

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
    <html lang="ar" dir="rtl">
      <body className="bg-[#041226] text-white">
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "بطولة كأس مطروح",
  description: "الموقع الرسمي لبطولة كأس مطروح النسخة الثالثة",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        {children}
      </body>
    </html>
  );
}
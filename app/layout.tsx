import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "بطولة كأس مطروح ٢٠٢٦",
  description: "نتائج المباريات - جدول الترتيب - الهدافين - الكروت",
  keywords: ["كأس مطروح", "بطولة مطروح", "نتائج مباريات", "ترتيب", "هدافين"],
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "كأس مطروح",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
<link rel="manifest" href="/manifest.json" />
<script>
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
  }
</script>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="theme-color" content="#facc15" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="كأس مطروح" />
        
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="icon" href="/icon-192.png" />
      </head>
      <body className="bg-[#0a1428] text-white antialiased">
        {children}
      </body>
    </html>
  );
}
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "منصة مطروح الرياضية",
  description: "التطبيق الرسمي لمتابعة نتائج وأخبار كل البطولات والأحداث الرياضية فى مطروح",
  manifest: "/manifest.json?v=2",
  icons: {
    icon: "/icon.png?v=2",
    apple: "/apple-touch-icon.png?v=2",
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
        
        {/* 🚀 عداد قياس السرعة والأداء من فيرسيل */}
        <SpeedInsights />
        
        {/* كود تشغيل الـ Service Worker لضمان عمل التطبيق (PWA) بشكل سليم */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(
                    function(registration) {
                      console.log('ServiceWorker registration successful');
                    },
                    function(err) {
                      console.log('ServiceWorker registration failed: ', err);
                    }
                  );
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}

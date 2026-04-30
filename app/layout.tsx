import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "بطولة كأس مطروح",
  description: "التطبيق الرسمي لمتابعة نتائج وأخبار بطولة كأس مطروح النسخة الثالثة",
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
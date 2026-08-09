"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";

declare global {
  interface Window {
    OneSignalDeferred?: Array<(OneSignal: any) => Promise<void> | void>;
    __oneSignalInitialized?: boolean;
  }
}

export function NotifyButton() {
  const [ready, setReady] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);

    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
    if (!appId) return;

    const existingScript = document.querySelector('script[src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"]');
    if (!existingScript) {
      const script = document.createElement("script");
      script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
      script.defer = true;
      document.head.appendChild(script);
    }

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    if (!window.__oneSignalInitialized) {
      window.__oneSignalInitialized = true;
      window.OneSignalDeferred.push(async (OneSignal: any) => {
        await OneSignal.init({
          appId,
          serviceWorkerPath: "/OneSignalSDKWorker.js",
          serviceWorkerUpdaterPath: "/OneSignalSDKUpdaterWorker.js",
          notifyButton: { enable: false },
          allowLocalhostAsSecureOrigin: true,
        });
        setReady(true);
        setPermission(Notification.permission);
      });
    } else {
      setReady(true);
      setPermission(Notification.permission);
    }
  }, []);

  const enableNotifications = () => {
    if (typeof window === "undefined") return;
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal: any) => {
      await OneSignal.Notifications.requestPermission();
      setPermission(Notification.permission);
    });
  };

  if (permission === "unsupported") return null;

  if (permission === "granted") {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-green/15 text-accent-green" title="الإشعارات مفعلة">
        <BellRing className="h-5 w-5" />
      </div>
    );
  }

  if (permission === "denied") {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/15 text-destructive" title="الإشعارات مرفوضة من المتصفح">
        <BellOff className="h-5 w-5" />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={enableNotifications}
      disabled={!ready}
      title="فعّل إشعارات المباريات المباشرة"
      className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 transition-colors hover:bg-white/10 disabled:opacity-60"
    >
      <Bell className="h-5 w-5" />
    </button>
  );
}

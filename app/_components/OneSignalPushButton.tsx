"use client";

import { useEffect, useState } from "react";

declare global {
  interface Window {
    OneSignalDeferred?: Array<(OneSignal: any) => Promise<void> | void>;
    __oneSignalInitialized?: boolean;
  }
}

export default function OneSignalPushButton() {
  const [ready, setReady] = useState(false);
  const [permission, setPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }

    setPermission(Notification.permission);

    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;

    if (!appId) {
      console.error("Missing NEXT_PUBLIC_ONESIGNAL_APP_ID");
      return;
    }

    const existingScript = document.querySelector(
      'script[src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"]'
    );

    if (!existingScript) {
      const script = document.createElement("script");
      script.src =
        "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
      script.defer = true;
      document.head.appendChild(script);
    }

    window.OneSignalDeferred = window.OneSignalDeferred || [];

    if (!window.__oneSignalInitialized) {
      window.__oneSignalInitialized = true;

      window.OneSignalDeferred.push(async function (OneSignal: any) {
        await OneSignal.init({
          appId,
          serviceWorkerPath: "/OneSignalSDKWorker.js",
          serviceWorkerUpdaterPath: "/OneSignalSDKUpdaterWorker.js",
          notifyButton: {
            enable: false,
          },
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

  async function enableNotifications() {
    if (typeof window === "undefined") return;

    if (!("Notification" in window)) {
      alert("المتصفح لا يدعم إشعارات الويب.");
      return;
    }

    try {
      window.OneSignalDeferred = window.OneSignalDeferred || [];

      window.OneSignalDeferred.push(async function (OneSignal: any) {
        await OneSignal.Notifications.requestPermission();

        setPermission(Notification.permission);

        if (Notification.permission === "granted") {
          alert("تم تفعيل إشعارات البطولة بنجاح.");
        } else if (Notification.permission === "denied") {
          alert("تم رفض الإشعارات من إعدادات المتصفح.");
        }
      });
    } catch (error) {
      console.error("OneSignal notification permission error:", error);
      alert("حدث خطأ أثناء تفعيل الإشعارات.");
    }
  }

  if (permission === "unsupported") {
    return null;
  }

  if (permission === "granted") {
    return (
      <button
        type="button"
        disabled
        style={{
          padding: "10px 14px",
          borderRadius: "12px",
          border: "1px solid #16a34a",
          background: "#dcfce7",
          color: "#166534",
          fontWeight: 700,
          cursor: "default",
          fontSize: "14px",
        }}
      >
        الإشعارات مفعلة
      </button>
    );
  }

  if (permission === "denied") {
    return (
      <button
        type="button"
        disabled
        style={{
          padding: "10px 14px",
          borderRadius: "12px",
          border: "1px solid #dc2626",
          background: "#fee2e2",
          color: "#991b1b",
          fontWeight: 700,
          cursor: "default",
          fontSize: "14px",
        }}
      >
        الإشعارات مرفوضة
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={enableNotifications}
      disabled={!ready}
      style={{
        padding: "10px 14px",
        borderRadius: "12px",
        border: "1px solid #2563eb",
        background: "#2563eb",
        color: "white",
        fontWeight: 700,
        cursor: ready ? "pointer" : "not-allowed",
        opacity: ready ? 1 : 0.6,
        fontSize: "14px",
      }}
    >
      تفعيل إشعارات البطولة
    </button>
  );
}
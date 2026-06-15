import { NextResponse } from "next/server";

export const runtime = "nodejs";

type PushBody = {
  title?: string;
  body?: string;
  url?: string;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as PushBody;

    const title = String(payload.title || "").trim();
    const body = String(payload.body || "").trim();
    const url = String(payload.url || "/").trim();

    if (!title || !body) {
      return NextResponse.json(
        { ok: false, error: "مطلوب عنوان الإشعار والتفاصيل." },
        { status: 400 }
      );
    }

    const appId = process.env.ONESIGNAL_APP_ID || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
    const apiKey = process.env.ONESIGNAL_REST_API_KEY || process.env.ONESIGNAL_APP_API_KEY;

    if (!appId || !apiKey) {
      return NextResponse.json(
        {
          ok: false,
          error: "إعدادات OneSignal ناقصة على السيرفر.",
          details: "أضف ONESIGNAL_APP_ID و ONESIGNAL_REST_API_KEY داخل ملف .env.local ثم أعد تشغيل npm run dev.",
        },
        { status: 500 }
      );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
    const finalUrl = url.startsWith("http") ? url : siteUrl ? `${siteUrl.replace(/\/$/, "")}${url.startsWith("/") ? url : `/${url}`}` : undefined;

    const oneSignalResponse = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Key ${apiKey}`,
      },
      body: JSON.stringify({
        app_id: appId,
        target_channel: "push",
        included_segments: ["All Subscribers"],
        headings: { en: title, ar: title },
        contents: { en: body, ar: body },
        ...(finalUrl ? { url: finalUrl } : {}),
      }),
    });

    const data = await oneSignalResponse.json().catch(() => ({}));

    if (!oneSignalResponse.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "OneSignal رفض إرسال الإشعار.",
          status: oneSignalResponse.status,
          details: data,
        },
        { status: oneSignalResponse.status }
      );
    }

    return NextResponse.json({
      ok: true,
      id: data.id || null,
      recipients: typeof data.recipients === "number" ? data.recipients : null,
      raw: data,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "حدث خطأ غير متوقع أثناء إرسال الإشعار.",
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}

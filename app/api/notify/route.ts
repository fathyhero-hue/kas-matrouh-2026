import { NextResponse } from "next/server";

const ONESIGNAL_APP_ID = "d73de8b7-948e-494e-84f2-6c353efee89c";
const ONESIGNAL_REST_API_KEY = "os_v2_app_2466rn4urzeu5bhsnq2t57xittzrpi2w2xxuxqfik22gg4zokckp6qe6cx52zgeybtqmictlblahebxavxv4tr3xuepzjqa4oa35tzi";

export async function POST(req: Request) {
  try {
    const { title, body } = await req.json();

    const res = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // 🔴 التعديل الأول: استخدام Key بدل Basic عشان المفاتيح الجديدة 🔴
        "Authorization": `Key ${ONESIGNAL_REST_API_KEY}`
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        // 🔴 التعديل التاني: تحديث اسم الشريحة للاسم المعتمد 🔴
        included_segments: ["Total Subscriptions"], 
        headings: { en: title, ar: title },
        contents: { en: body, ar: body }
      })
    });

    if (res.ok) {
      return NextResponse.json({ success: true });
    } else {
      const errorData = await res.json();
      console.error("OneSignal Error:", errorData);
      return NextResponse.json({ success: false, error: errorData }, { status: 500 });
    }
  } catch (error) {
    console.error("Fetch Error:", error);
    return NextResponse.json({ success: false, error: "Server Error" }, { status: 500 });
  }
}
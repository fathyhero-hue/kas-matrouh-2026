import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const data = await req.json().catch(() => ({}));
    const { title, body } = data;

    const APP_ID = "d73de8b7-948e-494e-84f2-6c353efee89c"; 
    const REST_API_KEY = "os_v2_app_2466rn4urzeu5bhsnq2t57xittzhvop5bjyemdubmfaamssu2362tmqporlevdmcjrk7thzs7txtxbzqkks5bwgoydxu3n7jdfh3cwq"; 

    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: APP_ID,
        // التعديل هنا: "Subscribed Users" هي الشريحة الأساسية لكل اللي في صورتك
        included_segments: ["Subscribed Users", "Active Users", "All"], 
        headings: { en: title, ar: title },
        contents: { en: body, ar: body },
        // سطر إضافي لضمان الإرسال للمتصفحات والموبايل
        isAnyWeb: true, 
      }),
    });

    const result = await response.json();
    return NextResponse.json({ success: response.ok, result });

  } catch (error) {
    return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 });
  }
}
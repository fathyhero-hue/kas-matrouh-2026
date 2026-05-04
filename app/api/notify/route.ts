import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function POST(req: Request) {
  try {
    const { title, body } = await req.json();

    const APP_ID = "d73de8b7-948e-494e-84f2-6c353efee89c"; 
    const REST_API_KEY = "os_v2_app_2466rn4urzeu5bhsnq2t57xittzhvop5bjyemdubmfaamssu2362tmqporlevdmcjrk7thzs7txtxbzqkks5bwgoydxu3n7jdfh3cwq"; 

    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        // التعديل الجذري هنا: غيرنا Basic لـ Key عشان يقبل المفتاح الجديد
        'Authorization': `Key ${REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: APP_ID,
        target_channel: "push",
        included_segments: ['Total Subscriptions', 'Active Users', 'Subscribed Users'], 
        headings: { en: title, ar: title },
        contents: { en: body, ar: body },
      }),
    });

    if (response.ok) {
      return NextResponse.json({ success: true });
    } else {
      const errorData = await response.json();
      console.error('OneSignal Error Details:', errorData);
      return NextResponse.json({ success: false, error: errorData }, { status: response.status });
    }
  } catch (error) {
    console.error('Server Error:', error);
    return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 });
  }
}
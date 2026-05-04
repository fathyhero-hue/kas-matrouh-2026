import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const data = await req.json().catch(() => ({}));
    const { title, body } = data;

    if (!title || !body) {
      return NextResponse.json({ success: false, error: 'Title and body are required' }, { status: 400 });
    }

    const APP_ID = "d73de8b7-948e-494e-84f2-6c353efee89c"; 
    const REST_API_KEY = "os_v2_app_2466rn4urzeu5bhsnq2t57xittzhvop5bjyemdubmfaamssu2362tmqporlevdmcjrk7thzs7txtxbzqkks5bwgoydxu3n7jdfh3cwq"; 

    // تعديل الـ Fetch ليتجاوز الـ 403 Forbidden
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${REST_API_KEY}`,
        'Content-Type': 'application/json',
        // ضفنا الـ User-Agent ده عشان السيرفر ما يفتكرش إننا "بوت" ويحظرنا
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
      body: JSON.stringify({
        app_id: APP_ID,
        included_segments: ['All', 'Total Subscriptions'], 
        headings: { en: title, ar: title },
        contents: { en: body, ar: body },
        isAnyWeb: true,
        isAndroid: true,
        isIos: true,
      }),
    });

    const result = await response.json();

    if (response.ok) {
      return NextResponse.json({ success: true, result });
    } else {
      console.error('OneSignal Response Error:', result);
      return NextResponse.json({ success: false, error: result }, { status: response.status });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 });
  }
}
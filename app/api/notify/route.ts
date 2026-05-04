import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    // 1. التأكد من استقبال البيانات صح
    const data = await req.json().catch(() => ({}));
    const { title, body } = data;

    if (!title || !body) {
      return NextResponse.json({ success: false, error: 'Missing title or body' }, { status: 400 });
    }

    const APP_ID = "d73de8b7-948e-494e-84f2-6c353efee89c"; 
    const REST_API_KEY = "os_v2_app_2466rn4urzeu5bhsnq2t57xittzhvop5bjyemdubmfaamssu2362tmqporlevdmcjrk7thzs7txtxbzqkks5bwgoydxu3n7jdfh3cwq"; 

    // 2. إرسال الطلب لـ OneSignal
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Basic ${REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: APP_ID,
        included_segments: ['Total Subscriptions', 'All'], 
        headings: { en: title, ar: title },
        contents: { en: body, ar: body },
      }),
    });

    const result = await response.json();

    if (response.ok) {
      return NextResponse.json({ success: true, result });
    } else {
      return NextResponse.json({ success: false, error: result }, { status: response.status });
    }
  } catch (error: any) {
    console.error('API Route Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server Error' }, { status: 500 });
  }
}
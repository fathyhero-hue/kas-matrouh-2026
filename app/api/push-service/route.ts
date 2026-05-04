import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    // قراءة البيانات مع تأمين ضد الأخطاء
    const data = await req.json().catch(() => ({}));
    const { title, body } = data;

    if (!title || !body) {
      return NextResponse.json({ success: false, error: 'بيانات ناقصة' }, { status: 400 });
    }

    const APP_ID = "d73de8b7-948e-494e-84f2-6c353efee89c"; 
    const REST_API_KEY = "os_v2_app_2466rn4urzeu5bhsnq2t57xittzhvop5bjyemdubmfaamssu2362tmqporlevdmcjrk7thzs7txtxbzqkks5bwgoydxu3n7jdfh3cwq"; 

    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${REST_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_id: APP_ID,
        included_segments: ['All', 'Total Subscriptions'], 
        headings: { en: title, ar: title },
        contents: { en: body, ar: body },
      }),
    });

    const result = await response.json();

    return NextResponse.json({ success: response.ok, result });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'حدث خطأ في السيرفر' }, { status: 500 });
  }
}
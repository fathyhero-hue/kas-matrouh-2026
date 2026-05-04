import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { title, body } = await req.json();

    // الـ App ID بتاعك اللي إنت مسجل بيه
    const APP_ID = "d73de8b7-948e-494e-84f2-6c353efee89c"; 
    
    // ⚠️ مهم جداً: حط مفتاح الـ REST API Key بتاعك هنا بين علامتين التنصيص
    const REST_API_KEY = "os_v2_app_2466rn4urzeu5bhsnq2t57xittzhvop5bjyemdubmfaamssu2362tmqporlevdmcjrk7thzs7txtxbzqkks5bwgoydxu3n7jdfh3cwq"; 

    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: APP_ID,
        included_segments: ['Subscribed Users'], // بيبعت لكل الناس اللي فعلت الجرس
        headings: { en: title, ar: title },
        contents: { en: body, ar: body },
      }),
    });

    if (response.ok) {
      return NextResponse.json({ success: true });
    } else {
      const errorData = await response.json();
      console.error('OneSignal Error:', errorData);
      return NextResponse.json({ success: false, error: errorData }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 });
  }
}
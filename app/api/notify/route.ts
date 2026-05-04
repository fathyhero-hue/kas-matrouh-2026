import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { title, body } = await req.json();

    const APP_ID = "d73de8b7-948e-494e-84f2-6c353efee89c"; 
    
    // المفتاح السليم 100% اللي اخدناه كوبي
    const REST_API_KEY = "os_v2_app_2466rn4urzeu5bhsnq2t57xittzhvop5bjyemdubmfaamssu2362tmqporlevdmcjrk7thzs7txtxbzqkks5bwgoydxu3n7jdfh3cwq"; 

    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // رجعناها Basic لأنها الطريقة الوحيدة المعتمدة لـ OneSignal
        'Authorization': `Basic ${REST_API_KEY}`,
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
      
      // سطر كشف الكذب: ده هيرجعلك في الـ Network يقولك السيرفر قرا المفتاح ولا لأ!
      return NextResponse.json({ 
        success: false, 
        error: errorData,
        debug_info: `Server is using key starting with: ${REST_API_KEY.substring(0, 15)}...`
      }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 });
  }
}
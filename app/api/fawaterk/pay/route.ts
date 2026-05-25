import { NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request: Request) {
    try {
        const { userData, amount, tournament } = await request.json();
        
        const url = 'https://app.fawaterk.com/api/v2/create-invoice';
        
        // المفتاح الكامل والصحيح مع حرف الـ 3 في النهاية
        const apiKey = 'c92a568379e61afe7dee0a13bb94b4e8badfa6675f6aca2c63'; 

        const managerFullName = userData.managerName || "مشارك كأس مطروح";
        const nameParts = managerFullName.trim().split(" ");
        const firstName = nameParts[0] || "مشارك";
        const lastName = nameParts.slice(1).join(" ") || "جديد";

        // 🔥 اختبار حاسم: إذا كان السعر المجلوب من الفيربيز به مشكلة، سنضع 500 كقيمة افتراضية صريحة
        const finalAmount = Number(amount) > 0 ? Number(amount) : 500;

        const paymentData = {
            payment_method_id: 1, 
            cartTotal: finalAmount,
            currency: 'EGP',
            customer: {
                first_name: firstName,
                last_name: lastName,
                email: userData.email || "info@matrouhcup.online",
                phone: userData.phone || "01222264993",
            },
            redirectionUrls: {
                successUrl: 'https://matrouhcup.online/?pay_status=success', 
                failUrl: 'https://matrouhcup.online/?pay_status=fail'
            },
            cartItems: [
                {
                    name: `رسوم الاشتراك في ${tournament === "elite_cup" ? "بطولة كأس النخبة" : "كأس مطروح"}`,
                    price: finalAmount,
                    quantity: 1
                }
            ]
        };

        const response = await axios.post(url, paymentData, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.data.status === 'success' && response.data.data?.url) {
            return NextResponse.json({ url: response.data.data.url });
        }
        
        return NextResponse.json({ 
            error: 'fawaterk_rejected', 
            details: response.data.message || 'بيانات غير مطابقة' 
        }, { status: 400 });

    } catch (error: any) {
        // 🔥 إرجاع تفاصيل الخطأ الحقيقية للواجهة لنراها في المتصفح فوراً
        const errorDetails = error.response?.data?.message || error.response?.data || error.message;
        return NextResponse.json({ 
            error: 'server_crash',
            details: errorDetails
        }, { status: 500 });
    }
}
import { NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request: Request) {
    try {
        const { userData, amount, tournament } = await request.json();
        
        const url = 'https://app.fawaterk.com/api/v2/create-invoice';
        
        // 🔐 سحب المفتاح من البيئة المحمية لفيرسيل أو استخدامه مباشرة كبديل آمن
        const apiKey = process.env.FAWATERK_API_KEY || 'c92a568379e61afe7dee0a13bb94b4e8badfa6675f6aca2c6'; 

        // فصل الاسم الأول والأخير لتجنب مشاكل بوابات الدفع العربية
        const managerFullName = userData.managerName || "مشارك كأس مطروح";
        const nameParts = managerFullName.trim().split(" ");
        const firstName = nameParts[0] || "مشارك";
        const lastName = nameParts.slice(1).join(" ") || "جديد";

        const paymentData = {
            payment_method_id: 1, // تفعيل إنستا باي والمحافظ الإلكترونية وكروت ميزة معاً
            cartTotal: Number(amount),
            currency: 'EGP',
            customer: {
                first_name: firstName,
                last_name: lastName,
                email: userData.email || "info@matrouhcup.online",
                phone: userData.phone,
            },
            redirectionUrls: {
                successUrl: 'https://matrouhcup.online/?pay_status=success', 
                failUrl: 'https://matrouhcup.online/?pay_status=fail'
            },
            cartItems: [
                {
                    name: `رسوم الاشتراك في ${tournament === "elite_cup" ? "بطولة كأس النخبة" : "كأس مطروح"}`,
                    price: Number(amount),
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
            error: 'فشل في تهيئة بوابة فواتيرك', 
            details: response.data.message || 'بيانات غير مطابقة' 
        }, { status: 400 });

    } catch (error: any) {
        console.error('Fawaterk Error Details:', error.response?.data || error.message);
        return NextResponse.json({ 
            error: 'خطأ داخلي في سيرفر الدفع',
            message: error.response?.data?.message || error.message 
        }, { status: 500 });
    }
}
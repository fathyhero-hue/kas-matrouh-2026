import { NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request: Request) {
    try {
        const { userData, amount, tournament } = await request.json();
        
        const url = 'https://app.fawaterk.com/api/v2/create-invoice';
        
        // المفتاح الكامل والصحيح الخاص بحسابك
        const apiKey = 'c92a568379e61afe7dee0a13bb94b4e8badfa6675f6aca2c63'; 

        const managerFullName = userData.managerName || "مشارك كأس مطروح";
        const nameParts = managerFullName.trim().split(" ");
        const firstName = nameParts[0] || "مشارك";
        const lastName = nameParts.slice(1).join(" ") || "جديد";

        // ✨ الحل السحري: إذا كانت القيمة المجلوبة 0 أو أقل من 5، نحدد السعر بناءً على نوع البطولة تلقائياً
        let finalAmount = Number(amount);
        if (!finalAmount || finalAmount < 5) {
            // إذا كانت بطولة النخبة السعر 1000، وإذا كانت كأس مطروح السعر 500 (عدل الأرقام كما تحب)
            finalAmount = tournament === "elite_cup" ? 1000 : 500;
        }

        const paymentData = {
            payment_method_id: 1, // تفعيل كل وسائل الدفع (انستا باي والمحافظ)
            cartTotal: finalAmount,
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
        const errorDetails = error.response?.data?.message || error.response?.data || error.message;
        return NextResponse.json({ 
            error: 'server_crash',
            details: errorDetails
        }, { status: 500 });
    }
}
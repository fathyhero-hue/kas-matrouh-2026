import { NextResponse } from 'next/server';
import { db } from "@/lib/firebase"; // تأكد أن مسار الاستدعاء الخاص بـ Firebase صحيح في مشروعك
import { collection, addDoc } from "firebase/firestore";

// دالة استقبال طلبات الـ Webhook من سيرفر فواتيرك
export async function POST(request: Request) {
    try {
        const paymentData = await request.json();

        // التحقق من نجاح عملية الدفع من فواتيرك
        if (paymentData && paymentData.status === 'paid') {
            const invoiceId = paymentData.invoice_id;
            const phone = paymentData.customer?.phone || "0000";
            const amount = paymentData.invoice_value || 0;

            // 🛠️ حفظ الفاتورة وتأكيد الدفع في قاعدة بيانات Firebase تلقائياً
            await addDoc(collection(db, "successful_payments"), {
                invoiceId: invoiceId,
                customerPhone: phone,
                amountPaid: amount,
                paymentDate: new Date().toISOString(),
                status: "verified"
            });

            console.log(`[Fawaterk Webhook] Payment verified for invoice: ${invoiceId}`);
            
            // إرجاع استجابة ناجحة لسيرفر فواتيرك لتأكيد الاستلام
            return NextResponse.json({ received: true }, { status: 200 });
        }

        return NextResponse.json({ error: 'Payment status is not paid' }, { status: 400 });
    } catch (error: any) {
        console.error('[Fawaterk Webhook Error]:', error.message);
        return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
    }
}
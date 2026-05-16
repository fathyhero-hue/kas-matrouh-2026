"use client";
import React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Mail, ArrowLeft } from "lucide-react";

export default function PaymobSuccessPage() {
  const router = useRouter();

  return (
    <div dir="rtl" className="min-h-screen bg-[#0a1428] flex items-center justify-center p-4 font-sans">
      <Card className="w-full max-w-xl bg-[#13213a] border-2 border-emerald-500/50 rounded-[2.5rem] shadow-2xl overflow-hidden">
        <CardHeader className="bg-[#1e2a4a] text-center border-b border-white/5 py-8">
          <CheckCircle2 className="mx-auto h-20 w-20 text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.4)]" />
          <CardTitle className="text-3xl font-black text-white mt-4 tracking-wide">تمت عملية الدفع بنجاح! ✔️</CardTitle>
        </CardHeader>
        <CardContent className="p-6 sm:p-10 text-center space-y-6">
          <div className="bg-[#0a1428] p-5 rounded-2xl border border-white/5 space-y-3">
            <p className="text-xl font-bold text-yellow-400">شكراً لك كابتن، تم تأكيد اشتراك فريقك</p>
            <div className="flex items-center justify-center gap-2 text-cyan-300 font-bold text-sm bg-cyan-500/10 py-2.5 px-4 rounded-xl border border-cyan-500/20">
               <Mail className="h-5 w-5 shrink-0" />
               <span>يتم الآن توليد الرقم السري وإرساله فوراً إلى بريدك الإلكتروني.</span>
            </div>
          </div>
          <p className="text-gray-400 text-xs font-medium leading-relaxed">
             يرجى فحص علبة الوارد (Inbox) أو مجلد الرسائل غير المرغوب فيها (Spam). بمجرد استلام الرقم السري، قم بنسخه وادخل على استمارة المنصة لتسكين قائمة اللاعبين ورفع الأوراق السحابية.
          </p>
          <Button 
            onClick={() => router.push('/')} 
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black py-6 rounded-2xl text-lg shadow-lg flex items-center justify-center gap-2 transition-transform hover:scale-[1.01]"
          >
            <ArrowLeft className="h-5 w-5" /> العودة شاشة المنصة الرئيسية
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
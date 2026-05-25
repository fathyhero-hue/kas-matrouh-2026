"use client";
import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function TournamentLineup({ handleOriginalLineupData, MiniFutCard }: any) {
  // إذا لم تكن البيانات موجودة، نمنع الـ crash
  if (!handleOriginalLineupData) return <div className="text-center text-white">جاري تحميل التشكيل...</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-in fade-in duration-500">
      <div className="lg:col-span-3 rounded-[2rem] border border-emerald-500/30 bg-[#13213a] p-3 sm:p-6 flex flex-col justify-between shadow-2xl relative overflow-hidden">
        {/* ... (بقية تصميم الملعب) ... */}
        
        <div className="relative w-full h-[440px] ...">
           {/* مثال للتصحيح في أول مركز */}
           <div className="flex justify-center relative z-10">
              {(() => {
                 const p = handleOriginalLineupData?.starters?.find((x: any) => x.id === "fwd");
                 return <MiniFutCard player={p ? { name: p.name, team: p.team, imageUrl: p.imageUrl || p.image } : null} position="ST" />;
              })()}
           </div>
           
           {/* كرر نفس هذا النمط ( ?. ) في جميع مواضع الوصول لـ starters أو subs داخل هذا الملف */}
        </div>
      </div>
      
      {/* قسم دكة البدلاء */}
      <div className="space-y-4">
        {/* ... */}
      </div>
    </div>
  );
}
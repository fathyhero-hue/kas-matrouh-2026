"use client";
import React from "react";
import { Shield, Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// 1. كرت اللاعب (MiniFutCard) بنفس التصميم والألوان والأبعاد بالظبط
export const MiniFutCard = ({ player, position }: { player: any; position: string }) => { 
  const circleSize = "w-11 h-11 xs:w-14 xs:h-14 sm:w-18 sm:h-18 md:w-20 md:h-20"; 
  if(!player || !player.name) return (
    <div className="flex flex-col items-center justify-center gap-0.5">
      <div className={`${circleSize} rounded-full bg-[#0a1428]/80 border-2 border-dashed border-emerald-400/30 flex items-center justify-center text-emerald-300/50 text-[10px] sm:text-sm font-black shadow-inner backdrop-blur-xs`}>
        ＋
      </div>
      <span className="text-[7px] xs:text-[9px] font-black text-emerald-400/80 bg-[#0a1428]/60 px-1 py-0.5 rounded-md uppercase tracking-tight">{position}</span>
    </div>
  ); 
  return (
    <div className="flex flex-col items-center justify-center gap-1 transition-transform duration-300 hover:scale-110 cursor-pointer z-10 hover:z-50">
      <div className={`relative ${circleSize} rounded-full border-2 border-yellow-400/90 bg-[#0a1428] shadow-[0_4px_10px_rgba(250,204,21,0.35)] overflow-hidden flex items-center justify-center`}>
        {player.imageUrl ? (
          <img src={player.imageUrl} className="w-full h-full object-cover" alt={player.name} loading="lazy" />
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-[#101b32] to-[#050a14] flex items-center justify-center font-black text-yellow-400 text-[10px] xs:text-xs">
            {player.fallback || player.name?.substring(0,2)}
          </div>
        )}
        <span className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/90 to-transparent text-yellow-300 text-[6px] xs:text-[8px] font-black text-center pb-0.5 pt-2 uppercase leading-none scale-95">
          {position}
        </span>
      </div>
      <div className="flex flex-col items-center justify-center w-16 xs:w-20 sm:w-24">
        <span className="text-[8px] xs:text-[10px] sm:text-xs font-black text-white w-full text-center truncate leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]" title={player.name}>
          {player.name}
        </span>
        <span className="text-yellow-400/80 text-[6px] xs:text-[8px] font-bold w-full text-center truncate tracking-tight mt-0.5" title={player.team}>
          {player.team}
        </span>
      </div>
    </div>
  ); 
};

interface FieldFormationProps {
  lineupData: any;
  titleBadge: string;
}

// 2. المكون الرئيسي للملعب الأخضر والدكة (FieldFormation)
export const FieldFormation = ({ lineupData, titleBadge }: FieldFormationProps) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-in fade-in duration-500">
      <div className="lg:col-span-3 rounded-[2rem] border border-emerald-500/30 bg-[#13213a] p-3 sm:p-6 flex flex-col justify-between shadow-2xl relative overflow-hidden">
        <div className="text-center mb-3 relative z-20">
           <Badge className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-4 sm:px-6 py-1.5 sm:py-2 font-black text-xs sm:text-base shadow-lg border border-emerald-400/20">
              {titleBadge}
           </Badge>
        </div>
        
        <div className="relative w-full h-[440px] xs:h-[500px] sm:h-[620px] md:h-[680px] lg:h-[720px] max-w-3xl mx-auto bg-gradient-to-b from-emerald-800 via-emerald-900 to-green-950 border-4 border-white/10 rounded-[1.5rem] sm:rounded-[2rem] p-2 sm:p-4 flex flex-col justify-between shadow-inner">
           <div className="absolute inset-0 border-2 border-white/5 m-2 sm:m-4 rounded-[1.2rem] sm:rounded-[1.5rem] pointer-events-none flex items-center justify-center">
              <div className="w-full h-[2px] bg-white/5 absolute top-1/2 left-0"></div>
              <div className="w-20 h-20 sm:w-28 sm:h-28 border-2 border-white/5 rounded-full absolute"></div>
              <div className="w-32 h-16 sm:w-48 sm:h-24 border-2 border-white/5 border-t-none rounded-b-xl absolute bottom-0"></div>
              <div className="w-32 h-16 sm:w-48 sm:h-24 border-2 border-white/5 border-b-none rounded-t-xl absolute top-0"></div>
           </div>

           {/* مهاجم */}
           <div className="flex justify-center relative z-10">
              {(() => {
                 const p = lineupData.starters.find((x: any) => x.id === "fwd");
                 return <MiniFutCard player={{ name: p?.name, team: p?.team, imageUrl: p?.imageUrl || (p as any).image }} position="ST" />;
              })()}
           </div>

           {/* أجنحة وسط */}
           <div className="flex justify-around gap-1 sm:gap-2 relative z-10">
              {(() => {
                 const pLeft = lineupData.starters.find((x: any) => x.id === "mid3");
                 return <MiniFutCard player={{ name: pLeft?.name, team: pLeft?.team, imageUrl: pLeft?.imageUrl || (pLeft as any).image }} position="LM" />;
              })()}
              {(() => {
                 const pRight = lineupData.starters.find((x: any) => x.id === "mid2");
                 return <MiniFutCard player={{ name: pRight?.name, team: pRight?.team, imageUrl: pRight?.imageUrl || (pRight as any).image }} position="RM" />;
              })()}
           </div>

           {/* وسط مدافع */}
           <div className="flex justify-center relative z-10">
              {(() => {
                 const p = lineupData.starters.find((x: any) => x.id === "mid1");
                 return <MiniFutCard player={{ name: p?.name, team: p?.team, imageUrl: p?.imageUrl || (p as any).image }} position="CM" />;
              })()}
           </div>

           {/* قلب دفاع */}
           <div className="flex justify-center gap-6 sm:gap-24 relative z-10">
              {(() => {
                 const pLeft = lineupData.starters.find((x: any) => x.id === "def1");
                 return <MiniFutCard player={{ name: pLeft?.name, team: pLeft?.team, imageUrl: pLeft?.imageUrl || (pLeft as any).image }} position="CB" />;
              })()}
              {(() => {
                 const pRight = lineupData.starters.find((x: any) => x.id === "def2");
                 return <MiniFutCard player={{ name: pRight?.name, team: pRight?.team, imageUrl: pRight?.imageUrl || (pRight as any).image }} position="CB" />;
              })()}
           </div>

           {/* حارس مرمى */}
           <div className="flex justify-center relative z-10">
              {(() => {
                 const p = lineupData.starters.find((x: any) => x.id === "gk");
                 return <MiniFutCard player={{ name: p?.name, team: p?.team, imageUrl: p?.imageUrl || (p as any).image }} position="GK" />;
              })()}
           </div>
        </div>
      </div>

      {/* لوحة المدير الفني والاحتياط الجانبية */}
      <div className="space-y-4 flex flex-col justify-start">
        <Card className="bg-[#1e2a4a] border border-yellow-400/30 p-4 rounded-2xl shadow-xl">
           <h3 className="text-yellow-400 font-black text-sm mb-3 flex items-center gap-1">👔 المدير الفني للتشكيل</h3>
           <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl bg-[#0a1428] border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                 {lineupData.manager?.imageUrl || (lineupData.manager as any).image ? (
                   <img src={lineupData.manager?.imageUrl || (lineupData.manager as any).image} className="w-full h-full object-cover" alt="المدير الفني" />
                 ) : <span className="text-2xl">👤</span>}
              </div>
              <div className="min-w-0">
                 <h4 className="font-black text-white text-base leading-tight truncate">{lineupData.manager?.name}</h4>
                 <span className="text-gray-400 text-xs font-bold truncate block mt-1">{lineupData.manager?.team}</span>
              </div>
           </div>
        </Card>

        <Card className="bg-[#1e2a4a] border border-white/5 p-4 rounded-2xl shadow-xl flex-1">
           <h3 className="text-cyan-400 font-black text-sm mb-4 flex items-center gap-1">👥 دكة النجوم الاحتياط ({lineupData.subs?.length || 0})</h3>
           <div className="space-y-2.5">
              {lineupData.subs?.map((sub: any, idx: number) => (
                 <div key={idx} className="flex justify-between items-center bg-[#0a1428] p-2.5 border border-white/5 rounded-xl transition-all hover:bg-white/5">
                    <div className="flex items-center gap-3 min-w-0">
                       <div className="w-9 h-9 rounded-full bg-yellow-400/10 border border-yellow-400/30 flex items-center justify-center text-xs text-yellow-400 font-black shrink-0 shadow-inner">
                          {sub.fallback || sub.name?.substring(0, 2)}
                       </div>
                       <div className="min-w-0">
                          <span className="font-bold text-white text-sm block leading-tight truncate">{sub.name}</span>
                          <span className="text-gray-400 text-[11px] font-bold truncate block mt-0.5">{sub.team}</span>
                       </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] text-cyan-400 bg-cyan-500/5 border-cyan-500/20 shrink-0 font-bold">{sub.role || "بديل"}</Badge>
                 </div>
              ))}
           </div>
        </Card>
      </div>
    </div>
  );
};
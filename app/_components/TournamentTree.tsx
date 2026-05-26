"use client";
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Shield } from "lucide-react";
import { getWinnerData } from "./helpers"; // استيراد الدالة اللي عملناها في أول ملف

// المكون الفرعي لعلبة المباراة جوه الشجرة بنفس الألوان والأنيميشن بالظبط
export const TreeMatchBox = ({ label, t1, t2, data }: { label: string, t1: string, t2: string, data: any }) => { 
  const win = data?.win;
  const match = data?.match;
  const isLive = match && match.isLive; 
  
  const renderMatchScore = (m: any) => { 
    const isMPlayed = m && m.status === "انتهت"; 
    const isMLive = m && m.isLive; 
    const hasGoals = m && m.homeGoals !== undefined && m.awayGoals !== undefined && m.homeGoals !== "" && m.awayGoals !== ""; 
    if (!isMPlayed && !isMLive && !hasGoals) return 'VS'; 
    const hPen = (m.penaltiesHome || []).filter((p:any)=>p==='scored').length; 
    const aPen = (m.penaltiesAway || []).filter((p:any)=>p==='scored').length; 
    const hasPenalties = hPen > 0 || aPen > 0 || m.status === "ضربات جزاء"; 
    return (
      <div className="flex flex-col items-center" dir="ltr">
        <span className="text-xl sm:text-3xl font-black text-white">{m.awayGoals || 0} - {m.homeGoals || 0}</span>
        {hasPenalties && <span className="text-[10px] sm:text-xs text-yellow-400 mt-1 font-bold bg-[#0a1428] px-2 py-0.5 rounded-full border border-yellow-400/30">({aPen} - {hPen} ر.ت)</span>}
      </div>
    ); 
  };

  return (
    <div className={`bg-[#1e2a4a] rounded-2xl flex flex-col items-center justify-center p-4 border ${isLive ? 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse' : 'border-yellow-400/30'} shadow-lg relative min-h-[95px] transition-transform hover:scale-105 shrink-0`}>
      <Badge className="absolute -top-3 bg-yellow-400 text-black text-[11px] px-3 font-black border-2 border-[#0a1428] shadow-md">{label}</Badge>
      <div className="w-full flex justify-between items-center gap-2 mt-2">
        <div className={`flex-1 text-center font-bold text-[11px] sm:text-sm leading-tight ${win === t1 ? 'text-yellow-300 scale-105' : 'text-white'}`}>{t1}</div>
        <div className="bg-[#0a1428] border border-cyan-500/40 px-2 py-1 rounded-md text-cyan-400 shrink-0">{renderMatchScore(match)}</div>
        <div className={`flex-1 text-center font-bold text-[11px] sm:text-sm leading-tight ${win === t2 ? 'text-yellow-300 scale-105' : 'text-white'}`}>{t2}</div>
      </div>
      {win && <div className="mt-3 text-[11px] bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 px-4 py-1 rounded-full font-bold shadow-inner">صعد: {win}</div>}
    </div>
  ); 
};

interface TournamentTreeProps {
  activeTournament: 'youth' | 'juniors';
  youthTree: any;
  juniorsTree: any;
}

// المكون الرئيسي لعرض الشجرة بالكامل
export const TournamentTree = ({ activeTournament, youthTree, juniorsTree }: TournamentTreeProps) => {
  return (
    <div className="space-y-12 animate-in fade-in duration-500 overflow-x-auto pb-6 w-full custom-scrollbar">
      {activeTournament === 'youth' ? (
        <div className="min-w-[1200px] p-4 space-y-12">
           <div className="text-center mb-4"><Badge className="bg-cyan-500 text-white px-6 py-2 font-black text-lg">شجرة الأدوار الإقصائية لبطولة الشباب 🏆</Badge></div>
           
           <div className="bg-[#13213a] border border-cyan-500/20 p-6 rounded-3xl">
             <h3 className="text-yellow-400 font-black text-base mb-4 text-center">أدوار الملحق التمهيدي (النسخة الثالثة)</h3>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <TreeMatchBox label="م 97" t1="اسماك باسط العوامي" t2="اصدقاء عز بوالمجدوبة" data={youthTree.p97} />
                <TreeMatchBox label="م 98" t1="السلوم" t2="اصدقاء عيسي المغواري" data={youthTree.p98} />
                <TreeMatchBox label="م 100" t1="اصدقاء قسم الله" t2="اصدقاء سلامة بدر" data={youthTree.p100} />
                <TreeMatchBox label="م 101" t1="ايس كريم الملكة" t2="غوط رباح" data={youthTree.p101} />
             </div>
           </div>

           <div className="flex justify-between gap-4 items-start pt-6">
              <div className="flex flex-col gap-6 w-1/4">
                 <div className="text-center text-cyan-300 font-bold text-xs border-b border-white/5 pb-2">دور الستة عشر</div>
                 <TreeMatchBox label="م 1" t1={youthTree.getT(1)} t2="الفائز م 104" data={youthTree.r1} />
                 <TreeMatchBox label="م 2" t1={youthTree.getT(8)} t2={youthTree.p97.win || "الفائز م 97"} data={youthTree.r2} />
                 <TreeMatchBox label="م 3" t1="غوط رباح" t2="القدس" data={youthTree.r3} />
                 <TreeMatchBox label="م 4" t1={youthTree.getT(5)} t2={youthTree.p100.win || "الفائز م 100"} data={youthTree.r4} />
              </div>
              <div className="flex flex-col gap-24 w-1/4 pt-16">
                 <div className="text-center text-cyan-300 font-bold text-xs border-b border-white/5 pb-2">دور الثمانية</div>
                 <TreeMatchBox label="مربع 1" t1="الفائز م 1" t2="الفائز م 2" data={youthTree.q1} />
                 <TreeMatchBox label="مربع 2" t1="الفائز م 3" t2="الفائز م 4" data={youthTree.q2} />
              </div>
              <div className="flex flex-col gap-40 w-1/4 pt-32">
                 <div className="text-center text-cyan-300 font-bold text-xs border-b border-white/5 pb-2">نصف النهائي والنهائي الكبير</div>
                 <TreeMatchBox label="نصف 1" t1="الفائز مربع 1" t2="الفائز مربع 2" data={youthTree.s1} />
                 <div className="mt-12"><TreeMatchBox label="النهائي الكبير 👑" t1="الطرف الأول" t2="الطرف الثاني" data={youthTree.f1} /></div>
              </div>
           </div>
        </div>
      ) : (
        <div className="min-w-[1000px] p-4">
           <div className="text-center mb-6"><Badge className="bg-cyan-500 text-white px-6 py-2 font-black text-lg">شجرة الأدوار الإقصائية لبطولة الناشئين 🏅</Badge></div>
           <div className="flex justify-between gap-6 items-start pt-4">
              <div className="flex flex-col gap-6 w-1/3">
                 <div className="text-center text-cyan-300 font-bold text-xs border-b border-white/5 pb-2">دور الثمانية (ربع النهائي)</div>
                 <TreeMatchBox label="مربع 1" t1={juniorsTree.ja1} t2={juniorsTree.jb4} data={juniorsTree.q1} />
                 <TreeMatchBox label="مربع 2" t1={juniorsTree.jb2} t2={juniorsTree.ja3} data={juniorsTree.q2} />
                 <TreeMatchBox label="مربع 3" t1={juniorsTree.jb1} t2={juniorsTree.ja4} data={juniorsTree.q3} />
                 <TreeMatchBox label="مربع 4" t1={juniorsTree.ja2} t2={juniorsTree.jb3} data={juniorsTree.q4} />
              </div>
              <div className="flex flex-col gap-28 w-1/3 pt-14">
                 <div className="text-center text-cyan-300 font-bold text-xs border-b border-white/5 pb-2">نصف النهائي</div>
                 <TreeMatchBox label="نصف 1" t1="الفائز مربع 1" t2="الفائز مربع 2" data={juniorsTree.s1} />
                 <TreeMatchBox label="نصف 2" t1="الفائز مربع 3" t2="الفائز مربع 4" data={juniorsTree.s2} />
              </div>
              <div className="flex flex-col gap-6 w-1/3 pt-36">
                 <div className="text-center text-yellow-400 font-black text-xs border-b border-white/5 pb-2">المباراة النهائية للناشئين</div>
                 <TreeMatchBox label="النهائي الكبير 👑" t1="الطرف الأول" t2="الطرف الثاني" data={juniorsTree.f1} />
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
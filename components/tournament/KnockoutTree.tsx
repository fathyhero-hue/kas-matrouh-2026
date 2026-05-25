"use client";
import React from "react";
import { Badge } from "@/components/ui/badge";

export default function KnockoutTree({ activeTournament, youthTree, juniorsTree, TreeMatchBox }: any) {
  // إضافة تحقق أمان لمنع الخطأ عند تحميل الصفحة لأول مرة
  if (!youthTree || !juniorsTree) {
    return <div className="text-center p-10 text-white font-bold">جاري تحميل شجرة البطولة...</div>;
  }

  return (
    <div className="space-y-12 animate-in fade-in duration-500 overflow-x-auto pb-6 w-full custom-scrollbar">
      {activeTournament === 'youth' ? (
        <div className="min-w-[1200px] p-4 space-y-12">
           <div className="text-center mb-4"><Badge className="bg-cyan-500 text-white px-6 py-2 font-black text-lg">شجرة الأدوار الإقصائية لبطولة الشباب 🏆</Badge></div>
           
           <div className="bg-[#13213a] border border-cyan-500/20 p-6 rounded-3xl">
             <h3 className="text-yellow-400 font-black text-base mb-4 text-center">أدوار الملحق التمهيدي</h3>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <TreeMatchBox label="م 97" t1="اسماك باسط العوامي" t2="اصدقاء عز بوالمجدوبة" data={youthTree?.p97} />
                <TreeMatchBox label="م 98" t1="السلوم" t2="اصدقاء عيسي المغواري" data={youthTree?.p98} />
                <TreeMatchBox label="م 100" t1="اصدقاء قسم الله" t2="اصدقاء سلامة بدر" data={youthTree?.p100} />
                <TreeMatchBox label="م 101" t1="ايس كريم الملكة" t2="غوط رباح" data={youthTree?.p101} />
             </div>
           </div>

           <div className="flex justify-between gap-4 items-start pt-6">
              <div className="flex flex-col gap-6 w-1/4">
                 <div className="text-center text-cyan-300 font-bold text-xs border-b border-white/5 pb-2">دور الستة عشر</div>
                 <TreeMatchBox label="م 1" t1={youthTree?.getT?.(1)} t2="الفائز م 104" data={youthTree?.r1} />
                 <TreeMatchBox label="م 2" t1={youthTree?.getT?.(8)} t2={youthTree?.p97?.win || "—"} data={youthTree?.r2} />
                 <TreeMatchBox label="م 3" t1="غوط رباح" t2="القدس" data={youthTree?.r3} />
                 <TreeMatchBox label="م 4" t1={youthTree?.getT?.(5)} t2={youthTree?.p100?.win || "—"} data={youthTree?.r4} />
              </div>
              <div className="flex flex-col gap-24 w-1/4 pt-16">
                 <div className="text-center text-cyan-300 font-bold text-xs border-b border-white/5 pb-2">دور الثمانية</div>
                 <TreeMatchBox label="مربع 1" t1="الفائز م 1" t2="الفائز م 2" data={youthTree?.q1} />
                 <TreeMatchBox label="مربع 2" t1="الفائز م 3" t2="الفائز م 4" data={youthTree?.q2} />
              </div>
              <div className="flex flex-col gap-40 w-1/4 pt-32">
                 <div className="text-center text-cyan-300 font-bold text-xs border-b border-white/5 pb-2">نصف النهائي والنهائي</div>
                 <TreeMatchBox label="نصف 1" t1="الفائز مربع 1" t2="الفائز مربع 2" data={youthTree?.s1} />
                 <div className="mt-12"><TreeMatchBox label="النهائي الكبير 👑" t1="الطرف الأول" t2="الطرف الثاني" data={youthTree?.f1} /></div>
              </div>
           </div>
        </div>
      ) : (
        <div className="min-w-[1000px] p-4">
           <div className="text-center mb-6"><Badge className="bg-cyan-500 text-white px-6 py-2 font-black text-lg">شجرة الأدوار الإقصائية للناشئين 🏅</Badge></div>
           <div className="flex justify-between gap-6 items-start pt-4">
              <div className="flex flex-col gap-6 w-1/3">
                 <div className="text-center text-cyan-300 font-bold text-xs border-b border-white/5 pb-2">دور الثمانية</div>
                 <TreeMatchBox label="مربع 1" t1={juniorsTree?.ja1} t2={juniorsTree?.jb4} data={juniorsTree?.q1} />
                 <TreeMatchBox label="مربع 2" t1={juniorsTree?.jb2} t2={juniorsTree?.ja3} data={juniorsTree?.q2} />
                 <TreeMatchBox label="مربع 3" t1={juniorsTree?.jb1} t2={juniorsTree?.ja4} data={juniorsTree?.q3} />
                 <TreeMatchBox label="مربع 4" t1={juniorsTree?.ja2} t2={juniorsTree?.jb3} data={juniorsTree?.q4} />
              </div>
              <div className="flex flex-col gap-28 w-1/3 pt-14">
                 <div className="text-center text-cyan-300 font-bold text-xs border-b border-white/5 pb-2">نصف النهائي</div>
                 <TreeMatchBox label="نصف 1" t1="الفائز مربع 1" t2="الفائز مربع 2" data={juniorsTree?.s1} />
                 <TreeMatchBox label="نصف 2" t1="الفائز مربع 3" t2="الفائز مربع 4" data={juniorsTree?.s2} />
              </div>
              <div className="flex flex-col gap-6 w-1/3 pt-36">
                 <div className="text-center text-yellow-400 font-black text-xs border-b border-white/5 pb-2">المباراة النهائية</div>
                 <TreeMatchBox label="النهائي الكبير 👑" t1="الطرف الأول" t2="الطرف الثاني" data={juniorsTree?.f1} />
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
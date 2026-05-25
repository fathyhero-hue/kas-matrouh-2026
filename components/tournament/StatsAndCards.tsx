"use client";
import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";

interface StatsAndCardsProps {
  activeTab: string;
  searchScorers: string;
  setSearchScorers: (val: string) => void;
  filteredScorers: any[];
  showArchivedCards: boolean;
  setShowArchivedCards: (val: boolean) => void;
  searchCards: string;
  setSearchCards: (val: string) => void;
  filteredCardsList: any[];
}

export default function StatsAndCards({
  activeTab,
  searchScorers,
  setSearchScorers,
  filteredScorers,
  showArchivedCards,
  setShowArchivedCards,
  searchCards,
  setSearchCards,
  filteredCardsList,
}: StatsAndCardsProps) {
  
  // تبويب الهدافين
  if (activeTab === "scorers") {
    return (
      <Card className="rounded-3xl border border-yellow-400/30 bg-[#13213a] p-4 sm:p-6 animate-in fade-in duration-500">
        <CardHeader className="flex flex-col sm:flex-row justify-between items-center gap-4 pb-4 border-b border-white/10 mb-4">
          <div>
            <CardTitle className="text-yellow-300 font-black">قائمة هدافي البطولة الرسمية</CardTitle>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute right-3 top-3 h-4 w-4 text-cyan-300" />
            <Input 
              value={searchScorers} 
              onChange={e => setSearchScorers(e.target.value)} 
              placeholder="بحث عن لاعب..." 
              className="pr-10 bg-[#1e2a4a] border-yellow-400/50 text-white rounded-xl" 
            />
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredScorers.map((s, i) => (
            <div key={i} className="bg-[#1e2a4a] p-4 rounded-2xl border border-white/5 flex items-center justify-between shadow-md">
              <div className="flex items-center gap-3">
                <Badge className={i === 0 ? "bg-yellow-400 text-black" : i === 1 ? "bg-gray-300 text-black shadow-md" : "bg-gray-800"}>
                  {i + 1}
                </Badge>
                <div>
                  <h4 className="font-black text-white text-base leading-tight">{s.player}</h4>
                  <span className="text-gray-400 text-xs font-bold mt-1 inline-block">{s.team}</span>
                </div>
              </div>
              <Badge className="bg-cyan-500/20 text-cyan-400 text-lg font-black border border-cyan-500/30 px-3.5 py-1" dir="ltr">
                {s.goals} ⚽
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  // تبويب العقوبات والكروت
  if (activeTab === "cards") {
    return (
      <Card className="rounded-3xl border border-red-500/30 bg-[#13213a] p-4 sm:p-6 animate-in fade-in duration-500">
        <CardHeader className="flex flex-col sm:flex-row justify-between items-center gap-4 pb-4 border-b border-white/10 mb-4">
          <div className="flex items-center gap-3">
            <CardTitle className="text-red-400 font-black">سجل العقوبات والكروت</CardTitle>
            <div className="flex gap-1 border border-white/10 rounded-xl p-1 bg-[#0a1428]">
              <button 
                onClick={() => setShowArchivedCards(false)} 
                className={`text-xs px-3 py-1 rounded-lg font-bold ${!showArchivedCards ? 'bg-red-500 text-white' : 'text-gray-400'}`}
              >
                الحالية
              </button>
              <button 
                onClick={() => setShowArchivedCards(true)} 
                className={`text-xs px-3 py-1 rounded-lg font-bold ${showArchivedCards ? 'bg-red-500 text-white' : 'text-gray-400'}`}
              >
                الأرشيف
              </button>
            </div>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute right-3 top-3 h-4 w-4 text-cyan-300" />
            <Input 
              value={searchCards} 
              onChange={e => setSearchCards(e.target.value)} 
              placeholder="بحث باسم اللاعب..." 
              className="pr-10 bg-[#1e2a4a] border-red-500/40 text-white" 
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto w-full custom-scrollbar">
            <table className="w-full text-right text-white">
              <thead className="bg-[#0a1428]">
                <tr>
                  <th className="p-4 text-cyan-300">اللاعب</th>
                  <th className="p-4 text-cyan-300">الفريق</th>
                  <th className="p-4 text-center text-cyan-300">البطاقات</th>
                  <th className="p-4 text-center text-cyan-300">الوضعية للمباراة القادمة</th>
                </tr>
              </thead>
              <tbody>
                {filteredCardsList.map((c, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-4 font-bold text-white text-base">{c.player}</td>
                    <td className="p-4 text-sm text-gray-300">{c.team}</td>
                    <td className="p-4 text-center flex justify-center gap-4 font-black text-sm">
                      <span className="bg-yellow-400/10 text-yellow-400 border border-yellow-400/30 px-2.5 py-0.5 rounded-md">🟨 {c.yellow}</span>
                      <span className="bg-red-500/10 text-red-500 border border-red-500/30 px-2.5 py-0.5 rounded-md">🟥 {c.red}</span>
                    </td>
                    <td className="p-4 text-center">
                      <Badge className={c.status === "طرد" || c.status === "إيقاف" ? "bg-red-500/20 text-red-400 border border-red-500/50" : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50"}>
                        {c.status === "طرد" ? "🔴 موقف للطرد" : c.status === "إيقاف" ? "❌ موقف للتراكم" : "✔️ متاح للمشاركة"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}
"use client";
import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, Minimize, Maximize } from "lucide-react";

interface TournamentStandingsProps {
  activeTournament: 'youth' | 'juniors';
  standingsYouth: any[];
  standingsJunA: any[];
  standingsJunB: any[];
  STANDINGS_HEADERS: string[];
  zoneColor: (rank: number, tourneyType: string) => string;
  isTableExpanded: boolean;
  setIsTableExpanded: (expanded: boolean) => void;
}

export const TournamentStandings = ({
  activeTournament,
  standingsYouth,
  standingsJunA,
  standingsJunB,
  STANDINGS_HEADERS,
  zoneColor,
  isTableExpanded,
  setIsTableExpanded
}: TournamentStandingsProps) => {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {activeTournament === 'juniors' ? (
        // 🏅 جداول مجموعات الناشئين (أ و ب)
        <div className="grid md:grid-cols-2 gap-8">
          {[
            { title: "المجموعة الأولى (أ) - ناشئين", data: standingsJunA },
            { title: "المجموعة الثانية (ب) - ناشئين", data: standingsJunB }
          ].map((group) => (
            <Card key={group.title} className="rounded-3xl border border-cyan-500/30 bg-[#13213a] shadow-xl overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between border-b border-cyan-500/20 pb-4">
                <CardTitle className="text-cyan-300 flex items-center gap-3">
                  <Trophy className="h-6 w-6" /> {group.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-auto w-full touch-pan-x" dir="rtl">
                  <table className="w-full text-white text-right min-w-[500px]">
                    <thead className="bg-[#13213a] border-b border-cyan-500/30">
                      <tr>
                        {STANDINGS_HEADERS.map((h) => (
                          <th key={h} className="px-3 py-3 font-bold text-cyan-300 text-xs whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {group.data.map((row) => (
                        <tr key={row.team} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="px-3 py-3"><Badge className={zoneColor(row.rank, activeTournament)}>{row.rank}</Badge></td>
                          <td className="px-3 py-3 font-bold text-white whitespace-nowrap text-sm">{row.team}</td>
                          <td className="px-3 py-3 text-center">{row.played}</td>
                          <td className="px-3 py-3 text-center text-yellow-300 font-black">{row.wins}</td>
                          <td className="px-3 py-3 text-center">{row.draws}</td>
                          <td className="px-3 py-3 text-center">{row.losses}</td>
                          <td className="px-3 py-3 text-center text-cyan-400">{row.gf}</td>
                          <td className="px-3 py-3 text-center text-white">{row.ga}</td>
                          <td className="px-3 py-3 text-center text-cyan-300">{row.gd}</td>
                          <td className="px-3 py-3 font-black text-yellow-300 text-center">{row.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        // 🏆 جدول الترتيب العام للشباب
        <Card className="rounded-3xl border border-yellow-400/30 bg-[#13213a] shadow-xl overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b border-yellow-400/20 pb-4">
            <CardTitle className="text-yellow-300 flex items-center gap-3">
              <Trophy className="h-7 w-7" /> جدول الترتيب العام للشباب
            </CardTitle>
            <Button size="sm" onClick={() => setIsTableExpanded(!isTableExpanded)} className="bg-yellow-400 text-black hover:bg-yellow-500 font-bold flex items-center gap-2">
              {isTableExpanded ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />} 
              {isTableExpanded ? "تصغير الشاشة" : "عرض الشاشة بالعرض"}
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto w-full max-h-[60vh] touch-pan-x relative" dir="rtl">
              <table className="w-full text-white text-right min-w-[800px]">
                <thead className="sticky top-0 bg-[#13213a] border-b border-yellow-400/30 z-20 shadow-md">
                  <tr>
                    {STANDINGS_HEADERS.map((h) => (
                      <th key={h} className="px-4 py-4 font-bold text-cyan-300 text-sm whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {standingsYouth.map((row) => (
                    <tr key={row.team} className="border-b border-yellow-400/10 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-4"><Badge className={zoneColor(row.rank, activeTournament)}>{row.rank}</Badge></td>
                      <td className="px-4 py-4 font-bold text-white whitespace-nowrap">{row.team}</td>
                      <td className="px-4 py-4 text-center">{row.played}</td>
                      <td className="px-4 py-4 text-center text-yellow-300 font-black">{row.wins}</td>
                      <td className="px-4 py-4 text-center">{row.draws}</td>
                      <td className="px-4 py-4 text-center">{row.losses}</td>
                      <td className="px-4 py-4 text-center text-cyan-400">{row.gf}</td>
                      <td className="px-4 py-4 text-center text-white">{row.ga}</td>
                      <td className="px-4 py-4 text-center text-cyan-300">{row.gd}</td>
                      <td className="px-4 py-4 font-black text-yellow-300 text-center text-lg">{row.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
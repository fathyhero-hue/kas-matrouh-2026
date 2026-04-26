"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Calendar, Clock, AlertTriangle, Trophy } from "lucide-react";
import { TEAM_NAMES, INITIAL_MATCHES } from "@/data/tournament";
import { collection, onSnapshot, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";

function formatTime12(time24: string): string {
  if (!time24) return "—";
  const [hours, minutes] = time24.split(":").map(Number);
  const period = hours >= 12 ? "م" : "ص";
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, "0")} ${period}`;
}

const STANDINGS_HEADERS = ["#", "الفريق", "لعب", "ف", "ت", "خ", "له", "عليه", "فارق", "نقاط"];

type GoalEvent = { id: string; player?: string; team?: string; goals: number };
type CardEvent = { id: string; player?: string; team?: string; yellow: number; red: number };

type StandingRow = {
  team: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  rank: number;
};

function normalizeTeamName(name: string): string {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/أ|إ|آ/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ـ/g, "")
    .replace(/ّ/g, "")
    .toLowerCase();
}

function getOriginalTeamName(norm: string): string {
  const found = TEAM_NAMES.find(t => normalizeTeamName(t) === norm);
  return found || norm;
}

function buildStandings(matchRows: any[], allTeams: string[]) {
  const table = new Map<string, StandingRow>();

  allTeams.forEach(team => {
    const norm = normalizeTeamName(team);
    if (!table.has(norm)) {
      table.set(norm, { team, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: 0, points: 0, rank: 0 });
    }
  });

  matchRows.forEach(match => {
    const hg = Number(match.homeGoals) ?? 0;
    const ag = Number(match.awayGoals) ?? 0;
    const homeNorm = normalizeTeamName(match.home || match.teamA || "");
    const awayNorm = normalizeTeamName(match.away || match.teamB || "");

    const homeOriginal = getOriginalTeamName(homeNorm);
    const awayOriginal = getOriginalTeamName(awayNorm);

    let home = table.get(homeNorm) || { team: homeOriginal, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: 0, points: 0, rank: 0 };
    let away = table.get(awayNorm) || { team: awayOriginal, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: 0, points: 0, rank: 0 };

    home.played++; away.played++;
    home.gf += hg; home.ga += ag;
    away.gf += ag; away.ga += hg;

    if (hg > ag) { home.wins++; home.points += 3; away.losses++; }
    else if (hg < ag) { away.wins++; away.points += 3; home.losses++; }
    else { home.draws++; away.draws++; home.points++; away.points++; }

    table.set(homeNorm, home);
    table.set(awayNorm, away);
  });

  return Array.from(table.values())
    .map(row => ({ ...row, gd: row.gf - row.ga }))
    .sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.team.localeCompare(b.team, "ar"))
    .map((row, i) => ({ ...row, rank: i + 1 }));
}

function zoneColor(rank: number) {
  if (rank <= 8) return "bg-emerald-500 text-white";
  if (rank <= 24) return "bg-sky-400 text-white";
  return "bg-rose-500 text-white";
}

function sortMatches(arr: any[]) {
  return [...arr].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return (b.time || "00:00").localeCompare(a.time || "00:00");
  });
}

export default function Page() {
  const [matches, setMatches] = useState<any[]>(INITIAL_MATCHES);
  const [goalEvents, setGoalEvents] = useState<GoalEvent[]>([]);
  const [cardEvents, setCardEvents] = useState<CardEvent[]>([]);
  const [tickerText, setTickerText] = useState("مطروح الرياضية...");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"today" | "tomorrow" | "all" | "standings" | "scorers" | "cards" | "suspended">("standings");

  useEffect(() => {
    const unsubMatches = onSnapshot(collection(db, "matches"), (snap) => {
      const data = snap.docs.map((doc) => ({
        id: doc.id,
        home: doc.data().teamA || doc.data().home || "",
        away: doc.data().teamB || doc.data().away || "",
        homeGoals: Number(doc.data().homeGoals) || 0,
        awayGoals: Number(doc.data().awayGoals) || 0,
        round: doc.data().round || 1,
        date: doc.data().date || "",
        time: doc.data().time || "15:30",
        dayName: doc.data().dayName || "",
      }));
      setMatches(data.length > 0 ? data : INITIAL_MATCHES);
      setLoading(false);
    });

    const unsubGoals = onSnapshot(collection(db, "goals"), (snap) => {
      setGoalEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as GoalEvent)));
    });

    const unsubCards = onSnapshot(collection(db, "cards"), (snap) => {
      setCardEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as CardEvent)));
    });

    const unsubTicker = onSnapshot(doc(db, "settings", "ticker"), (docSnap) => {
      if (docSnap.exists()) setTickerText(docSnap.data().text?.trim() || "مطروح الرياضية...");
    });

    return () => { unsubMatches(); unsubGoals(); unsubCards(); unsubTicker(); };
  }, []);

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
  const tomorrowStr = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });

  const todayMatches = sortMatches(matches.filter(m => 
    m.date === todayStr && Number(m.homeGoals) === 0 && Number(m.awayGoals) === 0
  ));

  const tomorrowMatches = sortMatches(matches.filter(m => 
    m.date === tomorrowStr && Number(m.homeGoals) === 0 && Number(m.awayGoals) === 0
  ));

  const finishedMatches = sortMatches(matches.filter(m => 
    m.date !== todayStr && m.date !== tomorrowStr
  ));

  const standings = useMemo(() => buildStandings(finishedMatches, TEAM_NAMES), [finishedMatches]);

  const scorers = useMemo(() => {
    const map = new Map<string, { player: string; team: string; goals: number }>();
    goalEvents.forEach(e => {
      const player = String(e.player || "").trim();
      const team = String(e.team || "").trim();
      if (!player) return;
      const key = `${player}__${normalizeTeamName(team)}`;
      if (!map.has(key)) map.set(key, { player, team, goals: 0 });
      map.get(key)!.goals += Number(e.goals) || 1;
    });
    return Array.from(map.values()).sort((a, b) => b.goals - a.goals);
  }, [goalEvents]);

  const cardsList = useMemo(() => {
    const map = new Map<string, any>();
    cardEvents.forEach(e => {
      const player = String(e.player || "").trim();
      const team = String(e.team || "").trim();
      if (!player) return;
      const key = `${player}__${normalizeTeamName(team)}`;
      if (!map.has(key)) map.set(key, { player, team, yellow: 0, red: 0 });
      const item = map.get(key)!;
      item.yellow += Number(e.yellow) || 0;
      item.red += Number(e.red) || 0;
    });
    return Array.from(map.values())
      .map(row => ({
        ...row,
        status: row.red > 0 ? "موقوف - طرد" : row.yellow >= 3 ? "موقوف - 3 إنذارات" : "متاح",
        reason: row.red > 0 ? "طرد" : row.yellow >= 3 ? "3 إنذارات" : "—",
      }))
      .sort((a, b) => b.red - a.red || b.yellow - a.yellow);
  }, [cardEvents]);

  const suspended = cardsList.filter(item => item.status !== "متاح");

  if (loading) {
    return <div className="min-h-screen bg-[#0a1428] flex items-center justify-center"><Loader2 className="h-16 w-16 animate-spin text-yellow-400" /></div>;
  }

  return (
    <div dir="rtl" className="min-h-screen bg-[#0a1428] text-white">
      <div className="mx-auto max-w-7xl p-3 sm:p-4 md:p-6 lg:p-8">

        {/* شريط الأخبار */}
        <div className="mb-6 rounded-3xl border border-yellow-400/50 bg-[#13213a] p-4">
          <div className="flex items-center gap-4">
            <span className="shrink-0 rounded-2xl bg-yellow-400 px-5 py-2 text-sm font-black text-black">آخر تحديث</span>
            <div className="flex-1 overflow-hidden">
              <div className="animate-marquee whitespace-nowrap text-base sm:text-lg font-bold text-yellow-300">
                {tickerText}
              </div>
            </div>
          </div>
        </div>

        {/* الهيدر مع الشعار */}
        <div className="mb-8 sm:mb-10 rounded-3xl border border-yellow-400/40 bg-gradient-to-br from-[#1e2a4a] to-[#13213a] p-6 sm:p-8 shadow-2xl text-center">
          <div className="flex justify-center mb-6">
            <img 
              src="/logo.png" 
              alt="شعار بطولة كأس مطروح" 
              className="h-28 sm:h-36 w-auto drop-shadow-2xl" 
            />
          </div>
          <h1 className="text-4xl sm:text-6xl font-black text-yellow-300 tracking-tight">بطولة كأس مطروح</h1>
          <p className="mt-3 text-2xl sm:text-3xl text-cyan-300">النسخة الثالثة ٢٠٢٦</p>
        </div>

        {/* التبويبات */}
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-8">
          {[
            { key: "today", label: "اليوم", icon: "📅" },
            { key: "tomorrow", label: "غداً", icon: "📆" },
            { key: "all", label: "النتائج", icon: "⚽" },
            { key: "standings", label: "الترتيب", icon: "📊" },
            { key: "scorers", label: "الهدافين", icon: "🥇" },
            { key: "cards", label: "الكروت", icon: "🟨" },
            { key: "suspended", label: "الموقوفين", icon: "🚫" },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex-1 sm:flex-none px-5 py-3.5 rounded-2xl font-bold text-sm sm:text-base transition-all border border-yellow-400/30 ${
                activeTab === tab.key 
                  ? "bg-yellow-400 text-black shadow-lg" 
                  : "bg-[#1e2a4a] text-white hover:bg-[#25345a] hover:text-yellow-300"
              }`}
            >
              <span className="text-lg">{tab.icon}</span> <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* اليوم */}
        {activeTab === "today" && (
          <Card className="rounded-3xl border border-yellow-400/30 bg-[#13213a]">
            <CardHeader className="text-center border-b border-yellow-400/30">
              <Badge className="bg-yellow-400 text-black text-lg px-6 py-2.5">اليوم • {todayStr}</Badge>
              <CardTitle className="text-3xl sm:text-4xl font-black text-yellow-300 mt-4">مباريات اليوم</CardTitle>
            </CardHeader>
            <CardContent className="p-6 grid gap-6">
              {todayMatches.length > 0 ? todayMatches.map(match => (
                <div key={match.id} className="rounded-3xl border border-yellow-400/30 bg-[#1e2a4a] p-6 hover:border-yellow-400 transition-all">
                  <div className="text-center mb-6">
                    <div className="text-cyan-300">{match.dayName} • {match.date}</div>
                    <div className="flex items-center justify-center gap-2 text-yellow-300 mt-2">
                      <Clock className="h-5 w-5" />
                      <span className="text-2xl font-bold">{formatTime12(match.time)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-6 text-2xl">
                    <div className="font-bold text-white">{match.home || match.teamA}</div>
                    <div className="text-5xl font-black text-yellow-400">VS</div>
                    <div className="font-bold text-white">{match.away || match.teamB}</div>
                  </div>
                </div>
              )) : <p className="text-center py-20 text-xl text-cyan-300">لا توجد مباريات اليوم</p>}
            </CardContent>
          </Card>
        )}

        {/* غداً */}
        {activeTab === "tomorrow" && (
          <Card className="rounded-3xl border border-yellow-400/30 bg-[#13213a]">
            <CardHeader>
              <CardTitle className="text-yellow-300 flex items-center gap-3">
                <Calendar className="h-8 w-8" /> مباريات غداً • {tomorrowStr}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {tomorrowMatches.map(match => (
                <div key={match.id} className="rounded-3xl border border-yellow-400/30 bg-[#1e2a4a] p-6 text-center hover:border-yellow-400 transition-all">
                  <div className="text-cyan-300 mb-4">{formatTime12(match.time)}</div>
                  <div className="font-bold text-2xl text-white mb-4">{match.home || match.teamA}</div>
                  <div className="text-5xl font-black text-yellow-400 mb-4">VS</div>
                  <div className="font-bold text-2xl text-white">{match.away || match.teamB}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* النتائج */}
        {activeTab === "all" && (
          <Card className="rounded-3xl border border-yellow-400/30 bg-[#13213a]">
            <CardHeader className="flex flex-col sm:flex-row justify-between gap-4">
              <CardTitle className="text-yellow-300">نتائج المباريات السابقة</CardTitle>
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث عن فريق..." className="max-w-sm bg-[#1e2a4a] border-yellow-400 text-white" />
            </CardHeader>
            <CardContent className="p-6 grid gap-6 md:grid-cols-2">
              {finishedMatches
                .filter(m => !search || 
                  (m.home || m.teamA)?.toLowerCase().includes(search.toLowerCase()) || 
                  (m.away || m.teamB)?.toLowerCase().includes(search.toLowerCase()))
                .map(match => (
                  <Card key={match.id} className="bg-[#1e2a4a] border-yellow-400/30">
                    <CardContent className="p-6">
                      <div className="flex justify-between text-cyan-300 mb-4 text-sm">
                        <span>الجولة {match.round}</span>
                        <span>{match.date}</span>
                      </div>
                      <div className="grid grid-cols-3 items-center text-center">
                        <div className="font-bold text-white text-lg">{match.home || match.teamA}</div>
                        <div className="text-3xl font-black text-yellow-400">{match.homeGoals} - {match.awayGoals}</div>
                        <div className="font-bold text-white text-lg">{match.away || match.teamB}</div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </CardContent>
          </Card>
        )}

        {/* جدول الترتيب */}
        {activeTab === "standings" && (
          <Card className="rounded-3xl border border-yellow-400/30 bg-[#13213a]">
            <CardHeader>
              <CardTitle className="text-yellow-300 flex items-center gap-3">
                <Trophy className="h-7 w-7" /> جدول الترتيب ({standings.length} فريق)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-320px)]">
                <table className="w-full text-white">
                  <thead className="sticky top-0 bg-[#13213a] border-b border-yellow-400/30">
                    <tr>
                      {STANDINGS_HEADERS.map(h => (
                        <th key={h} className="px-4 py-4 text-right font-bold text-cyan-300">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map(row => (
                      <tr key={row.team} className="border-b border-yellow-400/10 hover:bg-white/5">
                        <td className="px-4 py-4"><Badge className={zoneColor(row.rank)}>{row.rank}</Badge></td>
                        <td className="px-4 py-4 font-bold text-white">{row.team}</td>
                        <td className="px-4 py-4 text-center text-white">{row.played}</td>
                        <td className="px-4 py-4 text-center text-yellow-300">{row.wins}</td>
                        <td className="px-4 py-4 text-center text-white">{row.draws}</td>
                        <td className="px-4 py-4 text-center text-white">{row.losses}</td>
                        <td className="px-4 py-4 text-center text-cyan-300">{row.gf}</td>
                        <td className="px-4 py-4 text-center text-cyan-300">{row.ga}</td>
                        <td className="px-4 py-4 text-center text-cyan-300">{row.gd > 0 ? `+${row.gd}` : row.gd}</td>
                        <td className="px-4 py-4 font-black text-yellow-300 text-center text-lg">{row.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* الهدافين */}
        {activeTab === "scorers" && (
          <Card className="rounded-3xl border border-yellow-400/30 bg-[#13213a]">
            <CardHeader><CardTitle className="text-yellow-300">ترتيب الهدافين</CardTitle></CardHeader>
            <CardContent className="p-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {scorers.map((player, i) => (
                <Card key={i} className="bg-[#1e2a4a] border-yellow-400/30">
                  <CardContent className="p-6 flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-xl text-white">{player.player}</h3>
                      <p className="text-cyan-300">{player.team}</p>
                    </div>
                    <Badge className="bg-yellow-400 text-black text-3xl px-6 py-3">{player.goals}</Badge>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        )}

        {/* الكروت */}
        {activeTab === "cards" && (
          <Card className="rounded-3xl border border-yellow-400/30 bg-[#13213a]">
            <CardHeader><CardTitle className="text-yellow-300">الإنذارات والكروت</CardTitle></CardHeader>
            <CardContent className="p-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {cardsList.map((item, i) => (
                <Card key={i} className="bg-[#1e2a4a] border-yellow-400/30">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-xl text-white">{item.player}</h3>
                        <p className="text-cyan-300">{item.team}</p>
                      </div>
                      <Badge className={item.status === "متاح" ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"}>
                        {item.status}
                      </Badge>
                    </div>
                    <div className="mt-4 flex gap-4">
                      <Badge className="bg-yellow-400/20 text-yellow-300 px-4 py-2">🟨 {item.yellow}</Badge>
                      <Badge className="bg-red-500/20 text-red-300 px-4 py-2">🟥 {item.red}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        )}

        {/* الموقوفين */}
        {activeTab === "suspended" && (
          <Card className="rounded-3xl border border-yellow-400/30 bg-[#13213a]">
            <CardHeader><CardTitle className="text-yellow-300">الموقوفين</CardTitle></CardHeader>
            <CardContent className="p-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {suspended.map((item, i) => (
                <Card key={i} className="bg-[#1e2a4a] border-rose-400/30">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 text-rose-400 mb-3">
                      <AlertTriangle className="h-5 w-5" />
                      <span className="font-bold">موقوف</span>
                    </div>
                    <h3 className="font-bold text-xl text-white">{item.player}</h3>
                    <p className="text-cyan-300">{item.team}</p>
                    <p className="mt-4 text-rose-300">السبب: {item.reason}</p>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Calendar, Clock, Trophy, Target, Shield, ShieldAlert, Zap, BellRing } from "lucide-react";
import { TEAM_NAMES, INITIAL_MATCHES } from "@/data/tournament";
import { collection, onSnapshot, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

function formatTime12(time24: string): string {
  if (!time24) return "—";
  const [hours, minutes] = time24.split(":").map(Number);
  const period = hours >= 12 ? "م" : "ص";
  return `${hours % 12 || 12}:${minutes.toString().padStart(2, "0")} ${period}`;
}

const STANDINGS_HEADERS = ["#", "الفريق", "لعب", "ف", "ت", "خ", "له", "عليه", "فارق", "نقاط"];

const cleanTeamString = (name: any) => String(name || "").replace(/النجيلّة/g, "النجيلة").replace(/علّوش/g, "علوش").trim();
const CLEANED_TEAM_NAMES = Array.from(new Set(TEAM_NAMES.map(t => cleanTeamString(t))));

type StandingRow = { team: string; played: number; wins: number; draws: number; losses: number; gf: number; ga: number; gd: number; points: number; rank: number; };

function normalizeTeamName(name: string): string { return String(name || "").trim().replace(/\s+/g, " ").replace(/أ|إ|آ/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/ـ/g, "").replace(/ّ/g, "").toLowerCase(); }
function getOriginalTeamName(norm: string): string { return CLEANED_TEAM_NAMES.find(t => normalizeTeamName(t) === norm) || norm; }

function buildStandings(matchRows: any[], allTeams: string[]) {
  const table = new Map<string, StandingRow>();
  allTeams.forEach(team => table.set(normalizeTeamName(team), { team, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: 0, points: 0, rank: 0 }));
  matchRows.forEach(match => {
    const hg = Number(match.homeGoals) ?? 0; const ag = Number(match.awayGoals) ?? 0;
    const hNorm = normalizeTeamName(match.home || match.teamA || ""); const aNorm = normalizeTeamName(match.away || match.teamB || "");
    let home = table.get(hNorm) || { team: getOriginalTeamName(hNorm), played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: 0, points: 0, rank: 0 };
    let away = table.get(aNorm) || { team: getOriginalTeamName(aNorm), played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: 0, points: 0, rank: 0 };
    home.played++; away.played++; home.gf += hg; home.ga += ag; away.gf += ag; away.ga += hg;
    if (hg > ag) { home.wins++; home.points += 3; away.losses++; } else if (hg < ag) { away.wins++; away.points += 3; home.losses++; } else { home.draws++; away.draws++; home.points++; away.points++; }
    table.set(hNorm, home); table.set(aNorm, away);
  });
  return Array.from(table.values()).map(row => ({ ...row, gd: row.gf - row.ga })).sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.team.localeCompare(b.team, "ar")).map((row, i) => ({ ...row, rank: i + 1 }));
}
function zoneColor(rank: number) { return rank <= 8 ? "bg-emerald-500 text-white" : rank <= 24 ? "bg-sky-400 text-white" : "bg-rose-500 text-white"; }
function sortMatches(arr: any[]) { return [...arr].sort((a, b) => { if (a.date !== b.date) return b.date.localeCompare(a.date); return (b.time || "00:00").localeCompare(a.time || "00:00"); }); }

export default function Page() {
  const [matches, setMatches] = useState<any[]>(INITIAL_MATCHES.map((m: any) => ({
    ...m,
    home: cleanTeamString(m.home || m.teamA),
    away: cleanTeamString(m.away || m.teamB),
    teamA: cleanTeamString(m.teamA || m.home),
    teamB: cleanTeamString(m.teamB || m.away)
  })));
  const [goalEvents, setGoalEvents] = useState<any[]>([]);
  const [cardEvents, setCardEvents] = useState<any[]>([]);
  const [tickerText, setTickerText] = useState("مطروح الرياضية...");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"live" | "today" | "tomorrow" | "all" | "standings" | "scorers" | "stats" | "cards">("standings");
  
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") setIsSubscribed(true);
    }

    const unsubMatches = onSnapshot(collection(db, "matches"), (snap) => {
      setMatches(snap.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id, 
          home: cleanTeamString(d.teamA || d.home), 
          away: cleanTeamString(d.teamB || d.away),
          teamA: cleanTeamString(d.teamA || d.home), 
          teamB: cleanTeamString(d.teamB || d.away),
          homeGoals: Number(d.homeGoals) || 0, awayGoals: Number(d.awayGoals) || 0,
          round: d.round || 1, date: d.date || "", time: d.time || "15:30", dayName: d.dayName || "",
          status: d.status || "", liveMinute: d.liveMinute || 0, isLive: d.isLive || false,
          redCardsHome: d.redCardsHome || 0, redCardsAway: d.redCardsAway || 0,
          penaltiesHome: d.penaltiesHome || [], penaltiesAway: d.penaltiesAway || []
        };
      }));
      setLoading(false);
    }, () => setLoading(false));

    const unsubGoals = onSnapshot(collection(db, "goals"), (snap) => setGoalEvents(snap.docs.map(d => ({ id: d.id, ...d.data(), team: cleanTeamString(d.data().team) }))));
    const unsubCards = onSnapshot(collection(db, "cards"), (snap) => setCardEvents(snap.docs.map(d => ({ id: d.id, ...d.data(), team: cleanTeamString(d.data().team) }))));
    const unsubTicker = onSnapshot(doc(db, "settings", "ticker"), (docSnap) => setTickerText(docSnap.data()?.text?.trim() || "مطروح الرياضية..."));

    return () => { unsubMatches(); unsubGoals(); unsubCards(); unsubTicker(); };
  }, []);

  const handleSubscribe = async () => {
    if (!("Notification" in window)) {
      alert("متصفحك لا يدعم الإشعارات.");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        const { getMessaging, getToken, isSupported } = await import("firebase/messaging");
        const supported = await isSupported();
        if (!supported) {
          alert("متصفحك الحالي لا يدعم الإشعارات.");
          return;
        }
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        const messaging = getMessaging(db.app);
        const vapidKey = "BIaf6ABhsIzwUuJmFudhT6rMpY0LjumPTlYoGxEbmAW9HfkQXvWJSrbeW0zu6OIgVSG_ggxcj5lN5xngnZ36Eso";
        const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
        if (token) {
          await setDoc(doc(db, "subscribers", token), { token, dateAdded: new Date().toISOString() });
          setIsSubscribed(true);
          alert("✅ تم تفعيل الإشعارات بنجاح!");
        }
      }
    } catch (error: any) {
      alert("حدث خطأ: " + (error.message || "تأكد من الاتصال بالإنترنت."));
    }
  };

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
  const tomorrowStr = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });

  const liveMatches = sortMatches(matches.filter(m => m.isLive === true));
  const todayMatches = sortMatches(matches.filter(m => m.date === todayStr && !m.isLive && Number(m.homeGoals) === 0 && Number(m.awayGoals) === 0));
  const tomorrowMatches = sortMatches(matches.filter(m => m.date === tomorrowStr && Number(m.homeGoals) === 0 && Number(m.awayGoals) === 0));
  const finishedMatches = sortMatches(matches.filter(m => !m.isLive && (m.status === "انتهت" || (m.date !== todayStr && m.date !== tomorrowStr))));

  const standings = useMemo(() => buildStandings(finishedMatches, CLEANED_TEAM_NAMES), [finishedMatches]);
  
  const scorers = useMemo(() => {
    const map = new Map<string, any>();
    goalEvents.forEach(e => { 
      const key = `${e.player}__${normalizeTeamName(e.team)}`; 
      if (!map.has(key)) map.set(key, { player: e.player, team: e.team, goals: 0, imageUrl: e.imageUrl || "" }); 
      map.get(key)!.goals += Number(e.goals) || 1; 
    });
    return Array.from(map.values()).sort((a, b) => b.goals - a.goals);
  }, [goalEvents]);

  const statsData = useMemo(() => {
    const totalMatches = finishedMatches.length;
    let totalGoals = 0;
    finishedMatches.forEach(m => totalGoals += (m.homeGoals + m.awayGoals));
    const totalYellow = cardEvents.reduce((acc, curr) => acc + (Number(curr.yellow) || 0), 0);
    const totalRed = cardEvents.reduce((acc, curr) => acc + (Number(curr.red) || 0), 0);
    const sortedByAttack = [...standings].sort((a, b) => b.gf - a.gf);
    const sortedByDef = [...standings].sort((a, b) => a.ga - b.ga);
    return {
      totalMatches, totalGoals, totalYellow, totalRed,
      bestAttack: sortedByAttack[0], worstAttack: sortedByAttack[sortedByAttack.length - 1],
      bestDefense: sortedByDef[0], worstDefense: sortedByDef[sortedByDef.length - 1],
      topScorer: scorers[0], goalsPerMatch: totalMatches > 0 ? (totalGoals / totalMatches).toFixed(2) : "0"
    };
  }, [finishedMatches, standings, cardEvents, scorers]);

  const cardsList = useMemo(() => {
    const map = new Map<string, any>();
    cardEvents.forEach(e => { 
        const key = `${e.player}__${normalizeTeamName(e.team)}`; 
        if (!map.has(key)) map.set(key, { player: e.player, team: e.team, yellow: 0, red: 0 }); 
        const item = map.get(key)!; item.yellow += Number(e.yellow) || 0; item.red += Number(e.red) || 0; 
    });
    return Array.from(map.values()).map(row => ({ 
        ...row, 
        status: row.red > 0 ? "طرد" : row.yellow >= 3 ? "إيقاف" : "متاح" 
    })).sort((a, b) => b.red - a.red || b.yellow - a.yellow);
  }, [cardEvents]);

  if (loading) return <div className="min-h-screen bg-[#0a1428] flex items-center justify-center"><Loader2 className="h-16 w-16 animate-spin text-yellow-400" /></div>;

  return (
    <div dir="rtl" className="min-h-screen bg-[#0a1428] text-white relative pb-20">
      <div className="mx-auto max-w-7xl p-3 sm:p-4 md:p-6 lg:p-8">

        <div className="mb-6 rounded-3xl border border-yellow-400/50 bg-[#13213a] p-4 flex items-center gap-4">
          <span className="shrink-0 rounded-2xl bg-yellow-400 px-5 py-2 text-sm font-black text-black">آخر تحديث</span>
          <div className="flex-1 overflow-hidden"><div className="animate-marquee whitespace-nowrap text-lg font-bold text-yellow-300">{tickerText}</div></div>
        </div>

        <div className="mb-8 sm:mb-10 rounded-3xl border border-yellow-400/40 bg-gradient-to-br from-[#1e2a4a] to-[#13213a] p-6 sm:p-8 shadow-2xl text-center">
          <div className="flex justify-center mb-6"><img src="/logo.png" alt="شعار البطولة" className="h-28 sm:h-36 w-auto drop-shadow-2xl" /></div>
          <h1 className="text-4xl sm:text-6xl font-black text-yellow-300 tracking-tight">بطولة كأس مطروح</h1>
          <p className="mt-3 text-2xl sm:text-3xl text-cyan-300">النسخة الثالثة ٢٠٢٦</p>
        </div>

        <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-8">
          {[
            { key: "live", label: "مباشر", icon: "🔴" }, 
            { key: "stats", label: "إحصائيات", icon: "📊" },
            { key: "today", label: "اليوم", icon: "📅" }, 
            { key: "tomorrow", label: "غداً", icon: "📆" },
            { key: "all", label: "النتائج", icon: "⚽" }, 
            { key: "standings", label: "الترتيب", icon: "📊" }, 
            { key: "scorers", label: "الهدافين", icon: "🥇" },
            { key: "cards", label: "الكروت", icon: "🟨" },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as any)} className={`flex-1 sm:flex-none px-5 py-3.5 rounded-2xl font-bold text-sm sm:text-base transition-all border border-yellow-400/30 ${activeTab === tab.key ? "bg-yellow-400 text-black shadow-lg scale-105" : "bg-[#1e2a4a] text-white hover:bg-[#25345a] hover:text-yellow-300"}`}>
              <span className={`text-lg`}>{tab.icon}</span> <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {activeTab === "stats" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { label: "الأهداف", val: statsData.totalGoals, icon: "⚽", color: "text-yellow-400", sub: `${statsData.goalsPerMatch} / مباراة` },
                { label: "المباريات", val: statsData.totalMatches, icon: "🏟️", color: "text-cyan-400", sub: "إجمالي اللعب" },
                { label: "إنذار أصفر", val: statsData.totalYellow, icon: "🟨", color: "text-yellow-500", sub: "إجمالي الكروت" },
                { label: "حالة طرد", val: statsData.totalRed, icon: "🟥", color: "text-red-500", sub: "إجمالي الطرد" },
              ].map((s, i) => (
                <Card key={i} className="bg-[#13213a] border-white/5 text-center p-4">
                  <div className={`text-4xl font-black ${s.color}`}>{s.val}</div>
                  <div className="text-xs text-gray-400 font-bold mt-2">{s.label}</div>
                  <Badge className="mt-2 bg-black/40 text-gray-300">{s.sub}</Badge>
                </Card>
              ))}
            </div>
          </div>
        )}

        {activeTab === "live" && (
          <Card className="rounded-3xl border-2 border-red-500 bg-[#13213a] p-6">
            <h2 className="text-center text-red-500 font-black text-2xl mb-6">🔴 المباريات الجارية الآن</h2>
            {liveMatches.length > 0 ? liveMatches.map(m => (
              <div key={m.id} className="bg-[#1e2a4a] p-8 rounded-3xl mb-4 border border-white/10 text-center">
                <div className="text-sm bg-red-600 px-4 py-1 inline-block rounded-full mb-4 animate-pulse">الدقيقة {m.liveMinute}' - {m.status}</div>
                <div className="flex justify-between items-center gap-4">
                  <div className="text-2xl font-bold flex-1">{m.home}</div>
                  <div className="text-6xl font-black text-yellow-400">{m.homeGoals} : {m.awayGoals}</div>
                  <div className="text-2xl font-bold flex-1">{m.away}</div>
                </div>
              </div>
            )) : <p className="text-center text-gray-500 py-10 text-xl font-bold">لا توجد مباريات جارية حالياً</p>}
          </Card>
        )}

        {activeTab === "standings" && (
          <Card className="rounded-3xl border border-yellow-400/30 bg-[#13213a] overflow-hidden">
            <ScrollArea className="h-[600px]">
              <table className="w-full text-right">
                <thead className="bg-[#13213a] sticky top-0 border-b border-yellow-400/30">
                  <tr>{STANDINGS_HEADERS.map(h => <th key={h} className="p-4 text-cyan-300 text-sm">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {standings.map(row => (
                    <tr key={row.team} className="border-b border-white/5 hover:bg-white/5">
                      <td className="p-4"><Badge className={zoneColor(row.rank)}>{row.rank}</Badge></td>
                      <td className="p-4 font-bold">{row.team}</td>
                      <td className="p-4">{row.played}</td>
                      <td className="p-4 text-yellow-400 font-bold">{row.wins}</td>
                      <td className="p-4">{row.draws}</td>
                      <td className="p-4">{row.losses}</td>
                      <td className="p-4 text-emerald-400">{row.gf}</td>
                      <td className="p-4 text-rose-400">{row.ga}</td>
                      <td className="p-4 text-cyan-400">{row.gd}</td>
                      <td className="p-4 font-black text-xl text-yellow-300">{row.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </Card>
        )}

        {activeTab === "cards" && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {cardsList.filter(c => c.yellow > 0 || c.red > 0).map((item, i) => (
              <Card key={i} className="bg-[#1e2a4a] border-yellow-400/30 rounded-3xl hover:border-yellow-400 transition-all">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-xl text-white">{item.player}</h3>
                      <p className="text-cyan-300">{item.team}</p>
                    </div>
                    <Badge className={`${item.status === 'متاح' ? 'bg-emerald-500' : item.status === 'إيقاف' ? 'bg-amber-500' : 'bg-rose-500'} text-white font-bold text-sm px-3`}>
                      {item.status}
                    </Badge>
                  </div>
                  <div className="mt-4 flex gap-4">
                    <Badge className="bg-yellow-400/20 text-yellow-300 px-4 py-2 font-bold text-lg">🟨 {item.yellow}</Badge>
                    <Badge className="bg-red-500/20 text-red-300 px-4 py-2 font-bold text-lg">🟥 {item.red}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* أضف باقي التبويبات هنا بنفس النمط (today, tomorrow, all, scorers) */}
        
      </div>

      {/* شريط الرعاة والشركاء المعتمدين الـ 15 */}
      <div className="bg-[#0a1428] py-8 mt-12 border-y border-yellow-400/20 overflow-hidden relative shadow-[0_0_30px_rgba(250,204,21,0.05)]">
        <div className="flex animate-marquee whitespace-nowrap items-center gap-12">
          {[1, 2, 3].map((i) => (
            <React.Fragment key={i}>
              <span className="text-yellow-400/50 font-bold tracking-widest text-[12px] px-4 border-l border-white/10 uppercase">شركاء النجاح</span>
              {[
                { name: "الفهد للديكور", src: "/alfahd.png" },
                { name: "مكتب احمد عبدالعاطي المحامي", src: "/abdelaty.png" },
                { name: "دثار للزي العربي", src: "/dithar.png" },
                { name: "معصرة الزيتون فرجينيا", src: "/virginia.png" },
                { name: "دبي للزي العربي", src: "/dubai.png" },
                { name: "معرض الأمانة للديكور", src: "/alamana.png" },
                { name: "تراث البادية للزي العربي", src: "/torath.png" },
                { name: "عبدالمقصود ستورز", src: "/abdelmaksoud.png" },
                { name: "مياة حياة", src: "/hayah.png" },
                { name: "القدس للأثاث الراقي", src: "/alquds.png" },
                { name: "أيس كريم الملكة", src: "/almaleka.png" },
                { name: "جزارة عبدالله الجراري", src: "/aljarari.png" },
                { name: "M MART", src: "/mmart.png" },
                { name: "هيرو سبورت للملابس الرياضية", src: "/hero-sport.png" },
                { name: "الفتح للفراشة الحديثة", src: "/alfath.png" }
              ].map((sponsor, idx) => (
                <img 
                  key={idx}
                  src={sponsor.src} 
                  alt={sponsor.name} 
                  title={sponsor.name}
                  className="h-16 w-32 object-contain filter grayscale hover:grayscale-0 transition-all duration-300 cursor-pointer" 
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>

      {!isSubscribed && (
        <button onClick={handleSubscribe} className="fixed bottom-6 right-6 z-50 bg-yellow-400 text-black px-5 py-3 rounded-full font-black shadow-lg hover:scale-105 transition-transform flex items-center gap-2 border-2 border-black animate-bounce">
          <BellRing className="h-6 w-6" /> <span className="hidden sm:inline">تفعيل الإشعارات</span>
        </button>
      )}
    </div>
  );
}
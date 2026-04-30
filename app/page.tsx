"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Loader2, Calendar, Clock, Trophy, Target, Shield, 
  ShieldAlert, Zap, BellRing, Play, Star, Search, Gift, Video, Maximize, Minimize 
} from "lucide-react";
import { TEAM_NAMES } from "@/data/tournament";
import { collection, onSnapshot, doc, setDoc, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// 🔴 فرق مجموعات الناشئين
const JUNIORS_GROUP_A = ["سيف الوادي", "ميلانو", "النجيلة", "كابتن تيكا", "اصدقاء عز بوالمجدوبة"];
const JUNIORS_GROUP_B = ["الاولمبي", "ابناء اكرامي", "غوط رباح", "اصدقاء مهدي", "وادي الرمل"];

function formatTime12(time24: string): string {
  if (!time24) return "—";
  const [hours, minutes] = time24.split(":").map(Number);
  const period = hours >= 12 ? "م" : "ص";
  return `${hours % 12 || 12}:${minutes.toString().padStart(2, "0")} ${period}`;
}

function getArabicDay(dateString: string): string {
  if (!dateString) return "";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "";
  const days = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  return days[d.getDay()];
}

const getYoutubeId = (url: string) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url?.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

const STANDINGS_HEADERS = ["#", "الفريق", "لعب", "ف", "ت", "خ", "له", "عليه", "فارق", "نقاط"];
const cleanTeamString = (name: any) => String(name || "").replace(/النجيلّة/g, "النجيلة").replace(/علّوش/g, "علوش").trim();
const CLEANED_TEAM_NAMES = Array.from(new Set(TEAM_NAMES.map(t => cleanTeamString(t))));
type StandingRow = { team: string; played: number; wins: number; draws: number; losses: number; gf: number; ga: number; gd: number; points: number; rank: number; };
function normalizeTeamName(name: string): string { return String(name || "").trim().replace(/\s+/g, " ").replace(/أ|إ|آ/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/ـ/g, "").replace(/ّ/g, "").toLowerCase(); }
function getOriginalTeamName(norm: string): string { 
  const allTeams = [...CLEANED_TEAM_NAMES, ...JUNIORS_GROUP_A, ...JUNIORS_GROUP_B];
  return allTeams.find(t => normalizeTeamName(t) === norm) || norm; 
}

function buildStandings(matchRows: any[], allTeams: string[]) {
  const table = new Map<string, StandingRow>();
  allTeams.forEach(team => table.set(normalizeTeamName(team), { team, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: 0, points: 0, rank: 0 }));
  
  matchRows.forEach(match => {
    const hg = Number(match.homeGoals) ?? 0; const ag = Number(match.awayGoals) ?? 0;
    const hNorm = normalizeTeamName(match.home || match.teamA || ""); const aNorm = normalizeTeamName(match.away || match.teamB || "");
    
    let home = table.get(hNorm); let away = table.get(aNorm);
    
    if (home) {
      home.played++; home.gf += hg; home.ga += ag;
      if (hg > ag) { home.wins++; home.points += 3; } else if (hg === ag) { home.draws++; home.points++; } else { home.losses++; }
    }
    if (away) {
      away.played++; away.gf += ag; away.ga += hg;
      if (ag > hg) { away.wins++; away.points += 3; } else if (ag === hg) { away.draws++; away.points++; } else { away.losses++; }
    }
  });

  const penalizedTeam = table.get(normalizeTeamName("17 فبراير"));
  if (penalizedTeam) { penalizedTeam.points -= 3; }

  return Array.from(table.values()).map(row => ({ ...row, gd: row.gf - row.ga })).sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.team.localeCompare(b.team, "ar")).map((row, i) => ({ ...row, rank: i + 1 }));
}

function zoneColor(rank: number, tourneyType: string) { 
  if (tourneyType === 'juniors') return rank <= 2 ? "bg-emerald-500 text-white" : "bg-rose-500 text-white";
  return rank <= 8 ? "bg-emerald-500 text-white" : rank <= 24 ? "bg-sky-400 text-white" : "bg-rose-500 text-white"; 
}

function sortMatches(arr: any[]) { return [...arr].sort((a, b) => { if (a.date !== b.date) return b.date.localeCompare(a.date); return (b.time || "00:00").localeCompare(a.time || "00:00"); }); }
function sortMatchesAsc(arr: any[]) { return [...arr].sort((a, b) => { if (a.date !== b.date) return a.date.localeCompare(b.date); return (a.time || "00:00").localeCompare(b.time || "00:00"); }); }

export default function Page() {
  const [activeTournament, setActiveTournament] = useState<'youth' | 'juniors'>('youth'); // 🔴 مفتاح التحويل السحري
  const [activeTab, setActiveTab] = useState<string>("standings");

  const [matches, setMatches] = useState<any[]>([]);
  const [goalEvents, setGoalEvents] = useState<any[]>([]);
  const [cardEvents, setCardEvents] = useState<any[]>([]);
  const [mediaItems, setMediaItems] = useState<any[]>([]);
  const [motmList, setMotmList] = useState<any[]>([]);
  const [tickerText, setTickerText] = useState("مطروح الرياضية...");
  const [search, setSearch] = useState("");
  const [searchScorers, setSearchScorers] = useState("");
  const [searchCards, setSearchCards] = useState("");
  const [loading, setLoading] = useState(true);
  
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [predForms, setPredForms] = useState<Record<string, any>>({});
  const [predictedMatches, setPredictedMatches] = useState<Record<string, boolean>>({});
  const [isTableExpanded, setIsTableExpanded] = useState(false);

  // 🔴 جلب البيانات بناءً على البطولة المختارة
  useEffect(() => {
    setLoading(true);
    if (typeof window !== "undefined" && "Notification" in window) { if (Notification.permission === "granted") setIsSubscribed(true); }
    const stored = localStorage.getItem('predictedMatches');
    if (stored) setPredictedMatches(JSON.parse(stored));

    const suffix = activeTournament === "juniors" ? "_juniors" : "";

    const unsubMatches = onSnapshot(collection(db, `matches${suffix}`), (snap) => {
      setMatches(snap.docs.map(doc => ({ id: doc.id, ...doc.data(), teamA: cleanTeamString(doc.data().teamA || doc.data().home), teamB: cleanTeamString(doc.data().teamB || doc.data().away) })));
      setLoading(false);
    });
    const unsubGoals = onSnapshot(collection(db, `goals${suffix}`), (snap) => setGoalEvents(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubCards = onSnapshot(collection(db, `cards${suffix}`), (snap) => setCardEvents(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubMedia = onSnapshot(collection(db, `media${suffix}`), (snap) => setMediaItems(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubMotm = onSnapshot(collection(db, `motm${suffix}`), (snap) => setMotmList(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubTicker = onSnapshot(doc(db, "settings", "ticker"), (snap) => setTickerText(snap.data()?.text || "مطروح الرياضية..."));

    return () => { unsubMatches(); unsubGoals(); unsubCards(); unsubMedia(); unsubMotm(); unsubTicker(); };
  }, [activeTournament]);

  const handleSubscribe = async () => {
    if (!("Notification" in window)) { alert("متصفحك لا يدعم الإشعارات."); return; }
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        const { getMessaging, getToken, isSupported } = await import("firebase/messaging");
        const supported = await isSupported();
        if (!supported) return;
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        const messaging = getMessaging(db.app);
        const token = await getToken(messaging, { vapidKey: "BIaf6ABhsIzwUuJmFudhT6rMpY0LjumPTlYoGxEbmAW9HfkQXvWJSrbeW0zu6OIgVSG_ggxcj5lN5xngnZ36Eso", serviceWorkerRegistration: registration });
        if (token) { await setDoc(doc(db, "subscribers", token), { token, dateAdded: new Date().toISOString() }); setIsSubscribed(true); alert("✅ تم تفعيل الإشعارات!"); }
      }
    } catch (e) { console.error(e); }
  };

  const submitPrediction = async (match: any) => {
    const form = predForms[match.id];
    if (!form?.name || !form?.phone || form.home === undefined || form.away === undefined) return alert("اكمل بيانات التوقع!");
    const suffix = activeTournament === "juniors" ? "_juniors" : "";
    await addDoc(collection(db, `predictions${suffix}`), { matchId: match.id, matchName: `${match.teamA} vs ${match.teamB}`, name: form.name, phone: form.phone, homeScore: form.home, awayScore: form.away, timestamp: new Date().toISOString() });
    const newPred = { ...predictedMatches, [match.id]: true };
    setPredictedMatches(newPred); localStorage.setItem('predictedMatches', JSON.stringify(newPred));
    alert("✅ تم إرسال توقعك بنجاح!");
  };

  const renderPredictionSection = (match: any) => {
    return (
      <div className="mt-5 pt-5 border-t border-yellow-400/20">
        <h4 className="text-sm font-black text-yellow-400 mb-4 text-center flex items-center justify-center gap-1"><Gift className="h-4 w-4"/> مسابقة التوقعات: توقع واربح!</h4>
        {!predictedMatches[match.id] ? (
          <div className="space-y-3 bg-[#0a1428] p-4 rounded-2xl border border-yellow-400/20 shadow-inner">
            <div className="grid grid-cols-2 gap-3">
               <Input placeholder="الاسم الثلاثي" className="bg-[#1e2a4a] border-yellow-400/30 text-white text-xs h-10 placeholder:text-cyan-300/50" onChange={(e) => setPredForms({...predForms, [match.id]: {...predForms[match.id], name: e.target.value}})} />
               <Input placeholder="رقم الهاتف" type="tel" className="bg-[#1e2a4a] border-yellow-400/30 text-white text-xs h-10 font-mono placeholder:text-cyan-300/50" onChange={(e) => setPredForms({...predForms, [match.id]: {...predForms[match.id], phone: e.target.value}})} />
            </div>
            <div className="flex items-center justify-center gap-3 sm:gap-4 bg-[#13213a] p-3 rounded-xl border border-cyan-400/30">
               <div className="text-xs sm:text-sm text-cyan-300 font-bold w-16 sm:w-20 text-left line-clamp-1">{match.teamA}</div>
               <Input type="number" placeholder="0" className="w-12 sm:w-16 text-center bg-[#1e2a4a] border-yellow-400/50 text-white font-black text-lg h-10 sm:h-12" onChange={(e) => setPredForms({...predForms, [match.id]: {...predForms[match.id], home: e.target.value}})} />
               <span className="text-yellow-400 font-black">-</span>
               <Input type="number" placeholder="0" className="w-12 sm:w-16 text-center bg-[#1e2a4a] border-yellow-400/50 text-white font-black text-lg h-10 sm:h-12" onChange={(e) => setPredForms({...predForms, [match.id]: {...predForms[match.id], away: e.target.value}})} />
               <div className="text-xs sm:text-sm text-cyan-300 font-bold w-16 sm:w-20 text-right line-clamp-1">{match.teamB}</div>
            </div>
            <Button onClick={() => submitPrediction(match)} className="w-full bg-yellow-400 text-black font-black text-sm h-12 mt-2 hover:bg-yellow-300 transition-transform">إرسال التوقع 🚀</Button>
          </div>
        ) : (
          <div className="bg-[#1e2a4a] border border-cyan-400/30 p-4 rounded-2xl text-center">
             <p className="text-yellow-300 font-black text-sm">✅ تم تسجيل توقعك بنجاح!</p>
             <p className="text-cyan-300 text-xs mt-1 font-bold">حظ سعيد! سيتم التواصل مع الفائزين.</p>
          </div>
        )}
      </div>
    );
  };

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
  const tomorrowStr = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });

  const liveMatches = sortMatchesAsc(matches.filter(m => m.isLive === true));
  const finishedMatches = sortMatches(matches.filter(m => !m.isLive && (m.status === "انتهت" || m.date < todayStr))); 
  const todayMatches = sortMatchesAsc(matches.filter(m => !m.isLive && m.date === todayStr && m.status !== "انتهت"));
  const tomorrowMatches = sortMatchesAsc(matches.filter(m => !m.isLive && m.date === tomorrowStr && m.status !== "انتهت"));

  // 🔴 إعداد الجداول (واحد للشباب، واثنين للناشئين)
  const standingsYouth = useMemo(() => buildStandings(finishedMatches, CLEANED_TEAM_NAMES), [finishedMatches]);
  const standingsJunA = useMemo(() => buildStandings(finishedMatches, JUNIORS_GROUP_A), [finishedMatches]);
  const standingsJunB = useMemo(() => buildStandings(finishedMatches, JUNIORS_GROUP_B), [finishedMatches]);
  
  const scorers = useMemo(() => {
    const map = new Map<string, any>();
    goalEvents.forEach(e => { 
      const key = `${e.player}__${normalizeTeamName(e.team)}`; 
      if (!map.has(key)) map.set(key, { player: e.player, team: e.team, goals: 0, imageUrl: e.imageUrl || "" }); 
      map.get(key)!.goals += Number(e.goals) || 1; 
      if (e.imageUrl && !map.get(key)!.imageUrl) map.get(key)!.imageUrl = e.imageUrl;
    });
    return Array.from(map.values()).sort((a, b) => b.goals - a.goals);
  }, [goalEvents]);

  const filteredScorers = useMemo(() => {
    return scorers.filter(s => !searchScorers || s.player.includes(searchScorers) || s.team.includes(searchScorers));
  }, [scorers, searchScorers]);

  const topMotmPlayer = useMemo(() => {
    const counts: Record<string, any> = {};
    motmList.forEach(m => { if(!counts[m.player]) counts[m.player] = { name: m.player, team: m.team, count: 0 }; counts[m.player].count++; });
    return Object.values(counts).sort((a: any, b: any) => b.count - a.count)[0] as any;
  }, [motmList]);

  const statsData = useMemo(() => {
    const totalMatches = finishedMatches.length;
    let totalGoals = 0, draws00 = 0, drawsPositive = 0;
    finishedMatches.forEach(m => {
      totalGoals += (Number(m.homeGoals) + Number(m.awayGoals));
      if (m.homeGoals === m.awayGoals) { if (m.homeGoals === 0) draws00++; else drawsPositive++; }
    });
    const totalYellow = cardEvents.reduce((acc, curr) => acc + (Number(curr.yellow) || 0), 0);
    const totalRed = cardEvents.reduce((acc, curr) => acc + (Number(curr.red) || 0), 0);
    
    // بناءً على البطولة نحدد الترتيب عشان نجيب الأقوى والأضعف
    const currentStandings = activeTournament === 'youth' ? [...standingsYouth] : [...standingsJunA, ...standingsJunB];
    const sortedByAttack = [...currentStandings].sort((a, b) => b.gf - a.gf);
    const sortedByDef = [...currentStandings].sort((a, b) => a.ga - b.ga);

    return {
      totalMatches, totalGoals, draws00, drawsPositive, totalYellow, totalRed,
      bestAttack: sortedByAttack[0], worstAttack: sortedByAttack[sortedByAttack.length - 1],
      bestDefense: sortedByDef[0], worstDefense: sortedByDef[sortedByDef.length - 1],
      topScorer: scorers[0], goalsPerMatch: totalMatches > 0 ? (totalGoals / totalMatches).toFixed(2) : "0",
      draws00Percent: totalMatches > 0 ? Math.round((draws00 / totalMatches) * 100) : 0,
      drawsPosPercent: totalMatches > 0 ? Math.round((drawsPositive / totalMatches) * 100) : 0,
      yellowPerMatch: totalMatches > 0 ? (totalYellow / totalMatches).toFixed(2) : "0",
      redPerMatch: totalMatches > 0 ? (totalRed / totalMatches).toFixed(2) : "0"
    };
  }, [finishedMatches, standingsYouth, standingsJunA, standingsJunB, cardEvents, scorers, activeTournament]);

  const cardsList = useMemo(() => {
    const map = new Map<string, any>();
    cardEvents.forEach(e => { const key = `${e.player}__${normalizeTeamName(e.team)}`; if (!map.has(key)) map.set(key, { player: e.player, team: e.team, yellow: 0, red: 0 }); const item = map.get(key)!; item.yellow += Number(e.yellow) || 0; item.red += Number(e.red) || 0; });
    return Array.from(map.values()).map(row => ({ ...row, status: row.red > 0 ? "طرد" : row.yellow >= 3 ? "إيقاف" : "متاح" })).sort((a, b) => b.red - a.red || b.yellow - a.yellow);
  }, [cardEvents]);

  const filteredCardsList = useMemo(() => {
    return cardsList.filter(c => (!searchCards || c.player.includes(searchCards) || c.team.includes(searchCards)) && (c.yellow > 0 || c.red > 0));
  }, [cardsList, searchCards]);

  if (loading) return <div className="min-h-screen bg-[#0a1428] flex items-center justify-center flex-col gap-4"><Loader2 className="h-16 w-16 animate-spin text-yellow-400" /><p className="text-white font-bold animate-pulse">جاري تحميل البيانات...</p></div>;

  return (
    <div dir="rtl" className="min-h-screen bg-[#0a1428] text-white relative pb-20">
      <div className="mx-auto max-w-7xl p-3 sm:p-4 md:p-6 lg:p-8">

        {/* شريط آخر تحديث */}
        <div className="mb-4 rounded-3xl border border-yellow-400/50 bg-[#13213a] p-4 flex items-center gap-4">
          <span className="shrink-0 rounded-2xl bg-yellow-400 px-5 py-2 text-sm font-black text-black">آخر تحديث</span>
          <div className="flex-1 overflow-hidden"><div className="animate-marquee whitespace-nowrap text-lg font-bold text-yellow-300">{tickerText}</div></div>
        </div>

        {/* الهيدر */}
        <div className="mb-6 rounded-3xl border border-yellow-400/40 bg-gradient-to-br from-[#1e2a4a] to-[#13213a] p-6 text-center shadow-2xl">
          <div className="flex justify-center mb-6"><img src="/logo.png" alt="شعار البطولة" className="h-28 sm:h-36 w-auto" /></div>
          <h1 className="text-4xl sm:text-6xl font-black text-yellow-300 tracking-tight">بطولة كأس مطروح</h1>
          <p className="mt-3 text-xl text-cyan-300">النسخة الثالثة ٢٠٢٦</p>
        </div>

        {/* 🔴 مفتاح التحويل السحري (الشباب / الناشئين) */}
        <div className="flex justify-center mb-10 mt-4">
          <div className="bg-[#13213a] p-2 rounded-full border border-yellow-400/30 inline-flex shadow-xl gap-2 w-full max-w-md">
            <button 
              onClick={() => { setActiveTournament('youth'); setActiveTab('standings'); }} 
              className={`flex-1 py-3 rounded-full text-base sm:text-xl font-black transition-all ${activeTournament === 'youth' ? 'bg-yellow-400 text-black shadow-[0_0_15px_rgba(250,204,21,0.4)]' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              🏆 الشباب
            </button>
            <button 
              onClick={() => { setActiveTournament('juniors'); setActiveTab('standings'); }} 
              className={`flex-1 py-3 rounded-full text-base sm:text-xl font-black transition-all ${activeTournament === 'juniors' ? 'bg-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              🏅 الناشئين
            </button>
          </div>
        </div>

        {/* أزرار التبويبات */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {[
            { key: "knockout", label: "الأدوار الإقصائية", icon: "🏆" },
            { key: "live", label: "مباشر", icon: "🔴" }, { key: "stats", label: "إحصائيات", icon: "📊" }, { key: "motm_tab", label: "رجل المباراة", icon: "🌟" }, 
            { key: "today", label: "مباريات اليوم", icon: "📅" }, { key: "tomorrow", label: "مباريات غداً", icon: "📆" }, { key: "all", label: "النتائج", icon: "⚽" }, 
            { key: "standings", label: "الترتيب", icon: "📊" }, { key: "scorers", label: "الهدافين", icon: "🥇" }, { key: "cards", label: "الكروت", icon: "🟨" }, { key: "media", label: "ميديا", icon: "🎥" }
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex-1 sm:flex-none px-5 py-3.5 rounded-2xl font-bold text-sm sm:text-base transition-all border border-yellow-400/30 ${activeTab === tab.key ? "bg-yellow-400 text-black shadow-lg scale-105" : "bg-[#1e2a4a] text-white hover:bg-[#25345a]"}`}>
              <span className={`text-lg ${tab.key === "live" && activeTab === "live" ? "animate-pulse" : ""}`}>{tab.icon}</span> <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* 1. تبويب الأدوار الإقصائية */}
        {activeTab === "knockout" && (
          <div className="space-y-10 relative">
            <div className="text-center mb-8"><h2 className="text-4xl font-black text-yellow-300 drop-shadow-lg">الطريق إلى النهائي 🏆</h2><p className="text-cyan-300 mt-2 font-bold text-lg">{activeTournament === 'youth' ? "شجرة بطولة الشباب" : "إقصائيات بطولة الناشئين"}</p></div>
            
            {/* الشجرة الإقصائية بتظهر للشباب فقط لأن الناشئين أعدادهم مختلفة */}
            {activeTournament === 'youth' && (
              <>
                <div className="bg-gradient-to-br from-[#1e2a4a] to-[#13213a] p-4 sm:p-6 rounded-3xl border-2 border-yellow-400/50 shadow-xl relative overflow-hidden">
                   <div className="text-center mb-8"><Badge className="bg-yellow-400 text-black text-2xl px-10 py-2 font-black shadow-lg border-2 border-[#13213a]">دور الـ 16</Badge></div>
                   <div className="grid md:grid-cols-2 gap-8 relative z-10">
                     <div className="space-y-4">
                       {[ { id: 1, r1: 1, l1: "أول الترتيب", m2: 104 }, { id: 2, r1: 8, l1: "ثامن الترتيب", m2: 97 }, { id: 3, r1: 4, l1: "رابع الترتيب", m2: 101 }, { id: 4, r1: 5, l1: "خامس الترتيب", m2: 100 } ].map(match => (
                         <div key={match.id} className="bg-[#0a1428] rounded-2xl border border-yellow-400/30 flex items-center shadow-md overflow-hidden hover:border-yellow-400 transition-colors">
                            <div className="bg-yellow-400 text-black font-black w-10 h-full flex items-center justify-center text-xl shrink-0">{match.id}</div>
                            <div className="flex-1 p-3 flex flex-col"><div className="text-cyan-300 font-bold text-sm text-center bg-[#13213a] rounded-lg py-1 mb-1">{standingsYouth.length >= match.r1 ? standingsYouth[match.r1-1].team : match.l1}</div><div className="text-center text-white font-black text-xs my-1">VS</div><div className="text-yellow-300 font-bold text-sm text-center bg-[#13213a] rounded-lg py-1 mt-1">الفائز من م {match.m2}</div></div>
                         </div>
                       ))}
                     </div>
                     <div className="space-y-4">
                       {[ { id: 5, r1: 2, l1: "ثاني الترتيب", m2: 103 }, { id: 6, r1: 7, l1: "سابع الترتيب", m2: 98 }, { id: 7, r1: 3, l1: "ثالث الترتيب", m2: 102 }, { id: 8, r1: 6, l1: "سادس الترتيب", m2: 99 } ].map(match => (
                         <div key={match.id} className="bg-[#0a1428] rounded-2xl border border-yellow-400/30 flex items-center shadow-md overflow-hidden hover:border-yellow-400 transition-colors">
                            <div className="bg-yellow-400 text-black font-black w-10 h-full flex items-center justify-center text-xl shrink-0">{match.id}</div>
                            <div className="flex-1 p-3 flex flex-col"><div className="text-cyan-300 font-bold text-sm text-center bg-[#13213a] rounded-lg py-1 mb-1">{standingsYouth.length >= match.r1 ? standingsYouth[match.r1-1].team : match.l1}</div><div className="text-center text-white font-black text-xs my-1">VS</div><div className="text-yellow-300 font-bold text-sm text-center bg-[#13213a] rounded-lg py-1 mt-1">الفائز من م {match.m2}</div></div>
                         </div>
                       ))}
                     </div>
                   </div>
                </div>
                <div className="bg-[#13213a] p-4 sm:p-6 rounded-3xl border border-cyan-500/30 shadow-lg">
                   <div className="text-center mb-8"><Badge className="bg-cyan-500 text-white text-xl px-8 py-2 font-black shadow-lg border-2 border-[#13213a]">مباريات الملحق</Badge></div>
                   <div className="grid md:grid-cols-2 gap-4">
                     {[ { id: 97, r1: 9, r2: 24, l1: "تاسع الترتيب", l2: "الرابع والعشرون" }, { id: 98, r1: 10, r2: 23, l1: "عاشر الترتيب", l2: "الثالث والعشرون" }, { id: 99, r1: 11, r2: 22, l1: "الحادي عشر", l2: "الثاني والعشرون" }, { id: 100, r1: 12, r2: 21, l1: "الثاني عشر", l2: "الواحد والعشرون" }, { id: 101, r1: 13, r2: 20, l1: "الثالث عشر", l2: "العشرون" }, { id: 102, r1: 14, r2: 19, l1: "الرابع عشر", l2: "التاسع عشر" }, { id: 103, r1: 15, r2: 18, l1: "الخامس عشر", l2: "الثامن عشر" }, { id: 104, r1: 16, r2: 17, l1: "السادس عشر", l2: "السابع عشر" } ].map(match => (
                       <div key={match.id} className="bg-[#1e2a4a] rounded-xl flex items-center justify-between p-2 border border-white/5 hover:border-cyan-400/50 transition-colors"><div className="flex-1 text-center font-bold text-white text-sm">{standingsYouth.length >= match.r1 ? standingsYouth[match.r1-1].team : match.l1}</div><div className="bg-[#0a1428] border border-cyan-500/30 px-3 py-1 rounded-lg text-cyan-400 font-black text-xs mx-2">م {match.id}</div><div className="flex-1 text-center font-bold text-white text-sm">{standingsYouth.length >= match.r2 ? standingsYouth[match.r2-1].team : match.l2}</div></div>
                     ))}
                   </div>
                </div>
              </>
            )}

            <div className={`${activeTournament === 'youth' ? 'mt-12 border-t border-yellow-400/20 pt-10' : ''}`}>
              {activeTournament === 'youth' && <h3 className="text-2xl font-black text-center text-yellow-300 mb-8">نتائج وجدول الإقصائيات المباشرة</h3>}
              {["النهائي", "نصف النهائي", "دور الثمانية", "دور الستة عشر", "الملحق"].map((roundName) => {
                const roundMatches = sortMatchesAsc(matches.filter(m => m.round === roundName));
                if (roundMatches.length === 0) return null;
                return (
                  <div key={roundName} className="mb-8"><div className="flex justify-center mb-4"><Badge className="bg-white/10 text-yellow-300 text-lg px-6 py-1 border border-yellow-400/30">{roundName}</Badge></div><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {roundMatches.map(match => {
                        const isFinished = match.status === "انتهت";
                        let homeWon = false, awayWon = false;
                        if (isFinished) {
                          if (match.homeGoals > match.awayGoals) homeWon = true; else if (match.awayGoals > match.homeGoals) awayWon = true;
                          else if (match.penaltiesHome && match.penaltiesAway) {
                             const hPen = match.penaltiesHome.filter((p:string) => p === 'scored').length; const aPen = match.penaltiesAway.filter((p:string) => p === 'scored').length;
                             if (hPen > aPen) homeWon = true; if (aPen > hPen) awayWon = true;
                          }
                        }
                        return (
                          <Card key={match.id} className={`bg-[#1e2a4a] border ${isFinished ? 'border-white/10' : 'border-yellow-400/30'} overflow-hidden shadow-md transition-transform hover:scale-[1.02]`}><CardContent className="p-4"><div className="text-center text-xs sm:text-sm text-cyan-300 mb-4 font-bold border-b border-white/5 pb-2">{getArabicDay(match.date)} • {match.date} • {formatTime12(match.time)}</div><div className="flex flex-col gap-2"><div className={`flex justify-between items-center p-3 rounded-xl ${homeWon ? 'bg-[#13213a] border border-cyan-500/50' : awayWon ? 'opacity-40 grayscale' : 'bg-[#0a1428]'}`}><span className="font-bold text-white">{match.teamA}</span><span className="font-black text-xl text-yellow-400">{match.homeGoals}</span></div><div className={`flex justify-between items-center p-3 rounded-xl ${awayWon ? 'bg-[#13213a] border border-cyan-500/50' : homeWon ? 'opacity-40 grayscale' : 'bg-[#0a1428]'}`}><span className="font-bold text-white">{match.teamB}</span><span className="font-black text-xl text-yellow-400">{match.awayGoals}</span></div></div>{(match.penaltiesHome && match.penaltiesHome.length > 0 && match.homeGoals === match.awayGoals && isFinished) && (<div className="text-center mt-3 pt-2 border-t border-white/5"><Badge className="bg-black/50 text-yellow-400 text-xs">ركلات ترجيح ({match.penaltiesHome.filter((p:string)=>p==='scored').length}) - ({match.penaltiesAway.filter((p:string)=>p==='scored').length})</Badge></div>)}</CardContent></Card>
                        )
                      })}
                    </div></div>
                )
              })}
            </div>
          </div>
        )}

        {/* 6. تبويب الترتيب (بالدعم الذكي للناشئين والشباب) */}
        {activeTab === "standings" && (
          <div className="space-y-8">
            {activeTournament === 'juniors' ? (
              // 🔴 عرض مجموعتين الناشئين
              <div className="grid md:grid-cols-2 gap-8">
                {[
                  { title: "المجموعة الأولى", data: standingsJunA },
                  { title: "المجموعة الثانية", data: standingsJunB }
                ].map(group => (
                  <Card key={group.title} className="rounded-3xl border border-cyan-500/30 bg-[#13213a] shadow-xl overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between border-b border-cyan-500/20 pb-4">
                       <CardTitle className="text-cyan-300 flex items-center gap-3"><Trophy className="h-6 w-6" /> {group.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                       <div className="overflow-auto w-full touch-pan-x touch-pan-y" dir="rtl">
                         <table className="w-full text-white text-right min-w-[500px]">
                           <thead className="bg-[#13213a] border-b border-cyan-500/30">
                              <tr>{STANDINGS_HEADERS.map(h => (<th key={h} className="px-3 py-3 font-bold text-cyan-300 text-xs whitespace-nowrap">{h}</th>))}</tr>
                           </thead>
                           <tbody>
                              {group.data.map(row => (
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
              // 🔴 عرض جدول الشباب
              <Card className="rounded-3xl border border-yellow-400/30 bg-[#13213a] shadow-xl overflow-hidden">
                 <CardHeader className="flex flex-row items-center justify-between border-b border-yellow-400/20 pb-4">
                    <CardTitle className="text-yellow-300 flex items-center gap-3"><Trophy className="h-7 w-7" /> جدول الترتيب العام</CardTitle>
                 </CardHeader>
                 <CardContent className="p-0">
                    <div className="overflow-auto w-full max-h-[60vh] touch-pan-x touch-pan-y relative" dir="rtl">
                      <table className="w-full text-white text-right min-w-[800px]">
                        <thead className="sticky top-0 bg-[#13213a] border-b border-yellow-400/30 z-20 shadow-md">
                           <tr>{STANDINGS_HEADERS.map(h => (<th key={h} className="px-4 py-4 font-bold text-cyan-300 text-sm whitespace-nowrap">{h}</th>))}</tr>
                        </thead>
                        <tbody>
                           {standingsYouth.map(row => (
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
        )}

        {/* 7. تبويب النتائج السابقة */}
        {activeTab === "all" && (
           <Card className={`rounded-3xl border ${activeTournament === 'juniors' ? 'border-cyan-500/30' : 'border-yellow-400/30'} bg-[#13213a]`}>
             <CardHeader className="flex flex-col sm:flex-row justify-between items-center gap-4">
               <div>
                  <CardTitle className={activeTournament === 'juniors' ? 'text-cyan-300' : 'text-yellow-300'}>النتائج السابقة</CardTitle>
                  <Badge className="bg-cyan-500 mt-2 font-bold text-white">إجمالي المباريات: {finishedMatches.length}</Badge>
               </div>
               <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute right-3 top-3 h-4 w-4 text-cyan-300" />
                  <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث عن فريق..." className="pr-10 bg-[#1e2a4a] border-yellow-400 text-white rounded-xl" />
               </div>
             </CardHeader>
             <CardContent className="p-6 grid gap-4 md:grid-cols-2">
               {finishedMatches.filter(m => !search || m.teamA.includes(search) || m.teamB.includes(search)).map(match => (
                 <div key={match.id} className={`bg-[#1e2a4a] p-6 rounded-3xl border border-white/5 text-center transition-all ${activeTournament === 'juniors' ? 'hover:border-cyan-400/50' : 'hover:border-yellow-400/50'}`}>
                    <div className="text-cyan-300 text-xs sm:text-sm mb-3 font-bold">{getArabicDay(match.date)} • {match.date} • {match.round}</div>
                    <div className="flex items-center justify-center gap-4">
                       <div className="flex-1 font-bold text-sm sm:text-xl text-white">{match.teamA}</div>
                       <div className="text-2xl sm:text-4xl font-black text-yellow-400 px-2">{match.homeGoals} - {match.awayGoals}</div>
                       <div className="flex-1 font-bold text-sm sm:text-xl text-white">{match.teamB}</div>
                    </div>
                 </div>
               ))}
             </CardContent>
           </Card>
        )}

        {/* 8. تبويب اليوم */}
        {activeTab === "today" && (
           <Card className={`rounded-3xl border ${activeTournament === 'juniors' ? 'border-cyan-500/30' : 'border-yellow-400/30'} bg-[#13213a]`}>
             <CardHeader className="text-center border-b border-white/10 pb-6">
                <Badge className={`${activeTournament === 'juniors' ? 'bg-cyan-500 text-white' : 'bg-yellow-400 text-black'} text-sm sm:text-lg px-6 py-2.5`}>مباريات اليوم • {getArabicDay(todayStr)} {todayStr}</Badge>
                <CardTitle className={`text-2xl sm:text-4xl font-black mt-4 ${activeTournament === 'juniors' ? 'text-cyan-300' : 'text-yellow-300'}`}>مواجهات اليوم</CardTitle>
             </CardHeader>
             <CardContent className="p-4 sm:p-6 grid gap-6 mt-4">
               {todayMatches.length > 0 ? todayMatches.map(match => (
                 <div key={match.id} className={`rounded-3xl border border-white/10 bg-[#1e2a4a] p-4 sm:p-6 transition-all ${activeTournament === 'juniors' ? 'hover:border-cyan-400' : 'hover:border-yellow-400'}`}>
                    <div className="text-center mb-6">
                       <div className="text-cyan-300 text-xs sm:text-sm font-bold">{getArabicDay(match.date)} • {match.date}</div>
                       <div className="flex items-center justify-center gap-2 text-yellow-300 mt-2">
                          <Clock className="h-4 w-4 sm:h-5 sm:w-5" /><span className="text-lg sm:text-2xl font-bold">{formatTime12(match.time)}</span>
                       </div>
                    </div>
                    <div className="flex items-center justify-center gap-2 sm:gap-6 text-lg sm:text-2xl font-bold">
                       <div className="flex-1 text-center text-white text-sm sm:text-xl">{match.teamA}</div>
                       <div className="text-yellow-400 font-black px-2 text-xl sm:text-3xl">VS</div>
                       <div className="flex-1 text-center text-white text-sm sm:text-xl">{match.teamB}</div>
                    </div>
                    {renderPredictionSection(match)}
                 </div>
               )) : <p className="text-center py-10 text-white font-bold text-lg sm:text-xl">لا توجد مباريات قادمة اليوم</p>}
             </CardContent>
           </Card>
        )}

        {/* 9. تبويب غداً */}
        {activeTab === "tomorrow" && (
           <Card className={`rounded-3xl border ${activeTournament === 'juniors' ? 'border-cyan-500/30' : 'border-yellow-400/30'} bg-[#13213a]`}>
             <CardHeader className="text-center border-b border-white/10 pb-6">
                <Badge className={`${activeTournament === 'juniors' ? 'bg-cyan-500 text-white' : 'bg-yellow-400 text-black'} text-sm sm:text-lg px-6 py-2.5`}>مباريات غداً • {getArabicDay(tomorrowStr)} {tomorrowStr}</Badge>
                <CardTitle className={`text-2xl sm:text-4xl font-black mt-4 ${activeTournament === 'juniors' ? 'text-cyan-300' : 'text-yellow-300'}`}>مواجهات غداً</CardTitle>
             </CardHeader>
             <CardContent className="p-4 sm:p-6 grid gap-6 mt-4 md:grid-cols-2">
               {tomorrowMatches.map(match => (
                 <div key={match.id} className={`rounded-3xl border border-white/10 bg-[#1e2a4a] p-4 sm:p-6 transition-all ${activeTournament === 'juniors' ? 'hover:border-cyan-400' : 'hover:border-yellow-400'}`}>
                    <div className="text-center mb-6">
                       <div className="text-cyan-300 text-xs sm:text-sm font-bold">{getArabicDay(match.date)} • {match.date}</div>
                       <div className="flex items-center justify-center gap-2 text-yellow-300 mt-2">
                          <Clock className="h-4 w-4 sm:h-5 sm:w-5" /><span className="text-lg sm:text-2xl font-bold">{formatTime12(match.time)}</span>
                       </div>
                    </div>
                    <div className="flex items-center justify-center gap-2 sm:gap-6 text-lg sm:text-2xl font-bold">
                       <div className="flex-1 text-center text-white text-sm sm:text-xl">{match.teamA}</div>
                       <div className="text-yellow-400 font-black px-2 text-xl sm:text-3xl">VS</div>
                       <div className="flex-1 text-center text-white text-sm sm:text-xl">{match.teamB}</div>
                    </div>
                    {renderPredictionSection(match)}
                 </div>
               ))}
               {tomorrowMatches.length === 0 && <p className="text-center py-10 text-white font-bold text-lg sm:text-xl col-span-full">لا توجد مباريات مسجلة غداً</p>}
             </CardContent>
           </Card>
        )}

        {/* 10. تبويب الهدافين (مع البحث) */}
        {activeTab === "scorers" && (
          <div className="space-y-6">
             <div className="flex flex-col sm:flex-row justify-between items-center bg-[#13213a] p-4 sm:p-6 rounded-3xl border border-yellow-400/30 gap-4">
                <h2 className="text-2xl sm:text-3xl font-black text-yellow-300">قائمة الهدافين</h2>
                <div className="relative w-full sm:max-w-xs">
                   <Search className="absolute right-3 top-3 h-4 w-4 text-cyan-300" />
                   <Input value={searchScorers} onChange={e => setSearchScorers(e.target.value)} placeholder="بحث عن لاعب أو فريق..." className="pr-10 bg-[#1e2a4a] border-yellow-400 text-white rounded-xl" />
                </div>
             </div>
             <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
               {filteredScorers.length > 0 ? filteredScorers.map((player, i) => (
                 <Card key={i} className={`bg-[#1e2a4a] border-yellow-400/30 rounded-3xl relative overflow-hidden ${i === 0 && !searchScorers ? "border-yellow-400 shadow-xl scale-[1.02]" : ""}`}>
                    {i === 0 && !searchScorers && <div className="absolute top-0 right-0 bg-yellow-400 text-black text-[10px] font-black px-3 py-1 rounded-bl-lg">المركز الأول 👑</div>}
                    <CardContent className="p-6 flex justify-between items-center">
                       <div className="flex items-center gap-4">{player.imageUrl ? <img src={player.imageUrl} className="h-12 w-12 rounded-full object-cover border-2 border-yellow-400" /> : <div className="h-12 w-12 rounded-full bg-[#0a1428] flex items-center justify-center text-xl">👤</div>}<div><h3 className="font-bold text-white text-lg sm:text-xl">{player.player}</h3><p className="text-cyan-300 text-sm font-bold">{player.team}</p></div></div>
                       <Badge className="text-black text-2xl sm:text-3xl px-5 sm:px-6 py-2 sm:py-3 font-black bg-yellow-400">{player.goals}</Badge>
                    </CardContent>
                 </Card>
               )) : <p className="text-center text-white font-bold col-span-full py-10">لا يوجد هدافين مطابقين للبحث</p>}
             </div>
          </div>
        )}

        {/* 11. تبويب الكروت (مع البحث) */}
        {activeTab === "cards" && (
          <div className="space-y-6">
             <div className="flex flex-col sm:flex-row justify-between items-center bg-[#13213a] p-4 sm:p-6 rounded-3xl border border-yellow-400/30 gap-4">
                <h2 className="text-2xl sm:text-3xl font-black text-yellow-300">سجل الإنذارات</h2>
                <div className="relative w-full sm:max-w-xs">
                   <Search className="absolute right-3 top-3 h-4 w-4 text-cyan-300" />
                   <Input value={searchCards} onChange={e => setSearchCards(e.target.value)} placeholder="بحث عن لاعب أو فريق..." className="pr-10 bg-[#1e2a4a] border-yellow-400 text-white rounded-xl" />
                </div>
             </div>
             <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
               {filteredCardsList.length > 0 ? filteredCardsList.map((item, i) => (
                 <Card key={i} className="bg-[#1e2a4a] border-yellow-400/30 rounded-3xl hover:border-yellow-400 transition-all">
                   <CardContent className="p-6">
                     <div className="flex justify-between items-start"><div><h3 className="font-bold text-lg sm:text-xl text-white">{item.player}</h3><p className="text-cyan-300 text-sm font-bold">{item.team}</p></div><Badge className={`${item.status === 'متاح' ? 'bg-cyan-500' : item.status === 'إيقاف' ? 'bg-yellow-500' : 'bg-red-500'} text-black font-bold text-sm px-3`}>{item.status}</Badge></div>
                     <div className="mt-4 flex gap-4"><Badge className="bg-yellow-400/20 text-yellow-300 px-4 py-2 font-bold text-lg">🟨 {item.yellow}</Badge><Badge className="bg-red-500/20 text-red-300 px-4 py-2 font-bold text-lg">🟥 {item.red}</Badge></div>
                   </CardContent>
                 </Card>
               )) : <p className="text-center text-white font-bold col-span-full py-10">لا توجد بطاقات مطابقة للبحث</p>}
             </div>
          </div>
        )}

        {/* 2. تبويب رجل المباراة */}
        {activeTab === "motm_tab" && (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {motmList.length > 0 ? motmList.map((m, i) => (
              <div key={i} className="group relative"><div className="bg-[#13213a] rounded-t-3xl p-4 border-x border-t border-yellow-400/30 flex items-center justify-between"><div className="text-[10px] font-bold text-cyan-300 uppercase tracking-tighter">رجل المباراة برعاية</div><div className="flex items-center gap-2"><span className="text-xs font-black text-white">{m.sponsorName}</span><img src={m.sponsorLogo} className="h-6 w-6 object-contain" /></div></div><div className="relative aspect-square overflow-hidden border-x border-yellow-400/50 p-2 bg-gradient-to-b from-[#13213a] to-[#0a1428]"><img src={m.imageUrl} className="w-full h-full object-cover rounded-xl shadow-2xl transition-transform group-hover:scale-105" /></div><div className="bg-yellow-400 text-black rounded-b-3xl p-4 text-center border-x border-b border-yellow-400 shadow-xl"><div className="text-2xl font-black">{m.player}</div><div className="text-sm font-bold opacity-80">{m.team}</div></div></div>
            )) : <p className="text-center col-span-full py-20 text-white font-bold text-xl">انتظروا جوائز النجوم بعد كل مباراة! 🌟</p>}
          </div>
        )}

        {/* 3. تبويب الميديا */}
        {activeTab === "media" && (
          <div className="space-y-12">
               <h2 className="text-3xl font-black text-yellow-400 mb-6 flex items-center gap-2"><Play /> المركز الإعلامي</h2>
               {mediaItems.length > 0 ? (
                 <div className="grid gap-6 md:grid-cols-2">
                   {mediaItems.map(item => {
                     const yId = getYoutubeId(item.url);
                     return yId ? (
                       <Card key={item.id} className="bg-[#1e2a4a] border-cyan-500/30 rounded-3xl overflow-hidden p-4"><h3 className="text-xl font-bold text-white mb-4 text-center">{item.title}</h3><div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-white/10 shadow-lg"><iframe className="absolute top-0 left-0 w-full h-full" src={`https://www.youtube.com/embed/${yId}`} frameBorder="0" allowFullScreen></iframe></div></Card>
                     ) : null;
                   })}
                 </div>
               ) : <p className="text-center text-white py-10 font-bold">لا توجد فيديوهات حالياً</p>}
          </div>
        )}

        {/* 4. تبويب الإحصائيات */}
        {activeTab === "stats" && (
          <div className="space-y-8">
            {topMotmPlayer && (
              <Card className="bg-gradient-to-r from-cyan-600 to-cyan-900 border-none p-8 rounded-3xl text-center shadow-2xl relative overflow-hidden"><Star className="absolute -left-4 -top-4 h-32 w-32 text-white/10 rotate-12" /><h3 className="text-white font-black text-xl mb-4 relative z-10">🌟 ملك جوائز رجل المباراة</h3><div className="text-5xl font-black text-yellow-300 mb-2 relative z-10">{topMotmPlayer.name}</div><div className="text-white text-xl opacity-90 mb-4 relative z-10">{topMotmPlayer.team}</div><Badge className="bg-black text-yellow-400 px-6 py-2 text-lg relative z-10">حصل على الجائزة {topMotmPlayer.count} مرات</Badge></Card>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[ { label: "الأهداف", val: statsData.totalGoals, icon: "⚽", color: "text-yellow-400", sub: `${statsData.goalsPerMatch} / م` }, { label: "المباريات", val: statsData.totalMatches, icon: "🏟️", color: "text-cyan-400", sub: "إجمالي" }, { label: "تعادل 0-0", val: statsData.draws00, icon: "🤝", color: "text-white", sub: `${statsData.draws00Percent}%` }, { label: "تعادل إيجابي", val: statsData.drawsPositive, icon: "🔥", color: "text-cyan-400", sub: `${statsData.drawsPosPercent}%` }, { label: "إنذار", val: statsData.totalYellow, icon: "🟨", color: "text-yellow-500", sub: "أصفر" }, { label: "طرد", val: statsData.totalRed, icon: "🟥", color: "text-red-500", sub: "أحمر" } ].map((s, i) => (
                <Card key={i} className="bg-[#13213a] border-white/5 text-center p-4 relative overflow-hidden group"><div className={`text-4xl font-black ${s.color} mb-1`}>{s.val}</div><div className="text-[10px] text-white font-bold uppercase">{s.label}</div><Badge className="mt-2 bg-black/40 text-white text-[10px]">{s.sub}</Badge></Card>
              ))}
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
               <Card className="bg-[#13213a] border-yellow-400/20 p-6 text-center shadow-lg"><Target className="mx-auto mb-4 text-cyan-400 h-10 w-10" /><h4 className="text-white text-sm font-bold mb-2">أقوى هجوم</h4><div className="text-xl font-black text-white">{statsData.bestAttack?.team || "—"}</div><Badge className="mt-2 bg-cyan-500/10 text-cyan-400 border-none">{statsData.bestAttack?.gf || 0} هدف</Badge></Card>
               <Card className="bg-[#13213a] border-yellow-400/20 p-6 text-center shadow-lg"><Zap className="mx-auto mb-4 text-yellow-400 h-10 w-10" /><h4 className="text-white text-sm font-bold mb-2">أضعف هجوم</h4><div className="text-xl font-black text-white">{statsData.worstAttack?.team || "—"}</div><Badge className="mt-2 bg-yellow-500/10 text-yellow-400 border-none">{statsData.worstAttack?.gf || 0} هدف</Badge></Card>
               <Card className="bg-[#13213a] border-yellow-400/20 p-6 text-center shadow-lg"><Shield className="mx-auto mb-4 text-cyan-400 h-10 w-10" /><h4 className="text-white text-sm font-bold mb-2">أقوى دفاع</h4><div className="text-xl font-black text-white">{statsData.bestDefense?.team || "—"}</div><Badge className="mt-2 bg-cyan-500/10 text-cyan-400 border-none">استقبل {statsData.bestDefense?.ga || 0}</Badge></Card>
               <Card className="bg-[#13213a] border-yellow-400/20 p-6 text-center shadow-lg"><ShieldAlert className="mx-auto mb-4 text-yellow-500 h-10 w-10" /><h4 className="text-white text-sm font-bold mb-2">أضعف دفاع</h4><div className="text-xl font-black text-white">{statsData.worstDefense?.team || "—"}</div><Badge className="mt-2 bg-yellow-500/10 text-yellow-500 border-none">استقبل {statsData.worstDefense?.ga || 0}</Badge></Card>
            </div>
            <Card className="bg-gradient-to-r from-[#1e2a4a] to-[#13213a] border-2 border-yellow-400/50 p-6 md:p-10 rounded-3xl shadow-xl relative overflow-hidden"><div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10"><div className="flex flex-col md:flex-row items-center gap-8 text-center md:text-right"><div className="relative h-28 w-28 md:h-36 md:w-36 bg-[#0a1428] rounded-2xl flex items-center justify-center text-6xl shadow-2xl border-2 border-yellow-400 shrink-0">{statsData.topScorer?.imageUrl ? <img src={statsData.topScorer.imageUrl} className="h-full w-full object-cover" /> : <span>👑</span>}</div><div className="flex flex-col justify-center mt-4 md:mt-0"><h3 className="text-yellow-400 font-black text-sm mb-2"><Trophy className="h-5 w-5 inline" /> هداف البطولة</h3><div className="text-4xl md:text-6xl font-black text-white pb-1">{statsData.topScorer?.player || "في الانتظار..."}</div><div className="text-cyan-300 font-bold mt-2 text-xl">{statsData.topScorer?.team || "—"}</div></div></div><div className="text-center md:text-right bg-[#0a1428] px-10 py-6 rounded-3xl border border-yellow-400/20 shadow-inner"><div className="text-6xl md:text-7xl font-black text-yellow-400">{statsData.topScorer?.goals || 0}</div><div className="text-sm text-white font-bold uppercase mt-2">أهداف مسجلة</div></div></div></Card>
          </div>
        )}

        {/* 5. تبويب البث المباشر */}
        {activeTab === "live" && (
          <Card className="rounded-3xl border-2 border-yellow-400/50 bg-[#13213a] shadow-xl"><CardHeader className="text-center border-b border-white/5"><div className="flex justify-center items-center gap-2 mb-2"><span className="animate-ping absolute h-3 w-3 rounded-full bg-cyan-400"></span><span className="text-cyan-400 font-black uppercase">Live Now</span></div><CardTitle className="text-3xl font-black text-white">المباريات الجارية</CardTitle></CardHeader><CardContent className="p-6 grid gap-6">{liveMatches.length > 0 ? liveMatches.map(match => { const isStartingSoon = match.status === "ستبدأ بعد قليل"; return (<div key={match.id} className={`relative rounded-3xl bg-gradient-to-r from-[#1e2a4a] to-[#25345a] border-2 ${isStartingSoon ? 'border-cyan-500/80 shadow-[0_0_30px_rgba(34,211,238,0.2)]' : 'border-white/10'} p-8 overflow-hidden`}><div className={`absolute top-0 inset-x-0 text-white text-center py-1 text-sm font-bold shadow-md ${isStartingSoon ? 'bg-cyan-500 text-black' : 'bg-yellow-400 text-black'}`}><span>{match.status} {!isStartingSoon && match.status !== "استراحة" && match.status !== "انتهت" && ` - الدقيقة ${match.liveMinute}'`}</span></div><div className="mt-6 flex justify-between items-center gap-6"><div className="flex-1 text-center md:text-right font-bold text-xl sm:text-2xl text-white">{match.teamA}</div><div className="flex items-center gap-6 bg-[#0a1428] px-8 py-4 rounded-3xl border border-white/5 shadow-inner"><span className="text-4xl sm:text-6xl font-black text-white">{match.homeGoals}</span><span className="text-2xl sm:text-3xl text-yellow-400 font-black">:</span><span className="text-4xl sm:text-6xl font-black text-white">{match.awayGoals}</span></div><div className="flex-1 text-center md:text-left font-bold text-xl sm:text-2xl text-white">{match.teamB}</div></div></div>)}) : <div className="py-20 text-center"><p className="text-xl text-white font-bold">لا توجد مباريات جارية حالياً</p></div>}</CardContent></Card>
        )}
        
        {/* فوتر حقوق الملكية واسم المطور */}
        <div className="mt-16 border-t border-white/5 pt-6 pb-2 flex flex-col items-center justify-center text-center">
           <div className="text-gray-400 text-sm font-bold flex items-center gap-2">
              <span>إعداد وتطوير</span>
              <Badge className="bg-[#13213a] text-yellow-400 border border-yellow-400/20 px-3 py-1 font-black text-sm hover:scale-105 transition-transform cursor-default shadow-md">فتحي هيرو 🦅</Badge>
           </div>
           <div className="text-cyan-300 text-[10px] mt-2 opacity-60 font-bold tracking-wider">جميع الحقوق محفوظة © 2026 لبطولة كأس مطروح</div>
        </div>

      </div>

      {!isSubscribed && (
        <button onClick={handleSubscribe} className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-50 bg-yellow-400 text-black px-5 py-3 rounded-full font-black shadow-[0_0_20px_rgba(250,204,21,0.4)] flex items-center gap-3 hover:scale-105 transition-transform animate-bounce border-2 border-black">
          <BellRing className="h-6 w-6" /><span className="hidden sm:inline text-sm">تفعيل الإشعارات</span>
        </button>
      )}
    </div>
  );
}
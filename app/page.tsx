"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { 
  Loader2, Calendar, Clock, Trophy, Target, Shield, 
  ShieldAlert, Zap, BellRing, Play, Star, Search, Gift, Video 
} from "lucide-react";
import { TEAM_NAMES, INITIAL_MATCHES } from "@/data/tournament";
import { collection, onSnapshot, doc, setDoc, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

function formatTime12(time24: string): string {
  if (!time24) return "—";
  const [hours, minutes] = time24.split(":").map(Number);
  const period = hours >= 12 ? "م" : "ص";
  return `${hours % 12 || 12}:${minutes.toString().padStart(2, "0")} ${period}`;
}

const getYoutubeId = (url: string) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url?.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

const STANDINGS_HEADERS = ["#", "الفريق", "لعب", "ف", "ت", "خ", "له", "عليه", "فارق", "نقاط"];
const cleanTeamString = (name: any) => String(name || "").replace(/النجيلّة/g, "النجيلة").replace(/علّوش/g, "علوش").trim();
const CLEANED_TEAM_NAMES = Array.from(new Set(TEAM_NAMES.map(t => cleanTeamString(t))));

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

  // 🔴 خصم 3 نقاط إدارياً من فريق "17 فبراير"
  const penalizedTeam = table.get(normalizeTeamName("17 فبراير"));
  if (penalizedTeam) {
    penalizedTeam.points -= 3;
  }

  return Array.from(table.values()).map(row => ({ ...row, gd: row.gf - row.ga })).sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.team.localeCompare(b.team, "ar")).map((row, i) => ({ ...row, rank: i + 1 }));
}

function zoneColor(rank: number) { return rank <= 8 ? "bg-emerald-500 text-white" : rank <= 24 ? "bg-sky-400 text-white" : "bg-rose-500 text-white"; }
function sortMatches(arr: any[]) { return [...arr].sort((a, b) => { if (a.date !== b.date) return b.date.localeCompare(a.date); return (b.time || "00:00").localeCompare(a.time || "00:00"); }); }

export default function Page() {
  const [matches, setMatches] = useState<any[]>([]);
  const [goalEvents, setGoalEvents] = useState<any[]>([]);
  const [cardEvents, setCardEvents] = useState<any[]>([]);
  const [mediaItems, setMediaItems] = useState<any[]>([]);
  const [motmList, setMotmList] = useState<any[]>([]);
  const [tickerText, setTickerText] = useState("مطروح الرياضية...");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("standings");
  const [isSubscribed, setIsSubscribed] = useState(false);
  
  const [predForms, setPredForms] = useState<Record<string, any>>({});
  const [predictedMatches, setPredictedMatches] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) { if (Notification.permission === "granted") setIsSubscribed(true); }
    const stored = localStorage.getItem('predictedMatches');
    if (stored) setPredictedMatches(JSON.parse(stored));

    const unsubMatches = onSnapshot(collection(db, "matches"), (snap) => {
      setMatches(snap.docs.map(doc => ({ id: doc.id, ...doc.data(), teamA: cleanTeamString(doc.data().teamA || doc.data().home), teamB: cleanTeamString(doc.data().teamB || doc.data().away) })));
      setLoading(false);
    });
    const unsubGoals = onSnapshot(collection(db, "goals"), (snap) => setGoalEvents(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubCards = onSnapshot(collection(db, "cards"), (snap) => setCardEvents(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubMedia = onSnapshot(collection(db, "media"), (snap) => setMediaItems(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubMotm = onSnapshot(collection(db, "motm"), (snap) => setMotmList(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubTicker = onSnapshot(doc(db, "settings", "ticker"), (snap) => setTickerText(snap.data()?.text || "مطروح الرياضية..."));

    return () => { unsubMatches(); unsubGoals(); unsubCards(); unsubMedia(); unsubMotm(); unsubTicker(); };
  }, []);

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
    await addDoc(collection(db, "predictions"), { matchId: match.id, matchName: `${match.teamA} vs ${match.teamB}`, name: form.name, phone: form.phone, homeScore: form.home, awayScore: form.away, timestamp: new Date().toISOString() });
    const newPred = { ...predictedMatches, [match.id]: true };
    setPredictedMatches(newPred); localStorage.setItem('predictedMatches', JSON.stringify(newPred));
    alert("✅ تم إرسال توقعك بنجاح!");
  };

  const renderPredictionSection = (match: any) => {
    return (
      <div className="mt-5 pt-5 border-t border-white/10">
        <h4 className="text-sm font-black text-yellow-400 mb-4 text-center flex items-center justify-center gap-1"><Gift className="h-4 w-4"/> مسابقة التوقعات: توقع واربح!</h4>
        {!predictedMatches[match.id] ? (
          <div className="space-y-3 bg-[#0a1428] p-4 rounded-2xl border border-yellow-400/20 shadow-inner">
            <div className="grid grid-cols-2 gap-3">
               <Input placeholder="الاسم الثلاثي" className="bg-[#1e2a4a] border-none text-white text-xs h-10" onChange={(e) => setPredForms({...predForms, [match.id]: {...predForms[match.id], name: e.target.value}})} />
               <Input placeholder="رقم الهاتف" type="tel" className="bg-[#1e2a4a] border-none text-white text-xs h-10 font-mono" onChange={(e) => setPredForms({...predForms, [match.id]: {...predForms[match.id], phone: e.target.value}})} />
            </div>
            <div className="flex items-center justify-center gap-4 bg-[#13213a] p-3 rounded-xl border border-white/5">
               <div className="text-xs text-cyan-300 font-bold w-20 text-left">{match.teamA}</div>
               <Input type="number" placeholder="0" className="w-16 text-center bg-[#1e2a4a] border-yellow-400/50 text-white font-black text-lg h-12" onChange={(e) => setPredForms({...predForms, [match.id]: {...predForms[match.id], home: e.target.value}})} />
               <span className="text-yellow-400 font-black">-</span>
               <Input type="number" placeholder="0" className="w-16 text-center bg-[#1e2a4a] border-yellow-400/50 text-white font-black text-lg h-12" onChange={(e) => setPredForms({...predForms, [match.id]: {...predForms[match.id], away: e.target.value}})} />
               <div className="text-xs text-cyan-300 font-bold w-20 text-right">{match.teamB}</div>
            </div>
            <Button onClick={() => submitPrediction(match)} className="w-full bg-yellow-400 text-black font-black text-sm h-12 mt-2 hover:scale-[1.02] transition-transform">إرسال التوقع 🚀</Button>
          </div>
        ) : (
          <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-2xl text-center">
             <p className="text-emerald-400 font-black text-sm">✅ تم تسجيل توقعك بنجاح!</p>
             <p className="text-gray-400 text-xs mt-1 font-bold">حظ سعيد! سيتم التواصل مع الفائزين.</p>
          </div>
        )}
      </div>
    );
  };

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
  const tomorrowStr = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });

  const liveMatches = sortMatches(matches.filter(m => m.isLive === true));
  const finishedMatches = sortMatches(matches.filter(m => !m.isLive && (m.status === "انتهت" || m.date < todayStr)));
  const todayMatches = sortMatches(matches.filter(m => !m.isLive && m.date === todayStr && m.status !== "انتهت"));
  const tomorrowMatches = sortMatches(matches.filter(m => !m.isLive && m.date === tomorrowStr && m.status !== "انتهت"));

  const standings = useMemo(() => buildStandings(finishedMatches, CLEANED_TEAM_NAMES), [finishedMatches]);
  
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
    const sortedByAttack = [...standings].sort((a, b) => b.gf - a.gf);
    const sortedByDef = [...standings].sort((a, b) => a.ga - b.ga);
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
  }, [finishedMatches, standings, cardEvents, scorers]);

  const cardsList = useMemo(() => {
    const map = new Map<string, any>();
    cardEvents.forEach(e => { const key = `${e.player}__${normalizeTeamName(e.team)}`; if (!map.has(key)) map.set(key, { player: e.player, team: e.team, yellow: 0, red: 0 }); const item = map.get(key)!; item.yellow += Number(e.yellow) || 0; item.red += Number(e.red) || 0; });
    return Array.from(map.values()).map(row => ({ ...row, status: row.red > 0 ? "طرد" : row.yellow >= 3 ? "إيقاف" : "متاح" })).sort((a, b) => b.red - a.red || b.yellow - a.yellow);
  }, [cardEvents]);

  if (loading) return <div className="min-h-screen bg-[#0a1428] flex items-center justify-center"><Loader2 className="h-16 w-16 animate-spin text-yellow-400" /></div>;

  return (
    <div dir="rtl" className="min-h-screen bg-[#0a1428] text-white relative pb-20">
      <div className="mx-auto max-w-7xl p-3 sm:p-4 md:p-6 lg:p-8">

        {/* شريط آخر تحديث */}
        <div className="mb-4 rounded-3xl border border-yellow-400/50 bg-[#13213a] p-4 flex items-center gap-4">
          <span className="shrink-0 rounded-2xl bg-yellow-400 px-5 py-2 text-sm font-black text-black">آخر تحديث</span>
          <div className="flex-1 overflow-hidden"><div className="animate-marquee whitespace-nowrap text-lg font-bold text-yellow-300">{tickerText}</div></div>
        </div>

        {/* شريط الرعاة */}
        <style dangerouslySetInnerHTML={{__html: `@keyframes infinite-scroll-rtl { 0% { transform: translateX(0); } 100% { transform: translateX(50%); } } .sponsor-track { display: flex; width: max-content; animation: infinite-scroll-rtl 40s linear infinite; } .sponsor-track:hover { animation-play-state: paused; }`}} />
        <div className="mb-6 bg-[#13213a] py-3 rounded-2xl border border-yellow-400/20 overflow-hidden relative shadow-sm" dir="rtl">
          <div className="sponsor-track items-center gap-10">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center gap-10">
                <span className="text-yellow-400/60 font-bold tracking-widest text-[10px] px-2 border-l border-white/10 uppercase">شركاء النجاح</span>
                {[
                  { name: "الفهد للديكور", src: "/alfahd.png" }, { name: "أحمد عبدالعاطي المحامي", src: "/abdelaty.png" }, { name: "دثار للزي العربي", src: "/dithar.png" },
                  { name: "معصرة فرجينيا", src: "/virginia.png" }, { name: "دبي للزي العربي", src: "/dubai.png" }, { name: "معرض الأمانة", src: "/alamana.png" },
                  { name: "تراث البادية", src: "/torath.png" }, { name: "عبدالمقصود ستورز", src: "/abdelmaksoud.png" }, { name: "مياة حياة", src: "/hayah.png" },
                  { name: "القدس للأثاث", src: "/alquds.png" }, { name: "أيس كريم الملكة", src: "/almaleka.png" }, { name: "جزارة عبدالله الجراري", src: "/aljarari.png" },
                  { name: "M MART", src: "/mmart.png" }, { name: "هيرو سبورت", src: "/hero-sport.png" }, { name: "الفتح للفراشة", src: "/alfath.png" }, { name: "عادل العميري للديكور", src: "/alomairy.png" }
                ].map((sponsor, idx) => (
                  <img key={idx} src={sponsor.src} alt={sponsor.name} title={sponsor.name} className="h-10 w-24 object-contain drop-shadow-sm transition-transform hover:scale-110 cursor-pointer" onError={(e) => (e.currentTarget.style.display = 'none')} />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* الهيدر */}
        <div className="mb-8 rounded-3xl border border-yellow-400/40 bg-gradient-to-br from-[#1e2a4a] to-[#13213a] p-6 text-center shadow-2xl">
          <div className="flex justify-center mb-6"><img src="/logo.png" alt="شعار البطولة" className="h-28 sm:h-36 w-auto" /></div>
          <h1 className="text-4xl sm:text-6xl font-black text-yellow-300 tracking-tight">بطولة كأس مطروح</h1>
          <p className="mt-3 text-2xl text-cyan-300">النسخة الثالثة ٢٠٢٦</p>
        </div>

        {/* أزرار التبويبات */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {[
            { key: "live", label: "مباشر", icon: "🔴" }, { key: "stats", label: "إحصائيات", icon: "📊" }, { key: "motm_tab", label: "رجل المباراة", icon: "🌟" }, 
            { key: "today", label: "اليوم", icon: "📅" }, { key: "tomorrow", label: "غداً", icon: "📆" }, { key: "all", label: "النتائج", icon: "⚽" }, 
            { key: "standings", label: "الترتيب", icon: "📊" }, { key: "scorers", label: "الهدافين", icon: "🥇" }, { key: "cards", label: "الكروت", icon: "🟨" }, { key: "media", label: "ميديا", icon: "🎥" }
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex-1 sm:flex-none px-5 py-3.5 rounded-2xl font-bold text-sm transition-all border border-yellow-400/30 ${activeTab === tab.key ? "bg-yellow-400 text-black shadow-lg scale-105" : "bg-[#1e2a4a] text-white hover:bg-[#25345a]"}`}>
              <span className={`text-lg ${tab.key === "live" && activeTab === "live" ? "animate-pulse" : ""}`}>{tab.icon}</span> <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* 1. تبويب رجل المباراة (MOTM) */}
        {activeTab === "motm_tab" && (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {motmList.length > 0 ? motmList.map((m, i) => (
              <div key={i} className="group relative">
                <div className="bg-[#13213a] rounded-t-3xl p-4 border-x border-t border-yellow-400/30 flex items-center justify-between">
                   <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">رجل المباراة برعاية</div>
                   <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-white">{m.sponsorName}</span>
                      <img src={m.sponsorLogo} className="h-6 w-6 object-contain" />
                   </div>
                </div>
                <div className="relative aspect-square overflow-hidden border-x border-yellow-400/50 p-2 bg-gradient-to-b from-[#13213a] to-[#0a1428]">
                   <div className="absolute inset-0 border-[6px] border-yellow-400/20 z-10 pointer-events-none"></div>
                   <img src={m.imageUrl} className="w-full h-full object-cover rounded-xl shadow-2xl transition-transform group-hover:scale-105" />
                </div>
                <div className="bg-yellow-400 text-black rounded-b-3xl p-4 text-center border-x border-b border-yellow-400 shadow-xl">
                   <div className="text-2xl font-black">{m.player}</div>
                   <div className="text-sm font-bold opacity-80">{m.team}</div>
                </div>
              </div>
            )) : <p className="text-center col-span-full py-20 text-gray-500 font-bold">انتظروا جوائز النجوم بعد كل مباراة! 🌟</p>}
          </div>
        )}

        {/* 2. تبويب الميديا */}
        {activeTab === "media" && (
          <div className="space-y-12">
            <div>
               <h2 className="text-3xl font-black text-yellow-400 mb-6 flex items-center gap-2"><Play /> المركز الإعلامي</h2>
               {mediaItems.length > 0 ? (
                 <div className="grid gap-6 md:grid-cols-2">
                   {mediaItems.map(item => {
                     const yId = getYoutubeId(item.url);
                     return yId ? (
                       <Card key={item.id} className="bg-[#1e2a4a] border-emerald-500/30 rounded-3xl overflow-hidden p-4">
                         <h3 className="text-xl font-bold text-white mb-4 text-center">{item.title}</h3>
                         <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-white/10 shadow-lg">
                           <iframe className="absolute top-0 left-0 w-full h-full" src={`https://www.youtube.com/embed/${yId}`} frameBorder="0" allowFullScreen></iframe>
                         </div>
                       </Card>
                     ) : null;
                   })}
                 </div>
               ) : <p className="text-center text-gray-500 py-10 font-bold">لا توجد فيديوهات حالياً</p>}
            </div>
          </div>
        )}

        {/* 3. تبويب الإحصائيات */}
        {activeTab === "stats" && (
          <div className="space-y-8">
            {topMotmPlayer && (
              <Card className="bg-gradient-to-r from-emerald-600 to-teal-800 border-none p-8 rounded-3xl text-center shadow-2xl relative overflow-hidden">
                 <Star className="absolute -left-4 -top-4 h-32 w-32 text-white/10 rotate-12" />
                 <h3 className="text-white font-black text-xl mb-4 relative z-10">🌟 ملك جوائز رجل المباراة</h3>
                 <div className="text-5xl font-black text-yellow-300 mb-2 relative z-10">{topMotmPlayer.name}</div>
                 <div className="text-white text-xl opacity-90 mb-4 relative z-10">{topMotmPlayer.team}</div>
                 <Badge className="bg-black text-yellow-400 px-6 py-2 text-lg relative z-10">حصل على الجائزة {topMotmPlayer.count} مرات</Badge>
              </Card>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { label: "الأهداف المسجلة", val: statsData.totalGoals, icon: "⚽", color: "text-yellow-400", sub: `${statsData.goalsPerMatch} هدف / مباراة` },
                { label: "مباريات ملعوبة", val: statsData.totalMatches, icon: "🏟️", color: "text-cyan-400", sub: "إجمالي المباريات" },
                { label: "تعادل سلبي", val: statsData.draws00, icon: "🤝", color: "text-gray-400", sub: `بنسبة ${statsData.draws00Percent}%` },
                { label: "تعادل إيجابي", val: statsData.drawsPositive, icon: "🔥", color: "text-emerald-400", sub: `بنسبة ${statsData.drawsPosPercent}%` },
                { label: "إنذار أصفر", val: statsData.totalYellow, icon: "🟨", color: "text-yellow-500", sub: `${statsData.yellowPerMatch} إنذار / مباراة` },
                { label: "حالة طرد", val: statsData.totalRed, icon: "🟥", color: "text-red-500", sub: `${statsData.redPerMatch} طرد / مباراة` },
              ].map((s, i) => (
                <Card key={i} className="bg-[#13213a] border-white/5 text-center p-4 relative overflow-hidden group">
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-white/5 group-hover:bg-yellow-400/50 transition-all"></div>
                  <div className="text-2xl mb-2 opacity-80">{s.icon}</div>
                  <div className={`text-4xl font-black ${s.color} drop-shadow-md`}>{s.val}</div>
                  <div className="text-xs text-gray-400 font-bold mt-2 uppercase">{s.label}</div>
                  <Badge className="mt-2 bg-black/40 text-gray-300 border-none font-bold text-[10px]">{s.sub}</Badge>
                </Card>
              ))}
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
               <Card className="bg-[#13213a] border-yellow-400/20 p-6 text-center shadow-lg"><Target className="mx-auto mb-4 text-emerald-400 h-10 w-10" /><h4 className="text-gray-400 text-sm font-bold mb-2">أقوى هجوم</h4><div className="text-xl font-black text-white">{statsData.bestAttack?.team || "—"}</div><Badge className="mt-2 bg-emerald-500/10 text-emerald-400 border-none">{statsData.bestAttack?.gf || 0} هدف</Badge></Card>
               <Card className="bg-[#13213a] border-yellow-400/20 p-6 text-center shadow-lg"><Zap className="mx-auto mb-4 text-rose-400 h-10 w-10" /><h4 className="text-gray-400 text-sm font-bold mb-2">أضعف هجوم</h4><div className="text-xl font-black text-white">{statsData.worstAttack?.team || "—"}</div><Badge className="mt-2 bg-rose-500/10 text-rose-400 border-none">{statsData.worstAttack?.gf || 0} هدف</Badge></Card>
               <Card className="bg-[#13213a] border-yellow-400/20 p-6 text-center shadow-lg"><Shield className="mx-auto mb-4 text-cyan-400 h-10 w-10" /><h4 className="text-gray-400 text-sm font-bold mb-2">أقوى دفاع</h4><div className="text-xl font-black text-white">{statsData.bestDefense?.team || "—"}</div><Badge className="mt-2 bg-cyan-500/10 text-cyan-400 border-none">استقبل {statsData.bestDefense?.ga || 0}</Badge></Card>
               <Card className="bg-[#13213a] border-yellow-400/20 p-6 text-center shadow-lg"><ShieldAlert className="mx-auto mb-4 text-amber-500 h-10 w-10" /><h4 className="text-gray-400 text-sm font-bold mb-2">أضعف دفاع</h4><div className="text-xl font-black text-white">{statsData.worstDefense?.team || "—"}</div><Badge className="mt-2 bg-amber-500/10 text-amber-500 border-none">استقبل {statsData.worstDefense?.ga || 0}</Badge></Card>
            </div>

            <Card className="bg-gradient-to-r from-[#1e2a4a] to-[#13213a] border-2 border-yellow-400/50 p-6 md:p-10 rounded-3xl shadow-[0_0_40px_rgba(250,204,21,0.15)] relative overflow-hidden">
               <div className="absolute left-0 top-0 w-40 h-40 bg-yellow-400/10 rounded-full blur-3xl"></div>
               <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
                  <div className="flex flex-col md:flex-row items-center gap-8 text-center md:text-right">
                    <div className="relative">
                      <div className="absolute -inset-1 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-2xl blur opacity-60 animate-pulse"></div>
                      <div className="relative h-28 w-28 md:h-36 md:w-36 bg-[#0a1428] rounded-2xl flex items-center justify-center text-6xl shadow-2xl overflow-hidden border-2 border-yellow-400 shrink-0">
                        {statsData.topScorer?.imageUrl ? <img src={statsData.topScorer.imageUrl} alt={statsData.topScorer.player} className="h-full w-full object-cover" /> : <span>👑</span>}
                      </div>
                      <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-yellow-400 text-black text-xs font-black px-4 py-1 rounded-full shadow-lg border-2 border-[#1e2a4a]">الـهـداف</div>
                    </div>
                    <div className="flex flex-col justify-center mt-4 md:mt-0">
                      <h3 className="text-yellow-400 font-black text-sm uppercase tracking-widest mb-2 flex items-center justify-center md:justify-start gap-2"><Trophy className="h-5 w-5" /> هداف البطولة</h3>
                      <div className="text-4xl md:text-6xl font-black bg-gradient-to-r from-white via-yellow-100 to-yellow-500 bg-clip-text text-transparent drop-shadow-sm pb-1">{statsData.topScorer?.player || "في الانتظار..."}</div>
                      <div className="text-cyan-300 font-bold mt-2 text-xl bg-[#0a1428]/50 inline-block px-4 py-1 rounded-lg border border-cyan-500/20">{statsData.topScorer?.team || "—"}</div>
                    </div>
                  </div>
                  <div className="text-center md:text-right bg-[#0a1428] px-10 py-6 rounded-3xl border border-yellow-400/20 shadow-inner">
                    <div className="text-6xl md:text-7xl font-black text-yellow-400 drop-shadow-lg">{statsData.topScorer?.goals || 0}</div>
                    <div className="text-sm text-gray-400 font-bold uppercase mt-2 tracking-widest">أهداف مسجلة</div>
                  </div>
               </div>
            </Card>
          </div>
        )}

        {/* 4. تبويب البث المباشر */}
        {activeTab === "live" && (
          <Card className="rounded-3xl border-2 border-red-500/50 bg-[#13213a] shadow-[0_0_20px_rgba(239,68,68,0.2)]">
            <CardHeader className="text-center border-b border-white/5">
              <div className="flex justify-center items-center gap-2 mb-2"><span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span></span><span className="text-red-500 font-black tracking-widest uppercase">Live Now</span></div>
              <CardTitle className="text-3xl font-black text-white">المباريات الجارية</CardTitle>
            </CardHeader>
            <CardContent className="p-6 grid gap-6">
              {liveMatches.length > 0 ? liveMatches.map(match => {
                const isStartingSoon = match.status === "ستبدأ بعد قليل";
                return (
                <div key={match.id} className={`relative rounded-3xl bg-gradient-to-r from-[#1e2a4a] to-[#25345a] border-2 ${isStartingSoon ? 'border-emerald-500/80 shadow-[0_0_30px_rgba(16,185,129,0.2)]' : 'border-white/10'} p-8 overflow-hidden`}>
                  <div className={`absolute top-0 inset-x-0 text-white text-center py-1 text-sm font-bold shadow-md flex justify-center items-center gap-2 ${isStartingSoon ? 'bg-emerald-500' : 'bg-red-600'}`}>
                     <span className={match.status !== "انتهت" && match.status !== "استراحة" && !isStartingSoon ? "animate-pulse" : ""}>
                        {match.status || "جارية الآن"} 
                        {!isStartingSoon && match.status !== "استراحة" && match.status !== "انتهت" && match.status !== "ضربات جزاء" && ` - الدقيقة ${match.liveMinute || 0}'`}
                     </span>
                  </div>
                  <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex-1 text-center md:text-right">
                      <div className="flex items-center justify-center md:justify-end gap-2 mb-2"><div className="text-2xl font-bold text-white">{match.teamA}</div>{match.redCardsHome > 0 && Array.from({length: match.redCardsHome}).map((_, i) => <div key={i} className="w-4 h-5 bg-red-600 rounded-sm border border-white/50 shadow-sm" title="طرد"></div>)}</div>
                    </div>
                    <div className="flex items-center gap-6 bg-[#0a1428]/50 px-8 py-4 rounded-3xl border border-white/5 shadow-inner"><span className="text-6xl font-black text-white drop-shadow-lg">{match.homeGoals}</span><span className="text-3xl text-yellow-400 font-black">:</span><span className="text-6xl font-black text-white drop-shadow-lg">{match.awayGoals}</span></div>
                    <div className="flex-1 text-center md:text-left">
                      <div className="flex items-center justify-center md:justify-start gap-2 mb-2 flex-row-reverse md:flex-row">{match.redCardsAway > 0 && Array.from({length: match.redCardsAway}).map((_, i) => <div key={i} className="w-4 h-5 bg-red-600 rounded-sm border border-white/50 shadow-sm" title="طرد"></div>)}<div className="text-2xl font-bold text-white">{match.teamB}</div></div>
                    </div>
                  </div>
                  {(match.status === "ضربات جزاء" || (match.penaltiesHome && match.penaltiesHome.length > 0)) && (
                     <div className="mt-8 border-t border-white/10 pt-6">
                        <div className="text-center text-sm text-yellow-400 font-bold mb-3 uppercase tracking-widest">نتيجة ركلات الترجيح</div>
                        <div className="flex justify-center items-center gap-6">
                           <div className="flex gap-1.5 flex-row-reverse">{(match.penaltiesHome || []).map((p: string, i: number) => <div key={i} className={`w-3 h-3 rounded-full ${p === 'scored' ? 'bg-emerald-500' : p === 'missed' ? 'bg-red-500' : 'bg-gray-600'}`}></div>)}</div>
                           <div className="text-2xl font-black text-white bg-black/40 px-4 py-1 rounded-xl">({(match.penaltiesHome || []).filter((p:string) => p === 'scored').length}) <span className="text-gray-500 mx-2">-</span> ({(match.penaltiesAway || []).filter((p:string) => p === 'scored').length})</div>
                           <div className="flex gap-1.5">{(match.penaltiesAway || []).map((p: string, i: number) => <div key={i} className={`w-3 h-3 rounded-full ${p === 'scored' ? 'bg-emerald-500' : p === 'missed' ? 'bg-red-500' : 'bg-gray-600'}`}></div>)}</div>
                        </div>
                     </div>
                  )}
                </div>
              )}) : <div className="py-20 text-center"><Calendar className="h-16 w-16 text-gray-600 mx-auto mb-4 opacity-20" /><p className="text-xl text-gray-500 font-bold">لا توجد مباريات جارية في الوقت الحالي</p></div>}
            </CardContent>
          </Card>
        )}

        {/* 5. تبويب الترتيب */}
        {activeTab === "standings" && (
          <Card className="rounded-3xl border border-yellow-400/30 bg-[#13213a]">
            <CardHeader><CardTitle className="text-yellow-300 flex items-center gap-3"><Trophy className="h-7 w-7" /> جدول الترتيب</CardTitle></CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-320px)]"><table className="w-full text-white text-right"><thead className="sticky top-0 bg-[#13213a] border-b border-yellow-400/30"><tr>{STANDINGS_HEADERS.map(h => (<th key={h} className="px-4 py-4 font-bold text-cyan-300 text-sm">{h}</th>))}</tr></thead><tbody>{standings.map(row => (<tr key={row.team} className="border-b border-yellow-400/10 hover:bg-white/5 transition-colors"><td className="px-4 py-4"><Badge className={zoneColor(row.rank)}>{row.rank}</Badge></td><td className="px-4 py-4 font-bold text-white">{row.team}</td><td className="px-4 py-4 text-center">{row.played}</td><td className="px-4 py-4 text-center text-yellow-300 font-black">{row.wins}</td><td className="px-4 py-4 text-center">{row.draws}</td><td className="px-4 py-4 text-center">{row.losses}</td><td className="px-4 py-4 text-center text-emerald-400">{row.gf}</td><td className="px-4 py-4 text-center text-rose-400">{row.ga}</td><td className="px-4 py-4 text-center text-cyan-300">{row.gd}</td><td className="px-4 py-4 font-black text-yellow-300 text-center text-lg">{row.points}</td></tr>))}</tbody></table></ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* 6. تبويب النتائج السابقة */}
        {activeTab === "all" && (
           <Card className="rounded-3xl border border-yellow-400/30 bg-[#13213a]">
             <CardHeader className="flex flex-col sm:flex-row justify-between items-center gap-4">
               <div>
                  <CardTitle className="text-yellow-300">النتائج السابقة</CardTitle>
                  <Badge className="bg-cyan-500 mt-2 font-bold text-white">إجمالي المباريات الملعوبة: {finishedMatches.length}</Badge>
               </div>
               <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
                  <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث عن فريق..." className="pr-10 bg-[#1e2a4a] border-yellow-400 text-white rounded-xl" />
               </div>
             </CardHeader>
             <CardContent className="p-6 grid gap-4 md:grid-cols-2">
               {finishedMatches.filter(m => !search || m.teamA.includes(search) || m.teamB.includes(search)).map(match => (
                 <div key={match.id} className="bg-[#1e2a4a] p-6 rounded-3xl border border-white/5 text-center hover:border-yellow-400/50 transition-all">
                    <div className="text-cyan-300 text-xs mb-3 font-bold">{match.date} • {match.round}</div>
                    <div className="grid grid-cols-3 items-center">
                       <div className="font-bold text-white">{match.teamA}</div>
                       <div className="text-4xl font-black text-yellow-400">{match.homeGoals} - {match.awayGoals}</div>
                       <div className="font-bold text-white">{match.teamB}</div>
                    </div>
                 </div>
               ))}
             </CardContent>
           </Card>
        )}

        {/* 7. تبويب اليوم (مع التوقعات) */}
        {activeTab === "today" && (
           <Card className="rounded-3xl border border-yellow-400/30 bg-[#13213a]"><CardHeader className="text-center border-b border-yellow-400/30"><Badge className="bg-yellow-400 text-black text-lg px-6 py-2.5">اليوم • {todayStr}</Badge><CardTitle className="text-3xl sm:text-4xl font-black text-yellow-300 mt-4">مباريات اليوم القادمة</CardTitle></CardHeader><CardContent className="p-6 grid gap-6">{todayMatches.length > 0 ? todayMatches.map(match => (<div key={match.id} className="rounded-3xl border border-yellow-400/30 bg-[#1e2a4a] p-6 hover:border-yellow-400 transition-all"><div className="text-center mb-6"><div className="text-cyan-300">{match.dayName} • {match.date}</div><div className="flex items-center justify-center gap-2 text-yellow-300 mt-2"><Clock className="h-5 w-5" /><span className="text-2xl font-bold">{formatTime12(match.time)}</span></div></div><div className="flex items-center justify-center gap-6 text-2xl font-bold"><div className="flex-1 text-center">{match.teamA}</div><div className="text-yellow-400 font-black">VS</div><div className="flex-1 text-center">{match.teamB}</div></div>{renderPredictionSection(match)}</div>)) : <p className="text-center py-10 text-cyan-300 font-bold">لا توجد مباريات قادمة اليوم</p>}</CardContent></Card>
        )}

        {/* 8. تبويب غداً (مع التوقعات) */}
        {activeTab === "tomorrow" && (
           <Card className="rounded-3xl border border-yellow-400/30 bg-[#13213a]"><CardHeader><CardTitle className="text-yellow-300 flex items-center gap-3"><Calendar className="h-8 w-8" /> مباريات غداً • {tomorrowStr}</CardTitle></CardHeader><CardContent className="p-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">{tomorrowMatches.map(match => (<div key={match.id} className="rounded-3xl border border-yellow-400/30 bg-[#1e2a4a] p-6 text-center hover:border-yellow-400 transition-all"><div className="text-cyan-300 mb-4">{formatTime12(match.time)}</div><div className="font-bold text-2xl text-white mb-4">{match.teamA}</div><div className="text-5xl font-black text-yellow-400 mb-4">VS</div><div className="font-bold text-2xl text-white">{match.teamB}</div>{renderPredictionSection(match)}</div>))}</CardContent></Card>
        )}

        {/* 9. تبويب الهدافين */}
        {activeTab === "scorers" && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {scorers.map((player, i) => (
              <Card key={i} className={`bg-[#1e2a4a] border-yellow-400/30 rounded-3xl relative overflow-hidden ${i === 0 ? "border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.2)] scale-[1.02] transform transition-transform" : ""}`}>
                {i === 0 && <div className="absolute top-0 right-0 bg-yellow-400 text-black text-[10px] font-black px-3 py-1 rounded-bl-lg z-10">المركز الأول 👑</div>}
                <CardContent className="p-6 flex justify-between items-center">
                  <div className="flex items-center gap-4">{player.imageUrl ? <div className="relative"><img src={player.imageUrl} className={`rounded-full object-cover border-2 shadow-md ${i === 0 ? 'border-yellow-400 h-16 w-16' : 'border-white/20 h-12 w-12'}`} /></div> : <div className={`rounded-full bg-[#0a1428] flex items-center justify-center text-2xl ${i === 0 ? 'h-16 w-16 border-2 border-yellow-400' : 'h-12 w-12'}`}>👤</div>}<div><h3 className={`font-bold text-white ${i === 0 ? 'text-2xl text-yellow-300' : 'text-xl'}`}>{player.player}</h3><p className="text-cyan-300">{player.team}</p></div></div>
                  <Badge className={`text-black text-3xl px-6 py-3 font-black ${i === 0 ? 'bg-gradient-to-r from-yellow-300 to-yellow-500 scale-110' : 'bg-yellow-400'}`}>{player.goals}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* 10. تبويب الكروت */}
        {activeTab === "cards" && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {cardsList.filter(c => c.yellow > 0 || c.red > 0).map((item, i) => (
              <Card key={i} className="bg-[#1e2a4a] border-yellow-400/30 rounded-3xl hover:border-yellow-400 transition-all">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start"><div><h3 className="font-bold text-xl text-white">{item.player}</h3><p className="text-cyan-300">{item.team}</p></div><Badge className={`${item.status === 'متاح' ? 'bg-emerald-500' : item.status === 'إيقاف' ? 'bg-amber-500' : 'bg-rose-500'} text-white font-bold text-sm px-3`}>{item.status}</Badge></div>
                  <div className="mt-4 flex gap-4"><Badge className="bg-yellow-400/20 text-yellow-300 px-4 py-2 font-bold text-lg">🟨 {item.yellow}</Badge><Badge className="bg-red-500/20 text-red-300 px-4 py-2 font-bold text-lg">🟥 {item.red}</Badge></div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

      </div>

      {!isSubscribed && (
        <button onClick={handleSubscribe} className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-50 bg-yellow-400 text-black px-5 py-3 rounded-full font-black shadow-[0_0_20px_rgba(250,204,21,0.4)] flex items-center gap-3 hover:scale-105 transition-transform animate-bounce border-2 border-black">
          <BellRing className="h-6 w-6" /><span className="hidden sm:inline text-sm">تفعيل الإشعارات</span>
        </button>
      )}
    </div>
  );
}
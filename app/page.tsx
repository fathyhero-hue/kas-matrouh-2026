"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Loader2, Clock, Trophy, Target, Shield, 
  ShieldAlert, Zap, BellRing, Play, Star, Search, Gift, Maximize, Minimize, Activity, Users, Calendar, Archive, Settings, CheckCircle2, BellOff, ClipboardList, Lock, Unlock, Phone, RefreshCw
} from "lucide-react";
import { TEAM_NAMES } from "@/data/tournament";
import { collection, onSnapshot, doc, setDoc, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const JUNIORS_GROUP_A = ["سيف الوادي", "ميلانو", "النجيلة", "كابتن تيكا", "اصدقاء عز بوالمجدوبة"];
const JUNIORS_GROUP_B = ["الاولمبي", "ابناء اكرامي", "غوط رباح", "اصدقاء مهدي", "وادي الرمل"];
const KNOCKOUT_ROUNDS = ["الملحق", "دور الستة عشر", "دور الثمانية", "نصف النهائي", "النهائي"];

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
}

const STANDINGS_HEADERS = ["#", "الفريق", "لعب", "ف", "ت", "خ", "له", "عليه", "فارق", "نقاط"];
const cleanTeamString = (name: any) => String(name || "").replace(/النجيلّة/g, "النجيلة").replace(/علّوش/g, "علوش").trim();
const CLEANED_TEAM_NAMES = Array.from(new Set(TEAM_NAMES.map(t => cleanTeamString(t))));
type StandingRow = { team: string; played: number; wins: number; draws: number; losses: number; gf: number; ga: number; gd: number; points: number; rank: number; };

function normalizeTeamName(name: string): string { 
    return String(name || "").trim().replace(/\s+/g, " ").replace(/أ|إ|آ/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/ـ/g, "").replace(/ّ/g, "").toLowerCase(); 
}

function buildStandings(matchRows: any[], allTeams: string[]) {
  const table = new Map<string, StandingRow>();
  allTeams.forEach(team => table.set(normalizeTeamName(team), { team, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: 0, points: 0, rank: 0 }));
  const groupMatches = matchRows.filter(m => !KNOCKOUT_ROUNDS.includes(m.round));
  groupMatches.forEach(match => {
    const hg = Number(match.homeGoals) ?? 0; const ag = Number(match.awayGoals) ?? 0;
    const hNorm = normalizeTeamName(match.home || match.teamA || ""); const aNorm = normalizeTeamName(match.away || match.teamB || "");
    let home = table.get(hNorm); let away = table.get(aNorm);
    if (home) { home.played++; home.gf += hg; home.ga += ag; if (hg > ag) { home.wins++; home.points += 3; } else if (hg === ag) { home.draws++; home.points++; } else { home.losses++; } }
    if (away) { away.played++; away.gf += ag; away.ga += hg; if (ag > hg) { away.wins++; away.points += 3; } else if (ag === hg) { away.draws++; away.points++; } else { away.losses++; } }
  });
  const penalizedTeam = table.get(normalizeTeamName("17 فبراير"));
  if (penalizedTeam) { penalizedTeam.points -= 3; }
  return Array.from(table.values()).map(row => ({ ...row, gd: row.gf - row.ga })).sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.team.localeCompare(b.team, "ar")).map((row, i) => ({ ...row, rank: i + 1 }));
}

function zoneColor(rank: number, tourneyType: string) { 
  if (tourneyType === 'juniors') return rank <= 4 ? "bg-emerald-500 text-white" : "bg-rose-500 text-white";
  return rank <= 8 ? "bg-emerald-500 text-white" : rank <= 24 ? "bg-cyan-500 text-white" : "bg-rose-500 text-white"; 
}

function sortMatchesAsc(arr: any[]) { return [...arr].sort((a, b) => { if (a.date !== b.date) return a.date.localeCompare(b.date); return (a.time || "00:00").localeCompare(b.time || "00:00"); }); }

const getWinnerData = (t1: string, t2: string, round: string, labelId: string, allMatchesArr: any[]) => {
  if (!t1 || !t2) return { win: null, match: null };
  let m = allMatchesArr.find(x => x.matchLabel === labelId);
  if (!m) { 
    m = allMatchesArr.find(x => x.round === round && (
      (normalizeTeamName(x.teamA) === normalizeTeamName(t1) && normalizeTeamName(x.teamB) === normalizeTeamName(t2)) || 
      (normalizeTeamName(x.teamA) === normalizeTeamName(t2) && normalizeTeamName(x.teamB) === normalizeTeamName(t1))
    )); 
  }
  if (!m || m.status !== "انتهت") return { win: null, match: m };
  let w = null;
  if (Number(m.homeGoals) > Number(m.awayGoals)) w = m.teamA;
  else if (Number(m.awayGoals) > Number(m.homeGoals)) w = m.teamB;
  else {
      const hPen = (m.penaltiesHome || []).filter((p:any)=>p==='scored').length;
      const aPen = (m.penaltiesAway || []).filter((p:any)=>p==='scored').length;
      if (hPen > aPen) w = m.teamA; else if (aPen > hPen) w = m.teamB;
  }
  return { win: w, match: m };
};

const TeamMatchDisplay = ({ teamName, logoUrl }: { teamName: string, logoUrl?: string }) => (
  <div className="flex-1 flex flex-col items-center gap-3">
    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#0a1428] border-2 border-white/10 flex items-center justify-center text-3xl shadow-inner overflow-hidden relative">
      {logoUrl ? (
        <img src={logoUrl} alt={teamName} className="w-full h-full object-contain p-1" />
      ) : (
        <Shield className="h-8 w-8 text-gray-500 opacity-50" />
      )}
    </div>
    <div className="text-center font-bold text-sm sm:text-xl text-white leading-tight">{teamName}</div>
  </div>
);

const renderMatchScore = (match: any) => {
  const isPlayed = match && match.status === "انتهت";
  const isLive = match && match.isLive;
  const hasGoals = match && match.homeGoals !== undefined && match.awayGoals !== undefined && match.homeGoals !== "" && match.awayGoals !== "";
  if (!isPlayed && !isLive && !hasGoals) return 'VS';

  const hPen = (match.penaltiesHome || []).filter((p:any)=>p==='scored').length;
  const aPen = (match.penaltiesAway || []).filter((p:any)=>p==='scored').length;
  const hasPenalties = hPen > 0 || aPen > 0 || match.status === "ضربات جزاء";

  return (
    <div className="flex flex-col items-center" dir="ltr">
      <span className="text-xl sm:text-3xl font-black text-white">{match.awayGoals || 0} - {match.homeGoals || 0}</span>
      {hasPenalties && <span className="text-[10px] sm:text-xs text-yellow-400 mt-1 font-bold bg-[#0a1428] px-2 py-0.5 rounded-full border border-yellow-400/30">({aPen} - {hPen} ر.ت)</span>}
    </div>
  );
};

const getAccurateLiveMinute = (match: any) => {
  const baseMinute = Number(match?.liveMinuteBase ?? match?.liveMinute ?? 0) || 0;
  const startedAt = Number(match?.timerStartedAt || 0);
  const pausedTotal = Number(match?.timerPausedTotal || 0) || 0;
  if (!match?.isTimerRunning || !startedAt) return Number(match?.liveMinute ?? baseMinute) || 0;
  const elapsed = Math.max(0, Date.now() - startedAt - pausedTotal);
  return baseMinute + Math.floor(elapsed / 60000);
};

// الدالة التي كانت مفقودة:
const getEventIcon = (type: string) => type === 'goal' ? '⚽' : type === 'yellow' ? '🟨' : type === 'red' ? '🟥' : '🎙️';

const TreeMatchBox = ({ label, t1, t2, data }: { label: string, t1: string, t2: string, data: any }) => {
  const { win, match } = data; const isPlayed = match && match.status === "انتهت"; const isLive = match && match.isLive;
  return (
    <div className={`bg-[#1e2a4a] rounded-2xl flex flex-col items-center justify-center p-4 border ${isLive ? 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse' : 'border-yellow-400/30'} shadow-lg relative min-h-[95px] transition-transform hover:scale-105`}>
      <Badge className="absolute -top-3 bg-yellow-400 text-black text-[11px] px-3 font-black border-2 border-[#0a1428] shadow-md">{label}</Badge>
      <div className="w-full flex justify-between items-center gap-2 mt-2">
        <div className={`flex-1 text-center font-bold text-[11px] sm:text-sm leading-tight ${win === t1 ? 'text-yellow-300 scale-105' : 'text-white'}`}>{t1}</div>
        <div className="bg-[#0a1428] border border-cyan-500/40 px-2 py-1 rounded-md text-cyan-400 shrink-0">
          {renderMatchScore(match)}
        </div>
        <div className={`flex-1 text-center font-bold text-[11px] sm:text-sm leading-tight ${win === t2 ? 'text-yellow-300 scale-105' : 'text-white'}`}>{t2}</div>
      </div>
      {win && <div className="mt-3 text-[11px] bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 px-4 py-1 rounded-full font-bold shadow-inner">صعد: {win}</div>}
      {isLive && <div className="mt-3 text-[10px] bg-red-500 text-white px-4 py-1 rounded-full font-bold">مباشر الآن 🔴</div>}
    </div>
  );
};

const MiniFutCard = ({ player, position }: { player: any, position: string }) => {
  const baseSize = "w-[74px] sm:w-[88px] md:w-[104px] lg:w-[118px]";
  if(!player || !player.name) return (
    <div className={`${baseSize} h-[112px] sm:h-[132px] md:h-[154px] lg:h-[172px] bg-[#0a1428]/70 border-2 border-dashed border-emerald-400/40 rounded-[1.4rem] flex flex-col items-center justify-center text-emerald-300/70 text-xs md:text-sm font-black shadow-inner backdrop-blur-sm transition-all hover:border-emerald-400/80`}>
      <span className="text-2xl mb-1 opacity-60">＋</span>{position}
    </div>
  );

  return (
    <div className={`relative ${baseSize} transition-transform duration-300 hover:scale-105 cursor-pointer z-10 hover:z-50 drop-shadow-[0_12px_22px_rgba(0,0,0,0.65)]`}>
      <div className="relative w-full rounded-[1.4rem] overflow-hidden border border-yellow-400/50 bg-gradient-to-b from-yellow-300/20 via-[#1e2a4a] to-[#07101f] shadow-[0_12px_28px_rgba(0,0,0,0.45)]">
        <div className="absolute inset-x-2 top-2 h-10 bg-gradient-to-r from-yellow-400/0 via-yellow-300/20 to-yellow-400/0 rounded-full blur-md"></div>
        <div className="relative w-full aspect-[4/4.9] bg-gradient-to-b from-[#101b32] to-[#050a14] border-b border-white/10">
          {player.imageUrl ? (
             <img src={player.imageUrl} className="w-full h-full object-contain object-center p-1.5 bg-[#050a14]" alt={player.name} loading="lazy" />
          ) : (
             <div className="w-full h-full flex items-center justify-center text-3xl opacity-30">👤</div>
          )}
          <div className="absolute top-1 left-1 flex flex-col items-center justify-center bg-gradient-to-br from-yellow-300 to-yellow-600 min-w-[28px] md:min-w-[34px] px-1.5 py-1 rounded-xl shadow-md border border-yellow-700/50">
             <span className="text-[10px] md:text-sm font-black text-black leading-none">{player.rating || 10}</span>
             <span className="text-[7px] md:text-[10px] font-black text-black leading-none uppercase mt-0.5">{position}</span>
          </div>
        </div>
        <div className="relative p-1.5 md:p-2 flex flex-col items-center justify-center w-full bg-gradient-to-b from-[#101b32] to-[#07101f]">
           <span className="text-[9px] sm:text-[10px] md:text-[12px] font-black text-white w-full text-center truncate mb-1 leading-tight" title={player.name}>{player.name}</span>
           <span className="bg-yellow-400/10 border border-yellow-400/25 text-yellow-300 text-[7px] md:text-[9px] font-bold px-1.5 py-0.5 rounded-lg text-center w-full truncate" title={player.team}>{player.team}</span>
        </div>
      </div>
    </div>
  );
};

export default function Page() {
  const [activeTournament, setActiveTournament] = useState<'youth' | 'juniors'>('youth'); 
  const [activeTab, setActiveTab] = useState<string>("standings");

  const [matches, setMatches] = useState<any[]>([]);
  const [goalEvents, setGoalEvents] = useState<any[]>([]);
  const [cardEvents, setCardEvents] = useState<any[]>([]);
  const [archivedCards, setArchivedCards] = useState<any[]>([]);
  const [mediaItems, setMediaItems] = useState<any[]>([]);
  const [mediaSubTab, setMediaSubTab] = useState<"news" | "videos">("news");
  const [motmList, setMotmList] = useState<any[]>([]);
  const [predictionsList, setPredictionsList] = useState<any[]>([]);
  const [formationsList, setFormationsList] = useState<any[]>([]); 
  const [rostersList, setRostersList] = useState<any[]>([]);
  const [productsList, setProductsList] = useState<any[]>([]);
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [checkoutForm, setCheckoutForm] = useState({ name: "", phone: "", address: "", paymentMethod: "cash", transactionRef: "", receiptImage: "", receiptFileName: "", notes: "" }); 
  const [tickerText, setTickerText] = useState("مطروح الرياضية...");
  
  const [search, setSearch] = useState("");
  const [searchScorers, setSearchScorers] = useState("");
  const [searchCards, setSearchCards] = useState("");
  const [searchMotm, setSearchMotm] = useState("");
  const [loading, setLoading] = useState(true);
  
  const [predForms, setPredForms] = useState<Record<string, any>>({});
  const [predictedMatches, setPredictedMatches] = useState<Record<string, boolean>>({});
  const [isTableExpanded, setIsTableExpanded] = useState(false);
  const [showArchivedCards, setShowArchivedCards] = useState(false); 
  
  const [activeTotwRound, setActiveTotwRound] = useState("دور المجموعات"); 
  const [time, setTime] = useState<Date | null>(null);
  const [notificationPermission, setNotificationPermission] = useState("default");

  const [rosterViewMode, setRosterViewMode] = useState<'list' | 'register'>('list');
  const [rosterAccessTeam, setRosterAccessTeam] = useState("");
  const [rosterAccessPassword, setRosterAccessPassword] = useState("");
  const [unlockedRoster, setUnlockedRoster] = useState<string | null>(null);
  const [selectedRosterToView, setSelectedRosterToView] = useState<any>(null);
  const [rosterForm, setRosterForm] = useState({
    managerName: "", managerPhone: "", logoUrl: "",
    players: Array.from({ length: 12 }, () => ({ name: "", number: "" }))
  });

  const [isRefreshing, setIsRefreshing] = useState(false);

  const forceAppUpdate = async () => {
    setIsRefreshing(true);
    try {
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
        }
    } catch (e) {
        console.error("خطأ في مسح الكاش", e);
    }
    window.location.reload();
  };

  useEffect(() => {
    let hiddenTime: number | null = null;
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenTime = Date.now();
      } else if (document.visibilityState === 'visible' && hiddenTime) {
        if (Date.now() - hiddenTime > 600000) forceAppUpdate();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    setLoading(true);
    const stored = localStorage.getItem('predictedMatches');
    if (stored) setPredictedMatches(JSON.parse(stored));

    if (typeof window !== "undefined") {
      if ("Notification" in window) setNotificationPermission(Notification.permission);
      if (window.location.hostname.includes("matrouhcup.online")) {
        (window as any).OneSignalDeferred = (window as any).OneSignalDeferred || [];
        (window as any).OneSignalDeferred.push(async function(OneSignal: any) {
          await OneSignal.init({ appId: "d73de8b7-948e-494e-84f2-6c353efee89c" });
        });
        if (!document.querySelector('script[src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"]')) {
          const script = document.createElement('script');
          script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
          script.defer = true;
          document.head.appendChild(script);
        }
      }
    }

    const suffix = activeTournament === "juniors" ? "_juniors" : "";
    const unsubMatches = onSnapshot(collection(db, `matches${suffix}`), (snap) => { setMatches(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))); setLoading(false); });
    const unsubGoals = onSnapshot(collection(db, `goals${suffix}`), (snap) => setGoalEvents(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubCards = onSnapshot(collection(db, `cards${suffix}`), (snap) => setCardEvents(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubArchivedCards = onSnapshot(collection(db, `archived_cards${suffix}`), (snap) => setArchivedCards(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubMedia = onSnapshot(collection(db, `media${suffix}`), (snap) => setMediaItems(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubMotm = onSnapshot(collection(db, `motm${suffix}`), (snap) => setMotmList(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubPreds = onSnapshot(collection(db, `predictions${suffix}`), (snap) => setPredictionsList(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubForms = onSnapshot(collection(db, `formations${suffix}`), (snap) => setFormationsList(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubRosters = onSnapshot(collection(db, `team_rosters${suffix}`), (snap) => setRostersList(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubProducts = onSnapshot(collection(db, "products"), (snap) => setProductsList(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter((p:any) => p.isActive !== false).sort((a:any,b:any)=>String(b.updatedAt||"").localeCompare(String(a.updatedAt||"")))));
    const unsubTicker = onSnapshot(doc(db, "settings", "ticker"), (snap) => setTickerText(snap.data()?.text || "مطروح الرياضية..."));

    const clockTimer = setInterval(() => setTime(new Date()), 1000);

    return () => { 
        unsubMatches(); unsubGoals(); unsubCards(); unsubArchivedCards(); 
        unsubMedia(); unsubMotm(); unsubPreds(); unsubForms(); unsubRosters(); unsubProducts();
        unsubTicker(); clearInterval(clockTimer); 
    };
  }, [activeTournament]);

  const handleSubscribe = () => {
    if (typeof window !== "undefined" && (window as any).OneSignalDeferred) {
      (window as any).OneSignalDeferred.push(async function(OneSignal: any) {
        await OneSignal.Slidedown.promptPush();
        setTimeout(() => { if ("Notification" in window) setNotificationPermission(Notification.permission); }, 4000);
      });
    }
  };

  const submitPrediction = async (matchId: string, matchName: string) => { 
    const form = predForms[matchId];
    if (!form?.name || !form?.phone || form?.homeScore === undefined || form?.awayScore === undefined) return alert("يرجى إكمال الاسم، رقم الهاتف، والنتيجة!");
    try {
      await addDoc(collection(db, activeTournament === 'juniors' ? 'predictions_juniors' : 'predictions'), { matchId, matchName, name: form.name, phone: form.phone, homeScore: Number(form.homeScore), awayScore: Number(form.awayScore), timestamp: new Date().toISOString() });
      alert("تم تسجيل توقعك بنجاح! حظ سعيد 🎁");
      setPredictedMatches(p => { const np = {...p, [matchId]: true}; localStorage.setItem('predictedMatches', JSON.stringify(np)); return np; });
    } catch(e) { alert("حدث خطأ، حاول مرة أخرى."); }
  };

  const handleRosterLogin = () => {
    if(!rosterAccessTeam) return alert("الرجاء اختيار الفريق أولاً.");
    if(!rosterAccessPassword) return alert("الرجاء إدخال الرقم السري.");
    const existingTeam = rostersList.find(r => r.id === rosterAccessTeam);
    if (!existingTeam || !existingTeam.password) return alert("❌ لم تقم إدارة البطولة بتعيين رقم سري لهذا الفريق بعد. يرجى التواصل مع اللجنة المنظمة.");
    if (existingTeam.password !== rosterAccessPassword) return alert("❌ الرقم السري غير صحيح! يرجى التأكد من الرقم الممنوح لك من الإدارة.");
    if (existingTeam.isSubmitted) return alert("⚠️ تم حفظ واعتماد قائمة هذا الفريق مسبقاً. لا يمكن التعديل عليها إلا من خلال إدارة البطولة.");
    
    setUnlockedRoster(rosterAccessTeam);
    if (existingTeam && existingTeam.players) {
        const loadedPlayers = [...existingTeam.players];
        while(loadedPlayers.length < 12) loadedPlayers.push({ name: "", number: "" });
        setRosterForm({ managerName: existingTeam.managerName || "", managerPhone: existingTeam.managerPhone || "", logoUrl: existingTeam.logoUrl || "", players: loadedPlayers.slice(0,12) });
    } else {
        setRosterForm({ managerName: "", managerPhone: "", logoUrl: "", players: Array.from({ length: 12 }, () => ({ name: "", number: "" })) });
    }
  };

  const updateRosterPlayer = (index: number, field: string, value: string) => {
    setRosterForm(prev => { const newPlayers = [...prev.players]; newPlayers[index] = { ...newPlayers[index], [field]: value }; return { ...prev, players: newPlayers }; });
  };

  const submitFinalRoster = async () => {
    if(!rosterForm.managerName || !rosterForm.managerPhone) return alert("الرجاء إكمال بيانات مسئول الفريق (الاسم ورقم الهاتف)");
    if(rosterForm.players.find(p => !p.name.trim() || !p.number.trim())) return alert("الرجاء ملء بيانات جميع اللاعبين الـ 12 (الاسم ورقم التيشرت لكل لاعب)");
    if(confirm("تنبيه هام: بمجرد الضغط على تأكيد وحفظ، سيتم إرسال القائمة واعتمادها ولن تتمكن من تعديلها مرة أخرى. هل أنت متأكد من صحة البيانات؟")) {
        try {
            const suffix = activeTournament === "juniors" ? "_juniors" : "";
            await setDoc(doc(db, `team_rosters${suffix}`, unlockedRoster!), { teamName: unlockedRoster, managerName: rosterForm.managerName, managerPhone: rosterForm.managerPhone, logoUrl: rosterForm.logoUrl, players: rosterForm.players, password: rosterAccessPassword, isSubmitted: true, updatedAt: new Date().toISOString() }, { merge: true });
            alert("تم حفظ واعتماد قائمة الفريق بنجاح!");
            setUnlockedRoster(null); setRosterAccessTeam(""); setRosterAccessPassword(""); setRosterViewMode('list');
        } catch(e) { alert("حدث خطأ أثناء حفظ القائمة، حاول مرة أخرى."); }
    }
  };

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
  const tomorrowStr = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });

  const liveMatchesList = useMemo(() => {
    return matches.filter(m => {
      if (m.isLive === true || m.status === "live" || m.status === "مباشر" || m.status === "شغال الآن") return true;
      if (m.date === todayStr && m.time) {
        const now = new Date();
        const [hours, minutes] = m.time.split(':').map(Number);
        const matchTime = new Date(); matchTime.setHours(hours, minutes, 0, 0);
        const diffMins = (now.getTime() - matchTime.getTime()) / 60000;
        if (diffMins >= -30 && diffMins <= 180 && m.status !== "انتهت") return true;
      }
      return false;
    });
  }, [matches, todayStr]);
  
  const liveMatches = useMemo(() => sortMatchesAsc(liveMatchesList), [liveMatchesList]);
  const liveMatchIds = useMemo(() => new Set(liveMatchesList.map(m => m.id)), [liveMatchesList]);

  const finishedMatches = useMemo(() => [...matches].sort((a, b) => b.date.localeCompare(a.date) || (b.time || "00:00").localeCompare(a.time || "00:00")).filter(m => !liveMatchIds.has(m.id) && (m.status === "انتهت" || m.date < todayStr)), [matches, liveMatchIds, todayStr]);
  const todayMatches = useMemo(() => sortMatchesAsc(matches.filter(m => !liveMatchIds.has(m.id) && m.date === todayStr && m.status !== "انتهت")), [matches, liveMatchIds, todayStr]);
  const tomorrowMatches = useMemo(() => sortMatchesAsc(matches.filter(m => !liveMatchIds.has(m.id) && m.date === tomorrowStr && m.status !== "انتهت")), [matches, liveMatchIds, tomorrowStr]);

  const standingsYouth = useMemo(() => buildStandings(finishedMatches, CLEANED_TEAM_NAMES), [finishedMatches]);
  const standingsJunA = useMemo(() => buildStandings(finishedMatches, JUNIORS_GROUP_A), [finishedMatches]);
  const standingsJunB = useMemo(() => buildStandings(finishedMatches, JUNIORS_GROUP_B), [finishedMatches]);
  
  const activeTeamsList = activeTournament === 'youth' ? CLEANED_TEAM_NAMES : [...JUNIORS_GROUP_A, ...JUNIORS_GROUP_B];

  const youthTree = useMemo(() => {
    const getT = (rank: number) => standingsYouth.length >= rank ? standingsYouth[rank - 1].team : `المركز ${rank}`;
    const p97 = getWinnerData("اسماك باسط العوامي", "اصدقاء عز بوالمجدوبة", "الملحق", "م 97", matches);
    const p98 = getWinnerData("السلوم", "اصدقاء عيسي المغواري", "الملحق", "م 98", matches);
    const p99 = getWinnerData("17 فبراير", "الفهود", "الملحق", "م 99", matches);
    const p100 = getWinnerData("اصدقاء قسم الله", "اصدقاء سلامة بدر", "الملحق", "م 100", matches);
    const p101 = getWinnerData("ايس كريم الملكة", "غوط رباح", "الملحق", "م 101", matches);
    const p102 = getWinnerData("محاربي الصحراء", "اصدقاء خالد", "الملحق", "م 102", matches);
    const p103 = getWinnerData("ام القبائل", "شباب القناشات", "الملحق", "م 103", matches);
    const p104 = getWinnerData("اتحاد المثاني", "دبي للزي العربي", "الملحق", "م 104", matches);

    const r1 = getWinnerData(getT(1), p104.win || "الفائز من م 104", "دور الستة عشر", "م 1", matches);
    const r2 = getWinnerData(getT(8), p97.win || "الفائز من م 97", "دور الستة عشر", "م 2", matches);
    const r3 = getWinnerData(getT(4), p101.win || "الفائز من م 101", "دور الستة عشر", "م 3", matches);
    const r4 = getWinnerData(getT(5), p100.win || "الفائز من م 100", "دور الستة عشر", "م 4", matches);
    const r5 = getWinnerData(getT(2), p103.win || "الفائز من م 103", "دور الستة عشر", "م 5", matches);
    const r6 = getWinnerData(getT(7), p98.win || "الفائز من م 98", "دور الستة عشر", "م 6", matches);
    const r7 = getWinnerData(getT(3), p102.win || "الفائز من م 102", "دور الستة عشر", "م 7", matches);
    const r8 = getWinnerData(getT(6), p99.win || "الفائز من م 99", "دور الستة عشر", "م 8", matches);

    const q1 = getWinnerData(r1.win || "الفائز (م 1)", r2.win || "الفائز (م 2)", "دور الثمانية", "مربع 1", matches);
    const q2 = getWinnerData(r3.win || "الفائز (م 3)", r4.win || "الفائز (م 4)", "دور الثمانية", "مربع 2", matches);
    const q3 = getWinnerData(r5.win || "الفائز (م 5)", r6.win || "الفائز (م 6)", "دور الثمانية", "مربع 3", matches);
    const q4 = getWinnerData(r7.win || "الفائز (م 7)", r8.win || "الفائز (م 8)", "دور الثمانية", "مربع 4", matches);

    const s1 = getWinnerData(q1.win || "الفائز مربع 1", q2.win || "الفائز مربع 2", "نصف النهائي", "نصف 1", matches);
    const s2 = getWinnerData(q3.win || "الفائز مربع 3", q4.win || "الفائز مربع 4", "نصف النهائي", "نصف 2", matches);

    const f1 = getWinnerData(s1.win || "الطرف الأول", s2.win || "الطرف الثاني", "النهائي", "النهائي", matches);

    return { p97, p98, p99, p100, p101, p102, p103, p104, r1, r2, r3, r4, r5, r6, r7, r8, q1, q2, q3, q4, s1, s2, f1, getT };
  }, [standingsYouth, matches]);

  const juniorsTree = useMemo(() => {
    const ja1 = standingsJunA[0]?.team || "أول (أ)"; const ja2 = standingsJunA[1]?.team || "ثاني (أ)"; const ja3 = standingsJunA[2]?.team || "ثالث (أ)"; const ja4 = standingsJunA[3]?.team || "رابع (أ)";
    const jb1 = standingsJunB[0]?.team || "أول (ب)"; const jb2 = standingsJunB[1]?.team || "ثاني (ب)"; const jb3 = standingsJunB[2]?.team || "ثالث (ب)"; const jb4 = standingsJunB[3]?.team || "رابع (ب)";
    const q1 = getWinnerData(ja1, jb4, "دور الثمانية", "مربع 1", matches); const q2 = getWinnerData(jb2, ja3, "دور الثمانية", "مربع 2", matches);
    const q3 = getWinnerData(jb1, ja4, "دور الثمانية", "مربع 3", matches); const q4 = getWinnerData(ja2, jb3, "دور الثمانية", "مربع 4", matches);
    const s1 = getWinnerData(q1.win || "الفائز (مربع 1)", q2.win || "الفائز (مربع 2)", "نصف النهائي", "نصف 1", matches);
    const s2 = getWinnerData(q3.win || "الفائز (مربع 3)", q4.win || "الفائز (مربع 4)", "نصف النهائي", "نصف 2", matches);
    const f1 = getWinnerData(s1.win || "الطرف الأول", s2.win || "الطرف الثاني", "النهائي", "النهائي", matches);
    return { ja1, ja2, ja3, ja4, jb1, jb2, jb3, jb4, q1, q2, q3, q4, s1, s2, f1 };
  }, [standingsJunA, standingsJunB, matches]);

  const scorers = useMemo(() => {
    const map = new Map<string, any>();
    goalEvents.forEach(e => { 
      const playerOriginal = String(e.player || "").trim();
      const teamStr = String(e.team || "").trim();
      if(!playerOriginal) return; 
      const key = `${normalizeTeamName(playerOriginal)}__${normalizeTeamName(teamStr)}`; 
      if (!map.has(key)) map.set(key, { player: playerOriginal, team: teamStr, goals: 0, imageUrl: e.imageUrl || "", rating: e.rating || 99, pac: e.pac || 99, sho: e.sho || 99, pas: e.pas || 99, dri: e.dri || 99, def: e.def || 99, phy: e.phy || 99 });
      map.get(key)!.goals += Number(e.goals) || 1; 
      if (e.imageUrl && !map.get(key)!.imageUrl) map.get(key)!.imageUrl = e.imageUrl;
      if (e.rating) Object.assign(map.get(key)!, { rating: e.rating, pac: e.pac, sho: e.sho, pas: e.pas, dri: e.dri, def: e.def, phy: e.phy });
    });
    return Array.from(map.values()).sort((a, b) => b.goals - a.goals);
  }, [goalEvents]);

  const filteredScorers = useMemo(() => {
    if (!searchScorers) return scorers;
    const term = searchScorers.toLowerCase().trim();
    return scorers.filter(s => String(s.player || "").toLowerCase().includes(term) || String(s.team || "").toLowerCase().includes(term));
  }, [scorers, searchScorers]);

  const topMotmPlayer = useMemo(() => {
    const counts: Record<string, any> = {};
    motmList.forEach(m => { 
      const p = String(m.player || "").trim();
      if(!p) return;
      if(!counts[p]) counts[p] = { name: p, team: m.team, count: 0, imageUrl: m.imageUrl, sponsorLogo: m.sponsorLogo }; 
      counts[p].count++; 
    });
    return Object.values(counts).sort((a: any, b: any) => b.count - a.count)[0] as any;
  }, [motmList]);

  const fantasyLeaderboard = useMemo(() => {
    const users: Record<string, any> = {};
    predictionsList.forEach(p => {
       const phone = p.phone;
       if (!users[phone]) users[phone] = { name: p.name, points: 0, correctScore: 0, correctWinner: 0 };
       const match = finishedMatches.find(m => m.id === p.matchId || m.teamA + " vs " + m.teamB === p.matchName);
       if (match) {
         const pHome = Number(p.homeScore); const pAway = Number(p.awayScore);
         const mHome = Number(match.homeGoals); const mAway = Number(match.awayGoals);
         if (pHome === mHome && pAway === mAway) { users[phone].points += 3; users[phone].correctScore++; } 
         else if ((pHome > pAway && mHome > mAway) || (pHome < pAway && mHome < mAway) || (pHome === pAway && mHome === mAway)) { users[phone].points += 1; users[phone].correctWinner++; }
       }
    });
    return Object.values(users).sort((a,b) => b.points - a.points || b.correctScore - a.correctScore).slice(0, 10);
  }, [predictionsList, finishedMatches]);

  const statsData = useMemo(() => {
    const completedMatchesAllRounds = matches.filter(m => m.status === "انتهت" || (!liveMatchIds.has(m.id) && m.date < todayStr));
    const totalMatches = completedMatchesAllRounds.length;
    let totalGoals = 0, draws00 = 0, drawsPositive = 0;
    
    const teamStats = new Map<string, {team: string, gf: number, ga: number}>();
    const allTeams = activeTournament === 'youth' ? CLEANED_TEAM_NAMES : [...JUNIORS_GROUP_A, ...JUNIORS_GROUP_B];
    allTeams.forEach(t => teamStats.set(normalizeTeamName(t), { team: t, gf: 0, ga: 0 }));

    completedMatchesAllRounds.forEach(m => {
      const hg = Number(m.homeGoals) || 0; const ag = Number(m.awayGoals) || 0;
      totalGoals += (hg + ag);
      if (hg === ag) { if (hg === 0) draws00++; else drawsPositive++; }
      const hNorm = normalizeTeamName(m.teamA); const aNorm = normalizeTeamName(m.teamB);
      if (teamStats.has(hNorm)) { teamStats.get(hNorm)!.gf += hg; teamStats.get(hNorm)!.ga += ag; }
      if (teamStats.has(aNorm)) { teamStats.get(aNorm)!.gf += ag; teamStats.get(aNorm)!.ga += hg; }
    });
    
    const allCardEvents = [...cardEvents, ...archivedCards];
    const totalYellow = allCardEvents.reduce((acc, curr) => acc + (Number(curr.yellow) || 0), 0);
    const totalRed = allCardEvents.reduce((acc, curr) => acc + (Number(curr.red) || 0), 0);
    
    const activeTeams = Array.from(teamStats.values()).filter(t => t.gf > 0 || t.ga > 0 || totalMatches > 0);
    const sortedByAttack = [...activeTeams].sort((a, b) => b.gf - a.gf);
    const sortedByDef = [...activeTeams].sort((a, b) => a.ga - b.ga); 

    return {
      totalMatches, totalGoals, draws00, drawsPositive, totalYellow, totalRed,
      bestAttack: sortedByAttack[0] || { team: "—", gf: 0 }, worstAttack: sortedByAttack[sortedByAttack.length - 1] || { team: "—", gf: 0 },
      bestDefense: sortedByDef[0] || { team: "—", ga: 0 }, worstDefense: sortedByDef[sortedByDef.length - 1] || { team: "—", ga: 0 },
      topScorer: scorers[0], 
      goalsPerMatch: totalMatches > 0 ? (totalGoals / totalMatches).toFixed(2) : "0",
      draws00Percent: totalMatches > 0 ? Math.round((draws00 / totalMatches) * 100) : 0,
      drawsPosPercent: totalMatches > 0 ? Math.round((drawsPositive / totalMatches) * 100) : 0,
      yellowPerMatch: totalMatches > 0 ? (totalYellow / totalMatches).toFixed(2) : "0",
      redPerMatch: totalMatches > 0 ? (totalRed / totalMatches).toFixed(2) : "0"
    };
  }, [matches, liveMatchIds, todayStr, cardEvents, archivedCards, scorers, activeTournament]);

  const activeCardsSource = showArchivedCards ? archivedCards : cardEvents;
  const cardsList = useMemo(() => {
    const map = new Map<string, any>();
    activeCardsSource.forEach(e => { 
      const playerOriginal = String(e.player || "").trim();
      if(!playerOriginal) return;
      const key = `${normalizeTeamName(playerOriginal)}__${normalizeTeamName(e.team)}`; 
      if (!map.has(key)) map.set(key, { player: playerOriginal, team: e.team, yellow: 0, red: 0 }); 
      const item = map.get(key)!; item.yellow += Number(e.yellow) || 0; item.red += Number(e.red) || 0; 
    });
    return Array.from(map.values()).map(row => ({ ...row, status: row.red > 0 ? "طرد" : row.yellow >= 3 ? "إيقاف" : "متاح" })).sort((a, b) => b.red - a.red || b.yellow - a.yellow);
  }, [activeCardsSource]);

  const filteredCardsList = useMemo(() => {
    if (!searchCards) return cardsList.filter(c => c.yellow > 0 || c.red > 0);
    const term = searchCards.toLowerCase().trim();
    return cardsList.filter(c => (c.yellow > 0 || c.red > 0) && (String(c.player || "").toLowerCase().includes(term) || String(c.team || "").toLowerCase().includes(term)));
  }, [cardsList, searchCards]);

  const currentFormation = useMemo(() => {
    const form = formationsList.find(f => f.round === activeTotwRound);
    if (!form || !form.players) return { players: Array(7).fill(null), coach: { name: "", team: "", imageUrl: "", rating: 10 } };
    const playersArr = Array.isArray(form.players) ? [...form.players] : Array(7).fill(null);
    while(playersArr.length < 7) playersArr.push(null);
    return { ...form, players: playersArr, coach: form.coach || { name: "", team: "", imageUrl: "", rating: 10 } };
  }, [formationsList, activeTotwRound]);

  const cartTotal = useMemo(() => cartItems.reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.qty) || 1)), 0), [cartItems]);
  const addToCart = (product: any) => setCartItems(prev => prev.find(item => item.id === product.id) ? prev.map(item => item.id === product.id ? { ...item, qty: (Number(item.qty) || 1) + 1 } : item) : [...prev, { ...product, qty: 1 }]);
  const updateCartQty = (productId: string, qty: number) => { if (qty <= 0) return setCartItems(prev => prev.filter(item => item.id !== productId)); setCartItems(prev => prev.map(item => item.id === productId ? { ...item, qty } : item)); };

  const submitOrder = async () => {
    if (cartItems.length === 0) return alert("السلة فارغة");
    if (!checkoutForm.name.trim() || !checkoutForm.phone.trim() || !checkoutForm.address.trim()) return alert("يرجى إدخال الاسم ورقم الهاتف والعنوان");
    await addDoc(collection(db, "orders"), { customer: checkoutForm, items: cartItems.map(item => ({ id: item.id, title: item.title, price: Number(item.price) || 0, qty: Number(item.qty) || 1, imageUrl: item.imageUrl || "" })), total: cartTotal, paymentMethod: checkoutForm.paymentMethod, paymentStatus: checkoutForm.paymentMethod === "cash" ? "الدفع عند الاستلام" : "في انتظار التأكيد", status: "طلب جديد", createdAt: new Date().toISOString() });
    alert("✅ تم إرسال الطلب بنجاح وسيتم التواصل معك للتأكيد");
    setCartItems([]); setCheckoutForm({ name: "", phone: "", address: "", paymentMethod: "cash", transactionRef: "", receiptImage: "", receiptFileName: "", notes: "" });
  };

  if (loading) return <div className="min-h-screen bg-[#0a1428] flex items-center justify-center flex-col gap-4"><Loader2 className="h-16 w-16 animate-spin text-yellow-400" /><p className="text-white font-bold animate-pulse">جاري تحميل البيانات...</p></div>;

  const formattedTime = time ? time.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) : "";
  const formattedDate = time ? time.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : "";

  return (
    <div dir="rtl" className="min-h-screen bg-[#0a1428] text-white relative pb-20 font-sans">
      <div className="mx-auto max-w-7xl p-3 sm:p-4 md:p-6 lg:p-8">

        {time && (
          <div className="mb-4 rounded-3xl border border-white/10 bg-gradient-to-r from-[#1e2a4a] to-[#13213a] p-4 flex flex-col md:flex-row justify-between items-center gap-4 shadow-xl relative overflow-hidden">
             <div className="absolute inset-0 bg-yellow-400/5 blur-3xl rounded-full pointer-events-none"></div>
             <div className="flex items-center gap-3 relative z-10"><div className="bg-yellow-400/20 p-2.5 rounded-xl border border-yellow-400/30 shadow-inner"><Calendar className="text-yellow-400 h-5 w-5" /></div><span className="text-white font-bold text-sm sm:text-base tracking-wide">{formattedDate}</span></div>
             <div className="flex items-center gap-4 relative z-10"><span className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-l from-yellow-200 to-yellow-500 tracking-widest drop-shadow-sm" dir="ltr">{formattedTime}</span><div className="bg-cyan-500/20 p-2.5 rounded-xl border border-cyan-500/30 shadow-inner"><Clock className="text-cyan-400 h-5 w-5 animate-pulse" /></div></div>
          </div>
        )}

        <div className="mb-4 rounded-3xl border border-yellow-400/50 bg-[#13213a] p-4 flex items-center gap-4">
          <span className="shrink-0 rounded-2xl bg-yellow-400 px-5 py-2 text-sm font-black text-black shadow-[0_0_10px_rgba(250,204,21,0.5)]">آخر تحديث</span>
          <div className="flex-1 overflow-hidden"><div className="animate-marquee whitespace-nowrap text-lg font-bold text-yellow-300">{tickerText}</div></div>
        </div>

        <style dangerouslySetInnerHTML={{__html: `@keyframes infinite-scroll-rtl { 0% { transform: translateX(0); } 100% { transform: translateX(50%); } } .sponsor-track { display: flex; width: max-content; animation: infinite-scroll-rtl 40s linear infinite; } .sponsor-track:hover { animation-play-state: paused; }`}} />
        <div className="mb-6 bg-[#13213a] py-3 rounded-2xl border border-yellow-400/20 overflow-hidden relative shadow-sm" dir="rtl">
          <div className="sponsor-track items-center gap-10">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center gap-10">
                <span className="text-yellow-400/60 font-bold tracking-widest text-[10px] px-2 border-l border-white/10 uppercase">شركاء النجاح</span>
                {[ { name: "الفهد للديكور", src: "/alfahd.png" }, { name: "أحمد عبدالعاطي المحامي", src: "/abdelaty.png" }, { name: "دثار للزي العربي", src: "/dithar.png" }, { name: "معصرة فرجينيا", src: "/virginia.png" }, { name: "دبي للزي العربي", src: "/dubai.png" }, { name: "معرض الأمانة", src: "/alamana.png" }, { name: "تراث البادية", src: "/torath.png" }, { name: "عبدالمقصود ستورز", src: "/abdelmaksoud.png" }, { name: "مياة حياة", src: "/hayah.png" }, { name: "القدس للأثاث", src: "/alquds.png" }, { name: "أيس كريم الملكة", src: "/almaleka.png" }, { name: "جزارة عبدالله الجراري", src: "/aljarari.png" }, { name: "M MART", src: "/mmart.png" }, { name: "هيرو سبورت", src: "/hero-sport.png" }, { name: "الفتح للفراشة", src: "/alfath.png" }, { name: "عادل العميري للديكور", src: "/alomairy.png" } ].map((sponsor, idx) => ( <img key={idx} src={sponsor.src} alt={sponsor.name} title={sponsor.name} className="h-10 w-24 object-contain drop-shadow-sm transition-transform hover:scale-110 cursor-pointer" onError={(e) => (e.currentTarget.style.display = 'none')} loading="lazy" /> ))}
              </div>
            ))}
          </div>
        </div>

        <div className="mb-6 rounded-3xl border border-yellow-400/40 bg-gradient-to-br from-[#1e2a4a] to-[#13213a] p-6 text-center shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[url('/pattern.png')] bg-repeat"></div>
          <div className="flex justify-center mb-6 relative z-10"><img src="/logo.png" alt="شعار البطولة" className="h-28 sm:h-36 w-auto drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" /></div>
          <h1 className="text-4xl sm:text-6xl font-black text-yellow-300 tracking-tight relative z-10">بطولة كأس مطروح</h1>
          <p className="mt-3 text-xl text-cyan-300 font-bold relative z-10">النسخة الثالثة ٢٠٢٦</p>
        </div>

        <div className="flex justify-center mb-10 mt-4">
          <div className="bg-[#13213a] p-2 rounded-full border border-yellow-400/30 inline-flex shadow-xl gap-2 w-full max-w-md">
            <button onClick={() => { setActiveTournament('youth'); setActiveTab('standings'); }} className={`flex-1 py-3 rounded-full text-base sm:text-xl font-black transition-all ${activeTournament === 'youth' ? 'bg-yellow-400 text-black shadow-[0_0_15px_rgba(250,204,21,0.4)]' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>🏆 الشباب</button>
            <button onClick={() => { setActiveTournament('juniors'); setActiveTab('standings'); }} className={`flex-1 py-3 rounded-full text-base sm:text-xl font-black transition-all ${activeTournament === 'juniors' ? 'bg-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>🏅 الناشئين</button>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {[
            { key: "rosters", label: "قوائم الفرق", icon: "📋", extraClass: "bg-gradient-to-r from-blue-600 to-indigo-700 text-white border-none shadow-[0_0_15px_rgba(59,130,246,0.6)]" },
            { key: "totw", label: "تشكيلة الجولة", icon: "🏟️", extraClass: "bg-emerald-600 text-white border-none shadow-[0_0_15px_rgba(5,150,105,0.6)]" },
            { key: "fantasy", label: "توقع واكسب", icon: "🎁", extraClass: "bg-gradient-to-r from-emerald-500 to-teal-600 text-white border-none shadow-[0_0_15px_rgba(16,185,129,0.5)]" },
            { key: "knockout", label: "الإقصائيات", icon: "🏆", extraClass: "" }, 
            { key: "live", label: "مباشر", icon: "🔴", extraClass: "" }, 
            { key: "standings", label: "الترتيب", icon: "📊", extraClass: "" }, 
            { key: "today", label: "اليوم", icon: "📅", extraClass: "" }, 
            { key: "tomorrow", label: "غداً", icon: "📆", extraClass: "" }, 
            { key: "all", label: "النتائج", icon: "⚽", extraClass: "" }, 
            { key: "scorers", label: "الهدافين", icon: "🥇", extraClass: "" }, 
            { key: "cards", label: "الكروت", icon: "🟨", extraClass: "" }, 
            { key: "stats", label: "إحصائيات", icon: "📈", extraClass: "" }, 
            { key: "motm_tab", label: "نجوم المباريات", icon: "🌟", extraClass: "" }, 
            { key: "media", label: "أخبار البطولة", icon: "📰", extraClass: "" },
            { key: "shop", label: "تسوق الآن", icon: "🛒", extraClass: "bg-gradient-to-r from-yellow-500 to-orange-600 text-black border-none shadow-[0_0_15px_rgba(245,158,11,0.5)]" },
            { key: "settings", label: "الإعدادات", icon: "⚙️", extraClass: "bg-gray-800 text-white shadow-lg border-gray-600" }
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex-1 sm:flex-none px-5 py-3.5 rounded-2xl font-bold text-sm sm:text-base transition-all border ${activeTab === tab.key ? (tab.extraClass || "bg-yellow-400 text-black border-yellow-400 shadow-lg scale-105") : "bg-[#1e2a4a] text-white border-yellow-400/30 hover:bg-[#25345a]"}`}><span className={`text-lg ${tab.key === "live" && activeTab === "live" ? "animate-pulse" : ""}`}>{tab.icon}</span> <span className="ml-1">{tab.label}</span></button>
          ))}
        </div>

        {activeTab === "rosters" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-center mb-6">
               <div className="bg-[#13213a] p-1.5 rounded-2xl border border-white/10 inline-flex shadow-lg gap-1 w-full max-w-md">
                 <button onClick={() => { setRosterViewMode('list'); setSelectedRosterToView(null); }} className={`flex-1 py-3 rounded-xl text-base font-bold transition-all ${rosterViewMode === 'list' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}><ClipboardList className="inline-block mr-1 h-5 w-5" /> عرض القوائم المشاركة</button>
                 <button onClick={() => { setRosterViewMode('register'); setUnlockedRoster(null); }} className={`flex-1 py-3 rounded-xl text-base font-bold transition-all ${rosterViewMode === 'register' ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}><Lock className="inline-block mr-1 h-5 w-5" /> تسجيل وتعديل قائمة</button>
               </div>
            </div>

            {rosterViewMode === 'list' && !selectedRosterToView && (
              <div className="space-y-6">
                 <div className="text-center mb-6"><h2 className="text-3xl font-black text-yellow-300">القوائم الرسمية للفرق المشاركة</h2><p className="text-cyan-300 mt-2 font-bold">اضغط على اسم الفريق لعرض قائمة الـ 12 لاعب المعتمدة من الإدارة</p></div>
                 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {activeTeamsList.map(teamName => {
                       const rosterData = rostersList.find(r => r.id === teamName); const isSubmitted = rosterData && rosterData.isSubmitted;
                       return (
                         <Card key={teamName} onClick={() => isSubmitted && setSelectedRosterToView(rosterData)} className={`border transition-all cursor-pointer overflow-hidden ${isSubmitted ? 'bg-[#1e2a4a] border-blue-500/50 hover:border-blue-400 hover:scale-105 shadow-lg' : 'bg-[#13213a] border-white/5 opacity-60 cursor-not-allowed'}`}>
                            <CardContent className="p-6 flex flex-col items-center text-center justify-center h-full gap-3">
                               {isSubmitted && rosterData.logoUrl ? <div className="w-12 h-12 rounded-full bg-[#0a1428] border border-white/10 overflow-hidden flex items-center justify-center p-1"><img src={rosterData.logoUrl} alt={teamName} className="w-full h-full object-contain" /></div> : <Shield className={`h-8 w-8 ${isSubmitted ? 'text-blue-400' : 'text-gray-500'}`} />}
                               <span className="font-black text-white text-lg">{teamName}</span>
                               {isSubmitted ? <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 mt-2 font-bold px-3"><CheckCircle2 className="h-3 w-3 mr-1" /> قائمة معتمدة</Badge> : <Badge className="bg-gray-800 text-gray-400 border border-gray-600 mt-2 font-bold px-3">لم تسجل بعد</Badge>}
                            </CardContent>
                         </Card>
                       );
                    })}
                 </div>
              </div>
            )}

            {rosterViewMode === 'list' && selectedRosterToView && (
               <div className="animate-in zoom-in duration-300 max-w-3xl mx-auto">
                 <Button onClick={() => setSelectedRosterToView(null)} variant="outline" className="mb-6 bg-white/5 border-white/20 text-white hover:bg-white/10 font-bold">العودة للقوائم ↩</Button>
                 <Card className="bg-gradient-to-b from-[#1e2a4a] to-[#13213a] border border-blue-500/50 rounded-3xl shadow-2xl overflow-hidden">
                    <CardHeader className="bg-blue-900/40 border-b border-blue-500/30 text-center py-8 relative">
                       <div className="absolute top-4 right-4"><Badge className="bg-emerald-500 text-white font-black"><CheckCircle2 className="h-4 w-4 mr-1 inline-block"/> معتمدة</Badge></div>
                       {selectedRosterToView.logoUrl ? <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[#0a1428] border-2 border-blue-500/50 p-2 shadow-inner"><img src={selectedRosterToView.logoUrl} alt={selectedRosterToView.teamName} className="w-full h-full object-contain" /></div> : <Shield className="h-16 w-16 mx-auto text-blue-400 mb-4" />}
                       <CardTitle className="text-4xl font-black text-white tracking-wide">{selectedRosterToView.teamName}</CardTitle>
                       <div className="mt-4 flex flex-col sm:flex-row justify-center gap-4 text-cyan-300 font-bold"><span className="flex items-center justify-center gap-2"><Users className="h-5 w-5"/> المسئول: {selectedRosterToView.managerName}</span><span className="hidden sm:inline">•</span><span className="flex items-center justify-center gap-2" dir="ltr"><Phone className="h-5 w-5"/> {selectedRosterToView.managerPhone}</span></div>
                    </CardHeader>
                    <CardContent className="p-0">
                       <table className="w-full text-right text-white text-lg"><thead className="bg-[#0a1428]"><tr><th className="p-4 w-20 text-center text-cyan-400 border-b border-white/5">الرقم</th><th className="p-4 text-cyan-400 border-b border-white/5">اسم اللاعب</th></tr></thead><tbody>{selectedRosterToView.players.map((p: any, i: number) => (<tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors"><td className="p-4 text-center font-black text-yellow-400">{p.number}</td><td className="p-4 font-bold">{p.name}</td></tr>))}</tbody></table>
                    </CardContent>
                 </Card>
               </div>
            )}

            {rosterViewMode === 'register' && !unlockedRoster && (
               <Card className="max-w-xl mx-auto bg-[#13213a] border border-emerald-500/30 rounded-3xl shadow-2xl">
                 <CardHeader className="text-center border-b border-white/5 pb-6"><Lock className="mx-auto h-12 w-12 text-emerald-400 mb-4" /><CardTitle className="text-2xl font-black text-white">تسجيل دخول لمسئول الفريق</CardTitle><p className="text-gray-400 text-sm mt-2 font-bold">يرجى اختيار فريقك وإدخال الرقم السري الممنوح لك من الإدارة لملء القائمة.</p></CardHeader>
                 <CardContent className="p-8 space-y-6">
                    <div><label className="block text-cyan-300 font-bold mb-2">اختر فريقك</label><select value={rosterAccessTeam} onChange={e => setRosterAccessTeam(e.target.value)} className="w-full bg-[#1e2a4a] border border-emerald-500/50 rounded-xl p-4 text-white font-bold outline-none cursor-pointer"><option value="">-- اضغط للاختيار --</option>{activeTeamsList.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                    <div><label className="block text-cyan-300 font-bold mb-2">الرقم السري للفريق</label><Input type="password" value={rosterAccessPassword} onChange={e => setRosterAccessPassword(e.target.value)} placeholder="••••••••" className="bg-[#1e2a4a] border-emerald-500/50 text-white font-black text-center text-xl h-14 tracking-widest" /></div>
                    <Button onClick={handleRosterLogin} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-7 text-xl shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-transform hover:scale-105">تسجيل الدخول للقائمة <Unlock className="ml-2 h-5 w-5" /></Button>
                 </CardContent>
               </Card>
            )}

            {rosterViewMode === 'register' && unlockedRoster && (
               <div className="max-w-4xl mx-auto animate-in fade-in duration-500">
                  <div className="bg-yellow-400/10 border border-yellow-400 text-yellow-300 p-4 rounded-2xl mb-6 text-center font-bold">⚠️ تنبيه هام: يرجى مراجعة الأسماء والأرقام بدقة. بمجرد ضغط "حفظ واعتماد" سيتم قفل القائمة ولن تتمكن من تعديلها مجدداً إلا من خلال إدارة البطولة.</div>
                  <Card className="bg-[#13213a] border border-blue-500/30 rounded-3xl shadow-2xl overflow-hidden">
                     <CardHeader className="bg-[#1e2a4a] border-b border-blue-500/20 py-6"><CardTitle className="text-3xl font-black text-white text-center flex items-center justify-center gap-3"><ClipboardList className="text-blue-400"/> استمارة قائمة: {unlockedRoster}</CardTitle></CardHeader>
                     <CardContent className="p-6 md:p-8 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#0a1428] p-6 rounded-2xl border border-white/5"><div><label className="block text-cyan-300 font-bold mb-2">اسم المدير الفني / مسئول الفريق</label><Input placeholder="الاسم الثلاثي" value={rosterForm.managerName} onChange={e => setRosterForm(p => ({...p, managerName: e.target.value}))} className="bg-[#1e2a4a] border-blue-500/40 text-white font-bold h-12" /></div><div><label className="block text-cyan-300 font-bold mb-2">رقم هاتف المسئول (للتواصل)</label><Input type="tel" dir="ltr" placeholder="01xxxxxxxxx" value={rosterForm.managerPhone} onChange={e => setRosterForm(p => ({...p, managerPhone: e.target.value}))} className="bg-[#1e2a4a] border-blue-500/40 text-white font-bold h-12 text-right" /></div></div>
                        <div>
                           <h3 className="text-xl font-black text-yellow-300 mb-4 border-b border-white/10 pb-2">أسماء اللاعبين (12 لاعب)</h3>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                              {rosterForm.players.map((player, index) => (
                                 <div key={index} className="flex gap-3 items-center bg-[#1e2a4a] p-2 pr-4 rounded-xl border border-white/5 focus-within:border-blue-400 transition-colors">
                                    <span className="text-gray-400 font-black w-6">{index + 1}.</span>
                                    <Input placeholder="اسم اللاعب" value={player.name} onChange={e => updateRosterPlayer(index, 'name', e.target.value)} className="flex-1 bg-transparent border-none text-white font-bold focus-visible:ring-0 px-0" />
                                    <div className="h-8 w-px bg-white/10 mx-1"></div>
                                    <Input type="number" placeholder="الرقم" value={player.number} onChange={e => updateRosterPlayer(index, 'number', e.target.value)} className="w-20 bg-[#0a1428] border-none text-yellow-400 font-black text-center focus-visible:ring-0" />
                                 </div>
                              ))}
                           </div>
                        </div>
                        <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row gap-4"><Button onClick={submitFinalRoster} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black py-8 text-xl shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-transform hover:scale-105">حفظ واعتماد القائمة نهائياً ✔️</Button><Button onClick={() => setUnlockedRoster(null)} variant="outline" className="bg-transparent border-red-500 text-red-400 hover:bg-red-500 hover:text-white py-8 px-8 font-bold text-lg">إلغاء الخروج</Button></div>
                     </CardContent>
                  </Card>
               </div>
            )}
          </div>
        )}

        {activeTab === "totw" && (
          <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto">
            <div className="text-center mb-8"><h2 className="text-4xl font-black text-emerald-400 drop-shadow-lg">تشكيلة الجولة 🏟️</h2><p className="text-emerald-100 mt-2 font-bold text-lg">أفضل اللاعبين من واقع أداء المباريات</p></div>
            <div className="flex justify-center mb-8">
               <select value={activeTotwRound} onChange={e => setActiveTotwRound(e.target.value)} className="bg-[#1e2a4a] border-2 border-emerald-500 rounded-xl p-3 text-white font-black text-lg outline-none cursor-pointer w-full max-w-sm text-center shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                  {["دور المجموعات", "الملحق", "دور الستة عشر", "دور الثمانية", "دور الأربعة", "النهائي"].map(r => <option key={r} value={r}>{r}</option>)}
               </select>
            </div>
            
            <div className="relative w-full aspect-[3/4] sm:aspect-[4/3] max-w-3xl mx-auto bg-[#1a2e1a] rounded-[2rem] border-4 border-emerald-600/50 overflow-hidden shadow-2xl">
               <div className="absolute inset-0 opacity-30 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay"></div>
               <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-white/30"></div>
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border-2 border-white/30"></div>
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white/50"></div>
               <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 sm:w-64 h-16 sm:h-24 border-2 border-t-0 border-white/30"></div>
               <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-48 sm:w-64 h-16 sm:h-24 border-2 border-b-0 border-white/30"></div>
               <div className="absolute top-[8%] sm:top-[12%] left-1/2 -translate-x-1/2 w-24 sm:w-32 h-8 sm:h-12 border-2 border-t-0 border-white/30"></div>
               <div className="absolute bottom-[8%] sm:bottom-[12%] left-1/2 -translate-x-1/2 w-24 sm:w-32 h-8 sm:h-12 border-2 border-b-0 border-white/30"></div>
               
               <div className="absolute inset-0 flex flex-col justify-between py-6 sm:py-10 px-4">
                 <div className="flex justify-center w-full transform -translate-y-2 sm:-translate-y-4">
                    <MiniFutCard player={currentFormation.players[6]} position="ST" />
                 </div>
                 <div className="flex justify-between w-full px-2 sm:px-16 transform -translate-y-4 sm:-translate-y-8">
                    <MiniFutCard player={currentFormation.players[3]} position="LM" />
                    <MiniFutCard player={currentFormation.players[4]} position="CM" />
                    <MiniFutCard player={currentFormation.players[5]} position="RM" />
                 </div>
                 <div className="flex justify-center gap-8 sm:gap-24 w-full px-8 transform translate-y-2 sm:translate-y-4">
                    <MiniFutCard player={currentFormation.players[1]} position="CB" />
                    <MiniFutCard player={currentFormation.players[2]} position="CB" />
                 </div>
                 <div className="flex justify-center w-full transform translate-y-2 sm:translate-y-6">
                    <MiniFutCard player={currentFormation.players[0]} position="GK" />
                 </div>
               </div>
            </div>

            {currentFormation.coach && currentFormation.coach.name && (
               <div className="mt-8 flex justify-center">
                  <div className="bg-gradient-to-r from-emerald-900 to-[#1e2a4a] border border-yellow-400/50 p-4 rounded-2xl flex items-center gap-6 pr-8 shadow-xl">
                     <div className="text-right">
                        <Badge className="bg-yellow-400 text-black font-black mb-1">أفضل مدير فني</Badge>
                        <h3 className="text-2xl font-black text-white">{currentFormation.coach.name}</h3>
                        <p className="text-cyan-300 font-bold text-sm mt-1">{currentFormation.coach.team}</p>
                     </div>
                     <div className="relative">
                        <div className="w-20 h-20 rounded-full border-2 border-yellow-400 overflow-hidden bg-[#0a1428] relative z-10">
                           {currentFormation.coach.imageUrl ? <img src={currentFormation.coach.imageUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-3xl">👨‍💼</div>}
                        </div>
                        <div className="absolute -bottom-2 -left-2 bg-gradient-to-br from-yellow-300 to-yellow-600 text-black font-black text-sm px-2 py-0.5 rounded-lg border border-yellow-700 z-20">
                           {currentFormation.coach.rating || 10}
                        </div>
                     </div>
                  </div>
               </div>
            )}
          </div>
        )}

        {activeTab === "fantasy" && (
          <div className="space-y-8 max-w-4xl mx-auto animate-in fade-in duration-500">
             <div className="text-center mb-8"><h2 className="text-4xl font-black text-teal-400 drop-shadow-lg">توقع واكسب 🎁</h2><p className="text-teal-100 mt-2 font-bold text-lg">توقع نتائج مباريات اليوم وادخل سحب على جوائز قيمة</p></div>
             <div className="space-y-6">
               {todayMatches.length > 0 ? todayMatches.map(m => (
                 <Card key={m.id} className="bg-[#1e2a4a] border-teal-500/50 shadow-[0_0_20px_rgba(20,184,166,0.15)] overflow-hidden">
                   <div className="bg-teal-900/40 p-4 text-center border-b border-teal-500/30"><Badge className="bg-teal-500 text-white font-bold">{m.matchLabel || m.round}</Badge></div>
                   <CardContent className="p-6">
                     <div className="flex items-center justify-center gap-4 sm:gap-8 mb-8">
                       <TeamMatchDisplay teamName={m.teamA} logoUrl={m.teamALogo} />
                       <span className="text-2xl sm:text-3xl font-black text-teal-400">VS</span>
                       <TeamMatchDisplay teamName={m.teamB} logoUrl={m.teamBLogo} />
                     </div>
                     {predictedMatches[m.id] ? (
                       <div className="bg-emerald-500/10 border border-emerald-500/50 p-4 rounded-xl text-center"><CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2" /><p className="text-emerald-400 font-bold text-lg">تم تسجيل توقعك بنجاح. حظ سعيد!</p></div>
                     ) : (
                       <div className="bg-[#0a1428] p-4 rounded-xl border border-white/5 space-y-4">
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                           <div><label className="block text-cyan-300 text-sm font-bold mb-1">الاسم الثلاثي</label><Input placeholder="اسمك بالكامل" value={predForms[m.id]?.name || ""} onChange={e => setPredForms(p => ({...p, [m.id]: {...(p[m.id] || {}), name: e.target.value}}))} className="bg-[#1e2a4a] border-teal-500/30 text-white font-bold" /></div>
                           <div><label className="block text-cyan-300 text-sm font-bold mb-1">رقم الموبايل</label><Input type="tel" dir="ltr" placeholder="01xxxxxxxxx" value={predForms[m.id]?.phone || ""} onChange={e => setPredForms(p => ({...p, [m.id]: {...(p[m.id] || {}), phone: e.target.value}}))} className="bg-[#1e2a4a] border-teal-500/30 text-white font-bold text-right" /></div>
                         </div>
                         <div className="flex justify-center items-center gap-6 py-4">
                           <div className="text-center"><label className="block text-white font-bold mb-2 text-sm">{m.teamA}</label><Input type="number" min="0" value={predForms[m.id]?.homeScore ?? ""} onChange={e => setPredForms(p => ({...p, [m.id]: {...(p[m.id] || {}), homeScore: e.target.value}}))} className="w-20 text-center text-2xl font-black bg-[#1e2a4a] border-teal-500 text-teal-400 h-14" /></div>
                           <div className="text-xl font-black text-gray-500">-</div>
                           <div className="text-center"><label className="block text-white font-bold mb-2 text-sm">{m.teamB}</label><Input type="number" min="0" value={predForms[m.id]?.awayScore ?? ""} onChange={e => setPredForms(p => ({...p, [m.id]: {...(p[m.id] || {}), awayScore: e.target.value}}))} className="w-20 text-center text-2xl font-black bg-[#1e2a4a] border-teal-500 text-teal-400 h-14" /></div>
                         </div>
                         <Button onClick={() => submitPrediction(m.id, `${m.teamA} vs ${m.teamB}`)} className="w-full bg-teal-500 hover:bg-teal-600 text-white font-black py-6 text-lg">إرسال التوقع 🚀</Button>
                       </div>
                     )}
                   </CardContent>
                 </Card>
               )) : <p className="text-center text-cyan-300 font-bold py-10 text-xl">لا توجد مباريات متاحة للتوقع اليوم.</p>}
             </div>
             {fantasyLeaderboard.length > 0 && (
               <Card className="bg-[#1e2a4a] border-yellow-400/30 mt-8"><CardHeader><CardTitle className="text-yellow-400 text-center">🏆 لوحة شرف التوقعات (Top 10)</CardTitle></CardHeader><CardContent><div className="space-y-2">{fantasyLeaderboard.map((user:any, i:number) => (<div key={i} className="flex justify-between items-center p-3 bg-[#0a1428] rounded-xl border border-white/5"><div className="flex items-center gap-3"><span className={`font-black w-6 text-center ${i===0?'text-yellow-400 text-xl':i===1?'text-gray-300':i===2?'text-amber-600':'text-cyan-600'}`}>{i+1}</span><span className="font-bold text-white">{user.name}</span></div><Badge className="bg-yellow-400 text-black font-black">{user.points} نقطة</Badge></div>))}</div></CardContent></Card>
             )}
          </div>
        )}

        {activeTab === "knockout" && (
          <div className="space-y-12 animate-in fade-in duration-500">
            {activeTournament === "youth" ? (
              <>
                 <div className="bg-[#13213a] p-6 rounded-3xl border border-yellow-400/30 overflow-x-auto relative min-h-[500px]">
                    <h3 className="text-center text-2xl font-black text-yellow-300 mb-8 border-b border-white/10 pb-4">الأدوار الإقصائية (الشباب)</h3>
                    <div className="flex flex-col md:flex-row justify-center gap-4 min-w-[800px]">
                       <div className="flex-1 space-y-6 flex flex-col justify-around relative">
                         {[{l:"م 1",d:youthTree.r1,t1:youthTree.getT(1),t2:"الفائز من م 104"}, {l:"م 2",d:youthTree.r2,t1:youthTree.getT(8),t2:"الفائز من م 97"}, {l:"م 3",d:youthTree.r3,t1:youthTree.getT(4),t2:"الفائز من م 101"}, {l:"م 4",d:youthTree.r4,t1:youthTree.getT(5),t2:"الفائز من م 100"}].map((m, i) => <TreeMatchBox key={i} label={m.l} t1={m.t1} t2={m.t2} data={m.d} />)}
                         <div className="absolute right-[-1rem] top-[12.5%] h-[75%] border-r-2 border-y-2 border-yellow-400/30 rounded-r-xl w-4 pointer-events-none hidden md:block"></div>
                       </div>
                       <div className="flex-1 space-y-12 flex flex-col justify-around py-12 relative">
                         <TreeMatchBox label="مربع 1" t1={youthTree.r1.win||"الفائز (م 1)"} t2={youthTree.r2.win||"الفائز (م 2)"} data={youthTree.q1} />
                         <TreeMatchBox label="مربع 2" t1={youthTree.r3.win||"الفائز (م 3)"} t2={youthTree.r4.win||"الفائز (م 4)"} data={youthTree.q2} />
                         <div className="absolute right-[-1rem] top-[25%] h-[50%] border-r-2 border-y-2 border-yellow-400/30 rounded-r-xl w-4 pointer-events-none hidden md:block"></div>
                       </div>
                       <div className="flex-1 space-y-24 flex flex-col justify-around py-24 relative">
                         <TreeMatchBox label="نصف 1" t1={youthTree.q1.win||"الفائز مربع 1"} t2={youthTree.q2.win||"الفائز مربع 2"} data={youthTree.s1} />
                       </div>
                       <div className="flex-1 flex flex-col justify-center transform scale-110 z-10 px-4">
                         <div className="absolute -inset-4 bg-yellow-400/10 blur-xl rounded-full"></div>
                         <TreeMatchBox label="النهائي 🏆" t1={youthTree.s1.win||"الطرف الأول"} t2={youthTree.s2.win||"الطرف الثاني"} data={youthTree.f1} />
                       </div>
                       <div className="flex-1 space-y-24 flex flex-col justify-around py-24 relative">
                         <TreeMatchBox label="نصف 2" t1={youthTree.q3.win||"الفائز مربع 3"} t2={youthTree.q4.win||"الفائز مربع 4"} data={youthTree.s2} />
                       </div>
                       <div className="flex-1 space-y-12 flex flex-col justify-around py-12 relative">
                         <TreeMatchBox label="مربع 3" t1={youthTree.r5.win||"الفائز (م 5)"} t2={youthTree.r6.win||"الفائز (م 6)"} data={youthTree.q3} />
                         <TreeMatchBox label="مربع 4" t1={youthTree.r7.win||"الفائز (م 7)"} t2={youthTree.r8.win||"الفائز (م 8)"} data={youthTree.q4} />
                         <div className="absolute left-[-1rem] top-[25%] h-[50%] border-l-2 border-y-2 border-yellow-400/30 rounded-l-xl w-4 pointer-events-none hidden md:block"></div>
                       </div>
                       <div className="flex-1 space-y-6 flex flex-col justify-around relative">
                         {[{l:"م 5",d:youthTree.r5,t1:youthTree.getT(2),t2:"الفائز من م 103"}, {l:"م 6",d:youthTree.r6,t1:youthTree.getT(7),t2:"الفائز من م 98"}, {l:"م 7",d:youthTree.r7,t1:youthTree.getT(3),t2:"الفائز من م 102"}, {l:"م 8",d:youthTree.r8,t1:youthTree.getT(6),t2:"الفائز من م 99"}].map((m, i) => <TreeMatchBox key={i} label={m.l} t1={m.t1} t2={m.t2} data={m.d} />)}
                         <div className="absolute left-[-1rem] top-[12.5%] h-[75%] border-l-2 border-y-2 border-yellow-400/30 rounded-l-xl w-4 pointer-events-none hidden md:block"></div>
                       </div>
                    </div>
                 </div>
                 <div className="bg-[#13213a] p-6 rounded-3xl border border-cyan-500/30">
                    <h3 className="text-center text-xl font-bold text-cyan-300 mb-6">مباريات الملحق المؤهلة لدور الـ 16</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {[{l:"م 97",d:youthTree.p97,t1:"اسماك باسط العوامي",t2:"اصدقاء عز بوالمجدوبة"}, {l:"م 98",d:youthTree.p98,t1:"السلوم",t2:"اصدقاء عيسي المغواري"}, {l:"م 99",d:youthTree.p99,t1:"17 فبراير",t2:"الفهود"}, {l:"م 100",d:youthTree.p100,t1:"اصدقاء قسم الله",t2:"اصدقاء سلامة بدر"}, {l:"م 101",d:youthTree.p101,t1:"ايس كريم الملكة",t2:"غوط رباح"}, {l:"م 102",d:youthTree.p102,t1:"محاربي الصحراء",t2:"اصدقاء خالد"}, {l:"م 103",d:youthTree.p103,t1:"ام القبائل",t2:"شباب القناشات"}, {l:"م 104",d:youthTree.p104,t1:"اتحاد المثاني",t2:"دبي للزي العربي"}].map((m,i) => <TreeMatchBox key={i} label={m.l} t1={m.t1} t2={m.t2} data={m.d} />)}
                    </div>
                 </div>
              </>
            ) : (
              <div className="bg-[#13213a] p-6 rounded-3xl border border-cyan-500/30 overflow-x-auto relative min-h-[400px]">
                 <h3 className="text-center text-2xl font-black text-cyan-400 mb-8 border-b border-white/10 pb-4">الأدوار الإقصائية (الناشئين)</h3>
                 <div className="flex flex-col md:flex-row justify-center gap-4 min-w-[700px]">
                    <div className="flex-1 space-y-8 flex flex-col justify-around relative">
                      <TreeMatchBox label="مربع 1" t1={juniorsTree.ja1} t2={juniorsTree.jb4} data={juniorsTree.q1} />
                      <TreeMatchBox label="مربع 2" t1={juniorsTree.jb2} t2={juniorsTree.ja3} data={juniorsTree.q2} />
                      <div className="absolute right-[-1rem] top-[25%] h-[50%] border-r-2 border-y-2 border-cyan-500/30 rounded-r-xl w-4 pointer-events-none hidden md:block"></div>
                    </div>
                    <div className="flex-1 space-y-16 flex flex-col justify-around py-16 relative">
                      <TreeMatchBox label="نصف 1" t1={juniorsTree.q1.win||"الفائز مربع 1"} t2={juniorsTree.q2.win||"الفائز مربع 2"} data={juniorsTree.s1} />
                    </div>
                    <div className="flex-1 flex flex-col justify-center transform scale-110 z-10 px-4">
                      <div className="absolute -inset-4 bg-cyan-500/10 blur-xl rounded-full"></div>
                      <TreeMatchBox label="النهائي 🏅" t1={juniorsTree.s1.win||"الطرف الأول"} t2={juniorsTree.s2.win||"الطرف الثاني"} data={juniorsTree.f1} />
                    </div>
                    <div className="flex-1 space-y-16 flex flex-col justify-around py-16 relative">
                      <TreeMatchBox label="نصف 2" t1={juniorsTree.q3.win||"الفائز مربع 3"} t2={juniorsTree.q4.win||"الفائز مربع 4"} data={juniorsTree.s2} />
                    </div>
                    <div className="flex-1 space-y-8 flex flex-col justify-around relative">
                      <TreeMatchBox label="مربع 3" t1={juniorsTree.jb1} t2={juniorsTree.ja4} data={juniorsTree.q3} />
                      <TreeMatchBox label="مربع 4" t1={juniorsTree.ja2} t2={juniorsTree.jb3} data={juniorsTree.q4} />
                      <div className="absolute left-[-1rem] top-[25%] h-[50%] border-l-2 border-y-2 border-cyan-500/30 rounded-l-xl w-4 pointer-events-none hidden md:block"></div>
                    </div>
                 </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "live" && (
          <div className="space-y-6">
            {liveMatches.length === 0 ? (
               <Card className="bg-[#13213a] border border-dashed border-yellow-400/50 py-16 text-center"><CardContent><Clock className="mx-auto h-12 w-12 text-yellow-400 mb-4 opacity-50" /><p className="text-2xl text-cyan-300 font-bold">لا توجد مباريات جارية حالياً</p><p className="text-gray-400 mt-2">تابع جدول مباريات اليوم لمعرفة المواعيد</p></CardContent></Card>
            ) : (
               liveMatches.map(match => (
                 <Card key={match.id} className={`bg-gradient-to-br from-[#1e2a4a] to-[#13213a] overflow-hidden border-2 shadow-2xl relative ${match.status === 'ستبدأ بعد قليل' ? 'border-emerald-500' : 'border-red-500'}`}>
                   {match.status !== 'ستبدأ بعد قليل' && <div className="absolute top-0 right-0 w-32 h-32 bg-red-600 rounded-bl-full -z-10 blur-3xl opacity-20 animate-pulse"></div>}
                   <div className={`${match.status === 'ستبدأ بعد قليل' ? 'bg-emerald-600' : 'bg-red-600'} text-white px-4 py-2 font-black flex justify-between items-center text-sm md:text-base`}>
                      <span className="flex items-center gap-2">{match.status === 'ستبدأ بعد قليل' ? <><Clock className="h-4 w-4"/> قريباً</> : <><span className="w-2 h-2 rounded-full bg-white animate-ping"></span> مباشر</>}</span>
                      <Badge className="bg-black/30 text-white border border-white/20 px-3 py-1">{match.status || "الشوط الأول"}</Badge>
                      <span className="font-mono bg-black/40 px-3 py-1 rounded-lg border border-white/20 tracking-wider" dir="ltr">{match.status === 'ستبدأ بعد قليل' ? '00:00' : `${getAccurateLiveMinute(match)}'`}</span>
                   </div>
                   <CardContent className="p-6 md:p-8">
                     <div className="flex items-center justify-center gap-4 sm:gap-8 mb-8 relative z-10">
                        <TeamMatchDisplay teamName={match.teamA} logoUrl={match.teamALogo} />
                        <div className="flex flex-col items-center">
                           <div className="bg-[#0a1428] rounded-2xl py-3 px-6 sm:px-8 border-2 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)] min-w-[120px] sm:min-w-[160px] flex justify-center">
                              {renderMatchScore(match)}
                           </div>
                           {(match.redCardsHome > 0 || match.redCardsAway > 0) && (
                              <div className="flex gap-4 mt-3" dir="ltr">
                                 <span className="text-red-500 font-bold bg-red-500/10 px-2 rounded">{match.redCardsAway > 0 && "🟥".repeat(match.redCardsAway)}</span>
                                 <span className="text-red-500 font-bold bg-red-500/10 px-2 rounded">{match.redCardsHome > 0 && "🟥".repeat(match.redCardsHome)}</span>
                              </div>
                           )}
                        </div>
                        <TeamMatchDisplay teamName={match.teamB} logoUrl={match.teamBLogo} />
                     </div>
                     {match.liveEvents && match.liveEvents.length > 0 && (
                        <div className="mt-8 bg-[#0a1428] rounded-2xl p-4 border border-white/5 shadow-inner">
                           <h4 className="text-cyan-400 font-bold mb-4 flex items-center gap-2 border-b border-white/5 pb-2"><Activity className="h-5 w-5"/> أحداث المباراة</h4>
                           <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                              {[...match.liveEvents].sort((a,b)=>b.minute - a.minute).map((ev:any, i:number) => (
                                 <div key={i} className="flex items-center gap-3 bg-[#1e2a4a] p-3 rounded-xl border border-white/5 animate-in slide-in-from-right-4">
                                    <span className="text-yellow-400 font-black bg-[#13213a] px-2 py-1 rounded-md text-sm border border-yellow-400/20">{ev.minute}'</span>
                                    <span className="text-xl">{getEventIcon(ev.type)}</span>
                                    <span className="text-white font-bold">{ev.text}</span>
                                 </div>
                              ))}
                           </div>
                        </div>
                     )}
                   </CardContent>
                 </Card>
               ))
            )}
          </div>
        )}

        {activeTab === "standings" && (
          <div className="animate-in fade-in duration-500">
            {activeTournament === "youth" ? (
              <Card className="bg-[#13213a] border-yellow-400/30 overflow-hidden shadow-2xl">
                 <CardHeader className="bg-[#1e2a4a] border-b border-yellow-400/20 flex flex-row justify-between items-center"><CardTitle className="text-yellow-300 flex items-center gap-2"><Trophy className="h-6 w-6"/> جدول الترتيب المجمع (الشباب)</CardTitle><Button variant="outline" size="sm" onClick={()=>setIsTableExpanded(!isTableExpanded)} className="text-yellow-400 border-yellow-400 hover:bg-yellow-400 hover:text-black">{isTableExpanded ? <Minimize className="h-4 w-4"/> : <Maximize className="h-4 w-4"/>}</Button></CardHeader>
                 <CardContent className="p-0 overflow-x-auto">
                    <table className="w-full text-center text-sm sm:text-base min-w-[700px]"><thead className="bg-[#0a1428] text-cyan-300 font-black"><tr>{STANDINGS_HEADERS.map((h, i) => <th key={i} className="py-4 px-2 border-b border-white/10">{h}</th>)}</tr></thead><tbody>{standingsYouth.slice(0, isTableExpanded ? standingsYouth.length : 8).map((row, i) => (<tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors"><td className="py-4 px-2 font-black"><span className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${zoneColor(row.rank, 'youth')} shadow-md`}>{row.rank}</span></td><td className="py-4 px-2 font-bold text-white text-right pr-4">{row.team}{row.team==="17 فبراير" && <span className="text-red-500 text-xs mr-2 block sm:inline">(-3 نقاط عقوبة)</span>}</td><td className="py-4 px-2 text-gray-300 font-bold">{row.played}</td><td className="py-4 px-2 text-emerald-400 font-bold">{row.wins}</td><td className="py-4 px-2 text-gray-400 font-bold">{row.draws}</td><td className="py-4 px-2 text-red-400 font-bold">{row.losses}</td><td className="py-4 px-2 text-cyan-400">{row.gf}</td><td className="py-4 px-2 text-rose-400">{row.ga}</td><td className="py-4 px-2 text-yellow-300 font-bold" dir="ltr">{row.gd > 0 ? `+${row.gd}` : row.gd}</td><td className="py-4 px-2 font-black text-yellow-400 text-lg bg-yellow-400/5">{row.points}</td></tr>))}</tbody></table>
                 </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 {[ { title: "المجموعة الأولى (أ)", data: standingsJunA }, { title: "المجموعة الثانية (ب)", data: standingsJunB } ].map((group, idx) => (
                    <Card key={idx} className="bg-[#13213a] border-cyan-500/30 overflow-hidden shadow-2xl">
                       <CardHeader className="bg-[#1e2a4a] border-b border-cyan-500/20"><CardTitle className="text-cyan-400 flex items-center gap-2"><Trophy className="h-5 w-5"/> {group.title}</CardTitle></CardHeader>
                       <CardContent className="p-0 overflow-x-auto">
                          <table className="w-full text-center text-sm min-w-[500px]"><thead className="bg-[#0a1428] text-gray-300 font-black"><tr>{STANDINGS_HEADERS.filter(h => h !== "له" && h !== "عليه" && h !== "فارق").map((h, i) => <th key={i} className="py-3 px-2 border-b border-white/10">{h}</th>)}</tr></thead><tbody>{group.data.map((row, i) => (<tr key={i} className="border-b border-white/5 hover:bg-white/5"><td className="py-3 px-2 font-black"><span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${zoneColor(row.rank, 'juniors')} text-xs`}>{row.rank}</span></td><td className="py-3 px-2 font-bold text-white text-right">{row.team}</td><td className="py-3 px-2 text-gray-300">{row.played}</td><td className="py-3 px-2 text-emerald-400">{row.wins}</td><td className="py-3 px-2 text-gray-400">{row.draws}</td><td className="py-3 px-2 text-red-400">{row.losses}</td><td className="py-3 px-2 font-black text-cyan-400 bg-cyan-500/5">{row.points}</td></tr>))}</tbody></table>
                       </CardContent>
                    </Card>
                 ))}
              </div>
            )}
          </div>
        )}

        {["today", "tomorrow"].includes(activeTab) && (
          <div className="space-y-4 animate-in fade-in duration-500">
             {(activeTab === "today" ? todayMatches : tomorrowMatches).length === 0 ? (
                <div className="text-center py-16 bg-[#13213a] rounded-3xl border border-dashed border-white/10"><Calendar className="mx-auto h-12 w-12 text-gray-500 mb-4" /><p className="text-xl text-gray-400 font-bold">لا توجد مباريات مجدولة {activeTab === "today" ? "اليوم" : "غداً"}</p></div>
             ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {(activeTab === "today" ? todayMatches : tomorrowMatches).map(m => (
                    <Card key={m.id} className="bg-[#1e2a4a] border-yellow-400/30 hover:border-yellow-400/60 transition-colors shadow-lg overflow-hidden group">
                      <div className="bg-[#0a1428] px-4 py-2 flex justify-between items-center border-b border-white/5"><Badge className="bg-yellow-400 text-black font-bold">{m.matchLabel || m.round}</Badge><span className="text-cyan-300 font-bold text-sm flex items-center gap-1"><Clock className="h-4 w-4"/> {formatTime12(m.time)}</span></div>
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between gap-2">
                           <TeamMatchDisplay teamName={m.teamA} logoUrl={m.teamALogo} />
                           <div className="flex flex-col items-center justify-center px-4"><span className="text-3xl font-black text-white/20 group-hover:text-yellow-400/50 transition-colors">VS</span><Badge variant="outline" className="mt-2 border-white/10 text-gray-400 whitespace-nowrap">{m.date}</Badge></div>
                           <TeamMatchDisplay teamName={m.teamB} logoUrl={m.teamBLogo} />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
             )}
          </div>
        )}

        {activeTab === "all" && (
          <div className="space-y-6 animate-in fade-in duration-500">
             <div className="relative max-w-md mx-auto mb-8"><Search className="absolute right-4 top-1/2 -translate-y-1/2 text-yellow-400 h-5 w-5" /><Input placeholder="ابحث باسم الفريق..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-4 pr-12 py-6 bg-[#13213a] border-yellow-400/50 text-white font-bold rounded-2xl text-lg shadow-inner focus-visible:ring-yellow-400" /></div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {finishedMatches.filter(m => String(m.teamA || "").includes(search) || String(m.teamB || "").includes(search)).map(m => (
                 <Card key={m.id} className="bg-[#1e2a4a] border-white/10 hover:border-cyan-500/50 transition-all shadow-md group">
                   <div className="text-center py-2 bg-[#0a1428] text-gray-400 text-xs font-bold border-b border-white/5">{getArabicDay(m.date)} • {m.date}</div>
                   <CardContent className="p-4">
                     <div className="text-center mb-4"><Badge className="bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">{m.matchLabel || m.round}</Badge></div>
                     <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 text-center"><div className="font-bold text-white text-sm sm:text-base leading-tight mb-2 truncate" title={m.teamA}>{m.teamA}</div></div>
                        <div className="bg-[#0a1428] rounded-xl py-2 px-4 border border-white/10 text-white shadow-inner shrink-0 group-hover:border-cyan-500/50 transition-colors">{renderMatchScore(m)}</div>
                        <div className="flex-1 text-center"><div className="font-bold text-white text-sm sm:text-base leading-tight mb-2 truncate" title={m.teamB}>{m.teamB}</div></div>
                     </div>
                   </CardContent>
                 </Card>
               ))}
               {finishedMatches.length === 0 && <div className="col-span-full text-center py-10 text-gray-400 font-bold">لا توجد نتائج سابقة حتى الآن.</div>}
             </div>
          </div>
        )}

        {activeTab === "stats" && (
          <div className="space-y-6 animate-in fade-in duration-500">
             <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
               {[ { l:"مباريات لُعبت", v:statsData.totalMatches, i:<Activity className="h-6 w-6 text-blue-400"/>, c:"border-blue-500/30 bg-blue-500/10" }, { l:"إجمالي الأهداف", v:statsData.totalGoals, i:<Target className="h-6 w-6 text-emerald-400"/>, c:"border-emerald-500/30 bg-emerald-500/10" }, { l:"معدل التهديف", v:`${statsData.goalsPerMatch} / م`, i:<Zap className="h-6 w-6 text-yellow-400"/>, c:"border-yellow-400/30 bg-yellow-400/10" }, { l:"كروت صفراء", v:statsData.totalYellow, i:<div className="w-5 h-6 bg-yellow-400 rounded-sm rotate-12 shadow-sm"></div>, c:"border-yellow-400/30 bg-[#1e2a4a]" }, { l:"كروت حمراء", v:statsData.totalRed, i:<div className="w-5 h-6 bg-red-500 rounded-sm -rotate-12 shadow-sm"></div>, c:"border-red-500/30 bg-[#1e2a4a]" }, { l:"تعادلات سلبية", v:`${statsData.draws00} (${statsData.draws00Percent}%)`, i:<ShieldAlert className="h-6 w-6 text-gray-400"/>, c:"border-white/10 bg-white/5" }, { l:"تعادلات إيجابية", v:`${statsData.drawsPositive} (${statsData.drawsPosPercent}%)`, i:<Users className="h-6 w-6 text-cyan-400"/>, c:"border-cyan-500/30 bg-cyan-500/10" } ].map((s,i)=><Card key={i} className={`border ${s.c} backdrop-blur-sm shadow-lg`}><CardContent className="p-4 sm:p-6 flex items-center gap-4"><div className="p-3 bg-[#0a1428] rounded-2xl shadow-inner shrink-0">{s.i}</div><div><div className="text-gray-400 text-xs sm:text-sm font-bold mb-1">{s.l}</div><div className="text-white font-black text-xl sm:text-2xl" dir="ltr">{s.v}</div></div></CardContent></Card>)}
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <Card className="bg-[#1e2a4a] border-emerald-500/30 shadow-xl"><CardHeader className="bg-emerald-500/10 border-b border-emerald-500/20"><CardTitle className="text-emerald-400 text-lg flex items-center gap-2"><Target className="h-5 w-5"/> الأقوى هجومياً</CardTitle></CardHeader><CardContent className="p-6 flex justify-between items-center"><span className="text-2xl font-black text-white">{statsData.bestAttack.team}</span><Badge className="bg-emerald-500 text-white text-lg px-4 py-1">{statsData.bestAttack.gf} هدف</Badge></CardContent></Card>
                <Card className="bg-[#1e2a4a] border-cyan-500/30 shadow-xl"><CardHeader className="bg-cyan-500/10 border-b border-cyan-500/20"><CardTitle className="text-cyan-400 text-lg flex items-center gap-2"><Shield className="h-5 w-5"/> الأقوى دفاعياً</CardTitle></CardHeader><CardContent className="p-6 flex justify-between items-center"><span className="text-2xl font-black text-white">{statsData.bestDefense.team}</span><Badge className="bg-cyan-500 text-white text-lg px-4 py-1">استقبل {statsData.bestDefense.ga}</Badge></CardContent></Card>
                <Card className="bg-[#1e2a4a] border-red-500/30 shadow-xl"><CardHeader className="bg-red-500/10 border-b border-red-500/20"><CardTitle className="text-red-400 text-lg flex items-center gap-2"><Target className="h-5 w-5 opacity-50"/> الأضعف هجومياً</CardTitle></CardHeader><CardContent className="p-6 flex justify-between items-center"><span className="text-2xl font-black text-white">{statsData.worstAttack.team}</span><Badge className="bg-red-500 text-white text-lg px-4 py-1">{statsData.worstAttack.gf} هدف</Badge></CardContent></Card>
                <Card className="bg-[#1e2a4a] border-orange-500/30 shadow-xl"><CardHeader className="bg-orange-500/10 border-b border-orange-500/20"><CardTitle className="text-orange-400 text-lg flex items-center gap-2"><ShieldAlert className="h-5 w-5"/> الأضعف دفاعياً</CardTitle></CardHeader><CardContent className="p-6 flex justify-between items-center"><span className="text-2xl font-black text-white">{statsData.worstDefense.team}</span><Badge className="bg-orange-500 text-white text-lg px-4 py-1">استقبل {statsData.worstDefense.ga}</Badge></CardContent></Card>
             </div>
          </div>
        )}

        {activeTab === "scorers" && (
          <div className="space-y-6 animate-in fade-in duration-500">
             <div className="text-center mb-8"><h2 className="text-4xl font-black text-yellow-300 drop-shadow-lg">صراع الهدافين 🥇</h2></div>
             <div className="relative max-w-md mx-auto mb-8"><Search className="absolute right-4 top-1/2 -translate-y-1/2 text-yellow-400 h-5 w-5" /><Input placeholder="ابحث عن هداف أو فريق..." value={searchScorers} onChange={(e) => setSearchScorers(e.target.value)} className="pl-4 pr-12 py-6 bg-[#13213a] border-yellow-400/50 text-white font-bold rounded-2xl text-lg shadow-inner focus-visible:ring-yellow-400" /></div>
             <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6 justify-items-center">
               {filteredScorers.map((s, i) => (
                 <div key={i} className="relative group">
                   {i === 0 && !searchScorers && <div className="absolute -inset-2 bg-gradient-to-r from-yellow-400 via-yellow-200 to-yellow-400 rounded-[2rem] blur-md opacity-50 animate-pulse"></div>}
                   <MiniFutCard player={{...s, rating: s.rating || 99, imageUrl: s.imageUrl || ""}} position="ST" />
                   <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-600 to-yellow-400 text-black font-black px-4 py-1 rounded-full border-2 border-[#07101f] shadow-lg whitespace-nowrap z-50 transform group-hover:scale-110 transition-transform">{s.goals} أهداف</div>
                 </div>
               ))}
               {filteredScorers.length === 0 && <div className="col-span-full text-center py-10 text-gray-400 font-bold w-full">لم يتم تسجيل أهداف حتى الآن.</div>}
             </div>
          </div>
        )}

        {activeTab === "cards" && (
          <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
             <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
                <div className="relative w-full sm:w-1/2"><Search className="absolute right-4 top-1/2 -translate-y-1/2 text-rose-400 h-5 w-5" /><Input placeholder="ابحث عن لاعب أو فريق..." value={searchCards} onChange={(e) => setSearchCards(e.target.value)} className="pl-4 pr-12 py-6 bg-[#13213a] border-rose-500/50 text-white font-bold rounded-2xl text-lg shadow-inner focus-visible:ring-rose-500" /></div>
                <div className="flex items-center gap-2 bg-[#13213a] p-2 rounded-xl border border-white/10"><Button onClick={()=>setShowArchivedCards(false)} variant={!showArchivedCards ? "default" : "ghost"} className={!showArchivedCards ? "bg-rose-600 text-white font-bold" : "text-gray-400 font-bold"}>الحالية</Button><Button onClick={()=>setShowArchivedCards(true)} variant={showArchivedCards ? "default" : "ghost"} className={showArchivedCards ? "bg-gray-600 text-white font-bold" : "text-gray-400 font-bold"}><Archive className="mr-2 h-4 w-4"/> الأرشيف</Button></div>
             </div>
             <Card className="bg-[#13213a] border-rose-500/30 overflow-hidden shadow-2xl">
               <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full text-center text-sm sm:text-base min-w-[600px]"><thead className="bg-[#1e2a4a] text-gray-300 font-black"><tr><th className="py-4 px-4 border-b border-white/5 text-right">اللاعب</th><th className="py-4 px-4 border-b border-white/5 text-right">الفريق</th><th className="py-4 px-4 border-b border-white/5"><div className="flex justify-center"><div className="w-4 h-5 bg-yellow-400 rounded-sm shadow-sm"></div></div></th><th className="py-4 px-4 border-b border-white/5"><div className="flex justify-center"><div className="w-4 h-5 bg-red-500 rounded-sm shadow-sm"></div></div></th><th className="py-4 px-4 border-b border-white/5">الحالة</th></tr></thead><tbody>{filteredCardsList.map((c, i) => (<tr key={i} className="border-b border-white/5 hover:bg-[#1e2a4a]/50 transition-colors"><td className="py-4 px-4 text-white font-bold text-right">{c.player}</td><td className="py-4 px-4 text-cyan-300 font-bold text-right">{c.team}</td><td className="py-4 px-4 font-black text-yellow-400">{c.yellow > 0 ? c.yellow : '-'}</td><td className="py-4 px-4 font-black text-red-500">{c.red > 0 ? c.red : '-'}</td><td className="py-4 px-4"><Badge className={`${c.status === 'طرد' || c.status === 'إيقاف' ? 'bg-red-500/20 text-red-400 border border-red-500/50' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'} font-bold px-3 py-1`}>{c.status}</Badge></td></tr>))}</tbody></table>
                  {filteredCardsList.length === 0 && <div className="text-center py-10 text-gray-400 font-bold">لا توجد بطاقات مسجلة.</div>}
               </CardContent>
             </Card>
          </div>
        )}

        {activeTab === "motm_tab" && (
          <div className="space-y-8 animate-in fade-in duration-500">
             <div className="text-center mb-10"><h2 className="text-4xl font-black text-yellow-300 drop-shadow-lg flex items-center justify-center gap-3"><Star className="h-8 w-8 text-yellow-400 fill-yellow-400"/> نجوم المباريات <Star className="h-8 w-8 text-yellow-400 fill-yellow-400"/></h2><p className="text-yellow-100/70 mt-2 font-bold text-lg">الأفضل في كل مباراة بناءً على اختيار اللجنة الفنية</p></div>
             {topMotmPlayer && (
               <div className="max-w-2xl mx-auto mb-12">
                 <div className="bg-gradient-to-b from-yellow-400/20 to-[#13213a] p-1 rounded-3xl relative overflow-hidden shadow-[0_0_30px_rgba(250,204,21,0.2)]">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400 rounded-full blur-3xl opacity-20 animate-pulse"></div>
                   <div className="bg-[#1e2a4a] rounded-[1.4rem] p-6 text-center border border-yellow-400/30 flex flex-col sm:flex-row items-center justify-between gap-6 relative z-10">
                     <div className="text-right flex-1">
                        <Badge className="bg-yellow-400 text-black font-black text-sm mb-2 px-3 py-1">👑 رجل البطولة حتى الآن</Badge>
                        <h3 className="text-3xl font-black text-white leading-tight">{topMotmPlayer.name}</h3>
                        <p className="text-cyan-300 font-bold text-lg mt-1">{topMotmPlayer.team}</p>
                        <div className="mt-4 inline-flex items-center gap-2 bg-[#0a1428] px-4 py-2 rounded-xl border border-yellow-400/30"><span className="text-yellow-400 font-black text-xl">{topMotmPlayer.count}</span><span className="text-gray-300 font-bold text-sm">مرات فوز بلقب MOTM</span></div>
                     </div>
                     <div className="shrink-0 relative">
                        <div className="absolute inset-0 bg-yellow-400 blur-xl opacity-30 rounded-full"></div>
                        {topMotmPlayer.imageUrl ? <img src={topMotmPlayer.imageUrl} className="w-32 h-32 rounded-full border-4 border-yellow-400 object-cover relative z-10" /> : <div className="w-32 h-32 rounded-full border-4 border-yellow-400 bg-[#0a1428] flex items-center justify-center text-5xl relative z-10">👤</div>}
                        <div className="absolute -bottom-3 -right-3 bg-[#0a1428] p-1.5 rounded-full border-2 border-yellow-400 z-20 shadow-lg"><Star className="h-6 w-6 text-yellow-400 fill-yellow-400" /></div>
                     </div>
                   </div>
                 </div>
               </div>
             )}
             <div className="relative max-w-md mx-auto mb-8"><Search className="absolute right-4 top-1/2 -translate-y-1/2 text-yellow-400 h-5 w-5" /><Input placeholder="ابحث باسم اللاعب أو الفريق..." value={searchMotm} onChange={(e) => setSearchMotm(e.target.value)} className="pl-4 pr-12 py-6 bg-[#13213a] border-yellow-400/50 text-white font-bold rounded-2xl text-lg shadow-inner focus-visible:ring-yellow-400" /></div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {motmList.filter(m => String(m.player||"").includes(searchMotm) || String(m.team||"").includes(searchMotm)).map(m => (
                 <Card key={m.id} className="bg-gradient-to-br from-[#1e2a4a] to-[#0a1428] border-yellow-400/30 overflow-hidden shadow-xl hover:border-yellow-400/60 transition-all hover:-translate-y-1 group">
                   <CardContent className="p-0">
                     <div className="bg-yellow-400 text-black text-center py-2 font-black text-sm tracking-wide border-b border-yellow-500 shadow-md relative z-10">نجم المباراة 🌟</div>
                     <div className="p-6">
                        <div className="flex justify-between items-start mb-6">
                           <div className="flex-1 ml-4">
                              <h4 className="text-xl font-black text-white mb-1 group-hover:text-yellow-300 transition-colors">{m.player}</h4>
                              <p className="text-cyan-400 font-bold text-sm mb-3">{m.team}</p>
                              <div className="bg-white/5 border border-white/10 rounded-lg p-2 text-center text-xs text-gray-300 font-bold mb-3">{m.matchName}</div>
                              {m.sponsorName && (
                                <div className="flex items-center gap-2 mt-4 opacity-70">
                                   <span className="text-[10px] text-gray-400 whitespace-nowrap">برعاية</span>
                                   {m.sponsorLogo ? <img src={m.sponsorLogo} alt={m.sponsorName} className="h-6 object-contain max-w-[80px]" /> : <span className="text-xs text-yellow-500/70 font-bold truncate">{m.sponsorName}</span>}
                                </div>
                              )}
                           </div>
                           <div className="relative shrink-0">
                              <div className="w-20 h-20 rounded-full border-2 border-yellow-400/50 overflow-hidden bg-[#0a1428] shadow-inner group-hover:border-yellow-400 transition-colors">
                                 {m.imageUrl ? <img src={m.imageUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-3xl opacity-50">👤</div>}
                              </div>
                              <div className="absolute -bottom-2 -left-2 bg-gradient-to-br from-yellow-300 to-yellow-600 text-black font-black text-xs px-2 py-0.5 rounded-md border border-yellow-700 shadow-sm">{m.rating || 99}</div>
                           </div>
                        </div>
                     </div>
                   </CardContent>
                 </Card>
               ))}
               {motmList.length === 0 && <div className="col-span-full text-center py-10 text-gray-400 font-bold">لا يوجد نجوم مسجلين حالياً.</div>}
             </div>
          </div>
        )}

        {activeTab === "shop" && (
          <div className="space-y-8 animate-in fade-in duration-500 max-w-6xl mx-auto">
             <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8 bg-gradient-to-r from-[#1e2a4a] to-[#13213a] p-6 rounded-3xl border border-yellow-400/30 shadow-xl">
               <div className="text-center md:text-right">
                  <h2 className="text-3xl font-black text-yellow-300 mb-2">متجر هيرو سبورت 🛒</h2>
                  <p className="text-cyan-300 font-bold">تسوق أحدث المنتجات والمعدات الرياضية</p>
               </div>
               <div className="bg-[#0a1428] p-4 rounded-2xl border border-yellow-400/20 text-center min-w-[200px]">
                  <p className="text-gray-400 text-sm font-bold mb-1">الإجمالي</p>
                  <p className="text-3xl font-black text-yellow-400">{cartTotal} ج.م</p>
               </div>
             </div>
             {cartItems.length > 0 && (
                <Card className="bg-[#1e2a4a] border-yellow-400/50 mb-8 overflow-hidden shadow-2xl">
                   <div className="bg-yellow-400 text-black font-black py-3 px-6 text-lg border-b border-yellow-500">سلة المشتريات ({cartItems.length} منتجات)</div>
                   <CardContent className="p-0">
                      <div className="max-h-64 overflow-y-auto custom-scrollbar">
                         {cartItems.map((item, i) => (
                           <div key={i} className="flex items-center justify-between p-4 border-b border-white/5 bg-[#13213a]/50">
                              <div className="flex flex-1 items-center gap-4">
                                 {item.imageUrl ? <img src={item.imageUrl} className="w-16 h-16 rounded-xl object-cover border border-white/10" /> : <div className="w-16 h-16 rounded-xl bg-[#0a1428] border border-white/10 flex items-center justify-center text-xl">🛍️</div>}
                                 <div><h4 className="font-bold text-white text-lg">{item.title}</h4><p className="text-cyan-400 font-black">{item.price} ج.م</p></div>
                              </div>
                              <div className="flex items-center gap-3 bg-[#0a1428] p-1.5 rounded-xl border border-white/10">
                                 <Button size="sm" variant="outline" onClick={()=>updateCartQty(item.id, item.qty - 1)} className="h-8 w-8 p-0 border-none text-white hover:bg-white/10 font-black">-</Button>
                                 <span className="font-black w-4 text-center text-yellow-400">{item.qty}</span>
                                 <Button size="sm" variant="outline" onClick={()=>updateCartQty(item.id, item.qty + 1)} className="h-8 w-8 p-0 border-none text-white hover:bg-white/10 font-black">+</Button>
                              </div>
                           </div>
                         ))}
                      </div>
                      <div className="p-6 bg-[#0a1428] space-y-4 border-t border-white/10">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input placeholder="الاسم بالكامل" value={checkoutForm.name} onChange={e=>setCheckoutForm(p=>({ ...p, name: e.target.value }))} className="bg-[#1e2a4a] border-white/10 text-white font-bold" />
                            <Input type="tel" dir="ltr" placeholder="رقم الهاتف للتواصل" value={checkoutForm.phone} onChange={e=>setCheckoutForm(p=>({ ...p, phone: e.target.value }))} className="bg-[#1e2a4a] border-white/10 text-white font-bold text-right" />
                            <Input placeholder="العنوان بالتفصيل" value={checkoutForm.address} onChange={e=>setCheckoutForm(p=>({ ...p, address: e.target.value }))} className="bg-[#1e2a4a] border-white/10 text-white font-bold md:col-span-2" />
                            <select value={checkoutForm.paymentMethod} onChange={e=>setCheckoutForm(p=>({ ...p, paymentMethod: e.target.value }))} className="bg-[#1e2a4a] border border-white/10 rounded-xl p-3 text-white font-bold outline-none md:col-span-2"><option value="cash">الدفع عند الاستلام (كاش)</option><option value="instapay">دفع عبر انستا باي (InstaPay)</option><option value="vodafone">دفع عبر فودافون كاش</option></select>
                            {checkoutForm.paymentMethod !== "cash" && (
                               <div className="md:col-span-2 space-y-4 p-4 border border-yellow-400/30 rounded-xl bg-yellow-400/5">
                                  <p className="text-yellow-300 font-bold text-sm">يرجى تحويل المبلغ ({cartTotal} ج.م) ثم إرفاق صورة الإيصال أو رقم العملية لتأكيد الطلب.</p>
                                  <div className="flex flex-col sm:flex-row gap-4">
                                     <Input placeholder="رقم العملية (اختياري)" value={checkoutForm.transactionRef} onChange={e=>setCheckoutForm(p=>({ ...p, transactionRef: e.target.value }))} className="bg-[#1e2a4a] border-yellow-400/50 text-white font-bold flex-1" />
                                     <div className="flex-1 relative">
                                        <input type="file" accept="image/*" onChange={e=>{
                                          const file = e.target.files?.[0];
                                          if (!file) return;
                                          if (!file.type.startsWith("image/")) return alert("يرجى اختيار صورة فقط");
                                          const reader = new FileReader();
                                          reader.onloadend = () => setCheckoutForm(p => ({ ...p, receiptImage: reader.result as string, receiptFileName: file.name }));
                                          reader.readAsDataURL(file);
                                        }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                        <div className="bg-[#1e2a4a] border border-yellow-400/50 text-white font-bold h-10 rounded-xl flex items-center justify-center px-4 overflow-hidden truncate">
                                           {checkoutForm.receiptFileName || "إرفاق صورة الإيصال 📸"}
                                        </div>
                                     </div>
                                  </div>
                               </div>
                            )}
                         </div>
                         <Button onClick={submitOrder} className="w-full bg-yellow-400 text-black font-black py-6 text-lg hover:bg-yellow-500 shadow-lg">تأكيد الطلب 🚀</Button>
                      </div>
                   </CardContent>
                </Card>
             )}
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {productsList.map((p:any) => (
                  <Card key={p.id} className="bg-[#1e2a4a] border-white/10 hover:border-yellow-400/50 transition-all overflow-hidden group flex flex-col shadow-lg">
                    <div className="relative aspect-square bg-[#0a1428] border-b border-white/5 p-4 flex items-center justify-center overflow-hidden">
                       {p.stock === 0 && <div className="absolute inset-0 bg-black/60 z-10 flex items-center justify-center"><Badge className="bg-red-500 text-white font-black text-lg px-4 py-2 transform -rotate-12 border-2 border-white/20">نفذت الكمية</Badge></div>}
                       {p.imageUrl ? <img src={p.imageUrl} alt={p.title} className="w-full h-full object-contain transform group-hover:scale-110 transition-transform duration-500" /> : <div className="text-6xl opacity-20">🛒</div>}
                    </div>
                    <CardContent className="p-5 flex flex-col flex-1">
                       <h3 className="font-bold text-white text-lg leading-tight mb-2 line-clamp-2">{p.title}</h3>
                       {p.description && <p className="text-gray-400 text-xs mb-4 line-clamp-2 leading-relaxed">{p.description}</p>}
                       <div className="mt-auto flex items-center justify-between">
                          <span className="font-black text-xl text-yellow-400">{p.price} ج.م</span>
                          <Button size="sm" onClick={()=>addToCart(p)} disabled={p.stock === 0} className="bg-white/10 text-white hover:bg-yellow-400 hover:text-black font-bold border border-white/20 hover:border-yellow-400 transition-colors px-4">إضافة</Button>
                       </div>
                    </CardContent>
                  </Card>
                ))}
                {productsList.length === 0 && <div className="col-span-full text-center py-20"><div className="text-6xl mb-4 opacity-50">🏪</div><p className="text-gray-400 font-bold text-xl">المتجر قيد التجهيز وسيتم توفير المنتجات قريباً.</p></div>}
             </div>
          </div>
        )}

        {activeTab === "media" && (
          <div className="space-y-8 animate-in fade-in duration-500">
               <div className="flex justify-center mb-8">
                 <div className="bg-[#13213a] p-1.5 rounded-2xl border border-white/10 inline-flex shadow-lg gap-1 w-full max-w-sm">
                   <button onClick={() => setMediaSubTab('news')} className={`flex-1 py-3 rounded-xl text-lg font-bold transition-all ${mediaSubTab === 'news' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>📰 الأخبار</button>
                   <button onClick={() => setMediaSubTab('videos')} className={`flex-1 py-3 rounded-xl text-lg font-bold transition-all ${mediaSubTab === 'videos' ? 'bg-red-600 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>🎥 الفيديوهات</button>
                 </div>
               </div>

               {mediaSubTab === "news" ? (
                 (() => {
                   const news = mediaItems.filter(i => i.type === "news");
                   return news.length > 0 ? (
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       {news.map(item => (
                         <Card key={item.id} className="bg-[#1e2a4a] border-white/10 overflow-hidden hover:border-blue-500/50 transition-colors shadow-lg">
                           {item.imageUrl && <div className="w-full h-48 sm:h-56 overflow-hidden"><img src={item.imageUrl} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" /></div>}
                           <CardContent className="p-6">
                             <h3 className="text-xl sm:text-2xl font-black text-white mb-3 leading-tight">{item.title}</h3>
                             <p className="text-gray-300 text-sm sm:text-base leading-relaxed mb-4">{item.body}</p>
                             {item.url && <a href={item.url} target="_blank" rel="noopener noreferrer"><Button variant="outline" className="w-full border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white font-bold">التفاصيل 🔗</Button></a>}
                           </CardContent>
                         </Card>
                       ))}
                     </div>
                   ) : <p className="text-center text-white py-10 font-bold">لا توجد أخبار حالياً</p>;
                 })()
               ) : (
                 (() => {
                   const videos = mediaItems.filter(i => i.type === "video" || i.type === "goal");
                   return videos.length > 0 ? (
                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                       {videos.map(item => {
                         const yId = getYoutubeId(item.url);
                         return yId ? (
                           <Card key={item.id} className="bg-[#1e2a4a] border-white/10 p-6 shadow-xl hover:border-red-500/50 transition-colors">
                             <Badge className="bg-cyan-500 text-white font-black mb-3">{item.type === "goal" ? "هدف" : "فيديو"}</Badge>
                             <h3 className="text-xl font-bold text-white mb-4 text-center">{item.title}</h3>
                             <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-white/10 shadow-lg"><iframe className="absolute top-0 left-0 w-full h-full" src={`https://www.youtube.com/embed/${yId}`} frameBorder="0" allowFullScreen></iframe></div>
                           </Card>
                         ) : null;
                       })}
                     </div>
                   ) : <p className="text-center text-white py-10 font-bold">لا توجد فيديوهات أو أهداف حالياً</p>;
                 })()
               )}
          </div>
        )}

        {activeTab === "settings" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl mx-auto">
            <div className="text-center mb-8">
               <h2 className="text-4xl font-black text-yellow-300 drop-shadow-lg">إعدادات المستخدم ⚙️</h2>
               <p className="text-cyan-300 mt-2 font-bold text-lg">تحكم في تجربتك داخل منصة كأس مطروح</p>
            </div>

            <Card className="bg-[#13213a] border-yellow-400/30 rounded-3xl overflow-hidden shadow-2xl">
              <CardHeader className="border-b border-white/5 bg-[#1e2a4a] py-6">
                <CardTitle className="text-2xl text-white flex items-center gap-3"><BellRing className="h-6 w-6 text-yellow-400" /> الإشعارات والتنبيهات الفورية</CardTitle>
              </CardHeader>
              <CardContent className="p-6 md:p-8 space-y-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex-1 text-center md:text-right">
                     <h3 className="text-xl font-bold text-white mb-2">تفعيل الإشعارات</h3>
                     <p className="text-gray-400 text-sm">احصل على تنبيهات فورية عند بدء المباريات، تسجيل الأهداف، أو نشر أخبار هامة.</p>
                  </div>
                  <Button onClick={handleSubscribe} className={`py-6 px-8 rounded-2xl font-black text-lg transition-all ${notificationPermission === "granted" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50" : "bg-yellow-400 text-black hover:bg-yellow-500 hover:scale-105 shadow-[0_0_15px_rgba(250,204,21,0.4)]"}`} disabled={notificationPermission === "granted"}>
                    {notificationPermission === "granted" ? <><CheckCircle2 className="ml-2 h-5 w-5" /> الإشعارات مفعلة</> : <><BellRing className="ml-2 h-5 w-5 animate-pulse" /> تفعيل الإشعارات</>}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#13213a] border-cyan-500/30 rounded-3xl overflow-hidden shadow-2xl mt-6">
              <CardHeader className="border-b border-white/5 bg-[#1e2a4a] py-6">
                <CardTitle className="text-2xl text-white flex items-center gap-3"><RefreshCw className="h-6 w-6 text-cyan-400" /> تحديث البيانات والذاكرة</CardTitle>
              </CardHeader>
              <CardContent className="p-6 md:p-8 space-y-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex-1 text-center md:text-right">
                     <h3 className="text-xl font-bold text-white mb-2">مسح الذاكرة المؤقتة (Cache)</h3>
                     <p className="text-gray-400 text-sm">استخدم هذا الخيار إذا كنت تواجه مشكلة في ظهور التحديثات الجديدة أو إذا كان التطبيق يعمل ببطء.</p>
                  </div>
                  <Button onClick={forceAppUpdate} disabled={isRefreshing} className="py-6 px-8 rounded-2xl font-black text-lg bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all hover:scale-105">
                    {isRefreshing ? <><Loader2 className="ml-2 h-5 w-5 animate-spin" /> جاري التحديث...</> : <><RefreshCw className="ml-2 h-5 w-5" /> مسح الكاش وتحديث</>}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="mt-16 border-t border-white/5 pt-6 pb-2 flex flex-col items-center justify-center text-center">
           <div className="text-gray-400 text-sm font-bold flex items-center gap-2">
              <span>إعداد وتطوير</span>
              <Badge className="bg-[#13213a] text-yellow-400 border border-yellow-400/20 px-3 py-1 font-black text-sm hover:scale-105 transition-transform cursor-default shadow-md">فتحي هيرو 🦅</Badge>
           </div>
           <div className="text-cyan-300 text-[10px] mt-2 opacity-50">Matrouh Cup © 2026</div>
        </div>

      </div>
    </div>
  );
}
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Loader2, Clock, Trophy, Target, Shield, 
  ShieldAlert, Zap, BellRing, Play, Star, Search, Gift, Maximize, Minimize, Activity, Users, Calendar, Archive, Settings, CheckCircle2, BellOff, ClipboardList, Lock, Unlock, Phone 
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
};

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
    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/5 border-2 border-white/10 flex items-center justify-center text-3xl shadow-inner overflow-hidden relative">
      {logoUrl ? (
        <img src={logoUrl} alt={teamName} className="w-full h-full object-contain p-1" />
      ) : (
        <span className="opacity-40">🛡️</span>
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
      <span className="text-xl sm:text-3xl font-black">{match.homeGoals || 0} - {match.awayGoals || 0}</span>
      {hasPenalties && <span className="text-[10px] sm:text-xs text-yellow-400 mt-1 font-bold bg-[#0a1428] px-2 py-0.5 rounded-full border border-yellow-400/30">({hPen} - {aPen} ر.ت)</span>}
    </div>
  );
};

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
  if(!player || !player.name) return <div className="w-16 h-20 md:w-24 md:h-32 bg-black/40 border-2 border-white/10 rounded-xl flex items-center justify-center text-white/30 text-sm font-bold shadow-inner backdrop-blur-sm">{position}</div>;
  return (
    <div className="relative w-16 h-24 md:w-24 md:h-[135px] transition-transform duration-300 hover:scale-110 cursor-pointer z-10 hover:z-50 drop-shadow-[0_10px_10px_rgba(0,0,0,0.6)]">
      <div className="absolute inset-0 bg-gradient-to-br from-[#f8e596] via-[#dcae3a] to-[#9b7318]" style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 88%, 50% 100%, 0% 88%)', borderRadius: '0.5rem 0.5rem 0 0', border: '1px solid rgba(255, 235, 150, 0.4)' }}>
        <div className="absolute top-1 left-1.5 flex flex-col items-center z-20">
          <span className="text-sm md:text-xl font-black text-[#3e2d14] leading-none">{player.rating || 99}</span>
          <span className="text-[7px] md:text-[9px] font-black text-[#3e2d14] tracking-wider uppercase">{position}</span>
        </div>
        <div className="absolute top-3 md:top-5 w-full flex justify-center z-10 left-0">
          <div className="w-10 h-10 md:w-[60px] md:h-[60px] rounded-full border-2 border-yellow-400 overflow-hidden bg-[#1e2a4a] shadow-inner">
            {player.imageUrl ? <img src={player.imageUrl} className="w-full h-full object-cover" alt={player.name} loading="lazy" /> : <span className="text-xl md:text-3xl opacity-40 text-white flex justify-center mt-1">👤</span>}
          </div>
        </div>
        <div className="absolute bottom-2 md:bottom-3 w-full text-center z-20 px-1">
          <div className="text-[8px] md:text-[11px] font-black text-[#3e2d14] truncate uppercase">{player.name}</div>
          <div className="text-[6px] md:text-[8px] font-bold text-[#f8e596] bg-[#3e2d14] px-1 rounded-sm truncate mt-0.5 mx-auto max-w-[90%]">{player.team}</div>
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
  const [motmList, setMotmList] = useState<any[]>([]);
  const [predictionsList, setPredictionsList] = useState<any[]>([]);
  const [formationsList, setFormationsList] = useState<any[]>([]); 
  const [rostersList, setRostersList] = useState<any[]>([]); 
  const [tickerText, setTickerText] = useState("مطروح الرياضية...");
  
  const [search, setSearch] = useState("");
  const [searchScorers, setSearchScorers] = useState("");
  const [searchCards, setSearchCards] = useState("");
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

  useEffect(() => {
    setLoading(true);
    const stored = localStorage.getItem('predictedMatches');
    if (stored) setPredictedMatches(JSON.parse(stored));

    if (typeof window !== "undefined") {
      if ("Notification" in window) {
        setNotificationPermission(Notification.permission);
      }
      
      if (window.location.hostname.includes("matrouhcup.online")) {
        (window as any).OneSignalDeferred = (window as any).OneSignalDeferred || [];
        (window as any).OneSignalDeferred.push(async function(OneSignal: any) {
          await OneSignal.init({
            appId: "d73de8b7-948e-494e-84f2-6c353efee89c",
          });
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
    const unsubTicker = onSnapshot(doc(db, "settings", "ticker"), (snap) => setTickerText(snap.data()?.text || "مطروح الرياضية..."));

    const clockTimer = setInterval(() => setTime(new Date()), 1000);

    return () => { 
        unsubMatches(); unsubGoals(); unsubCards(); unsubArchivedCards(); 
        unsubMedia(); unsubMotm(); unsubPreds(); unsubForms(); unsubRosters();
        unsubTicker(); clearInterval(clockTimer); 
    };
  }, [activeTournament]);

  const handleSubscribe = () => {
    if (typeof window !== "undefined" && (window as any).OneSignalDeferred) {
      (window as any).OneSignalDeferred.push(async function(OneSignal: any) {
        await OneSignal.Slidedown.promptPush();
        setTimeout(() => {
          if ("Notification" in window) setNotificationPermission(Notification.permission);
        }, 4000);
      });
    }
  };

  const submitPrediction = async (matchId: string, matchName: string) => { 
    const form = predForms[matchId];
    if (!form?.name || !form?.phone || form?.homeScore === undefined || form?.awayScore === undefined) return alert("يرجى إكمال الاسم، رقم الهاتف، والنتيجة!");
    try {
      await addDoc(collection(db, activeTournament === 'juniors' ? 'predictions_juniors' : 'predictions'), {
        matchId, matchName, name: form.name, phone: form.phone, homeScore: Number(form.homeScore), awayScore: Number(form.awayScore), timestamp: new Date().toISOString()
      });
      alert("تم تسجيل توقعك بنجاح! حظ سعيد 🎁");
      setPredictedMatches(p => { const np = {...p, [matchId]: true}; localStorage.setItem('predictedMatches', JSON.stringify(np)); return np; });
    } catch(e) { alert("حدث خطأ، حاول مرة أخرى."); }
  };

  const handleRosterLogin = () => {
    if(!rosterAccessTeam) return alert("الرجاء اختيار الفريق أولاً.");
    if(!rosterAccessPassword) return alert("الرجاء إدخال الرقم السري.");

    const existingTeam = rostersList.find(r => r.id === rosterAccessTeam);
    
    if (!existingTeam || !existingTeam.password) {
        return alert("❌ لم تقم إدارة البطولة بتعيين رقم سري لهذا الفريق بعد. يرجى التواصل مع اللجنة المنظمة.");
    }

    if (existingTeam.password !== rosterAccessPassword) {
        return alert("❌ الرقم السري غير صحيح! يرجى التأكد من الرقم الممنوح لك من الإدارة.");
    }

    if (existingTeam.isSubmitted) {
        return alert("⚠️ تم حفظ واعتماد قائمة هذا الفريق مسبقاً. لا يمكن التعديل عليها إلا من خلال إدارة البطولة.");
    }
    
    setUnlockedRoster(rosterAccessTeam);
    if (existingTeam && existingTeam.players) {
        const loadedPlayers = [...existingTeam.players];
        while(loadedPlayers.length < 12) loadedPlayers.push({ name: "", number: "" });
        setRosterForm({ managerName: existingTeam.managerName || "", managerPhone: existingTeam.managerPhone || "", logoUrl: existingTeam.logoUrl || "", players: loadedPlayers.slice(0,12) });
    } else {
        setRosterForm({ managerName: "", managerPhone: "", logoUrl: existingTeam?.logoUrl || "", players: Array.from({ length: 12 }, () => ({ name: "", number: "" })) });
    }
  };

  const updateRosterPlayer = (index: number, field: string, value: string) => {
    setRosterForm(prev => {
        const newPlayers = [...prev.players];
        newPlayers[index] = { ...newPlayers[index], [field]: value };
        return { ...prev, players: newPlayers };
    });
  };

  const submitFinalRoster = async () => {
    if(!rosterForm.managerName || !rosterForm.managerPhone) return alert("الرجاء إكمال بيانات مسئول الفريق (الاسم ورقم الهاتف)");
    const emptyPlayer = rosterForm.players.find(p => !p.name.trim() || !p.number.trim());
    if(emptyPlayer) return alert("الرجاء ملء بيانات جميع اللاعبين الـ 12 (الاسم ورقم التيشرت لكل لاعب)");

    if(confirm("تنبيه هام: بمجرد الضغط على تأكيد وحفظ، سيتم إرسال القائمة واعتمادها ولن تتمكن من تعديلها مرة أخرى. هل أنت متأكد من صحة البيانات؟")) {
        try {
            const suffix = activeTournament === "juniors" ? "_juniors" : "";
            await setDoc(doc(db, `team_rosters${suffix}`, unlockedRoster!), {
                teamName: unlockedRoster,
                managerName: rosterForm.managerName,
                managerPhone: rosterForm.managerPhone,
                logoUrl: rosterForm.logoUrl,
                players: rosterForm.players,
                password: rosterAccessPassword,
                isSubmitted: true,
                updatedAt: new Date().toISOString()
            }, { merge: true });
            
            alert("تم حفظ واعتماد قائمة الفريق بنجاح!");
            setUnlockedRoster(null);
            setRosterAccessTeam("");
            setRosterAccessPassword("");
            setRosterViewMode('list');
        } catch(e) {
            alert("حدث خطأ أثناء حفظ القائمة، حاول مرة أخرى.");
        }
    }
  };

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
  const tomorrowStr = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });

  const liveMatchesList = matches.filter(m => {
    if (m.isLive === true) return true;
    if (m.date === todayStr && m.time) {
      const now = time || new Date();
      const [hours, minutes] = m.time.split(':').map(Number);
      const matchTime = new Date();
      matchTime.setHours(hours, minutes, 0, 0);
      const diffMins = (matchTime.getTime() - now.getTime()) / 60000;
      if (diffMins <= 30 && !m.streamClosed) {
        return true;
      }
    }
    return false;
  });
  const liveMatches = sortMatchesAsc(liveMatchesList);
  const liveMatchIds = new Set(liveMatchesList.map(m => m.id));

  const finishedMatches = [...matches].sort((a, b) => b.date.localeCompare(a.date) || (b.time || "00:00").localeCompare(a.time || "00:00")).filter(m => !liveMatchIds.has(m.id) && (m.status === "انتهت" || m.date < todayStr));
  const todayMatches = sortMatchesAsc(matches.filter(m => !liveMatchIds.has(m.id) && m.date === todayStr && m.status !== "انتهت"));
  const tomorrowMatches = sortMatchesAsc(matches.filter(m => !liveMatchIds.has(m.id) && m.date === tomorrowStr && m.status !== "انتهت"));

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
      const playerStr = normalizeTeamName(e.player || ""); 
      const playerOriginal = String(e.player || "").trim();
      const teamStr = String(e.team || "").trim();
      if(!playerOriginal) return; 
      const key = `${playerStr}__${normalizeTeamName(teamStr)}`; 
      if (!map.has(key)) { map.set(key, { player: playerOriginal, team: teamStr, goals: 0, imageUrl: e.imageUrl || "", rating: e.rating || 99, pac: e.pac || 99, sho: e.sho || 99, pas: e.pas || 99, dri: e.dri || 99, def: e.def || 99, phy: e.phy || 99 }); }
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
    const totalMatches = finishedMatches.length;
    let totalGoals = 0, draws00 = 0, drawsPositive = 0;
    
    const teamStats = new Map<string, {team: string, gf: number, ga: number}>();
    const allTeams = activeTournament === 'youth' ? CLEANED_TEAM_NAMES : [...JUNIORS_GROUP_A, ...JUNIORS_GROUP_B];
    allTeams.forEach(t => teamStats.set(normalizeTeamName(t), { team: t, gf: 0, ga: 0 }));

    finishedMatches.forEach(m => {
      const hg = Number(m.homeGoals) || 0;
      const ag = Number(m.awayGoals) || 0;
      totalGoals += (hg + ag);
      if (hg === ag) { if (hg === 0) draws00++; else drawsPositive++; }
      
      const hNorm = normalizeTeamName(m.teamA);
      const aNorm = normalizeTeamName(m.teamB);
      if (teamStats.has(hNorm)) {
        teamStats.get(hNorm)!.gf += hg;
        teamStats.get(hNorm)!.ga += ag;
      }
      if (teamStats.has(aNorm)) {
        teamStats.get(aNorm)!.gf += ag;
        teamStats.get(aNorm)!.ga += hg;
      }
    });
    
    const totalYellow = cardEvents.reduce((acc, curr) => acc + (Number(curr.yellow) || 0), 0);
    const totalRed = cardEvents.reduce((acc, curr) => acc + (Number(curr.red) || 0), 0);
    
    const activeTeams = Array.from(teamStats.values()).filter(t => t.gf > 0 || t.ga > 0 || totalMatches > 0);
    const sortedByAttack = [...activeTeams].sort((a, b) => b.gf - a.gf);
    const sortedByDef = [...activeTeams].sort((a, b) => a.ga - b.ga); 

    return {
      totalMatches, totalGoals, draws00, drawsPositive, totalYellow, totalRed,
      bestAttack: sortedByAttack[0] || { team: "—", gf: 0 },
      worstAttack: sortedByAttack[sortedByAttack.length - 1] || { team: "—", gf: 0 },
      bestDefense: sortedByDef[0] || { team: "—", ga: 0 },
      worstDefense: sortedByDef[sortedByDef.length - 1] || { team: "—", ga: 0 },
      topScorer: scorers[0], 
      goalsPerMatch: totalMatches > 0 ? (totalGoals / totalMatches).toFixed(2) : "0",
      draws00Percent: totalMatches > 0 ? Math.round((draws00 / totalMatches) * 100) : 0,
      drawsPosPercent: totalMatches > 0 ? Math.round((drawsPositive / totalMatches) * 100) : 0,
      yellowPerMatch: totalMatches > 0 ? (totalYellow / totalMatches).toFixed(2) : "0",
      redPerMatch: totalMatches > 0 ? (totalRed / totalMatches).toFixed(2) : "0"
    };
  }, [finishedMatches, cardEvents, scorers, activeTournament]);

  const activeCardsSource = showArchivedCards ? archivedCards : cardEvents;
  
  const cardsList = useMemo(() => {
    const map = new Map<string, any>();
    activeCardsSource.forEach(e => { 
      const playerStr = normalizeTeamName(e.player || ""); 
      const playerOriginal = String(e.player || "").trim();
      if(!playerOriginal) return;
      const key = `${playerStr}__${normalizeTeamName(e.team)}`; 
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
    if (!form || !form.players) return { players: Array(7).fill(null) };
    const playersArr = Array.isArray(form.players) ? form.players : Array(7).fill(null);
    while(playersArr.length < 7) playersArr.push(null);
    return { ...form, players: playersArr };
  }, [formationsList, activeTotwRound]);

  if (loading) return <div className="min-h-screen bg-[#0a1428] flex items-center justify-center flex-col gap-4"><Loader2 className="h-16 w-16 animate-spin text-yellow-400" /><p className="text-white font-bold animate-pulse">جاري تحميل البيانات...</p></div>;

  const formattedTime = time ? time.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) : "";
  const formattedDate = time ? time.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : "";

  return (
    <div dir="rtl" className="min-h-screen bg-[#0a1428] text-white relative pb-20 font-sans">
      <div className="mx-auto max-w-7xl p-3 sm:p-4 md:p-6 lg:p-8">

        {time && (
          <div className="mb-4 rounded-3xl border border-white/10 bg-gradient-to-r from-[#1e2a4a] to-[#13213a] p-4 flex flex-col md:flex-row justify-between items-center gap-4 shadow-xl relative overflow-hidden">
             <div className="absolute inset-0 bg-yellow-400/5 blur-3xl rounded-full pointer-events-none"></div>
             <div className="flex items-center gap-3 relative z-10">
               <div className="bg-yellow-400/20 p-2.5 rounded-xl border border-yellow-400/30 shadow-inner">
                 <Calendar className="text-yellow-400 h-5 w-5" />
               </div>
               <span className="text-white font-bold text-sm sm:text-base tracking-wide">{formattedDate}</span>
             </div>
             <div className="flex items-center gap-4 relative z-10">
               <span className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-l from-yellow-200 to-yellow-500 tracking-widest drop-shadow-sm" dir="ltr">
                 {formattedTime}
               </span>
               <div className="bg-cyan-500/20 p-2.5 rounded-xl border border-cyan-500/30 shadow-inner">
                 <Clock className="text-cyan-400 h-5 w-5 animate-pulse" />
               </div>
             </div>
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
                {[
                  { name: "الفهد للديكور", src: "/alfahd.png" }, { name: "أحمد عبدالعاطي المحامي", src: "/abdelaty.png" }, { name: "دثار للزي العربي", src: "/dithar.png" },
                  { name: "معصرة فرجينيا", src: "/virginia.png" }, { name: "دبي للزي العربي", src: "/dubai.png" }, { name: "معرض الأمانة", src: "/alamana.png" },
                  { name: "تراث البادية", src: "/torath.png" }, { name: "عبدالمقصود ستورز", src: "/abdelmaksoud.png" }, { name: "مياة حياة", src: "/hayah.png" },
                  { name: "القدس للأثاث", src: "/alquds.png" }, { name: "أيس كريم الملكة", src: "/almaleka.png" }, { name: "جزارة عبدالله الجراري", src: "/aljarari.png" },
                  { name: "M MART", src: "/mmart.png" }, { name: "هيرو سبورت", src: "/hero-sport.png" }, { name: "الفتح للفراشة", src: "/alfath.png" }, { name: "عادل العميري للديكور", src: "/alomairy.png" }
                ].map((sponsor, idx) => (
                  <img key={idx} src={sponsor.src} alt={sponsor.name} title={sponsor.name} className="h-10 w-24 object-contain drop-shadow-sm transition-transform hover:scale-110 cursor-pointer" onError={(e) => (e.currentTarget.style.display = 'none')} loading="lazy" />
                ))}
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
            { key: "motm_tab", label: "نجوم الماتش", icon: "🌟", extraClass: "" }, 
            { key: "media", label: "ميديا", icon: "🎥", extraClass: "" },
            { key: "settings", label: "الإعدادات", icon: "⚙️", extraClass: "bg-gray-800 text-white shadow-lg border-gray-600" }
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex-1 sm:flex-none px-5 py-3.5 rounded-2xl font-bold text-sm sm:text-base transition-all border ${activeTab === tab.key ? (tab.extraClass || "bg-yellow-400 text-black border-yellow-400 shadow-lg scale-105") : "bg-[#1e2a4a] text-white border-yellow-400/30 hover:bg-[#25345a]"}`}>
              <span className={`text-lg ${tab.key === "live" && activeTab === "live" ? "animate-pulse" : ""}`}>{tab.icon}</span> <span className="ml-1">{tab.label}</span>
            </button>
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
                 <div className="text-center mb-6">
                    <h2 className="text-3xl font-black text-yellow-300">القوائم الرسمية للفرق المشاركة</h2>
                    <p className="text-cyan-300 mt-2 font-bold">اضغط على اسم الفريق لعرض قائمة الـ 12 لاعب المعتمدة من الإدارة</p>
                 </div>
                 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {activeTeamsList.map(teamName => {
                       const rosterData = rostersList.find(r => r.id === teamName);
                       const isSubmitted = rosterData && rosterData.isSubmitted;
                       return (
                         <Card 
                            key={teamName} 
                            onClick={() => isSubmitted && setSelectedRosterToView(rosterData)}
                            className={`border transition-all cursor-pointer overflow-hidden ${isSubmitted ? 'bg-[#1e2a4a] border-blue-500/50 hover:border-blue-400 hover:scale-105 shadow-lg' : 'bg-[#13213a] border-white/5 opacity-60 cursor-not-allowed'}`}
                         >
                            <CardContent className="p-6 flex flex-col items-center text-center justify-center h-full gap-3">
                               {rosterData?.logoUrl ? (
                                  <img src={rosterData.logoUrl} className="h-14 w-14 object-contain drop-shadow-md mb-1" alt={teamName} />
                               ) : (
                                  <Shield className={`h-10 w-10 mb-1 ${isSubmitted ? 'text-blue-400' : 'text-gray-500'}`} />
                               )}
                               <span className="font-black text-white text-lg leading-tight">{teamName}</span>
                               {isSubmitted ? (
                                  <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 mt-1 font-bold px-3"><CheckCircle2 className="h-3 w-3 mr-1" /> قائمة معتمدة</Badge>
                               ) : (
                                  <Badge className="bg-gray-800 text-gray-400 border border-gray-600 mt-1 font-bold px-3">لم تسجل بعد</Badge>
                               )}
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
                       {selectedRosterToView.logoUrl ? (
                          <div className="h-24 w-24 mx-auto mb-4 bg-white/5 rounded-full border-4 border-blue-400/50 flex items-center justify-center overflow-hidden shadow-lg p-1">
                             <img src={selectedRosterToView.logoUrl} className="max-h-full max-w-full object-contain" alt={selectedRosterToView.teamName} />
                          </div>
                       ) : (
                          <Shield className="h-16 w-16 mx-auto text-blue-400 mb-4" />
                       )}
                       <CardTitle className="text-4xl font-black text-white tracking-wide">{selectedRosterToView.teamName}</CardTitle>
                       <div className="mt-4 flex flex-col sm:flex-row justify-center gap-4 text-cyan-300 font-bold">
                          <span className="flex items-center justify-center gap-2"><Users className="h-5 w-5"/> المسئول: {selectedRosterToView.managerName}</span>
                          <span className="hidden sm:inline">•</span>
                          <span className="flex items-center justify-center gap-2" dir="ltr"><Phone className="h-5 w-5"/> {selectedRosterToView.managerPhone}</span>
                       </div>
                    </CardHeader>
                    <CardContent className="p-0">
                       <table className="w-full text-right text-white text-lg">
                          <thead className="bg-[#0a1428]">
                             <tr><th className="p-4 w-20 text-center text-cyan-400 border-b border-white/5">الرقم</th><th className="p-4 text-cyan-400 border-b border-white/5">اسم اللاعب</th></tr>
                          </thead>
                          <tbody>
                             {selectedRosterToView.players.map((p: any, i: number) => (
                               <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                 <td className="p-4 text-center font-black text-yellow-400">{p.number}</td>
                                 <td className="p-4 font-bold">{p.name}</td>
                               </tr>
                             ))}
                          </tbody>
                       </table>
                    </CardContent>
                 </Card>
               </div>
            )}

            {rosterViewMode === 'register' && !unlockedRoster && (
               <Card className="max-w-xl mx-auto bg-[#13213a] border border-emerald-500/30 rounded-3xl shadow-2xl">
                 <CardHeader className="text-center border-b border-white/5 pb-6">
                    <Lock className="mx-auto h-12 w-12 text-emerald-400 mb-4" />
                    <CardTitle className="text-2xl font-black text-white">تسجيل دخول لمسئول الفريق</CardTitle>
                    <p className="text-gray-400 text-sm mt-2 font-bold">يرجى اختيار فريقك وإدخال الرقم السري الممنوح لك من الإدارة لملء القائمة.</p>
                 </CardHeader>
                 <CardContent className="p-8 space-y-6">
                    <div>
                       <label className="block text-cyan-300 font-bold mb-2">اختر فريقك</label>
                       <select value={rosterAccessTeam} onChange={e => setRosterAccessTeam(e.target.value)} className="w-full bg-[#1e2a4a] border border-emerald-500/50 rounded-xl p-4 text-white font-bold outline-none cursor-pointer">
                          <option value="">-- اضغط للاختيار --</option>
                          {activeTeamsList.map(t => <option key={t} value={t}>{t}</option>)}
                       </select>
                    </div>
                    <div>
                       <label className="block text-cyan-300 font-bold mb-2">الرقم السري للفريق</label>
                       <Input type="password" value={rosterAccessPassword} onChange={e => setRosterAccessPassword(e.target.value)} placeholder="••••••••" className="bg-[#1e2a4a] border-emerald-500/50 text-white font-black text-center text-xl h-14 tracking-widest" />
                    </div>
                    <Button onClick={handleRosterLogin} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-7 text-xl shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-transform hover:scale-105">تسجيل الدخول للقائمة <Unlock className="ml-2 h-5 w-5" /></Button>
                 </CardContent>
               </Card>
            )}

            {rosterViewMode === 'register' && unlockedRoster && (
               <div className="max-w-4xl mx-auto animate-in fade-in duration-500">
                  <div className="bg-yellow-400/10 border border-yellow-400 text-yellow-300 p-4 rounded-2xl mb-6 text-center font-bold">
                     ⚠️ تنبيه هام: يرجى مراجعة الأسماء والأرقام بدقة. بمجرد ضغط "حفظ واعتماد" سيتم قفل القائمة ولن تتمكن من تعديلها مجدداً إلا من خلال إدارة البطولة.
                  </div>
                  <Card className="bg-[#13213a] border border-blue-500/30 rounded-3xl shadow-2xl overflow-hidden">
                     <CardHeader className="bg-[#1e2a4a] border-b border-blue-500/20 py-6">
                        <CardTitle className="text-3xl font-black text-white text-center flex items-center justify-center gap-3"><ClipboardList className="text-blue-400"/> استمارة قائمة: {unlockedRoster}</CardTitle>
                     </CardHeader>
                     <CardContent className="p-6 md:p-8 space-y-8">
                        <div className="bg-[#0a1428] p-6 rounded-2xl border border-white/5 space-y-6">
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div>
                                 <label className="block text-cyan-300 font-bold mb-2">اسم المدير الفني / مسئول الفريق</label>
                                 <Input placeholder="الاسم الثلاثي" value={rosterForm.managerName} onChange={e => setRosterForm(p => ({...p, managerName: e.target.value}))} className="bg-[#1e2a4a] border-blue-500/40 text-white font-bold h-12" />
                              </div>
                              <div>
                                 <label className="block text-cyan-300 font-bold mb-2">رقم هاتف المسئول (للتواصل)</label>
                                 <Input type="tel" dir="ltr" placeholder="01xxxxxxxxx" value={rosterForm.managerPhone} onChange={e => setRosterForm(p => ({...p, managerPhone: e.target.value}))} className="bg-[#1e2a4a] border-blue-500/40 text-white font-bold h-12 text-right" />
                              </div>
                           </div>
                           <div>
                              <label className="block text-cyan-300 font-bold mb-2">رابط شعار الفريق (اختياري)</label>
                              <Input placeholder="أدخل رابط صورة الشعار هنا..." value={rosterForm.logoUrl || ""} onChange={e => setRosterForm(p => ({...p, logoUrl: e.target.value}))} className="bg-[#1e2a4a] border-blue-500/40 text-white font-bold h-12 text-left" dir="ltr" />
                           </div>
                        </div>

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

                        <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row gap-4">
                           <Button onClick={submitFinalRoster} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black py-8 text-xl shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-transform hover:scale-105">حفظ واعتماد القائمة نهائياً ✔️</Button>
                           <Button onClick={() => setUnlockedRoster(null)} variant="outline" className="bg-transparent border-red-500 text-red-400 hover:bg-red-500 hover:text-white py-8 px-8 font-bold text-lg">إلغاء الخروج</Button>
                        </div>
                     </CardContent>
                  </Card>
               </div>
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
                <CardTitle className="text-2xl text-white flex items-center gap-3">
                  <BellRing className="h-6 w-6 text-yellow-400" /> الإشعارات والتنبيهات الفورية
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 md:p-8 space-y-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex-1 text-center md:text-right">
                    <h3 className="text-xl font-bold text-white mb-2">تلقي أحداث المباريات مباشرة</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">
                      فعل الإشعارات عشان يوصلك تنبيه فوري على موبايلك بصافرة البداية، الأهداف الحاسمة، الكروت الحمراء، وكل الأخبار العاجلة اللي بيبعتها مخرج البطولة أول بأول من أرض الملعب.
                    </p>
                  </div>
                  <div className="shrink-0">
                    {notificationPermission === "granted" ? (
                      <div className="bg-emerald-500/20 border border-emerald-500 text-emerald-400 px-6 py-3 rounded-2xl font-black flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                        <CheckCircle2 className="h-5 w-5" /> الإشعارات مفعلة
                      </div>
                    ) : notificationPermission === "denied" ? (
                      <div className="bg-red-500/20 border border-red-500 text-red-400 px-6 py-3 rounded-2xl font-black flex items-center gap-2">
                        <BellOff className="h-5 w-5" /> محظورة من المتصفح
                      </div>
                    ) : (
                      <Button onClick={handleSubscribe} className="bg-yellow-400 hover:bg-yellow-500 text-black font-black px-8 py-6 rounded-2xl text-lg shadow-[0_0_20px_rgba(250,204,21,0.4)] transition-transform hover:scale-105">
                        <BellRing className="mr-2 h-5 w-5 animate-bounce" /> تفعيل الآن
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "totw" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="bg-[#13213a] border border-yellow-400/30 p-6 rounded-3xl flex flex-col md:flex-row justify-between items-center gap-4 shadow-xl">
               <div>
                 <h2 className="text-3xl font-black text-yellow-300 flex items-center gap-2"><Users /> تشكيلة الأسبوع (سباعيات)</h2>
                 <p className="text-cyan-300 mt-1 font-bold">أفضل 7 لاعبين حسب اختيارات اللجنة المنظمة</p>
               </div>
               <select value={activeTotwRound} onChange={e => setActiveTotwRound(e.target.value)} className="bg-[#0a1428] border-2 border-emerald-500 rounded-xl p-3 text-white font-black text-lg outline-none cursor-pointer w-full md:w-64">
                 {["دور المجموعات", "الملحق", "دور الستة عشر", "دور الثمانية", "دور الأربعة (نصف النهائي)", "النهائي"].map(r => <option key={r} value={r}>{r}</option>)}
               </select>
             </div>
             <div className="w-full max-w-4xl mx-auto mt-8">
               <div className="relative w-full aspect-[3/4] md:aspect-square bg-gradient-to-t from-green-800 via-green-600 to-green-800 border-4 border-white/80 rounded-lg overflow-hidden shadow-2xl">
                 <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-1/2 left-0 w-full h-[2px] bg-white/60 -translate-y-1/2"></div>
                    <div className="absolute top-1/2 left-1/2 w-24 h-24 md:w-32 md:h-32 border-[2px] border-white/60 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
                    <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-white/60 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
                    <div className="absolute bottom-0 left-1/2 w-1/2 md:w-1/3 h-1/6 border-x-[2px] border-t-[2px] border-white/60 -translate-x-1/2"></div>
                    <div className="absolute top-0 left-1/2 w-1/2 md:w-1/3 h-1/6 border-x-[2px] border-b-[2px] border-white/60 -translate-x-1/2"></div>
                 </div>
                 <div className="absolute inset-0 p-4 md:p-8 flex flex-col justify-between z-10">
                    <div className="flex justify-center w-full mt-2 md:mt-4"><MiniFutCard player={currentFormation.players[6]} position="ST" /></div>
                    <div className="flex justify-between w-full px-2 md:px-16 -mt-8 md:-mt-10"><MiniFutCard player={currentFormation.players[3]} position="LM" /><div className="mt-8 md:mt-12"><MiniFutCard player={currentFormation.players[4]} position="CM" /></div><MiniFutCard player={currentFormation.players[5]} position="RM" /></div>
                    <div className="flex justify-around w-full px-12 md:px-32 -mt-4 md:-mt-8"><MiniFutCard player={currentFormation.players[1]} position="CB" /><MiniFutCard player={currentFormation.players[2]} position="CB" /></div>
                    <div className="flex justify-center w-full mb-2 md:mb-4"><MiniFutCard player={currentFormation.players[0]} position="GK" /></div>
                 </div>
               </div>
             </div>
          </div>
        )}

        {activeTab === "fantasy" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="bg-gradient-to-br from-emerald-900 to-[#13213a] rounded-3xl border-2 border-emerald-500 p-6 md:p-10 text-center shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                <Gift className="h-16 w-16 mx-auto text-emerald-400 mb-4 animate-bounce" />
                <h2 className="text-4xl md:text-5xl font-black text-white drop-shadow-lg mb-2">فانتزي كأس مطروح 🎁</h2>
                <p className="text-emerald-300 text-lg font-bold">توقع نتائج المباريات القادمة واكسب جوائز قيمة من رعاتنا في نهاية البطولة!</p>
                <div className="flex justify-center gap-4 mt-6 flex-wrap">
                  <Badge className="bg-emerald-500 text-white px-4 py-2 text-sm font-bold">3 نقاط للتوقع الصحيح بالمللي</Badge>
                  <Badge className="bg-teal-600 text-white px-4 py-2 text-sm font-bold">1 نقطة لتوقع الفائز فقط</Badge>
                </div>
             </div>
             <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                   <h3 className="text-2xl font-black text-yellow-300 flex items-center gap-2"><Target /> المباريات المتاحة للتوقع</h3>
                   {[...todayMatches, ...tomorrowMatches].length > 0 ? [...todayMatches, ...tomorrowMatches].map(match => (
                     <Card key={match.id} className="bg-[#13213a] border border-emerald-500/30 rounded-3xl overflow-hidden shadow-lg hover:border-emerald-500 transition-colors">
                       <div className="bg-[#1e2a4a] text-center py-2 text-cyan-300 text-sm font-bold border-b border-white/10">{getArabicDay(match.date)} • {match.date} • {formatTime12(match.time)}</div>
                       <CardContent className="p-6">
                         <div className="flex items-center justify-between mb-6">
                           <div className="flex-1 text-center font-bold text-xl text-white">{match.teamA}</div>
                           <div className="text-yellow-400 font-black px-4 text-2xl">VS</div>
                           <div className="flex-1 text-center font-bold text-xl text-white">{match.teamB}</div>
                         </div>
                         {predictedMatches[match.id] ? (
                           <div className="bg-emerald-500/20 border border-emerald-500 text-emerald-300 p-4 rounded-xl text-center font-bold text-lg">تم تسجيل توقعك بنجاح ✔️</div>
                         ) : (
                           <div className="space-y-4 bg-[#0a1428] p-4 rounded-2xl border border-white/5">
                             <div className="flex gap-4 items-center justify-center">
                               <Input type="number" placeholder="أهداف" value={predForms[match.id]?.homeScore || ""} onChange={(e) => setPredForms(p => ({...p, [match.id]: {...p[match.id], homeScore: e.target.value}}))} className="w-20 text-center text-xl font-black bg-[#1e2a4a] border-emerald-500/50 text-white" />
                               <span className="text-gray-500 font-bold">-</span>
                               <Input type="number" placeholder="أهداف" value={predForms[match.id]?.awayScore || ""} onChange={(e) => setPredForms(p => ({...p, [match.id]: {...p[match.id], awayScore: e.target.value}}))} className="w-20 text-center text-xl font-black bg-[#1e2a4a] border-emerald-500/50 text-white" />
                             </div>
                             <div className="grid grid-cols-2 gap-4 mt-4">
                               <Input placeholder="اسمك الثلاثي" value={predForms[match.id]?.name || ""} onChange={(e) => setPredForms(p => ({...p, [match.id]: {...p[match.id], name: e.target.value}}))} className="bg-[#1e2a4a] border-white/10 text-white text-center" />
                               <Input placeholder="رقم الهاتف (واتساب)" type="tel" value={predForms[match.id]?.phone || ""} onChange={(e) => setPredForms(p => ({...p, [match.id]: {...p[match.id], phone: e.target.value}}))} className="bg-[#1e2a4a] border-white/10 text-white text-center" />
                             </div>
                             <Button onClick={() => submitPrediction(match.id, `${match.teamA} vs ${match.teamB}`)} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-6 text-lg mt-2 shadow-md">أرسل توقعك الآن 🚀</Button>
                           </div>
                         )}
                       </CardContent>
                     </Card>
                   )) : <div className="text-center bg-[#1e2a4a] p-10 rounded-3xl border border-white/10"><p className="text-xl text-white font-bold mb-2">لا توجد مباريات متاحة للتوقع حالياً</p><p className="text-cyan-300">انتظرونا في المباريات القادمة!</p></div>}
                </div>
                <div>
                   <h3 className="text-2xl font-black text-yellow-300 flex items-center gap-2 mb-6"><Trophy /> لوحة شرف الجماهير</h3>
                   <Card className="bg-[#13213a] border-yellow-400/30 rounded-3xl overflow-hidden shadow-xl sticky top-4">
                     <CardHeader className="bg-[#1e2a4a] border-b border-white/10 py-4"><CardTitle className="text-white text-center text-lg">أفضل المتوقعين (Top 10)</CardTitle></CardHeader>
                     <CardContent className="p-0">
                       {fantasyLeaderboard.length > 0 ? (
                         <table className="w-full text-right text-white">
                           <tbody>
                             {fantasyLeaderboard.map((user: any, idx: number) => (
                               <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                 <td className="p-4 w-12 text-center"><Badge className={`${idx === 0 ? 'bg-yellow-400 text-black' : idx === 1 ? 'bg-gray-300 text-black' : idx === 2 ? 'bg-amber-700 text-white' : 'bg-white/10 text-white'} font-black px-3`}>{idx + 1}</Badge></td>
                                 <td className="p-4 font-bold text-sm sm:text-base">{user.name}</td>
                                 <td className="p-4 text-left"><Badge className="bg-emerald-500 text-white font-black text-lg px-4">{user.points}</Badge></td>
                               </tr>
                             ))}
                           </tbody>
                         </table>
                       ) : <div className="p-10 text-center text-gray-400 font-bold">لم يتم حصد نقاط حتى الآن. كُن أول المتصدرين!</div>}
                     </CardContent>
                   </Card>
                </div>
             </div>
          </div>
        )}

        {activeTab === "knockout" && (
          <div className="space-y-12 relative pb-10 animate-in fade-in duration-500">
            <div className="text-center mb-8"><h2 className="text-4xl font-black text-yellow-300 drop-shadow-lg">الطريق إلى النهائي 🏆</h2><p className="text-cyan-300 mt-2 font-bold text-lg">{activeTournament === 'youth' ? "مباريات إقصائيات الشباب" : "إقصائيات بطولة الناشئين"}</p></div>
            {activeTournament === 'youth' ? (
              <>
                <div className="bg-[#1e2a4a]/40 p-4 sm:p-6 rounded-3xl border border-cyan-500/30 shadow-xl"><div className="text-center mb-6"><Badge className="bg-cyan-500 text-white text-xl px-8 py-2 font-black">مباريات الملحق</Badge></div><div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6"><TreeMatchBox label="م 97" t1="اسماك باسط العوامي" t2="اصدقاء عز بوالمجدوبة" data={youthTree.p97} /><TreeMatchBox label="م 98" t1="السلوم" t2="اصدقاء عيسي المغواري" data={youthTree.p98} /><TreeMatchBox label="م 99" t1="17 فبراير" t2="الفهود" data={youthTree.p99} /><TreeMatchBox label="م 100" t1="اصدقاء قسم الله" t2="اصدقاء سلامة بدر" data={youthTree.p100} /><TreeMatchBox label="م 101" t1="ايس كريم الملكة" t2="غوط رباح" data={youthTree.p101} /><TreeMatchBox label="م 102" t1="محاربي الصحراء" t2="اصدقاء خالد" data={youthTree.p102} /><TreeMatchBox label="م 103" t1="ام القبائل" t2="شباب القناشات" data={youthTree.p103} /><TreeMatchBox label="م 104" t1="اتحاد المثاني" t2="دبي للزي العربي" data={youthTree.p104} /></div></div>
                <div className="bg-[#1e2a4a]/60 p-4 sm:p-6 rounded-3xl border-2 border-yellow-400/50 shadow-2xl"><div className="text-center mb-6"><Badge className="bg-yellow-400 text-black text-2xl px-10 py-2 font-black">دور الـ 16</Badge></div><div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6"><TreeMatchBox label="م 1" t1={youthTree.getT(1)} t2={youthTree.p104.win || "الفائز (م 104)"} data={youthTree.r1} /><TreeMatchBox label="م 2" t1={youthTree.getT(8)} t2={youthTree.p97.win || "الفائز (م 97)"} data={youthTree.r2} /><TreeMatchBox label="م 3" t1={youthTree.getT(4)} t2={youthTree.p101.win || "الفائز (م 101)"} data={youthTree.r3} /><TreeMatchBox label="م 4" t1={youthTree.getT(5)} t2={youthTree.p100.win || "الفائز (م 100)"} data={youthTree.r4} /><TreeMatchBox label="م 5" t1={youthTree.getT(2)} t2={youthTree.p103.win || "الفائز (م 103)"} data={youthTree.r5} /><TreeMatchBox label="م 6" t1={youthTree.getT(7)} t2={youthTree.p98.win || "الفائز (م 98)"} data={youthTree.r6} /><TreeMatchBox label="م 7" t1={youthTree.getT(3)} t2={youthTree.p102.win || "الفائز (م 102)"} data={youthTree.r7} /><TreeMatchBox label="م 8" t1={youthTree.getT(6)} t2={youthTree.p99.win || "الفائز (م 99)"} data={youthTree.r8} /></div></div>
                <div className="bg-[#13213a] p-4 sm:p-6 rounded-3xl border border-yellow-400/40 shadow-xl"><div className="text-center mb-6"><Badge className="bg-white text-black text-xl px-8 py-2 font-black">دور الثمانية (ربع النهائي)</Badge></div><div className="grid md:grid-cols-2 gap-8 lg:px-20"><TreeMatchBox label="مربع 1" t1={youthTree.r1.win || "الفائز (م 1)"} t2={youthTree.r2.win || "الفائز (م 2)"} data={youthTree.q1} /><TreeMatchBox label="مربع 2" t1={youthTree.r3.win || "الفائز (م 3)"} t2={youthTree.r4.win || "الفائز (م 4)"} data={youthTree.q2} /><TreeMatchBox label="مربع 3" t1={youthTree.r5.win || "الفائز (م 5)"} t2={youthTree.r6.win || "الفائز (م 6)"} data={youthTree.q3} /><TreeMatchBox label="مربع 4" t1={youthTree.r7.win || "الفائز (م 7)"} t2={youthTree.r8.win || "الفائز (م 8)"} data={youthTree.q4} /></div></div>
                <div className="bg-[#1e2a4a] p-4 sm:p-6 rounded-3xl border border-yellow-400/60 shadow-2xl"><div className="text-center mb-6"><Badge className="bg-yellow-400 text-black text-2xl px-10 py-2 font-black">نصف النهائي</Badge></div><div className="grid md:grid-cols-2 gap-12 lg:px-40"><TreeMatchBox label="نصف 1" t1={youthTree.q1.win || "الفائز مربع 1"} t2={youthTree.q2.win || "الفائز مربع 2"} data={youthTree.s1} /><TreeMatchBox label="نصف 2" t1={youthTree.q3.win || "الفائز مربع 3"} t2={youthTree.q4.win || "الفائز مربع 4"} data={youthTree.s2} /></div></div>
                <div className="relative pt-6 pb-6 px-4 text-center"><div className="mb-6 relative z-10"><Badge className="bg-yellow-400 text-black text-3xl px-16 py-3 font-black shadow-[0_0_30px_rgba(250,204,21,0.6)]">النهائي 🏆</Badge></div><div className="max-w-xl mx-auto relative z-10"><TreeMatchBox label="مباراة التتويج" t1={youthTree.s1.win || "الطرف الأول"} t2={youthTree.s2.win || "الطرف الثاني"} data={youthTree.f1} /></div></div>
              </>
            ) : (
              <>
                <div className="bg-[#13213a] p-4 sm:p-6 rounded-3xl border border-cyan-500/40 shadow-xl mb-10"><div className="text-center mb-6"><Badge className="bg-white text-black text-xl px-8 py-2 font-black border border-cyan-500">دور الثمانية (الناشئين)</Badge></div><div className="grid md:grid-cols-2 gap-8 lg:px-20"><TreeMatchBox label="مربع 1" t1={juniorsTree.ja1} t2={juniorsTree.jb4} data={juniorsTree.q1} /><TreeMatchBox label="مربع 2" t1={juniorsTree.jb2} t2={juniorsTree.ja3} data={juniorsTree.q2} /><TreeMatchBox label="مربع 3" t1={juniorsTree.jb1} t2={juniorsTree.ja4} data={juniorsTree.q3} /><TreeMatchBox label="مربع 4" t1={juniorsTree.ja2} t2={juniorsTree.jb3} data={juniorsTree.q4} /></div></div>
                <div className="bg-[#1e2a4a]/60 p-4 sm:p-6 rounded-3xl border-2 border-cyan-500/50 shadow-2xl"><div className="text-center mb-6"><Badge className="bg-cyan-500 text-white text-2xl px-10 py-2 font-black">نصف النهائي (الناشئين)</Badge></div><div className="grid md:grid-cols-2 gap-12 lg:px-40"><TreeMatchBox label="نصف 1" t1={juniorsTree.q1.win || "الفائز (مربع 1)"} t2={juniorsTree.q2.win || "الفائز (مربع 2)"} data={juniorsTree.s1} /><TreeMatchBox label="نصف 2" t1={juniorsTree.q3.win || "الفائز (مربع 3)"} t2={juniorsTree.q4.win || "الفائز (مربع 4)"} data={juniorsTree.s2} /></div></div>
                <div className="relative pt-10 pb-6 px-4 text-center"><div className="mb-6 relative z-10"><Badge className="bg-yellow-400 text-black text-3xl px-16 py-3 font-black shadow-[0_0_30px_rgba(250,204,21,0.6)]">النهائي 🏆</Badge></div><div className="max-w-xl mx-auto relative z-10"><TreeMatchBox label="مباراة التتويج" t1={juniorsTree.s1.win || "الفائز 1"} t2={juniorsTree.s2.win || "الفائز 2"} data={juniorsTree.f1} /></div></div>
              </>
            )}
          </div>
        )}

        {activeTab === "standings" && (
          <div className="space-y-8 animate-in fade-in duration-500">
            {activeTournament === 'juniors' ? (
              <div className="grid md:grid-cols-2 gap-8">
                {[ { title: "المجموعة الأولى", data: standingsJunA }, { title: "المجموعة الثانية", data: standingsJunB } ].map(group => (
                  <Card key={group.title} className="rounded-3xl border border-cyan-500/30 bg-[#13213a] shadow-xl overflow-hidden"><CardHeader className="flex flex-row items-center justify-between border-b border-cyan-500/20 pb-4"><CardTitle className="text-cyan-300 flex items-center gap-3"><Trophy className="h-6 w-6" /> {group.title}</CardTitle></CardHeader><CardContent className="p-0"><div className="overflow-auto w-full touch-pan-x touch-pan-y" dir="rtl"><table className="w-full text-white text-right min-w-[500px]"><thead className="bg-[#13213a] border-b border-cyan-500/30"><tr>{STANDINGS_HEADERS.map(h => (<th key={h} className="px-3 py-3 font-bold text-cyan-300 text-xs whitespace-nowrap">{h}</th>))}</tr></thead><tbody>{group.data.map(row => (<tr key={row.team} className="border-b border-white/5 hover:bg-white/5 transition-colors"><td className="px-3 py-3"><Badge className={zoneColor(row.rank, activeTournament)}>{row.rank}</Badge></td><td className="px-3 py-3 font-bold text-white whitespace-nowrap text-sm">{row.team}</td><td className="px-3 py-3 text-center">{row.played}</td><td className="px-3 py-3 text-center text-yellow-300 font-black">{row.wins}</td><td className="px-3 py-3 text-center">{row.draws}</td><td className="px-3 py-3 text-center">{row.losses}</td><td className="px-3 py-3 text-center text-cyan-400">{row.gf}</td><td className="px-3 py-3 text-center text-white">{row.ga}</td><td className="px-3 py-3 text-center text-cyan-300">{row.gd}</td><td className="px-3 py-3 font-black text-yellow-300 text-center">{row.points}</td></tr>))}</tbody></table></div></CardContent></Card>
                ))}
              </div>
            ) : (
              <Card className="rounded-3xl border border-yellow-400/30 bg-[#13213a] shadow-xl overflow-hidden">
                 <CardHeader className="flex flex-row items-center justify-between border-b border-yellow-400/20 pb-4"><CardTitle className="text-yellow-300 flex items-center gap-3"><Trophy className="h-7 w-7" /> جدول الترتيب العام</CardTitle><Button size="sm" onClick={() => setIsTableExpanded(true)} className="bg-yellow-400 text-black hover:bg-yellow-500 font-bold flex items-center gap-2"><Maximize className="h-4 w-4" /> عرض الشاشة بالعرض</Button></CardHeader>
                 <CardContent className="p-0">
                    <div className="overflow-auto w-full max-h-[60vh] touch-pan-x touch-pan-y relative" dir="rtl"><table className="w-full text-white text-right min-w-[800px]"><thead className="sticky top-0 bg-[#13213a] border-b border-yellow-400/30 z-20 shadow-md"><tr>{STANDINGS_HEADERS.map(h => (<th key={h} className="px-4 py-4 font-bold text-cyan-300 text-sm whitespace-nowrap">{h}</th>))}</tr></thead><tbody>{standingsYouth.map(row => (<tr key={row.team} className="border-b border-yellow-400/10 hover:bg-white/5 transition-colors"><td className="px-4 py-4"><Badge className={zoneColor(row.rank, activeTournament)}>{row.rank}</Badge></td><td className="px-4 py-4 font-bold text-white whitespace-nowrap">{row.team}</td><td className="px-4 py-4 text-center">{row.played}</td><td className="px-4 py-4 text-center text-yellow-300 font-black">{row.wins}</td><td className="px-4 py-4 text-center">{row.draws}</td><td className="px-4 py-4 text-center">{row.losses}</td><td className="px-4 py-4 text-center text-cyan-400">{row.gf}</td><td className="px-4 py-4 text-center text-white">{row.ga}</td><td className="px-4 py-4 text-center text-cyan-300">{row.gd}</td><td className="px-4 py-4 font-black text-yellow-300 text-center text-lg">{row.points}</td></tr>))}</tbody></table></div>
                 </CardContent>
              </Card>
            )}
            {isTableExpanded && activeTournament === 'youth' && (
              <div className="fixed inset-0 z-[9999] bg-[#0a1428] flex items-center justify-center overflow-hidden"><div className="bg-[#13213a] flex flex-col shadow-2xl" style={{ width: '100vh', height: '100vw', transform: 'rotate(90deg)' }}><div className="flex flex-row items-center justify-between p-4 border-b border-yellow-400/20 bg-[#1e2a4a]"><div className="text-yellow-300 font-black flex items-center gap-2 text-xl"><Trophy className="h-6 w-6" /> جدول الترتيب</div><Button size="sm" onClick={() => setIsTableExpanded(false)} className="bg-yellow-400 text-black font-bold flex items-center gap-2"><Minimize className="h-4 w-4" /> إغلاق الشاشة</Button></div><div className="flex-1 overflow-auto p-0 touch-pan-x touch-pan-y"><table className="w-full text-white text-right min-w-[800px]"><thead className="sticky top-0 bg-[#13213a] border-b border-yellow-400/30 z-20 shadow-md"><tr>{STANDINGS_HEADERS.map(h => (<th key={h} className="px-3 py-3 font-bold text-cyan-300 text-sm whitespace-nowrap">{h}</th>))}</tr></thead><tbody>{standingsYouth.map(row => (<tr key={row.team} className="border-b border-yellow-400/10 hover:bg-white/5 transition-colors"><td className="px-3 py-3"><Badge className={zoneColor(row.rank, activeTournament)}>{row.rank}</Badge></td><td className="px-3 py-3 font-bold text-white whitespace-nowrap">{row.team}</td><td className="px-3 py-3 text-center">{row.played}</td><td className="px-3 py-3 text-center text-yellow-300 font-black">{row.wins}</td><td className="px-3 py-3 text-center">{row.draws}</td><td className="px-3 py-3 text-center">{row.losses}</td><td className="px-3 py-3 text-center text-cyan-400">{row.gf}</td><td className="px-3 py-3 text-center text-white">{row.ga}</td><td className="px-3 py-3 text-center text-cyan-300">{row.gd}</td><td className="px-3 py-3 font-black text-yellow-300 text-center text-lg">{row.points}</td></tr>))}</tbody></table></div></div></div>
            )}
          </div>
        )}

        {activeTab === "all" && (
           <Card className={`rounded-3xl border ${activeTournament === 'juniors' ? 'border-cyan-500/30' : 'border-yellow-400/30'} bg-[#13213a] animate-in fade-in duration-500`}>
             <CardHeader className="flex flex-col sm:flex-row justify-between items-center gap-4"><div><CardTitle className={activeTournament === 'juniors' ? 'text-cyan-300' : 'text-yellow-300'}>النتائج السابقة</CardTitle><Badge className="bg-cyan-500 mt-2 font-bold text-white">إجمالي المباريات: {finishedMatches.length}</Badge></div><div className="relative w-full sm:max-w-xs"><Search className="absolute right-3 top-3 h-4 w-4 text-cyan-300" /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث عن فريق..." className="pr-10 bg-[#1e2a4a] border-yellow-400 text-white rounded-xl" /></div></CardHeader>
             <CardContent className="p-6 grid gap-4 md:grid-cols-2">
               {finishedMatches.filter(m => !search || String(m.teamA || "").includes(search.trim()) || String(m.teamB || "").includes(search.trim())).map(match => (
                 <div key={match.id} className={`bg-[#1e2a4a] p-6 rounded-3xl border border-white/5 text-center transition-all hover:scale-[1.01] ${activeTournament === 'juniors' ? 'hover:border-cyan-400/50' : 'hover:border-yellow-400/50'}`}>
                   <div className="text-cyan-300 text-xs sm:text-sm mb-3 font-bold border-b border-white/5 pb-2">{getArabicDay(match.date)} • {match.date} • {match.round}</div>
                   <div className="flex items-center justify-center gap-2 sm:gap-6 mt-4">
                     <TeamMatchDisplay teamName={match.teamA} logoUrl={match.teamALogo} />
                     <div className="bg-[#0a1428] rounded-xl py-2 px-4 border border-white/5 text-yellow-400 shadow-inner shrink-0">
                        {renderMatchScore(match)}
                     </div>
                     <TeamMatchDisplay teamName={match.teamB} logoUrl={match.teamBLogo} />
                   </div>
                 </div>
               ))}
             </CardContent>
           </Card>
        )}

        {activeTab === "today" && (
           <Card className={`rounded-3xl border ${activeTournament === 'juniors' ? 'border-cyan-500/30' : 'border-yellow-400/30'} bg-[#13213a] animate-in fade-in duration-500`}>
             <CardHeader className="text-center border-b border-white/10 pb-6"><Badge className={`${activeTournament === 'juniors' ? 'bg-cyan-500 text-white' : 'bg-yellow-400 text-black'} text-sm sm:text-lg px-6 py-2.5`}>مباريات اليوم • {getArabicDay(todayStr)} {todayStr}</Badge><CardTitle className={`text-2xl sm:text-4xl font-black mt-4 ${activeTournament === 'juniors' ? 'text-cyan-300' : 'text-yellow-300'}`}>مواجهات اليوم</CardTitle></CardHeader>
             <CardContent className="p-4 sm:p-6 grid gap-6 mt-4">
               {todayMatches.length > 0 ? todayMatches.map(match => (
                 <div key={match.id} className={`rounded-3xl border border-white/10 bg-[#1e2a4a] p-4 sm:p-6 transition-all ${activeTournament === 'juniors' ? 'hover:border-cyan-400' : 'hover:border-yellow-400'}`}>
                   <div className="text-center mb-6"><div className="text-cyan-300 text-xs sm:text-sm font-bold">{getArabicDay(match.date)} • {match.date}</div><div className="flex items-center justify-center gap-2 text-yellow-300 mt-2"><Clock className="h-4 w-4 sm:h-5 sm:w-5" /><span className="text-lg sm:text-2xl font-bold">{formatTime12(match.time)}</span></div></div>
                   <div className="flex items-center justify-center gap-2 sm:gap-6">
                     <TeamMatchDisplay teamName={match.teamA} logoUrl={match.teamALogo} />
                     <div className="text-yellow-400 font-black px-2 text-xl sm:text-3xl shrink-0">VS</div>
                     <TeamMatchDisplay teamName={match.teamB} logoUrl={match.teamBLogo} />
                   </div>
                 </div>
               )) : <p className="text-center py-10 text-white font-bold text-lg sm:text-xl">لا توجد مباريات قادمة اليوم</p>}
             </CardContent>
           </Card>
        )}

        {activeTab === "tomorrow" && (
           <Card className={`rounded-3xl border ${activeTournament === 'juniors' ? 'border-cyan-500/30' : 'border-yellow-400/30'} bg-[#13213a] animate-in fade-in duration-500`}>
             <CardHeader className="text-center border-b border-white/10 pb-6"><Badge className={`${activeTournament === 'juniors' ? 'bg-cyan-500 text-white' : 'bg-yellow-400 text-black'} text-sm sm:text-lg px-6 py-2.5`}>مباريات غداً • {getArabicDay(tomorrowStr)} {tomorrowStr}</Badge><CardTitle className={`text-2xl sm:text-4xl font-black mt-4 ${activeTournament === 'juniors' ? 'text-cyan-300' : 'text-yellow-300'}`}>مواجهات غداً</CardTitle></CardHeader>
             <CardContent className="p-4 sm:p-6 grid gap-6 mt-4 md:grid-cols-2">
               {tomorrowMatches.map(match => (
                 <div key={match.id} className={`rounded-3xl border border-white/10 bg-[#1e2a4a] p-4 sm:p-6 transition-all ${activeTournament === 'juniors' ? 'hover:border-cyan-400' : 'hover:border-yellow-400'}`}>
                   <div className="text-center mb-6"><div className="text-cyan-300 text-xs sm:text-sm font-bold">{getArabicDay(match.date)} • {match.date}</div><div className="flex items-center justify-center gap-2 text-yellow-300 mt-2"><Clock className="h-4 w-4 sm:h-5 sm:w-5" /><span className="text-lg sm:text-2xl font-bold">{formatTime12(match.time)}</span></div></div>
                   <div className="flex items-center justify-center gap-2 sm:gap-6">
                     <TeamMatchDisplay teamName={match.teamA} logoUrl={match.teamALogo} />
                     <div className="text-yellow-400 font-black px-2 text-xl sm:text-3xl shrink-0">VS</div>
                     <TeamMatchDisplay teamName={match.teamB} logoUrl={match.teamBLogo} />
                   </div>
                 </div>
               ))}
               {tomorrowMatches.length === 0 && <p className="text-center py-10 text-white font-bold text-lg sm:text-xl col-span-full">لا توجد مباريات مسجلة غداً</p>}
             </CardContent>
           </Card>
        )}

        {activeTab === "scorers" && (
          <div className="space-y-6 animate-in fade-in duration-500">
             <div className="flex flex-col sm:flex-row justify-between items-center bg-[#13213a] p-4 sm:p-6 rounded-3xl border border-yellow-400/30 gap-4"><h2 className="text-2xl sm:text-3xl font-black text-yellow-300">قائمة الهدافين الذهبية</h2><div className="relative w-full sm:max-w-xs"><Search className="absolute right-3 top-3 h-4 w-4 text-cyan-300" /><Input value={searchScorers} onChange={e => setSearchScorers(e.target.value)} placeholder="بحث عن لاعب أو فريق..." className="pr-10 bg-[#1e2a4a] border-yellow-400 text-white rounded-xl" /></div></div>
             <div className="grid gap-10 md:grid-cols-2 xl:grid-cols-4 justify-items-center mt-8 pt-4">
               {filteredScorers.length > 0 ? filteredScorers.map((player, i) => (
                 <div key={i} className="relative w-[280px] h-[400px] group transition-transform duration-300 hover:scale-105 cursor-pointer mx-auto">
                   {i === 0 && !searchScorers && <div className="absolute -top-4 -right-4 bg-red-600 text-white text-xs font-black px-4 py-1.5 rounded-full z-50 border-2 border-yellow-400 shadow-[0_0_15px_rgba(239,68,68,0.6)] animate-pulse">👑 الهداف التاريخي</div>}
                   <div className="absolute inset-0 bg-yellow-500/20 rounded-t-[2rem] blur-2xl group-hover:bg-yellow-400/40 transition-all"></div>
                   <div className="absolute inset-0 bg-gradient-to-br from-[#f8e596] via-[#dcae3a] to-[#9b7318] overflow-hidden" style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 88%, 50% 100%, 0% 88%)', borderRadius: '1.5rem 1.5rem 0 0', border: '1px solid rgba(255, 235, 150, 0.4)' }}>
                     <div className="absolute inset-0 opacity-[0.25] mix-blend-overlay">
                        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><path d="M-50,150 L140,-50 L330,150 L140,350 Z" stroke="#ffffff" strokeWidth="2" fill="none" /><path d="M-50,200 L140,0 L330,200 L140,400 Z" stroke="#ffffff" strokeWidth="1" fill="none" /><path d="M40,50 L240,250 M240,50 L40,250" stroke="#000000" strokeWidth="0.5" fill="none" /><path d="M140,-50 L140,400" stroke="#ffffff" strokeWidth="2" fill="none" /></svg>
                     </div>
                     <div className="relative w-full h-full p-4 flex flex-col text-[#3e2d14]">
                       <div className="absolute top-6 left-5 flex flex-col items-center z-20">
                         <span className="text-5xl font-black leading-none drop-shadow-sm tracking-tighter">{player.goals}</span>
                         <span className="text-sm font-black mt-0.5 tracking-wider uppercase">هداف</span>
                       </div>
                       <div className="absolute top-10 w-full flex justify-center z-10 left-0">
                          <div className="w-[140px] h-[140px] rounded-full border-4 border-yellow-400 overflow-hidden bg-[#1e2a4a] shadow-[0_5px_15px_rgba(0,0,0,0.5)] flex items-center justify-center">
                            {player.imageUrl ? <img src={player.imageUrl} className="w-full h-full object-cover" alt={player.player} loading="lazy" /> : <span className="text-7xl opacity-40 text-white">👤</span>}
                          </div>
                       </div>
                       <div className="absolute top-[210px] left-0 w-full flex flex-col items-center z-20">
                         <div className="text-3xl font-black tracking-tighter truncate w-[90%] text-center drop-shadow-sm">{player.player}</div>
                         <div className="w-[85%] h-[1px] bg-[#3e2d14] opacity-20 my-2"></div>
                         <div className="flex justify-between w-[85%] mx-auto text-center text-[#3e2d14]">
                           {[ { label: "السرعة", val: player.pac }, { label: "الشوط", val: player.sho }, { label: "التمرير", val: player.pas }, { label: "المراوغة", val: player.dri }, { label: "الدفاع", val: player.def }, { label: "البدني", val: player.phy } ].map(stat => (
                             <div key={stat.label} className="flex flex-col items-center"><span className="text-[10px] font-bold">{stat.label}</span><span className="text-xl font-black leading-none mt-1">{stat.val}</span></div>
                           ))}
                         </div>
                         <div className="w-[85%] h-[1px] bg-[#3e2d14] opacity-20 my-2"></div>
                         <div className="flex justify-center items-center gap-6 mt-1">
                           <Star className="w-6 h-6 opacity-60" />
                           <img src="/logo.png" className="w-6 h-7 object-contain opacity-90 drop-shadow-sm" alt="Matrouh Cup" />
                           <div className="text-[10px] font-black uppercase tracking-wider bg-[#3e2d14] text-[#f8e596] px-2 py-1 rounded-sm truncate max-w-[80px] shadow-sm">{player.team}</div>
                         </div>
                       </div>
                     </div>
                   </div>
                 </div>
               )) : <p className="text-center text-white font-bold col-span-full py-10 w-full">لا يوجد هدافين مطابقين للبحث</p>}
             </div>
          </div>
        )}

        {activeTab === "cards" && (
          <div className="space-y-6 animate-in fade-in duration-500">
             <div className="flex flex-col sm:flex-row justify-between items-center bg-[#13213a] p-4 sm:p-6 rounded-3xl border border-yellow-400/30 gap-4">
                <div>
                   <h2 className="text-2xl sm:text-3xl font-black text-yellow-300 mb-2">سجل الإنذارات</h2>
                   <div className="flex gap-2 mt-2">
                     <Button size="sm" onClick={() => setShowArchivedCards(false)} className={`font-bold ${!showArchivedCards ? 'bg-cyan-500 text-white shadow-md' : 'bg-[#1e2a4a] text-gray-400 hover:text-white'}`}>الإنذارات الحالية الفعالة</Button>
                     <Button size="sm" onClick={() => setShowArchivedCards(true)} className={`font-bold ${showArchivedCards ? 'bg-gray-400 text-black shadow-md' : 'bg-[#1e2a4a] text-gray-400 hover:text-white'}`}><Archive className="ml-1 h-4 w-4"/> أرشيف الإنذارات</Button>
                   </div>
                </div>
                <div className="relative w-full sm:max-w-xs"><Search className="absolute right-3 top-3 h-4 w-4 text-cyan-300" /><Input value={searchCards} onChange={e => setSearchCards(e.target.value)} placeholder="بحث عن لاعب أو فريق..." className="pr-10 bg-[#1e2a4a] border-yellow-400 text-white rounded-xl" /></div>
             </div>
             
             {showArchivedCards && (
               <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-2xl p-4 text-center">
                 <p className="text-yellow-400 font-bold">📌 هذه البطاقات تم تصفيرها ونقلها للأرشيف قبل بداية دور الـ 16 ولن تؤثر على إيقافات اللاعبين الحالية.</p>
               </div>
             )}

             <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
               {filteredCardsList.length > 0 ? filteredCardsList.map((item, i) => (
                 <Card key={i} className={`bg-[#1e2a4a] border-yellow-400/30 rounded-3xl transition-all ${showArchivedCards ? 'opacity-70 grayscale-[30%]' : 'hover:border-yellow-400'}`}>
                   <CardContent className="p-6">
                     <div className="flex justify-between items-start">
                       <div><h3 className="font-bold text-lg sm:text-xl text-white">{item.player}</h3><p className="text-cyan-300 text-sm font-bold">{item.team}</p></div>
                       {!showArchivedCards && <Badge className={`${item.status === 'متاح' ? 'bg-cyan-500 text-white' : item.status === 'إيقاف' ? 'bg-yellow-500 text-white' : 'bg-red-500 text-white'} font-bold text-sm px-3`}>{item.status}</Badge>}
                     </div>
                     <div className="mt-4 flex gap-4">
                       <Badge className="bg-yellow-400/20 text-yellow-300 px-4 py-2 font-bold text-lg">🟨 {item.yellow}</Badge>
                       <Badge className="bg-red-500/20 text-red-300 px-4 py-2 font-bold text-lg">🟥 {item.red}</Badge>
                     </div>
                   </CardContent>
                 </Card>
               )) : <p className="text-center text-white font-bold col-span-full py-10">لا توجد بطاقات مطابقة للبحث في هذا السجل.</p>}
             </div>
          </div>
        )}

        {activeTab === "stats" && (
          <div className="space-y-8 animate-in fade-in duration-500">
            {topMotmPlayer && (
              <Card className="bg-gradient-to-r from-cyan-600 to-cyan-900 border-none p-8 rounded-3xl text-center shadow-2xl relative overflow-hidden"><Star className="absolute -left-4 -top-4 h-32 w-32 text-white/10 rotate-12" /><h3 className="text-white font-black text-xl mb-4 relative z-10">🌟 ملك جوائز رجل المباراة</h3><div className="text-5xl font-black text-yellow-300 mb-2 relative z-10">{topMotmPlayer.name}</div><div className="text-white text-xl opacity-90 mb-4 relative z-10">{topMotmPlayer.team}</div><Badge className="bg-black text-yellow-400 px-6 py-2 text-lg relative z-10">حصل على الجائزة {topMotmPlayer.count} مرات</Badge></Card>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[ { label: "الأهداف", val: statsData.totalGoals, icon: "⚽", color: "text-yellow-400", sub: `${statsData.goalsPerMatch} / م` }, { label: "المباريات", val: statsData.totalMatches, icon: "🏟️", color: "text-cyan-400", sub: "إجمالي" }, { label: "تعادل 0-0", val: statsData.draws00, icon: "🤝", color: "text-white", sub: `${statsData.draws00Percent}%` }, { label: "تعادل إيجابي", val: statsData.drawsPositive, icon: "🔥", color: "text-cyan-400", sub: `${statsData.drawsPosPercent}%` }, { label: "إنذار", val: statsData.totalYellow, icon: "🟨", color: "text-yellow-500", sub: "أصفر" }, { label: "طرد", val: statsData.totalRed, icon: "🟥", color: "text-red-500", sub: "أحمر" } ].map((s, i) => (
                <Card key={i} className="bg-[#13213a] border-white/5 text-center p-4 relative overflow-hidden group hover:border-yellow-400/50 transition-colors"><div className={`text-4xl font-black ${s.color} mb-1`}>{s.val}</div><div className="text-[10px] text-white font-bold uppercase">{s.label}</div><Badge className="mt-2 bg-black/40 text-white text-[10px] border-none">{s.sub}</Badge></Card>
              ))}
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
               <Card className="bg-[#13213a] border-yellow-400/20 p-6 text-center shadow-lg"><Target className="mx-auto mb-4 text-cyan-400 h-10 w-10" /><h4 className="text-white text-sm font-bold mb-2">أقوى هجوم</h4><div className="text-xl font-black text-white">{statsData.bestAttack?.team || "—"}</div><Badge className="mt-2 bg-cyan-500/10 text-cyan-400 border-none">{statsData.bestAttack?.gf || 0} هدف</Badge></Card>
               <Card className="bg-[#13213a] border-yellow-400/20 p-6 text-center shadow-lg"><Zap className="mx-auto mb-4 text-yellow-400 h-10 w-10" /><h4 className="text-white text-sm font-bold mb-2">أضعف هجوم</h4><div className="text-xl font-black text-white">{statsData.worstAttack?.team || "—"}</div><Badge className="mt-2 bg-yellow-500/10 text-yellow-400 border-none">{statsData.worstAttack?.gf || 0} هدف</Badge></Card>
               <Card className="bg-[#13213a] border-yellow-400/20 p-6 text-center shadow-lg"><Shield className="mx-auto mb-4 text-cyan-400 h-10 w-10" /><h4 className="text-white text-sm font-bold mb-2">أقوى دفاع</h4><div className="text-xl font-black text-white">{statsData.bestDefense?.team || "—"}</div><Badge className="mt-2 bg-cyan-500/10 text-cyan-400 border-none">استقبل {statsData.bestDefense?.ga || 0}</Badge></Card>
               <Card className="bg-[#13213a] border-yellow-400/20 p-6 text-center shadow-lg"><ShieldAlert className="mx-auto mb-4 text-yellow-500 h-10 w-10" /><h4 className="text-white text-sm font-bold mb-2">أضعف دفاع</h4><div className="text-xl font-black text-white">{statsData.worstDefense?.team || "—"}</div><Badge className="mt-2 bg-yellow-500/10 text-yellow-400 border-none">استقبل {statsData.worstDefense?.ga || 0}</Badge></Card>
            </div>
          </div>
        )}

        {activeTab === "motm_tab" && (
          <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-3 justify-items-center animate-in fade-in duration-500 pt-6">
            {motmList.length > 0 ? motmList.map((m, i) => (
              <div key={i} className="relative w-[280px] h-[400px] group transition-transform duration-300 hover:scale-105 cursor-pointer mx-auto">
                <div className="absolute inset-0 bg-yellow-500/20 rounded-t-[2rem] blur-2xl group-hover:bg-yellow-400/40 transition-all"></div>
                <div className="absolute inset-0 bg-gradient-to-br from-[#f8e596] via-[#dcae3a] to-[#9b7318] overflow-hidden" style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 88%, 50% 100%, 0% 88%)', borderRadius: '1.5rem 1.5rem 0 0', border: '1px solid rgba(255, 235, 150, 0.4)' }}>
                  <div className="absolute inset-0 opacity-[0.25] mix-blend-overlay">
                     <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><path d="M-50,150 L140,-50 L330,150 L140,350 Z" stroke="#ffffff" strokeWidth="2" fill="none" /><path d="M-50,200 L140,0 L330,200 L140,400 Z" stroke="#ffffff" strokeWidth="1" fill="none" /><path d="M40,50 L240,250 M240,50 L40,250" stroke="#000000" strokeWidth="0.5" fill="none" /><path d="M140,-50 L140,400" stroke="#ffffff" strokeWidth="2" fill="none" /></svg>
                  </div>
                  <div className="relative w-full h-full p-4 flex flex-col text-[#3e2d14]">
                    <div className="absolute top-6 left-5 flex flex-col items-center z-20">
                      <span className="text-5xl font-black leading-none drop-shadow-sm tracking-tighter">{m.rating || 99}</span>
                      <span className="text-sm font-black mt-0.5 tracking-wider uppercase">نجم</span>
                    </div>
                    <div className="absolute top-10 w-full flex justify-center z-10 left-0">
                       <div className="w-[140px] h-[140px] rounded-full border-4 border-yellow-400 overflow-hidden bg-[#1e2a4a] shadow-[0_5px_15px_rgba(0,0,0,0.5)] flex items-center justify-center">
                         {m.imageUrl ? ( <img src={m.imageUrl} className="w-full h-full object-cover" alt={m.player} loading="lazy" /> ) : ( <span className="text-7xl opacity-40 text-white">👤</span> )}
                       </div>
                    </div>
                    <div className="absolute top-[210px] left-0 w-full flex flex-col items-center z-20">
                      <div className="text-3xl font-black tracking-tighter truncate w-[90%] text-center drop-shadow-sm">{m.player}</div>
                      <div className="w-[85%] h-[1px] bg-[#3e2d14] opacity-20 my-2"></div>
                      <div className="flex justify-between w-[85%] mx-auto text-center text-[#3e2d14]">
                        {[ { label: "السرعة", val: m.pac }, { label: "الشوط", val: m.sho }, { label: "التمرير", val: m.pas }, { label: "المراوغة", val: m.dri }, { label: "الدفاع", val: m.def }, { label: "البدني", val: m.phy } ].map(stat => (
                          <div key={stat.label} className="flex flex-col items-center"><span className="text-[10px] font-bold">{stat.label}</span><span className="text-xl font-black leading-none mt-1">{stat.val || 99}</span></div>
                        ))}
                      </div>
                      <div className="w-[85%] h-[1px] bg-[#3e2d14] opacity-20 my-2"></div>
                      <div className="flex justify-center items-center gap-6 mt-1">
                        {m.sponsorLogo ? <img src={m.sponsorLogo} alt="Sponsor" className="w-8 h-6 object-contain drop-shadow-sm" loading="lazy" /> : <Star className="w-6 h-6 opacity-60" />}
                        <img src="/logo.png" className="w-6 h-7 object-contain opacity-90 drop-shadow-sm" alt="Matrouh Cup" />
                        <div className="text-[10px] font-black uppercase tracking-wider bg-[#3e2d14] text-[#f8e596] px-2 py-1 rounded-sm truncate max-w-[80px] shadow-sm">{m.team}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )) : <div className="text-center col-span-full py-20 bg-[#1e2a4a] w-full rounded-3xl border border-yellow-400/30"><p className="text-white font-black text-2xl mb-2">انتظروا جوائز النجوم 🌟</p><p className="text-cyan-300">سيتم تفعيل كروت الفيفا لأفضل لاعب بعد كل مباراة!</p></div>}
          </div>
        )}

        {activeTab === "media" && (
          <div className="space-y-12 animate-in fade-in duration-500">
               <h2 className="text-3xl font-black text-yellow-400 mb-6 flex items-center gap-2"><Play /> المركز الإعلامي</h2>
               {mediaItems.length > 0 ? (
                 <div className="grid gap-6 md:grid-cols-2">
                   {mediaItems.map(item => {
                     const yId = getYoutubeId(item.url);
                     return yId ? (
                       <Card key={item.id} className="bg-[#1e2a4a] border-cyan-500/30 rounded-3xl overflow-hidden p-4 hover:border-cyan-400 transition-colors"><h3 className="text-xl font-bold text-white mb-4 text-center">{item.title}</h3><div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-white/10 shadow-lg"><iframe className="absolute top-0 left-0 w-full h-full" src={`https://www.youtube.com/embed/${yId}`} frameBorder="0" allowFullScreen></iframe></div></Card>
                     ) : null;
                   })}
                 </div>
               ) : <p className="text-center text-white py-10 font-bold">لا توجد فيديوهات حالياً</p>}
          </div>
        )}

        <div className="mt-16 border-t border-white/5 pt-6 pb-2 flex flex-col items-center justify-center text-center">
           <div className="text-gray-400 text-sm font-bold flex items-center gap-2">
              <span>إعداد وتطوير</span>
              <Badge className="bg-[#13213a] text-yellow-400 border border-yellow-400/20 px-3 py-1 font-black text-sm hover:scale-105 transition-transform cursor-default shadow-md">فتحي هيرو 🦅</Badge>
           </div>
           <div className="text-cyan-300 text-[10px] mt-2 opacity-60 font-bold tracking-wider">جميع الحقوق محفوظة © 2026 لبطولة كأس مطروح</div>
        </div>

      </div>
    </div>
  );
}
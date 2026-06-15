"use client";

const calculateLiveMinute = (startTime: any) => { if (!startTime) return 0; const now = new Date().getTime(); const started = new Date(startTime).getTime(); return Math.max(0, Math.floor((now - started) / 60000)); };

import React, { useEffect, useMemo, useState, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Trophy, LogOut, Edit, Trash2, Plus, Play, Pause, BellRing, Star, Activity, Search, ClipboardList, Lock, Unlock, Shield, Camera, Loader2, Archive, Clock, Ban, AlertTriangle, CalendarClock, UserX } from "lucide-react";
import { collection, addDoc, deleteDoc, doc, updateDoc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { TEAM_NAMES } from "@/data/tournament";

const ADMIN_PASSWORD = "hero123";

const GROUP_ROUND = "دور المجموعات";
const MATHANI_KNOCKOUT_ROUNDS = ["دور الـ 16", "دور الستة عشر", "دور الثمانية", "دور الـ 8", "دور الـ 4", "نصف النهائي", "النهائي"];
const MATHANI_BRACKET_TEMPLATE = [
  { matchLabel: "R16-1", nextMatchLabel: "QF-1", nextMatchSlot: "teamA" },
  { matchLabel: "R16-2", nextMatchLabel: "QF-1", nextMatchSlot: "teamB" },
  { matchLabel: "R16-3", nextMatchLabel: "QF-2", nextMatchSlot: "teamA" },
  { matchLabel: "R16-4", nextMatchLabel: "QF-2", nextMatchSlot: "teamB" },
  { matchLabel: "R16-5", nextMatchLabel: "QF-3", nextMatchSlot: "teamA" },
  { matchLabel: "R16-6", nextMatchLabel: "QF-3", nextMatchSlot: "teamB" },
  { matchLabel: "R16-7", nextMatchLabel: "QF-4", nextMatchSlot: "teamA" },
  { matchLabel: "R16-8", nextMatchLabel: "QF-4", nextMatchSlot: "teamB" },
  { matchLabel: "QF-1", nextMatchLabel: "SF-1", nextMatchSlot: "teamA" },
  { matchLabel: "QF-2", nextMatchLabel: "SF-1", nextMatchSlot: "teamB" },
  { matchLabel: "QF-3", nextMatchLabel: "SF-2", nextMatchSlot: "teamA" },
  { matchLabel: "QF-4", nextMatchLabel: "SF-2", nextMatchSlot: "teamB" },
  { matchLabel: "SF-1", nextMatchLabel: "FINAL-1", nextMatchSlot: "teamA" },
  { matchLabel: "SF-2", nextMatchLabel: "FINAL-1", nextMatchSlot: "teamB" },
  { matchLabel: "FINAL-1", nextMatchLabel: "", nextMatchSlot: "teamA" },
];
const isMathaniKnockoutRound = (round: string) => MATHANI_KNOCKOUT_ROUNDS.includes(String(round || "").trim());
const getMathaniStage = (round: string) => isMathaniKnockoutRound(round) ? "knockout" : "group";
const normalizeMathaniRoundName = (round: any) => {
  const r = String(round || "").trim();
  if (["دور الستة عشر", "دور الـ 16", "دور الـ16", "دور 16"].includes(r)) return "دور الـ 16";
  if (["دور الثمانية", "دور الـ 8", "دور الـ8", "دور 8"].includes(r)) return "دور الثمانية";
  if (["نصف النهائي", "دور الـ 4", "دور الـ4", "دور 4"].includes(r)) return "دور الـ 4";
  if (r === "النهائي") return "النهائي";
  return r || GROUP_ROUND;
};
const toScore = (value: any) => { const n = Number(value); return Number.isFinite(n) ? n : 0; };
const getPenaltyScoreValues = (match: any) => {
  const legacyHome = Array.isArray(match?.penaltiesHome) ? match.penaltiesHome.filter((p: any) => p === "scored").length : 0;
  const legacyAway = Array.isArray(match?.penaltiesAway) ? match.penaltiesAway.filter((p: any) => p === "scored").length : 0;
  const homeRaw = match?.homePenaltyGoals ?? match?.penaltyHomeGoals ?? match?.homePenaltiesGoals;
  const awayRaw = match?.awayPenaltyGoals ?? match?.penaltyAwayGoals ?? match?.awayPenaltiesGoals;
  return {
    home: homeRaw !== undefined && homeRaw !== "" ? toScore(homeRaw) : legacyHome,
    away: awayRaw !== undefined && awayRaw !== "" ? toScore(awayRaw) : legacyAway,
  };
};
const hasPenaltyScore = (match: any) => {
  const p = getPenaltyScoreValues(match);
  return p.home > 0 || p.away > 0 || match?.status === "ضربات جزاء";
};
const shouldShowPenaltyScore = (match: any) => {
  return toScore(match?.homeGoals) === toScore(match?.awayGoals) && hasPenaltyScore(match);
};
const getKnockoutWinner = (match: any) => {
  if (!match || match.status !== "انتهت") return "";
  if (match?.qualifiedTeam) return match.qualifiedTeam;
  const homeGoals = toScore(match?.homeGoals);
  const awayGoals = toScore(match?.awayGoals);
  if (homeGoals > awayGoals) return match?.teamA || "";
  if (awayGoals > homeGoals) return match?.teamB || "";
  const penalties = getPenaltyScoreValues(match);
  if (penalties.home > penalties.away) return match?.teamA || "";
  if (penalties.away > penalties.home) return match?.teamB || "";
  return "";
};
const getBracketDefaults = (matchLabel: string) => MATHANI_BRACKET_TEMPLATE.find(item => item.matchLabel === String(matchLabel || "").trim());
const MATHANI_AUTO_BRACKET_PAIRS = [
  { targetLabel: "QF-1", targetRound: "دور الثمانية", sourceA: "R16-1", sourceB: "R16-2" },
  { targetLabel: "QF-2", targetRound: "دور الثمانية", sourceA: "R16-3", sourceB: "R16-4" },
  { targetLabel: "QF-3", targetRound: "دور الثمانية", sourceA: "R16-5", sourceB: "R16-6" },
  { targetLabel: "QF-4", targetRound: "دور الثمانية", sourceA: "R16-7", sourceB: "R16-8" },
  { targetLabel: "SF-1", targetRound: "دور الـ 4", sourceA: "QF-1", sourceB: "QF-2" },
  { targetLabel: "SF-2", targetRound: "دور الـ 4", sourceA: "QF-3", sourceB: "QF-4" },
  { targetLabel: "FINAL-1", targetRound: "النهائي", sourceA: "SF-1", sourceB: "SF-2" },
];
const getAutoBracketPairForTarget = (targetLabel: string) => MATHANI_AUTO_BRACKET_PAIRS.find(item => item.targetLabel === String(targetLabel || "").trim());

const BRACKET_MAP: Record<string, { targetLabel: string, targetSide: 'teamA' | 'teamB' }> = { "م 104": { targetLabel: "م 1", targetSide: 'teamB' }, "م 103": { targetLabel: "م 5", targetSide: 'teamB' }, "م 102": { targetLabel: "م 7", targetSide: 'teamB' }, "م 101": { targetLabel: "م 3", targetSide: 'teamB' }, "م 100": { targetLabel: "م 4", targetSide: 'teamB' }, "م 99": { targetLabel: "م 8", targetSide: 'teamB' }, "م 98": { targetLabel: "م 6", targetSide: 'teamB' }, "م 97": { targetLabel: "م 2", targetSide: 'teamB' } };
const cleanTeamString = (name: any) => String(name || "").replace(/النجيلّة/g, "النجيلة").replace(/علّوش/g, "علوش").trim();
const CLEANED_TEAM_NAMES = Array.from(new Set(TEAM_NAMES.map(t => cleanTeamString(t))));
const PLAYOFF_TEAMS = ["اسماك باسط العوامي", "اصدقاء عز بوالمجدوبة", "السلوم", "اصدقاء عيسي المغواري", "17 فبراير", "الفهود", "اصدقاء قسم الله", "اصدقاء سلامة بدر", "ايس كريم الملكة", "غوط رباح", "محاربي الصحراء", "اصدقاء خالد", "ام القبائل", "شباب القناشات", "اتحاد المثاني", "دبي للزي العربي", "سامي سعيد", "براني", "القدس"];
const JUNIORS_GROUP_A = ["سيف الوادي", "ميلانو", "النجيلة", "كابتن تيكا", "اصدقاء عز بوالمجدوبة"];
const JUNIORS_GROUP_B = ["الاولمبي", "ابناء اكرامي", "غوط رباح", "اصدقاء مهدي", "وادي الرمل"];
const JUNIORS_TEAMS = [...JUNIORS_GROUP_A, ...JUNIORS_GROUP_B];
const SPONSORS = [{ name: "الفهد للديكور", src: "/alfahd.png" }, { name: "أحمد عبدالعاطي المحامي", src: "/abdelaty.png" }, { name: "دثار للزي العربي", src: "/dithar.png" }, { name: "هيرو سبورت", src: "/hero-sport.png" }];

function normalizeTeamName(name: string): string { return String(name || "").trim().replace(/\s+/g, " ").replace(/أ|إ|آ/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/ـ/g, "").replace(/ّ/g, "").toLowerCase(); }
function sortMatches(arr: any[]) { return [...arr].sort((a, b) => { if (a.date !== b.date) return b.date.localeCompare(a.date); return (b.time || "00:00").localeCompare(a.time || "00:00"); }); }
function getArabicDay(dateString: string): string { if (!dateString) return ""; const d = new Date(dateString); if (isNaN(d.getTime())) return ""; const days = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]; return days[d.getDay()]; }
const pushNotification = async (title: string, body: string) => {
  try {
    const res = await fetch("/api/push-service", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ title, body, url: "/" })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.ok) {
      alert(data.error || data.details || "فشل إرسال الإشعار");
      return false;
    }

    if (typeof data.recipients === "number") {
      alert(`تم إرسال الإشعار. عدد المستلمين المتوقع: ${data.recipients}`);
    }

    return true;
  } catch(e) {
    alert("فشل الاتصال بخدمة الإشعارات. تأكد أن /api/push-service موجودة وأن السيرفر شغال.");
    return false;
  }
};
const getAccurateLiveMinute = (match: any) => { const baseMinute = Number(match?.liveMinuteBase ?? match?.liveMinute ?? 0) || 0; const startedAt = Number(match?.timerStartedAt || 0); const pausedTotal = Number(match?.timerPausedTotal || 0) || 0; if (!match?.isTimerRunning || !startedAt) return Number(match?.liveMinute ?? baseMinute) || 0; const elapsed = Math.max(0, Date.now() - startedAt - pausedTotal); return baseMinute + Math.floor(elapsed / 60000); };

/* ═══════════════════════════════════════════════════════
   مكوّنات التصميم الجديد
═══════════════════════════════════════════════════════ */

const SectionCard = ({ title, icon, color = "yellow", children, action }: any) => {
  const colors: Record<string, string> = {
    yellow: "border-yellow-400/40 from-yellow-500/8",
    cyan: "border-cyan-500/40 from-cyan-500/8",
    red: "border-red-500/40 from-red-500/8",
    emerald: "border-emerald-500/40 from-emerald-500/8",
    blue: "border-blue-500/40 from-blue-500/8",
    indigo: "border-indigo-500/40 from-indigo-500/8",
    orange: "border-orange-500/40 from-orange-500/8",
    purple: "border-purple-500/40 from-purple-500/8",
  };
  const titleColors: Record<string, string> = {
    yellow: "text-yellow-300", cyan: "text-cyan-300", red: "text-red-400",
    emerald: "text-emerald-400", blue: "text-blue-400", indigo: "text-indigo-400",
    orange: "text-orange-400", purple: "text-purple-400",
  };
  return (
    <div className={`rounded-2xl border bg-gradient-to-br ${colors[color]} to-transparent bg-[#0f1c35] overflow-hidden shadow-xl`}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <div className={`flex items-center gap-2 font-black text-lg ${titleColors[color]}`}>
          <span>{icon}</span><span>{title}</span>
        </div>
        {action && <div>{action}</div>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
};

const Btn = ({ onClick, disabled, variant = "primary", size = "md", children, className = "" }: any) => {
  const variants: Record<string, string> = {
    primary: "bg-yellow-400 hover:bg-yellow-300 text-black font-black shadow-[0_2px_12px_rgba(250,204,21,0.35)]",
    cyan: "bg-cyan-600 hover:bg-cyan-500 text-white font-black",
    red: "bg-red-600 hover:bg-red-500 text-white font-bold",
    emerald: "bg-emerald-600 hover:bg-emerald-500 text-white font-bold",
    blue: "bg-blue-600 hover:bg-blue-500 text-white font-bold",
    indigo: "bg-indigo-600 hover:bg-indigo-500 text-white font-bold",
    ghost: "bg-white/5 hover:bg-white/10 text-white border border-white/10 font-bold",
    danger: "bg-red-600/80 hover:bg-red-600 text-white font-bold border border-red-500/50",
    orange: "bg-orange-500 hover:bg-orange-400 text-white font-black",
  };
  const sizes: Record<string, string> = {
    sm: "px-3 py-1.5 text-xs rounded-lg",
    md: "px-5 py-2.5 text-sm rounded-xl",
    lg: "px-6 py-3.5 text-base rounded-xl w-full",
    xl: "px-6 py-4 text-lg rounded-xl w-full",
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${variants[variant]} ${sizes[size]} transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${className}`}>
      {children}
    </button>
  );
};

const Field = ({ label, labelColor = "text-gray-400", children }: any) => (
  <div className="space-y-1.5">
    {label && <label className={`text-xs font-bold uppercase tracking-wide ${labelColor}`}>{label}</label>}
    {children}
  </div>
);

const inputCls = "w-full bg-[#0a1428] border border-white/10 rounded-xl px-4 py-2.5 text-white font-bold text-sm outline-none focus:border-yellow-400/50 transition-colors h-11";
const selectCls = `${inputCls} cursor-pointer appearance-none`;

const TogglePill = ({ options, value, onChange, activeColor = "bg-yellow-400 text-black" }: any) => (
  <div className="bg-[#0a1428] border border-white/10 p-1 rounded-full flex gap-1">
    {options.map((opt: any) => (
      <button key={opt.value} onClick={() => onChange(opt.value)}
        className={`flex-1 py-2 px-4 rounded-full text-sm font-bold transition-all ${value === opt.value ? activeColor + " shadow-md" : "text-gray-400 hover:text-white"}`}>
        {opt.label}
      </button>
    ))}
  </div>
);

export default function AdminPage() {
  const [isAuth, setIsAuth] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [mainAppTab, setMainAppTab] = useState<'matrouh_cup' | 'elite_cup' | 'mathani_cup' | 'shop'>('matrouh_cup');
  const [cupEdition, setCupEdition] = useState<'edition_3' | 'edition_4'>('edition_3');
  const [activeTournament, setActiveTournament] = useState<'youth' | 'juniors'>('youth');
  const [activeTab, setActiveTab] = useState("champion");
  const [eliteActiveTab, setEliteActiveTab] = useState("reg_settings");

  const [eliteTeams, setEliteTeams] = useState<any[]>([]);
  const [eliteTeamForm, setEliteTeamForm] = useState({ name: "", logoUrl: "" });

  const [mathaniGroups, setMathaniGroups] = useState<string[][]>(Array.from({ length: 8 }, () => ["", "", "", ""]));

  const [matches, setMatches] = useState<any[]>([]);
  const matchesRef = useRef<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [cardEvents, setCardEvents] = useState<any[]>([]);
  const [mediaItems, setMediaItems] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [motmList, setMotmList] = useState<any[]>([]);
  const [formationsList, setFormationsList] = useState<any[]>([]);
  const [rostersList, setRostersList] = useState<any[]>([]);
  const [ordersList, setOrdersList] = useState<any[]>([]);
  const [tickerText, setTickerText] = useState("");

  const [bannedList, setBannedList] = useState<any[]>([]);
  const [restrictedPlayers, setRestrictedPlayers] = useState<any[]>([]);

  const [regDeadlineMatrouh, setRegDeadlineMatrouh] = useState("");
  const [regPasswordMatrouh, setRegPasswordMatrouh] = useState("");
  const [regPriceMatrouh, setRegPriceMatrouh] = useState(500);
  const [regDeadlineElite, setRegDeadlineElite] = useState("");
  const [regPasswordElite, setRegPasswordElite] = useState("");
  const [regPriceElite, setRegPriceElite] = useState(1000);

  const [bannedForm, setBannedForm] = useState({ name: "", type: "player" });
  const [restrictedForm, setRestrictedForm] = useState({ name: "" });
  const [koSearchTerm, setKoSearchTerm] = useState("");
  const [goalSearchTerm, setGoalSearchTerm] = useState("");
  const [cardSearchTerm, setCardSearchTerm] = useState("");
  const [notifyTitle, setNotifyTitle] = useState("");
  const [notifyBody, setNotifyBody] = useState("");
  const [isSending, setIsSending] = useState(false);

  const [posterMatch, setPosterMatch] = useState<any | null>(null);
  const [posterLogos, setPosterLogos] = useState({ a: "", b: "" });
  const [isGeneratingPoster, setIsGeneratingPoster] = useState(false);
  const [isPreparingPoster, setIsPreparingPoster] = useState(false);
  const [motmPopupMatch, setMotmPopupMatch] = useState<any | null>(null);
  const [quickMotmForm, setQuickMotmForm] = useState({ player: "", team: "", rating: 99 });
  const [time, setTime] = useState<Date | null>(null);

  const [adminLineup, setAdminLineup] = useState<any>({
    manager: { name: "عبدالله موسى", team: "وادي ماجد", image: "" },
    starters: [
      { id: "gk", name: "طاهر يحيى", team: "وادي ماجد", role: "حارس مرمى", posText: "GK", fallback: "طا", image: "" },
      { id: "def1", name: "حامد علي", team: "17 فبراير", role: "مدافع", posText: "CB", fallback: "حا", image: "" },
      { id: "def2", name: "أحمد سعيد", team: "أصدقاء سامي", role: "مدافع", posText: "CB", fallback: "أح", image: "" },
      { id: "mid1", name: "عيسى العوامي", team: "وادي ماجد", role: "وسط", posText: "CM", fallback: "عي", image: "" },
      { id: "mid2", name: "أسامة محمد", team: "القدس", role: "وسط", posText: "RM", fallback: "أس", image: "" },
      { id: "mid3", name: "عبدالله خميس", team: "17 فبراير", role: "وسط", posText: "LM", fallback: "عب", image: "" },
      { id: "fwd", name: "منعم بورسوة", team: "وادي ماجد", role: "مهاجم", posText: "ST", fallback: "من", image: "" }
    ],
    subs: [
      { name: "عز معيوف", team: "أصدقاء سلامة بدر", role: "وسط", fallback: "عز" },
      { name: "أيمن مصطفى", team: "القدس", role: "مدافع", fallback: "أي" },
      { name: "مصطفى ناجي", team: "وادي ماجد", role: "وسط يمين", fallback: "من" },
      { name: "محمد مبروك", team: "الفهود", role: "وسط", fallback: "مم" },
      { name: "مصطفى أنور", team: "النسور", role: "مدافع", fallback: "مص" }
    ]
  });

  const sortedTeams = useMemo(() => Array.from(new Set([...CLEANED_TEAM_NAMES, ...PLAYOFF_TEAMS])).sort((a, b) => a.localeCompare(b, "ar")), []);
  const sortedJuniorsTeams = useMemo(() => [...JUNIORS_TEAMS].sort((a, b) => a.localeCompare(b, "ar")), []);
  
  const currentTeamsList = useMemo(() => {
    if (mainAppTab === 'mathani_cup') {
       const t = new Set<string>();
       mathaniGroups.forEach(g => g.forEach(team => { if (team.trim()) t.add(team.trim()); }));
       return Array.from(t).sort((a,b) => a.localeCompare(b, "ar"));
    }
    if (cupEdition === 'edition_3') return activeTournament === 'youth' ? sortedTeams : sortedJuniorsTeams;
    return Array.from(new Set(rostersList.map(r => r.id)));
  }, [cupEdition, activeTournament, sortedTeams, sortedJuniorsTeams, rostersList, mainAppTab, mathaniGroups]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const createEmptyMatchForm = () => ({
    teamA: "",
    teamALogo: "",
    teamB: "",
    teamBLogo: "",
    homeGoals: 0,
    awayGoals: 0,
    homePenaltyGoals: 0,
    awayPenaltyGoals: 0,
    matchLabel: "",
    round: GROUP_ROUND,
    stage: "group",
    qualifiedTeam: "",
    nextMatchLabel: "",
    nextMatchSlot: "teamA",
    date: new Date().toISOString().slice(0, 10),
    time: "15:30",
    status: "لم تبدأ",
  });
  const [matchForm, setMatchForm] = useState(createEmptyMatchForm());
  const defaultStats = { rating: 99, pac: 99, sho: 99, pas: 99, dri: 99, def: 99, phy: 99 };
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [goalForm, setGoalForm] = useState({ player: "", team: currentTeamsList[0] || "", goalsCount: 1, imageUrl: "", ...defaultStats });
  const [editingMotmId, setEditingMotmId] = useState<string | null>(null);
  const [motmForm, setMotmForm] = useState({ player: "", team: currentTeamsList[0] || "", imageUrl: "", matchName: "", sponsorName: SPONSORS[0].name, sponsorLogo: SPONSORS[0].src, ...defaultStats });
  const [cardForm, setCardForm] = useState({ player: "", team: currentTeamsList[0] || "", type: "yellow" as "yellow" | "red" });
  const [mediaForm, setMediaForm] = useState({ type: "news", title: "", url: "", imageUrl: "", body: "" });
  const defaultPlayer = { name: "", team: "", imageUrl: "", rating: 99 };
  const defaultCoach = { name: "", team: "", imageUrl: "", rating: 99 };
  const [formationForm, setFormationForm] = useState({ round: "دور المجموعات", players: Array(7).fill({ ...defaultPlayer }), coach: { ...defaultCoach } });
  const [editingRosterId, setEditingRosterId] = useState<string | null>(null);
  const [rosterFormAdmin, setRosterFormAdmin] = useState({ managerName: "", managerPhone: "", password: "", isSubmitted: false, logoUrl: "", players: Array.from({ length: 12 }, () => ({ name: "", number: "" })) });

  const getColl = (base: string) => { 
     if (mainAppTab === 'mathani_cup') return `${base}_mathani`;
     if (mainAppTab === 'elite_cup') return `${base}_elite`;
     let coll = base; 
     if (cupEdition === 'edition_4') coll += '_ed4'; 
     if (activeTournament === 'juniors') coll += '_juniors'; 
     return coll; 
  };

  useEffect(() => { const clockTimer = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(clockTimer); }, []);

 useEffect(() => {
    // تطبيق قفل التبويبات على كأس مطروح فقط حتى لا يؤثر على بطولة المثاني
    if (mainAppTab === 'matrouh_cup') {
      if (cupEdition === 'edition_3' && activeTab === 'matches') setActiveTab('champion');
      if (cupEdition === 'edition_4' && activeTab === 'champion') setActiveTab('registration_settings');
    }
  }, [cupEdition, activeTab, mainAppTab]);

  useEffect(() => {
    setMatchForm(createEmptyMatchForm());
    setGoalForm(p => ({ ...p, team: currentTeamsList[0] || "", player: "", goalsCount: 1, imageUrl: "" }));
    setCardForm(p => ({ ...p, team: currentTeamsList[0] || "", player: "" }));
    setMotmForm(p => ({ ...p, team: currentTeamsList[0] || "", player: "", imageUrl: "", matchName: "" }));
    setEditingId(null); setEditingGoalId(null); setEditingMotmId(null); setEditingRosterId(null);
  }, [activeTournament, currentTeamsList, cupEdition, mainAppTab]);

  useEffect(() => {
    const existing = formationsList.find(f => f.round === formationForm.round);
    if (existing) {
      const playersArr = Array.isArray(existing.players) ? [...existing.players] : Array(7).fill({ ...defaultPlayer });
      while (playersArr.length < 7) playersArr.push({ ...defaultPlayer });
      setFormationForm({ round: existing.round, players: playersArr, coach: existing.coach || { ...defaultCoach } });
    } else { setFormationForm(p => ({ ...p, players: Array(7).fill({ ...defaultPlayer }), coach: { ...defaultCoach } })); }
  }, [formationForm.round, formationsList]);

  useEffect(() => { matchesRef.current = matches; }, [matches]);

  useEffect(() => {
    if (!isAuth) return;
    const collName = getColl("matches");
    const unsubMatches = onSnapshot(collection(db, collName), (snap) => setMatches(snap.docs.map(d => ({ id: d.id, ...d.data(), teamA: cleanTeamString(d.data().teamA), teamB: cleanTeamString(d.data().teamB) }))));
    const unsubGoals = onSnapshot(collection(db, getColl("goals")), (snap) => setGoals(snap.docs.map(d => ({ id: d.id, ...d.data(), team: cleanTeamString(d.data().team) }))));
    const unsubCards = onSnapshot(collection(db, getColl("cards")), (snap) => setCardEvents(snap.docs.map(d => ({ id: d.id, ...d.data(), team: cleanTeamString(d.data().team) }))));
    const unsubMedia = onSnapshot(collection(db, getColl("media")), (snap) => setMediaItems(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubPredictions = onSnapshot(collection(db, getColl("predictions")), (snap) => setPredictions(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => b.timestamp?.localeCompare(a.timestamp) || 0)));
    const unsubMotm = onSnapshot(collection(db, getColl("motm")), (snap) => setMotmList(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubForms = onSnapshot(collection(db, getColl("formations")), (snap) => setFormationsList(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubRosters = onSnapshot(collection(db, getColl("team_rosters")), (snap) => setRostersList(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubOrders = onSnapshot(collection(db, "orders"), (snap) => setOrdersList(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))));
    const unsubTicker = onSnapshot(doc(db, "settings", "ticker"), (docSnap) => setTickerText(docSnap.data()?.text || ""));
    const unsubEliteTeams = onSnapshot(collection(db, "elite_teams"), (snap) => setEliteTeams(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubBanned = onSnapshot(collection(db, "banned_entities"), (snap) => setBannedList(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubRestricted = onSnapshot(collection(db, "restricted_players"), (snap) => setRestrictedPlayers(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    
    const unsubMathaniGroups = onSnapshot(doc(db, "settings", "mathani_groups"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const arr = Array.from({ length: 8 }, () => ["", "", "", ""]);
        for (let i = 0; i < 8; i++) {
          if (data[`group${i}`] && Array.isArray(data[`group${i}`])) {
            const groupData = data[`group${i}`];
            arr[i] = [groupData[0] || "", groupData[1] || "", groupData[2] || "", groupData[3] || ""];
          }
        }
        setMathaniGroups(arr);
      } else {
        setMathaniGroups(Array.from({ length: 8 }, () => ["", "", "", ""]));
      }
    });

    const unsubRegMat = onSnapshot(doc(db, "settings", "registration_matrouh"), (docSnap) => { if (docSnap.exists()) { setRegDeadlineMatrouh(docSnap.data().deadline || ""); setRegPasswordMatrouh(docSnap.data().password || ""); setRegPriceMatrouh(docSnap.data().price || 500); } });
    const unsubRegElite = onSnapshot(doc(db, "settings", "registration_elite"), (docSnap) => { if (docSnap.exists()) { setRegDeadlineElite(docSnap.data().deadline || ""); setRegPasswordElite(docSnap.data().password || ""); setRegPriceElite(docSnap.data().price || 1000); } });
    const unsubTourLineup = onSnapshot(doc(db, getColl("tournament_lineup"), "current"), (snap) => { if (snap.exists()) { setAdminLineup(snap.data()); } });
    
    const timerInterval = setInterval(() => {
      matchesRef.current.forEach(m => {
        if (m.isTimerRunning && m.status !== "انتهت" && m.status !== "استراحة" && m.status !== "ضربات جزاء" && m.status !== "ستبدأ بعد قليل") {
          const accurateMinute = getAccurateLiveMinute(m);
          if (accurateMinute !== Number(m.liveMinute || 0)) { updateDoc(doc(db, collName, m.id), { liveMinute: accurateMinute }); }
        }
      });
    }, 5000);
    return () => { unsubMatches(); unsubGoals(); unsubCards(); unsubMedia(); unsubPredictions(); unsubMotm(); unsubForms(); unsubRosters(); unsubOrders(); unsubTicker(); unsubEliteTeams(); unsubBanned(); unsubRestricted(); unsubRegMat(); unsubRegElite(); unsubTourLineup(); unsubMathaniGroups(); clearInterval(timerInterval); };
  }, [isAuth, activeTournament, cupEdition, mainAppTab]);

  const handleLogin = () => passwordInput === ADMIN_PASSWORD ? setIsAuth(true) : alert("كلمة السر خاطئة");
  
  const getWinnerPayload = (match: any) => {
    const team = getKnockoutWinner(match);
    if (!team) return null;
    const logo = normalizeTeamName(team) === normalizeTeamName(match?.teamA)
      ? match?.teamALogo || ""
      : match?.teamBLogo || "";
    return { team, logo };
  };

  const syncMathaniKnockoutBracket = async (savedMatch: any) => {
    if (mainAppTab !== "mathani_cup") return;

    const isKnockout = savedMatch.stage === "knockout" || isMathaniKnockoutRound(savedMatch.round);
    if (!isKnockout) return;

    if (savedMatch.status === "انتهت" && !getKnockoutWinner(savedMatch)) {
      alert("المباراة إقصائية وانتهت بالتعادل. اختر الفريق الصاعد يدويًا من خانة الفريق الصاعد عند التعادل/الترجيح ثم احفظ المباراة.");
      return;
    }

    const collName = getColl("matches");
    let workingMatches = [
      ...matchesRef.current.filter((m) => m.id !== savedMatch.id),
      savedMatch,
    ];

    const generatedLabels: string[] = [];

    for (const pair of MATHANI_AUTO_BRACKET_PAIRS) {
      const sourceA = workingMatches.find((m) => String(m.matchLabel || "").trim() === pair.sourceA);
      const sourceB = workingMatches.find((m) => String(m.matchLabel || "").trim() === pair.sourceB);
      const winnerA = getWinnerPayload(sourceA);
      const winnerB = getWinnerPayload(sourceB);

      if (!winnerA || !winnerB) continue;

      const existingTarget = workingMatches.find((m) => String(m.matchLabel || "").trim() === pair.targetLabel);
      const generatedPayload: any = {
        teamA: winnerA.team,
        teamALogo: winnerA.logo,
        teamB: winnerB.team,
        teamBLogo: winnerB.logo,
        matchLabel: pair.targetLabel,
        round: pair.targetRound,
        stage: "knockout",
        autoGenerated: true,
        generatedFrom: [pair.sourceA, pair.sourceB],
        dayName: "",
        updatedAt: new Date().toISOString(),
      };

      if (existingTarget?.id) {
        await updateDoc(doc(db, collName, existingTarget.id), generatedPayload);
        workingMatches = workingMatches.map((m) =>
          m.id === existingTarget.id ? { ...m, ...generatedPayload } : m
        );
      } else {
        const createdData = {
          ...generatedPayload,
          homeGoals: 0,
          awayGoals: 0,
          homePenaltyGoals: 0,
          awayPenaltyGoals: 0,
          qualifiedTeam: "",
          date: new Date().toISOString().slice(0, 10),
          time: "15:30",
          status: "لم تبدأ",
          isLive: false,
          streamClosed: false,
          createdAt: new Date().toISOString(),
        };
        const created = await addDoc(collection(db, collName), createdData);
        workingMatches.push({ id: created.id, ...createdData });
      }

      generatedLabels.push(pair.targetLabel);
    }

    if (generatedLabels.length) {
      alert(`✅ تم تحديث/إنشاء مباريات الدور التالي تلقائيًا: ${Array.from(new Set(generatedLabels)).join("، ")}`);
    }
  };

  const saveMatch = async () => {
    if (!matchForm.teamA.trim() || !matchForm.teamB.trim()) return alert("يجب إدخال أسماء الفرق!");
    const dayName = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"][new Date(matchForm.date).getDay()];
    const stage = mainAppTab === "mathani_cup" ? getMathaniStage(matchForm.round) : "group";

    const data = {
      ...matchForm,
      stage,
      homeGoals: toScore(matchForm.homeGoals),
      awayGoals: toScore(matchForm.awayGoals),
      homePenaltyGoals: toScore((matchForm as any).homePenaltyGoals),
      awayPenaltyGoals: toScore((matchForm as any).awayPenaltyGoals),
      dayName,
      isLive: false,
      streamClosed: false,
      updatedAt: new Date().toISOString(),
    };

    if (editingId) {
      await updateDoc(doc(db, getColl("matches"), editingId), data);
      await syncMathaniKnockoutBracket({ id: editingId, ...data });
      setEditingId(null);
      alert("✅ تم تعديل بيانات ونتيجة المباراة بنجاح");
    } else {
      const created = await addDoc(collection(db, getColl("matches")), { ...data, createdAt: new Date().toISOString() });
      await syncMathaniKnockoutBracket({ id: created.id, ...data });
      alert("✅ تم إضافة المباراة بنجاح");
    }

    setMatchForm(createEmptyMatchForm());
  };

  const startEdit = (match: any) => {
    setEditingId(match.id);
    setMatchForm({
      ...createEmptyMatchForm(),
      teamA: match.teamA || "",
      teamALogo: match.teamALogo || "",
      teamB: match.teamB || "",
      teamBLogo: match.teamBLogo || "",
      homeGoals: toScore(match.homeGoals),
      awayGoals: toScore(match.awayGoals),
      homePenaltyGoals: toScore(match.homePenaltyGoals ?? match.penaltyHomeGoals ?? getPenaltyScoreValues(match).home),
      awayPenaltyGoals: toScore(match.awayPenaltyGoals ?? match.penaltyAwayGoals ?? getPenaltyScoreValues(match).away),
      matchLabel: match.matchLabel || "",
      round: match.round || GROUP_ROUND,
      stage: match.stage || getMathaniStage(match.round || GROUP_ROUND),
      qualifiedTeam: match.qualifiedTeam || "",
      nextMatchLabel: match.nextMatchLabel || "",
      nextMatchSlot: match.nextMatchSlot || "teamA",
      date: match.date || new Date().toISOString().slice(0, 10),
      time: match.time || "15:30",
      status: match.status || "لم تبدأ",
    });
    setActiveTab("matches");
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteMatch = async (id: string) => confirm("متأكد من حذف هذه المباراة نهائياً؟") && await deleteDoc(doc(db, getColl("matches"), id));

  const updateMatchLive = async (id: string, updates: any) => {
    const currentMatch = matchesRef.current.find(m => m.id === id) || matches.find(m => m.id === id);
    const nextUpdates = { ...updates };
    if (Object.prototype.hasOwnProperty.call(nextUpdates, 'isTimerRunning')) {
      if (nextUpdates.isTimerRunning) {
        const baseMinute = getAccurateLiveMinute(currentMatch);
        nextUpdates.liveMinute = baseMinute;
        nextUpdates.liveMinuteBase = baseMinute;
        nextUpdates.timerStartedAt = Date.now();
        nextUpdates.timerPausedTotal = 0;
      } else if (currentMatch) {
        const pausedMinute = getAccurateLiveMinute(currentMatch);
        nextUpdates.liveMinute = pausedMinute;
        nextUpdates.liveMinuteBase = pausedMinute;
        nextUpdates.timerStartedAt = null;
        nextUpdates.timerPausedTotal = 0;
      }
    }
    if (Object.prototype.hasOwnProperty.call(nextUpdates, 'liveMinute') && currentMatch?.isTimerRunning && !Object.prototype.hasOwnProperty.call(updates, 'isTimerRunning')) {
      nextUpdates.liveMinuteBase = Number(nextUpdates.liveMinute) || 0;
      nextUpdates.timerStartedAt = Date.now();
      nextUpdates.timerPausedTotal = 0;
    }

    await updateDoc(doc(db, getColl("matches"), id), nextUpdates);

    const updatedMatch = {
      ...currentMatch,
      ...nextUpdates,
      id,
      stage: currentMatch?.stage || getMathaniStage(currentMatch?.round || GROUP_ROUND),
    };
    await syncMathaniKnockoutBracket(updatedMatch);
  };
  
  const startEditRoster = (teamName: string) => { const existing = rostersList.find(r => r.id === teamName); let loadedPlayers = Array.from({ length: 12 }, () => ({ name: "", number: "" })); if (existing && existing.players) { loadedPlayers = [...existing.players]; while (loadedPlayers.length < 12) loadedPlayers.push({ name: "", number: "" }); } setRosterFormAdmin({ managerName: existing?.managerName || "", managerPhone: existing?.managerPhone || "", password: existing?.password || "", logoUrl: existing?.logoUrl || "", isSubmitted: existing?.isSubmitted || false, players: loadedPlayers.slice(0, 12) }); setEditingRosterId(teamName); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const updateAdminRosterPlayer = (index: number, field: string, value: string) => { setRosterFormAdmin(prev => { const newPlayers = [...prev.players]; newPlayers[index] = { ...newPlayers[index], [field]: value }; return { ...prev, players: newPlayers }; }); };
  const saveRosterAdmin = async () => { if (!editingRosterId) return; try { await setDoc(doc(db, getColl("team_rosters"), editingRosterId), { teamName: editingRosterId, managerName: rosterFormAdmin.managerName, managerPhone: rosterFormAdmin.managerPhone, password: rosterFormAdmin.password, logoUrl: rosterFormAdmin.logoUrl, isSubmitted: rosterFormAdmin.isSubmitted, players: rosterFormAdmin.players, updatedAt: new Date().toISOString() }, { merge: true }); alert("تم الحفظ بنجاح! ✔️"); setEditingRosterId(null); } catch (e) { alert("حدث خطأ."); } };
  const deleteRoster = async (teamName: string) => { if (confirm(`هل أنت متأكد من مسح قائمة ${teamName} بالكامل؟`)) { await deleteDoc(doc(db, getColl("team_rosters"), teamName)); alert("تم مسح القائمة بنجاح."); } };
  const unlockRoster = async (teamName: string) => { if (confirm(`هل تريد فتح القفل لقائمة ${teamName}؟`)) { await updateDoc(doc(db, getColl("team_rosters"), teamName), { isSubmitted: false }); alert("تم فتح القائمة."); } };
  const lockRoster = async (teamName: string) => { await updateDoc(doc(db, getColl("team_rosters"), teamName), { isSubmitted: true }); alert("تم قفل القائمة واعتمادها."); };
  const openMotmPopup = (match: any) => { setMotmPopupMatch(match); setQuickMotmForm({ player: "", team: match.teamA, rating: 99 }); };
  const saveQuickMotm = async () => { if (!quickMotmForm.player.trim()) return alert("اكتب اسم اللاعب!"); try { await addDoc(collection(db, getColl("motm")), { player: quickMotmForm.player.trim(), team: quickMotmForm.team, matchName: `${motmPopupMatch.teamA} vs ${motmPopupMatch.teamB}`, imageUrl: "", sponsorName: SPONSORS[0].name, sponsorLogo: SPONSORS[0].src, rating: Number(quickMotmForm.rating), pac: 99, sho: 99, pas: 99, dri: 99, def: 99, phy: 99 }); alert("تم تسجيل النجم بنجاح!"); setMotmPopupMatch(null); } catch (e) { alert("حدث خطأ."); } };
  const addMotm = async () => { if (!motmForm.player.trim()) return alert("اكتب اسم اللاعب!"); const data = { ...motmForm, rating: Number(motmForm.rating), pac: Number(motmForm.pac), sho: Number(motmForm.sho), pas: Number(motmForm.pas), dri: Number(motmForm.dri), def: Number(motmForm.def), phy: Number(motmForm.phy) }; if (editingMotmId) { await updateDoc(doc(db, getColl("motm"), editingMotmId), data); setEditingMotmId(null); alert("تم التعديل"); } else { await addDoc(collection(db, getColl("motm")), data); alert("تم الإضافة"); } setMotmForm({ player: "", team: currentTeamsList[0] || "", imageUrl: "", matchName: "", sponsorName: SPONSORS[0].name, sponsorLogo: SPONSORS[0].src, ...defaultStats }); };
  const startEditMotm = (m: any) => { setEditingMotmId(m.id); setMotmForm({ player: m.player || "", team: m.team || currentTeamsList[0], imageUrl: m.imageUrl || "", matchName: m.matchName || "", sponsorName: m.sponsorName || SPONSORS[0].name, sponsorLogo: m.sponsorLogo || SPONSORS[0].src, rating: m.rating || 99, pac: m.pac || 99, sho: m.sho || 99, pas: m.pas || 99, dri: m.dri || 99, def: m.def || 99, phy: m.phy || 99 }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const deleteMotm = async (id: string) => confirm("حذف هذا اللاعب؟") && await deleteDoc(doc(db, getColl("motm"), id));
  const openPoster = async (match: any) => { setPosterMatch(match); setIsPreparingPoster(true); setPosterLogos({ a: "", b: "" }); const fetchBase64 = async (url: string) => { if (!url) return ""; try { const res = await fetch(`https://wsrv.nl/?url=${encodeURIComponent(url)}&output=png`); const blob = await res.blob(); return await new Promise<string>((resolve) => { const reader = new FileReader(); reader.onloadend = () => resolve(reader.result as string); reader.readAsDataURL(blob); }); } catch (e) { return url; } }; setPosterLogos({ a: await fetchBase64(match.teamALogo), b: await fetchBase64(match.teamBLogo) }); setIsPreparingPoster(false); };
  const downloadPoster = async () => { const element = document.getElementById("poster-canvas-node"); if (!element) return; setIsGeneratingPoster(true); try { await new Promise(resolve => setTimeout(resolve, 300)); const htmlToImage = await import('html-to-image'); const dataUrl = await htmlToImage.toJpeg(element, { quality: 0.95, backgroundColor: '#050a14', pixelRatio: 2 }); const link = document.createElement("a"); link.href = dataUrl; link.download = `Result_${posterMatch.teamA}_vs_${posterMatch.teamB}.jpg`; document.body.appendChild(link); link.click(); document.body.removeChild(link); } catch (err) { } setIsGeneratingPoster(false); };
  const addOrUpdateGoal = async () => { if (!goalForm.player.trim()) return alert("اكتب اسم اللاعب"); const statsData: any = { goals: Number(goalForm.goalsCount), rating: Number(goalForm.rating), pac: Number(goalForm.pac), sho: Number(goalForm.sho), pas: Number(goalForm.pas), dri: Number(goalForm.dri), def: Number(goalForm.def), phy: Number(goalForm.phy) }; if (goalForm.imageUrl.trim()) statsData.imageUrl = goalForm.imageUrl.trim(); if (editingGoalId) { await updateDoc(doc(db, getColl("goals"), editingGoalId), { player: goalForm.player.trim(), team: goalForm.team, ...statsData }); setEditingGoalId(null); alert("تم التعديل"); } else { const existingPlayer = goals.find(g => normalizeTeamName(g.player) === normalizeTeamName(goalForm.player.trim()) && g.team === goalForm.team); if (existingPlayer) { await updateDoc(doc(db, getColl("goals"), existingPlayer.id), { ...statsData, goals: (Number(existingPlayer.goals) || 0) + statsData.goals }); alert(`تم التحديث تراكمياً`); } else { await addDoc(collection(db, getColl("goals")), { player: goalForm.player.trim(), team: goalForm.team, ...statsData }); alert("تم الإضافة"); } } setGoalForm({ player: "", team: currentTeamsList[0] || "", goalsCount: 1, imageUrl: "", ...defaultStats }); };
  const startEditGoal = (goal: any) => { setEditingGoalId(goal.id); setGoalForm({ player: goal.player, team: goal.team, goalsCount: goal.goals, imageUrl: goal.imageUrl || "", rating: goal.rating || 99, pac: goal.pac || 99, sho: goal.sho || 99, pas: goal.pas || 99, dri: goal.dri || 99, def: goal.def || 99, phy: goal.phy || 99 }); };
  const deleteGoal = async (id: string) => confirm("حذف هذا الهدف؟") && await deleteDoc(doc(db, getColl("goals"), id));
  const addCard = async () => { if (!cardForm.player.trim()) return alert("اكتب اسم اللاعب"); const existingPlayer = cardEvents.find(c => normalizeTeamName(c.player) === normalizeTeamName(cardForm.player.trim()) && c.team === cardForm.team); if (existingPlayer) { await updateDoc(doc(db, getColl("cards"), existingPlayer.id), { yellow: (Number(existingPlayer.yellow) || 0) + (cardForm.type === "yellow" ? 1 : 0), red: (Number(existingPlayer.red) || 0) + (cardForm.type === "red" ? 1 : 0) }); alert(`تمت إضافة بطاقة تراكمية`); } else { await addDoc(collection(db, getColl("cards")), { player: cardForm.player.trim(), team: cardForm.team, yellow: cardForm.type === "yellow" ? 1 : 0, red: cardForm.type === "red" ? 1 : 0 }); alert("تم الإضافة"); } setCardForm(p => ({ ...p, player: "" })); };
  const deleteCard = async (id: string) => confirm("حذف البطاقة؟") && await deleteDoc(doc(db, getColl("cards"), id));
  const archiveAndResetCards = async () => { if (!confirm("تصفير للأرشيف؟")) return; try { for (const card of cardEvents) { if (card.yellow > 0 || card.red > 0) { await addDoc(collection(db, getColl("archived_cards")), { ...card, archivedAt: new Date().toISOString() }); await updateDoc(doc(db, getColl("cards"), card.id), { yellow: 0, red: 0 }); } } alert(`تمت الأرشفة بنجاح`); } catch (e) { } };
  const addMedia = async () => { if (!mediaForm.title.trim()) return alert("العنوان مطلوب"); await addDoc(collection(db, getColl("media")), mediaForm); setMediaForm({ type: "news", title: "", url: "", imageUrl: "", body: "" }); alert("تم الإضافة"); };
  const deleteMedia = async (id: string) => confirm("حذف العنصر؟") && await deleteDoc(doc(db, getColl("media"), id));
  const saveFormation = async () => { const existing = formationsList.find(f => f.round === formationForm.round); if (existing) { await updateDoc(doc(db, getColl("formations"), existing.id), { players: formationForm.players, coach: formationForm.coach || { ...defaultCoach } }); alert("تم التحديث"); } else { await addDoc(collection(db, getColl("formations")), { round: formationForm.round, players: formationForm.players, coach: formationForm.coach || { ...defaultCoach } }); alert("تم الحفظ"); } };
  const updateFormationPlayer = (index: number, field: string, value: any) => { setFormationForm(prev => { const newPlayers = [...prev.players]; newPlayers[index] = { ...newPlayers[index], [field]: value }; return { ...prev, players: newPlayers }; }); };
  const updateFormationCoach = (field: string, value: any) => { setFormationForm(prev => ({ ...prev, coach: { ...(prev.coach || { ...defaultCoach }), [field]: value } })); };
  const deletePrediction = async (id: string) => { if (confirm("حذف التوقع؟")) { await deleteDoc(doc(db, getColl("predictions"), id)); alert("تم الحذف"); } };
  const deleteAllPredictions = async () => { if (!confirm("مسح جميع التوقعات؟")) return; for (const p of predictions) { await deleteDoc(doc(db, getColl("predictions"), p.id)); } alert("تم التصفية"); };
  const saveTicker = async () => { if (!tickerText.trim()) return alert("اكتب الخبر"); await setDoc(doc(db, "settings", "ticker"), { text: tickerText.trim() }); alert("تم النشر"); };
  const sendQuickNotification = async (title: string, body: string) => { await pushNotification(title, body); };
  const sendNotification = async () => {
    if (!notifyTitle.trim() || !notifyBody.trim()) return alert("مطلوب العنوان والتفاصيل");
    setIsSending(true);
    try {
      const success = await pushNotification(notifyTitle.trim(), notifyBody.trim());
      if (success) {
        setNotifyTitle("");
        setNotifyBody("");
      }
    } finally {
      setIsSending(false);
    }
  };
  const addBannedEntity = async () => { if (!bannedForm.name.trim()) return alert("يرجى كتابة الاسم"); await addDoc(collection(db, "banned_entities"), { ...bannedForm, name: bannedForm.name.trim() }); setBannedForm({ name: "", type: "player" }); alert("تم الإضافة لسجل الحظر"); };
  const removeBannedEntity = async (id: string) => { if (confirm("رفع الحظر عن هذا الاسم؟")) await deleteDoc(doc(db, "banned_entities", id)); };
  const addRestrictedPlayer = async () => { if (!restrictedForm.name.trim()) return alert("يرجى كتابة اسم اللاعب"); await addDoc(collection(db, "restricted_players"), { name: restrictedForm.name.trim() }); setRestrictedForm({ name: "" }); alert("تم إضافة اللاعب لقائمة المقيدين"); };
  const removeRestrictedPlayer = async (id: string) => { if (confirm("إزالة اللاعب من القائمة المقيدة؟")) await deleteDoc(doc(db, "restricted_players", id)); };
  const saveRegistrationSettingsMatrouh = async () => { if (!regDeadlineMatrouh || !regPasswordMatrouh) return alert("الرجاء استكمال البيانات"); await setDoc(doc(db, "settings", "registration_matrouh"), { deadline: regDeadlineMatrouh, password: regPasswordMatrouh, price: Number(regPriceMatrouh) }, { merge: true }); alert("تم تحديث إعدادات وأسعار كأس مطروح 💾"); };
  const saveRegistrationSettingsElite = async () => { if (!regDeadlineElite || !regPasswordElite) return alert("الرجاء استكمال البيانات"); await setDoc(doc(db, "settings", "registration_elite"), { deadline: regDeadlineElite, password: regPasswordElite, price: Number(regPriceElite) }, { merge: true }); alert("تم تحديث إعدادات وأسعار كأس النخبة 💾"); };
  const addEliteTeam = async () => { if (!eliteTeamForm.name.trim()) return alert("أدخل اسم الفريق"); await addDoc(collection(db, "elite_teams"), eliteTeamForm); alert("تم إضافة الفريق للنخبة"); setEliteTeamForm({ name: "", logoUrl: "" }); };
  const deleteEliteTeam = async (id: string) => { if (confirm("حذف هذا الفريق؟")) await deleteDoc(doc(db, "elite_teams", id)); };

  const saveMathaniGroups = async () => {
    try {
      const groupsObject: Record<string, any> = {};
      mathaniGroups.forEach((group, index) => {
        groupsObject[`group${index}`] = group;
      });
      await setDoc(doc(db, "settings", "mathani_groups"), groupsObject);
      alert("تم حفظ مجموعات بطولة المثاني بنجاح! ✔️");
    } catch(e: any) {
      console.error(e);
      alert("حدث خطأ أثناء الحفظ: " + e.message);
    }
  };

  const safeGoalSearch = goalSearchTerm.toLowerCase();
  const filteredGoals = goals.filter(g => normalizeTeamName(g.player).includes(safeGoalSearch) || normalizeTeamName(g.team).includes(safeGoalSearch));
  const safeCardSearch = cardSearchTerm.toLowerCase();
  const filteredCards = cardEvents.filter(c => normalizeTeamName(c.player).includes(safeCardSearch) || normalizeTeamName(c.team).includes(safeCardSearch));

  const allAdminTabs = [
    { key: "champion", label: "👑 البطل", app: ["matrouh_cup"], hideForEd4: true },
    { key: "registration_settings", label: "⚙️ التسجيل", app: ["matrouh_cup"], hideForEd3: true },
    { key: "tournament_lineup_admin", label: "📋 تشكيل البطولة", app: ["matrouh_cup"] },
    { key: "mathani_groups", label: "🛡️ إدارة المجموعات", app: ["mathani_cup"] },
    // تبويب إضافة مباراة الشامل (بدلاً من الإقصائيات)
    { key: "matches", label: "⚽ إضافة مباراة", app: ["matrouh_cup", "mathani_cup"] },
    { key: "goals", label: "🥇 الهدافين", app: ["matrouh_cup", "mathani_cup"] },
    { key: "cards", label: "🟨 الكروت", app: ["matrouh_cup", "mathani_cup"] },
    { key: "motm", label: "🌟 نجوم المباريات", app: ["matrouh_cup", "mathani_cup"] },
    { key: "rosters", label: "📋 القوائم", app: ["matrouh_cup"] },
    { key: "totw", label: "🏟️ تشكيلة الجولة", app: ["matrouh_cup", "mathani_cup"] },
    { key: "fantasy", label: "🎁 فانتزي", app: ["matrouh_cup", "mathani_cup"] },
    { key: "media", label: "📰 الأخبار", app: ["matrouh_cup", "mathani_cup"] },
    { key: "notifications", label: "🔔 إشعارات", app: ["matrouh_cup", "mathani_cup"] },
    { key: "ticker", label: "✍️ شريط الأخبار", app: ["matrouh_cup", "mathani_cup"] },
  ];

  const visibleTabs = allAdminTabs.filter(tab => {
    if (!tab.app.includes(mainAppTab)) return false;
    if (mainAppTab === 'matrouh_cup') {
       if (cupEdition === 'edition_3' && tab.hideForEd3) return false;
       if (cupEdition === 'edition_4' && tab.hideForEd4) return false;
    }
    return true;
  });

  const adminRoundSections = useMemo(() => {
    const visibleMatches = matches
      .filter(m => !koSearchTerm || String(m.teamA || "").includes(koSearchTerm) || String(m.teamB || "").includes(koSearchTerm) || String(m.matchLabel || "").includes(koSearchTerm))
      .sort((a, b) => {
        const da = String(a.date || "9999-12-31");
        const db = String(b.date || "9999-12-31");
        if (da !== db) return da.localeCompare(db);
        return String(a.time || "00:00").localeCompare(String(b.time || "00:00"));
      });

    const roundOrder = mainAppTab === 'mathani_cup'
      ? [GROUP_ROUND, "دور الـ 16", "دور الثمانية", "دور الـ 4", "النهائي"]
      : Array.from(new Set(visibleMatches.map(m => String(m.round || GROUP_ROUND))));

    const grouped = visibleMatches.reduce((acc: Record<string, any[]>, match: any) => {
      const key = mainAppTab === 'mathani_cup' ? normalizeMathaniRoundName(match.round) : String(match.round || GROUP_ROUND);
      if (!acc[key]) acc[key] = [];
      acc[key].push(match);
      return acc;
    }, {});

    const ordered = [
      ...roundOrder.filter(r => grouped[r]?.length),
      ...Object.keys(grouped).filter(r => !roundOrder.includes(r)),
    ];

    return ordered.map(roundName => ({ roundName, items: grouped[roundName] }));
  }, [matches, koSearchTerm, mainAppTab]);

  const renderAdminMatchCard = (match: any) => (
    <div key={match.id} className={`rounded-2xl border overflow-hidden transition-all ${match.isLive ? 'border-red-500/60 bg-red-900/10 shadow-[0_0_20px_rgba(239,68,68,0.15)]' : match.status === 'انتهت' ? 'border-white/5 bg-[#0a1228] opacity-75' : 'border-white/8 bg-[#0f1c35]'}`}>
      <div className={`px-4 py-2 text-xs font-bold flex items-center justify-between ${match.isLive ? 'bg-red-600' : 'bg-[#060e1e]'}`}>
        <span className="text-gray-300">{getArabicDay(match.date)} • {match.date} • {match.time}</span>
        <div className="flex items-center gap-2">
          {match.isLive && <span className="animate-pulse text-white font-black">🔴 مباشر</span>}
          {match.matchLabel && <span className="text-cyan-300 font-black px-2" dir="ltr">{match.matchLabel}</span>}
          <span className="text-gray-400 font-black px-2">{match.round}</span>
          {(match.stage === "knockout" || isMathaniKnockoutRound(match.round)) && <span className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-2 py-0.5 rounded-full">إقصائي</span>}
        </div>
      </div>
      <div className="p-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-[#060e1e] rounded-xl p-4 border border-white/5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="text-center flex-1"><div className="font-black text-white text-base">{match.teamA}</div></div>
            <div className="bg-[#0f1c35] border border-yellow-400/20 rounded-xl px-5 py-2 font-black text-2xl text-yellow-400 mx-3 text-center">
              <div>{match.homeGoals || 0} - {match.awayGoals || 0}</div>
              {shouldShowPenaltyScore(match) && (() => {
                const penalties = getPenaltyScoreValues(match);
                return <div className="text-xs text-yellow-300 mt-1 font-bold">ضربات الجزاء: {penalties.home} - {penalties.away}</div>;
              })()}
            </div>
            <div className="text-center flex-1"><div className="font-black text-white text-base">{match.teamB}</div></div>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            <Btn size="sm" onClick={() => startEdit(match)} variant="blue"><Edit className="h-3 w-3" /> تعديل المباراة</Btn>
            <Btn size="sm" onClick={() => updateMatchLive(match.id, { isLive: !match.isLive })} variant={match.isLive ? "red" : "ghost"}>{match.isLive ? "⏹ إيقاف اللايف" : "▶ تشغيل اللايف"}</Btn>
            <Btn size="sm" onClick={() => updateMatchLive(match.id, { status: "انتهت", isLive: false, streamClosed: true, isTimerRunning: false })} variant="emerald">إنهاء</Btn>
            <Btn size="sm" onClick={() => openPoster(match)} variant="ghost"><Camera className="h-3 w-3" /> بوستر</Btn>
            <Btn size="sm" onClick={() => deleteMatch(match.id)} variant="danger"><Trash2 className="h-3 w-3" /> حذف</Btn>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-[#060e1e] rounded-xl p-3 border border-white/5 space-y-3">
            <div className="text-xs text-gray-400 font-bold">تعديل سريع للأهداف (مباشر)</div>
            {[{ label: match.teamA, key: 'homeGoals', val: match.homeGoals }, { label: match.teamB, key: 'awayGoals', val: match.awayGoals }].map(g => (
              <div key={g.key} className="flex items-center justify-between gap-2">
                <span className="text-xs text-gray-400 truncate flex-1">{g.label}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => updateMatchLive(match.id, { [g.key]: Math.max(0, (g.val || 0) - 1) })} className="w-7 h-7 rounded-lg bg-red-600/20 text-red-400 font-black text-lg hover:bg-red-600/40">−</button>
                  <span className="text-lg font-black text-white w-5 text-center">{g.val || 0}</span>
                  <button onClick={() => updateMatchLive(match.id, { [g.key]: (g.val || 0) + 1 })} className="w-7 h-7 rounded-lg bg-emerald-600/20 text-emerald-400 font-black text-lg hover:bg-emerald-600/40">+</button>
                </div>
              </div>
            ))}
            {(match.stage === "knockout" || isMathaniKnockoutRound(match.round)) && toScore(match.homeGoals) === toScore(match.awayGoals) && (
              <div className="border-t border-white/5 pt-3 mt-3 space-y-2">
                <div className="text-xs text-yellow-300 font-black">ضربات الجزاء</div>
                {[{ label: match.teamA, key: 'homePenaltyGoals', val: getPenaltyScoreValues(match).home }, { label: match.teamB, key: 'awayPenaltyGoals', val: getPenaltyScoreValues(match).away }].map(g => (
                  <div key={g.key} className="flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-400 truncate flex-1">{g.label}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => updateMatchLive(match.id, { [g.key]: Math.max(0, (g.val || 0) - 1) })} className="w-7 h-7 rounded-lg bg-red-600/20 text-red-400 font-black text-lg hover:bg-red-600/40">−</button>
                      <span className="text-lg font-black text-yellow-300 w-5 text-center">{g.val || 0}</span>
                      <button onClick={() => updateMatchLive(match.id, { [g.key]: (g.val || 0) + 1 })} className="w-7 h-7 rounded-lg bg-emerald-600/20 text-emerald-400 font-black text-lg hover:bg-emerald-600/40">+</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <select value={match.status} onChange={e => updateMatchLive(match.id, { status: e.target.value })} className={`${selectCls} text-xs`}>
              {["لم تبدأ", "ستبدأ بعد قليل", "الشوط الأول", "استراحة", "الشوط الثاني", "ضربات جزاء", "انتهت"].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="bg-[#060e1e] rounded-xl p-3 border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400 font-bold">العداد</span>
              <span className="bg-red-600 text-white text-xs font-black px-3 py-1 rounded-full" dir="ltr">{getAccurateLiveMinute(match)}'</span>
            </div>
            <div className="flex gap-2">
              <input type="number" value={match.liveMinute || 0} onChange={e => updateMatchLive(match.id, { liveMinute: parseInt(e.target.value) || 0, liveMinuteBase: parseInt(e.target.value) || 0, timerStartedAt: match.isTimerRunning ? Date.now() : null })} className={`${inputCls} w-20 text-center text-sm`} />
              <Btn onClick={() => updateMatchLive(match.id, { isTimerRunning: !match.isTimerRunning })} variant={match.isTimerRunning ? "red" : "emerald"} size="md" className="flex-1 text-xs">
                {match.isTimerRunning ? <><Pause className="h-3 w-3" /> إيقاف</> : <><Play className="h-3 w-3" /> تشغيل</>}
              </Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (!isAuth) return (
    <div dir="rtl" className="min-h-screen bg-[#060e1e] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-yellow-400 flex items-center justify-center mx-auto mb-4 shadow-[0_0_40px_rgba(250,204,21,0.4)]">
            <Trophy className="w-10 h-10 text-black" />
          </div>
          <h1 className="text-2xl font-black text-white">لوحة إدارة</h1>
          <p className="text-gray-500 text-sm mt-1">منصة مطروح الرياضية</p>
        </div>
        <div className="bg-[#0f1c35] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4">
          <div>
            <label className="text-xs text-gray-400 font-bold block mb-2">كلمة السر</label>
            <input type="password" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} placeholder="••••••••" className="w-full bg-[#060e1e] border border-white/10 rounded-xl px-4 py-3 text-white font-bold text-center text-xl outline-none focus:border-yellow-400/50 transition-colors tracking-widest" />
          </div>
          <Btn onClick={handleLogin} variant="primary" size="xl">دخول</Btn>
        </div>
      </div>
    </div>
  );

  return (
    <div dir="rtl" className="min-h-screen bg-[#060e1e] text-white pb-24 font-sans w-full overflow-x-hidden">
      <datalist id="teams-list">{currentTeamsList.map(t => <option key={t} value={t} />)}</datalist>

      {/* POPUP: نجم المباراة */}
      {motmPopupMatch && (
        <div className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#0f1c35] border border-yellow-400/30 rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-yellow-400/10 border-b border-yellow-400/20 px-5 py-4">
              <div className="flex items-center gap-2 text-yellow-300 font-black"><Star className="w-5 h-5" /><span>نجم المباراة</span></div>
              <p className="text-cyan-400 text-sm mt-1 font-bold">{motmPopupMatch.teamA} ضد {motmPopupMatch.teamB}</p>
            </div>
            <div className="p-5 space-y-4">
              <Field label="اسم اللاعب"><input value={quickMotmForm.player} onChange={e => setQuickMotmForm(p => ({ ...p, player: e.target.value }))} className={inputCls} placeholder="اكتب الاسم..." /></Field>
              <Field label="الفريق">
                <select value={quickMotmForm.team} onChange={e => setQuickMotmForm(p => ({ ...p, team: e.target.value }))} className={selectCls}>
                  <option value={motmPopupMatch.teamA}>{motmPopupMatch.teamA}</option>
                  <option value={motmPopupMatch.teamB}>{motmPopupMatch.teamB}</option>
                </select>
              </Field>
              <Field label="التقييم"><input type="number" value={quickMotmForm.rating} onChange={e => setQuickMotmForm(p => ({ ...p, rating: Number(e.target.value) }))} className={`${inputCls} text-center`} /></Field>
              <div className="flex gap-3 pt-2">
                <Btn onClick={saveQuickMotm} variant="primary" size="md" className="flex-1">حفظ ✔️</Btn>
                <Btn onClick={() => setMotmPopupMatch(null)} variant="danger" size="md" className="flex-1">إلغاء</Btn>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* POPUP: البوستر */}
      {posterMatch && (
        <div className="fixed inset-0 bg-black/95 z-[9998] flex flex-col items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-full overflow-x-auto flex justify-center items-center pb-4">
            <div id="poster-canvas-node" className="relative w-[400px] h-[711px] shrink-0 bg-gradient-to-b from-[#050a14] via-[#13213a] to-[#050a14] flex flex-col items-center overflow-hidden border border-yellow-400/20" dir="rtl">
              <div className="absolute inset-0 opacity-10 bg-[url('/pattern.png')] bg-repeat"></div>
              <div className="mt-8 z-10 flex flex-col items-center">
                <img src="/logo.png" className="w-48 h-auto object-contain drop-shadow-[0_0_15px_rgba(250,204,21,0.5)] mb-2" alt="مطروح الرياضية" />
                <h1 className="text-3xl font-black text-yellow-400 mt-2 tracking-wide">{mainAppTab === 'mathani_cup' ? 'بطولة المثاني' : 'كأس مطروح'}</h1>
                <p className="text-cyan-300 font-bold text-sm tracking-widest">{mainAppTab === 'mathani_cup' ? '2026' : 'النسخة الثالثة 2026'}</p>
                <Badge className="mt-4 bg-yellow-400 text-black font-black px-6 py-1.5 text-sm">{posterMatch.round}</Badge>
              </div>
              <div className="w-full mt-12 flex justify-between items-center px-6 z-10">
                <div className="flex flex-col items-center gap-3 w-1/3">
                  <div className="w-24 h-24 rounded-full bg-[#0a1428] border-2 border-cyan-500/50 flex items-center justify-center shadow-lg overflow-hidden p-2">
                    {posterLogos.a || posterMatch.teamALogo ? <img src={posterLogos.a || posterMatch.teamALogo} className="w-full h-full object-contain" /> : <Shield className="w-12 h-12 text-gray-500" />}
                  </div>
                  <div className="text-center font-black text-white text-lg">{posterMatch.teamA}</div>
                </div>
                <div className="flex flex-col items-center justify-center w-1/3">
                  <div className="text-5xl font-black text-white tracking-tighter" dir="ltr">{posterMatch.homeGoals} - {posterMatch.awayGoals}</div>
                  <div className="text-cyan-400 font-bold mt-2 text-sm bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/30">نتيجة نهائية</div>
                </div>
                <div className="flex flex-col items-center gap-3 w-1/3">
                  <div className="w-24 h-24 rounded-full bg-[#0a1428] border-2 border-yellow-400/50 flex items-center justify-center shadow-lg overflow-hidden p-2">
                    {posterLogos.b || posterMatch.teamBLogo ? <img src={posterLogos.b || posterMatch.teamBLogo} className="w-full h-full object-contain" /> : <Shield className="w-12 h-12 text-gray-500" />}
                  </div>
                  <div className="text-center font-black text-white text-lg">{posterMatch.teamB}</div>
                </div>
              </div>
              {posterMatch.status === "ضربات جزاء" && (
                <div className="mt-6 bg-[#0a1428] border border-yellow-400/30 px-6 py-2 rounded-2xl z-10 text-center">
                  <span className="text-yellow-400 font-bold text-sm">ضربات الترجيح</span>
                  <div className="text-white font-black text-xl mt-1" dir="ltr">({(posterMatch.penaltiesHome || []).filter((p: any) => p === 'scored').length} - {(posterMatch.penaltiesAway || []).filter((p: any) => p === 'scored').length})</div>
                </div>
              )}
              <div className="absolute bottom-0 w-full flex flex-col items-center z-10 pb-6">
                <div className="bg-[#1e2a4a] text-cyan-300 w-full text-center py-2 font-bold border-y border-white/5 text-sm mb-4">{getArabicDay(posterMatch.date)} • {posterMatch.date}</div>
                <div className="flex items-center gap-4 text-white/50 text-xs font-bold"><Star className="w-4 h-4 text-yellow-400/50" /><span>إدارة المنصة: فتحي هيرو 🦅</span><Star className="w-4 h-4 text-yellow-400/50" /></div>
              </div>
            </div>
          </div>
          <div className="flex gap-3 mt-6 w-full max-w-xs">
            <Btn onClick={downloadPoster} disabled={isGeneratingPoster || isPreparingPoster} variant="primary" size="lg">
              {isGeneratingPoster || isPreparingPoster ? <Loader2 className="animate-spin h-5 w-5" /> : <Camera className="h-5 w-5" />} تحميل
            </Btn>
            <Btn onClick={() => setPosterMatch(null)} variant="danger" size="lg">إغلاق</Btn>
          </div>
        </div>
      )}

      {/* الهيدر العلوي */}
      <header className="sticky top-0 z-50 bg-[#060e1e]/95 backdrop-blur border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-400 flex items-center justify-center shadow-[0_0_20px_rgba(250,204,21,0.3)]">
              <Trophy className="w-5 h-5 text-black" />
            </div>
            <div>
              <div className="font-black text-white text-base leading-none">مطروح الرياضية</div>
              <div className="text-gray-500 text-xs mt-0.5">لوحة الإدارة</div>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1 bg-[#0f1c35] border border-white/8 rounded-xl p-1">
            {[
              { key: 'matrouh_cup', label: '🏆 كأس مطروح', active: 'bg-yellow-400 text-black' },
              { key: 'elite_cup', label: '🏅 النخبة', active: 'bg-indigo-600 text-white' },
              { key: 'mathani_cup', label: '⚽ بطولة المثاني', active: 'bg-emerald-500 text-white' },
              { key: 'shop', label: '🛒 المتجر', active: 'bg-orange-500 text-white' },
            ].map(tab => (
              <button key={tab.key} onClick={() => { setMainAppTab(tab.key as any); setActiveTab(tab.key === 'mathani_cup' ? 'mathani_groups' : 'champion'); }}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${mainAppTab === tab.key ? tab.active + " shadow-md" : "text-gray-400 hover:text-white"}`}>
                {tab.label}
              </button>
            ))}
          </div>
          <Btn onClick={() => { setIsAuth(false); setPasswordInput(""); }} variant="danger" size="sm"><LogOut className="h-4 w-4" /> خروج</Btn>
        </div>
        <div className="sm:hidden flex items-center gap-1 bg-[#0f1c35] border-t border-white/5 px-3 py-2 overflow-x-auto">
          {[
            { key: 'matrouh_cup', label: '🏆 كأس مطروح', active: 'bg-yellow-400 text-black' },
            { key: 'elite_cup', label: '🏅 النخبة', active: 'bg-indigo-600 text-white' },
            { key: 'mathani_cup', label: '⚽ بطولة المثاني', active: 'bg-emerald-500 text-white' },
            { key: 'shop', label: '🛒 المتجر', active: 'bg-orange-500 text-white' },
          ].map(tab => (
            <button key={tab.key} onClick={() => { setMainAppTab(tab.key as any); setActiveTab(tab.key === 'mathani_cup' ? 'mathani_groups' : 'champion'); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${mainAppTab === tab.key ? tab.active : "text-gray-400"}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 pt-6 w-full">

        {/* المتجر */}
        {mainAppTab === 'shop' && (
          <SectionCard title="طلبات المتجر" icon="🛒" color="orange">
            <div className="overflow-x-auto rounded-xl border border-white/5">
              <table className="w-full text-right text-white text-sm min-w-[900px]">
                <thead className="bg-[#060e1e]">
                  <tr>{["الطلب", "العميل", "المنتجات", "الإجمالي", "الدفع", "الإيصال", "الحالة"].map(h => <th key={h} className="px-4 py-3 text-gray-400 font-bold border-b border-white/5">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {ordersList.map(order => (
                    <tr key={order.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                      <td className="px-4 py-3"><span className="bg-[#0f1c35] border border-white/10 px-2 py-1 rounded-lg text-xs font-black text-gray-300">{order.id.slice(-6).toUpperCase()}</span><div className="text-xs text-gray-500 mt-1">{new Date(order.createdAt).toLocaleDateString('ar-EG')}</div></td>
                      <td className="px-4 py-3 font-bold">{order.customer?.name}<br /><span className="text-cyan-400 text-xs" dir="ltr">{order.customer?.phone}</span></td>
                      <td className="px-4 py-3 text-sm text-gray-300">{order.items?.map((item: any, i: number) => <div key={i}>{item.title} (x{item.qty})</div>)}</td>
                      <td className="px-4 py-3 font-black text-yellow-400">{Number(order.total || 0).toLocaleString("ar-EG")} ج.م</td>
                      <td className="px-4 py-3"><span className="bg-[#0f1c35] border border-white/10 px-2 py-1 rounded-lg text-xs">{order.paymentMethod === "cash" ? "الدفع عند الاستلام" : order.paymentMethod}</span></td>
                      <td className="px-4 py-3">{order.customer?.receiptImage ? <a href={order.customer.receiptImage} target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline text-xs">عرض</a> : "—"}</td>
                      <td className="px-4 py-3">
                        <select value={order.status} onChange={async (e) => await updateDoc(doc(db, "orders", order.id), { status: e.target.value })} className="bg-[#0a1428] border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs font-bold outline-none cursor-pointer">
                          {["طلب جديد", "قيد التأكيد", "قيد التجهيز", "تم الشحن", "تم التسليم", "ملغي"].map(s => <option key={s}>{s}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        )}

        {/* النخبة */}
        {mainAppTab === 'elite_cup' && (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              {[
                { key: "reg_settings", label: "⚙️ إعدادات التسجيل" },
                { key: "teams", label: "🛡️ إدارة الفرق" },
                { key: "matches", label: "⚽ المباريات" },
                { key: "stats", label: "📈 الإحصائيات" },
              ].map(tab => (
                <button key={tab.key} onClick={() => setEliteActiveTab(tab.key)}
                  className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${eliteActiveTab === tab.key ? "bg-indigo-600 text-white shadow-lg" : "bg-[#0f1c35] border border-white/10 text-gray-400 hover:text-white"}`}>
                  {tab.label}
                </button>
              ))}
            </div>

            {eliteActiveTab === "reg_settings" && (
              <div className="space-y-6">
                <SectionCard title="إعدادات التسجيل للنخبة" icon="⚙️" color="indigo">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Field label="تاريخ إغلاق التسجيل"><input type="date" value={regDeadlineElite} onChange={e => setRegDeadlineElite(e.target.value)} className={inputCls} /></Field>
                    <Field label="باسورد التسجيل"><input type="text" value={regPasswordElite} onChange={e => setRegPasswordElite(e.target.value)} className={inputCls} /></Field>
                    <Field label="رسوم الاشتراك (ج.م)"><input type="number" value={regPriceElite} onChange={e => setRegPriceElite(Number(e.target.value))} className={`${inputCls} text-green-400 font-black`} /></Field>
                    <div className="md:col-span-3"><Btn onClick={saveRegistrationSettingsElite} variant="indigo" size="xl">حفظ إعدادات النخبة 💾</Btn></div>
                  </div>
                </SectionCard>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <SectionCard title="قائمة الحظر" icon="🚫" color="red">
                    <div className="flex gap-2 mb-4">
                      <select value={bannedForm.type} onChange={e => setBannedForm({ ...bannedForm, type: e.target.value })} className={`${selectCls} w-28`}>
                        <option value="player">لاعب</option><option value="team">فريق</option>
                      </select>
                      <input value={bannedForm.name} onChange={e => setBannedForm({ ...bannedForm, name: e.target.value })} placeholder="الاسم..." className={`${inputCls} flex-1`} />
                      <Btn onClick={addBannedEntity} variant="red" size="md">حظر</Btn>
                    </div>
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {bannedList.map(b => (
                        <div key={b.id} className="flex items-center justify-between bg-[#060e1e] px-3 py-2 rounded-xl border border-white/5">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-lg font-bold ${b.type === 'team' ? 'bg-purple-900/60 text-purple-300' : 'bg-orange-900/60 text-orange-300'}`}>{b.type === 'team' ? 'فريق' : 'لاعب'}</span>
                            <span className="font-bold text-sm">{b.name}</span>
                          </div>
                          <Btn onClick={() => removeBannedEntity(b.id)} variant="danger" size="sm"><Trash2 className="w-3 h-3" /></Btn>
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                  <SectionCard title="قائمة التقييد" icon="⚠️" color="yellow">
                    <div className="flex gap-2 mb-4">
                      <input value={restrictedForm.name} onChange={e => setRestrictedForm({ name: e.target.value })} placeholder="اسم اللاعب..." className={`${inputCls} flex-1`} />
                      <Btn onClick={addRestrictedPlayer} variant="primary" size="md">تقييد</Btn>
                    </div>
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {restrictedPlayers.map(r => (
                        <div key={r.id} className="flex items-center justify-between bg-[#060e1e] px-3 py-2 rounded-xl border border-white/5">
                          <div className="flex items-center gap-2"><UserX className="w-4 h-4 text-yellow-400" /><span className="font-bold text-sm">{r.name}</span></div>
                          <Btn onClick={() => removeRestrictedPlayer(r.id)} variant="danger" size="sm"><Trash2 className="w-3 h-3" /></Btn>
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                </div>
              </div>
            )}

            {eliteActiveTab === "teams" && (
              <SectionCard title="إضافة فريق جديد للنخبة" icon="🛡️" color="indigo">
                <div className="flex flex-col sm:flex-row gap-3 mb-6">
                  <input value={eliteTeamForm.name} onChange={e => setEliteTeamForm({ ...eliteTeamForm, name: e.target.value })} placeholder="اسم الفريق" className={`${inputCls} flex-1`} />
                  <input value={eliteTeamForm.logoUrl} onChange={e => setEliteTeamForm({ ...eliteTeamForm, logoUrl: e.target.value })} placeholder="رابط الشعار (اختياري)" className={`${inputCls} flex-1`} dir="ltr" />
                  <Btn onClick={addEliteTeam} variant="indigo" size="md" className="whitespace-nowrap">إضافة ➕</Btn>
                </div>
                <div className="overflow-x-auto rounded-xl border border-white/5">
                  <table className="w-full text-right text-white text-sm">
                    <thead className="bg-[#060e1e]"><tr><th className="px-4 py-3 text-gray-400">الفريق</th><th className="px-4 py-3 text-gray-400 text-center">حذف</th></tr></thead>
                    <tbody>
                      {eliteTeams.map(t => (
                        <tr key={t.id} className="border-t border-white/5 hover:bg-white/3">
                          <td className="px-4 py-3 flex items-center gap-3 font-bold">
                            {t.logoUrl ? <img src={t.logoUrl} className="w-10 h-10 object-contain rounded-full bg-[#060e1e] border border-white/10 p-1" /> : <Shield className="w-8 h-8 text-gray-600" />}
                            {t.name}
                          </td>
                          <td className="px-4 py-3 text-center"><Btn onClick={() => deleteEliteTeam(t.id)} variant="danger" size="sm"><Trash2 className="w-4 h-4" /></Btn></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            )}

            {['matches', 'stats'].includes(eliteActiveTab) && (
              <div className="text-center py-20 bg-[#0f1c35] border border-white/5 rounded-2xl">
                <Activity className="w-16 h-16 mx-auto text-indigo-400 mb-4 animate-pulse" />
                <h3 className="text-xl font-black text-white mb-2">قيد التطوير ⚙️</h3>
                <p className="text-gray-500 text-sm">سيتم تفعيل هذا النظام قريباً</p>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════
            قسم: كأس مطروح وبطولة المثاني
        ══════════════════════════════════════ */}
        {(mainAppTab === 'matrouh_cup' || mainAppTab === 'mathani_cup') && (
          <div className="space-y-5">
            {/* محدد النسخة والفئة لمطروح فقط */}
            {mainAppTab === 'matrouh_cup' && (
              <div className="flex flex-col sm:flex-row gap-3">
                <TogglePill options={[{ value: 'edition_3', label: 'النسخة الثالثة' }, { value: 'edition_4', label: 'النسخة الرابعة' }]} value={cupEdition} onChange={setCupEdition} activeColor="bg-cyan-600 text-white" />
                <TogglePill options={[{ value: 'youth', label: '⚽ شباب' }, { value: 'juniors', label: '🌱 ناشئين' }]} value={activeTournament} onChange={(v: any) => { setActiveTournament(v); setActiveTab(cupEdition === 'edition_3' ? 'champion' : 'registration_settings'); }} />
              </div>
            )}

            {mainAppTab === 'matrouh_cup' && cupEdition === 'edition_3' && (
              <div className="flex items-center gap-3 bg-yellow-400/8 border border-yellow-400/20 text-yellow-300 px-4 py-3 rounded-xl text-sm font-bold">
                <Archive className="w-5 h-5 shrink-0" /><span>هذه النسخة مؤرشفة — جميع الإعدادات نهائية</span>
              </div>
            )}

            {mainAppTab === 'mathani_cup' && (
              <div className="flex items-center justify-center gap-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-4 rounded-2xl shadow-lg">
                <Trophy className="w-8 h-8 shrink-0" />
                <div className="text-center">
                   <h2 className="text-2xl font-black">بطولة المثاني 2026</h2>
                   <p className="text-xs text-emerald-200 mt-1">إدارة كاملة للفرق، المجموعات، النتائج، والإحصائيات الخاصة بالمثاني</p>
                </div>
              </div>
            )}

            {/* شريط التبويبات المدمج */}
            <div className="overflow-x-auto pb-1">
              <div className="flex gap-1.5 min-w-max bg-[#0f1c35] border border-white/8 p-1.5 rounded-2xl">
                {visibleTabs.map(tab => (
                  <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${activeTab === tab.key ? (mainAppTab === 'mathani_cup' ? "bg-emerald-500 text-white shadow-md" : "bg-yellow-400 text-black shadow-md") : "text-gray-400 hover:text-white hover:bg-white/5"}`}>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ─── البطل (مطروح فقط) ─── */}
            {activeTab === "champion" && mainAppTab === 'matrouh_cup' && cupEdition === 'edition_3' && (
              <SectionCard title="البطل المتوج" icon="👑" color="yellow">
                <div className="text-center py-8">
                  <div className="w-32 h-32 mx-auto bg-[#060e1e] rounded-full border-4 border-yellow-400 flex items-center justify-center shadow-[0_0_30px_rgba(250,204,21,0.2)] mb-6"><Trophy className="w-16 h-16 text-yellow-400" /></div>
                  <h2 className="text-4xl font-black text-white">{activeTournament === 'youth' ? 'وادي ماجد' : 'وادي الرمل'}</h2>
                  <span className="mt-3 inline-block bg-yellow-400 text-black px-6 py-2 rounded-full font-black">بطل النسخة الثالثة</span>
                </div>
              </SectionCard>
            )}

            {/* ─── تشكيل البطولة (مطروح فقط) ─── */}
            {activeTab === "tournament_lineup_admin" && mainAppTab === 'matrouh_cup' && (
              <SectionCard title="تشكيل البطولة الرسمي" icon="📋" color="yellow">
                <div className="space-y-6">
                  <div className="bg-[#060e1e] rounded-xl border border-white/5 p-4 space-y-3">
                    <h3 className="text-yellow-400 font-black text-sm border-b border-white/5 pb-2">👔 المدير الفني</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Field label="اسم الكابتن"><input value={adminLineup.manager?.name || ""} onChange={e => setAdminLineup({ ...adminLineup, manager: { ...adminLineup.manager, name: e.target.value } })} className={inputCls} /></Field>
                      <Field label="الفريق"><input value={adminLineup.manager?.team || ""} onChange={e => setAdminLineup({ ...adminLineup, manager: { ...adminLineup.manager, team: e.target.value } })} className={inputCls} /></Field>
                      <Field label="رابط الصورة"><input value={adminLineup.manager?.image || ""} onChange={e => setAdminLineup({ ...adminLineup, manager: { ...adminLineup.manager, image: e.target.value, imageUrl: e.target.value } })} className={inputCls} dir="ltr" /></Field>
                    </div>
                  </div>
                  <div className="bg-[#060e1e] rounded-xl border border-white/5 p-4 space-y-3">
                    <h3 className="text-cyan-400 font-black text-sm border-b border-white/5 pb-2">⚽ الأساسيون (7 لاعبين)</h3>
                    {adminLineup.starters?.map((player: any, idx: number) => (
                      <div key={player.id || idx} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center bg-[#0f1c35] px-3 py-2 rounded-xl border border-white/5">
                        <span className="bg-yellow-400 text-black text-xs font-black px-3 py-1.5 rounded-lg text-center">{player.role} ({player.posText})</span>
                        <input value={player.name || ""} onChange={e => { const s = [...adminLineup.starters]; s[idx] = { ...s[idx], name: e.target.value, fallback: e.target.value.substring(0, 2) }; setAdminLineup({ ...adminLineup, starters: s }); }} placeholder="اسم اللاعب" className={inputCls} />
                        <input value={player.team || ""} onChange={e => { const s = [...adminLineup.starters]; s[idx] = { ...s[idx], team: e.target.value }; setAdminLineup({ ...adminLineup, starters: s }); }} placeholder="الفريق" className={inputCls} />
                        <input value={player.image || player.imageUrl || ""} onChange={e => { const s = [...adminLineup.starters]; s[idx] = { ...s[idx], image: e.target.value, imageUrl: e.target.value }; setAdminLineup({ ...adminLineup, starters: s }); }} placeholder="رابط الصورة" className={inputCls} dir="ltr" />
                      </div>
                    ))}
                  </div>
                  <div className="bg-[#060e1e] rounded-xl border border-white/5 p-4 space-y-3">
                    <h3 className="text-emerald-400 font-black text-sm border-b border-white/5 pb-2">👥 الاحتياطيون (5 لاعبين)</h3>
                    {adminLineup.subs?.map((player: any, idx: number) => (
                      <div key={idx} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center bg-[#0f1c35] px-3 py-2 rounded-xl border border-white/5">
                        <span className="bg-emerald-600 text-white text-xs font-black px-3 py-1.5 rounded-lg text-center">البديل {idx + 1}</span>
                        <input value={player.name || ""} onChange={e => { const s = [...adminLineup.subs]; s[idx] = { ...s[idx], name: e.target.value, fallback: e.target.value.substring(0, 2) }; setAdminLineup({ ...adminLineup, subs: s }); }} placeholder="اسم البديل" className={inputCls} />
                        <input value={player.team || ""} onChange={e => { const s = [...adminLineup.subs]; s[idx] = { ...s[idx], team: e.target.value }; setAdminLineup({ ...adminLineup, subs: s }); }} placeholder="الفريق" className={inputCls} />
                        <input value={player.role || ""} onChange={e => { const s = [...adminLineup.subs]; s[idx] = { ...s[idx], role: e.target.value }; setAdminLineup({ ...adminLineup, subs: s }); }} placeholder="المركز" className={inputCls} />
                      </div>
                    ))}
                  </div>
                  <Btn onClick={async () => { try { await setDoc(doc(db, getColl("tournament_lineup"), "current"), adminLineup); alert("✅ تم نشر تشكيل البطولة!"); } catch (e) { alert("❌ خطأ في الاتصال."); } }} variant="primary" size="xl">حفظ ونشر التشكيل الرسمي 💾</Btn>
                </div>
              </SectionCard>
            )}

            {/* ─── إعدادات التسجيل (مطروح فقط) ─── */}
            {activeTab === "registration_settings" && mainAppTab === 'matrouh_cup' && cupEdition === 'edition_4' && (
              <div className="space-y-6">
                <SectionCard title="إعدادات التسجيل والاشتراكات (كأس مطروح)" icon="⚙️" color="red">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Field label="تاريخ إغلاق التسجيل"><input type="date" value={regDeadlineMatrouh} onChange={e => setRegDeadlineMatrouh(e.target.value)} className={inputCls} /></Field>
                    <Field label="باسورد التسجيل"><input type="text" value={regPasswordMatrouh} onChange={e => setRegPasswordMatrouh(e.target.value)} placeholder="مثال: Matrouh2026" className={inputCls} /></Field>
                    <Field label="رسوم الاشتراك (ج.م)"><input type="number" value={regPriceMatrouh} onChange={e => setRegPriceMatrouh(Number(e.target.value))} className={`${inputCls} text-green-400 font-black`} /></Field>
                    <div className="md:col-span-3"><Btn onClick={saveRegistrationSettingsMatrouh} variant="red" size="xl">حفظ إعدادات التسجيل 💾</Btn></div>
                  </div>
                </SectionCard>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <SectionCard title="قائمة الحظر" icon="🚫" color="red">
                    <div className="flex gap-2 mb-4">
                      <select value={bannedForm.type} onChange={e => setBannedForm({ ...bannedForm, type: e.target.value })} className={`${selectCls} w-28`}>
                        <option value="player">لاعب</option><option value="team">فريق</option>
                      </select>
                      <input value={bannedForm.name} onChange={e => setBannedForm({ ...bannedForm, name: e.target.value })} placeholder="الاسم..." className={`${inputCls} flex-1`} />
                      <Btn onClick={addBannedEntity} variant="red" size="md">حظر</Btn>
                    </div>
                    <div className="space-y-2 max-h-52 overflow-y-auto">
                      {bannedList.map(b => (
                        <div key={b.id} className="flex items-center justify-between bg-[#060e1e] px-3 py-2 rounded-xl border border-white/5">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-lg font-bold ${b.type === 'team' ? 'bg-purple-900/60 text-purple-300' : 'bg-orange-900/60 text-orange-300'}`}>{b.type === 'team' ? 'فريق' : 'لاعب'}</span>
                            <span className="font-bold text-sm">{b.name}</span>
                          </div>
                          <Btn onClick={() => removeBannedEntity(b.id)} variant="danger" size="sm"><Trash2 className="w-3 h-3" /></Btn>
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                  <SectionCard title="قائمة التقييد" icon="⚠️" color="yellow">
                    <div className="flex gap-2 mb-4">
                      <input value={restrictedForm.name} onChange={e => setRestrictedForm({ name: e.target.value })} placeholder="اسم اللاعب..." className={`${inputCls} flex-1`} />
                      <Btn onClick={addRestrictedPlayer} variant="primary" size="md">تقييد</Btn>
                    </div>
                    <div className="space-y-2 max-h-52 overflow-y-auto">
                      {restrictedPlayers.map(r => (
                        <div key={r.id} className="flex items-center justify-between bg-[#060e1e] px-3 py-2 rounded-xl border border-white/5">
                          <div className="flex items-center gap-2"><UserX className="w-4 h-4 text-yellow-400" /><span className="font-bold text-sm">{r.name}</span></div>
                          <Btn onClick={() => removeRestrictedPlayer(r.id)} variant="danger" size="sm"><Trash2 className="w-3 h-3" /></Btn>
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                </div>
              </div>
            )}

            {/* ─── إدارة مجموعات المثاني ─── */}
            {activeTab === "mathani_groups" && mainAppTab === 'mathani_cup' && (
              <SectionCard title="إدارة المجموعات (8 مجموعات)" icon="🛡️" color="emerald" action={
                 <Btn onClick={saveMathaniGroups} variant="emerald" size="sm">حفظ التغييرات 💾</Btn>
              }>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {mathaniGroups.map((group, gIdx) => (
                       <div key={gIdx} className="bg-[#060e1e] p-4 rounded-xl border border-emerald-500/20 shadow-md space-y-3">
                          <h3 className="text-emerald-400 font-black text-center border-b border-white/5 pb-2">المجموعة {gIdx + 1}</h3>
                          {[0, 1, 2, 3].map(tIdx => (
                             <input
                                key={tIdx}
                                value={group[tIdx] || ""}
                                onChange={e => {
                                   const newGroups = [...mathaniGroups];
                                   const currentGroup = newGroups[gIdx] ? [...newGroups[gIdx]] : ["", "", "", ""];
                                   currentGroup[tIdx] = e.target.value;
                                   newGroups[gIdx] = currentGroup;
                                   setMathaniGroups(newGroups);
                                }}
                                placeholder={`الفريق ${tIdx + 1}`}
                                className={inputCls}
                             />
                          ))}
                       </div>
                    ))}
                 </div>
                 <div className="mt-6">
                    <Btn onClick={saveMathaniGroups} variant="emerald" size="xl">حفظ واعتماد المجموعات 💾</Btn>
                 </div>
              </SectionCard>
            )}

            {/* ─── إضافة مباراة واللايف والتعديل ─── */}
            {activeTab === "matches" && (
              <div className="space-y-6">
                <SectionCard title={editingId ? "تعديل بيانات ونتيجة المباراة" : "إنشاء مباراة جديدة"} icon="⚽" color={mainAppTab === 'mathani_cup' ? 'emerald' : 'yellow'}>
                  <div className="space-y-4">
                    
                    {/* قسم النتيجة والفرق */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 bg-[#0a1428] p-4 rounded-xl border border-white/5 shadow-inner">
                      <Field label="صاحب الأرض (الفريق الأول)">
                         <input list="teams-list" value={matchForm.teamA} onChange={e => setMatchForm({ ...matchForm, teamA: e.target.value })} className={inputCls} placeholder="اختر الفريق..." />
                      </Field>
                      <Field label="أهداف الفريق الأول">
                         <input type="number" value={matchForm.homeGoals} onChange={e => setMatchForm({ ...matchForm, homeGoals: Number(e.target.value) })} className={`${inputCls} text-center font-black text-2xl text-yellow-400`} />
                      </Field>
                      <Field label="أهداف الفريق الثاني">
                         <input type="number" value={matchForm.awayGoals} onChange={e => setMatchForm({ ...matchForm, awayGoals: Number(e.target.value) })} className={`${inputCls} text-center font-black text-2xl text-yellow-400`} />
                      </Field>
                      <Field label="الضيف (الفريق الثاني)">
                         <input list="teams-list" value={matchForm.teamB} onChange={e => setMatchForm({ ...matchForm, teamB: e.target.value })} className={inputCls} placeholder="اختر الفريق..." />
                      </Field>
                    </div>

                    {mainAppTab === 'mathani_cup' && getMathaniStage(matchForm.round) === "knockout" && toScore(matchForm.homeGoals) === toScore(matchForm.awayGoals) && (
                      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                        <div className="text-yellow-300 font-black text-sm mb-3">ضربات الجزاء عند التعادل</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <Field label={`ضربات جزاء ${matchForm.teamA || "الفريق الأول"}`}>
                            <input type="number" min="0" value={(matchForm as any).homePenaltyGoals ?? 0} onChange={e => setMatchForm({ ...matchForm, homePenaltyGoals: Number(e.target.value) } as any)} className={`${inputCls} text-center font-black text-xl text-yellow-400`} />
                          </Field>
                          <Field label={`ضربات جزاء ${matchForm.teamB || "الفريق الثاني"}`}>
                            <input type="number" min="0" value={(matchForm as any).awayPenaltyGoals ?? 0} onChange={e => setMatchForm({ ...matchForm, awayPenaltyGoals: Number(e.target.value) } as any)} className={`${inputCls} text-center font-black text-xl text-yellow-400`} />
                          </Field>
                        </div>
                        <div className="text-xs text-gray-400 mt-2">لو المباراة متعادلة، نتيجة ضربات الجزاء هي التي تحدد الفريق الصاعد وتظهر أسفل النتيجة في الصفحة الرئيسية.</div>
                      </div>
                    )}

                    {/* قسم الشعارات (اختياري) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field label="رابط شعار الفريق الأول (اختياري)"><input value={matchForm.teamALogo} onChange={e => setMatchForm({ ...matchForm, teamALogo: e.target.value })} className={inputCls} dir="ltr" placeholder="https://..." /></Field>
                      <Field label="رابط شعار الفريق الثاني (اختياري)"><input value={matchForm.teamBLogo} onChange={e => setMatchForm({ ...matchForm, teamBLogo: e.target.value })} className={inputCls} dir="ltr" placeholder="https://..." /></Field>
                    </div>

                    {/* قسم التوقيت والدور */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <Field label="التاريخ"><input type="date" value={matchForm.date} onChange={e => setMatchForm({ ...matchForm, date: e.target.value })} className={inputCls} /></Field>
                      <Field label="الوقت"><input type="time" value={matchForm.time} onChange={e => setMatchForm({ ...matchForm, time: e.target.value })} className={`${inputCls} text-center`} /></Field>
                      
                      {/* كنترول شامل لكل الأدوار الممكنة */}
                      <Field label="الدور / الجولة">
                         <select
                           value={matchForm.round}
                           onChange={e => {
                             const round = e.target.value;
                             setMatchForm({ ...matchForm, round, stage: getMathaniStage(round) });
                           }}
                           className={selectCls}
                         >
                            <option value="دور المجموعات">دور المجموعات</option>
                            <option value="دور الـ 16">دور الـ 16</option>
                            <option value="دور الثمانية">دور الثمانية</option>
                            <option value="دور الـ 4">دور الـ 4</option>
                            <option value="النهائي">النهائي</option>
                         </select>
                      </Field>

                      <Field label="حالة المباراة">
                        <select value={matchForm.status} onChange={e => setMatchForm({ ...matchForm, status: e.target.value })} className={selectCls}>
                          <option value="انتهت">انتهت</option>
                          <option value="لم تبدأ">لم تبدأ (مستقبلية)</option>
                          <option value="مباشر">مباشر (لايف)</option>
                          <option value="ضربات جزاء">ضربات جزاء</option>
                          <option value="تأجلت">تأجلت</option>
                          <option value="ملغاة">ملغاة</option>
                        </select>
                      </Field>
                    </div>

                    {mainAppTab === "mathani_cup" && (
                      <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-4 space-y-4">
                        <div>
                          <div className="text-emerald-300 font-black text-sm">نظام الإقصائيات التلقائي</div>
                          <div className="text-gray-400 text-xs mt-1">أضف مباريات دور الـ16 فقط بأكواد R16-1 إلى R16-8. بعد انتهاء كل مباراتين مرتبطتين، سيتم إنشاء مباراة الدور التالي تلقائيًا.</div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <Field label="كود المباراة الحالية">
                            <select
                              value={matchForm.matchLabel}
                              onChange={e => setMatchForm({ ...matchForm, matchLabel: e.target.value })}
                              className={selectCls}
                              dir="ltr"
                            >
                              <option value="">بدون كود</option>
                              <option value="R16-1">R16-1</option>
                              <option value="R16-2">R16-2</option>
                              <option value="R16-3">R16-3</option>
                              <option value="R16-4">R16-4</option>
                              <option value="R16-5">R16-5</option>
                              <option value="R16-6">R16-6</option>
                              <option value="R16-7">R16-7</option>
                              <option value="R16-8">R16-8</option>
                              <option value="QF-1">QF-1</option>
                              <option value="QF-2">QF-2</option>
                              <option value="QF-3">QF-3</option>
                              <option value="QF-4">QF-4</option>
                              <option value="SF-1">SF-1</option>
                              <option value="SF-2">SF-2</option>
                              <option value="FINAL-1">FINAL-1</option>
                            </select>
                          </Field>

                          <Field label="الفريق الصاعد عند التعادل/الترجيح">
                            <select
                              value={matchForm.qualifiedTeam}
                              onChange={e => setMatchForm({ ...matchForm, qualifiedTeam: e.target.value })}
                              className={selectCls}
                            >
                              <option value="">يتحدد من النتيجة</option>
                              {matchForm.teamA && <option value={matchForm.teamA}>{matchForm.teamA}</option>}
                              {matchForm.teamB && <option value={matchForm.teamB}>{matchForm.teamB}</option>}
                            </select>
                          </Field>

                          <div className="bg-[#061426] border border-white/10 rounded-xl p-3 text-xs text-gray-300 leading-6">
                            <div className="text-white font-black mb-1">المسار الثابت:</div>
                            <div dir="ltr">R16-1 + R16-2 → QF-1</div>
                            <div dir="ltr">R16-3 + R16-4 → QF-2</div>
                            <div dir="ltr">QF-1 + QF-2 → SF-1</div>
                            <div dir="ltr">SF-1 + SF-2 → FINAL-1</div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3 pt-4">
                      <Btn onClick={saveMatch} variant={mainAppTab === 'mathani_cup' ? "emerald" : "primary"} size="lg" className="flex-1">
                        {editingId ? "تأكيد وتحديث المباراة ✔️" : "حفظ وإضافة المباراة 💾"}
                      </Btn>
                      {editingId && (
                        <Btn onClick={() => {
                          setEditingId(null);
                          setMatchForm(createEmptyMatchForm());
                        }} variant="danger" size="lg">إلغاء التعديل ❌</Btn>
                      )}
                    </div>
                  </div>
                </SectionCard>

                {/* قائمة المباريات المضافة سابقاً مع إمكانية التعديل السريع والحذف */}
                <div className="space-y-4">
                  <div className="relative max-w-sm">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                    <input value={koSearchTerm} onChange={e => setKoSearchTerm(e.target.value)} placeholder="بحث في المباريات (بالاسم)..." className={`${inputCls} pr-10`} />
                  </div>
                  {adminRoundSections.length === 0 ? (
                    <div className="text-center text-gray-400 font-bold py-10 bg-[#0a1228] rounded-2xl border border-white/5">لا توجد مباريات مطابقة للبحث.</div>
                  ) : (
                    <div className="space-y-8">
                      {adminRoundSections.map(section => (
                        <div key={section.roundName} className="space-y-3">
                          <div className="sticky top-0 z-10 bg-[#061426]/95 backdrop-blur border border-emerald-500/25 rounded-2xl px-4 py-3 flex items-center justify-between shadow-lg">
                            <div className="text-emerald-300 font-black text-lg">{section.roundName}</div>
                            <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-black">{section.items.length} مباراة</Badge>
                          </div>
                          {section.items.map(match => renderAdminMatchCard(match))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ─── القوائم ─── */}
            {activeTab === "rosters" && mainAppTab === 'matrouh_cup' && (
              <SectionCard title="إدارة قوائم الفرق" icon="📋" color="blue">
                <div className="overflow-x-auto rounded-xl border border-white/5 mb-6">
                  <table className="w-full text-right text-white text-sm min-w-[900px]">
                    <thead className="bg-[#060e1e]">
                      <tr>{["الفريق", "الباسورد", "المسئول", "الحالة", "اللاعبين", "إجراءات"].map(h => <th key={h} className="px-4 py-3 text-gray-400 font-bold border-b border-white/5">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {currentTeamsList.map(teamName => {
                        const r = rostersList.find(x => x.id === teamName) || { password: "", isSubmitted: false, managerName: "", managerPhone: "", players: [] };
                        const registeredCount = (r.players || []).filter((p: any) => p.name.trim() !== "").length;
                        return (
                          <tr key={teamName} className="border-t border-white/5 hover:bg-white/3 transition-colors">
                            <td className="px-4 py-3 font-black">{teamName}</td>
                            <td className="px-4 py-3">
                              <input type="text" value={r.password} onChange={e => setDoc(doc(db, getColl("team_rosters"), teamName), { password: e.target.value }, { merge: true })} className="w-28 bg-[#060e1e] border border-white/10 rounded-lg px-2 py-1.5 text-yellow-400 font-bold text-sm outline-none text-center" />
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <div className="font-bold text-cyan-300">{r.managerName || "—"}</div>
                              <div className="text-gray-500 text-xs" dir="ltr">{r.managerPhone || ""}</div>
                            </td>
                            <td className="px-4 py-3">
                              {r.isSubmitted
                                ? <span className="bg-emerald-900/50 text-emerald-300 text-xs px-3 py-1 rounded-full font-bold border border-emerald-500/30">🔒 مقفولة</span>
                                : <span className="bg-gray-800 text-gray-400 text-xs px-3 py-1 rounded-full font-bold border border-white/10">🔓 مفتوحة</span>}
                            </td>
                            <td className="px-4 py-3 font-black text-center text-yellow-400">{registeredCount}/12</td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1.5">
                                <Btn size="sm" onClick={() => startEditRoster(teamName)} variant="blue"><Edit className="w-3 h-3" /></Btn>
                                {r.isSubmitted
                                  ? <Btn size="sm" onClick={() => unlockRoster(teamName)} variant="primary"><Unlock className="w-3 h-3" /></Btn>
                                  : <Btn size="sm" onClick={() => lockRoster(teamName)} variant="emerald"><Lock className="w-3 h-3" /></Btn>}
                                <Btn size="sm" onClick={() => deleteRoster(teamName)} variant="danger"><Trash2 className="w-3 h-3" /></Btn>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {editingRosterId && (
                  <div className="bg-[#060e1e] border border-blue-500/30 rounded-2xl p-5 space-y-5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-blue-400 font-black">تعديل قائمة: {editingRosterId}</h3>
                      <Btn onClick={() => setEditingRosterId(null)} variant="danger" size="sm">إغلاق ✕</Btn>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field label="اسم المسئول"><input value={rosterFormAdmin.managerName} onChange={e => setRosterFormAdmin(p => ({ ...p, managerName: e.target.value }))} className={inputCls} /></Field>
                      <Field label="رقم الهاتف"><input value={rosterFormAdmin.managerPhone} onChange={e => setRosterFormAdmin(p => ({ ...p, managerPhone: e.target.value }))} className={inputCls} dir="ltr" /></Field>
                      <Field label="رابط لوجو الفريق"><input value={rosterFormAdmin.logoUrl} onChange={e => setRosterFormAdmin(p => ({ ...p, logoUrl: e.target.value }))} className={inputCls} dir="ltr" /></Field>
                      <Field label="حالة القائمة">
                        <div className="flex gap-2">
                          <Btn onClick={() => setRosterFormAdmin(p => ({ ...p, isSubmitted: true }))} variant={rosterFormAdmin.isSubmitted ? "emerald" : "ghost"} size="md" className="flex-1">معتمدة 🔒</Btn>
                          <Btn onClick={() => setRosterFormAdmin(p => ({ ...p, isSubmitted: false }))} variant={!rosterFormAdmin.isSubmitted ? "primary" : "ghost"} size="md" className="flex-1">مفتوحة 🔓</Btn>
                        </div>
                      </Field>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {rosterFormAdmin.players.map((p, i) => (
                        <div key={i} className="flex items-center gap-2 bg-[#0f1c35] p-2 rounded-xl border border-white/5">
                          <span className="text-gray-500 font-black text-sm w-6 shrink-0">{i + 1}</span>
                          <input placeholder="اسم اللاعب" value={p.name} onChange={e => updateAdminRosterPlayer(i, 'name', e.target.value)} className="flex-1 bg-[#060e1e] border border-white/5 rounded-lg px-2 py-1.5 text-white text-sm font-bold outline-none" />
                          <input placeholder="#" type="number" value={p.number} onChange={e => updateAdminRosterPlayer(i, 'number', e.target.value)} className="w-14 bg-[#060e1e] border border-white/5 rounded-lg px-2 py-1.5 text-yellow-400 font-black text-sm outline-none text-center" />
                        </div>
                      ))}
                    </div>
                    <Btn onClick={saveRosterAdmin} variant="blue" size="xl">حفظ القائمة 💾</Btn>
                  </div>
                )}
              </SectionCard>
            )}

            {/* ─── الهدافين ─── */}
            {activeTab === "goals" && (
              <div className="space-y-5">
                <SectionCard title={editingGoalId ? "تعديل هداف" : "إضافة هداف"} icon="🥇" color={mainAppTab === 'mathani_cup' ? 'emerald' : 'yellow'}>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <Field label="الفريق"><input list="teams-list" value={goalForm.team} onChange={e => setGoalForm({ ...goalForm, team: e.target.value })} className={inputCls} /></Field>
                      <Field label="اسم اللاعب" labelColor={mainAppTab === 'mathani_cup' ? 'text-emerald-400' : 'text-yellow-400'}><input value={goalForm.player} onChange={e => setGoalForm({ ...goalForm, player: e.target.value })} className={inputCls} /></Field>
                      <Field label="عدد الأهداف"><input type="number" value={goalForm.goalsCount} onChange={e => setGoalForm({ ...goalForm, goalsCount: Number(e.target.value) })} className={`${inputCls} text-center font-black ${mainAppTab === 'mathani_cup' ? 'text-emerald-400' : 'text-yellow-400'}`} /></Field>
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-3 bg-[#060e1e] p-3 rounded-xl border border-white/5">
                      {['rating', 'pac', 'sho', 'pas', 'dri', 'def', 'phy'].map(stat => (
                        <Field key={stat} label={stat.toUpperCase()}>
                          <input type="number" value={(goalForm as any)[stat]} onChange={e => setGoalForm({ ...goalForm, [stat]: Number(e.target.value) })} className={`${inputCls} text-center text-xs`} />
                        </Field>
                      ))}
                    </div>
                    <Field label="رابط الصورة"><input value={goalForm.imageUrl} onChange={e => setGoalForm({ ...goalForm, imageUrl: e.target.value })} className={inputCls} dir="ltr" placeholder="https://..." /></Field>
                    <Btn onClick={addOrUpdateGoal} variant={mainAppTab === 'mathani_cup' ? 'emerald' : 'primary'} size="xl">{editingGoalId ? "تأكيد التعديل ✔️" : "إضافة الهداف ➕"}</Btn>
                  </div>
                </SectionCard>
                <SectionCard title="سجل الهدافين" icon="📊" color="cyan" action={
                  <div className="relative"><Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" /><input value={goalSearchTerm} onChange={e => setGoalSearchTerm(e.target.value)} placeholder="بحث..." className="bg-[#060e1e] border border-white/10 rounded-xl pr-9 pl-3 py-2 text-white text-sm outline-none w-44" /></div>
                }>
                  <div className="overflow-x-auto rounded-xl border border-white/5">
                    <table className="w-full text-right text-white text-sm min-w-[500px]">
                      <thead className="bg-[#060e1e]"><tr><th className="px-4 py-3 text-gray-400">اللاعب</th><th className="px-4 py-3 text-gray-400">الفريق</th><th className="px-4 py-3 text-gray-400 text-center">الأهداف</th><th className="px-4 py-3 text-gray-400 text-center">إجراءات</th></tr></thead>
                      <tbody>
                        {filteredGoals.sort((a, b) => b.goals - a.goals).map(g => (
                          <tr key={g.id} className="border-t border-white/5 hover:bg-white/3">
                            <td className="px-4 py-3 font-bold">{g.player}</td>
                            <td className="px-4 py-3 text-gray-400 text-xs">{g.team}</td>
                            <td className="px-4 py-3 text-center font-black text-yellow-400 text-lg">{g.goals}</td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex gap-1.5 justify-center">
                                <Btn size="sm" onClick={() => startEditGoal(g)} variant="blue"><Edit className="w-3 h-3" /></Btn>
                                <Btn size="sm" onClick={() => deleteGoal(g.id)} variant="danger"><Trash2 className="w-3 h-3" /></Btn>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </SectionCard>
              </div>
            )}

            {/* ─── الكروت ─── */}
            {activeTab === "cards" && (
              <div className="space-y-5">
                <SectionCard title="إدارة الكروت" icon="🟨" color="yellow" action={
                  <Btn onClick={archiveAndResetCards} variant="danger" size="sm">تصفير وأرشفة</Btn>
                }>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Field label="الفريق"><input list="teams-list" value={cardForm.team} onChange={e => setCardForm({ ...cardForm, team: e.target.value })} className={inputCls} /></Field>
                    <Field label="اسم اللاعب"><input value={cardForm.player} onChange={e => setCardForm({ ...cardForm, player: e.target.value })} className={inputCls} /></Field>
                    <Field label="نوع الكارت">
                      <select value={cardForm.type} onChange={e => setCardForm({ ...cardForm, type: e.target.value as "yellow" | "red" })} className={selectCls}>
                        <option value="yellow">🟨 إنذار أصفر</option><option value="red">🟥 كارت أحمر</option>
                      </select>
                    </Field>
                  </div>
                  <div className="mt-4"><Btn onClick={addCard} variant="primary" size="xl">إضافة الكارت ✔️</Btn></div>
                </SectionCard>
                <SectionCard title="سجل الكروت" icon="📋" color="cyan" action={
                  <div className="relative"><Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" /><input value={cardSearchTerm} onChange={e => setCardSearchTerm(e.target.value)} placeholder="بحث..." className="bg-[#060e1e] border border-white/10 rounded-xl pr-9 pl-3 py-2 text-white text-sm outline-none w-44" /></div>
                }>
                  <div className="overflow-x-auto rounded-xl border border-white/5">
                    <table className="w-full text-right text-white text-sm">
                      <thead className="bg-[#060e1e]"><tr><th className="px-4 py-3 text-gray-400">اللاعب</th><th className="px-4 py-3 text-gray-400">الفريق</th><th className="px-4 py-3 text-gray-400 text-center">الكروت</th><th className="px-4 py-3 text-gray-400 text-center">حذف</th></tr></thead>
                      <tbody>
                        {filteredCards.sort((a, b) => b.red - a.red || b.yellow - a.yellow).map(c => (
                          <tr key={c.id} className="border-t border-white/5 hover:bg-white/3">
                            <td className="px-4 py-3 font-bold">{c.player}</td>
                            <td className="px-4 py-3 text-gray-400 text-xs">{c.team}</td>
                            <td className="px-4 py-3 text-center"><span className="font-black text-yellow-400 ml-3">🟨 {c.yellow}</span><span className="font-black text-red-500">🟥 {c.red}</span></td>
                            <td className="px-4 py-3 text-center"><Btn size="sm" onClick={() => deleteCard(c.id)} variant="danger"><Trash2 className="w-3 h-3" /></Btn></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </SectionCard>
              </div>
            )}

            {/* ─── نجوم المباريات ─── */}
            {activeTab === "motm" && (
              <div className="space-y-5">
                <SectionCard title={editingMotmId ? "تعديل نجم المباراة" : "إضافة نجم مباراة"} icon="🌟" color="yellow">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <Field label="الفريق"><input list="teams-list" value={motmForm.team} onChange={e => setMotmForm({ ...motmForm, team: e.target.value })} className={inputCls} /></Field>
                      <Field label="اسم اللاعب"><input value={motmForm.player} onChange={e => setMotmForm({ ...motmForm, player: e.target.value })} className={inputCls} /></Field>
                      <Field label="المباراة"><input value={motmForm.matchName} onChange={e => setMotmForm({ ...motmForm, matchName: e.target.value })} className={inputCls} /></Field>
                      <Field label="رابط الصورة"><input value={motmForm.imageUrl} onChange={e => setMotmForm({ ...motmForm, imageUrl: e.target.value })} className={inputCls} dir="ltr" /></Field>
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-3 bg-[#060e1e] p-3 rounded-xl border border-white/5">
                      {['rating', 'pac', 'sho', 'pas', 'dri', 'def', 'phy'].map(stat => (
                        <Field key={stat} label={stat.toUpperCase()}>
                          <input type="number" value={(motmForm as any)[stat]} onChange={e => setMotmForm({ ...motmForm, [stat]: Number(e.target.value) })} className={`${inputCls} text-center text-xs`} />
                        </Field>
                      ))}
                    </div>
                    <Btn onClick={addMotm} variant="primary" size="xl">{editingMotmId ? "تأكيد التعديل ✔️" : "إضافة النجم ⭐"}</Btn>
                  </div>
                </SectionCard>
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {motmList.map((m, i) => (
                    <div key={i} className="bg-[#0f1c35] border border-white/8 rounded-2xl p-4 flex gap-3 items-center">
                      <div className="w-14 h-14 rounded-full bg-[#060e1e] border-2 border-yellow-400 overflow-hidden shrink-0 flex items-center justify-center">
                        {m.imageUrl ? <img src={m.imageUrl} className="w-full h-full object-cover" /> : <span className="text-xl">👤</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-black text-white truncate">{m.player}</div>
                        <div className="text-cyan-400 text-xs truncate">{m.team}</div>
                      </div>
                      <div className="flex flex-col gap-1.5 shrink-0">
                        <Btn size="sm" onClick={() => startEditMotm(m)} variant="blue"><Edit className="w-3 h-3" /></Btn>
                        <Btn size="sm" onClick={() => deleteMotm(m.id)} variant="danger"><Trash2 className="w-3 h-3" /></Btn>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─── تشكيلة الجولة ─── */}
            {activeTab === "totw" && (
              <SectionCard title="تشكيلة الجولة" icon="🏟️" color="emerald" action={
                <select value={formationForm.round} onChange={e => setFormationForm(p => ({ ...p, round: e.target.value }))} className="bg-[#060e1e] border border-emerald-500/50 rounded-xl px-3 py-2 text-white text-sm font-bold outline-none">
                  {["دور المجموعات", "الملحق", "دور الستة عشر", "دور الثمانية", "دور الأربعة", "النهائي"].map(r => <option key={r}>{r}</option>)}
                </select>
              }>
                <div className="space-y-5">
                  <div className="bg-[#060e1e] p-4 rounded-xl border border-white/5 space-y-3">
                    <div className="text-sm font-bold text-yellow-300 border-b border-white/5 pb-2">أفضل مدير فني</div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <Field label="الاسم"><input value={formationForm.coach?.name || ''} onChange={e => updateFormationCoach('name', e.target.value)} className={inputCls} /></Field>
                      <Field label="الفريق"><input list="teams-list" value={formationForm.coach?.team || ''} onChange={e => updateFormationCoach('team', e.target.value)} className={inputCls} /></Field>
                      <Field label="التقييم"><input type="number" value={formationForm.coach?.rating || 99} onChange={e => updateFormationCoach('rating', Number(e.target.value))} className={`${inputCls} text-center`} /></Field>
                      <Field label="رابط الصورة"><input value={formationForm.coach?.imageUrl || ''} onChange={e => updateFormationCoach('imageUrl', e.target.value)} className={inputCls} dir="ltr" /></Field>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="text-sm font-bold text-cyan-300 border-b border-white/5 pb-2">اللاعبون الأساسيون (7)</div>
                    {["GK", "CB", "CB", "LM", "CM", "RM", "ST"].map((pos, i) => (
                      <div key={i} className="flex flex-col sm:flex-row items-center gap-3 bg-[#060e1e] p-3 rounded-xl border border-white/5">
                        <span className="bg-emerald-600 text-white text-xs font-black px-3 py-1.5 rounded-lg w-12 text-center shrink-0">{pos}</span>
                        <input value={formationForm.players[i]?.name || ''} onChange={e => updateFormationPlayer(i, 'name', e.target.value)} placeholder="اسم اللاعب" className={`${inputCls} flex-1`} />
                        <input list="teams-list" value={formationForm.players[i]?.team || ''} onChange={e => updateFormationPlayer(i, 'team', e.target.value)} placeholder="الفريق" className={`${inputCls} sm:w-40`} />
                        <input type="number" value={formationForm.players[i]?.rating || 99} onChange={e => updateFormationPlayer(i, 'rating', Number(e.target.value))} className={`${inputCls} sm:w-20 text-center text-yellow-400 font-black`} />
                        <input value={formationForm.players[i]?.imageUrl || ''} onChange={e => updateFormationPlayer(i, 'imageUrl', e.target.value)} placeholder="رابط الصورة" className={`${inputCls} sm:w-48`} dir="ltr" />
                      </div>
                    ))}
                  </div>
                  <Btn onClick={saveFormation} variant="emerald" size="xl">حفظ التشكيلة 💾</Btn>
                </div>
              </SectionCard>
            )}

            {/* ─── فانتزي ─── */}
            {activeTab === "fantasy" && (
              <SectionCard title="إدارة فانتزي التوقعات" icon="🎁" color="emerald" action={
                <Btn onClick={deleteAllPredictions} variant="danger" size="sm">مسح كل التوقعات</Btn>
              }>
                <div className="overflow-x-auto rounded-xl border border-white/5">
                  <table className="w-full text-right text-white text-sm min-w-[700px]">
                    <thead className="bg-[#060e1e]"><tr><th className="px-4 py-3 text-gray-400">المتوقع</th><th className="px-4 py-3 text-gray-400">المباراة</th><th className="px-4 py-3 text-gray-400 text-center">التوقع</th><th className="px-4 py-3 text-gray-400 text-center">حذف</th></tr></thead>
                    <tbody>
                      {predictions.map((p, i) => (
                        <tr key={i} className="border-t border-white/5 hover:bg-white/3">
                          <td className="px-4 py-3 font-bold">{p.name}<span className="text-gray-500 text-xs block" dir="ltr">{p.phone}</span></td>
                          <td className="px-4 py-3 text-cyan-400 font-bold text-xs">{p.matchName}</td>
                          <td className="px-4 py-3 text-center font-black text-yellow-400 text-lg" dir="ltr">{p.homeScore} - {p.awayScore}</td>
                          <td className="px-4 py-3 text-center"><Btn size="sm" onClick={() => deletePrediction(p.id)} variant="danger"><Trash2 className="w-3 h-3" /></Btn></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            )}

            {/* ─── الأخبار ─── */}
            {activeTab === "media" && (
              <div className="space-y-5">
                <SectionCard title="إضافة خبر أو فيديو" icon="📰" color="cyan">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <Field label="النوع">
                      <select value={mediaForm.type} onChange={e => setMediaForm({ ...mediaForm, type: e.target.value })} className={selectCls}>
                        <option value="news">📰 خبر</option><option value="video">🎥 فيديو يوتيوب</option>
                      </select>
                    </Field>
                    <Field label="العنوان"><input value={mediaForm.title} onChange={e => setMediaForm({ ...mediaForm, title: e.target.value })} className={inputCls} /></Field>
                    <Field label="الرابط"><input value={mediaForm.url} onChange={e => setMediaForm({ ...mediaForm, url: e.target.value })} className={inputCls} dir="ltr" /></Field>
                    <Field label="رابط الصورة"><input value={mediaForm.imageUrl} onChange={e => setMediaForm({ ...mediaForm, imageUrl: e.target.value })} className={inputCls} dir="ltr" /></Field>
                  </div>
                  <Btn onClick={addMedia} variant="cyan" size="xl">نشر الآن ✍️</Btn>
                </SectionCard>
                <SectionCard title="المحتوى المنشور" icon="📋" color="blue">
                  <div className="space-y-2">
                    {mediaItems.map(item => (
                      <div key={item.id} className="flex items-center justify-between bg-[#060e1e] px-4 py-3 rounded-xl border border-white/5">
                        <div>
                          <span className="text-xs bg-[#0f1c35] border border-white/10 px-2 py-0.5 rounded-lg mr-2">{item.type === 'news' ? '📰' : '🎥'}</span>
                          <span className="font-bold text-sm">{item.title}</span>
                        </div>
                        <Btn size="sm" onClick={() => deleteMedia(item.id)} variant="danger"><Trash2 className="w-3 h-3" /></Btn>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              </div>
            )}

            {/* ─── الإشعارات ─── */}
            {activeTab === "notifications" && (
              <SectionCard title="إرسال إشعار فوري" icon="🔔" color="yellow">
                <div className="space-y-5">
                  <div className="flex flex-wrap gap-2 bg-[#060e1e] p-4 rounded-xl border border-white/5">
                    <span className="text-gray-400 text-sm font-bold self-center ml-2">إرسال سريع:</span>
                    <Btn size="sm" onClick={() => sendQuickNotification("⚽ هدف جديد!", "تم تسجيل هدف الآن.")} variant="emerald">⚽ هدف</Btn>
                    <Btn size="sm" onClick={() => sendQuickNotification("🔴 مباراة بدأت!", "المباراة بدأت لايف حالياً.")} variant="red">🔴 لايف</Btn>
                  </div>
                  <div className="space-y-3">
                    <Field label="عنوان الإشعار"><input value={notifyTitle} onChange={e => setNotifyTitle(e.target.value)} placeholder="مثال: هدف من الدقيقة 45" className={inputCls} /></Field>
                    <Field label="التفاصيل"><input value={notifyBody} onChange={e => setNotifyBody(e.target.value)} placeholder="اكتب تفاصيل الإشعار..." className={inputCls} /></Field>
                  </div>
                  <Btn onClick={sendNotification} disabled={isSending} variant="primary" size="xl">
                    {isSending ? <><Loader2 className="animate-spin h-5 w-5" /> جاري الإرسال...</> : "إرسال للجميع 🚀"}
                  </Btn>
                </div>
              </SectionCard>
            )}

            {/* ─── شريط الأخبار ─── */}
            {activeTab === "ticker" && (
              <SectionCard title="شريط الأخبار المتحرك" icon="✍️" color="yellow">
                <div className="space-y-4">
                  <Field label="نص الشريط"><input value={tickerText} onChange={e => setTickerText(e.target.value)} placeholder="اكتب شريط الأخبار هنا..." className={inputCls} /></Field>
                  <Btn onClick={saveTicker} variant="primary" size="xl">تحديث شريط الأخبار ✔️</Btn>
                </div>
              </SectionCard>
            )}

          </div>
        )}
      </div>

      {/* فوتر */}
      <div className="mt-16 border-t border-white/5 py-6 text-center text-gray-600 text-xs">
        لوحة إدارة منصة مطروح الرياضية — فتحي هيرو 🦅
      </div>
    </div>
  );
}
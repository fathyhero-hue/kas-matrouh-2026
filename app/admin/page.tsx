"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Trophy, LogOut, Edit, Trash2, Plus, Minus, Play, Pause, BellRing, Video, Gift, Star } from "lucide-react";
import { collection, addDoc, deleteDoc, doc, updateDoc, onSnapshot, setDoc, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { TEAM_NAMES } from "@/data/tournament";

const ADMIN_PASSWORD = "hero123";

const cleanTeamString = (name: any) => String(name || "").replace(/النجيلّة/g, "النجيلة").replace(/علّوش/g, "علوش").trim();
const CLEANED_TEAM_NAMES = Array.from(new Set(TEAM_NAMES.map(t => cleanTeamString(t))));

// 🔴 فرق الناشئين
const JUNIORS_GROUP_A = ["سيف الوادي", "ميلانو", "النجيلة", "كابتن تيكا", "اصدقاء عز بوالمجدوبة"];
const JUNIORS_GROUP_B = ["الاولمبي", "ابناء اكرامي", "غوط رباح", "اصدقاء مهدي", "وادي الرمل"];
const JUNIORS_TEAMS = [...JUNIORS_GROUP_A, ...JUNIORS_GROUP_B];

const SPONSORS = [
  { name: "الفهد للديكور", src: "/alfahd.png" }, { name: "أحمد عبدالعاطي المحامي", src: "/abdelaty.png" }, { name: "دثار للزي العربي", src: "/dithar.png" },
  { name: "معصرة فرجينيا", src: "/virginia.png" }, { name: "دبي للزي العربي", src: "/dubai.png" }, { name: "معرض الأمانة", src: "/alamana.png" },
  { name: "تراث البادية", src: "/torath.png" }, { name: "عبدالمقصود ستورز", src: "/abdelmaksoud.png" }, { name: "مياة حياة", src: "/hayah.png" },
  { name: "القدس للأثاث", src: "/alquds.png" }, { name: "أيس كريم الملكة", src: "/almaleka.png" }, { name: "جزارة عبدالله الجراري", src: "/aljarari.png" },
  { name: "M MART", src: "/mmart.png" }, { name: "هيرو سبورت", src: "/hero-sport.png" }, { name: "الفتح للفراشة", src: "/alfath.png" }, { name: "عادل العميري للديكور", src: "/alomairy.png" }
];

type StandingRow = { team: string; played: number; wins: number; draws: number; losses: number; gf: number; ga: number; gd: number; points: number; rank: number; };
function normalizeTeamName(name: string): string { return String(name || "").trim().replace(/\s+/g, " ").replace(/أ|إ|آ/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/ـ/g, "").replace(/ّ/g, "").toLowerCase(); }
function getOriginalTeamName(norm: string): string { 
  const allTeams = [...CLEANED_TEAM_NAMES, ...JUNIORS_TEAMS];
  return allTeams.find(t => normalizeTeamName(t) === norm) || norm; 
}

function sortMatches(arr: any[]) { return [...arr].sort((a, b) => { if (a.date !== b.date) return b.date.localeCompare(a.date); return (b.time || "00:00").localeCompare(a.time || "00:00"); }); }
function sortMatchesAsc(arr: any[]) { return [...arr].sort((a, b) => { if (a.date !== b.date) return a.date.localeCompare(b.date); return (a.time || "00:00").localeCompare(b.time || "00:00"); }); }

function getArabicDay(dateString: string): string {
  if (!dateString) return "";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "";
  const days = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  return days[d.getDay()];
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

export default function AdminPage() {
  const [isAuth, setIsAuth] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  
  const [activeTournament, setActiveTournament] = useState<'youth' | 'juniors'>('youth'); // 🔴 مفتاح الإدارة
  const [activeTab, setActiveTab] = useState("live");

  const [matches, setMatches] = useState<any[]>([]);
  const matchesRef = useRef<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [cardEvents, setCardEvents] = useState<any[]>([]);
  const [mediaItems, setMediaItems] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [motmList, setMotmList] = useState<any[]>([]);
  
  const [tickerText, setTickerText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [goalSearchTerm, setGoalSearchTerm] = useState("");
  const [cardSearchTerm, setCardSearchTerm] = useState("");

  const [notifyTitle, setNotifyTitle] = useState("");
  const [notifyBody, setNotifyBody] = useState("");
  const [isSending, setIsSending] = useState(false);

  const sortedTeams = useMemo(() => [...CLEANED_TEAM_NAMES].sort((a, b) => a.localeCompare(b, "ar")), []);
  const sortedJuniorsTeams = useMemo(() => [...JUNIORS_TEAMS].sort((a, b) => a.localeCompare(b, "ar")), []);
  
  // 🔴 قائمة الفرق النشطة حالياً في لوحة الإدارة بناءً على البطولة
  const currentTeamsList = activeTournament === 'youth' ? sortedTeams : sortedJuniorsTeams;

  const [matchForm, setMatchForm] = useState({
    teamA: currentTeamsList[0], teamB: currentTeamsList[1] || currentTeamsList[0], homeGoals: 0, awayGoals: 0,
    round: "الجولة الأولى", date: new Date().toISOString().slice(0, 10), time: "15:30", status: "لم تبدأ"
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [goalForm, setGoalForm] = useState({ player: "", team: currentTeamsList[0], goalsCount: 1, imageUrl: "" });
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [cardForm, setCardForm] = useState({ player: "", team: currentTeamsList[0], type: "yellow" as "yellow" | "red" });
  const [mediaForm, setMediaForm] = useState({ title: "", url: "" });
  
  const [motmForm, setMotmForm] = useState({ 
    player: "", team: currentTeamsList[0], imageUrl: "", 
    sponsorName: SPONSORS[0].name, sponsorLogo: SPONSORS[0].src 
  });

  // 🔴 تحديث القوائم أوتوماتيك لما تغير البطولة
  useEffect(() => {
    const list = activeTournament === 'youth' ? sortedTeams : sortedJuniorsTeams;
    setMatchForm(p => ({...p, teamA: list[0], teamB: list[1] || list[0]}));
    setGoalForm(p => ({...p, team: list[0]}));
    setCardForm(p => ({...p, team: list[0]}));
    setMotmForm(p => ({...p, team: list[0]}));
    setEditingId(null); setEditingGoalId(null);
  }, [activeTournament]);

  const now = new Date();
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
  
  const finishedMatches = sortMatches(matches.filter(m => !m.isLive && (m.status === "انتهت" || m.date < todayStr)));
  const standingsYouth = useMemo(() => buildStandings(finishedMatches, CLEANED_TEAM_NAMES), [finishedMatches]);
  
  useEffect(() => { matchesRef.current = matches; }, [matches]);

  // 🔴 دالة لجلب اسم الكوليكشن المناسب (عشان تفصل داتا الشباب عن الناشئين)
  const getColl = (base: string) => activeTournament === "juniors" ? `${base}_juniors` : base;

  useEffect(() => {
    if (!isAuth) return;
    
    const unsubMatches = onSnapshot(collection(db, getColl("matches")), (snap) => setMatches(snap.docs.map(d => ({ id: d.id, ...d.data(), teamA: cleanTeamString(d.data().teamA), teamB: cleanTeamString(d.data().teamB) }))));
    const unsubGoals = onSnapshot(collection(db, getColl("goals")), (snap) => setGoals(snap.docs.map(d => ({ id: d.id, ...d.data(), team: cleanTeamString(d.data().team) }))));
    const unsubCards = onSnapshot(collection(db, getColl("cards")), (snap) => setCardEvents(snap.docs.map(d => ({ id: d.id, ...d.data(), team: cleanTeamString(d.data().team) }))));
    const unsubMedia = onSnapshot(collection(db, getColl("media")), (snap) => setMediaItems(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubPredictions = onSnapshot(collection(db, getColl("predictions")), (snap) => setPredictions(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a:any, b:any) => b.timestamp?.localeCompare(a.timestamp) || 0)));
    const unsubMotm = onSnapshot(collection(db, getColl("motm")), (snap) => setMotmList(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubTicker = onSnapshot(doc(db, "settings", "ticker"), (docSnap) => setTickerText(docSnap.data()?.text || ""));

    const timerInterval = setInterval(() => {
      matchesRef.current.forEach(m => {
        if (m.isTimerRunning && m.status !== "انتهت" && m.status !== "استراحة" && m.status !== "ضربات جزاء" && m.status !== "ستبدأ بعد قليل") {
          updateDoc(doc(db, getColl("matches"), m.id), { liveMinute: (m.liveMinute || 0) + 1 });
        }
      });
    }, 60000); 

    return () => { unsubMatches(); unsubGoals(); unsubCards(); unsubMedia(); unsubPredictions(); unsubMotm(); unsubTicker(); clearInterval(timerInterval); };
  }, [isAuth, activeTournament]); // 🔴 التحديث بيحصل كل ما البطولة تتغير

  const handleLogin = () => passwordInput === ADMIN_PASSWORD ? setIsAuth(true) : alert("كلمة السر خاطئة");

  const saveMatch = async () => {
    if (matchForm.teamA === matchForm.teamB) return alert("اختر فريقين مختلفين");
    const dayName = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"][new Date(matchForm.date).getDay()];
    const data = { ...matchForm, dayName, isLive: false };
    if (editingId) { await updateDoc(doc(db, getColl("matches"), editingId), data); setEditingId(null); alert("✅ تم تعديل المباراة بنجاح");} 
    else { await addDoc(collection(db, getColl("matches")), data); alert("✅ تم إضافة المباراة بنجاح");}
    setMatchForm({ teamA: currentTeamsList[0], teamB: currentTeamsList[1] || currentTeamsList[0], homeGoals: 0, awayGoals: 0, round: "الجولة الأولى", date: new Date().toISOString().slice(0, 10), time: "15:30", status: "لم تبدأ" });
  };

  const startEdit = (match: any) => { setEditingId(match.id); setMatchForm({ teamA: match.teamA, teamB: match.teamB, homeGoals: match.homeGoals, awayGoals: match.awayGoals, round: match.round, date: match.date, time: match.time, status: match.status || "لم تبدأ" }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const deleteMatch = async (id: string) => confirm("متأكد من الحذف؟") && await deleteDoc(doc(db, getColl("matches"), id));
  const updateMatchLive = async (id: string, updates: any) => await updateDoc(doc(db, getColl("matches"), id), updates);

  const togglePenalty = async (matchId: string, team: 'home' | 'away', index: number, current: string) => {
    const field = team === 'home' ? 'penaltiesHome' : 'penaltiesAway';
    const match = matches.find(m => m.id === matchId);
    let arr = match?.[field] || ['none','none','none','none','none'];
    let next = current === 'none' ? 'scored' : current === 'scored' ? 'missed' : 'none';
    let newArr = [...arr]; newArr[index] = next as any;
    await updateDoc(doc(db, getColl("matches"), matchId), { [field]: newArr });
  };

  const addPenaltySlot = async (matchId: string) => {
    const match = matches.find(m => m.id === matchId);
    if(!match) return;
    await updateDoc(doc(db, getColl("matches"), matchId), { penaltiesHome: [...(match.penaltiesHome || ['none','none','none','none','none']), 'none'], penaltiesAway: [...(match.penaltiesAway || ['none','none','none','none','none']), 'none'] });
  };

  const addOrUpdateGoal = async () => {
    if (!goalForm.player.trim()) return alert("اكتب اسم اللاعب");
    const playerNameTrimmed = goalForm.player.trim(); const teamSelected = goalForm.team; const goalsToAdd = Number(goalForm.goalsCount); const imageToAdd = goalForm.imageUrl.trim();
    if (editingGoalId) { 
      const data = { player: playerNameTrimmed, team: teamSelected, goals: goalsToAdd, imageUrl: imageToAdd };
      await updateDoc(doc(db, getColl("goals"), editingGoalId), data); setEditingGoalId(null); alert("✅ تم تعديل الهدف بنجاح");
    } else { 
      const existingPlayer = goals.find(g => String(g.player || "").trim().toLowerCase() === playerNameTrimmed.toLowerCase() && g.team === teamSelected);
      if (existingPlayer) {
        const newTotalGoals = (Number(existingPlayer.goals) || 0) + goalsToAdd;
        const updateData: any = { goals: newTotalGoals }; if (imageToAdd) updateData.imageUrl = imageToAdd;
        await updateDoc(doc(db, getColl("goals"), existingPlayer.id), updateData); alert(`✅ تم التحديث تراكمياً`);
      } else {
        const data = { player: playerNameTrimmed, team: teamSelected, goals: goalsToAdd, imageUrl: imageToAdd };
        await addDoc(collection(db, getColl("goals")), data); alert("✅ تم إضافة اللاعب والهدف بنجاح");
      }
    }
    setGoalForm({ player: "", team: currentTeamsList[0], goalsCount: 1, imageUrl: "" });
  };
  const startEditGoal = (goal: any) => { setEditingGoalId(goal.id); setGoalForm({ player: goal.player, team: goal.team, goalsCount: goal.goals, imageUrl: goal.imageUrl || "" }); };
  const deleteGoal = async (id: string) => confirm("حذف هذا الهدف؟") && await deleteDoc(doc(db, getColl("goals"), id));

  const addCard = async () => {
    if (!cardForm.player.trim()) return alert("اكتب اسم اللاعب");
    const playerNameTrimmed = cardForm.player.trim();
    const teamSelected = cardForm.team;
    const existingPlayer = cardEvents.find(c => String(c.player || "").trim().toLowerCase() === playerNameTrimmed.toLowerCase() && c.team === teamSelected);
    if (existingPlayer) {
       const newYellow = (Number(existingPlayer.yellow) || 0) + (cardForm.type === "yellow" ? 1 : 0);
       const newRed = (Number(existingPlayer.red) || 0) + (cardForm.type === "red" ? 1 : 0);
       await updateDoc(doc(db, getColl("cards"), existingPlayer.id), { yellow: newYellow, red: newRed });
       alert(`✅ تم تحديث كروت اللاعب بنجاح!`);
    } else {
       await addDoc(collection(db, getColl("cards")), { player: playerNameTrimmed, team: teamSelected, yellow: cardForm.type === "yellow" ? 1 : 0, red: cardForm.type === "red" ? 1 : 0 });
       alert("✅ تم إضافة البطاقة بنجاح");
    }
    setCardForm(p => ({ ...p, player: "" })); 
  };
  const updateCard = async (id: string, yellow: number, red: number) => await updateDoc(doc(db, getColl("cards"), id), { yellow, red });
  const deleteCard = async (id: string) => confirm("حذف هذه البطاقة؟") && await deleteDoc(doc(db, getColl("cards"), id));

  const addMedia = async () => {
    if (!mediaForm.title || !mediaForm.url) return alert("اكتب عنوان ورابط الفيديو");
    await addDoc(collection(db, getColl("media")), mediaForm);
    setMediaForm({ title: "", url: "" }); alert("✅ تم إضافة الفيديو بنجاح");
  };
  const deleteMedia = async (id: string) => confirm("حذف هذا الفيديو؟") && await deleteDoc(doc(db, getColl("media"), id));

  const addMotm = async () => {
    if (!motmForm.player.trim() || !motmForm.sponsorName.trim()) return alert("يجب كتابة اسم اللاعب واسم الراعي!");
    await addDoc(collection(db, getColl("motm")), motmForm);
    setMotmForm({ player: "", team: currentTeamsList[0], imageUrl: "", sponsorName: SPONSORS[0].name, sponsorLogo: SPONSORS[0].src }); 
    alert("✅ تم إضافة النجم بنجاح");
  };
  const deleteMotm = async (id: string) => confirm("حذف هذا اللاعب من قائمة نجوم المباريات؟") && await deleteDoc(doc(db, getColl("motm"), id));

  const deletePrediction = async (id: string) => confirm("حذف التوقع؟") && await deleteDoc(doc(db, getColl("predictions"), id));
  const deleteAllPredictions = async () => {
     if (!confirm("⚠️ تحذير: هل أنت متأكد من مسح جميع التوقعات السابقة لتبدأ جولة جديدة؟")) return;
     predictions.forEach(async (p) => await deleteDoc(doc(db, getColl("predictions"), p.id)));
     alert("✅ تم تصفية التوقعات بنجاح");
  };

  const saveTicker = async () => {
    if (!tickerText.trim()) return alert("اكتب الخبر أولاً");
    await setDoc(doc(db, "settings", "ticker"), { text: tickerText.trim() }); alert("✅ تم نشر الخبر بنجاح");
  };

  const sendNotification = async () => {
    if (!notifyTitle || !notifyBody) return alert("اكتب عنوان وتفاصيل الإشعار!");
    setIsSending(true);
    try {
      const snap = await getDocs(collection(db, "subscribers"));
      const tokens = snap.docs.map(doc => doc.data().token);
      if (tokens.length === 0) { alert("مفيش حد اشترك في الإشعارات لسه!"); setIsSending(false); return; }
      const res = await fetch("/api/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: notifyTitle, body: notifyBody, tokens }) });
      if (res.ok) { alert(`✅ تم الإرسال لـ ${tokens.length} جهاز!`); setNotifyTitle(""); setNotifyBody(""); } 
    } catch (error) { console.error(error); alert("حدث خطأ في الاتصال"); }
    setIsSending(false);
  };

  const safeGoalSearch = goalSearchTerm.toLowerCase(); const filteredGoals = goals.filter(g => String(g.player || "").toLowerCase().includes(safeGoalSearch) || String(g.team || "").toLowerCase().includes(safeGoalSearch));
  const safeCardSearch = cardSearchTerm.toLowerCase(); const filteredCards = cardEvents.filter(c => String(c.player || "").toLowerCase().includes(safeCardSearch) || String(c.team || "").toLowerCase().includes(safeCardSearch));
  const tomorrowStr = new Date(now.getTime() + 86400000).toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });

  if (!isAuth) return (
    <div dir="rtl" className="min-h-screen bg-[#0a1428] flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-yellow-400 bg-[#13213a]">
        <CardHeader className="text-center"><Trophy className="mx-auto h-12 w-12 text-yellow-400" /><CardTitle className="text-2xl font-black text-yellow-300 mt-4">إدارة كأس مطروح</CardTitle></CardHeader>
        <CardContent className="space-y-4"><Input type="password" placeholder="كلمة السر" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} className="bg-[#1e2a4a] border-yellow-400 text-white h-12 text-center text-xl" /><Button onClick={handleLogin} className="w-full bg-yellow-400 text-black font-bold h-12">دخول</Button></CardContent>
      </Card>
    </div>
  );

  return (
    <div dir="rtl" className="min-h-screen bg-[#0a1428] text-white pb-20">
      <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        <header className="mb-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-center sm:text-right">
             <h1 className="text-3xl sm:text-4xl font-black text-yellow-300">لوحة الإدارة الاحترافية</h1>
             <p className="text-cyan-300">بطولة كأس مطروح ٢٠٢٦</p>
          </div>
          <Button onClick={() => setIsAuth(false)} variant="outline" className="border-yellow-400 text-white hover:bg-yellow-400 hover:text-black">خروج <LogOut className="ml-2 h-4 w-4" /></Button>
        </header>

        {/* 🔴 مفتاح الإدارة السحري (الشباب / الناشئين) */}
        <div className="flex justify-center mb-8">
          <div className="bg-[#13213a] p-2 rounded-xl border border-yellow-400/30 inline-flex shadow-xl gap-2 w-full max-w-md">
            <button 
              onClick={() => setActiveTournament('youth')} 
              className={`flex-1 py-3 rounded-lg text-lg sm:text-xl font-black transition-all ${activeTournament === 'youth' ? 'bg-yellow-400 text-black shadow-[0_0_15px_rgba(250,204,21,0.4)]' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              إدارة الشباب 🏆
            </button>
            <button 
              onClick={() => setActiveTournament('juniors')} 
              className={`flex-1 py-3 rounded-lg text-lg sm:text-xl font-black transition-all ${activeTournament === 'juniors' ? 'bg-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              إدارة الناشئين 🏅
            </button>
          </div>
        </div>

        <Card className={`border ${activeTournament === 'juniors' ? 'border-cyan-500' : 'border-yellow-400'} bg-[#13213a] mb-8 mt-4 shadow-2xl transition-colors`}>
          <CardHeader><CardTitle className={activeTournament === 'juniors' ? 'text-cyan-300' : 'text-yellow-300'}>{editingId ? "تعديل مباراة" : `إضافة مباراة (${activeTournament === 'youth' ? 'شباب' : 'ناشئين'})`}</CardTitle></CardHeader>
          <CardContent className="space-y-6 p-6 text-white">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><select value={matchForm.teamA} onChange={e => setMatchForm(p => ({...p, teamA: e.target.value}))} className={`bg-[#1e2a4a] border ${activeTournament === 'juniors' ? 'border-cyan-500' : 'border-yellow-400'} rounded-2xl p-4 text-white`}>{currentTeamsList.map(t => <option key={t} value={t}>{t}</option>)}</select><div className="flex items-center justify-center text-5xl text-yellow-400 font-black">VS</div><select value={matchForm.teamB} onChange={e => setMatchForm(p => ({...p, teamB: e.target.value}))} className={`bg-[#1e2a4a] border ${activeTournament === 'juniors' ? 'border-cyan-500' : 'border-yellow-400'} rounded-2xl p-4 text-white`}>{currentTeamsList.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
            <div className="grid grid-cols-2 gap-6"><div><label className="block mb-2 text-cyan-300 font-bold">أهداف {matchForm.teamA}</label><Input type="number" value={matchForm.homeGoals} onChange={e => setMatchForm(p => ({...p, homeGoals: Number(e.target.value)}))} className="text-6xl text-center h-20 text-white font-black" /></div><div><label className="block mb-2 text-cyan-300 font-bold">أهداف {matchForm.teamB}</label><Input type="number" value={matchForm.awayGoals} onChange={e => setMatchForm(p => ({...p, awayGoals: Number(e.target.value)}))} className="text-6xl text-center h-20 text-white font-black" /></div></div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <select value={matchForm.round} onChange={e => setMatchForm(p => ({...p, round: e.target.value}))} className={`bg-[#1e2a4a] border ${activeTournament === 'juniors' ? 'border-cyan-500' : 'border-yellow-400'} rounded-2xl p-4 text-white font-bold`}>{["الجولة الأولى","الجولة الثانية","الجولة الثالثة","الجولة الرابعة","الجولة الخامسة","الملحق","دور الستة عشر","دور الثمانية","نصف النهائي","النهائي"].map(r => <option key={r} value={r}>{r}</option>)}</select>
              <Input type="time" value={matchForm.time} onChange={e => setMatchForm(p => ({...p, time: e.target.value}))} className={`text-white bg-[#1e2a4a] border ${activeTournament === 'juniors' ? 'border-cyan-500' : 'border-yellow-400'} rounded-2xl p-4 font-bold`} />
              <Input type="date" value={matchForm.date} onChange={e => setMatchForm(p => ({...p, date: e.target.value}))} className={`text-white bg-[#1e2a4a] border ${activeTournament === 'juniors' ? 'border-cyan-500' : 'border-yellow-400'} rounded-2xl p-4 font-bold`} />
              <select value={matchForm.status} onChange={e => setMatchForm(p => ({...p, status: e.target.value}))} className="bg-[#1e2a4a] border border-red-500 rounded-2xl p-4 text-white font-bold"><option value="لم تبدأ">حالة المباراة: لم تبدأ</option><option value="انتهت">حالة المباراة: انتهت ✔️</option></select>
            </div>
            <div className="flex gap-4 mt-6">
              <Button onClick={saveMatch} className={`flex-1 font-black py-7 text-xl transition-all ${activeTournament === 'juniors' ? 'bg-cyan-500 text-white hover:bg-cyan-600' : 'bg-yellow-400 text-black hover:bg-yellow-500'}`}>{editingId ? "حفظ التعديل" : "إضافة المباراة"}</Button>
              {editingId && <Button onClick={() => {setEditingId(null); setMatchForm({ teamA: currentTeamsList[0], teamB: currentTeamsList[1] || currentTeamsList[0], homeGoals: 0, awayGoals: 0, round: "الجولة الأولى", date: new Date().toISOString().slice(0, 10), time: "15:30", status: "لم تبدأ" });}} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-7 px-8">إلغاء</Button>}
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
          <TabsList className="flex flex-wrap justify-center bg-[#13213a] border border-white/20 p-1.5 rounded-2xl mb-8 gap-2 h-auto shadow-lg">
            <TabsTrigger value="live" className="data-[state=active]:bg-red-600 data-[state=active]:text-white font-bold py-2 px-4 rounded-xl text-red-400">مباشر</TabsTrigger>
            <TabsTrigger value="knockout" className="data-[state=active]:bg-yellow-400 data-[state=active]:text-black font-black py-2 px-4 rounded-xl text-yellow-400 border border-yellow-400/30">إقصائيات 🏆</TabsTrigger>
            <TabsTrigger value="motm" className="data-[state=active]:bg-yellow-400 data-[state=active]:text-black font-black py-2 px-4 rounded-xl text-yellow-400 border border-yellow-400/30">نجوم 🌟</TabsTrigger>
            <TabsTrigger value="all" className="data-[state=active]:bg-black data-[state=active]:text-yellow-300 font-bold py-2 px-4 rounded-xl text-white">السابقة</TabsTrigger>
            <TabsTrigger value="today" className="data-[state=active]:bg-black data-[state=active]:text-yellow-300 font-bold py-2 px-4 rounded-xl text-white">اليوم</TabsTrigger>
            <TabsTrigger value="tomorrow" className="data-[state=active]:bg-black data-[state=active]:text-yellow-300 font-bold py-2 px-4 rounded-xl text-white">غداً</TabsTrigger>
            <TabsTrigger value="predictions" className="data-[state=active]:bg-yellow-400 data-[state=active]:text-black font-black py-2 px-4 rounded-xl text-yellow-400 border border-yellow-400/30">توقعات 🎁</TabsTrigger>
            <TabsTrigger value="goals" className="data-[state=active]:bg-black data-[state=active]:text-yellow-300 font-bold py-2 px-4 rounded-xl text-white">أهداف</TabsTrigger>
            <TabsTrigger value="cards" className="data-[state=active]:bg-black data-[state=active]:text-yellow-300 font-bold py-2 px-4 rounded-xl text-white">كروت</TabsTrigger>
            <TabsTrigger value="media" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-white font-bold py-2 px-4 rounded-xl text-emerald-400">ميديا</TabsTrigger>
            <TabsTrigger value="ticker" className="data-[state=active]:bg-black data-[state=active]:text-yellow-300 font-bold py-2 px-4 rounded-xl text-white">أخبار</TabsTrigger>
            <TabsTrigger value="notify" className="data-[state=active]:bg-yellow-400 data-[state=active]:text-black font-black py-2 px-4 rounded-xl text-yellow-400 bg-black/40 border border-yellow-400/20">إشعارات 🔔</TabsTrigger>
          </TabsList>

          <TabsContent value="motm">
            <Card className="border-yellow-400 bg-[#13213a]">
              <CardHeader><CardTitle className="text-yellow-300 flex items-center gap-2"><Star /> إدارة جوائز رجل المباراة (MOTM)</CardTitle></CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-[#1e2a4a] rounded-2xl items-center border border-yellow-400/20 shadow-inner">
                  <Input value={motmForm.player} onChange={e => setMotmForm(p => ({...p, player: e.target.value}))} placeholder="اسم اللاعب (النجم)" className="bg-[#0a1428] border-yellow-400 text-white h-12" />
                  <select value={motmForm.team} onChange={e => setMotmForm(p => ({...p, team: e.target.value}))} className="bg-[#0a1428] border border-yellow-400 rounded-xl p-3 text-white h-12 outline-none">
                     {currentTeamsList.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <Input value={motmForm.imageUrl} onChange={e => setMotmForm(p => ({...p, imageUrl: e.target.value}))} placeholder="صورة اللاعب (رابط URL)" className="bg-[#0a1428] border-yellow-400 text-white h-12" />
                  <div className="flex gap-2 h-12">
                    <select 
                      value={motmForm.sponsorName} 
                      onChange={e => {
                         const sp = SPONSORS.find(s => s.name === e.target.value);
                         setMotmForm(p => ({...p, sponsorName: sp?.name || "", sponsorLogo: sp?.src || ""}));
                      }} 
                      className="bg-[#0a1428] border border-yellow-400 rounded-xl px-2 text-white flex-1 outline-none text-sm"
                    >
                      {SPONSORS.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                    </select>
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center border-2 border-yellow-400 shrink-0 p-1 overflow-hidden shadow-inner">
                      {motmForm.sponsorLogo ? <img src={motmForm.sponsorLogo} className="max-h-full max-w-full object-contain" alt="لوجو الراعي" /> : null}
                    </div>
                  </div>
                  <Button onClick={addMotm} className={`font-black h-12 lg:col-span-4 mt-2 transition-transform hover:scale-[1.01] ${activeTournament === 'juniors' ? 'bg-cyan-500 text-white' : 'bg-yellow-400 text-black'}`}>إضافة النجم للقائمة 🌟</Button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {motmList.map(m => (
                    <div key={m.id} className="bg-[#1e2a4a] p-4 rounded-2xl flex justify-between items-center border border-white/10">
                      <div className="flex items-center gap-4">
                        {m.imageUrl ? <img src={m.imageUrl} className="h-12 w-12 rounded-full object-cover border-2 border-yellow-400" /> : <div className="h-12 w-12 rounded-full bg-[#0a1428] flex items-center justify-center text-xl border-2 border-yellow-400">👤</div>}
                        <div><div className="font-bold text-white text-lg">{m.player}</div><div className="text-cyan-300 text-xs mt-1">{m.team} • برعاية {m.sponsorName}</div></div>
                      </div>
                      <Button size="sm" variant="destructive" onClick={() => deleteMotm(m.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="knockout">
            <div className="space-y-10">
              {activeTournament === 'youth' && (
                <>
                  <div className="bg-gradient-to-br from-[#1e2a4a] to-[#13213a] p-4 sm:p-6 rounded-3xl border-2 border-yellow-400/50 shadow-xl relative overflow-hidden">
                     <div className="text-center mb-8"><Badge className="bg-yellow-400 text-black text-xl px-10 py-2 font-black shadow-lg border-2 border-[#13213a]">دور الـ 16 (شجرة الإدارة)</Badge></div>
                     <div className="grid md:grid-cols-2 gap-8 relative z-10">
                       <div className="space-y-4">
                         {[ { id: 1, r1: 1, l1: "أول الترتيب", m2: 104 }, { id: 2, r1: 8, l1: "ثامن الترتيب", m2: 97 }, { id: 3, r1: 4, l1: "رابع الترتيب", m2: 101 }, { id: 4, r1: 5, l1: "خامس الترتيب", m2: 100 } ].map(match => (
                           <div key={match.id} className="bg-[#0a1428] rounded-2xl border border-yellow-400/30 flex items-center shadow-md overflow-hidden hover:border-yellow-400 transition-colors">
                              <div className="bg-yellow-400 text-black font-black w-10 h-full flex items-center justify-center text-xl shrink-0">{match.id}</div>
                              <div className="flex-1 p-3 flex flex-col"><div className="text-emerald-400 font-bold text-sm text-center bg-[#13213a] rounded-lg py-1 mb-1">{standingsYouth.length >= match.r1 ? standingsYouth[match.r1-1].team : match.l1}</div><div className="text-center text-yellow-500 font-black text-xs my-1">VS</div><div className="text-cyan-300 font-bold text-sm text-center bg-[#13213a] rounded-lg py-1 mt-1">الفائز من م {match.m2}</div></div>
                           </div>
                         ))}
                       </div>
                       <div className="space-y-4">
                         {[ { id: 5, r1: 2, l1: "ثاني الترتيب", m2: 103 }, { id: 6, r1: 7, l1: "سابع الترتيب", m2: 98 }, { id: 7, r1: 3, l1: "ثالث الترتيب", m2: 102 }, { id: 8, r1: 6, l1: "سادس الترتيب", m2: 99 } ].map(match => (
                           <div key={match.id} className="bg-[#0a1428] rounded-2xl border border-yellow-400/30 flex items-center shadow-md overflow-hidden hover:border-yellow-400 transition-colors">
                              <div className="bg-yellow-400 text-black font-black w-10 h-full flex items-center justify-center text-xl shrink-0">{match.id}</div>
                              <div className="flex-1 p-3 flex flex-col"><div className="text-emerald-400 font-bold text-sm text-center bg-[#13213a] rounded-lg py-1 mb-1">{standingsYouth.length >= match.r1 ? standingsYouth[match.r1-1].team : match.l1}</div><div className="text-center text-yellow-500 font-black text-xs my-1">VS</div><div className="text-cyan-300 font-bold text-sm text-center bg-[#13213a] rounded-lg py-1 mt-1">الفائز من م {match.m2}</div></div>
                           </div>
                         ))}
                       </div>
                     </div>
                  </div>
                  <div className="bg-[#13213a] p-4 sm:p-6 rounded-3xl border border-sky-500/30 shadow-lg">
                     <div className="text-center mb-8"><Badge className="bg-sky-500 text-white text-xl px-8 py-2 font-black shadow-lg border-2 border-[#13213a]">مباريات الملحق</Badge></div>
                     <div className="grid md:grid-cols-2 gap-4">
                       {[ { id: 97, r1: 9, r2: 24, l1: "تاسع الترتيب", l2: "الرابع والعشرون" }, { id: 98, r1: 10, r2: 23, l1: "عاشر الترتيب", l2: "الثالث والعشرون" }, { id: 99, r1: 11, r2: 22, l1: "الحادي عشر", l2: "الثاني والعشرون" }, { id: 100, r1: 12, r2: 21, l1: "الثاني عشر", l2: "الواحد والعشرون" }, { id: 101, r1: 13, r2: 20, l1: "الثالث عشر", l2: "العشرون" }, { id: 102, r1: 14, r2: 19, l1: "الرابع عشر", l2: "التاسع عشر" }, { id: 103, r1: 15, r2: 18, l1: "الخامس عشر", l2: "الثامن عشر" }, { id: 104, r1: 16, r2: 17, l1: "السادس عشر", l2: "السابع عشر" } ].map(match => (
                         <div key={match.id} className="bg-[#1e2a4a] rounded-xl flex items-center justify-between p-2 border border-white/5 hover:border-sky-400/50 transition-colors"><div className="flex-1 text-center font-bold text-white text-sm">{standingsYouth.length >= match.r1 ? standingsYouth[match.r1-1].team : match.l1}</div><div className="bg-[#0a1428] border border-sky-500/30 px-3 py-1 rounded-lg text-sky-400 font-black text-xs mx-2">م {match.id}</div><div className="flex-1 text-center font-bold text-gray-300 text-sm">{standingsYouth.length >= match.r2 ? standingsYouth[match.r2-1].team : match.l2}</div></div>
                       ))}
                     </div>
                  </div>
                </>
              )}

              <div className={`${activeTournament === 'youth' ? 'mt-12 border-t border-yellow-400/20 pt-10' : ''}`}>
                <h3 className="text-2xl font-black text-center text-yellow-300 mb-8">إدارة مباريات الإقصاء ({activeTournament === 'youth' ? 'الشباب' : 'الناشئين'})</h3>
                {["النهائي", "نصف النهائي", "دور الثمانية", "دور الستة عشر", "الملحق"].map((roundName) => {
                  const roundMatches = sortMatches(matches.filter(m => m.round === roundName));
                  if (roundMatches.length === 0) return null;
                  return (
                    <div key={roundName} className="mb-8"><div className="flex justify-center mb-4"><Badge className="bg-white/10 text-yellow-300 text-lg px-6 py-1 border border-yellow-400/30">{roundName}</Badge></div><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {roundMatches.map(match => (
                          <div key={match.id} className="bg-[#1e2a4a] p-4 rounded-2xl flex flex-col justify-between gap-4 border border-yellow-400/30 shadow-md">
                            <div>
                               <div className="font-bold text-white text-center text-lg">{match.teamA} <span className="text-yellow-400 mx-2">{match.homeGoals} - {match.awayGoals}</span> {match.teamB}</div>
                               <div className="text-cyan-300 text-center mt-2 text-sm font-bold">{getArabicDay(match.date)} • {match.date} • {match.status || match.time}</div>
                            </div>
                            <div className="flex gap-2 justify-center flex-wrap mt-2 pt-3 border-t border-white/10">
                               <Button size="sm" onClick={() => { updateMatchLive(match.id, { isLive: true, status: match.status || "ستبدأ بعد قليل", liveMinute: match.liveMinute || 0 }); setActiveTab("live"); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="bg-red-600 hover:bg-red-700 text-white flex-1"><Play className="ml-1 h-4 w-4" /> بث</Button>
                               <Button size="sm" onClick={() => startEdit(match)} className="bg-yellow-400 text-black flex-1"><Edit className="ml-1 h-4 w-4" /> تعديل</Button>
                               <Button size="sm" onClick={() => deleteMatch(match.id)} variant="destructive" className="flex-1"><Trash2 className="ml-1 h-4 w-4" /> حذف</Button>
                            </div>
                          </div>
                        ))}
                      </div></div>
                  )
                })}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="predictions">
            <Card className="border-yellow-400 bg-[#13213a]">
              <CardHeader className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-white/10 pb-4">
                <CardTitle className="text-yellow-300 flex items-center gap-2"><Gift /> توقعات الجماهير ({activeTournament === 'youth' ? 'الشباب' : 'الناشئين'})</CardTitle>
                <Button variant="destructive" onClick={deleteAllPredictions} className="font-bold"><Trash2 className="ml-2 h-4 w-4"/> مسح كل التوقعات القديمة</Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-white min-w-[600px]">
                    <thead className="bg-[#1e2a4a]"><tr><th className="p-4 text-cyan-300 font-bold">المباراة</th><th className="p-4 text-cyan-300 font-bold">اسم المشجع</th><th className="p-4 text-cyan-300 font-bold">الهاتف</th><th className="p-4 text-cyan-300 font-bold text-center">التوقع</th><th className="p-4"></th></tr></thead>
                    <tbody>
                      {predictions.map(p => (
                        <tr key={p.id} className="border-b border-white/5 hover:bg-white/5"><td className="p-4 font-bold">{p.matchName}</td><td className="p-4">{p.name}</td><td className="p-4 text-yellow-400 font-mono tracking-wider">{p.phone}</td><td className="p-4 text-center"><Badge className="bg-emerald-500 text-white text-lg px-3 py-1 font-black">{p.homeScore} - {p.awayScore}</Badge></td><td className="p-4 text-left"><Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-900/50" onClick={() => deletePrediction(p.id)}><Trash2 className="h-5 w-5"/></Button></td></tr>
                      ))}
                    </tbody>
                  </table>
                  {predictions.length === 0 && <div className="text-center py-16 text-gray-500 font-bold text-xl">لا توجد أي توقعات حتى الآن</div>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notify">
            <Card className="border-yellow-400 bg-gradient-to-br from-[#1e2a4a] to-[#13213a] shadow-2xl">
              <CardHeader className="text-center pb-2"><BellRing className="mx-auto h-12 w-12 text-yellow-400 mb-4 animate-bounce" /><CardTitle className="text-3xl font-black text-yellow-300">إرسال إشعار عاجل 🚀</CardTitle></CardHeader>
              <CardContent className="p-6 md:p-10 space-y-6 max-w-3xl mx-auto">
                <div><label className="block text-sm font-bold text-gray-400 mb-2">عنوان الإشعار</label><Input value={notifyTitle} onChange={e => setNotifyTitle(e.target.value)} placeholder="مثال: ⚽ جووووول قاتل!" className="text-xl bg-[#0a1428] border-yellow-400/50 text-white p-6 font-bold" /></div>
                <div><label className="block text-sm font-bold text-gray-400 mb-2">تفاصيل الإشعار</label><Input value={notifyBody} onChange={e => setNotifyBody(e.target.value)} placeholder="مثال: النجيلة يسجل الهدف الأول..." className="text-lg bg-[#0a1428] border-yellow-400/50 text-white p-6" /></div>
                <Button onClick={sendNotification} disabled={isSending} className="w-full bg-yellow-400 text-black py-8 font-black text-2xl hover:bg-yellow-500 hover:scale-[1.02] shadow-[0_0_20px_rgba(250,204,21,0.3)] mt-8">{isSending ? "جاري الإرسال..." : "إرسال الإشعار الآن 🚀"}</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="media">
            <Card className="border-emerald-500 bg-[#13213a]">
              <CardHeader><CardTitle className="text-emerald-400 flex items-center gap-2"><Video /> المركز الإعلامي للفيديوهات ({activeTournament === 'youth' ? 'الشباب' : 'الناشئين'})</CardTitle></CardHeader>
              <CardContent className="space-y-6 p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-[#1e2a4a] rounded-2xl"><Input value={mediaForm.title} onChange={e => setMediaForm(p => ({...p, title: e.target.value}))} placeholder="عنوان الفيديو" className="bg-[#0a1428] border-emerald-500 text-white" /><Input value={mediaForm.url} onChange={e => setMediaForm(p => ({...p, url: e.target.value}))} placeholder="رابط اليوتيوب" className="bg-[#0a1428] border-emerald-500 text-white" /><Button onClick={addMedia} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold h-full">إضافة للفيديو</Button></div>
                <div className="space-y-3">{mediaItems.map(item => (<div key={item.id} className="bg-[#1e2a4a] p-4 rounded-2xl flex justify-between items-center border border-emerald-500/30"><div><div className="font-bold text-white text-lg">{item.title}</div><a href={item.url} target="_blank" className="text-cyan-300 text-sm hover:underline">{item.url}</a></div><Button size="sm" variant="destructive" onClick={() => deleteMedia(item.id)}><Trash2 className="h-4 w-4" /></Button></div>))}</div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="live" className="space-y-6">
            {matches.filter(m => m.isLive).length === 0 && (<Card className="border-yellow-400 bg-[#13213a] border-dashed"><CardContent className="p-16 text-center"><p className="text-xl text-cyan-300 mb-4">لا توجد مباريات جارية الآن ({activeTournament === 'youth' ? 'الشباب' : 'الناشئين'})</p></CardContent></Card>)}
            {matches.filter(m => m.isLive).map(match => (
              <Card key={match.id} className={`bg-[#1e2a4a] border-2 ${match.status === 'ستبدأ بعد قليل' ? 'border-emerald-500/80 shadow-[0_0_30px_rgba(16,185,129,0.2)]' : 'border-red-500/80 shadow-[0_0_30px_rgba(239,68,68,0.2)]'} overflow-hidden`}>
                <div className={`${match.status === 'ستبدأ بعد قليل' ? 'bg-emerald-600' : 'bg-red-600'} text-white px-6 py-3 flex flex-wrap justify-between items-center gap-4`}>
                  <div className="flex items-center gap-4">
                    <span className={`font-black text-lg ${match.status === 'ستبدأ بعد قليل' ? '' : 'animate-pulse'}`}>{match.status === 'ستبدأ بعد قليل' ? '🟩' : '🔴'} {match.teamA} ضد {match.teamB}</span>
                    <select value={match.status || "الشوط الأول"} onChange={(e) => updateMatchLive(match.id, { status: e.target.value })} className="bg-black/40 border-none text-white font-bold rounded-lg px-3 py-1 text-sm outline-none cursor-pointer"><option value="ستبدأ بعد قليل">ستبدأ بعد قليل</option><option value="الشوط الأول">الشوط الأول</option><option value="استراحة">استراحة</option><option value="الشوط الثاني">الشوط الثاني</option><option value="وقت إضافي">وقت إضافي</option><option value="ضربات جزاء">ضربات جزاء</option><option value="انتهت">انتهت</option></select>
                  </div>
                  <Button size="sm" variant="outline" className="bg-white/10 text-white border-white/20 hover:bg-white/20 hover:text-white" onClick={() => updateMatchLive(match.id, { isLive: false })}>إغلاق البث</Button>
                </div>
                <CardContent className="p-6">
                  <div className="flex justify-center items-center gap-6 mb-8 bg-[#13213a] p-4 rounded-2xl border border-white/5 flex-wrap">
                    <Button onClick={() => updateMatchLive(match.id, { isTimerRunning: !match.isTimerRunning })} className={`font-bold h-12 px-6 ${match.isTimerRunning ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}>{match.isTimerRunning ? <><Pause className="mr-2 h-5 w-5" /> إيقاف التايمر</> : <><Play className="mr-2 h-5 w-5" /> تشغيل التايمر</>}</Button>
                    <div className="flex items-center gap-3"><label className="text-gray-400 font-bold">الدقيقة:</label><Input type="number" value={match.liveMinute || 0} onChange={(e) => updateMatchLive(match.id, { liveMinute: Number(e.target.value) })} className="w-24 text-center text-2xl font-black bg-black border-yellow-400 text-yellow-400" /></div>
                  </div>
                  <div className="grid md:grid-cols-3 gap-8 items-center mb-8"><div className="text-center bg-[#13213a] p-6 rounded-3xl border border-white/5 relative"><h3 className="text-2xl font-bold text-white mb-6">{match.teamA}</h3><div className="flex items-center justify-center gap-4 mb-6"><Button variant="outline" className="h-12 w-12 rounded-full border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-black" onClick={() => updateMatchLive(match.id, { homeGoals: (match.homeGoals || 0) + 1 })}><Plus /></Button><span className="text-7xl font-black text-white w-20">{match.homeGoals || 0}</span><Button variant="outline" className="h-12 w-12 rounded-full border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-black" onClick={() => updateMatchLive(match.id, { homeGoals: Math.max(0, (match.homeGoals || 0) - 1) })}><Minus /></Button></div><div className="flex justify-center items-center gap-2 bg-red-500/10 py-2 rounded-xl border border-red-500/20"><span className="text-red-500 font-bold">طرد:</span><Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-white" onClick={() => updateMatchLive(match.id, { redCardsHome: Math.max(0, (match.redCardsHome || 0) - 1) })}><Minus className="h-4 w-4" /></Button><span className="font-bold text-xl text-red-500">{match.redCardsHome || 0}</span><Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-white" onClick={() => updateMatchLive(match.id, { redCardsHome: (match.redCardsHome || 0) + 1 })}><Plus className="h-4 w-4" /></Button></div></div><div className="text-center text-yellow-400 font-black text-4xl hidden md:block">VS</div><div className="text-center bg-[#13213a] p-6 rounded-3xl border border-white/5 relative"><h3 className="text-2xl font-bold text-white mb-6">{match.teamB}</h3><div className="flex items-center justify-center gap-4 mb-6"><Button variant="outline" className="h-12 w-12 rounded-full border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-black" onClick={() => updateMatchLive(match.id, { awayGoals: (match.awayGoals || 0) + 1 })}><Plus /></Button><span className="text-7xl font-black text-white w-20">{match.awayGoals || 0}</span><Button variant="outline" className="h-12 w-12 rounded-full border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-black" onClick={() => updateMatchLive(match.id, { awayGoals: Math.max(0, (match.awayGoals || 0) - 1) })}><Minus /></Button></div><div className="flex justify-center items-center gap-2 bg-red-500/10 py-2 rounded-xl border border-red-500/20"><span className="text-red-500 font-bold">طرد:</span><Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-white" onClick={() => updateMatchLive(match.id, { redCardsAway: Math.max(0, (match.redCardsAway || 0) - 1) })}><Minus className="h-4 w-4" /></Button><span className="font-bold text-xl text-red-500">{match.redCardsAway || 0}</span><Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-white" onClick={() => updateMatchLive(match.id, { redCardsAway: (match.redCardsAway || 0) + 1 })}><Plus className="h-4 w-4" /></Button></div></div></div>
                  {match.status === "ضربات جزاء" && (<div className="bg-[#13213a] border border-yellow-400/30 p-6 rounded-3xl mt-6"><div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4"><h4 className="text-xl font-bold text-yellow-400">إدارة ضربات الترجيح</h4><Button size="sm" variant="outline" onClick={() => addPenaltySlot(match.id)} className="border-cyan-400 text-cyan-400 hover:bg-cyan-400 hover:text-black"><Plus className="ml-2 h-4 w-4" /> إضافة ركلة إضافية</Button></div><div className="flex flex-col md:flex-row justify-between items-center bg-[#0a1428] p-4 rounded-xl gap-6"><div className="flex gap-2 flex-wrap justify-center">{(match.penaltiesHome || ['none','none','none','none','none']).map((p:string, i:number) => (<button key={i} onClick={() => togglePenalty(match.id, 'home', i, p)} className={`w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center ${p === 'scored' ? 'bg-emerald-500 border-emerald-400' : p === 'missed' ? 'bg-red-500 border-red-400' : 'bg-[#1e2a4a] border-gray-600'}`}>{p === 'scored' && <span className="text-white font-bold">✔</span>}{p === 'missed' && <span className="text-white font-bold">✖</span>}</button>))}</div><div className="text-3xl font-black text-yellow-400 bg-[#1e2a4a] px-6 py-2 rounded-xl">{(match.penaltiesHome || []).filter((p:string) => p === 'scored').length} - {(match.penaltiesAway || []).filter((p:string) => p === 'scored').length}</div><div className="flex gap-2 flex-wrap justify-center">{(match.penaltiesAway || ['none','none','none','none','none']).map((p:string, i:number) => (<button key={i} onClick={() => togglePenalty(match.id, 'away', i, p)} className={`w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center ${p === 'scored' ? 'bg-emerald-500 border-emerald-400' : p === 'missed' ? 'bg-red-500 border-red-400' : 'bg-[#1e2a4a] border-gray-600'}`}>{p === 'scored' && <span className="text-white font-bold">✔</span>}{p === 'missed' && <span className="text-white font-bold">✖</span>}</button>))}</div></div></div>)}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="all"><Card className="border-yellow-400 bg-[#13213a]"><CardHeader className="flex flex-col sm:flex-row justify-between gap-4"><CardTitle className="text-yellow-300">المباريات السابقة</CardTitle><Input placeholder="ابحث عن فريق..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-sm border-yellow-400 bg-[#1e2a4a] text-white" /></CardHeader><CardContent className="space-y-3">{matches.filter(m => !m.isLive && (String(m.teamA || "").includes(searchTerm) || String(m.teamB || "").includes(searchTerm))).map(m => (<div key={m.id} className="bg-[#1e2a4a] p-4 rounded-2xl flex flex-col sm:flex-row justify-between gap-4 border border-yellow-400/30"><div><div className="font-bold text-white">{m.teamA} <span className="text-yellow-400 mx-1">{m.homeGoals} - {m.awayGoals}</span> {m.teamB}</div><div className="text-cyan-300 text-sm">{getArabicDay(m.date)} • {m.date} • {m.status || m.time}</div></div><div className="flex gap-2 flex-wrap"><Button size="sm" onClick={() => { updateMatchLive(m.id, { isLive: true, status: m.status || "ستبدأ بعد قليل", liveMinute: m.liveMinute || 0 }); setActiveTab("live"); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="bg-red-600 hover:bg-red-700 text-white"><Play className="ml-1 h-4 w-4" /> بث</Button><Button size="sm" onClick={() => startEdit(m)} className="bg-yellow-400 text-black"><Edit className="ml-1 h-4 w-4" /> تعديل</Button><Button size="sm" onClick={() => deleteMatch(m.id)} variant="destructive"><Trash2 className="ml-1 h-4 w-4" /> حذف</Button></div></div>))}</CardContent></Card></TabsContent>
          <TabsContent value="today"><Card className="border-yellow-400 bg-[#13213a]"><CardHeader><CardTitle className="text-yellow-300">مباريات اليوم</CardTitle></CardHeader><CardContent className="space-y-3">{matches.filter(m => m.date === todayStr && !m.isLive && m.status !== "انتهت").map(m => (<div key={m.id} className="bg-[#1e2a4a] p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-center border-l-4 border-yellow-400 gap-4"><div><div className="font-bold text-white">{m.teamA} vs {m.teamB}</div><div className="text-cyan-300 text-sm">{m.time}</div></div><div className="flex gap-2"><Button size="sm" onClick={() => { updateMatchLive(m.id, { isLive: true, status: "ستبدأ بعد قليل", liveMinute: 0 }); setActiveTab("live"); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="bg-emerald-600 text-white hover:bg-emerald-700"><Play className="ml-1 h-4 w-4" /> ابدأ البث</Button><Button size="sm" onClick={() => startEdit(m)} className="bg-yellow-400 text-black">تعديل النتيجة</Button><Button size="sm" onClick={() => deleteMatch(m.id)} variant="destructive">حذف</Button></div></div>))}</CardContent></Card></TabsContent>
          <TabsContent value="tomorrow"><Card className="border-yellow-400 bg-[#13213a]"><CardHeader><CardTitle className="text-yellow-300">مباريات غداً</CardTitle></CardHeader><CardContent className="space-y-3">{matches.filter(m => m.date === tomorrowStr && !m.isLive).map(m => (<div key={m.id} className="bg-[#1e2a4a] p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4 border-l-4 border-sky-400"><div><div className="font-bold text-white">{m.teamA} vs {m.teamB}</div><div className="text-cyan-300 text-sm">{m.time}</div></div><div className="flex gap-2"><Button size="sm" onClick={() => startEdit(m)} className="bg-yellow-400 text-black">تعديل</Button><Button size="sm" onClick={() => deleteMatch(m.id)} variant="destructive">حذف</Button></div></div>))}</CardContent></Card></TabsContent>
          
          <TabsContent value="goals">
            <Card className="border-yellow-400 bg-[#13213a]">
              <CardHeader><CardTitle className="text-yellow-300">إدارة الأهداف ({activeTournament === 'youth' ? 'الشباب' : 'الناشئين'})</CardTitle><Input placeholder="ابحث عن لاعب أو فريق..." value={goalSearchTerm} onChange={(e) => setGoalSearchTerm(e.target.value)} className="mt-4 max-w-md border-yellow-400 bg-[#1e2a4a] text-white" /></CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className={`grid grid-cols-1 md:grid-cols-5 gap-4 p-4 bg-[#1e2a4a] rounded-2xl border ${activeTournament === 'juniors' ? 'border-cyan-500/30' : 'border-yellow-400/30'}`}>
                  <Input value={goalForm.player} onChange={e => setGoalForm(p => ({...p, player: e.target.value}))} placeholder="اسم اللاعب" className="bg-[#0a1428] border-yellow-400 text-white" />
                  <select value={goalForm.team} onChange={e => setGoalForm(p => ({...p, team: e.target.value}))} className="bg-[#0a1428] border border-yellow-400 rounded-2xl p-3 text-white">{currentTeamsList.map(t => <option key={t} value={t}>{t}</option>)}</select>
                  <Input type="number" value={goalForm.goalsCount} onChange={e => setGoalForm(p => ({...p, goalsCount: Number(e.target.value)}))} placeholder="عدد الأهداف" className="bg-[#0a1428] border-yellow-400 text-white" />
                  <Input value={goalForm.imageUrl} onChange={e => setGoalForm(p => ({...p, imageUrl: e.target.value}))} placeholder="رابط صورة اللاعب (اختياري)" className="bg-[#0a1428] border-yellow-400 text-white" />
                  <Button onClick={addOrUpdateGoal} className={`font-black h-full transition-all ${activeTournament === 'juniors' ? 'bg-cyan-500 text-white hover:bg-cyan-600' : 'bg-yellow-400 text-black hover:bg-yellow-500'}`}>{editingGoalId ? "تعديل الهدف" : "إضافة الهدف"}</Button>
                </div>
                <div className="space-y-3">{filteredGoals.map(goal => (<Card key={goal.id} className="bg-[#1e2a4a] border border-white/10"><CardContent className="p-4 flex justify-between items-center text-white"><div className="flex items-center gap-4">{goal.imageUrl ? <img src={goal.imageUrl} className="h-10 w-10 rounded-full object-cover border border-yellow-400" /> : <div className="h-10 w-10 rounded-full bg-[#0a1428] flex items-center justify-center text-xl">👤</div>}<div><div className="font-bold">{goal.player}</div><div className="text-cyan-300 text-sm">{goal.team} — {goal.goals} هدف</div></div></div><div className="flex gap-2"><Button size="sm" onClick={() => startEditGoal(goal)} className="bg-yellow-400 text-black"><Edit className="ml-2 h-4 w-4" /> تعديل</Button><Button size="sm" variant="destructive" onClick={() => deleteGoal(goal.id)}><Trash2 className="ml-2 h-4 w-4" /> حذف</Button></div></CardContent></Card>))}</div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="cards">
            <Card className="border-yellow-400 bg-[#13213a]">
              <CardHeader><CardTitle className="text-yellow-300">إدارة الإنذارات ({activeTournament === 'youth' ? 'الشباب' : 'الناشئين'})</CardTitle><Input placeholder="ابحث عن لاعب..." value={cardSearchTerm} onChange={(e) => setCardSearchTerm(e.target.value)} className="mt-4 max-w-md border-yellow-400 bg-[#1e2a4a] text-white" /></CardHeader>
              <CardContent className="space-y-6 p-6">
                <div className={`grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-[#1e2a4a] rounded-2xl border ${activeTournament === 'juniors' ? 'border-cyan-500/30' : 'border-yellow-400/30'}`}>
                  <Input value={cardForm.player} onChange={e => setCardForm(p => ({...p, player: e.target.value}))} placeholder="اسم اللاعب" className="bg-[#0a1428] border-yellow-400 text-white" />
                  <select value={cardForm.team} onChange={e => setCardForm(p => ({...p, team: e.target.value}))} className="bg-[#0a1428] border border-yellow-400 rounded-2xl p-3 text-white">{currentTeamsList.map(t => <option key={t} value={t}>{t}</option>)}</select>
                  <select value={cardForm.type} onChange={e => setCardForm(p => ({...p, type: e.target.value as "yellow" | "red"}))} className="bg-[#0a1428] border border-yellow-400 rounded-2xl p-3 text-white"><option value="yellow">إنذار أصفر</option><option value="red">بطاقة حمراء</option></select>
                  <Button onClick={addCard} className={`font-black transition-all ${activeTournament === 'juniors' ? 'bg-cyan-500 text-white hover:bg-cyan-600' : 'bg-yellow-400 text-black hover:bg-yellow-500'}`}>تسجيل البطاقة</Button>
                </div>
                <div className="space-y-3">{filteredCards.map(item => (<Card key={item.id} className="bg-[#1e2a4a] border border-white/10"><CardContent className="p-4 flex flex-col sm:flex-row justify-between items-center gap-4 text-white"><div><div className="font-bold text-lg">{item.player}</div><div className="text-cyan-300">{item.team}</div></div><div className="flex items-center gap-6"><div className="flex items-center gap-2"><Button size="sm" variant="outline" onClick={() => updateCard(item.id, Math.max(0, item.yellow - 1), item.red)} className="border-yellow-400 text-white"><Minus className="h-4 w-4" /></Button><span className="px-4 py-1 bg-yellow-400/20 text-yellow-300 font-bold rounded">🟨 {item.yellow}</span><Button size="sm" variant="outline" onClick={() => updateCard(item.id, item.yellow + 1, item.red)} className="border-yellow-400 text-white"><Plus className="h-4 w-4" /></Button></div><div className="flex items-center gap-2"><Button size="sm" variant="outline" onClick={() => updateCard(item.id, item.yellow, Math.max(0, item.red - 1))} className="border-red-400 text-white"><Minus className="h-4 w-4" /></Button><span className="px-4 py-1 bg-red-500/20 text-red-300 font-bold rounded">🟥 {item.red}</span><Button size="sm" variant="outline" onClick={() => updateCard(item.id, item.yellow, item.red + 1)} className="border-red-400 text-white"><Plus className="h-4 w-4" /></Button></div><Button size="sm" variant="destructive" onClick={() => deleteCard(item.id)}><Trash2 className="h-4 w-4" /></Button></div></CardContent></Card>))}</div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="ticker"><Card className="border-yellow-400 bg-[#13213a]"><CardHeader><CardTitle className="text-yellow-300">شريط الأخبار العام</CardTitle></CardHeader><CardContent className="p-6 space-y-6"><Input value={tickerText} onChange={e => setTickerText(e.target.value)} placeholder="اكتب الخبر هنا..." className="py-8 text-lg bg-[#1e2a4a] border-yellow-400 text-white" /><Button onClick={saveTicker} className="w-full bg-yellow-400 text-black py-7 font-bold">حفظ ونشر الخبر</Button></CardContent></Card></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
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

const SPONSORS_LIST = [
  { name: "الفهد للديكور", src: "/alfahd.png" }, { name: "مكتب احمد عبدالعاطي المحامي", src: "/abdelaty.png" }, { name: "دثار للزي العربي", src: "/dithar.png" },
  { name: "معصرة فرجينيا", src: "/virginia.png" }, { name: "دبي للزي العربي", src: "/dubai.png" }, { name: "معرض الأمانة", src: "/alamana.png" },
  { name: "تراث البادية", src: "/torath.png" }, { name: "عبدالمقصود ستورز", src: "/abdelmaksoud.png" }, { name: "مياة حياة", src: "/hayah.png" },
  { name: "القدس للأثاث", src: "/alquds.png" }, { name: "أيس كريم الملكة", src: "/almaleka.png" }, { name: "جزارة عبدالله الجراري", src: "/aljarari.png" },
  { name: "M MART", src: "/mmart.png" }, { name: "هيرو سبورت", src: "/hero-sport.png" }, { name: "الفتح للفراشة", src: "/alfath.png" }, { name: "عادل العميري للديكور", src: "/alomairy.png" }
];

export default function AdminPage() {
  const [isAuth, setIsAuth] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [activeTab, setActiveTab] = useState("live");

  const [matches, setMatches] = useState<any[]>([]);
  const matchesRef = useRef<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [cardEvents, setCardEvents] = useState<any[]>([]);
  const [motmList, setMotmList] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [mediaItems, setMediaItems] = useState<any[]>([]);
  const [tickerText, setTickerText] = useState("");

  const [matchForm, setMatchForm] = useState({ teamA: CLEANED_TEAM_NAMES[0], teamB: CLEANED_TEAM_NAMES[1], homeGoals: 0, awayGoals: 0, round: "الجولة الأولى", date: new Date().toISOString().slice(0, 10), time: "15:30", status: "لم تبدأ" });
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [motmForm, setMotmForm] = useState({ player: "", team: CLEANED_TEAM_NAMES[0], sponsorName: SPONSORS_LIST[0].name, imageUrl: "" });
  const [editingMotmId, setEditingMotmId] = useState<string | null>(null);

  const [goalForm, setGoalForm] = useState({ player: "", team: CLEANED_TEAM_NAMES[0], goalsCount: 1, imageUrl: "" });
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  
  const [cardForm, setCardForm] = useState({ player: "", team: CLEANED_TEAM_NAMES[0], type: "yellow" as "yellow" | "red" });
  const [mediaForm, setMediaForm] = useState({ title: "", url: "" });
  
  const [searchTerm, setSearchTerm] = useState("");
  const [goalSearchTerm, setGoalSearchTerm] = useState("");
  const [cardSearchTerm, setCardSearchTerm] = useState("");

  const [notifyTitle, setNotifyTitle] = useState("");
  const [notifyBody, setNotifyBody] = useState("");
  const [isSending, setIsSending] = useState(false);

  const sortedTeams = useMemo(() => [...CLEANED_TEAM_NAMES].sort((a, b) => a.localeCompare(b, "ar")), []);

  const now = new Date();
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
  const tomorrowStr = new Date(now.getTime() + 86400000).toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });

  useEffect(() => { matchesRef.current = matches; }, [matches]);

  useEffect(() => { 
    if (!isAuth) return;
    const unsubMatches = onSnapshot(collection(db, "matches"), snap => { setMatches(snap.docs.map(d => ({ id: d.id, ...d.data(), teamA: cleanTeamString(d.data().teamA || d.data().home), teamB: cleanTeamString(d.data().teamB || d.data().away) }))); });
    const unsubGoals = onSnapshot(collection(db, "goals"), snap => setGoals(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubCards = onSnapshot(collection(db, "cards"), snap => setCardEvents(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubMotm = onSnapshot(collection(db, "motm"), snap => setMotmList(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubPreds = onSnapshot(collection(db, "predictions"), snap => setPredictions(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubMedia = onSnapshot(collection(db, "media"), snap => setMediaItems(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubTicker = onSnapshot(doc(db, "settings", "ticker"), snap => setTickerText(snap.data()?.text || ""));
    const timer = setInterval(() => { matchesRef.current.forEach(m => { if (m.isTimerRunning && m.isLive && m.status !== "ستبدأ بعد قليل" && m.status !== "استراحة" && m.status !== "انتهت" && m.status !== "ضربات جزاء") updateDoc(doc(db, "matches", m.id), { liveMinute: (m.liveMinute || 0) + 1 }); }); }, 60000);
    return () => { unsubMatches(); unsubGoals(); unsubCards(); unsubMotm(); unsubPreds(); unsubMedia(); unsubTicker(); clearInterval(timer); };
  }, [isAuth]);

  const handleLogin = () => passwordInput === ADMIN_PASSWORD ? setIsAuth(true) : alert("خطأ في كلمة السر!");

  const saveMatch = async () => {
    if (matchForm.teamA === matchForm.teamB) return alert("اختر فريقين مختلفين");
    const dayName = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"][new Date(matchForm.date).getDay()];
    const data = { ...matchForm, dayName, isLive: false };
    if (editingId) { await updateDoc(doc(db, "matches", editingId), data); setEditingId(null); } 
    else { await addDoc(collection(db, "matches"), data); }
    setMatchForm({ teamA: CLEANED_TEAM_NAMES[0], teamB: CLEANED_TEAM_NAMES[1], homeGoals: 0, awayGoals: 0, round: "الجولة الأولى", date: new Date().toISOString().slice(0, 10), time: "15:30", status: "لم تبدأ" });
    alert("✅ تم الحفظ بنجاح");
  };

  const startEdit = (match: any) => { setEditingId(match.id); setMatchForm({ teamA: match.teamA, teamB: match.teamB, homeGoals: match.homeGoals, awayGoals: match.awayGoals, round: match.round, date: match.date, time: match.time, status: match.status || "لم تبدأ" }); };
  const deleteMatch = async (id: string) => confirm("متأكد من الحذف؟") && await deleteDoc(doc(db, "matches", id));
  const updateMatchLive = async (id: string, updates: any) => await updateDoc(doc(db, "matches", id), updates);

  const togglePenalty = async (matchId: string, team: 'home' | 'away', index: number, current: string) => {
    const field = team === 'home' ? 'penaltiesHome' : 'penaltiesAway';
    const match = matches.find(m => m.id === matchId);
    let arr = match?.[field] || ['none','none','none','none','none'];
    let next = current === 'none' ? 'scored' : current === 'scored' ? 'missed' : 'none';
    let newArr = [...arr]; newArr[index] = next as any;
    await updateDoc(doc(db, "matches", matchId), { [field]: newArr });
  };
  const addPenaltySlot = async (matchId: string) => {
    const match = matches.find(m => m.id === matchId);
    if(!match) return;
    await updateDoc(doc(db, "matches", matchId), { penaltiesHome: [...(match.penaltiesHome || ['none','none','none','none','none']), 'none'], penaltiesAway: [...(match.penaltiesAway || ['none','none','none','none','none']), 'none'] });
  };

  const addOrUpdateGoal = async () => {
    if (!goalForm.player.trim()) return alert("اكتب اسم اللاعب");
    const playerNameTrimmed = goalForm.player.trim(); const teamSelected = goalForm.team; const goalsToAdd = Number(goalForm.goalsCount); const imageToAdd = goalForm.imageUrl.trim();
    if (editingGoalId) { await updateDoc(doc(db, "goals", editingGoalId), { player: playerNameTrimmed, team: teamSelected, goals: goalsToAdd, imageUrl: imageToAdd }); setEditingGoalId(null); } 
    else { 
      const existingPlayer = goals.find(g => g.player.trim().toLowerCase() === playerNameTrimmed.toLowerCase() && g.team === teamSelected);
      if (existingPlayer) { await updateDoc(doc(db, "goals", existingPlayer.id), { goals: (Number(existingPlayer.goals) || 0) + goalsToAdd, ...(imageToAdd && {imageUrl: imageToAdd}) }); } 
      else { await addDoc(collection(db, "goals"), { player: playerNameTrimmed, team: teamSelected, goals: goalsToAdd, imageUrl: imageToAdd }); }
    }
    setGoalForm({ player: "", team: CLEANED_TEAM_NAMES[0], goalsCount: 1, imageUrl: "" }); alert("✅ تم الحفظ");
  };
  const startEditGoal = (goal: any) => { setEditingGoalId(goal.id); setGoalForm({ player: goal.player, team: goal.team, goalsCount: goal.goals, imageUrl: goal.imageUrl || "" }); };
  const deleteGoal = async (id: string) => confirm("حذف هذا الهدف؟") && await deleteDoc(doc(db, "goals", id));

  const addCard = async () => {
    if (!cardForm.player.trim()) return alert("اكتب اسم اللاعب");
    const existingPlayer = cardEvents.find(c => c.player.trim().toLowerCase() === cardForm.player.trim().toLowerCase() && c.team === cardForm.team);
    if (existingPlayer) { await updateDoc(doc(db, "cards", existingPlayer.id), { yellow: (Number(existingPlayer.yellow) || 0) + (cardForm.type === "yellow" ? 1 : 0), red: (Number(existingPlayer.red) || 0) + (cardForm.type === "red" ? 1 : 0) }); } 
    else { await addDoc(collection(db, "cards"), { player: cardForm.player.trim(), team: cardForm.team, yellow: cardForm.type === "yellow" ? 1 : 0, red: cardForm.type === "red" ? 1 : 0 }); }
    setCardForm(p => ({ ...p, player: "" })); alert("✅ تم تسجيل البطاقة");
  };
  const updateCard = async (id: string, yellow: number, red: number) => await updateDoc(doc(db, "cards", id), { yellow, red });
  const deleteCard = async (id: string) => confirm("حذف هذه البطاقة؟") && await deleteDoc(doc(db, "cards", id));

  const saveMotm = async () => {
    if (!motmForm.player || !motmForm.imageUrl) return alert("الرجاء إدخال اسم اللاعب ورابط الصورة");
    const sponsorObj = SPONSORS_LIST.find(s => s.name === motmForm.sponsorName);
    const data = { ...motmForm, sponsorLogo: sponsorObj?.src || "" };
    if (editingMotmId) { await updateDoc(doc(db, "motm", editingMotmId), data); setEditingMotmId(null); } 
    else { await addDoc(collection(db, "motm"), data); }
    setMotmForm({ player: "", team: CLEANED_TEAM_NAMES[0], sponsorName: SPONSORS_LIST[0].name, imageUrl: "" });
    alert("✅ تم نشر الجائزة بنجاح");
  };
  const deleteMotm = async (id: string) => confirm("حذف هذه الجائزة؟") && await deleteDoc(doc(db, "motm", id));

  const addMedia = async () => {
    if (!mediaForm.title || !mediaForm.url) return alert("اكتب عنوان ورابط الفيديو");
    await addDoc(collection(db, "media"), mediaForm);
    setMediaForm({ title: "", url: "" }); alert("✅ تم إضافة الفيديو بنجاح");
  };
  const deleteMedia = async (id: string) => confirm("حذف هذا الفيديو؟") && await deleteDoc(doc(db, "media", id));

  const saveTicker = async () => {
    if (!tickerText.trim()) return alert("اكتب الخبر أولاً");
    await setDoc(doc(db, "settings", "ticker"), { text: tickerText.trim() }); alert("✅ تم نشر الخبر بنجاح");
  };

  const sendNotification = async () => {
    if (!notifyTitle || !notifyBody) return alert("اكمل البيانات");
    setIsSending(true);
    const snap = await getDocs(collection(db, "subscribers"));
    const tokens = snap.docs.map(d => d.data().token);
    if (tokens.length === 0) { setIsSending(false); return alert("لا يوجد مشتركين"); }
    const res = await fetch("/api/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: notifyTitle, body: notifyBody, tokens }) });
    if (res.ok) { alert("🚀 تم الإرسال للجميع بنجاح!"); setNotifyTitle(""); setNotifyBody(""); }
    setIsSending(false);
  };

  const safeGoalSearch = goalSearchTerm.toLowerCase(); const filteredGoals = goals.filter(g => String(g.player || "").toLowerCase().includes(safeGoalSearch) || String(g.team || "").toLowerCase().includes(safeGoalSearch));
  const safeCardSearch = cardSearchTerm.toLowerCase(); const filteredCards = cardEvents.filter(c => String(c.player || "").toLowerCase().includes(safeCardSearch) || String(c.team || "").toLowerCase().includes(safeCardSearch));

  if (!isAuth) return <div className="min-h-screen bg-[#0a1428] flex items-center justify-center p-4"><Card className="w-full max-w-md border-yellow-400 bg-[#13213a] p-6 text-center"><Trophy className="mx-auto text-yellow-400 h-12 w-12" /><Input type="password" placeholder="كلمة السر" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} className="mt-4 text-center text-xl bg-[#1e2a4a] text-white border-yellow-400" /><Button onClick={handleLogin} className="w-full mt-4 bg-yellow-400 text-black font-bold h-12">دخول</Button></Card></div>;

  return (
    <div dir="rtl" className="min-h-screen bg-[#0a1428] text-white p-4 md:p-8">
      <header className="mb-8 flex justify-between items-center"><h1 className="text-3xl font-black text-yellow-300">لوحة الإدارة</h1><Button onClick={() => setIsAuth(false)} className="bg-red-600">خروج</Button></header>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        
        <TabsList className="flex flex-wrap justify-center bg-[#13213a] border border-yellow-400/50 p-1.5 rounded-2xl mb-8 gap-2 h-auto">
          <TabsTrigger value="live" className="data-[state=active]:bg-red-600 data-[state=active]:text-white font-bold py-2 px-4 rounded-xl text-red-400">مباشر 🔴</TabsTrigger>
          <TabsTrigger value="matches" className="data-[state=active]:bg-black data-[state=active]:text-yellow-300 font-bold py-2 px-4 rounded-xl text-white">إضافة مباراة</TabsTrigger>
          <TabsTrigger value="motm_manage" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white font-bold py-2 px-4 rounded-xl text-emerald-400">رجل المباراة 🌟</TabsTrigger>
          <TabsTrigger value="preds" className="data-[state=active]:bg-yellow-400 data-[state=active]:text-black font-black py-2 px-4 rounded-xl text-yellow-400 border border-yellow-400/30">توقعات 🎁</TabsTrigger>
          <TabsTrigger value="all" className="data-[state=active]:bg-black data-[state=active]:text-yellow-300 font-bold py-2 px-4 rounded-xl text-white">السابقة</TabsTrigger>
          <TabsTrigger value="today" className="data-[state=active]:bg-black data-[state=active]:text-yellow-300 font-bold py-2 px-4 rounded-xl text-white">اليوم</TabsTrigger>
          <TabsTrigger value="tomorrow" className="data-[state=active]:bg-black data-[state=active]:text-yellow-300 font-bold py-2 px-4 rounded-xl text-white">غداً</TabsTrigger>
          <TabsTrigger value="goals" className="data-[state=active]:bg-black data-[state=active]:text-yellow-300 font-bold py-2 px-4 rounded-xl text-white">أهداف</TabsTrigger>
          <TabsTrigger value="cards" className="data-[state=active]:bg-black data-[state=active]:text-yellow-300 font-bold py-2 px-4 rounded-xl text-white">كروت</TabsTrigger>
          <TabsTrigger value="media" className="data-[state=active]:bg-black data-[state=active]:text-yellow-300 font-bold py-2 px-4 rounded-xl text-white">ميديا</TabsTrigger>
          <TabsTrigger value="ticker" className="data-[state=active]:bg-black data-[state=active]:text-yellow-300 font-bold py-2 px-4 rounded-xl text-white">أخبار</TabsTrigger>
          <TabsTrigger value="notify" className="data-[state=active]:bg-yellow-400 data-[state=active]:text-black font-black py-2 px-4 rounded-xl text-yellow-400 bg-black/40 border border-yellow-400/20">إشعارات 🔔</TabsTrigger>
        </TabsList>

        {/* 1. تبويب البث المباشر */}
        <TabsContent value="live" className="space-y-6">
          {matches.filter(m => m.isLive).length === 0 && (<Card className="border-yellow-400 bg-[#13213a] border-dashed"><CardContent className="p-16 text-center"><p className="text-xl text-cyan-300 font-bold">لا توجد مباريات جارية الآن</p></CardContent></Card>)}
          {matches.filter(m => m.isLive).map(match => (
            <Card key={match.id} className={`bg-[#1e2a4a] border-2 ${match.status === 'ستبدأ بعد قليل' ? 'border-emerald-500/80 shadow-[0_0_30px_rgba(16,185,129,0.2)]' : 'border-red-500/80 shadow-[0_0_30px_rgba(239,68,68,0.2)]'} overflow-hidden`}>
              <div className={`${match.status === 'ستبدأ بعد قليل' ? 'bg-emerald-600' : 'bg-red-600'} text-white px-6 py-3 flex flex-wrap justify-between items-center gap-4`}>
                <div className="flex items-center gap-4">
                  <span className={`font-black text-lg ${match.status === 'ستبدأ بعد قليل' ? '' : 'animate-pulse'}`}>
                    {match.status === 'ستبدأ بعد قليل' ? '🟩' : '🔴'} {match.teamA} ضد {match.teamB}
                  </span>
                  <select value={match.status || "الشوط الأول"} onChange={(e) => updateMatchLive(match.id, { status: e.target.value })} className="bg-black/40 border-none text-white font-bold rounded-lg px-3 py-1 text-sm outline-none cursor-pointer">
                    <option value="ستبدأ بعد قليل">ستبدأ بعد قليل</option><option value="الشوط الأول">الشوط الأول</option><option value="استراحة">استراحة</option><option value="الشوط الثاني">الشوط الثاني</option><option value="وقت إضافي">وقت إضافي</option><option value="ضربات جزاء">ضربات جزاء</option><option value="انتهت">انتهت</option>
                  </select>
                </div>
                <Button size="sm" variant="outline" className="bg-white/10 text-white border-white/20 hover:bg-white/20 hover:text-white" onClick={() => updateMatchLive(match.id, { isLive: false })}>إغلاق البث</Button>
              </div>
              <CardContent className="p-6">
                <div className="flex justify-center items-center gap-6 mb-8 bg-[#13213a] p-4 rounded-2xl border border-white/5 flex-wrap">
                  <Button onClick={() => updateMatchLive(match.id, { isTimerRunning: !match.isTimerRunning })} className={`font-bold h-12 px-6 ${match.isTimerRunning ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}>{match.isTimerRunning ? <><Pause className="mr-2 h-5 w-5" /> إيقاف التايمر</> : <><Play className="mr-2 h-5 w-5" /> تشغيل التايمر</>}</Button>
                  <div className="flex items-center gap-3"><label className="text-gray-400 font-bold">الدقيقة:</label><Input type="number" value={match.liveMinute || 0} onChange={(e) => updateMatchLive(match.id, { liveMinute: Number(e.target.value) })} className="w-24 text-center text-2xl font-black bg-black border-yellow-400 text-yellow-400" /></div>
                </div>
                <div className="grid md:grid-cols-3 gap-8 items-center mb-8">
                  <div className="text-center bg-[#13213a] p-6 rounded-3xl border border-white/5 relative"><h3 className="text-2xl font-bold text-white mb-6">{match.teamA}</h3><div className="flex items-center justify-center gap-4 mb-6"><Button variant="outline" className="h-12 w-12 rounded-full border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-black" onClick={() => updateMatchLive(match.id, { homeGoals: (match.homeGoals || 0) + 1 })}><Plus /></Button><span className="text-7xl font-black text-white w-20">{match.homeGoals || 0}</span><Button variant="outline" className="h-12 w-12 rounded-full border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-black" onClick={() => updateMatchLive(match.id, { homeGoals: Math.max(0, (match.homeGoals || 0) - 1) })}><Minus /></Button></div><div className="flex justify-center items-center gap-2 bg-red-500/10 py-2 rounded-xl border border-red-500/20"><span className="text-red-500 font-bold">طرد:</span><Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-white" onClick={() => updateMatchLive(match.id, { redCardsHome: Math.max(0, (match.redCardsHome || 0) - 1) })}><Minus className="h-4 w-4" /></Button><span className="font-bold text-xl text-red-500">{match.redCardsHome || 0}</span><Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-white" onClick={() => updateMatchLive(match.id, { redCardsHome: (match.redCardsHome || 0) + 1 })}><Plus className="h-4 w-4" /></Button></div></div>
                  <div className="text-center text-yellow-400 font-black text-4xl hidden md:block">VS</div>
                  <div className="text-center bg-[#13213a] p-6 rounded-3xl border border-white/5 relative"><h3 className="text-2xl font-bold text-white mb-6">{match.teamB}</h3><div className="flex items-center justify-center gap-4 mb-6"><Button variant="outline" className="h-12 w-12 rounded-full border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-black" onClick={() => updateMatchLive(match.id, { awayGoals: (match.awayGoals || 0) + 1 })}><Plus /></Button><span className="text-7xl font-black text-white w-20">{match.awayGoals || 0}</span><Button variant="outline" className="h-12 w-12 rounded-full border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-black" onClick={() => updateMatchLive(match.id, { awayGoals: Math.max(0, (match.awayGoals || 0) - 1) })}><Minus /></Button></div><div className="flex justify-center items-center gap-2 bg-red-500/10 py-2 rounded-xl border border-red-500/20"><span className="text-red-500 font-bold">طرد:</span><Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-white" onClick={() => updateMatchLive(match.id, { redCardsAway: Math.max(0, (match.redCardsAway || 0) - 1) })}><Minus className="h-4 w-4" /></Button><span className="font-bold text-xl text-red-500">{match.redCardsAway || 0}</span><Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-white" onClick={() => updateMatchLive(match.id, { redCardsAway: (match.redCardsAway || 0) + 1 })}><Plus className="h-4 w-4" /></Button></div></div>
                </div>
                {match.status === "ضربات جزاء" && (<div className="bg-[#13213a] border border-yellow-400/30 p-6 rounded-3xl mt-6"><div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4"><h4 className="text-xl font-bold text-yellow-400">إدارة ركلات الترجيح</h4><Button size="sm" variant="outline" onClick={() => addPenaltySlot(match.id)} className="border-cyan-400 text-cyan-400 hover:bg-cyan-400 hover:text-black"><Plus className="ml-2 h-4 w-4" /> إضافة ركلة إضافية</Button></div><div className="flex flex-col md:flex-row justify-between items-center bg-[#0a1428] p-4 rounded-xl gap-6"><div className="flex gap-2 flex-wrap justify-center">{(match.penaltiesHome || ['none','none','none','none','none']).map((p:string, i:number) => (<button key={i} onClick={() => togglePenalty(match.id, 'home', i, p)} className={`w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center ${p === 'scored' ? 'bg-emerald-500 border-emerald-400' : p === 'missed' ? 'bg-red-500 border-red-400' : 'bg-[#1e2a4a] border-gray-600'}`}>{p === 'scored' && <span className="text-white font-bold">✔</span>}{p === 'missed' && <span className="text-white font-bold">✖</span>}</button>))}</div><div className="text-3xl font-black text-yellow-400 bg-[#1e2a4a] px-6 py-2 rounded-xl">{(match.penaltiesHome || []).filter((p:string) => p === 'scored').length} - {(match.penaltiesAway || []).filter((p:string) => p === 'scored').length}</div><div className="flex gap-2 flex-wrap justify-center">{(match.penaltiesAway || ['none','none','none','none','none']).map((p:string, i:number) => (<button key={i} onClick={() => togglePenalty(match.id, 'away', i, p)} className={`w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center ${p === 'scored' ? 'bg-emerald-500 border-emerald-400' : p === 'missed' ? 'bg-red-500 border-red-400' : 'bg-[#1e2a4a] border-gray-600'}`}>{p === 'scored' && <span className="text-white font-bold">✔</span>}{p === 'missed' && <span className="text-white font-bold">✖</span>}</button>))}</div></div></div>)}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* 2. تبويب إضافة/تعديل مباراة */}
        <TabsContent value="matches">
          <Card className="border-yellow-400 bg-[#13213a] mb-8">
            <CardHeader><CardTitle className="text-yellow-300">{editingId ? "تعديل المباراة المحددة" : "إضافة مباراة جديدة للجدول"}</CardTitle></CardHeader>
            <CardContent className="space-y-6 p-6 text-white">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><select value={matchForm.teamA} onChange={e => setMatchForm(p => ({...p, teamA: e.target.value}))} className="bg-[#1e2a4a] border border-yellow-400 rounded-2xl p-4 text-white font-bold">{sortedTeams.map(t => <option key={t} value={t}>{t}</option>)}</select><div className="flex items-center justify-center text-5xl text-yellow-400 font-black">VS</div><select value={matchForm.teamB} onChange={e => setMatchForm(p => ({...p, teamB: e.target.value}))} className="bg-[#1e2a4a] border border-yellow-400 rounded-2xl p-4 text-white font-bold">{sortedTeams.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-6"><div><label className="block mb-2 text-cyan-300 font-bold">أهداف {matchForm.teamA}</label><Input type="number" value={matchForm.homeGoals} onChange={e => setMatchForm(p => ({...p, homeGoals: Number(e.target.value)}))} className="text-6xl text-center h-20 text-white font-black bg-[#1e2a4a] border-none" /></div><div><label className="block mb-2 text-cyan-300 font-bold">أهداف {matchForm.teamB}</label><Input type="number" value={matchForm.awayGoals} onChange={e => setMatchForm(p => ({...p, awayGoals: Number(e.target.value)}))} className="text-6xl text-center h-20 text-white font-black bg-[#1e2a4a] border-none" /></div></div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <select value={matchForm.round} onChange={e => setMatchForm(p => ({...p, round: e.target.value}))} className="bg-[#1e2a4a] border border-yellow-400 rounded-2xl p-4 text-white">{["الجولة الأولى","الجولة الثانية","الجولة الثالثة","الجولة الرابعة","الملحق","دور الستة عشر","دور الثمانية","نصف النهائي","النهائي"].map(r => <option key={r} value={r}>{r}</option>)}</select>
                <Input type="time" value={matchForm.time} onChange={e => setMatchForm(p => ({...p, time: e.target.value}))} className="text-white bg-[#1e2a4a] border-yellow-400 rounded-2xl p-4" />
                <Input type="date" value={matchForm.date} onChange={e => setMatchForm(p => ({...p, date: e.target.value}))} className="text-white bg-[#1e2a4a] border-yellow-400 rounded-2xl p-4" />
                <select value={matchForm.status} onChange={e => setMatchForm(p => ({...p, status: e.target.value}))} className="bg-[#1e2a4a] border border-red-500 rounded-2xl p-4 text-white font-bold"><option value="لم تبدأ">حالة المباراة: لم تبدأ</option><option value="انتهت">حالة المباراة: انتهت ✔️</option></select>
              </div>
              <Button onClick={saveMatch} className="w-full bg-yellow-400 text-black font-black py-8 text-2xl mt-6 hover:bg-yellow-500">{editingId ? "حفظ التعديلات" : "إضافة المباراة للجدول"}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. تبويب إدارة جوائز رجل المباراة (MOTM) */}
        <TabsContent value="motm_manage">
          <Card className="bg-[#13213a] border-emerald-500 p-6">
            <CardHeader><CardTitle className="text-emerald-400 flex items-center gap-2"><Star/> تصميم كارت رجل المباراة</CardTitle></CardHeader>
            <CardContent className="space-y-6 p-0 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-[#1e2a4a] p-6 rounded-3xl border border-emerald-500/30">
                 <div><label className="text-xs text-gray-400 mb-1 block">اسم اللاعب</label><Input value={motmForm.player} onChange={e => setMotmForm({...motmForm, player: e.target.value})} placeholder="الاسم" className="bg-[#0a1428] border-emerald-500/50 text-white" /></div>
                 <div><label className="text-xs text-gray-400 mb-1 block">الفريق</label><select value={motmForm.team} onChange={e => setMotmForm({...motmForm, team: e.target.value})} className="w-full bg-[#0a1428] border border-emerald-500/50 rounded-xl p-2.5 text-white">{CLEANED_TEAM_NAMES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                 <div><label className="text-xs text-gray-400 mb-1 block">الراعي الرسمي للجائزة</label><select value={motmForm.sponsorName} onChange={e => setMotmForm({...motmForm, sponsorName: e.target.value})} className="w-full bg-[#0a1428] border border-emerald-500/50 rounded-xl p-2.5 text-white">{SPONSORS_LIST.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}</select></div>
                 <div><label className="text-xs text-gray-400 mb-1 block">رابط الصورة (مربعة)</label><Input value={motmForm.imageUrl} onChange={e => setMotmForm({...motmForm, imageUrl: e.target.value})} placeholder="https://..." className="bg-[#0a1428] border-emerald-500/50 text-white" /></div>
                 <Button onClick={saveMotm} className="lg:col-span-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black h-14 text-lg">{editingMotmId ? "تحديث بيانات الجائزة" : "نشر الجائزة في الموقع 🌟"}</Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {motmList.map(m => (
                  <div key={m.id} className="bg-[#1e2a4a] p-4 rounded-2xl flex justify-between items-center border border-white/10 shadow-md">
                    <div className="flex items-center gap-4">
                       <div className="h-14 w-14 rounded-lg overflow-hidden border-2 border-yellow-400"><img src={m.imageUrl} className="h-full w-full object-cover" /></div>
                       <div><div className="font-bold text-white text-lg">{m.player}</div><div className="text-xs text-emerald-400 font-bold">{m.team} • برعاية {m.sponsorName}</div></div>
                    </div>
                    <div className="flex flex-col gap-2">
                       <Button size="sm" variant="outline" className="bg-[#0a1428] border-white/10 hover:bg-white/10" onClick={() => { setEditingMotmId(m.id); setMotmForm({player: m.player, team: m.team, sponsorName: m.sponsorName, imageUrl: m.imageUrl}) }}><Edit className="h-4 w-4" /></Button>
                       <Button size="sm" variant="destructive" onClick={() => deleteMotm(m.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 4. تبويب التوقعات الجماهيرية */}
        <TabsContent value="preds">
          <Card className="bg-[#13213a] border-yellow-400 p-6">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 border-b border-white/10 pb-4">
               <CardTitle className="text-yellow-400 text-2xl flex items-center gap-2"><Gift className="h-6 w-6"/> صندوق توقعات الجماهير</CardTitle>
               <Button variant="destructive" className="font-bold" onClick={async () => { if(confirm("تحذير: سيتم مسح جميع التوقعات السابقة. هل أنت متأكد؟")) predictions.forEach(async p => await deleteDoc(doc(db,"predictions",p.id))) }}><Trash2 className="ml-2 h-4 w-4"/> مسح كل التوقعات لبدء جولة جديدة</Button>
            </div>
            <div className="overflow-x-auto">
               <table className="w-full text-right min-w-[600px]">
                  <thead className="bg-[#1e2a4a]"><tr><th className="p-4 text-cyan-300">المباراة</th><th className="p-4 text-cyan-300">اسم المشجع</th><th className="p-4 text-cyan-300">رقم الهاتف</th><th className="p-4 text-cyan-300 text-center">توقع النتيجة</th><th className="p-4">حذف</th></tr></thead>
                  <tbody>
                    {predictions.map(p => (
                       <tr key={p.id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="p-4 font-bold">{p.matchName}</td>
                          <td className="p-4 font-bold text-white">{p.name}</td>
                          <td className="p-4 text-emerald-400 font-mono text-lg">{p.phone}</td>
                          <td className="p-4 text-center"><Badge className="bg-yellow-400 text-black text-xl px-4 py-1 font-black">{p.homeScore} - {p.awayScore}</Badge></td>
                          <td className="p-4 text-left"><Button size="sm" variant="ghost" className="text-red-500 hover:text-red-400 hover:bg-red-500/10" onClick={async () => await deleteDoc(doc(db,"predictions",p.id))}><Trash2 className="h-5 w-5"/></Button></td>
                       </tr>
                    ))}
                  </tbody>
               </table>
               {predictions.length === 0 && <p className="text-center py-20 text-gray-500 font-bold text-xl">لا توجد توقعات مسجلة حتى الآن</p>}
            </div>
          </Card>
        </TabsContent>

        {/* 5. تبويب المباريات السابقة */}
        <TabsContent value="all">
          <Card className="border-yellow-400 bg-[#13213a]">
             <CardHeader className="flex flex-col sm:flex-row justify-between gap-4"><CardTitle className="text-yellow-300 text-xl">تعديل المباريات السابقة</CardTitle><Input placeholder="ابحث عن فريق للوصول السريع..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-sm border-yellow-400 bg-[#1e2a4a] text-white" /></CardHeader>
             <CardContent className="space-y-4 p-6">
                {matches.filter(m => !m.isLive && (String(m.teamA || "").includes(searchTerm) || String(m.teamB || "").includes(searchTerm))).map(m => (
                   <div key={m.id} className="bg-[#1e2a4a] p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4 border border-yellow-400/30">
                      <div className="text-center sm:text-right">
                         <div className="font-bold text-white text-xl mb-1">{m.teamA} <span className="text-yellow-400 mx-2">{m.homeGoals} - {m.awayGoals}</span> {m.teamB}</div>
                         <div className="text-cyan-300 text-sm font-bold">{m.date} • {m.status || m.time}</div>
                      </div>
                      <div className="flex gap-2 flex-wrap justify-center">
                         <Button size="sm" onClick={() => { updateMatchLive(m.id, { isLive: true, status: m.status || "ستبدأ بعد قليل", liveMinute: m.liveMinute || 0 }); setActiveTab("live"); }} className="bg-red-600 hover:bg-red-700 text-white font-bold"><Play className="ml-1 h-4 w-4" /> بث</Button>
                         <Button size="sm" onClick={() => {startEdit(m); setActiveTab("matches");}} className="bg-yellow-400 text-black font-bold"><Edit className="ml-1 h-4 w-4" /> تعديل</Button>
                         <Button size="sm" onClick={() => deleteMatch(m.id)} variant="destructive" className="font-bold"><Trash2 className="ml-1 h-4 w-4" /> حذف</Button>
                      </div>
                   </div>
                ))}
             </CardContent>
          </Card>
        </TabsContent>

        {/* 6. تبويب مباريات اليوم */}
        <TabsContent value="today">
          <Card className="border-yellow-400 bg-[#13213a]"><CardHeader><CardTitle className="text-yellow-300">مباريات تلعب اليوم ({todayStr})</CardTitle></CardHeader><CardContent className="space-y-4 p-6">{matches.filter(m => m.date === todayStr && !m.isLive && m.status !== "انتهت").map(m => (<div key={m.id} className="bg-[#1e2a4a] p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4 border-l-4 border-yellow-400"><div className="text-center sm:text-right"><div className="font-bold text-white text-xl mb-1">{m.teamA} VS {m.teamB}</div><div className="text-cyan-300 text-sm font-bold">{m.time}</div></div><div className="flex gap-2"><Button size="sm" onClick={() => { updateMatchLive(m.id, { isLive: true, status: "ستبدأ بعد قليل", liveMinute: 0 }); setActiveTab("live"); }} className="bg-emerald-600 text-white hover:bg-emerald-700 font-bold"><Play className="ml-1 h-4 w-4" /> ابدأ البث</Button><Button size="sm" onClick={() => {startEdit(m); setActiveTab("matches");}} className="bg-yellow-400 text-black font-bold">تعديل النتيجة</Button></div></div>))}</CardContent></Card>
        </TabsContent>

        {/* 7. تبويب مباريات غداً */}
        <TabsContent value="tomorrow">
          <Card className="border-yellow-400 bg-[#13213a]"><CardHeader><CardTitle className="text-yellow-300">مباريات تلعب غداً ({tomorrowStr})</CardTitle></CardHeader><CardContent className="space-y-4 p-6">{matches.filter(m => m.date === tomorrowStr && !m.isLive).map(m => (<div key={m.id} className="bg-[#1e2a4a] p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4 border-l-4 border-sky-400"><div className="text-center sm:text-right"><div className="font-bold text-white text-xl mb-1">{m.teamA} VS {m.teamB}</div><div className="text-cyan-300 text-sm font-bold">{m.time}</div></div><div className="flex gap-2"><Button size="sm" onClick={() => {startEdit(m); setActiveTab("matches");}} className="bg-yellow-400 text-black font-bold">تعديل التوقيت</Button></div></div>))}</CardContent></Card>
        </TabsContent>

        {/* 8. تبويب الأهداف (الهدافين) */}
        <TabsContent value="goals">
          <Card className="border-yellow-400 bg-[#13213a]">
             <CardHeader className="flex flex-col sm:flex-row justify-between gap-4"><CardTitle className="text-yellow-300">سجل الهدافين</CardTitle><Input placeholder="بحث عن لاعب..." value={goalSearchTerm} onChange={(e) => setGoalSearchTerm(e.target.value)} className="max-w-xs border-yellow-400 bg-[#1e2a4a] text-white" /></CardHeader>
             <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-5 bg-[#1e2a4a] rounded-3xl border border-white/5">
                   <Input value={goalForm.player} onChange={e => setGoalForm(p => ({...p, player: e.target.value}))} placeholder="اسم اللاعب" className="bg-[#0a1428] border-none text-white h-12" />
                   <select value={goalForm.team} onChange={e => setGoalForm(p => ({...p, team: e.target.value}))} className="bg-[#0a1428] border-none rounded-xl p-3 text-white h-12 outline-none">{sortedTeams.map(t => <option key={t} value={t}>{t}</option>)}</select>
                   <Input type="number" value={goalForm.goalsCount} onChange={e => setGoalForm(p => ({...p, goalsCount: Number(e.target.value)}))} placeholder="عدد الأهداف" className="bg-[#0a1428] border-none text-white font-bold h-12 text-center" />
                   <Input value={goalForm.imageUrl} onChange={e => setGoalForm(p => ({...p, imageUrl: e.target.value}))} placeholder="رابط الصورة (اختياري)" className="bg-[#0a1428] border-none text-white h-12" />
                   <Button onClick={addOrUpdateGoal} className="bg-yellow-400 text-black font-black h-12 text-lg hover:bg-yellow-500">{editingGoalId ? "حفظ التعديل" : "إضافة الهدف ⚽"}</Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                   {filteredGoals.map(goal => (
                      <div key={goal.id} className="bg-[#1e2a4a] p-4 rounded-2xl flex justify-between items-center border border-white/5">
                         <div className="flex items-center gap-3">
                            {goal.imageUrl ? <img src={goal.imageUrl} className="h-12 w-12 rounded-full object-cover border-2 border-yellow-400" /> : <div className="h-12 w-12 rounded-full bg-[#0a1428] flex items-center justify-center text-xl">👤</div>}
                            <div><div className="font-bold text-white text-lg">{goal.player}</div><div className="text-cyan-300 text-sm font-bold">{goal.team} <span className="text-yellow-400 mx-1">•</span> {goal.goals} أهداف</div></div>
                         </div>
                         <div className="flex flex-col gap-2">
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => startEditGoal(goal)}><Edit className="h-4 w-4" /></Button>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-500" onClick={() => deleteGoal(goal.id)}><Trash2 className="h-4 w-4" /></Button>
                         </div>
                      </div>
                   ))}
                </div>
             </CardContent>
          </Card>
        </TabsContent>

        {/* 9. تبويب الكروت (الإنذارات والطرد) */}
        <TabsContent value="cards">
          <Card className="border-yellow-400 bg-[#13213a]">
             <CardHeader className="flex flex-col sm:flex-row justify-between gap-4"><CardTitle className="text-yellow-300">سجل البطاقات (صفراء / حمراء)</CardTitle><Input placeholder="بحث عن لاعب..." value={cardSearchTerm} onChange={(e) => setCardSearchTerm(e.target.value)} className="max-w-xs border-yellow-400 bg-[#1e2a4a] text-white" /></CardHeader>
             <CardContent className="space-y-6 p-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-5 bg-[#1e2a4a] rounded-3xl border border-white/5">
                   <Input value={cardForm.player} onChange={e => setCardForm(p => ({...p, player: e.target.value}))} placeholder="اسم اللاعب" className="bg-[#0a1428] border-none text-white h-12" />
                   <select value={cardForm.team} onChange={e => setCardForm(p => ({...p, team: e.target.value}))} className="bg-[#0a1428] border-none rounded-xl p-3 text-white h-12 outline-none">{sortedTeams.map(t => <option key={t} value={t}>{t}</option>)}</select>
                   <select value={cardForm.type} onChange={e => setCardForm(p => ({...p, type: e.target.value as "yellow" | "red"}))} className="bg-[#0a1428] border-none rounded-xl p-3 text-white font-bold h-12 outline-none"><option value="yellow">إنذار أصفر 🟨</option><option value="red">بطاقة حمراء 🟥</option></select>
                   <Button onClick={addCard} className="bg-yellow-400 text-black font-black h-12 text-lg hover:bg-yellow-500">تسجيل البطاقة</Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                   {filteredCards.map(item => (
                      <div key={item.id} className="bg-[#1e2a4a] p-5 rounded-2xl flex flex-col justify-between gap-4 border border-white/5">
                         <div><div className="font-bold text-white text-xl mb-1">{item.player}</div><div className="text-cyan-300 font-bold">{item.team}</div></div>
                         <div className="flex items-center justify-between bg-[#0a1428] p-3 rounded-xl">
                            <div className="flex items-center gap-2"><Button size="sm" variant="ghost" onClick={() => updateCard(item.id, Math.max(0, item.yellow - 1), item.red)} className="h-8 w-8 p-0 text-gray-400 hover:text-white"><Minus className="h-4 w-4" /></Button><Badge className="px-3 py-1 bg-yellow-400 text-black font-black text-lg">🟨 {item.yellow}</Badge><Button size="sm" variant="ghost" onClick={() => updateCard(item.id, item.yellow + 1, item.red)} className="h-8 w-8 p-0 text-gray-400 hover:text-white"><Plus className="h-4 w-4" /></Button></div>
                            <div className="flex items-center gap-2"><Button size="sm" variant="ghost" onClick={() => updateCard(item.id, item.yellow, Math.max(0, item.red - 1))} className="h-8 w-8 p-0 text-gray-400 hover:text-white"><Minus className="h-4 w-4" /></Button><Badge className="px-3 py-1 bg-red-600 text-white font-black text-lg">🟥 {item.red}</Badge><Button size="sm" variant="ghost" onClick={() => updateCard(item.id, item.yellow, item.red + 1)} className="h-8 w-8 p-0 text-gray-400 hover:text-white"><Plus className="h-4 w-4" /></Button></div>
                         </div>
                      </div>
                   ))}
                </div>
             </CardContent>
          </Card>
        </TabsContent>

        {/* 10. تبويب الميديا (الفيديوهات) */}
        <TabsContent value="media">
          <Card className="border-emerald-500 bg-[#13213a]">
             <CardHeader><CardTitle className="text-emerald-400 flex items-center gap-2"><Video /> إدارة المركز الإعلامي</CardTitle></CardHeader>
             <CardContent className="space-y-6 p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5 bg-[#1e2a4a] rounded-3xl border border-emerald-500/30">
                   <Input value={mediaForm.title} onChange={e => setMediaForm(p => ({...p, title: e.target.value}))} placeholder="عنوان الفيديو (مثال: أهداف مباراة...)" className="bg-[#0a1428] border-none text-white h-12" />
                   <Input value={mediaForm.url} onChange={e => setMediaForm(p => ({...p, url: e.target.value}))} placeholder="رابط فيديو يوتيوب" className="bg-[#0a1428] border-none text-white h-12 font-mono text-left" dir="ltr" />
                   <Button onClick={addMedia} className="bg-emerald-500 hover:bg-emerald-600 text-white font-black h-12 text-lg">إضافة الفيديو للموقع 🎥</Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   {mediaItems.map(item => (
                      <div key={item.id} className="bg-[#1e2a4a] p-5 rounded-2xl flex justify-between items-center border border-white/5">
                         <div className="overflow-hidden pr-4"><div className="font-bold text-white text-lg truncate mb-1">{item.title}</div><a href={item.url} target="_blank" className="text-emerald-400 text-sm font-mono truncate block hover:underline" dir="ltr">{item.url}</a></div>
                         <Button size="icon" variant="destructive" onClick={() => deleteMedia(item.id)} className="shrink-0"><Trash2 className="h-5 w-5" /></Button>
                      </div>
                   ))}
                </div>
             </CardContent>
          </Card>
        </TabsContent>

        {/* 11. تبويب شريط الأخبار */}
        <TabsContent value="ticker">
          <Card className="border-yellow-400 bg-[#13213a]">
             <CardHeader><CardTitle className="text-yellow-300">التحكم في شريط الأخبار العاجلة</CardTitle></CardHeader>
             <CardContent className="p-6 space-y-6 text-center">
                <Input value={tickerText} onChange={e => setTickerText(e.target.value)} placeholder="اكتب الخبر اللي هيظهر في الشريط المتحرك فوق..." className="py-8 text-xl text-center font-bold bg-[#1e2a4a] border-yellow-400 text-white rounded-2xl" />
                <Button onClick={saveTicker} className="w-full max-w-md bg-yellow-400 text-black py-8 font-black text-2xl hover:bg-yellow-500 rounded-2xl">حفظ ونشر الخبر الآن 🚀</Button>
             </CardContent>
          </Card>
        </TabsContent>

        {/* 12. تبويب الإشعارات */}
        <TabsContent value="notify">
           <Card className="bg-gradient-to-br from-[#1e2a4a] to-[#13213a] border-yellow-400 p-8 max-w-2xl mx-auto text-center shadow-2xl rounded-3xl">
              <BellRing className="mx-auto h-16 w-16 text-yellow-400 mb-6 animate-bounce" />
              <CardTitle className="text-3xl font-black text-yellow-300 mb-8">إرسال إشعار فوري للجمهور</CardTitle>
              <Input value={notifyTitle} onChange={e => setNotifyTitle(e.target.value)} placeholder="عنوان الإشعار (مثال: 🔴 بث مباشر الآن!)" className="bg-[#0a1428] border-yellow-400/50 text-white mb-5 h-16 text-xl font-bold text-center rounded-2xl" />
              <Input value={notifyBody} onChange={e => setNotifyBody(e.target.value)} placeholder="التفاصيل (مثال: اضغط هنا لمشاهدة مباراة...)" className="bg-[#0a1428] border-yellow-400/50 text-white mb-8 h-16 text-lg text-center rounded-2xl" />
              <Button onClick={sendNotification} disabled={isSending} className="w-full bg-yellow-400 text-black py-8 text-3xl font-black rounded-2xl hover:scale-[1.02] transition-transform shadow-[0_0_30px_rgba(250,204,21,0.3)]">
                 {isSending ? "جاري الإرسال للجميع..." : "إرسال الإشعار الآن 🚀"}
              </Button>
           </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trophy, LogOut, Edit, Trash2, Plus, Minus, Play, Square, Pause, AlertTriangle } from "lucide-react";
import { collection, addDoc, deleteDoc, doc, updateDoc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { TEAM_NAMES } from "@/data/tournament";

const ADMIN_PASSWORD = "hero123";

type AdminMatch = {
  id: string;
  teamA: string;
  teamB: string;
  homeGoals: number;
  awayGoals: number;
  round: string;
  date: string;
  time: string;
  dayName: string;
  status?: string;
  liveMinute?: number;
  isLive?: boolean;
  isTimerRunning?: boolean;
  redCardsHome?: number;
  redCardsAway?: number;
  penaltiesHome?: ("scored" | "missed" | "none")[];
  penaltiesAway?: ("scored" | "missed" | "none")[];
};

type GoalEvent = { id: string; player: string; team: string; goals: number; imageUrl?: string };
type CardEvent = { id: string; player: string; team: string; yellow: number; red: number };

export default function AdminPage() {
  const [isAuth, setIsAuth] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [activeTab, setActiveTab] = useState<"live" | "all" | "today" | "tomorrow" | "goals" | "cards" | "ticker">("live");

  const [matches, setMatches] = useState<AdminMatch[]>([]);
  const matchesRef = useRef<AdminMatch[]>([]);
  const [goals, setGoals] = useState<GoalEvent[]>([]);
  const [cardEvents, setCardEvents] = useState<CardEvent[]>([]);
  const [tickerText, setTickerText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [goalSearchTerm, setGoalSearchTerm] = useState("");
  const [cardSearchTerm, setCardSearchTerm] = useState("");

  const sortedTeams = useMemo(() => [...TEAM_NAMES].sort((a, b) => a.localeCompare(b, "ar")), []);

  const [matchForm, setMatchForm] = useState({
    teamA: TEAM_NAMES[0], teamB: TEAM_NAMES[1], homeGoals: 0, awayGoals: 0,
    round: "الجولة الأولى", date: new Date().toISOString().slice(0, 10), time: "15:30",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [goalForm, setGoalForm] = useState({ player: "", team: TEAM_NAMES[0], goalsCount: 1, imageUrl: "" });
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [cardForm, setCardForm] = useState({ player: "", team: TEAM_NAMES[0], type: "yellow" as "yellow" | "red" });

  const now = new Date();
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
  const tomorrowStr = new Date(now.getTime() + 86400000).toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });

  useEffect(() => { matchesRef.current = matches; }, [matches]);

  useEffect(() => {
    if (!isAuth) return;
    const unsubMatches = onSnapshot(collection(db, "matches"), (snap) => setMatches(snap.docs.map(d => ({ id: d.id, ...d.data() } as AdminMatch))));
    const unsubGoals = onSnapshot(collection(db, "goals"), (snap) => setGoals(snap.docs.map(d => ({ id: d.id, ...d.data() } as GoalEvent))));
    const unsubCards = onSnapshot(collection(db, "cards"), (snap) => setCardEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as CardEvent))));
    const unsubTicker = onSnapshot(doc(db, "settings", "ticker"), (docSnap) => setTickerText(docSnap.data()?.text || ""));

    const timerInterval = setInterval(() => {
      matchesRef.current.forEach(m => {
        if (m.isTimerRunning && m.status !== "انتهت" && m.status !== "استراحة" && m.status !== "ضربات جزاء") {
          updateDoc(doc(db, "matches", m.id), { liveMinute: (m.liveMinute || 0) + 1 });
        }
      });
    }, 60000); 

    return () => { unsubMatches(); unsubGoals(); unsubCards(); unsubTicker(); clearInterval(timerInterval); };
  }, [isAuth]);

  const handleLogin = () => passwordInput === ADMIN_PASSWORD ? setIsAuth(true) : alert("كلمة السر خاطئة");

  const saveMatch = async () => {
    if (matchForm.teamA === matchForm.teamB) return alert("اختر فريقين مختلفين");
    const dayName = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"][new Date(matchForm.date).getDay()];
    const data = { ...matchForm, dayName, isLive: false };
    if (editingId) { await updateDoc(doc(db, "matches", editingId), data); setEditingId(null); alert("✅ تم تعديل المباراة بنجاح");} 
    else { await addDoc(collection(db, "matches"), data); alert("✅ تم إضافة المباراة بنجاح");}
    setMatchForm({ teamA: TEAM_NAMES[0], teamB: TEAM_NAMES[1], homeGoals: 0, awayGoals: 0, round: "الجولة الأولى", date: new Date().toISOString().slice(0, 10), time: "15:30" });
  };

  const startEdit = (match: AdminMatch) => {
    setEditingId(match.id);
    setMatchForm({ teamA: match.teamA, teamB: match.teamB, homeGoals: match.homeGoals, awayGoals: match.awayGoals, round: match.round, date: match.date, time: match.time });
  };

  const deleteMatch = async (id: string) => confirm("متأكد من الحذف؟") && await deleteDoc(doc(db, "matches", id));
  const updateMatchLive = async (id: string, updates: any) => await updateDoc(doc(db, "matches", id), updates);

  const togglePenalty = async (matchId: string, team: 'home' | 'away', index: number, current: string) => {
    const field = team === 'home' ? 'penaltiesHome' : 'penaltiesAway';
    const match = matches.find(m => m.id === matchId);
    let arr = match?.[field] || ['none','none','none','none','none'];
    let next = current === 'none' ? 'scored' : current === 'scored' ? 'missed' : 'none';
    let newArr = [...arr];
    newArr[index] = next as any;
    await updateDoc(doc(db, "matches", matchId), { [field]: newArr });
  };

  const addPenaltySlot = async (matchId: string) => {
    const match = matches.find(m => m.id === matchId);
    if(!match) return;
    await updateDoc(doc(db, "matches", matchId), {
      penaltiesHome: [...(match.penaltiesHome || ['none','none','none','none','none']), 'none'],
      penaltiesAway: [...(match.penaltiesAway || ['none','none','none','none','none']), 'none']
    });
  };

  // 🎯 إدارة الأهداف الذكية (نظام تراكمي)
  const addOrUpdateGoal = async () => {
    if (!goalForm.player.trim()) return alert("اكتب اسم اللاعب");
    
    const playerNameTrimmed = goalForm.player.trim();
    const teamSelected = goalForm.team;
    const goalsToAdd = Number(goalForm.goalsCount);
    const imageToAdd = goalForm.imageUrl.trim();

    if (editingGoalId) { 
      // حالة تعديل سجل موجود بالفعل
      const data = { player: playerNameTrimmed, team: teamSelected, goals: goalsToAdd, imageUrl: imageToAdd };
      await updateDoc(doc(db, "goals", editingGoalId), data); 
      setEditingGoalId(null); 
      alert("✅ تم تعديل الهدف بنجاح");
    } 
    else { 
      // البحث عن اللاعب في نفس الفريق
      const existingPlayer = goals.find(g => 
        g.player.trim().toLowerCase() === playerNameTrimmed.toLowerCase() && 
        g.team === teamSelected
      );

      if (existingPlayer) {
        // اللاعب موجود: إضافة الأهداف الجديدة للرصيد القديم
        const newTotalGoals = (Number(existingPlayer.goals) || 0) + goalsToAdd;
        const updateData: any = { goals: newTotalGoals };
        
        // تحديث الصورة إذا تم إدخال رابط جديد
        if (imageToAdd) updateData.imageUrl = imageToAdd;

        await updateDoc(doc(db, "goals", existingPlayer.id), updateData);
        alert(`✅ تم التحديث تراكمياً.. رصيد اللاعب أصبح (${newTotalGoals}) أهداف`);
      } else {
        // اللاعب غير موجود: تسجيل كلاعب جديد
        const data = { player: playerNameTrimmed, team: teamSelected, goals: goalsToAdd, imageUrl: imageToAdd };
        await addDoc(collection(db, "goals"), data); 
        alert("✅ تم إضافة اللاعب والهدف بنجاح");
      }
    }
    
    // تفريغ الحقول بعد الإضافة
    setGoalForm({ player: "", team: TEAM_NAMES[0], goalsCount: 1, imageUrl: "" });
  };
  
  const startEditGoal = (goal: GoalEvent) => { 
    setEditingGoalId(goal.id); 
    setGoalForm({ player: goal.player, team: goal.team, goalsCount: goal.goals, imageUrl: goal.imageUrl || "" }); 
  };
  
  const deleteGoal = async (id: string) => confirm("حذف هذا الهدف؟") && await deleteDoc(doc(db, "goals", id));

  // إدارة الكروت
  const addCard = async () => {
    if (!cardForm.player.trim()) return alert("اكتب اسم اللاعب");
    await addDoc(collection(db, "cards"), { player: cardForm.player.trim(), team: cardForm.team, yellow: cardForm.type === "yellow" ? 1 : 0, red: cardForm.type === "red" ? 1 : 0 });
    setCardForm(p => ({ ...p, player: "" }));
    alert("✅ تم إضافة البطاقة");
  };
  const updateCard = async (id: string, yellow: number, red: number) => await updateDoc(doc(db, "cards", id), { yellow, red });
  const deleteCard = async (id: string) => confirm("حذف هذه البطاقة؟") && await deleteDoc(doc(db, "cards", id));

  const saveTicker = async () => {
    if (!tickerText.trim()) return alert("اكتب الخبر أولاً");
    await setDoc(doc(db, "settings", "ticker"), { text: tickerText.trim() });
    alert("✅ تم نشر الخبر بنجاح");
  };

  const safeGoalSearch = goalSearchTerm.toLowerCase();
  const filteredGoals = goals.filter(g => String(g.player || "").toLowerCase().includes(safeGoalSearch) || String(g.team || "").toLowerCase().includes(safeGoalSearch));

  const safeCardSearch = cardSearchTerm.toLowerCase();
  const filteredCards = cardEvents.filter(c => String(c.player || "").toLowerCase().includes(safeCardSearch) || String(c.team || "").toLowerCase().includes(safeCardSearch));

  if (!isAuth) return (
    <div dir="rtl" className="min-h-screen bg-[#0a1428] flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-yellow-400 bg-[#13213a]">
        <CardHeader className="text-center"><Trophy className="mx-auto h-12 w-12 text-yellow-400" /><CardTitle className="text-2xl font-black text-yellow-300 mt-4">إدارة كأس مطروح</CardTitle></CardHeader>
        <CardContent className="space-y-4"><Input type="password" placeholder="كلمة السر" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} className="bg-[#1e2a4a] border-yellow-400 text-white h-12 text-center text-xl" /><Button onClick={handleLogin} className="w-full bg-yellow-400 text-black font-bold h-12">دخول</Button></CardContent>
      </Card>
    </div>
  );

  return (
    <div dir="rtl" className="min-h-screen bg-[#0a1428] text-white">
      <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        <header className="mb-8 flex justify-between items-center">
          <div><h1 className="text-3xl sm:text-4xl font-black text-yellow-300">لوحة الإدارة الاحترافية</h1><p className="text-cyan-300">بطولة كأس مطروح ٢٠٢٦</p></div>
          <Button onClick={() => setIsAuth(false)} variant="outline" className="border-yellow-400 text-white hover:bg-yellow-400 hover:text-black">خروج <LogOut className="ml-2 h-4 w-4" /></Button>
        </header>

        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
          <TabsList className="grid grid-cols-3 md:grid-cols-7 bg-[#13213a] border border-yellow-400/50 p-1.5 rounded-2xl mb-8">
            <TabsTrigger value="live" className="data-[state=active]:bg-red-600 data-[state=active]:text-white font-bold py-3 rounded-xl animate-pulse text-red-400 data-[state=active]:animate-none">مباشر</TabsTrigger>
            <TabsTrigger value="all" className="data-[state=active]:bg-black data-[state=active]:text-yellow-300 font-bold py-3 rounded-xl text-white">السابقة</TabsTrigger>
            <TabsTrigger value="today" className="data-[state=active]:bg-black data-[state=active]:text-yellow-300 font-bold py-3 rounded-xl text-white">اليوم</TabsTrigger>
            <TabsTrigger value="tomorrow" className="data-[state=active]:bg-black data-[state=active]:text-yellow-300 font-bold py-3 rounded-xl text-white">غداً</TabsTrigger>
            <TabsTrigger value="goals" className="data-[state=active]:bg-black data-[state=active]:text-yellow-300 font-bold py-3 rounded-xl text-white">أهداف</TabsTrigger>
            <TabsTrigger value="cards" className="data-[state=active]:bg-black data-[state=active]:text-yellow-300 font-bold py-3 rounded-xl text-white">كروت</TabsTrigger>
            <TabsTrigger value="ticker" className="data-[state=active]:bg-black data-[state=active]:text-yellow-300 font-bold py-3 rounded-xl text-white">أخبار</TabsTrigger>
          </TabsList>

          <TabsContent value="live" className="space-y-6">
            {matches.filter(m => m.isLive).length === 0 && (
              <Card className="border-yellow-400 bg-[#13213a] border-dashed"><CardContent className="p-16 text-center"><p className="text-xl text-cyan-300 mb-4">لا توجد مباريات جارية الآن</p></CardContent></Card>
            )}
            {matches.filter(m => m.isLive).map(match => (
              <Card key={match.id} className="bg-[#1e2a4a] border-2 border-red-500/80 overflow-hidden shadow-[0_0_30px_rgba(239,68,68,0.2)]">
                <div className="bg-red-600 text-white px-6 py-3 flex flex-wrap justify-between items-center gap-4">
                  <div className="flex items-center gap-4">
                     <span className="font-black text-lg animate-pulse">🔴 {match.teamA} ضد {match.teamB}</span>
                     <select value={match.status || "الشوط الأول"} onChange={(e) => updateMatchLive(match.id, { status: e.target.value })} className="bg-black/40 border-none text-white font-bold rounded-lg px-3 py-1 text-sm outline-none cursor-pointer">
                        <option value="الشوط الأول">الشوط الأول</option><option value="استراحة">استراحة</option><option value="الشوط الثاني">الشوط الثاني</option><option value="وقت إضافي">وقت إضافي</option><option value="ضربات جزاء">ضربات جزاء</option><option value="انتهت">انتهت</option>
                     </select>
                  </div>
                  <Button size="sm" variant="outline" className="bg-white/10 text-white border-white/20 hover:bg-white/20 hover:text-white" onClick={() => updateMatchLive(match.id, { isLive: false })}>إغلاق البث</Button>
                </div>

                <CardContent className="p-6">
                  <div className="flex justify-center items-center gap-6 mb-8 bg-[#13213a] p-4 rounded-2xl border border-white/5 flex-wrap">
                     <Button onClick={() => updateMatchLive(match.id, { isTimerRunning: !match.isTimerRunning })} className={`font-bold h-12 px-6 ${match.isTimerRunning ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}>
                       {match.isTimerRunning ? <><Pause className="mr-2 h-5 w-5" /> إيقاف التايمر</> : <><Play className="mr-2 h-5 w-5" /> تشغيل التايمر</>}
                     </Button>
                     <div className="flex items-center gap-3"><label className="text-gray-400 font-bold">الدقيقة:</label><Input type="number" value={match.liveMinute || 0} onChange={(e) => updateMatchLive(match.id, { liveMinute: Number(e.target.value) })} className="w-24 text-center text-2xl font-black bg-black border-yellow-400 text-yellow-400" /></div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-8 items-center mb-8">
                    <div className="text-center bg-[#13213a] p-6 rounded-3xl border border-white/5 relative">
                      <h3 className="text-2xl font-bold text-white mb-6">{match.teamA}</h3>
                      <div className="flex items-center justify-center gap-4 mb-6"><Button variant="outline" className="h-12 w-12 rounded-full border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-black" onClick={() => updateMatchLive(match.id, { homeGoals: (match.homeGoals || 0) + 1 })}><Plus /></Button><span className="text-7xl font-black text-white w-20">{match.homeGoals || 0}</span><Button variant="outline" className="h-12 w-12 rounded-full border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-black" onClick={() => updateMatchLive(match.id, { homeGoals: Math.max(0, (match.homeGoals || 0) - 1) })}><Minus /></Button></div>
                      <div className="flex justify-center items-center gap-2 bg-red-500/10 py-2 rounded-xl border border-red-500/20"><span className="text-red-500 font-bold">طرد:</span><Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-white" onClick={() => updateMatchLive(match.id, { redCardsHome: Math.max(0, (match.redCardsHome || 0) - 1) })}><Minus className="h-4 w-4" /></Button><span className="font-bold text-xl text-red-500">{match.redCardsHome || 0}</span><Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-white" onClick={() => updateMatchLive(match.id, { redCardsHome: (match.redCardsHome || 0) + 1 })}><Plus className="h-4 w-4" /></Button></div>
                    </div>
                    <div className="text-center text-yellow-400 font-black text-4xl hidden md:block">VS</div>
                    <div className="text-center bg-[#13213a] p-6 rounded-3xl border border-white/5 relative">
                      <h3 className="text-2xl font-bold text-white mb-6">{match.teamB}</h3>
                      <div className="flex items-center justify-center gap-4 mb-6"><Button variant="outline" className="h-12 w-12 rounded-full border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-black" onClick={() => updateMatchLive(match.id, { awayGoals: (match.awayGoals || 0) + 1 })}><Plus /></Button><span className="text-7xl font-black text-white w-20">{match.awayGoals || 0}</span><Button variant="outline" className="h-12 w-12 rounded-full border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-black" onClick={() => updateMatchLive(match.id, { awayGoals: Math.max(0, (match.awayGoals || 0) - 1) })}><Minus /></Button></div>
                      <div className="flex justify-center items-center gap-2 bg-red-500/10 py-2 rounded-xl border border-red-500/20"><span className="text-red-500 font-bold">طرد:</span><Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-white" onClick={() => updateMatchLive(match.id, { redCardsAway: Math.max(0, (match.redCardsAway || 0) - 1) })}><Minus className="h-4 w-4" /></Button><span className="font-bold text-xl text-red-500">{match.redCardsAway || 0}</span><Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-white" onClick={() => updateMatchLive(match.id, { redCardsAway: (match.redCardsAway || 0) + 1 })}><Plus className="h-4 w-4" /></Button></div>
                    </div>
                  </div>

                  {match.status === "ضربات جزاء" && (
                    <div className="bg-[#13213a] border border-yellow-400/30 p-6 rounded-3xl mt-6">
                      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                        <h4 className="text-xl font-bold text-yellow-400">إدارة ضربات الترجيح</h4>
                        <Button size="sm" variant="outline" onClick={() => addPenaltySlot(match.id)} className="border-cyan-400 text-cyan-400 hover:bg-cyan-400 hover:text-black"><Plus className="ml-2 h-4 w-4" /> إضافة ركلة إضافية</Button>
                      </div>
                      <div className="flex flex-col md:flex-row justify-between items-center bg-[#0a1428] p-4 rounded-xl gap-6">
                        <div className="flex gap-2 flex-wrap justify-center">
                           {(match.penaltiesHome || ['none','none','none','none','none']).map((p, i) => (
                             <button key={i} onClick={() => togglePenalty(match.id, 'home', i, p)} className={`w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center ${p === 'scored' ? 'bg-emerald-500 border-emerald-400' : p === 'missed' ? 'bg-red-500 border-red-400' : 'bg-[#1e2a4a] border-gray-600'}`}>{p === 'scored' && <span className="text-white font-bold">✔</span>}{p === 'missed' && <span className="text-white font-bold">✖</span>}</button>
                           ))}
                        </div>
                        <div className="text-3xl font-black text-yellow-400 bg-[#1e2a4a] px-6 py-2 rounded-xl">{(match.penaltiesHome || []).filter(p => p === 'scored').length} - {(match.penaltiesAway || []).filter(p => p === 'scored').length}</div>
                        <div className="flex gap-2 flex-wrap justify-center">
                           {(match.penaltiesAway || ['none','none','none','none','none']).map((p, i) => (
                             <button key={i} onClick={() => togglePenalty(match.id, 'away', i, p)} className={`w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center ${p === 'scored' ? 'bg-emerald-500 border-emerald-400' : p === 'missed' ? 'bg-red-500 border-red-400' : 'bg-[#1e2a4a] border-gray-600'}`}>{p === 'scored' && <span className="text-white font-bold">✔</span>}{p === 'missed' && <span className="text-white font-bold">✖</span>}</button>
                           ))}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <Card className="border-yellow-400 bg-[#13213a] mb-8 mt-8"><CardHeader><CardTitle className="text-yellow-300">{editingId ? "تعديل مباراة" : "إضافة مباراة جديدة"}</CardTitle></CardHeader><CardContent className="space-y-6 p-6 text-white"><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><select value={matchForm.teamA} onChange={e => setMatchForm(p => ({...p, teamA: e.target.value}))} className="bg-[#1e2a4a] border border-yellow-400 rounded-2xl p-4 text-white">{sortedTeams.map(t => <option key={t} value={t}>{t}</option>)}</select><div className="flex items-center justify-center text-5xl text-yellow-400 font-black">VS</div><select value={matchForm.teamB} onChange={e => setMatchForm(p => ({...p, teamB: e.target.value}))} className="bg-[#1e2a4a] border border-yellow-400 rounded-2xl p-4 text-white">{sortedTeams.map(t => <option key={t} value={t}>{t}</option>)}</select></div><div className="grid grid-cols-2 gap-6"><div><label className="block mb-2 text-cyan-300">أهداف {matchForm.teamA}</label><Input type="number" value={matchForm.homeGoals} onChange={e => setMatchForm(p => ({...p, homeGoals: Number(e.target.value)}))} className="text-6xl text-center h-20 text-white" /></div><div><label className="block mb-2 text-cyan-300">أهداف {matchForm.teamB}</label><Input type="number" value={matchForm.awayGoals} onChange={e => setMatchForm(p => ({...p, awayGoals: Number(e.target.value)}))} className="text-6xl text-center h-20 text-white" /></div></div><div className="grid grid-cols-1 sm:grid-cols-3 gap-4"><select value={matchForm.round} onChange={e => setMatchForm(p => ({...p, round: e.target.value}))} className="bg-[#1e2a4a] border border-yellow-400 rounded-2xl p-4 text-white">{["الجولة الأولى","الجولة الثانية","الجولة الثالثة","الجولة الرابعة","الملحق","دور الستة عشر","دور الثمانية","نصف النهائي","النهائي"].map(r => <option key={r} value={r}>{r}</option>)}</select><Input type="time" value={matchForm.time} onChange={e => setMatchForm(p => ({...p, time: e.target.value}))} className="text-white" /><Input type="date" value={matchForm.date} onChange={e => setMatchForm(p => ({...p, date: e.target.value}))} className="text-white" /></div><Button onClick={saveMatch} className="w-full bg-yellow-400 text-black font-bold py-7 text-xl">{editingId ? "حفظ التعديل" : "إضافة المباراة"}</Button></CardContent></Card>

          <TabsContent value="all"><Card className="border-yellow-400 bg-[#13213a]"><CardHeader className="flex flex-col sm:flex-row justify-between gap-4"><CardTitle className="text-yellow-300">المباريات السابقة</CardTitle><Input placeholder="ابحث عن فريق..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-sm border-yellow-400 bg-[#1e2a4a] text-white" /></CardHeader><CardContent className="space-y-3">{matches.filter(m => !m.isLive && (String(m.teamA || "").includes(searchTerm) || String(m.teamB || "").includes(searchTerm))).map(m => (<div key={m.id} className="bg-[#1e2a4a] p-4 rounded-2xl flex flex-col sm:flex-row justify-between gap-4 border border-yellow-400/30"><div><div className="font-bold text-white">{m.teamA} {m.homeGoals} - {m.awayGoals} {m.teamB}</div><div className="text-cyan-300 text-sm">{m.date} • {m.status || m.time}</div></div><div className="flex gap-2 flex-wrap"><Button size="sm" onClick={() => { updateMatchLive(m.id, { isLive: true, status: m.status || "الشوط الأول", liveMinute: m.liveMinute || 1 }); setActiveTab("live"); }} className="bg-red-600 hover:bg-red-700 text-white"><Play className="ml-1 h-4 w-4" /> مباشر</Button><Button size="sm" onClick={() => startEdit(m)} className="bg-yellow-400 text-black"><Edit className="ml-1 h-4 w-4" /> تعديل</Button><Button size="sm" onClick={() => deleteMatch(m.id)} variant="destructive"><Trash2 className="ml-1 h-4 w-4" /> حذف</Button></div></div>))}</CardContent></Card></TabsContent>
          <TabsContent value="today"><Card className="border-yellow-400 bg-[#13213a]"><CardHeader><CardTitle className="text-yellow-300">مباريات اليوم (بدون نتيجة)</CardTitle></CardHeader><CardContent className="space-y-3">{matches.filter(m => m.date === todayStr && !m.isLive && m.homeGoals === 0 && m.awayGoals === 0).map(m => (<div key={m.id} className="bg-[#1e2a4a] p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-center border-l-4 border-yellow-400 gap-4"><div><div className="font-bold text-white">{m.teamA} vs {m.teamB}</div><div className="text-cyan-300 text-sm">{m.time}</div></div><div className="flex gap-2"><Button size="sm" onClick={() => { updateMatchLive(m.id, { isLive: true, status: "الشوط الأول", liveMinute: 1 }); setActiveTab("live"); }} className="bg-red-600 text-white hover:bg-red-700"><Play className="ml-1 h-4 w-4" /> ابدأ البث</Button><Button size="sm" onClick={() => startEdit(m)} className="bg-yellow-400 text-black">تعديل</Button><Button size="sm" onClick={() => deleteMatch(m.id)} variant="destructive">حذف</Button></div></div>))}</CardContent></Card></TabsContent>
          <TabsContent value="tomorrow"><Card className="border-yellow-400 bg-[#13213a]"><CardHeader><CardTitle className="text-yellow-300">مباريات غداً</CardTitle></CardHeader><CardContent className="space-y-3">{matches.filter(m => m.date === tomorrowStr && !m.isLive).map(m => (<div key={m.id} className="bg-[#1e2a4a] p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4 border-l-4 border-sky-400"><div><div className="font-bold text-white">{m.teamA} vs {m.teamB}</div><div className="text-cyan-300 text-sm">{m.time}</div></div><div className="flex gap-2"><Button size="sm" onClick={() => startEdit(m)} className="bg-yellow-400 text-black">تعديل</Button><Button size="sm" onClick={() => deleteMatch(m.id)} variant="destructive">حذف</Button></div></div>))}</CardContent></Card></TabsContent>

          {/* تبويب الأهداف مع حقل الصورة الجديد */}
          <TabsContent value="goals">
            <Card className="border-yellow-400 bg-[#13213a]">
              <CardHeader><CardTitle className="text-yellow-300">إدارة الأهداف</CardTitle><Input placeholder="ابحث عن لاعب أو فريق..." value={goalSearchTerm} onChange={(e) => setGoalSearchTerm(e.target.value)} className="mt-4 max-w-md border-yellow-400 bg-[#1e2a4a] text-white" /></CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 bg-[#1e2a4a] rounded-2xl">
                  <Input value={goalForm.player} onChange={e => setGoalForm(p => ({...p, player: e.target.value}))} placeholder="اسم اللاعب" className="bg-[#0a1428] border-yellow-400 text-white" />
                  <select value={goalForm.team} onChange={e => setGoalForm(p => ({...p, team: e.target.value}))} className="bg-[#0a1428] border border-yellow-400 rounded-2xl p-3 text-white">{sortedTeams.map(t => <option key={t} value={t}>{t}</option>)}</select>
                  <Input type="number" value={goalForm.goalsCount} onChange={e => setGoalForm(p => ({...p, goalsCount: Number(e.target.value)}))} placeholder="عدد الأهداف" className="bg-[#0a1428] border-yellow-400 text-white" />
                  <Input value={goalForm.imageUrl} onChange={e => setGoalForm(p => ({...p, imageUrl: e.target.value}))} placeholder="رابط صورة اللاعب (اختياري)" className="bg-[#0a1428] border-yellow-400 text-white" />
                  <Button onClick={addOrUpdateGoal} className="bg-yellow-400 text-black font-bold h-full">{editingGoalId ? "تعديل" : "إضافة"}</Button>
                </div>
                <div className="space-y-3">
                  {filteredGoals.map(goal => (
                    <Card key={goal.id} className="bg-[#1e2a4a] border border-yellow-400/30">
                      <CardContent className="p-4 flex justify-between items-center text-white">
                        <div className="flex items-center gap-4">
                          {goal.imageUrl ? <img src={goal.imageUrl} className="h-10 w-10 rounded-full object-cover border border-yellow-400" /> : <div className="h-10 w-10 rounded-full bg-[#0a1428] flex items-center justify-center text-xl">👤</div>}
                          <div><div className="font-bold">{goal.player}</div><div className="text-cyan-300 text-sm">{goal.team} — {goal.goals} هدف</div></div>
                        </div>
                        <div className="flex gap-2"><Button size="sm" onClick={() => startEditGoal(goal)} className="bg-yellow-400 text-black"><Edit className="ml-2 h-4 w-4" /> تعديل</Button><Button size="sm" variant="destructive" onClick={() => deleteGoal(goal.id)}><Trash2 className="ml-2 h-4 w-4" /> حذف</Button></div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cards"><Card className="border-yellow-400 bg-[#13213a]"><CardHeader><CardTitle className="text-yellow-300">إدارة الإنذارات والبطاقات</CardTitle><Input placeholder="ابحث عن لاعب..." value={cardSearchTerm} onChange={(e) => setCardSearchTerm(e.target.value)} className="mt-4 max-w-md border-yellow-400 bg-[#1e2a4a] text-white" /></CardHeader><CardContent className="space-y-6 p-6"><div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-[#1e2a4a] rounded-2xl"><Input value={cardForm.player} onChange={e => setCardForm(p => ({...p, player: e.target.value}))} placeholder="اسم اللاعب" className="bg-[#0a1428] border-yellow-400 text-white" /><select value={cardForm.team} onChange={e => setCardForm(p => ({...p, team: e.target.value}))} className="bg-[#0a1428] border border-yellow-400 rounded-2xl p-3 text-white">{sortedTeams.map(t => <option key={t} value={t}>{t}</option>)}</select><select value={cardForm.type} onChange={e => setCardForm(p => ({...p, type: e.target.value as "yellow" | "red"}))} className="bg-[#0a1428] border border-yellow-400 rounded-2xl p-3 text-white"><option value="yellow">إنذار أصفر</option><option value="red">بطاقة حمراء</option></select><Button onClick={addCard} className="bg-yellow-400 text-black font-bold">إضافة</Button></div><div className="space-y-3">{filteredCards.map(item => (<Card key={item.id} className="bg-[#1e2a4a] border border-yellow-400/30"><CardContent className="p-4 flex flex-col sm:flex-row justify-between items-center gap-4 text-white"><div><div className="font-bold text-lg">{item.player}</div><div className="text-cyan-300">{item.team}</div></div><div className="flex items-center gap-6"><div className="flex items-center gap-2"><Button size="sm" variant="outline" onClick={() => updateCard(item.id, Math.max(0, item.yellow - 1), item.red)} className="border-yellow-400 text-white"><Minus className="h-4 w-4" /></Button><span className="px-4 py-1 bg-yellow-400/20 text-yellow-300 font-bold rounded">🟨 {item.yellow}</span><Button size="sm" variant="outline" onClick={() => updateCard(item.id, item.yellow + 1, item.red)} className="border-yellow-400 text-white"><Plus className="h-4 w-4" /></Button></div><div className="flex items-center gap-2"><Button size="sm" variant="outline" onClick={() => updateCard(item.id, item.yellow, Math.max(0, item.red - 1))} className="border-red-400 text-white"><Minus className="h-4 w-4" /></Button><span className="px-4 py-1 bg-red-500/20 text-red-300 font-bold rounded">🟥 {item.red}</span><Button size="sm" variant="outline" onClick={() => updateCard(item.id, item.yellow, item.red + 1)} className="border-red-400 text-white"><Plus className="h-4 w-4" /></Button></div><Button size="sm" variant="destructive" onClick={() => deleteCard(item.id)}><Trash2 className="h-4 w-4" /></Button></div></CardContent></Card>))}</div></CardContent></Card></TabsContent>
          <TabsContent value="ticker"><Card className="border-yellow-400 bg-[#13213a]"><CardHeader><CardTitle className="text-yellow-300">شريط الأخبار</CardTitle></CardHeader><CardContent className="p-6 space-y-6"><Input value={tickerText} onChange={e => setTickerText(e.target.value)} placeholder="اكتب الخبر هنا..." className="py-8 text-lg bg-[#1e2a4a] border-yellow-400 text-white" /><Button onClick={saveTicker} className="w-full bg-yellow-400 text-black py-7 font-bold">حفظ ونشر الخبر</Button></CardContent></Card></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
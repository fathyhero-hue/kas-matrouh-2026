"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trophy, LogOut, Edit, Trash2, Plus, Minus } from "lucide-react";
import {
  collection, addDoc, deleteDoc, doc, updateDoc, onSnapshot, setDoc, writeBatch,
} from "firebase/firestore";
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
};

type GoalEvent = { id: string; player: string; team: string; goals: number };
type CardEvent = { id: string; player: string; team: string; yellow: number; red: number };

export default function AdminPage() {
  const [isAuth, setIsAuth] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "today" | "tomorrow" | "goals" | "cards" | "ticker">("all");

  const [matches, setMatches] = useState<AdminMatch[]>([]);
  const [goals, setGoals] = useState<GoalEvent[]>([]);
  const [cardEvents, setCardEvents] = useState<CardEvent[]>([]);
  const [tickerText, setTickerText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [goalSearchTerm, setGoalSearchTerm] = useState("");
  const [cardSearchTerm, setCardSearchTerm] = useState("");

  // قائمة الفرق مرتبة أبجدياً
  const sortedTeams = useMemo(() => [...TEAM_NAMES].sort((a, b) => a.localeCompare(b, "ar")), []);

  const [matchForm, setMatchForm] = useState({
    teamA: TEAM_NAMES[0],
    teamB: TEAM_NAMES[1],
    homeGoals: 0,
    awayGoals: 0,
    round: "الجولة الأولى",
    date: new Date().toISOString().slice(0, 10),
    time: "15:30",
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [goalForm, setGoalForm] = useState({ player: "", team: TEAM_NAMES[0], goalsCount: 1 });
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [cardForm, setCardForm] = useState({ player: "", team: TEAM_NAMES[0], type: "yellow" as "yellow" | "red" });

  const now = new Date();
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
  const tomorrowStr = new Date(now.getTime() + 86400000).toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });

  const sortMatches = (arr: any[]) => [...arr].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return (b.time || "00:00").localeCompare(a.time || "00:00");
  });

  const previousMatches = sortMatches(matches.filter(m => 
    Number(m.homeGoals) !== 0 || Number(m.awayGoals) !== 0 ||
    (m.date !== todayStr && m.date !== tomorrowStr)
  ));

  const todayMatches = sortMatches(matches.filter(m => 
    m.date === todayStr && Number(m.homeGoals) === 0 && Number(m.awayGoals) === 0
  ));

  const tomorrowMatches = sortMatches(matches.filter(m => 
    m.date === tomorrowStr && Number(m.homeGoals) === 0 && Number(m.awayGoals) === 0
  ));

  const filteredPrevious = previousMatches.filter(m =>
    m.teamA.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.teamB.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredGoals = goals.filter(g => {
    const player = String(g.player || "").toLowerCase();
    const team = String(g.team || "").toLowerCase();
    const search = goalSearchTerm.toLowerCase();
    return player.includes(search) || team.includes(search);
  });

  const filteredCards = cardEvents.filter(item =>
    item.player.toLowerCase().includes(cardSearchTerm.toLowerCase()) ||
    item.team.toLowerCase().includes(cardSearchTerm.toLowerCase())
  );

  useEffect(() => {
    if (!isAuth) return;

    const unsubMatches = onSnapshot(collection(db, "matches"), (snap) => {
      setMatches(snap.docs.map(d => ({ id: d.id, ...d.data() } as AdminMatch)));
    });

    const unsubGoals = onSnapshot(collection(db, "goals"), (snap) => {
      setGoals(snap.docs.map(d => ({ id: d.id, ...d.data() } as GoalEvent)));
    });

    const unsubCards = onSnapshot(collection(db, "cards"), (snap) => {
      setCardEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as CardEvent)));
    });

    const unsubTicker = onSnapshot(doc(db, "settings", "ticker"), (docSnap) => {
      if (docSnap.exists()) setTickerText(docSnap.data().text || "");
    });

    return () => { unsubMatches(); unsubGoals(); unsubCards(); unsubTicker(); };
  }, [isAuth]);

  const handleLogin = () => {
    if (passwordInput === ADMIN_PASSWORD) setIsAuth(true);
    else alert("كلمة السر خاطئة");
  };

  const saveMatch = async () => {
    if (matchForm.teamA === matchForm.teamB) return alert("اختر فريقين مختلفين");

    const dateObj = new Date(matchForm.date);
    const dayNames = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
    const dayName = dayNames[dateObj.getDay()];

    const data = { ...matchForm, dayName };

    try {
      if (editingId) {
        await updateDoc(doc(db, "matches", editingId), data);
        alert("✅ تم تعديل المباراة بنجاح");
        setEditingId(null);
      } else {
        await addDoc(collection(db, "matches"), data);
        alert("✅ تم إضافة المباراة بنجاح");
      }

      setMatchForm({
        teamA: TEAM_NAMES[0],
        teamB: TEAM_NAMES[1],
        homeGoals: 0,
        awayGoals: 0,
        round: "الجولة الأولى",
        date: new Date().toISOString().slice(0, 10),
        time: "15:30",
      });
    } catch (e) {
      alert("حدث خطأ أثناء الحفظ");
    }
  };

  const startEdit = (match: AdminMatch) => {
    setEditingId(match.id);
    setMatchForm({ ...match });
  };

  const deleteMatch = async (id: string) => {
    if (!confirm("متأكد من الحذف؟")) return;
    await deleteDoc(doc(db, "matches", id));
  };

  // ====================== الأهداف ======================
  const addOrUpdateGoal = async () => {
    if (!goalForm.player.trim()) return alert("اكتب اسم اللاعب");
    const data = {
      player: goalForm.player.trim(),
      team: goalForm.team,
      goals: goalForm.goalsCount,
    };

    try {
      if (editingGoalId) {
        await updateDoc(doc(db, "goals", editingGoalId), data);
        alert("✅ تم تعديل الهدف");
        setEditingGoalId(null);
      } else {
        await addDoc(collection(db, "goals"), data);
        alert("✅ تم إضافة الهدف");
      }
      setGoalForm({ player: "", team: TEAM_NAMES[0], goalsCount: 1 });
    } catch (e) { alert("حدث خطأ"); }
  };

  const startEditGoal = (goal: GoalEvent) => {
    setEditingGoalId(goal.id);
    setGoalForm({ player: goal.player, team: goal.team, goalsCount: goal.goals });
  };

  const deleteGoal = async (id: string) => {
    if (!confirm("حذف هذا الهدف؟")) return;
    await deleteDoc(doc(db, "goals", id));
  };

  const addCard = async () => {
    if (!cardForm.player.trim()) return alert("اكتب اسم اللاعب");
    await addDoc(collection(db, "cards"), {
      player: cardForm.player.trim(),
      team: cardForm.team,
      yellow: cardForm.type === "yellow" ? 1 : 0,
      red: cardForm.type === "red" ? 1 : 0,
    });
    setCardForm(p => ({ ...p, player: "" }));
    alert("✅ تم إضافة البطاقة");
  };

  const updateCard = async (id: string, yellow: number, red: number) => {
    await updateDoc(doc(db, "cards", id), { yellow, red });
  };

  const deleteCard = async (id: string) => {
    if (!confirm("حذف هذه البطاقة؟")) return;
    await deleteDoc(doc(db, "cards", id));
  };

  const saveTicker = async () => {
    if (!tickerText.trim()) return alert("اكتب الخبر أولاً");
    await setDoc(doc(db, "settings", "ticker"), { text: tickerText.trim() });
    alert("✅ تم نشر الخبر بنجاح");
  };

  if (!isAuth) {
    return (
      <div dir="rtl" className="min-h-screen bg-[#0a1428] flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-yellow-400 bg-[#13213a]">
          <CardHeader className="text-center">
            <Trophy className="mx-auto h-12 w-12 text-yellow-400" />
            <CardTitle className="text-2xl font-black text-yellow-300 mt-4">لوحة الإدارة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input type="password" placeholder="كلمة السر" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} className="bg-[#1e2a4a] border-yellow-400 text-white h-12" />
            <Button onClick={handleLogin} className="w-full bg-yellow-400 text-black font-bold h-12">دخول</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-[#0a1428] text-white">
      <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">

        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black text-yellow-300">لوحة الإدارة</h1>
            <p className="text-cyan-300">بطولة كأس مطروح ٢٠٢٦</p>
          </div>
          <Button onClick={() => setIsAuth(false)} variant="outline" className="border-yellow-400 text-white hover:bg-yellow-400 hover:text-black">
            خروج <LogOut className="ml-2 h-4 w-4" />
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
          <TabsList className="grid grid-cols-3 md:grid-cols-6 bg-[#13213a] border border-yellow-400/50 p-1.5 rounded-2xl mb-8">
            <TabsTrigger value="all" className="data-[state=active]:bg-black data-[state=active]:text-yellow-300 data-[state=inactive]:bg-[#1e2a4a] data-[state=inactive]:text-white font-bold py-3 rounded-xl">المباريات السابقة</TabsTrigger>
            <TabsTrigger value="today" className="data-[state=active]:bg-black data-[state=active]:text-yellow-300 data-[state=inactive]:bg-[#1e2a4a] data-[state=inactive]:text-white font-bold py-3 rounded-xl">اليوم</TabsTrigger>
            <TabsTrigger value="tomorrow" className="data-[state=active]:bg-black data-[state=active]:text-yellow-300 data-[state=inactive]:bg-[#1e2a4a] data-[state=inactive]:text-white font-bold py-3 rounded-xl">غداً</TabsTrigger>
            <TabsTrigger value="goals" className="data-[state=active]:bg-black data-[state=active]:text-yellow-300 data-[state=inactive]:bg-[#1e2a4a] data-[state=inactive]:text-white font-bold py-3 rounded-xl">أهداف</TabsTrigger>
            <TabsTrigger value="cards" className="data-[state=active]:bg-black data-[state=active]:text-yellow-300 data-[state=inactive]:bg-[#1e2a4a] data-[state=inactive]:text-white font-bold py-3 rounded-xl">كروت</TabsTrigger>
            <TabsTrigger value="ticker" className="data-[state=active]:bg-black data-[state=active]:text-yellow-300 data-[state=inactive]:bg-[#1e2a4a] data-[state=inactive]:text-white font-bold py-3 rounded-xl">الأخبار</TabsTrigger>
          </TabsList>

          {/* النموذج */}
          <Card className="border-yellow-400 bg-[#13213a] mb-8">
            <CardHeader>
              <CardTitle className="text-yellow-300">{editingId ? "تعديل مباراة" : "إضافة مباراة جديدة"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 p-6 text-white">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <select value={matchForm.teamA} onChange={e => setMatchForm(p => ({...p, teamA: e.target.value}))} className="bg-[#1e2a4a] border border-yellow-400 rounded-2xl p-4 text-white">
                  {sortedTeams.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <div className="flex items-center justify-center text-5xl text-yellow-400 font-black">VS</div>
                <select value={matchForm.teamB} onChange={e => setMatchForm(p => ({...p, teamB: e.target.value}))} className="bg-[#1e2a4a] border border-yellow-400 rounded-2xl p-4 text-white">
                  {sortedTeams.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block mb-2 text-cyan-300">أهداف {matchForm.teamA}</label>
                  <Input type="number" value={matchForm.homeGoals} onChange={e => setMatchForm(p => ({...p, homeGoals: Number(e.target.value)}))} className="text-6xl text-center h-20 text-white" />
                </div>
                <div>
                  <label className="block mb-2 text-cyan-300">أهداف {matchForm.teamB}</label>
                  <Input type="number" value={matchForm.awayGoals} onChange={e => setMatchForm(p => ({...p, awayGoals: Number(e.target.value)}))} className="text-6xl text-center h-20 text-white" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <select value={matchForm.round} onChange={e => setMatchForm(p => ({...p, round: e.target.value}))} className="bg-[#1e2a4a] border border-yellow-400 rounded-2xl p-4 text-white">
                  {["الجولة الأولى","الجولة الثانية","الجولة الثالثة","الجولة الرابعة","الملحق","دور الستة عشر","دور الثمانية","نصف النهائي","النهائي"].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <Input type="time" value={matchForm.time} onChange={e => setMatchForm(p => ({...p, time: e.target.value}))} className="text-white" />
                <Input type="date" value={matchForm.date} onChange={e => setMatchForm(p => ({...p, date: e.target.value}))} className="text-white" />
              </div>

              <Button onClick={saveMatch} className="w-full bg-yellow-400 text-black font-bold py-7 text-xl">
                {editingId ? "حفظ التعديل" : "إضافة المباراة"}
              </Button>
            </CardContent>
          </Card>

          {/* المباريات السابقة */}
          <TabsContent value="all">
            <Card className="border-yellow-400 bg-[#13213a]">
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between gap-4">
                  <CardTitle className="text-yellow-300">المباريات السابقة ({filteredPrevious.length})</CardTitle>
                  <Input placeholder="ابحث عن فريق..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-sm border-yellow-400 bg-[#1e2a4a] text-white" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {filteredPrevious.length === 0 ? (
                  <p className="text-center py-12 text-cyan-300">لا توجد مباريات سابقة بعد</p>
                ) : filteredPrevious.map(m => (
                  <div key={m.id} className="bg-[#1e2a4a] p-4 rounded-2xl flex flex-col sm:flex-row justify-between gap-4 border border-yellow-400/30">
                    <div>
                      <div className="font-bold text-white">{m.teamA} {m.homeGoals} - {m.awayGoals} {m.teamB}</div>
                      <div className="text-cyan-300 text-sm">{m.date} • {m.time} • {m.round}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => startEdit(m)} className="bg-yellow-400 text-black">
                        <Edit className="ml-2 h-4 w-4" /> تعديل
                      </Button>
                      <Button onClick={() => deleteMatch(m.id)} variant="destructive">
                        <Trash2 className="ml-2 h-4 w-4" /> حذف
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* اليوم */}
          <TabsContent value="today">
            <Card className="border-yellow-400 bg-[#13213a]">
              <CardHeader><CardTitle className="text-yellow-300">مباريات اليوم بدون نتيجة ({todayMatches.length})</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {todayMatches.length === 0 && <p className="text-center py-12 text-cyan-300">لا توجد مباريات اليوم بدون نتيجة</p>}
                {todayMatches.map(m => (
                  <div key={m.id} className="bg-[#1e2a4a] p-4 rounded-2xl flex justify-between items-center border-l-4 border-yellow-400">
                    <div>
                      <div className="font-bold text-white">{m.teamA} vs {m.teamB}</div>
                      <div className="text-cyan-300 text-sm">{m.time}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => startEdit(m)} className="bg-yellow-400 text-black">تعديل</Button>
                      <Button size="sm" variant="destructive" onClick={() => deleteMatch(m.id)}>حذف</Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* غداً */}
          <TabsContent value="tomorrow">
            <Card className="border-yellow-400 bg-[#13213a]">
              <CardHeader><CardTitle className="text-yellow-300">مباريات غداً بدون نتيجة ({tomorrowMatches.length})</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {tomorrowMatches.length === 0 && <p className="text-center py-12 text-cyan-300">لا توجد مباريات غداً بدون نتيجة</p>}
                {tomorrowMatches.map(m => (
                  <div key={m.id} className="bg-[#1e2a4a] p-4 rounded-2xl flex justify-between items-center border-l-4 border-sky-400">
                    <div>
                      <div className="font-bold text-white">{m.teamA} vs {m.teamB}</div>
                      <div className="text-cyan-300 text-sm">{m.time}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => startEdit(m)} className="bg-yellow-400 text-black">تعديل</Button>
                      <Button size="sm" variant="destructive" onClick={() => deleteMatch(m.id)}>حذف</Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* تبويب الأهداف المحدث */}
          <TabsContent value="goals">
            <Card className="border-yellow-400 bg-[#13213a]">
              <CardHeader>
                <CardTitle className="text-yellow-300">إدارة الأهداف</CardTitle>
                <Input 
                  placeholder="ابحث عن لاعب أو فريق..." 
                  value={goalSearchTerm} 
                  onChange={(e) => setGoalSearchTerm(e.target.value)} 
                  className="mt-4 max-w-md border-yellow-400 bg-[#1e2a4a] text-white" 
                />
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-[#1e2a4a] rounded-2xl">
                  <Input value={goalForm.player} onChange={e => setGoalForm(p => ({...p, player: e.target.value}))} placeholder="اسم اللاعب" className="bg-[#0a1428] border-yellow-400 text-white" />
                  <select value={goalForm.team} onChange={e => setGoalForm(p => ({...p, team: e.target.value}))} className="bg-[#0a1428] border border-yellow-400 rounded-2xl p-3 text-white">
                    {sortedTeams.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <Input type="number" value={goalForm.goalsCount} onChange={e => setGoalForm(p => ({...p, goalsCount: Number(e.target.value)}))} placeholder="عدد الأهداف" className="bg-[#0a1428] border-yellow-400 text-white" />
                  <Button onClick={addOrUpdateGoal} className="bg-yellow-400 text-black font-bold">
                    {editingGoalId ? "تعديل" : "إضافة"}
                  </Button>
                </div>

                <div className="space-y-3">
                  {filteredGoals.length === 0 ? (
                    <p className="text-center py-12 text-cyan-300">لا توجد أهداف</p>
                  ) : filteredGoals.map(goal => (
                    <Card key={goal.id} className="bg-[#1e2a4a] border border-yellow-400/30">
                      <CardContent className="p-4 flex justify-between items-center text-white">
                        <div>
                          <div className="font-bold">{goal.player}</div>
                          <div className="text-cyan-300">{goal.team} — {goal.goals} هدف</div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => startEditGoal(goal)} className="bg-yellow-400 text-black">
                            <Edit className="ml-2 h-4 w-4" /> تعديل
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => deleteGoal(goal.id)}>
                            <Trash2 className="ml-2 h-4 w-4" /> حذف
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* كروت */}
          <TabsContent value="cards">
            <Card className="border-yellow-400 bg-[#13213a]">
              <CardHeader>
                <CardTitle className="text-yellow-300">إدارة الإنذارات والبطاقات</CardTitle>
                <Input placeholder="ابحث عن لاعب..." value={cardSearchTerm} onChange={(e) => setCardSearchTerm(e.target.value)} className="mt-4 max-w-md border-yellow-400 bg-[#1e2a4a] text-white" />
              </CardHeader>
              <CardContent className="space-y-6 p-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-[#1e2a4a] rounded-2xl">
                  <Input value={cardForm.player} onChange={e => setCardForm(p => ({...p, player: e.target.value}))} placeholder="اسم اللاعب" className="bg-[#0a1428] border-yellow-400 text-white" />
                  <select value={cardForm.team} onChange={e => setCardForm(p => ({...p, team: e.target.value}))} className="bg-[#0a1428] border border-yellow-400 rounded-2xl p-3 text-white">
                    {sortedTeams.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <select value={cardForm.type} onChange={e => setCardForm(p => ({...p, type: e.target.value as "yellow" | "red"}))} className="bg-[#0a1428] border border-yellow-400 rounded-2xl p-3 text-white">
                    <option value="yellow">إنذار أصفر</option>
                    <option value="red">بطاقة حمراء</option>
                  </select>
                  <Button onClick={addCard} className="bg-yellow-400 text-black font-bold">إضافة</Button>
                </div>

                <div className="space-y-3">
                  {filteredCards.length === 0 ? (
                    <p className="text-center py-12 text-cyan-300">لا توجد نتائج</p>
                  ) : filteredCards.map(item => (
                    <Card key={item.id} className="bg-[#1e2a4a] border border-yellow-400/30">
                      <CardContent className="p-4 flex flex-col sm:flex-row justify-between items-center gap-4 text-white">
                        <div>
                          <div className="font-bold text-lg">{item.player}</div>
                          <div className="text-cyan-300">{item.team}</div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => updateCard(item.id, Math.max(0, item.yellow - 1), item.red)} className="border-yellow-400 text-white">
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="px-4 py-1 bg-yellow-400/20 text-yellow-300 font-bold rounded">🟨 {item.yellow}</span>
                            <Button size="sm" variant="outline" onClick={() => updateCard(item.id, item.yellow + 1, item.red)} className="border-yellow-400 text-white">
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => updateCard(item.id, item.yellow, Math.max(0, item.red - 1))} className="border-red-400 text-white">
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="px-4 py-1 bg-red-500/20 text-red-300 font-bold rounded">🟥 {item.red}</span>
                            <Button size="sm" variant="outline" onClick={() => updateCard(item.id, item.yellow, item.red + 1)} className="border-red-400 text-white">
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          <Button size="sm" variant="destructive" onClick={() => deleteCard(item.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ticker">
            <Card className="border-yellow-400 bg-[#13213a]">
              <CardHeader><CardTitle className="text-yellow-300">شريط الأخبار</CardTitle></CardHeader>
              <CardContent className="p-6 space-y-6">
                <Input value={tickerText} onChange={e => setTickerText(e.target.value)} placeholder="اكتب الخبر هنا..." className="py-8 text-lg bg-[#1e2a4a] border-yellow-400 text-white" />
                <Button onClick={saveTicker} className="w-full bg-yellow-400 text-black py-7 font-bold">حفظ ونشر الخبر</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
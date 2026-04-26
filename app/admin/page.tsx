"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trophy, LogOut, Edit, Trash2, Plus, Minus, PlayCircle } from "lucide-react";
import {
  collection, addDoc, deleteDoc, doc, updateDoc, onSnapshot, setDoc,
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
  isLive?: boolean;
  liveMinute?: number;
};

type GoalEvent = { id: string; player?: string; team?: string; goals: number };
type CardEvent = { id: string; player?: string; team?: string; yellow: number; red: number };

export default function AdminPage() {
  const [isAuth, setIsAuth] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "today" | "tomorrow" | "live" | "goals" | "cards" | "ticker">("all");

  const [matches, setMatches] = useState<AdminMatch[]>([]);
  const [goals, setGoals] = useState<GoalEvent[]>([]);
  const [cardEvents, setCardEvents] = useState<CardEvent[]>([]);
  const [tickerText, setTickerText] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [goalSearchTerm, setGoalSearchTerm] = useState("");
  const [cardSearchTerm, setCardSearchTerm] = useState("");

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
    m.date !== todayStr && m.date !== tomorrowStr && !m.isLive
  ));

  const liveMatches = sortMatches(matches.filter(m => m.isLive === true));

  const todayMatches = sortMatches(matches.filter(m => 
    m.date === todayStr && Number(m.homeGoals) === 0 && Number(m.awayGoals) === 0 && !m.isLive
  ));

  const tomorrowMatches = sortMatches(matches.filter(m => 
    m.date === tomorrowStr && Number(m.homeGoals) === 0 && Number(m.awayGoals) === 0 && !m.isLive
  ));

  const filteredPrevious = previousMatches.filter(m =>
    (m.teamA || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (m.teamB || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredGoals = goals.filter(g => {
    const player = String(g.player || "").toLowerCase();
    const team = String(g.team || "").toLowerCase();
    const search = goalSearchTerm.toLowerCase();
    return player.includes(search) || team.includes(search);
  });

  const filteredCards = cardEvents.filter(item =>
    (item.player || "").toLowerCase().includes(cardSearchTerm.toLowerCase()) ||
    (item.team || "").toLowerCase().includes(cardSearchTerm.toLowerCase())
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

  const saveMatch = async () => { /* ... نفس الكود السابق ... */ 
    // (الكود كامل كما في النسخ السابقة)
  };

  const startEdit = (match: AdminMatch) => {
    setEditingId(match.id);
    setMatchForm({ ...match });
  };

  const deleteMatch = async (id: string) => {
    if (!confirm("متأكد من الحذف؟")) return;
    await deleteDoc(doc(db, "matches", id));
  };

  const makeLive = async (id: string) => {
    await updateDoc(doc(db, "matches", id), { 
      isLive: true,
      liveMinute: 1 
    });
    alert("✅ تم تحويل المباراة إلى لايف");
  };

  const updateLiveMinute = async (id: string, minute: number) => {
    await updateDoc(doc(db, "matches", id), { liveMinute: minute });
  };

  // باقي الدوال (addOrUpdateGoal, addCard, etc.) كما هي

  if (!isAuth) {
    // نموذج الدخول كما هو
  }

  return (
    <div dir="rtl" className="min-h-screen bg-[#0a1428] text-white">
      <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        {/* الهيدر */}
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
          <TabsList className="grid grid-cols-4 md:grid-cols-7 bg-[#13213a] border border-yellow-400/50 p-1.5 rounded-2xl mb-8">
            <TabsTrigger value="all" className="data-[state=active]:bg-black data-[state=active]:text-yellow-300 data-[state=inactive]:bg-[#1e2a4a] data-[state=inactive]:text-white font-bold py-3 rounded-xl">السابقة</TabsTrigger>
            <TabsTrigger value="live" className="data-[state=active]:bg-red-600 data-[state=active]:text-white data-[state=inactive]:bg-[#1e2a4a] data-[state=inactive]:text-white font-bold py-3 rounded-xl">🔴 لايف</TabsTrigger>
            <TabsTrigger value="today" className="data-[state=active]:bg-black data-[state=active]:text-yellow-300 data-[state=inactive]:bg-[#1e2a4a] data-[state=inactive]:text-white font-bold py-3 rounded-xl">اليوم</TabsTrigger>
            <TabsTrigger value="tomorrow" className="data-[state=active]:bg-black data-[state=active]:text-yellow-300 data-[state=inactive]:bg-[#1e2a4a] data-[state=inactive]:text-white font-bold py-3 rounded-xl">غداً</TabsTrigger>
            <TabsTrigger value="goals" className="data-[state=active]:bg-black data-[state=active]:text-yellow-300 data-[state=inactive]:bg-[#1e2a4a] data-[state=inactive]:text-white font-bold py-3 rounded-xl">أهداف</TabsTrigger>
            <TabsTrigger value="cards" className="data-[state=active]:bg-black data-[state=active]:text-yellow-300 data-[state=inactive]:bg-[#1e2a4a] data-[state=inactive]:text-white font-bold py-3 rounded-xl">كروت</TabsTrigger>
            <TabsTrigger value="ticker" className="data-[state=active]:bg-black data-[state=active]:text-yellow-300 data-[state=inactive]:bg-[#1e2a4a] data-[state=inactive]:text-white font-bold py-3 rounded-xl">الأخبار</TabsTrigger>
          </TabsList>

          {/* تبويب لايف */}
          <TabsContent value="live">
            <Card className="border-red-500 bg-[#13213a]">
              <CardHeader>
                <CardTitle className="text-red-500 flex items-center gap-3">
                  🔴 مباريات لايف ({liveMatches.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {liveMatches.length === 0 ? (
                  <p className="text-center py-12 text-cyan-300">لا توجد مباريات لايف حالياً</p>
                ) : liveMatches.map(m => (
                  <div key={m.id} className="bg-[#1e2a4a] p-5 rounded-2xl border border-red-500">
                    <div className="flex justify-between items-center">
                      <div className="font-bold text-xl text-white">
                        {m.teamA} {m.homeGoals} - {m.awayGoals} {m.teamB}
                      </div>
                      <div className="text-red-400 font-bold text-lg">{m.liveMinute || 0}'</div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button onClick={() => updateLiveMinute(m.id, (m.liveMinute || 0) + 1)} className="bg-red-600">
                        + دقيقة
                      </Button>
                      <Button onClick={() => makeLive(m.id)} variant="outline" className="border-red-500 text-red-400">
                        إيقاف لايف
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* باقي التبويبات (all, today, tomorrow, goals, cards, ticker) كما هي مع sortedTeams */}
          {/* ... (انسخ باقي الكود من النسخة السابقة) ... */}

        </Tabs>
      </div>
    </div>
  );
}
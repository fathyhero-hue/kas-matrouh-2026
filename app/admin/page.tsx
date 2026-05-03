"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Trophy, LogOut, Edit, Trash2, Plus, Minus, Play, Pause, BellRing, Video, Gift, Star, Users, Share2, Copy, Activity, ArchiveRestore, Search, ShieldAlert, ClipboardList, Lock, Unlock, Phone, CheckCircle2, Shield } from "lucide-react";
import { collection, addDoc, deleteDoc, doc, updateDoc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { TEAM_NAMES } from "@/data/tournament";

const ADMIN_PASSWORD = "hero123";

const cleanTeamString = (name: any) => String(name || "").replace(/النجيلّة/g, "النجيلة").replace(/علّوش/g, "علوش").trim();
const CLEANED_TEAM_NAMES = Array.from(new Set(TEAM_NAMES.map(t => cleanTeamString(t))));

const PLAYOFF_TEAMS = [
  "اسماك باسط العوامي", "اصدقاء عز بوالمجدوبة", "السلوم", "اصدقاء عيسي المغواري",
  "17 فبراير", "الفهود", "اصدقاء قسم الله", "اصدقاء سلامة بدر",
  "ايس كريم الملكة", "غوط رباح", "محاربي الصحراء", "اصدقاء خالد",
  "ام القبائل", "شباب القناشات", "اتحاد المثاني", "دبي للزي العربي"
];

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

function normalizeTeamName(name: string): string { return String(name || "").trim().replace(/\s+/g, " ").replace(/أ|إ|آ/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/ـ/g, "").replace(/ّ/g, "").toLowerCase(); }

function sortMatches(arr: any[]) { return [...arr].sort((a, b) => { if (a.date !== b.date) return b.date.localeCompare(a.date); return (b.time || "00:00").localeCompare(a.time || "00:00"); }); }

function getArabicDay(dateString: string): string {
  if (!dateString) return "";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "";
  const days = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  return days[d.getDay()];
}

const getLabelSuggestions = (round: string) => {
  if (round === "الملحق") return ["م 97", "م 98", "م 99", "م 100", "م 101", "م 102", "م 103", "م 104"];
  if (round === "دور الستة عشر") return ["م 1", "م 2", "م 3", "م 4", "م 5", "م 6", "م 7", "م 8"];
  if (round === "دور الثمانية") return ["مربع 1", "مربع 2", "مربع 3", "مربع 4"];
  if (round === "نصف النهائي") return ["نصف 1", "نصف 2"];
  if (round === "النهائي") return ["النهائي"];
  return [];
};

const generatePostContent = (match: any) => {
  return `🏆 بطولة كأس مطروح - النسخة الثالثة 🦅\n\n` +
         `🔥 انتهت المباراة المشتعلة بين:\n` +
         `⚽ ${match.teamA} [ ${match.homeGoals} - ${match.awayGoals} ] ${match.teamB}\n\n` +
         `📅 ${getArabicDay(match.date)} • ${match.date}\n` +
         (match.matchLabel ? `📌 ${match.matchLabel} - ${match.round}\n` : `📌 ${match.round}\n`) +
         ((match.redCardsHome > 0 || match.redCardsAway > 0) ? `\n🟥 حالات الطرد: ${match.redCardsHome + match.redCardsAway}\n` : "") +
         `\n#كأس_مطروح_2026 #النسخة_الثالثة #مطروح_الرياضية #فتحي_هيرو 🦅`;
};

const pushNotification = async (title: string, body: string) => {
  try {
     const res = await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body })
     });
     return res.ok;
  } catch(e) { 
     console.error(e); 
     return false; 
  }
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

export default function AdminPage() {
  const [isAuth, setIsAuth] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  
  const [activeTournament, setActiveTournament] = useState<'youth' | 'juniors'>('youth'); 
  const [activeTab, setActiveTab] = useState("rosters");

  const [matches, setMatches] = useState<any[]>([]);
  const matchesRef = useRef<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [cardEvents, setCardEvents] = useState<any[]>([]);
  const [mediaItems, setMediaItems] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [motmList, setMotmList] = useState<any[]>([]);
  const [formationsList, setFormationsList] = useState<any[]>([]); 
  const [rostersList, setRostersList] = useState<any[]>([]); 

  const [tickerText, setTickerText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [goalSearchTerm, setGoalSearchTerm] = useState("");
  const [cardSearchTerm, setCardSearchTerm] = useState("");

  const [notifyTitle, setNotifyTitle] = useState("");
  const [notifyBody, setNotifyBody] = useState("");
  const [isSending, setIsSending] = useState(false);

  const [shareMatch, setShareMatch] = useState<any | null>(null);
  const [time, setTime] = useState<Date | null>(null);

  const sortedTeams = useMemo(() => Array.from(new Set([...CLEANED_TEAM_NAMES, ...PLAYOFF_TEAMS])).sort((a, b) => a.localeCompare(b, "ar")), []);
  const sortedJuniorsTeams = useMemo(() => [...JUNIORS_TEAMS].sort((a, b) => a.localeCompare(b, "ar")), []);
  const currentTeamsList = activeTournament === 'youth' ? sortedTeams : sortedJuniorsTeams;

  const [matchForm, setMatchForm] = useState({
    teamA: "", teamALogo: "", teamB: "", teamBLogo: "", homeGoals: 0, awayGoals: 0, matchLabel: "",
    round: "الجولة الأولى", date: new Date().toISOString().slice(0, 10), time: "15:30", status: "لم تبدأ"
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const defaultStats = { rating: 99, pac: 99, sho: 99, pas: 99, dri: 99, def: 99, phy: 99 };
  const [goalForm, setGoalForm] = useState({ player: "", team: currentTeamsList[0] || "", goalsCount: 1, imageUrl: "", ...defaultStats });
  const [motmForm, setMotmForm] = useState({ player: "", team: currentTeamsList[0] || "", imageUrl: "", sponsorName: SPONSORS[0].name, sponsorLogo: SPONSORS[0].src, ...defaultStats });
  
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editingMotmId, setEditingMotmId] = useState<string | null>(null); 
  const [cardForm, setCardForm] = useState({ player: "", team: currentTeamsList[0] || "", type: "yellow" as "yellow" | "red" });
  const [mediaForm, setMediaForm] = useState({ title: "", url: "" });

  const defaultPlayer = { name: "", team: "", imageUrl: "", rating: 99 };
  const [formationForm, setFormationForm] = useState({
    round: "دور المجموعات",
    players: Array(7).fill({...defaultPlayer})
  });

  const [liveEventForms, setLiveEventForms] = useState<Record<string, { minute?: number, type: string, text: string }>>({});

  // Roster Admin States
  const [editingRosterId, setEditingRosterId] = useState<string | null>(null);
  const [rosterFormAdmin, setRosterFormAdmin] = useState({
    managerName: "", managerPhone: "", password: "", isSubmitted: false,
    players: Array.from({ length: 12 }, () => ({ name: "", number: "" }))
  });

  useEffect(() => {
    const clockTimer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(clockTimer);
  }, []);

  useEffect(() => {
    setMatchForm(p => ({...p, teamA: "", teamALogo: "", teamB: "", teamBLogo: "", matchLabel: ""}));
    setGoalForm(p => ({...p, team: currentTeamsList[0] || "", player: "", goalsCount: 1, imageUrl: ""}));
    setCardForm(p => ({...p, team: currentTeamsList[0] || "", player: ""}));
    setMotmForm(p => ({...p, team: currentTeamsList[0] || "", player: "", imageUrl: ""}));
    setEditingId(null); setEditingGoalId(null); setEditingMotmId(null); setEditingRosterId(null);
  }, [activeTournament, currentTeamsList]);

  useEffect(() => {
    const existing = formationsList.find(f => f.round === formationForm.round);
    if(existing) {
        const playersArr = Array.isArray(existing.players) ? [...existing.players] : Array(7).fill({...defaultPlayer});
        while(playersArr.length < 7) playersArr.push({...defaultPlayer});
        setFormationForm({ round: existing.round, players: playersArr });
    } else {
        setFormationForm(p => ({ ...p, players: Array(7).fill({...defaultPlayer}) }));
    }
  }, [formationForm.round, formationsList]);

  const getColl = (base: string) => activeTournament === "juniors" ? `${base}_juniors` : base;

  useEffect(() => { matchesRef.current = matches; }, [matches]);

  useEffect(() => {
    if (!isAuth) return;
    const collName = getColl("matches");
    const unsubMatches = onSnapshot(collection(db, collName), (snap) => setMatches(snap.docs.map(d => ({ id: d.id, ...d.data(), teamA: cleanTeamString(d.data().teamA), teamB: cleanTeamString(d.data().teamB) }))));
    const unsubGoals = onSnapshot(collection(db, getColl("goals")), (snap) => setGoals(snap.docs.map(d => ({ id: d.id, ...d.data(), team: cleanTeamString(d.data().team) }))));
    const unsubCards = onSnapshot(collection(db, getColl("cards")), (snap) => setCardEvents(snap.docs.map(d => ({ id: d.id, ...d.data(), team: cleanTeamString(d.data().team) }))));
    const unsubMedia = onSnapshot(collection(db, getColl("media")), (snap) => setMediaItems(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubPredictions = onSnapshot(collection(db, getColl("predictions")), (snap) => setPredictions(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a:any, b:any) => b.timestamp?.localeCompare(a.timestamp) || 0)));
    const unsubMotm = onSnapshot(collection(db, getColl("motm")), (snap) => setMotmList(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubForms = onSnapshot(collection(db, getColl("formations")), (snap) => setFormationsList(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubRosters = onSnapshot(collection(db, getColl("team_rosters")), (snap) => setRostersList(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubTicker = onSnapshot(doc(db, "settings", "ticker"), (docSnap) => setTickerText(docSnap.data()?.text || ""));

    const timerInterval = setInterval(() => {
      matchesRef.current.forEach(m => {
        if (m.isTimerRunning && m.status !== "انتهت" && m.status !== "استراحة" && m.status !== "ضربات جزاء" && m.status !== "ستبدأ بعد قليل") {
          updateDoc(doc(db, collName, m.id), { liveMinute: (m.liveMinute || 0) + 1 });
        }
      });
    }, 60000); 

    return () => { 
        unsubMatches(); unsubGoals(); unsubCards(); unsubMedia(); 
        unsubPredictions(); unsubMotm(); unsubForms(); unsubRosters(); unsubTicker(); 
        clearInterval(timerInterval); 
    };
  }, [isAuth, activeTournament]);

  const handleLogin = () => passwordInput === ADMIN_PASSWORD ? setIsAuth(true) : alert("كلمة السر خاطئة");

  // Admin Roster Functions
  const startEditRoster = (teamName: string) => {
    const existing = rostersList.find(r => r.id === teamName);
    let loadedPlayers = Array.from({ length: 12 }, () => ({ name: "", number: "" }));
    if (existing && existing.players) {
        loadedPlayers = [...existing.players];
        while(loadedPlayers.length < 12) loadedPlayers.push({ name: "", number: "" });
    }
    setRosterFormAdmin({
        managerName: existing?.managerName || "",
        managerPhone: existing?.managerPhone || "",
        password: existing?.password || "",
        isSubmitted: existing?.isSubmitted || false,
        players: loadedPlayers.slice(0,12)
    });
    setEditingRosterId(teamName);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const updateAdminRosterPlayer = (index: number, field: string, value: string) => {
    setRosterFormAdmin(prev => {
        const newPlayers = [...prev.players];
        newPlayers[index] = { ...newPlayers[index], [field]: value };
        return { ...prev, players: newPlayers };
    });
  };

  const saveRosterAdmin = async () => {
    if(!editingRosterId) return;
    try {
        await setDoc(doc(db, getColl("team_rosters"), editingRosterId), {
            teamName: editingRosterId,
            managerName: rosterFormAdmin.managerName,
            managerPhone: rosterFormAdmin.managerPhone,
            password: rosterFormAdmin.password,
            isSubmitted: rosterFormAdmin.isSubmitted,
            players: rosterFormAdmin.players,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        alert("تم حفظ بيانات القائمة بنجاح! ✔️");
        setEditingRosterId(null);
    } catch(e) {
        alert("حدث خطأ أثناء الحفظ.");
    }
  };

  const deleteRoster = async (teamName: string) => {
    if(confirm(`⚠️ هل أنت متأكد من مسح قائمة فريق ${teamName} بالكامل؟`)) {
        await deleteDoc(doc(db, getColl("team_rosters"), teamName));
        alert("تم مسح القائمة بنجاح.");
    }
  };

  const unlockRoster = async (teamName: string) => {
    if(confirm(`هل تريد فتح القفل لقائمة فريق ${teamName} ليتمكن المدير من التعديل عليها؟`)) {
        await updateDoc(doc(db, getColl("team_rosters"), teamName), { isSubmitted: false });
        alert("تم فتح القائمة بنجاح. يمكن للمدير التعديل الآن. 🔓");
    }
  };

  const lockRoster = async (teamName: string) => {
    await updateDoc(doc(db, getColl("team_rosters"), teamName), { isSubmitted: true });
    alert("تم قفل القائمة واعتمادها. 🔒");
  };

  // Match & Stats Functions
  const saveMatch = async () => {
    if (!matchForm.teamA.trim() || !matchForm.teamB.trim()) return alert("يجب إدخال أسماء الفرق!");
    const dayName = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"][new Date(matchForm.date).getDay()];
    const data = { ...matchForm, dayName, isLive: false, streamClosed: false };
    if (editingId) { 
      await updateDoc(doc(db, getColl("matches"), editingId), data); 
      setEditingId(null); 
      alert("✅ تم تعديل المباراة بنجاح");
    } else { 
      await addDoc(collection(db, getColl("matches")), data); 
      alert("✅ تم إضافة المباراة بنجاح");
    }
    setMatchForm({ teamA: "", teamALogo: "", teamB: "", teamBLogo: "", homeGoals: 0, awayGoals: 0, matchLabel: "", round: "الجولة الأولى", date: new Date().toISOString().slice(0, 10), time: "15:30", status: "لم تبدأ" });
  };

  const startEdit = (match: any) => { 
    setEditingId(match.id); 
    setMatchForm({ 
      teamA: match.teamA, teamALogo: match.teamALogo || "", 
      teamB: match.teamB, teamBLogo: match.teamBLogo || "", 
      homeGoals: match.homeGoals, awayGoals: match.awayGoals, 
      matchLabel: match.matchLabel || "", round: match.round, 
      date: match.date, time: match.time, status: match.status || "لم تبدأ" 
    }); 
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
  };
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

  const addLiveEvent = async (matchId: string, currentLiveMinute: number) => {
    const form = liveEventForms[matchId] || {};
    if (!form.text || !form.text.trim()) return alert("يرجى كتابة تفاصيل الحدث!");
    const minute = form.minute !== undefined ? form.minute : currentLiveMinute;
    const currentMatch = matches.find(m => m.id === matchId);
    if(!currentMatch) return;
    const newEvent = { minute, type: form.type || 'info', text: form.text.trim() };
    const updatedEvents = [...(currentMatch.liveEvents || []), newEvent];
    await updateDoc(doc(db, getColl("matches"), matchId), { liveEvents: updatedEvents });
    setLiveEventForms(p => ({ ...p, [matchId]: { minute: currentLiveMinute, type: 'info', text: '' } }));
  };

  const deleteLiveEvent = async (matchId: string, eventIndex: number) => {
    if(!confirm("هل تريد حذف هذا الحدث من التايم لاين؟")) return;
    const currentMatch = matches.find(m => m.id === matchId);
    if(!currentMatch) return;
    const updatedEvents = [...(currentMatch.liveEvents || [])];
    updatedEvents.splice(eventIndex, 1);
    await updateDoc(doc(db, getColl("matches"), matchId), { liveEvents: updatedEvents });
  };

  const sendQuickNotification = async (title: string, body: string) => {
    const success = await pushNotification(title, body);
    if(success) alert(`✅ تم إرسال الإشعار السريع بنجاح!`);
    else alert("❌ حدث خطأ في الإرسال.");
  };

  const sendNotification = async () => {
    if (!notifyTitle || !notifyBody) return alert("اكتب عنوان وتفاصيل الإشعار!");
    setIsSending(true);
    const success = await pushNotification(notifyTitle, notifyBody);
    if (success) {
      alert(`✅ تم إرسال الإشعار لجميع الأجهزة!`);
      setNotifyTitle(""); setNotifyBody("");
    } else {
      alert("❌ فشل الإرسال.");
    }
    setIsSending(false);
  };

  const addOrUpdateGoal = async () => {
    if (!goalForm.player.trim()) return alert("اكتب اسم اللاعب");
    const playerNameTrimmed = goalForm.player.trim(); 
    const teamSelected = goalForm.team; 
    
    const statsData: any = {
      goals: Number(goalForm.goalsCount),
      rating: Number(goalForm.rating),
      pac: Number(goalForm.pac), sho: Number(goalForm.sho), pas: Number(goalForm.pas), dri: Number(goalForm.dri), def: Number(goalForm.def), phy: Number(goalForm.phy)
    };
    if (goalForm.imageUrl.trim()) statsData.imageUrl = goalForm.imageUrl.trim();

    if (editingGoalId) { 
      await updateDoc(doc(db, getColl("goals"), editingGoalId), { player: playerNameTrimmed, team: teamSelected, ...statsData }); 
      setEditingGoalId(null); 
      alert("✅ تم التعديل بنجاح");
    } else { 
      const existingPlayer = goals.find(g => normalizeTeamName(g.player) === normalizeTeamName(playerNameTrimmed) && g.team === teamSelected);
      if (existingPlayer) {
        const updateData: any = { ...statsData, goals: (Number(existingPlayer.goals) || 0) + statsData.goals }; 
        await updateDoc(doc(db, getColl("goals"), existingPlayer.id), updateData); 
        alert(`✅ تم التحديث تراكمياً`);
      } else {
        await addDoc(collection(db, getColl("goals")), { player: playerNameTrimmed, team: teamSelected, ...statsData }); 
        alert("✅ تم الإضافة بنجاح");
      }
    }
    setGoalForm({ player: "", team: currentTeamsList[0] || "", goalsCount: 1, imageUrl: "", ...defaultStats });
  };

  const startEditGoal = (goal: any) => { 
    setEditingGoalId(goal.id); 
    setGoalForm({ 
      player: goal.player, team: goal.team, goalsCount: goal.goals, imageUrl: goal.imageUrl || "",
      rating: goal.rating || 99, pac: goal.pac || 99, sho: goal.sho || 99, pas: goal.pas || 99, dri: goal.dri || 99, def: goal.def || 99, phy: goal.phy || 99
    }); 
  };
  const deleteGoal = async (id: string) => confirm("حذف هذا الهدف؟") && await deleteDoc(doc(db, getColl("goals"), id));

  const addCard = async () => {
    if (!cardForm.player.trim()) return alert("اكتب اسم اللاعب");
    const playerNameTrimmed = cardForm.player.trim();
    const teamSelected = cardForm.team;
    const existingPlayer = cardEvents.find(c => normalizeTeamName(c.player) === normalizeTeamName(playerNameTrimmed) && c.team === teamSelected);
    if (existingPlayer) {
       const newYellow = (Number(existingPlayer.yellow) || 0) + (cardForm.type === "yellow" ? 1 : 0);
       const newRed = (Number(existingPlayer.red) || 0) + (cardForm.type === "red" ? 1 : 0);
       await updateDoc(doc(db, getColl("cards"), existingPlayer.id), { yellow: newYellow, red: newRed });
       alert(`✅ تم تحديث الكروت بنجاح!`);
    } else {
       await addDoc(collection(db, getColl("cards")), { player: playerNameTrimmed, team: teamSelected, yellow: cardForm.type === "yellow" ? 1 : 0, red: cardForm.type === "red" ? 1 : 0 });
       alert("✅ تم إضافة البطاقة بنجاح");
    }
    setCardForm(p => ({ ...p, player: "" })); 
  };
  const updateCard = async (id: string, yellow: number, red: number) => await updateDoc(doc(db, getColl("cards"), id), { yellow, red });
  const deleteCard = async (id: string) => confirm("حذف هذه البطاقة؟") && await deleteDoc(doc(db, getColl("cards"), id));

  const archiveAndResetCards = async () => {
    if (!confirm("⚠️ هل أنت متأكد من تصفير الكروت ونقلها للأرشيف؟")) return;
    try {
      for (const card of cardEvents) {
        if (card.yellow > 0 || card.red > 0) {
          await addDoc(collection(db, getColl("archived_cards")), { ...card, archivedAt: new Date().toISOString() });
          await updateDoc(doc(db, getColl("cards"), card.id), { yellow: 0, red: 0 });
        }
      }
      alert(`✅ تمت عملية الأرشفة والتصفير بنجاح`);
    } catch (e) { alert("حدث خطأ أثناء الأرشفة."); }
  };

  const addMedia = async () => {
    if (!mediaForm.title || !mediaForm.url) return alert("اكتب عنوان ورابط الفيديو");
    await addDoc(collection(db, getColl("media")), mediaForm);
    setMediaForm({ title: "", url: "" }); 
    alert("✅ تم إضافة الفيديو بنجاح");
  };
  const deleteMedia = async (id: string) => confirm("حذف هذا الفيديو؟") && await deleteDoc(doc(db, getColl("media"), id));

  const addMotm = async () => {
    if (!motmForm.player.trim()) return alert("يجب كتابة اسم اللاعب!");
    const data = { ...motmForm, rating: Number(motmForm.rating), pac: Number(motmForm.pac), sho: Number(motmForm.sho), pas: Number(motmForm.pas), dri: Number(motmForm.dri), def: Number(motmForm.def), phy: Number(motmForm.phy) };
    if (editingMotmId) {
      await updateDoc(doc(db, getColl("motm"), editingMotmId), data);
      setEditingMotmId(null);
      alert("✅ تم تعديل بيانات النجم بنجاح");
    } else {
      await addDoc(collection(db, getColl("motm")), data);
      alert("✅ تم إضافة النجم بنجاح");
    }
    setMotmForm({ player: "", team: currentTeamsList[0] || "", imageUrl: "", sponsorName: SPONSORS[0].name, sponsorLogo: SPONSORS[0].src, ...defaultStats }); 
  };

  const startEditMotm = (m: any) => {
    setEditingMotmId(m.id);
    setMotmForm({
      player: m.player || "", team: m.team || currentTeamsList[0], imageUrl: m.imageUrl || "", sponsorName: m.sponsorName || SPONSORS[0].name, sponsorLogo: m.sponsorLogo || SPONSORS[0].src,
      rating: m.rating || 99, pac: m.pac || 99, sho: m.sho || 99, pas: m.pas || 99, dri: m.dri || 99, def: m.def || 99, phy: m.phy || 99
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const deleteMotm = async (id: string) => confirm("حذف هذا اللاعب؟") && await deleteDoc(doc(db, getColl("motm"), id));

  const saveFormation = async () => {
    const existing = formationsList.find(f => f.round === formationForm.round);
    if(existing) {
       await updateDoc(doc(db, getColl("formations"), existing.id), { players: formationForm.players });
       alert("✅ تم التحديث بنجاح");
    } else {
       await addDoc(collection(db, getColl("formations")), { round: formationForm.round, players: formationForm.players });
       alert("✅ تم الحفظ بنجاح");
    }
  };

  const updateFormationPlayer = (index: number, field: string, value: any) => {
    setFormationForm(prev => {
      const newPlayers = [...prev.players];
      newPlayers[index] = { ...newPlayers[index], [field]: value };
      return { ...prev, players: newPlayers };
    });
  };

  const deletePrediction = async (id: string) => confirm("حذف التوقع؟") && await deleteDoc(doc(db, getColl("predictions"), id));
  const deleteAllPredictions = async () => {
     if (!confirm("⚠️ هل أنت متأكد من مسح جميع التوقعات؟")) return;
     for (const p of predictions) { await deleteDoc(doc(db, getColl("predictions"), p.id)); }
     alert("✅ تم التصفية بنجاح");
  };

  const saveTicker = async () => {
    if (!tickerText.trim()) return alert("اكتب الخبر أولاً");
    await setDoc(doc(db, "settings", "ticker"), { text: tickerText.trim() }); 
    alert("✅ تم نشر الخبر بنجاح");
  };

  const safeGoalSearch = goalSearchTerm.toLowerCase(); 
  const filteredGoals = goals.filter(g => normalizeTeamName(g.player).includes(safeGoalSearch) || normalizeTeamName(g.team).includes(safeGoalSearch));
  const safeCardSearch = cardSearchTerm.toLowerCase(); 
  const filteredCards = cardEvents.filter(c => normalizeTeamName(c.player).includes(safeCardSearch) || normalizeTeamName(c.team).includes(safeCardSearch));

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
  const liveMatches = sortMatches(liveMatchesList);
  const liveMatchIds = new Set(liveMatchesList.map(m => m.id));

  if (!isAuth) return (
    <div dir="rtl" className="min-h-screen bg-[#0a1428] flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-yellow-400 bg-[#13213a]">
        <CardHeader className="text-center"><Trophy className="mx-auto h-12 w-12 text-yellow-400" /><CardTitle className="text-2xl font-black text-yellow-300 mt-4">إدارة كأس مطروح</CardTitle></CardHeader>
        <CardContent className="space-y-4"><Input type="password" placeholder="كلمة السر" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} className="bg-[#1e2a4a] border-yellow-400 text-white h-12 text-center text-xl" /><Button onClick={handleLogin} className="w-full bg-yellow-400 text-black font-bold h-12">دخول</Button></CardContent>
      </Card>
    </div>
  );

  return (
    <div dir="rtl" className="min-h-screen bg-[#0a1428] text-white pb-20 font-sans">
      <datalist id="teams-list">{currentTeamsList.map(t => <option key={t} value={t} />)}</datalist>
      <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        <header className="mb-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-center sm:text-right">
             <h1 className="text-3xl sm:text-4xl font-black text-yellow-300">لوحة الإدارة الاحترافية</h1>
             <p className="text-cyan-300">بطولة كأس مطروح ٢٠٢٦</p>
          </div>
          <Button onClick={() => setIsAuth(false)} variant="outline" className="border-yellow-400 text-white hover:bg-yellow-400 hover:text-black">خروج <LogOut className="ml-2 h-4 w-4" /></Button>
        </header>

        <div className="flex justify-center mb-8">
          <div className="bg-[#13213a] p-2 rounded-xl border border-yellow-400/30 inline-flex shadow-xl gap-2 w-full max-w-md">
            <button onClick={() => setActiveTournament('youth')} className={`flex-1 py-3 rounded-lg text-lg sm:text-xl font-black transition-all ${activeTournament === 'youth' ? 'bg-yellow-400 text-black shadow-[0_0_15px_rgba(250,204,21,0.4)]' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>إدارة الشباب 🏆</button>
            <button onClick={() => setActiveTournament('juniors')} className={`flex-1 py-3 rounded-lg text-lg sm:text-xl font-black transition-all ${activeTournament === 'juniors' ? 'bg-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>إدارة الناشئين 🏅</button>
          </div>
        </div>

        {shareMatch && (
          <div className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-gradient-to-br from-[#1e2a4a] to-[#13213a] border-2 border-emerald-500 p-6 rounded-3xl max-w-lg w-full shadow-[0_0_30px_rgba(16,185,129,0.4)]">
               <h3 className="text-2xl font-black text-emerald-400 mb-4 flex items-center gap-2"><Share2 /> جاهز للنشر السريع</h3>
               <textarea readOnly value={generatePostContent(shareMatch)} className="w-full h-48 bg-[#0a1428] text-white p-4 rounded-xl border border-emerald-500/50 resize-none font-bold mb-4 focus:outline-none" />
               <div className="flex gap-4">
                 <Button onClick={() => { navigator.clipboard.writeText(generatePostContent(shareMatch)); alert("تم نسخ النص! 📋"); }} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-black h-12 text-lg"><Copy className="ml-2 h-5 w-5"/> نسخ النص</Button>
                 <Button onClick={() => setShareMatch(null)} variant="outline" className="border-red-500 text-white hover:bg-red-500 h-12 font-bold px-8">إغلاق</Button>
               </div>
            </div>
          </div>
        )}

        <Card className={`border ${activeTournament === 'juniors' ? 'border-cyan-500' : 'border-yellow-400'} bg-[#13213a] mb-8 mt-4 shadow-2xl transition-colors`}>
          <CardHeader><CardTitle className={activeTournament === 'juniors' ? 'text-cyan-300' : 'text-yellow-300'}>{editingId ? "تعديل مباراة" : `إضافة مباراة (${activeTournament === 'youth' ? 'شباب' : 'ناشئين'})`}</CardTitle></CardHeader>
          <CardContent className="space-y-6 p-6 text-white">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-start">
               <div className="space-y-2">
                 <Input list="teams-list" value={matchForm.teamA} onChange={e => setMatchForm(p => ({...p, teamA: e.target.value}))} placeholder="الفريق الأول" className={`bg-[#1e2a4a] border ${activeTournament === 'juniors' ? 'border-cyan-500' : 'border-yellow-400'} rounded-2xl p-4 text-white font-bold h-14 text-center md:text-right`} />
                 <Input value={matchForm.teamALogo} onChange={e => setMatchForm(p => ({...p, teamALogo: e.target.value}))} placeholder="رابط شعار الفريق الأول (اختياري)" className="bg-[#0a1428] border-white/20 text-white text-xs h-10 text-center" />
               </div>
               <div className="flex flex-col items-center justify-center mt-2 md:mt-0">
                 <div className="text-3xl text-yellow-400 font-black mb-2">VS</div>
                 <Input value={matchForm.matchLabel} onChange={e => setMatchForm(p => ({...p, matchLabel: e.target.value}))} placeholder="رقم (مثال: م 97)" className="bg-[#0a1428] border-white/20 text-yellow-300 h-8 w-32 text-center text-xs font-bold" />
                 <div className="flex flex-wrap justify-center gap-1 mt-2 max-w-[150px]">
                   {getLabelSuggestions(matchForm.round).map(l => (<Badge key={l} className="cursor-pointer bg-white/10 border-white/5 hover:bg-yellow-400 hover:text-black text-[10px] py-1" onClick={() => setMatchForm(p => ({...p, matchLabel: l}))}>{l}</Badge>))}
                 </div>
               </div>
               <div className="space-y-2">
                 <Input list="teams-list" value={matchForm.teamB} onChange={e => setMatchForm(p => ({...p, teamB: e.target.value}))} placeholder="الفريق الثاني" className={`bg-[#1e2a4a] border ${activeTournament === 'juniors' ? 'border-cyan-500' : 'border-yellow-400'} rounded-2xl p-4 text-white font-bold h-14 text-center md:text-right`} />
                 <Input value={matchForm.teamBLogo} onChange={e => setMatchForm(p => ({...p, teamBLogo: e.target.value}))} placeholder="رابط شعار الفريق الثاني (اختياري)" className="bg-[#0a1428] border-white/20 text-white text-xs h-10 text-center" />
               </div>
            </div>
            <div className="grid grid-cols-2 gap-6 mt-4"><div><label className="block mb-2 text-cyan-300 font-bold text-center">أهداف {matchForm.teamA || 'الأول'}</label><Input type="number" value={matchForm.homeGoals} onChange={e => setMatchForm(p => ({...p, homeGoals: Number(e.target.value)}))} className="text-6xl text-center h-20 text-white font-black" /></div><div><label className="block mb-2 text-cyan-300 font-bold text-center">أهداف {matchForm.teamB || 'الثاني'}</label><Input type="number" value={matchForm.awayGoals} onChange={e => setMatchForm(p => ({...p, awayGoals: Number(e.target.value)}))} className="text-6xl text-center h-20 text-white font-black" /></div></div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <select value={matchForm.round} onChange={e => setMatchForm(p => ({...p, round: e.target.value, matchLabel: ""}))} className={`bg-[#1e2a4a] border ${activeTournament === 'juniors' ? 'border-cyan-500' : 'border-yellow-400'} rounded-2xl p-4 text-white font-bold outline-none cursor-pointer`}>{["الجولة الأولى","الجولة الثانية","الجولة الثالثة","الجولة الرابعة","الجولة الخامسة","الملحق","دور الستة عشر","دور الثمانية","نصف النهائي","النهائي"].map(r => <option key={r} value={r}>{r}</option>)}</select>
              <Input type="time" value={matchForm.time} onChange={e => setMatchForm(p => ({...p, time: e.target.value}))} className={`text-white bg-[#1e2a4a] border ${activeTournament === 'juniors' ? 'border-cyan-500' : 'border-yellow-400'} rounded-2xl p-4 font-bold`} />
              <Input type="date" value={matchForm.date} onChange={e => setMatchForm(p => ({...p, date: e.target.value}))} className={`text-white bg-[#1e2a4a] border ${activeTournament === 'juniors' ? 'border-cyan-500' : 'border-yellow-400'} rounded-2xl p-4 font-bold`} />
              <select value={matchForm.status} onChange={e => setMatchForm(p => ({...p, status: e.target.value}))} className="bg-[#1e2a4a] border border-red-500 rounded-2xl p-4 text-white font-bold outline-none cursor-pointer"><option value="لم تبدأ">حالة المباراة: لم تبدأ</option><option value="انتهت">حالة المباراة: انتهت ✔️</option></select>
            </div>
            <div className="flex gap-4 mt-6">
              <Button onClick={saveMatch} className={`flex-1 font-black py-7 text-xl transition-all ${activeTournament === 'juniors' ? 'bg-cyan-500 text-white hover:bg-cyan-600' : 'bg-yellow-400 text-black hover:bg-yellow-500'}`}>{editingId ? "حفظ التعديل" : "إضافة المباراة"}</Button>
              {editingId && <Button onClick={() => {setEditingId(null); setMatchForm({ teamA: "", teamALogo: "", teamB: "", teamBLogo: "", homeGoals: 0, awayGoals: 0, matchLabel: "", round: "الجولة الأولى", date: new Date().toISOString().slice(0, 10), time: "15:30", status: "لم تبدأ" });}} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-7 px-8">إلغاء</Button>}
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
          <TabsList className="flex flex-wrap justify-center bg-[#13213a] border border-white/20 p-1.5 rounded-2xl mb-8 gap-2 h-auto shadow-lg">
            <TabsTrigger value="rosters" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white font-bold py-2 px-4 rounded-xl text-blue-400 border border-blue-500/30">القوائم 📋</TabsTrigger>
            <TabsTrigger value="totw_admin" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white font-bold py-2 px-4 rounded-xl text-emerald-400">التشكيلة 🏟️</TabsTrigger>
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
            <TabsTrigger value="notify" className="data-[state=active]:bg-yellow-400 data-[state=active]:text-black font-black py-2 px-4 rounded-xl text-yellow-400 bg-black/40 border border-yellow-400/20">إشعارات 🔔</TabsTrigger>
            <TabsTrigger value="ticker" className="data-[state=active]:bg-black data-[state=active]:text-yellow-300 font-bold py-2 px-4 rounded-xl text-white">أخبار</TabsTrigger>
          </TabsList>

          <TabsContent value="rosters">
            <Card className="border-blue-500 bg-[#13213a] shadow-xl">
               <CardHeader className="border-b border-white/5 pb-4">
                  <CardTitle className="text-blue-400 flex items-center gap-2"><ClipboardList /> إدارة قوائم الفرق</CardTitle>
               </CardHeader>
               <CardContent className="p-6">
                  {editingRosterId ? (
                     <div className="animate-in fade-in duration-300 bg-[#1e2a4a] border border-blue-500/50 p-6 rounded-3xl">
                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10">
                           <h3 className="text-2xl font-black text-white flex items-center gap-2"><Edit className="text-yellow-400"/> تعديل قائمة: <span className="text-yellow-400">{editingRosterId}</span></h3>
                           <Button variant="outline" onClick={() => setEditingRosterId(null)} className="border-red-500 text-white hover:bg-red-500 font-bold">إلغاء</Button>
                        </div>
                        
                        <div className="grid md:grid-cols-3 gap-6 mb-8 bg-[#0a1428] p-4 rounded-2xl border border-white/5">
                           <div>
                              <label className="block text-cyan-300 text-sm font-bold mb-2">اسم المسئول</label>
                              <Input placeholder="الاسم" value={rosterFormAdmin.managerName} onChange={e => setRosterFormAdmin(p => ({...p, managerName: e.target.value}))} className="bg-[#1e2a4a] border-blue-500/40 text-white font-bold" />
                           </div>
                           <div>
                              <label className="block text-cyan-300 text-sm font-bold mb-2">رقم التليفون</label>
                              <Input dir="ltr" placeholder="01xxxxxxxxx" value={rosterFormAdmin.managerPhone} onChange={e => setRosterFormAdmin(p => ({...p, managerPhone: e.target.value}))} className="bg-[#1e2a4a] border-blue-500/40 text-white font-bold text-right" />
                           </div>
                           <div>
                              <label className="block text-yellow-400 text-sm font-bold mb-2">الباسورد السري (لإعطائه للمدير)</label>
                              <Input placeholder="كلمة المرور" value={rosterFormAdmin.password} onChange={e => setRosterFormAdmin(p => ({...p, password: e.target.value}))} className="bg-[#1e2a4a] border-yellow-500/40 text-white font-bold text-center tracking-wider" />
                           </div>
                        </div>

                        <div className="flex items-center gap-4 mb-8 bg-blue-900/20 p-4 rounded-xl border border-blue-500/30">
                           <input type="checkbox" id="isSubmittedCheck" checked={rosterFormAdmin.isSubmitted} onChange={e => setRosterFormAdmin(p => ({...p, isSubmitted: e.target.checked}))} className="w-6 h-6 rounded border-blue-500 text-blue-600 focus:ring-blue-500 bg-[#0a1428] cursor-pointer" />
                           <label htmlFor="isSubmittedCheck" className="text-white font-bold text-lg cursor-pointer select-none">
                              قفل القائمة واعتمادها (منع المدير من التعديل) 🔒
                           </label>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                           {rosterFormAdmin.players.map((player, index) => (
                              <div key={index} className="flex gap-3 items-center bg-[#0a1428] p-2 pr-4 rounded-xl border border-white/5 focus-within:border-blue-400">
                                 <span className="text-gray-500 font-black w-6">{index + 1}.</span>
                                 <Input placeholder="اسم اللاعب" value={player.name} onChange={e => updateAdminRosterPlayer(index, 'name', e.target.value)} className="flex-1 bg-transparent border-none text-white font-bold focus-visible:ring-0 px-0" />
                                 <div className="h-8 w-px bg-white/10 mx-1"></div>
                                 <Input type="number" placeholder="رقم" value={player.number} onChange={e => updateAdminRosterPlayer(index, 'number', e.target.value)} className="w-16 bg-[#1e2a4a] border-none text-yellow-400 font-black text-center focus-visible:ring-0" />
                              </div>
                           ))}
                        </div>

                        <div className="mt-8 pt-6 border-t border-white/10">
                           <Button onClick={saveRosterAdmin} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-7 text-xl shadow-lg">حفظ التعديلات الإدارية ✔️</Button>
                        </div>
                     </div>
                  ) : (
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {currentTeamsList.map(teamName => {
                           const rosterData = rostersList.find(r => r.id === teamName);
                           const isSubmitted = rosterData?.isSubmitted || false;
                           const hasData = !!rosterData;
                           
                           return (
                              <Card key={teamName} className={`bg-[#1e2a4a] border ${isSubmitted ? 'border-emerald-500/50' : hasData ? 'border-blue-500/30' : 'border-white/5'} overflow-hidden`}>
                                 <div className={`p-3 text-center border-b ${isSubmitted ? 'bg-emerald-600/20 border-emerald-500/30' : hasData ? 'bg-blue-600/20 border-blue-500/30' : 'bg-gray-800 border-white/5'}`}>
                                    <h3 className="font-black text-white text-lg">{teamName}</h3>
                                    {isSubmitted ? <Badge className="bg-emerald-500 text-white font-bold mt-1 text-[10px] px-2 py-0">معتمدة ومقفلة 🔒</Badge> : hasData ? <Badge className="bg-blue-500 text-white font-bold mt-1 text-[10px] px-2 py-0">مفتوحة للتعديل 🔓</Badge> : <Badge className="bg-gray-600 text-white font-bold mt-1 text-[10px] px-2 py-0">لم تسجل بعد ❌</Badge>}
                                 </div>
                                 <CardContent className="p-4 space-y-3">
                                    <div className="text-sm">
                                       <div className="flex justify-between text-gray-300 mb-1"><span>المسئول:</span> <span className="text-white font-bold">{rosterData?.managerName || '—'}</span></div>
                                       <div className="flex justify-between text-gray-300 mb-1"><span>الموبايل:</span> <span className="text-white font-bold" dir="ltr">{rosterData?.managerPhone || '—'}</span></div>
                                       <div className="flex justify-between text-gray-300"><span>الباسورد:</span> <span className="text-yellow-400 font-black tracking-widest">{rosterData?.password || '—'}</span></div>
                                    </div>
                                    <div className="flex gap-2 pt-3 border-t border-white/5">
                                       <Button size="sm" onClick={() => startEditRoster(teamName)} className="flex-1 bg-blue-600 text-white hover:bg-blue-700 font-bold"><Edit className="h-4 w-4 mr-1"/> إعداد</Button>
                                       {isSubmitted ? (
                                          <Button size="sm" onClick={() => unlockRoster(teamName)} className="bg-yellow-500 text-black hover:bg-yellow-600" title="فتح القفل ليتمكن المدير من التعديل"><Unlock className="h-4 w-4"/></Button>
                                       ) : hasData ? (
                                          <Button size="sm" onClick={() => lockRoster(teamName)} className="bg-emerald-500 text-white hover:bg-emerald-600" title="قفل واعتماد القائمة يدوياً"><Lock className="h-4 w-4"/></Button>
                                       ) : null}
                                       {hasData && (
                                          <Button size="sm" variant="destructive" onClick={() => deleteRoster(teamName)}><Trash2 className="h-4 w-4"/></Button>
                                       )}
                                    </div>
                                 </CardContent>
                              </Card>
                           );
                        })}
                     </div>
                  )}
               </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="totw_admin">
            <Card className="border-emerald-500 bg-[#13213a] shadow-xl">
              <CardHeader className="border-b border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
                <CardTitle className="text-emerald-400 flex items-center gap-2"><Users /> إدارة تشكيلة الجولة</CardTitle>
                <select value={formationForm.round} onChange={e => setFormationForm(p => ({...p, round: e.target.value}))} className="bg-[#0a1428] border-2 border-emerald-500 rounded-xl p-2 text-white font-black text-sm outline-none cursor-pointer w-full md:w-auto">
                   {["دور المجموعات", "الملحق", "دور الستة عشر", "دور الثمانية", "دور الأربعة (نصف النهائي)", "النهائي"].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </CardHeader>
              <CardContent className="p-6">
                 <div className="space-y-4">
                   {[ { pos: "حارس المرمى (GK)", idx: 0 }, { pos: "مدافع (CB)", idx: 1 }, { pos: "مدافع (CB)", idx: 2 }, { pos: "خط وسط يسار (LM)", idx: 3 }, { pos: "خط وسط (CM)", idx: 4 }, { pos: "خط وسط يمين (RM)", idx: 5 }, { pos: "مهاجم (ST)", idx: 6 } ].map((item) => (
                     <div key={item.idx} className="bg-[#1e2a4a] p-4 rounded-2xl border border-white/10 flex flex-col lg:flex-row gap-4 items-center">
                       <Badge className="bg-emerald-600 text-white w-full lg:w-32 justify-center py-2 shrink-0">{item.pos}</Badge>
                       <Input placeholder="اسم اللاعب" value={formationForm.players[item.idx]?.name || ""} onChange={e => updateFormationPlayer(item.idx, 'name', e.target.value)} className="bg-[#0a1428] border-emerald-500/30 text-white font-bold" />
                       <select value={formationForm.players[item.idx]?.team || ""} onChange={e => updateFormationPlayer(item.idx, 'team', e.target.value)} className="bg-[#0a1428] border border-emerald-500/30 rounded-xl p-2 text-white outline-none w-full lg:w-48"><option value="">-- اختر الفريق --</option>{currentTeamsList.map(t => <option key={t} value={t}>{t}</option>)}</select>
                       <Input placeholder="رابط الصورة" value={formationForm.players[item.idx]?.imageUrl || ""} onChange={e => updateFormationPlayer(item.idx, 'imageUrl', e.target.value)} className="bg-[#0a1428] border-emerald-500/30 text-white" />
                       <div className="flex items-center gap-2 shrink-0"><label className="text-xs text-emerald-300 font-bold">التقييم</label><Input type="number" value={formationForm.players[item.idx]?.rating || 99} onChange={e => updateFormationPlayer(item.idx, 'rating', Number(e.target.value))} className="bg-[#0a1428] border-emerald-500 text-white w-16 text-center font-black" /></div>
                     </div>
                   ))}
                   <Button onClick={saveFormation} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-6 text-xl mt-4 shadow-lg">حفظ تشكيلة "{formationForm.round}" 🚀</Button>
                 </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="live" className="space-y-6">
            {liveMatches.length === 0 && (<Card className="border-yellow-400 bg-[#13213a] border-dashed"><CardContent className="p-16 text-center"><p className="text-xl text-cyan-300 mb-4">لا توجد مباريات جارية الآن</p></CardContent></Card>)}
            {liveMatches.map(match => (
              <Card key={match.id} className={`bg-[#1e2a4a] border-2 ${match.status === 'ستبدأ بعد قليل' ? 'border-emerald-500/80 shadow-lg' : 'border-red-500/80 shadow-lg'} overflow-hidden`}>
                <div className={`${match.status === 'ستبدأ بعد قليل' ? 'bg-emerald-600' : 'bg-red-600'} text-white px-6 py-3 flex flex-wrap justify-between items-center gap-4`}>
                  <div className="flex items-center gap-4">
                    <span className={`font-black text-lg ${match.status === 'ستبدأ بعد قليل' ? '' : 'animate-pulse'}`}>{match.status === 'ستبدأ بعد قليل' ? '🟩' : '🔴'} البث المباشر</span>
                    <select value={match.status || "الشوط الأول"} onChange={(e) => updateMatchLive(match.id, { status: e.target.value })} className="bg-black/40 border-none text-white font-bold rounded-lg px-3 py-1 text-sm outline-none cursor-pointer"><option value="ستبدأ بعد قليل">ستبدأ بعد قليل</option><option value="الشوط الأول">الشوط الأول</option><option value="استراحة">استراحة</option><option value="الشوط الثاني">الشوط الثاني</option><option value="وقت إضافي">وقت إضافي</option><option value="ضربات جزاء">ضربات جزاء</option><option value="انتهت">انتهت</option></select>
                  </div>
                  <Button size="sm" variant="outline" className="bg-white/10 text-white border-white/20" onClick={() => updateMatchLive(match.id, { isLive: false, streamClosed: true, isTimerRunning: false })}>إغلاق البث</Button>
                </div>
                <CardContent className="p-6">
                  <div className="flex items-center justify-center gap-2 sm:gap-6 mb-8">
                     <TeamMatchDisplay teamName={match.teamA} logoUrl={match.teamALogo} />
                     <div className="bg-[#0a1428] rounded-2xl py-2 px-4 sm:py-3 sm:px-6 border-2 border-red-500/50 text-red-400 shadow-inner shrink-0">
                        {renderMatchScore(match)}
                     </div>
                     <TeamMatchDisplay teamName={match.teamB} logoUrl={match.teamBLogo} />
                  </div>

                  <div className="flex flex-wrap justify-center gap-2 mb-6 bg-[#0a1428] p-3 rounded-2xl border border-cyan-500/30">
                    <Button size="sm" onClick={() => sendQuickNotification("صافرة البداية ⏱️", `انطلاق مباراة ${match.teamA} ضد ${match.teamB}`)} className="bg-cyan-600 text-white font-bold">بداية الماتش</Button>
                    <Button size="sm" onClick={() => sendQuickNotification("هدف مبكر! ⚽", `هدف لصالح فريق ${match.teamA}`)} className="bg-emerald-600 text-white font-bold">هدف ({match.teamA})</Button>
                    <Button size="sm" onClick={() => sendQuickNotification("هدف مبكر! ⚽", `هدف لصالح فريق ${match.teamB}`)} className="bg-emerald-600 text-white font-bold">هدف ({match.teamB})</Button>
                    <Button size="sm" onClick={() => sendQuickNotification("طرد! 🟥", `حالة طرد في مباراة ${match.teamA} و ${match.teamB}`)} className="bg-red-600 text-white font-bold">طرد</Button>
                    <Button size="sm" onClick={() => sendQuickNotification("نهاية المباراة 🏁", `انتهت المباراة بنتيجة ${match.homeGoals} - ${match.awayGoals}`)} className="bg-gray-600 text-white font-bold">إنهاء</Button>
                  </div>
                  <div className="flex justify-center items-center gap-6 mb-8 bg-[#13213a] p-4 rounded-2xl border border-white/5 flex-wrap">
                    <Button onClick={() => updateMatchLive(match.id, { isTimerRunning: !match.isTimerRunning })} className={`font-bold h-12 px-6 ${match.isTimerRunning ? 'bg-amber-500' : 'bg-emerald-500'}`}>{match.isTimerRunning ? <><Pause className="mr-2 h-5 w-5" /> إيقاف</> : <><Play className="mr-2 h-5 w-5" /> تشغيل</>}</Button>
                    <div className="flex items-center gap-3"><label className="text-gray-400 font-bold">الدقيقة:</label><Input type="number" value={match.liveMinute || 0} onChange={(e) => updateMatchLive(match.id, { liveMinute: Number(e.target.value) })} className="w-24 text-center text-2xl font-black bg-black border-yellow-400 text-yellow-400" /></div>
                  </div>
                  <div className="grid md:grid-cols-3 gap-8 items-center mb-8">
                    <div className="text-center bg-[#13213a] p-6 rounded-3xl border border-white/5">
                      <h3 className="text-2xl font-bold text-white mb-6">{match.teamA}</h3>
                      <div className="flex items-center justify-center gap-4 mb-6">
                        <Button variant="outline" className="rounded-full bg-[#0a1428] border-yellow-400 text-yellow-400" onClick={() => updateMatchLive(match.id, { homeGoals: (match.homeGoals || 0) + 1 })}><Plus /></Button>
                        <span className="text-7xl font-black text-white w-20">{match.homeGoals || 0}</span>
                        <Button variant="outline" className="rounded-full bg-[#0a1428] border-yellow-400 text-yellow-400" onClick={() => updateMatchLive(match.id, { homeGoals: Math.max(0, (match.homeGoals || 0) - 1) })}><Minus /></Button>
                      </div>
                      <div className="flex justify-center items-center gap-2 bg-red-500/10 py-2 rounded-xl border border-red-500/20">
                        <span className="text-red-500 font-bold">طرد:</span>
                        <Button size="sm" variant="outline" className="h-8 w-8 p-0 border-red-500 text-red-500" onClick={() => updateMatchLive(match.id, { redCardsHome: Math.max(0, (match.redCardsHome || 0) - 1) })}><Minus className="h-4 w-4" /></Button>
                        <span className="font-bold text-xl text-red-500 px-2">{match.redCardsHome || 0}</span>
                        <Button size="sm" variant="outline" className="h-8 w-8 p-0 border-red-500 text-red-500" onClick={() => updateMatchLive(match.id, { redCardsHome: (match.redCardsHome || 0) + 1 })}><Plus className="h-4 w-4" /></Button>
                      </div>
                    </div>
                    <div className="text-center text-yellow-400 font-black text-4xl hidden md:block">VS</div>
                    <div className="text-center bg-[#13213a] p-6 rounded-3xl border border-white/5">
                      <h3 className="text-2xl font-bold text-white mb-6">{match.teamB}</h3>
                      <div className="flex items-center justify-center gap-4 mb-6">
                        <Button variant="outline" className="rounded-full bg-[#0a1428] border-yellow-400 text-yellow-400" onClick={() => updateMatchLive(match.id, { awayGoals: (match.awayGoals || 0) + 1 })}><Plus /></Button>
                        <span className="text-7xl font-black text-white w-20">{match.awayGoals || 0}</span>
                        <Button variant="outline" className="rounded-full bg-[#0a1428] border-yellow-400 text-yellow-400" onClick={() => updateMatchLive(match.id, { awayGoals: Math.max(0, (match.awayGoals || 0) - 1) })}><Minus /></Button>
                      </div>
                      <div className="flex justify-center items-center gap-2 bg-red-500/10 py-2 rounded-xl border border-red-500/20">
                        <span className="text-red-500 font-bold">طرد:</span>
                        <Button size="sm" variant="outline" className="h-8 w-8 p-0 border-red-500 text-red-500" onClick={() => updateMatchLive(match.id, { redCardsAway: Math.max(0, (match.redCardsAway || 0) - 1) })}><Minus className="h-4 w-4" /></Button>
                        <span className="font-bold text-xl text-red-500 px-2">{match.redCardsAway || 0}</span>
                        <Button size="sm" variant="outline" className="h-8 w-8 p-0 border-red-500 text-red-500" onClick={() => updateMatchLive(match.id, { redCardsAway: (match.redCardsAway || 0) + 1 })}><Plus className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </div>
                  <div className="mt-8 bg-[#0a1428] p-6 rounded-3xl border-2 border-cyan-500/30">
                    <h4 className="text-cyan-400 font-black mb-4 flex items-center gap-2"><Activity /> إضافة حدث للتايم لاين</h4>
                    <div className="flex flex-col lg:flex-row gap-4">
                      <div className="flex gap-2">
                        <Input type="number" placeholder="الدقيقة" value={liveEventForms[match.id]?.minute ?? match.liveMinute ?? 0} onChange={e => setLiveEventForms(p => ({...p, [match.id]: {...(p[match.id] || {type: 'info', text: ''}), minute: Number(e.target.value)}}))} className="w-24 bg-[#1e2a4a] border-cyan-500/50 text-white font-bold text-center" />
                        <select value={liveEventForms[match.id]?.type || 'info'} onChange={e => setLiveEventForms(p => ({...p, [match.id]: {...(p[match.id] || {minute: match.liveMinute||0, text: ''}), type: e.target.value}}))} className="bg-[#1e2a4a] border-cyan-500/50 rounded-xl px-4 text-white outline-none cursor-pointer font-bold">
                          <option value="goal">هدف ⚽</option>
                          <option value="yellow">إنذار 🟨</option>
                          <option value="red">طرد 🟥</option>
                          <option value="info">تحديث 🎙️</option>
                        </select>
                      </div>
                      <Input placeholder="تفاصيل الحدث..." value={liveEventForms[match.id]?.text || ''} onChange={e => setLiveEventForms(p => ({...p, [match.id]: {...(p[match.id] || {minute: match.liveMinute||0, type: 'info'}), text: e.target.value}}))} className="flex-1 bg-[#1e2a4a] border-cyan-500/50 text-white font-bold" />
                      <Button onClick={() => addLiveEvent(match.id, match.liveMinute || 0)} className="bg-cyan-500 text-black font-black w-full lg:w-auto px-8">نشر</Button>
                    </div>
                    {match.liveEvents && match.liveEvents.length > 0 && (
                      <div className="mt-6 space-y-2">
                        {match.liveEvents.map((ev: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center bg-[#1e2a4a] p-3 rounded-xl border border-white/5 text-sm">
                            <div className="flex items-center gap-3"><Badge className="bg-emerald-500 text-white font-black">الدقيقة {ev.minute}</Badge><span className="text-white">{ev.text}</span></div>
                            <Button size="sm" variant="ghost" onClick={() => deleteLiveEvent(match.id, idx)} className="text-red-400 hover:text-red-300"><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {match.status === "ضربات جزاء" && (
                    <div className="bg-[#13213a] border border-yellow-400/30 p-6 rounded-3xl mt-6">
                      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                        <h4 className="text-xl font-bold text-yellow-400">ضربات الترجيح</h4>
                        <Button size="sm" variant="outline" onClick={() => addPenaltySlot(match.id)} className="border-cyan-400 text-cyan-400"><Plus className="ml-2 h-4 w-4" /> ركلة إضافية</Button>
                      </div>
                      <div className="flex flex-col md:flex-row justify-between items-center bg-[#0a1428] p-4 rounded-xl gap-6">
                        <div className="flex gap-2 flex-wrap justify-center">{(match.penaltiesHome || ['none','none','none','none','none']).map((p:string, i:number) => (<button key={i} onClick={() => togglePenalty(match.id, 'home', i, p)} className={`w-8 h-8 rounded-full border-2 ${p === 'scored' ? 'bg-emerald-500' : p === 'missed' ? 'bg-red-500' : 'bg-gray-600'}`}></button>))}</div>
                        <div className="text-3xl font-black text-yellow-400">{(match.penaltiesHome || []).filter((p:string) => p === 'scored').length} - {(match.penaltiesAway || []).filter((p:string) => p === 'scored').length}</div>
                        <div className="flex gap-2 flex-wrap justify-center">{(match.penaltiesAway || ['none','none','none','none','none']).map((p:string, i:number) => (<button key={i} onClick={() => togglePenalty(match.id, 'away', i, p)} className={`w-8 h-8 rounded-full border-2 ${p === 'scored' ? 'bg-emerald-500' : p === 'missed' ? 'bg-red-500' : 'bg-gray-600'}`}></button>))}</div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="knockout">
                {["النهائي", "نصف النهائي", "دور الثمانية", "دور الستة عشر", "الملحق"].map((roundName) => {
                  const roundMatches = sortMatches(matches.filter(m => m.round === roundName));
                  if (roundMatches.length === 0) return null;
                  return (
                    <div key={roundName} className="mb-8"><div className="flex justify-center mb-4"><Badge className="bg-white/10 text-yellow-300 text-lg px-6 py-1 border border-yellow-400/30">{roundName}</Badge></div><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {roundMatches.map(match => (
                          <div key={match.id} className="bg-[#1e2a4a] p-4 rounded-2xl flex flex-col justify-between gap-4 border border-yellow-400/30 shadow-md">
                            <div>
                               {match.matchLabel && <div className="text-center mb-2"><Badge className="bg-yellow-400 text-black font-black text-xs">{match.matchLabel}</Badge></div>}
                               
                               <div className="flex items-center justify-center gap-2 mb-2 mt-4">
                                  <TeamMatchDisplay teamName={match.teamA} logoUrl={match.teamALogo} />
                                  <div className="bg-[#0a1428] rounded-xl py-2 px-4 border border-white/10 text-yellow-400 shrink-0">
                                    <span className="font-black text-lg">{match.homeGoals} - {match.awayGoals}</span>
                                  </div>
                                  <TeamMatchDisplay teamName={match.teamB} logoUrl={match.teamBLogo} />
                               </div>

                               <div className="text-cyan-300 text-center mt-4 text-sm font-bold border-t border-white/5 pt-2">{getArabicDay(match.date)} • {match.date}</div>
                            </div>
                            <div className="flex gap-2 justify-center flex-wrap mt-2">
                               <Button size="sm" onClick={() => { updateMatchLive(match.id, { isLive: true, streamClosed: false, status: "ستبدأ بعد قليل", liveMinute: 0 }); setActiveTab("live"); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="bg-red-600 text-white flex-1">بث</Button>
                               <Button size="sm" onClick={() => startEdit(match)} className="bg-yellow-400 text-black flex-1">تعديل</Button>
                               <Button size="sm" onClick={() => deleteMatch(match.id)} variant="destructive" className="flex-1">حذف</Button>
                            </div>
                          </div>
                        ))}
                      </div></div>
                  )
                })}
          </TabsContent>

          <TabsContent value="motm">
            <Card className="border-yellow-400 bg-[#13213a]">
              <CardHeader><CardTitle className="text-yellow-300 flex items-center gap-2"><Star /> كروت النجوم 🌟</CardTitle></CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-[#1e2a4a] rounded-2xl items-center border border-yellow-400/20">
                  <Input value={motmForm.player} onChange={e => setMotmForm(p => ({...p, player: e.target.value}))} placeholder="اسم اللاعب" className="bg-[#0a1428] border-yellow-400 text-white" />
                  <select value={motmForm.team} onChange={e => setMotmForm(p => ({...p, team: e.target.value}))} className="bg-[#0a1428] border border-yellow-400 rounded-xl p-3 text-white">
                     {currentTeamsList.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <Input value={motmForm.imageUrl} onChange={e => setMotmForm(p => ({...p, imageUrl: e.target.value}))} placeholder="صورة اللاعب" className="bg-[#0a1428] border-yellow-400 text-white" />
                  <div className="flex gap-2">
                    <select value={motmForm.sponsorName} onChange={e => { const sp = SPONSORS.find(s => s.name === e.target.value); setMotmForm(p => ({...p, sponsorName: sp?.name || "", sponsorLogo: sp?.src || ""})); }} className="bg-[#0a1428] border border-yellow-400 rounded-xl px-2 text-white flex-1 text-sm">
                      {SPONSORS.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                    </select>
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center border-2 border-yellow-400 shrink-0 p-1">
                      {motmForm.sponsorLogo && <img src={motmForm.sponsorLogo} className="max-h-full max-w-full object-contain" />}
                    </div>
                  </div>
                  <div className="grid grid-cols-7 gap-2 mt-2 w-full md:col-span-4">
                     {['rating', 'pac', 'sho', 'pas', 'dri', 'def', 'phy'].map(s => (
                        <div key={s} className="flex flex-col gap-1"><label className="text-[10px] text-cyan-300 text-center font-bold">{s.toUpperCase()}</label><Input type="number" value={(motmForm as any)[s]} onChange={e => setMotmForm(p => ({...p, [s]: Number(e.target.value)}))} className="bg-[#0a1428] border-yellow-400 text-white text-center h-10 p-1" /></div>
                     ))}
                  </div>
                  <div className="flex gap-4 mt-4 md:col-span-4 w-full">
                    <Button onClick={addMotm} className={`flex-1 font-black h-12 ${activeTournament === 'juniors' ? 'bg-cyan-500 text-white' : 'bg-yellow-400 text-black'}`}>{editingMotmId ? "تعديل" : "إضافة"}</Button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {motmList.map(m => (
                    <div key={m.id} className="bg-[#1e2a4a] p-4 rounded-2xl flex justify-between items-center border border-white/10">
                        <div className="flex items-center gap-4">
                            {m.imageUrl ? <img src={m.imageUrl} className="h-10 w-10 rounded-full object-cover border-2 border-yellow-400" /> : <div className="h-10 w-10 rounded-full bg-gray-600 flex items-center justify-center">👤</div>}
                            <div className="font-bold text-white text-lg">{m.player} <span className="text-yellow-400 ml-1 text-sm">({m.rating})</span></div>
                        </div>
                        <div className="flex gap-2"><Button size="sm" onClick={() => startEditMotm(m)} className="bg-yellow-400 text-black"><Edit className="h-4 w-4" /></Button><Button size="sm" variant="destructive" onClick={() => deleteMotm(m.id)}><Trash2 className="h-4 w-4" /></Button></div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="all">
            <Card className="border-yellow-400 bg-[#13213a]">
              <CardHeader className="flex flex-col sm:flex-row justify-between gap-4">
                <CardTitle className="text-yellow-300">السابقة</CardTitle>
                <Input placeholder="بحث..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-sm border-yellow-400 bg-[#1e2a4a]" />
              </CardHeader>
              <CardContent className="space-y-4">
                {matches.filter(m => !liveMatchIds.has(m.id) && (String(m.teamA || "").includes(searchTerm) || String(m.teamB || "").includes(searchTerm))).map(m => (
                  <div key={m.id} className="bg-[#1e2a4a] p-4 rounded-2xl flex flex-col justify-between gap-4 border border-yellow-400/30">
                    <div className="flex items-center justify-center gap-2 sm:gap-6 pt-2">
                       <TeamMatchDisplay teamName={m.teamA} logoUrl={m.teamALogo} />
                       <div className="bg-[#0a1428] rounded-xl py-2 px-4 border border-white/10 text-yellow-400 shrink-0">
                         <span className="font-black text-xl">{m.homeGoals} - {m.awayGoals}</span>
                       </div>
                       <TeamMatchDisplay teamName={m.teamB} logoUrl={m.teamBLogo} />
                    </div>
                    <div className="text-cyan-300 text-sm text-center border-t border-white/5 pt-2">{m.date} • {m.status || m.time}</div>
                    
                    <div className="flex gap-2 justify-center mt-2">
                      <Button size="sm" onClick={() => setShareMatch(m)} className="bg-emerald-500 text-white">شير</Button>
                      <Button size="sm" onClick={() => { updateMatchLive(m.id, { isLive: true, streamClosed: false, status: "ستبدأ بعد قليل", liveMinute: 0 }); setActiveTab("live"); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="bg-red-600 text-white">بث</Button>
                      <Button size="sm" onClick={() => startEdit(m)} className="bg-yellow-400 text-black">تعديل</Button>
                      <Button size="sm" onClick={() => deleteMatch(m.id)} variant="destructive">حذف</Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="today">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {matches.filter(m => m.date === todayStr && !liveMatchIds.has(m.id) && m.status !== "انتهت").map(m => (
                  <div key={m.id} className="bg-[#1e2a4a] p-4 rounded-2xl border-l-4 border-yellow-400 flex flex-col justify-between gap-4">
                     <div className="flex items-center justify-center gap-2 pt-2">
                       <TeamMatchDisplay teamName={m.teamA} logoUrl={m.teamALogo} />
                       <span className="text-yellow-400 font-black text-xl">VS</span>
                       <TeamMatchDisplay teamName={m.teamB} logoUrl={m.teamBLogo} />
                     </div>
                     <div className="text-cyan-300 text-sm text-center border-t border-white/5 pt-2 font-bold">{m.time}</div>
                     <Button size="sm" onClick={() => { updateMatchLive(m.id, { isLive: true, streamClosed: false, status: "ستبدأ بعد قليل", liveMinute: 0 }); setActiveTab("live"); }} className="bg-emerald-600 w-full font-bold">بدء المباراة الآن</Button>
                  </div>
                ))}
             </div>
          </TabsContent>

          <TabsContent value="tomorrow">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {matches.filter(m => m.date === tomorrowStr && !liveMatchIds.has(m.id)).map(m => (
                  <div key={m.id} className="bg-[#1e2a4a] p-4 rounded-2xl border-l-4 border-sky-400 flex flex-col justify-between gap-4">
                     <div className="flex items-center justify-center gap-2 pt-2">
                       <TeamMatchDisplay teamName={m.teamA} logoUrl={m.teamALogo} />
                       <span className="text-sky-400 font-black text-xl">VS</span>
                       <TeamMatchDisplay teamName={m.teamB} logoUrl={m.teamBLogo} />
                     </div>
                     <div className="text-cyan-300 text-sm text-center border-t border-white/5 pt-2 font-bold">{m.time}</div>
                  </div>
                ))}
             </div>
          </TabsContent>

          <TabsContent value="predictions">
            <Card className="border-yellow-400 bg-[#13213a]">
              <CardHeader className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <CardTitle className="text-yellow-300"><Gift /> توقعات الجماهير</CardTitle>
                <Button variant="destructive" onClick={deleteAllPredictions} className="font-bold">مسح الكل</Button>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full text-right text-white min-w-[600px]">
                    <thead className="bg-[#1e2a4a]"><tr><th className="p-4 text-cyan-300">المباراة</th><th className="p-4 text-cyan-300">الاسم</th><th className="p-4 text-cyan-300">الهاتف</th><th className="p-4 text-cyan-300 text-center">التوقع</th><th className="p-4"></th></tr></thead>
                    <tbody>
                      {predictions.map(p => (
                        <tr key={p.id} className="border-b border-white/5"><td className="p-4 font-bold">{p.matchName}</td><td className="p-4">{p.name}</td><td className="p-4 text-yellow-400">{p.phone}</td><td className="p-4 text-center"><Badge className="bg-emerald-500 text-white">{p.homeScore} - {p.awayScore}</Badge></td><td className="p-4"><Button size="sm" variant="ghost" onClick={() => deletePrediction(p.id)}><Trash2 className="h-4 w-4"/></Button></td></tr>
                      ))}
                    </tbody>
                  </table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cards">
            <Card className="border-yellow-400 bg-[#13213a]">
              <CardHeader className="flex flex-col sm:flex-row justify-between items-center border-b border-white/5 pb-4">
                 <CardTitle className="text-yellow-300">إدارة الإنذارات</CardTitle>
                 <Button variant="destructive" onClick={archiveAndResetCards} className="font-black">تصفير وأرشفة</Button>
              </CardHeader>
              <CardContent className="space-y-6 p-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-[#1e2a4a] rounded-2xl">
                  <Input value={cardForm.player} onChange={e => setCardForm(p => ({...p, player: e.target.value}))} placeholder="اسم اللاعب" className="bg-[#0a1428] border-yellow-400" />
                  <select value={cardForm.team} onChange={e => setCardForm(p => ({...p, team: e.target.value}))} className="bg-[#0a1428] border border-yellow-400 rounded-2xl p-3 text-white">{currentTeamsList.map(t => <option key={t} value={t}>{t}</option>)}</select>
                  <select value={cardForm.type} onChange={e => setCardForm(p => ({...p, type: e.target.value as any}))} className="bg-[#0a1428] border border-yellow-400 rounded-2xl p-3 text-white"><option value="yellow">إنذار أصفر</option><option value="red">طرد</option></select>
                  <Button onClick={addCard} className={`font-black ${activeTournament === 'juniors' ? 'bg-cyan-500' : 'bg-yellow-400 text-black'}`}>تسجيل</Button>
                </div>
                <Input value={cardSearchTerm} onChange={(e) => setCardSearchTerm(e.target.value)} placeholder="بحث..." className="max-w-xs border-yellow-400 bg-[#1e2a4a]" />
                <div className="space-y-3">{filteredCards.map(item => (
                  <Card key={item.id} className="bg-[#1e2a4a] border border-white/10">
                    <CardContent className="p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                      <div><h3 className="font-bold text-white">{item.player}</h3><p className="text-cyan-300 text-sm">{item.team}</p></div>
                      <div className="flex gap-4">
                        <div className="flex items-center gap-2"><Button size="sm" onClick={() => updateCard(item.id, Math.max(0, item.yellow - 1), item.red)}><Minus /></Button><span className="text-yellow-300">🟨 {item.yellow}</span><Button size="sm" onClick={() => updateCard(item.id, item.yellow + 1, item.red)}><Plus /></Button></div>
                        <div className="flex items-center gap-2"><Button size="sm" onClick={() => updateCard(item.id, item.yellow, Math.max(0, item.red - 1))}><Minus /></Button><span className="text-red-500">🟥 {item.red}</span><Button size="sm" onClick={() => updateCard(item.id, item.yellow, item.red + 1)}><Plus /></Button></div>
                        <Button size="sm" variant="destructive" onClick={() => deleteCard(item.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}</div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="goals">
            <Card className="border-yellow-400 bg-[#13213a]">
              <CardHeader><CardTitle className="text-yellow-300">الهدافين وكروت الفيفا</CardTitle><Input placeholder="بحث..." value={goalSearchTerm} onChange={(e) => setGoalSearchTerm(e.target.value)} className="mt-4 max-w-md border-yellow-400 bg-[#1e2a4a]" /></CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-[#1e2a4a] rounded-2xl">
                  <Input value={goalForm.player} onChange={e => setGoalForm(p => ({...p, player: e.target.value}))} placeholder="اسم اللاعب" className="bg-[#0a1428] border-yellow-400" />
                  <select value={goalForm.team} onChange={e => setGoalForm(p => ({...p, team: e.target.value}))} className="bg-[#0a1428] border border-yellow-400 rounded-2xl p-3 text-white">{currentTeamsList.map(t => <option key={t} value={t}>{t}</option>)}</select>
                  <Input type="number" value={goalForm.goalsCount} onChange={e => setGoalForm(p => ({...p, goalsCount: Number(e.target.value)}))} placeholder="الأهداف" className="bg-[#0a1428] border-yellow-400" />
                  <Input value={goalForm.imageUrl} onChange={e => setGoalForm(p => ({...p, imageUrl: e.target.value}))} placeholder="رابط الصورة" className="bg-[#0a1428] border-yellow-400" />
                  <div className="flex gap-4 mt-4 md:col-span-4 w-full"><Button onClick={addOrUpdateGoal} className="flex-1 bg-yellow-400 text-black font-black h-12">حفظ</Button></div>
                </div>
                <div className="space-y-3">{filteredGoals.map(goal => (<Card key={goal.id} className="bg-[#1e2a4a] border-white/10"><CardContent className="p-4 flex justify-between items-center"><div className="flex items-center gap-4">{goal.imageUrl ? <img src={goal.imageUrl} className="h-10 w-10 rounded-full object-cover" /> : <div className="h-10 w-10 rounded-full bg-gray-600 flex items-center justify-center">👤</div>}<div><div className="font-bold text-white">{goal.player}</div><div className="text-cyan-300 text-sm">{goal.team} — {goal.goals} هدف</div></div></div><div className="flex gap-2"><Button size="sm" onClick={() => startEditGoal(goal)} className="bg-yellow-400 text-black"><Edit className="h-4 w-4" /></Button><Button size="sm" variant="destructive" onClick={() => deleteGoal(goal.id)}><Trash2 className="h-4 w-4" /></Button></div></CardContent></Card>))}</div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="media">
            <Card className="border-emerald-500 bg-[#13213a]">
              <CardHeader><CardTitle className="text-emerald-400 flex items-center gap-2"><Video /> ميديا</CardTitle></CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-[#1e2a4a] rounded-2xl"><Input value={mediaForm.title} onChange={e => setMediaForm(p => ({...p, title: e.target.value}))} placeholder="العنوان" className="bg-[#0a1428] border-emerald-500" /><Input value={mediaForm.url} onChange={e => setMediaForm(p => ({...p, url: e.target.value}))} placeholder="الرابط" className="bg-[#0a1428] border-emerald-500" /><Button onClick={addMedia} className="bg-emerald-500 text-white font-bold h-full">إضافة</Button></div>
                <div className="space-y-3">{mediaItems.map(item => (<div key={item.id} className="bg-[#1e2a4a] p-4 rounded-2xl flex justify-between items-center border border-emerald-500/30"><div className="font-bold text-white">{item.title}</div><Button size="sm" variant="destructive" onClick={() => deleteMedia(item.id)}><Trash2 className="h-4 w-4" /></Button></div>))}</div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notify">
            <Card className="border-yellow-400 bg-[#13213a]">
              <CardHeader className="text-center pb-2"><BellRing className="mx-auto h-12 w-12 text-yellow-400 mb-4 animate-bounce" /><CardTitle className="text-3xl font-black text-yellow-300">إرسال إشعار عاجل 🚀</CardTitle></CardHeader>
              <CardContent className="p-6 md:p-10 space-y-6 max-w-3xl mx-auto">
                <Input value={notifyTitle} onChange={e => setNotifyTitle(e.target.value)} placeholder="عنوان الإشعار" className="text-xl bg-[#0a1428] border-yellow-400 text-white p-6 font-bold" />
                <Input value={notifyBody} onChange={e => setNotifyBody(e.target.value)} placeholder="التفاصيل" className="text-lg bg-[#0a1428] border-yellow-400 text-white p-6" />
                <Button onClick={sendNotification} disabled={isSending} className="w-full bg-yellow-400 text-black py-8 font-black text-2xl shadow-lg mt-8">{isSending ? "جاري الإرسال..." : "إرسال الآن 🚀"}</Button>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="ticker">
            <Card className="border-yellow-400 bg-[#13213a]">
               <CardHeader><CardTitle className="text-yellow-300">شريط الأخبار</CardTitle></CardHeader>
               <CardContent className="p-6 space-y-6"><Input value={tickerText} onChange={e => setTickerText(e.target.value)} placeholder="اكتب الخبر..." className="py-8 text-lg bg-[#1e2a4a] border-yellow-400 text-white" /><Button onClick={saveTicker} className="w-full bg-yellow-400 text-black py-7 font-bold">حفظ</Button></CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
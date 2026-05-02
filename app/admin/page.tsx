"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Trophy, LogOut, Edit, Trash2, Plus, Minus, Play, Pause, BellRing, Video, Gift, Star, Users, Share2, Copy, Activity, ArchiveRestore, Search, ShieldAlert } from "lucide-react";
import { collection, addDoc, deleteDoc, doc, updateDoc, onSnapshot, setDoc, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { TEAM_NAMES } from "@/data/tournament";

const ADMIN_PASSWORD = "hero123";

// 🔴🔴🔴 مفاتيح OneSignal (مهم جداً تحط الـ REST API هنا) 🔴🔴🔴
const ONESIGNAL_APP_ID = "d73de8b7-948e-494e-84f2-6c353efee89c";
const ONESIGNAL_REST_API_KEY = "os_v2_app_2466rn4urzeu5bhsnq2t57xittiky3vqzocua7mgejhhcm2c3b7cn3zrz235yp3mk6rqupnrbkzbakvd6y3432offaiaazjpojaix3q"; 

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

// 🔴 دالة مركزية للاتصال المباشر بـ OneSignal 🔴
const pushNotification = async (title: string, body: string) => {
  if (ONESIGNAL_REST_API_KEY === "YOUR_REST_API_KEY_HERE") {
     alert("⚠️ تنبيه: لازم تحط مفتاح REST API الخاص بـ OneSignal في الكود عشان الإشعارات تتبعت!");
     return false;
  }
  try {
     const res = await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: {
           "Content-Type": "application/json",
           "Authorization": `Basic ${ONESIGNAL_REST_API_KEY}`
        },
        body: JSON.stringify({
           app_id: ONESIGNAL_APP_ID,
           included_segments: ["Subscribed Users"],
           headings: { en: title, ar: title },
           contents: { en: body, ar: body }
        })
     });
     return res.ok;
  } catch(e) { console.error(e); return false; }
};

export default function AdminPage() {
  const [isAuth, setIsAuth] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  
  const [activeTournament, setActiveTournament] = useState<'youth' | 'juniors'>('youth'); 
  const [activeTab, setActiveTab] = useState("live");

  const [matches, setMatches] = useState<any[]>([]);
  const matchesRef = useRef<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [cardEvents, setCardEvents] = useState<any[]>([]);
  const [mediaItems, setMediaItems] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [motmList, setMotmList] = useState<any[]>([]);
  const [formationsList, setFormationsList] = useState<any[]>([]); 

  const [tickerText, setTickerText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [goalSearchTerm, setGoalSearchTerm] = useState("");
  const [cardSearchTerm, setCardSearchTerm] = useState("");

  const [notifyTitle, setNotifyTitle] = useState("");
  const [notifyBody, setNotifyBody] = useState("");
  const [isSending, setIsSending] = useState(false);

  const [shareMatch, setShareMatch] = useState<any | null>(null);

  const sortedTeams = useMemo(() => Array.from(new Set([...CLEANED_TEAM_NAMES, ...PLAYOFF_TEAMS])).sort((a, b) => a.localeCompare(b, "ar")), []);
  const sortedJuniorsTeams = useMemo(() => [...JUNIORS_TEAMS].sort((a, b) => a.localeCompare(b, "ar")), []);
  const currentTeamsList = activeTournament === 'youth' ? sortedTeams : sortedJuniorsTeams;

  const [matchForm, setMatchForm] = useState({
    teamA: "", teamB: "", homeGoals: 0, awayGoals: 0, matchLabel: "",
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
    players: [ {...defaultPlayer}, {...defaultPlayer}, {...defaultPlayer}, {...defaultPlayer}, {...defaultPlayer}, {...defaultPlayer}, {...defaultPlayer} ]
  });

  const [liveEventForms, setLiveEventForms] = useState<Record<string, { minute?: number, type: string, text: string }>>({});

  useEffect(() => {
    setMatchForm(p => ({...p, teamA: "", teamB: "", matchLabel: ""}));
    setGoalForm(p => ({...p, team: currentTeamsList[0] || ""}));
    setCardForm(p => ({...p, team: currentTeamsList[0] || ""}));
    setMotmForm(p => ({...p, team: currentTeamsList[0] || ""}));
    setEditingId(null); setEditingGoalId(null); setEditingMotmId(null);
  }, [activeTournament, currentTeamsList]);

  useEffect(() => {
    const existing = formationsList.find(f => f.round === formationForm.round);
    if(existing) setFormationForm({ round: existing.round, players: existing.players });
    else setFormationForm(p => ({ ...p, players: Array(7).fill({...defaultPlayer}) }));
  }, [formationForm.round, formationsList]);

  const now = new Date();
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
  const tomorrowStr = new Date(now.getTime() + 86400000).toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
  const getColl = (base: string) => activeTournament === "juniors" ? `${base}_juniors` : base;

  useEffect(() => { matchesRef.current = matches; }, [matches]);

  useEffect(() => {
    if (!isAuth) return;
    const unsubMatches = onSnapshot(collection(db, getColl("matches")), (snap) => setMatches(snap.docs.map(d => ({ id: d.id, ...d.data(), teamA: cleanTeamString(d.data().teamA), teamB: cleanTeamString(d.data().teamB) }))));
    const unsubGoals = onSnapshot(collection(db, getColl("goals")), (snap) => setGoals(snap.docs.map(d => ({ id: d.id, ...d.data(), team: cleanTeamString(d.data().team) }))));
    const unsubCards = onSnapshot(collection(db, getColl("cards")), (snap) => setCardEvents(snap.docs.map(d => ({ id: d.id, ...d.data(), team: cleanTeamString(d.data().team) }))));
    const unsubMedia = onSnapshot(collection(db, getColl("media")), (snap) => setMediaItems(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubPredictions = onSnapshot(collection(db, getColl("predictions")), (snap) => setPredictions(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a:any, b:any) => b.timestamp?.localeCompare(a.timestamp) || 0)));
    const unsubMotm = onSnapshot(collection(db, getColl("motm")), (snap) => setMotmList(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubForms = onSnapshot(collection(db, getColl("formations")), (snap) => setFormationsList(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubTicker = onSnapshot(doc(db, "settings", "ticker"), (docSnap) => setTickerText(docSnap.data()?.text || ""));

    const timerInterval = setInterval(() => {
      matchesRef.current.forEach(m => {
        if (m.isTimerRunning && m.status !== "انتهت" && m.status !== "استراحة" && m.status !== "ضربات جزاء" && m.status !== "ستبدأ بعد قليل") {
          updateDoc(doc(db, getColl("matches"), m.id), { liveMinute: (m.liveMinute || 0) + 1 });
        }
      });
    }, 60000); 
    return () => { unsubMatches(); unsubGoals(); unsubCards(); unsubMedia(); unsubPredictions(); unsubMotm(); unsubForms(); unsubTicker(); clearInterval(timerInterval); };
  }, [isAuth, activeTournament]);

  const handleLogin = () => passwordInput === ADMIN_PASSWORD ? setIsAuth(true) : alert("كلمة السر خاطئة");

  const saveMatch = async () => {
    if (!matchForm.teamA.trim() || !matchForm.teamB.trim()) return alert("يجب إدخال أسماء الفرق!");
    const dayName = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"][new Date(matchForm.date).getDay()];
    const data = { ...matchForm, dayName, isLive: false };
    if (editingId) { 
      await updateDoc(doc(db, getColl("matches"), editingId), data); 
      setEditingId(null); 
      alert("✅ تم تعديل المباراة بنجاح");
    } else { 
      await addDoc(collection(db, getColl("matches")), data); 
      alert("✅ تم إضافة المباراة بنجاح");
    }
    setMatchForm({ teamA: "", teamB: "", homeGoals: 0, awayGoals: 0, matchLabel: "", round: "الجولة الأولى", date: new Date().toISOString().slice(0, 10), time: "15:30", status: "لم تبدأ" });
  };

  const startEdit = (match: any) => { 
    setEditingId(match.id); 
    setMatchForm({ teamA: match.teamA, teamB: match.teamB, homeGoals: match.homeGoals, awayGoals: match.awayGoals, matchLabel: match.matchLabel || "", round: match.round, date: match.date, time: match.time, status: match.status || "لم تبدأ" }); 
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
    const type = form.type || 'info';
    
    const currentMatch = matches.find(m => m.id === matchId);
    if(!currentMatch) return;
    
    const newEvent = { minute, type, text: form.text.trim() };
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

  // 🔴 الإشعارات السريعة اللحظية المضافة 🔴
  const sendQuickNotification = async (title: string, body: string) => {
    const success = await pushNotification(title, body);
    if(success) alert(`✅ تم إرسال الإشعار السريع بنجاح لجميع المتابعين!`);
    else alert("❌ حدث خطأ، تأكد إنك حطيت مفتاح الـ REST API في كود الإدارة.");
  };

  // 🔴 الإشعارات اليدوية من تبويب "الإشعارات 🔔" 🔴
  const sendNotification = async () => {
    if (!notifyTitle || !notifyBody) return alert("اكتب عنوان وتفاصيل الإشعار!");
    setIsSending(true);
    const success = await pushNotification(notifyTitle, notifyBody);
    if (success) {
      alert(`✅ تم إرسال الإشعار لجميع الأجهزة!`);
      setNotifyTitle(""); setNotifyBody("");
    } else {
      alert("❌ فشل الإرسال، تأكد إنك حطيت مفتاح الـ REST API في كود الإدارة.");
    }
    setIsSending(false);
  };

  const addOrUpdateGoal = async () => {
    if (!goalForm.player.trim()) return alert("اكتب اسم اللاعب");
    const playerNameTrimmed = goalForm.player.trim(); 
    const teamSelected = goalForm.team; 
    
    const statsData = {
      goals: Number(goalForm.goalsCount),
      imageUrl: goalForm.imageUrl.trim(),
      rating: Number(goalForm.rating),
      pac: Number(goalForm.pac), sho: Number(goalForm.sho), pas: Number(goalForm.pas), dri: Number(goalForm.dri), def: Number(goalForm.def), phy: Number(goalForm.phy)
    };

    if (editingGoalId) { 
      await updateDoc(doc(db, getColl("goals"), editingGoalId), { player: playerNameTrimmed, team: teamSelected, ...statsData }); 
      setEditingGoalId(null); 
      alert("✅ تم تعديل الهدف والطاقات بنجاح");
    } else { 
      const existingPlayer = goals.find(g => String(g.player || "").trim().toLowerCase() === playerNameTrimmed.toLowerCase() && g.team === teamSelected);
      if (existingPlayer) {
        const updateData: any = { ...statsData, goals: (Number(existingPlayer.goals) || 0) + statsData.goals }; 
        if (!statsData.imageUrl) delete updateData.imageUrl; 
        await updateDoc(doc(db, getColl("goals"), existingPlayer.id), updateData); 
        alert(`✅ تم التحديث تراكمياً مع الطاقات الجديدة`);
      } else {
        await addDoc(collection(db, getColl("goals")), { player: playerNameTrimmed, team: teamSelected, ...statsData }); 
        alert("✅ تم إضافة اللاعب والهدف والطاقات بنجاح");
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

  const archiveAndResetCards = async () => {
    if (!confirm("⚠️ هل أنت متأكد من تصفير جميع الكروت ونقلها للأرشيف؟ (يتم ذلك عادة قبل دور الـ 16)")) return;
    let archivedCount = 0;
    try {
      for (const card of cardEvents) {
        if (card.yellow > 0 || card.red > 0) {
          await addDoc(collection(db, getColl("archived_cards")), { ...card, archivedAt: new Date().toISOString() });
          await updateDoc(doc(db, getColl("cards"), card.id), { yellow: 0, red: 0 });
          archivedCount++;
        }
      }
      alert(`✅ تم نقل وتصفير ${archivedCount} سجل بطاقات بنجاح للبدء من جديد!`);
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
    if (!motmForm.player.trim() || !motmForm.sponsorName.trim()) return alert("يجب كتابة اسم اللاعب واسم الراعي!");
    const data = {
      ...motmForm,
      rating: Number(motmForm.rating), pac: Number(motmForm.pac), sho: Number(motmForm.sho), pas: Number(motmForm.pas), dri: Number(motmForm.dri), def: Number(motmForm.def), phy: Number(motmForm.phy)
    };

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
       alert("✅ تم تحديث التشكيلة بنجاح");
    } else {
       await addDoc(collection(db, getColl("formations")), { round: formationForm.round, players: formationForm.players });
       alert("✅ تم حفظ التشكيلة الجديدة بنجاح");
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
     if (!confirm("⚠️ تحذير: هل أنت متأكد من مسح جميع التوقعات السابقة لتبدأ جولة جديدة؟")) return;
     predictions.forEach(async (p) => await deleteDoc(doc(db, getColl("predictions"), p.id)));
     alert("✅ تم تصفية التوقعات بنجاح");
  };

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
                 <Button onClick={() => { navigator.clipboard.writeText(generatePostContent(shareMatch)); alert("تم نسخ النص للذاكرة بنجاح! 📋"); }} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-black h-12 text-lg"><Copy className="ml-2 h-5 w-5"/> نسخ النص</Button>
                 <Button onClick={() => setShareMatch(null)} variant="outline" className="border-red-500 text-white hover:bg-red-500 h-12 font-bold px-8">إغلاق</Button>
               </div>
            </div>
          </div>
        )}

        <Card className={`border ${activeTournament === 'juniors' ? 'border-cyan-500' : 'border-yellow-400'} bg-[#13213a] mb-8 mt-4 shadow-2xl transition-colors`}>
          <CardHeader><CardTitle className={activeTournament === 'juniors' ? 'text-cyan-300' : 'text-yellow-300'}>{editingId ? "تعديل مباراة" : `إضافة مباراة (${activeTournament === 'youth' ? 'شباب' : 'ناشئين'})`}</CardTitle></CardHeader>
          <CardContent className="space-y-6 p-6 text-white">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-start">
               <div><Input list="teams-list" value={matchForm.teamA} onChange={e => setMatchForm(p => ({...p, teamA: e.target.value}))} placeholder="الفريق الأول (أو اكتب: الفائز من...)" className={`bg-[#1e2a4a] border ${activeTournament === 'juniors' ? 'border-cyan-500' : 'border-yellow-400'} rounded-2xl p-4 text-white font-bold h-14 text-center md:text-right`} /></div>
               <div className="flex flex-col items-center justify-center mt-2 md:mt-0">
                 <div className="text-3xl text-yellow-400 font-black mb-2">VS</div>
                 <Input value={matchForm.matchLabel} onChange={e => setMatchForm(p => ({...p, matchLabel: e.target.value}))} placeholder="رقم (مثال: م 97)" className="bg-[#0a1428] border-white/20 text-yellow-300 h-8 w-32 text-center text-xs font-bold" />
                 <div className="flex flex-wrap justify-center gap-1 mt-2 max-w-[150px]">
                   {getLabelSuggestions(matchForm.round).map(l => (<Badge key={l} className="cursor-pointer bg-white/10 border-white/5 hover:bg-yellow-400 hover:text-black text-[10px] py-1" onClick={() => setMatchForm(p => ({...p, matchLabel: l}))}>{l}</Badge>))}
                 </div>
               </div>
               <div><Input list="teams-list" value={matchForm.teamB} onChange={e => setMatchForm(p => ({...p, teamB: e.target.value}))} placeholder="الفريق الثاني (أو اكتب: الفائز من...)" className={`bg-[#1e2a4a] border ${activeTournament === 'juniors' ? 'border-cyan-500' : 'border-yellow-400'} rounded-2xl p-4 text-white font-bold h-14 text-center md:text-right`} /></div>
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
              {editingId && <Button onClick={() => {setEditingId(null); setMatchForm({ teamA: "", teamB: "", homeGoals: 0, awayGoals: 0, matchLabel: "", round: "الجولة الأولى", date: new Date().toISOString().slice(0, 10), time: "15:30", status: "لم تبدأ" });}} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-7 px-8">إلغاء</Button>}
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
          <TabsList className="flex flex-wrap justify-center bg-[#13213a] border border-white/20 p-1.5 rounded-2xl mb-8 gap-2 h-auto shadow-lg">
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
            <TabsTrigger value="ticker" className="data-[state=active]:bg-black data-[state=active]:text-yellow-300 font-bold py-2 px-4 rounded-xl text-white">أخبار</TabsTrigger>
            <TabsTrigger value="notify" className="data-[state=active]:bg-yellow-400 data-[state=active]:text-black font-black py-2 px-4 rounded-xl text-yellow-400 bg-black/40 border border-yellow-400/20">إشعارات 🔔</TabsTrigger>
          </TabsList>

          <TabsContent value="totw_admin">
            <Card className="border-emerald-500 bg-[#13213a] shadow-xl">
              <CardHeader className="border-b border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
                <CardTitle className="text-emerald-400 flex items-center gap-2"><Users /> إدارة تشكيلة الجولة (فريق الأسبوع)</CardTitle>
                <select value={formationForm.round} onChange={e => setFormationForm(p => ({...p, round: e.target.value}))} className="bg-[#0a1428] border-2 border-emerald-500 rounded-xl p-2 text-white font-black text-sm outline-none cursor-pointer w-full md:w-auto">
                   {["دور المجموعات", "الملحق", "دور الستة عشر", "دور الثمانية", "دور الأربعة (نصف النهائي)", "النهائي"].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </CardHeader>
              <CardContent className="p-6">
                 <div className="space-y-4">
                   {[ { pos: "حارس المرمى (GK)", idx: 0 }, { pos: "مدافع (CB)", idx: 1 }, { pos: "مدافع (CB)", idx: 2 }, { pos: "خط وسط يسار (LM)", idx: 3 }, { pos: "خط وسط (CM)", idx: 4 }, { pos: "خط وسط يمين (RM)", idx: 5 }, { pos: "مهاجم (ST)", idx: 6 } ].map((item) => (
                     <div key={item.idx} className="bg-[#1e2a4a] p-4 rounded-2xl border border-white/10 flex flex-col lg:flex-row gap-4 items-center">
                       <Badge className="bg-emerald-600 text-white w-full lg:w-32 justify-center py-2 shrink-0">{item.pos}</Badge>
                       <Input placeholder="اسم اللاعب" value={formationForm.players[item.idx].name} onChange={e => updateFormationPlayer(item.idx, 'name', e.target.value)} className="bg-[#0a1428] border-emerald-500/30 text-white font-bold" />
                       <select value={formationForm.players[item.idx].team} onChange={e => updateFormationPlayer(item.idx, 'team', e.target.value)} className="bg-[#0a1428] border border-emerald-500/30 rounded-xl p-2 text-white outline-none w-full lg:w-48"><option value="">-- اختر الفريق --</option>{currentTeamsList.map(t => <option key={t} value={t}>{t}</option>)}</select>
                       <Input placeholder="رابط الصورة (اختياري)" value={formationForm.players[item.idx].imageUrl} onChange={e => updateFormationPlayer(item.idx, 'imageUrl', e.target.value)} className="bg-[#0a1428] border-emerald-500/30 text-white" />
                       <div className="flex items-center gap-2 shrink-0"><label className="text-xs text-emerald-300 font-bold">التقييم</label><Input type="number" value={formationForm.players[item.idx].rating} onChange={e => updateFormationPlayer(item.idx, 'rating', Number(e.target.value))} className="bg-[#0a1428] border-emerald-500 text-white w-16 text-center font-black" /></div>
                     </div>
                   ))}
                   <Button onClick={saveFormation} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-6 text-xl mt-4 shadow-[0_0_15px_rgba(16,185,129,0.4)]">حفظ تشكيلة "{formationForm.round}" 🚀</Button>
                 </div>
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
                  
                  <div className="flex flex-wrap justify-center gap-2 mb-6 bg-[#0a1428] p-3 rounded-2xl border border-cyan-500/30">
                    <Button size="sm" onClick={() => sendQuickNotification("صافرة البداية ⏱️", `انطلاق مباراة ${match.teamA} ضد ${match.teamB}`)} className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold"><BellRing className="ml-1 h-4 w-4"/> بداية الماتش</Button>
                    <Button size="sm" onClick={() => sendQuickNotification("هدف مبكر! ⚽", `تم تسجيل هدف لصالح فريق ${match.teamA}`)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"><Play className="ml-1 h-4 w-4"/> هدف ({match.teamA})</Button>
                    <Button size="sm" onClick={() => sendQuickNotification("هدف مبكر! ⚽", `تم تسجيل هدف لصالح فريق ${match.teamB}`)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"><Play className="ml-1 h-4 w-4"/> هدف ({match.teamB})</Button>
                    <Button size="sm" onClick={() => sendQuickNotification("طرد! 🟥", `حالة طرد في مباراة ${match.teamA} و ${match.teamB}`)} className="bg-red-600 hover:bg-red-700 text-white font-bold"><ShieldAlert className="ml-1 h-4 w-4"/> طرد</Button>
                    <Button size="sm" onClick={() => sendQuickNotification("نهاية المباراة 🏁", `انتهت المباراة بنتيجة ${match.homeGoals} - ${match.awayGoals}`)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold">إنهاء</Button>
                  </div>

                  <div className="flex justify-center items-center gap-6 mb-8 bg-[#13213a] p-4 rounded-2xl border border-white/5 flex-wrap">
                    <Button onClick={() => updateMatchLive(match.id, { isTimerRunning: !match.isTimerRunning })} className={`font-bold h-12 px-6 ${match.isTimerRunning ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}>{match.isTimerRunning ? <><Pause className="mr-2 h-5 w-5" /> إيقاف التايمر</> : <><Play className="mr-2 h-5 w-5" /> تشغيل التايمر</>}</Button>
                    <div className="flex items-center gap-3"><label className="text-gray-400 font-bold">الدقيقة:</label><Input type="number" value={match.liveMinute || 0} onChange={(e) => updateMatchLive(match.id, { liveMinute: Number(e.target.value) })} className="w-24 text-center text-2xl font-black bg-black border-yellow-400 text-yellow-400" /></div>
                  </div>
                  <div className="grid md:grid-cols-3 gap-8 items-center mb-8">
                    <div className="text-center bg-[#13213a] p-6 rounded-3xl border border-white/5 relative">
                      <h3 className="text-2xl font-bold text-white mb-6">{match.teamA}</h3>
                      <div className="flex items-center justify-center gap-4 mb-6">
                        <Button variant="outline" className="h-12 w-12 rounded-full bg-[#0a1428] border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-black" onClick={() => updateMatchLive(match.id, { homeGoals: (match.homeGoals || 0) + 1 })}><Plus /></Button>
                        <span className="text-7xl font-black text-white w-20">{match.homeGoals || 0}</span>
                        <Button variant="outline" className="h-12 w-12 rounded-full bg-[#0a1428] border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-black" onClick={() => updateMatchLive(match.id, { homeGoals: Math.max(0, (match.homeGoals || 0) - 1) })}><Minus /></Button>
                      </div>
                      <div className="flex justify-center items-center gap-2 bg-red-500/10 py-2 rounded-xl border border-red-500/20">
                        <span className="text-red-500 font-bold">طرد:</span>
                        <Button size="sm" variant="outline" className="h-8 w-8 p-0 bg-[#0a1428] border-red-500 text-red-500 hover:bg-red-500 hover:text-white" onClick={() => updateMatchLive(match.id, { redCardsHome: Math.max(0, (match.redCardsHome || 0) - 1) })}><Minus className="h-4 w-4" /></Button>
                        <span className="font-bold text-xl text-red-500 px-2">{match.redCardsHome || 0}</span>
                        <Button size="sm" variant="outline" className="h-8 w-8 p-0 bg-[#0a1428] border-red-500 text-red-500 hover:bg-red-500 hover:text-white" onClick={() => updateMatchLive(match.id, { redCardsHome: (match.redCardsHome || 0) + 1 })}><Plus className="h-4 w-4" /></Button>
                      </div>
                    </div>
                    
                    <div className="text-center text-yellow-400 font-black text-4xl hidden md:block">VS</div>
                    
                    <div className="text-center bg-[#13213a] p-6 rounded-3xl border border-white/5 relative">
                      <h3 className="text-2xl font-bold text-white mb-6">{match.teamB}</h3>
                      <div className="flex items-center justify-center gap-4 mb-6">
                        <Button variant="outline" className="h-12 w-12 rounded-full bg-[#0a1428] border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-black" onClick={() => updateMatchLive(match.id, { awayGoals: (match.awayGoals || 0) + 1 })}><Plus /></Button>
                        <span className="text-7xl font-black text-white w-20">{match.awayGoals || 0}</span>
                        <Button variant="outline" className="h-12 w-12 rounded-full bg-[#0a1428] border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-black" onClick={() => updateMatchLive(match.id, { awayGoals: Math.max(0, (match.awayGoals || 0) - 1) })}><Minus /></Button>
                      </div>
                      <div className="flex justify-center items-center gap-2 bg-red-500/10 py-2 rounded-xl border border-red-500/20">
                        <span className="text-red-500 font-bold">طرد:</span>
                        <Button size="sm" variant="outline" className="h-8 w-8 p-0 bg-[#0a1428] border-red-500 text-red-500 hover:bg-red-500 hover:text-white" onClick={() => updateMatchLive(match.id, { redCardsAway: Math.max(0, (match.redCardsAway || 0) - 1) })}><Minus className="h-4 w-4" /></Button>
                        <span className="font-bold text-xl text-red-500 px-2">{match.redCardsAway || 0}</span>
                        <Button size="sm" variant="outline" className="h-8 w-8 p-0 bg-[#0a1428] border-red-500 text-red-500 hover:bg-red-500 hover:text-white" onClick={() => updateMatchLive(match.id, { redCardsAway: (match.redCardsAway || 0) + 1 })}><Plus className="h-4 w-4" /></Button>
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
                          <option value="info">تحديث عام 🎙️</option>
                        </select>
                      </div>
                      <Input placeholder="اكتب تفاصيل الحدث هنا (مثال: تسديدة صاروخية تسكن الشباك)..." value={liveEventForms[match.id]?.text || ''} onChange={e => setLiveEventForms(p => ({...p, [match.id]: {...(p[match.id] || {minute: match.liveMinute||0, type: 'info'}), text: e.target.value}}))} className="flex-1 bg-[#1e2a4a] border-cyan-500/50 text-white font-bold" />
                      <Button onClick={() => addLiveEvent(match.id, match.liveMinute || 0)} className="bg-cyan-500 hover:bg-cyan-600 text-black font-black w-full lg:w-auto px-8">نشر الحدث</Button>
                    </div>

                    {match.liveEvents && match.liveEvents.length > 0 && (
                      <div className="mt-6 space-y-2">
                        <h5 className="text-white/50 text-sm font-bold border-b border-white/10 pb-2 mb-4">الأحداث المسجلة حالياً</h5>
                        {match.liveEvents.map((ev: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center bg-[#1e2a4a] p-3 rounded-xl border border-white/5 text-sm">
                            <div className="flex items-center gap-3">
                              <Badge className={`${ev.type === 'goal' ? 'bg-emerald-500 text-white' : ev.type === 'yellow' ? 'bg-yellow-400 text-black' : ev.type === 'red' ? 'bg-red-500 text-white' : 'bg-cyan-400 text-black'} font-black`}>
                                الدقيقة {ev.minute}
                              </Badge>
                              <span className="text-white">{ev.text}</span>
                            </div>
                            <Button size="sm" variant="ghost" onClick={() => deleteLiveEvent(match.id, idx)} className="text-red-400 hover:text-red-300 hover:bg-red-900/50 h-8 w-8 p-0"><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {match.status === "ضربات جزاء" && (
                    <div className="bg-[#13213a] border border-yellow-400/30 p-6 rounded-3xl mt-6">
                      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                        <h4 className="text-xl font-bold text-yellow-400">إدارة ضربات الترجيح</h4>
                        <div className="text-gray-400 text-xs">⚠️ لن تضاف أهداف الترجيح لإحصائيات الهدافين أو ترتيب الفرق</div>
                        <Button size="sm" variant="outline" onClick={() => addPenaltySlot(match.id)} className="border-cyan-400 text-cyan-400 hover:bg-cyan-400 hover:text-black"><Plus className="ml-2 h-4 w-4" /> إضافة ركلة إضافية</Button>
                      </div>
                      <div className="flex flex-col md:flex-row justify-between items-center bg-[#0a1428] p-4 rounded-xl gap-6"><div className="flex gap-2 flex-wrap justify-center">{(match.penaltiesHome || ['none','none','none','none','none']).map((p:string, i:number) => (<button key={i} onClick={() => togglePenalty(match.id, 'home', i, p)} className={`w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center ${p === 'scored' ? 'bg-emerald-500 border-emerald-400' : p === 'missed' ? 'bg-red-500 border-red-400' : 'bg-[#1e2a4a] border-gray-600'}`}>{p === 'scored' && <span className="text-white font-bold">✔</span>}{p === 'missed' && <span className="text-white font-bold">✖</span>}</button>))}</div><div className="text-3xl font-black text-yellow-400 bg-[#1e2a4a] px-6 py-2 rounded-xl">{(match.penaltiesHome || []).filter((p:string) => p === 'scored').length} - {(match.penaltiesAway || []).filter((p:string) => p === 'scored').length}</div><div className="flex gap-2 flex-wrap justify-center">{(match.penaltiesAway || ['none','none','none','none','none']).map((p:string, i:number) => (<button key={i} onClick={() => togglePenalty(match.id, 'away', i, p)} className={`w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center ${p === 'scored' ? 'bg-emerald-500 border-emerald-400' : p === 'missed' ? 'bg-red-500 border-red-400' : 'bg-[#1e2a4a] border-gray-600'}`}>{p === 'scored' && <span className="text-white font-bold">✔</span>}{p === 'missed' && <span className="text-white font-bold">✖</span>}</button>))}</div></div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="knockout">
            <div className="space-y-10">
              <div className="mt-4">
                <h3 className="text-2xl font-black text-center text-yellow-300 mb-8">إدارة مباريات الإقصاء المدخلة يدوياً ({activeTournament === 'youth' ? 'الشباب' : 'الناشئين'})</h3>
                {["النهائي", "نصف النهائي", "دور الثمانية", "دور الستة عشر", "الملحق"].map((roundName) => {
                  const roundMatches = sortMatches(matches.filter(m => m.round === roundName));
                  if (roundMatches.length === 0) return null;
                  return (
                    <div key={roundName} className="mb-8"><div className="flex justify-center mb-4"><Badge className="bg-white/10 text-yellow-300 text-lg px-6 py-1 border border-yellow-400/30">{roundName}</Badge></div><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {roundMatches.map(match => (
                          <div key={match.id} className="bg-[#1e2a4a] p-4 rounded-2xl flex flex-col justify-between gap-4 border border-yellow-400/30 shadow-md">
                            <div>
                               {match.matchLabel && <div className="text-center mb-2"><Badge className="bg-yellow-400 text-black font-black text-xs">{match.matchLabel}</Badge></div>}
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
                {matches.filter(m => ["النهائي", "نصف النهائي", "دور الثمانية", "دور الستة عشر", "الملحق"].includes(m.round)).length === 0 && (
                  <p className="text-center text-gray-500 font-bold text-xl py-10">لم يتم إضافة أي مباريات إقصائية حتى الآن.</p>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="motm">
            <Card className="border-yellow-400 bg-[#13213a]">
              <CardHeader><CardTitle className="text-yellow-300 flex items-center gap-2"><Star /> إدارة جوائز رجل المباراة (كروت الفيفا)</CardTitle></CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-[#1e2a4a] rounded-2xl items-center border border-yellow-400/20 shadow-inner">
                  <Input value={motmForm.player} onChange={e => setMotmForm(p => ({...p, player: e.target.value}))} placeholder="اسم اللاعب" className="bg-[#0a1428] border-yellow-400 text-white h-12" />
                  <select value={motmForm.team} onChange={e => setMotmForm(p => ({...p, team: e.target.value}))} className="bg-[#0a1428] border border-yellow-400 rounded-xl p-3 text-white h-12 outline-none">
                     {currentTeamsList.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <Input value={motmForm.imageUrl} onChange={e => setMotmForm(p => ({...p, imageUrl: e.target.value}))} placeholder="صورة اللاعب (رابط URL)" className="bg-[#0a1428] border-yellow-400 text-white h-12" />
                  <div className="flex gap-2 h-12">
                    <select value={motmForm.sponsorName} onChange={e => { const sp = SPONSORS.find(s => s.name === e.target.value); setMotmForm(p => ({...p, sponsorName: sp?.name || "", sponsorLogo: sp?.src || ""})); }} className="bg-[#0a1428] border border-yellow-400 rounded-xl px-2 text-white flex-1 outline-none text-sm">
                      {SPONSORS.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                    </select>
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center border-2 border-yellow-400 shrink-0 p-1 overflow-hidden shadow-inner">
                      {motmForm.sponsorLogo && <img src={motmForm.sponsorLogo} className="max-h-full max-w-full object-contain" alt="لوجو الراعي" />}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-7 gap-2 mt-2 w-full md:col-span-4">
                     <div className="flex flex-col gap-1"><label className="text-[10px] text-cyan-300 text-center font-bold">التقييم</label><Input type="number" value={motmForm.rating} onChange={e => setMotmForm(p => ({...p, rating: Number(e.target.value)}))} className="bg-[#0a1428] border-yellow-400 text-white text-center font-black h-10 p-1" /></div>
                     <div className="flex flex-col gap-1"><label className="text-[10px] text-cyan-300 text-center font-bold">السرعة</label><Input type="number" value={motmForm.pac} onChange={e => setMotmForm(p => ({...p, pac: Number(e.target.value)}))} className="bg-[#0a1428] border-white/20 text-white text-center h-10 p-1" /></div>
                     <div className="flex flex-col gap-1"><label className="text-[10px] text-cyan-300 text-center font-bold">الشوط</label><Input type="number" value={motmForm.sho} onChange={e => setMotmForm(p => ({...p, sho: Number(e.target.value)}))} className="bg-[#0a1428] border-white/20 text-white text-center h-10 p-1" /></div>
                     <div className="flex flex-col gap-1"><label className="text-[10px] text-cyan-300 text-center font-bold">التمرير</label><Input type="number" value={motmForm.pas} onChange={e => setMotmForm(p => ({...p, pas: Number(e.target.value)}))} className="bg-[#0a1428] border-white/20 text-white text-center h-10 p-1" /></div>
                     <div className="flex flex-col gap-1"><label className="text-[10px] text-cyan-300 text-center font-bold">المراوغة</label><Input type="number" value={motmForm.dri} onChange={e => setMotmForm(p => ({...p, dri: Number(e.target.value)}))} className="bg-[#0a1428] border-white/20 text-white text-center h-10 p-1" /></div>
                     <div className="flex flex-col gap-1"><label className="text-[10px] text-cyan-300 text-center font-bold">الدفاع</label><Input type="number" value={motmForm.def} onChange={e => setMotmForm(p => ({...p, def: Number(e.target.value)}))} className="bg-[#0a1428] border-white/20 text-white text-center h-10 p-1" /></div>
                     <div className="flex flex-col gap-1"><label className="text-[10px] text-cyan-300 text-center font-bold">البدني</label><Input type="number" value={motmForm.phy} onChange={e => setMotmForm(p => ({...p, phy: Number(e.target.value)}))} className="bg-[#0a1428] border-white/20 text-white text-center h-10 p-1" /></div>
                  </div>

                  <div className="flex gap-4 mt-4 md:col-span-4 w-full">
                    <Button onClick={addMotm} className={`flex-1 font-black h-12 transition-transform hover:scale-[1.01] ${activeTournament === 'juniors' ? 'bg-cyan-500 text-white' : 'bg-yellow-400 text-black'}`}>
                      {editingMotmId ? "تعديل بيانات النجم 🌟" : "إضافة النجم للقائمة 🌟"}
                    </Button>
                    {editingMotmId && (
                      <Button onClick={() => { setEditingMotmId(null); setMotmForm({ player: "", team: currentTeamsList[0] || "", imageUrl: "", sponsorName: SPONSORS[0].name, sponsorLogo: SPONSORS[0].src, ...defaultStats }); }} className="bg-gray-600 hover:bg-gray-700 text-white font-bold h-12 px-8">إلغاء</Button>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {motmList.map(m => (
                    <div key={m.id} className="bg-[#1e2a4a] p-4 rounded-2xl flex justify-between items-center border border-white/10">
                      <div className="flex items-center gap-4">
                        {m.imageUrl ? <img src={m.imageUrl} className="h-12 w-12 rounded-full object-cover border-2 border-yellow-400" /> : <div className="h-12 w-12 rounded-full bg-[#0a1428] flex items-center justify-center text-xl border-2 border-yellow-400">👤</div>}
                        <div><div className="font-bold text-white text-lg">{m.player} <span className="text-yellow-400 ml-1 text-sm">({m.rating})</span></div><div className="text-cyan-300 text-xs mt-1">{m.team} • {m.sponsorName}</div></div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => startEditMotm(m)} className="bg-yellow-400 text-black hover:bg-yellow-500"><Edit className="h-4 w-4" /></Button>
                        <Button size="sm" variant="destructive" onClick={() => deleteMotm(m.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="all">
            <Card className="border-yellow-400 bg-[#13213a]">
              <CardHeader className="flex flex-col sm:flex-row justify-between gap-4">
                <CardTitle className="text-yellow-300">المباريات السابقة</CardTitle>
                <Input placeholder="ابحث عن فريق..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-sm border-yellow-400 bg-[#1e2a4a] text-white" />
              </CardHeader>
              <CardContent className="space-y-3">
                {matches.filter(m => !m.isLive && (String(m.teamA || "").includes(searchTerm) || String(m.teamB || "").includes(searchTerm))).map(m => (
                  <div key={m.id} className="bg-[#1e2a4a] p-4 rounded-2xl flex flex-col sm:flex-row justify-between gap-4 border border-yellow-400/30">
                    <div>
                      <div className="font-bold text-white">{m.teamA} <span className="text-yellow-400 mx-1">{m.homeGoals} - {m.awayGoals}</span> {m.teamB}</div>
                      <div className="text-cyan-300 text-sm">{getArabicDay(m.date)} • {m.date} • {m.status || m.time}</div>
                    </div>
                    <div className="flex gap-2 flex-wrap items-center">
                      <Button size="sm" onClick={() => setShareMatch(m)} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold"><Share2 className="ml-1 h-4 w-4" /> شير</Button>
                      <Button size="sm" onClick={() => { updateMatchLive(m.id, { isLive: true, status: m.status || "ستبدأ بعد قليل", liveMinute: m.liveMinute || 0 }); setActiveTab("live"); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="bg-red-600 hover:bg-red-700 text-white"><Play className="ml-1 h-4 w-4" /> بث</Button>
                      <Button size="sm" onClick={() => startEdit(m)} className="bg-yellow-400 text-black"><Edit className="ml-1 h-4 w-4" /> تعديل</Button>
                      <Button size="sm" onClick={() => deleteMatch(m.id)} variant="destructive"><Trash2 className="ml-1 h-4 w-4" /> حذف</Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="today">
            <Card className="border-yellow-400 bg-[#13213a]">
              <CardHeader><CardTitle className="text-yellow-300">مباريات اليوم</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {matches.filter(m => m.date === todayStr && !m.isLive && m.status !== "انتهت").map(m => (
                  <div key={m.id} className="bg-[#1e2a4a] p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-center border-l-4 border-yellow-400 gap-4">
                    <div><div className="font-bold text-white">{m.teamA} vs {m.teamB}</div><div className="text-cyan-300 text-sm">{m.time}</div></div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => setShareMatch(m)} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold"><Share2 className="ml-1 h-4 w-4" /></Button>
                      <Button size="sm" onClick={() => { updateMatchLive(m.id, { isLive: true, status: "ستبدأ بعد قليل", liveMinute: 0 }); setActiveTab("live"); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="bg-emerald-600 text-white hover:bg-emerald-700"><Play className="ml-1 h-4 w-4" /> ابدأ البث</Button>
                      <Button size="sm" onClick={() => startEdit(m)} className="bg-yellow-400 text-black">تعديل</Button>
                      <Button size="sm" onClick={() => deleteMatch(m.id)} variant="destructive">حذف</Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tomorrow">
            <Card className="border-yellow-400 bg-[#13213a]">
              <CardHeader><CardTitle className="text-yellow-300">مباريات غداً</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {matches.filter(m => m.date === tomorrowStr && !m.isLive).map(m => (
                  <div key={m.id} className="bg-[#1e2a4a] p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4 border-l-4 border-sky-400">
                    <div><div className="font-bold text-white">{m.teamA} vs {m.teamB}</div><div className="text-cyan-300 text-sm">{m.time}</div></div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => setShareMatch(m)} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold"><Share2 className="ml-1 h-4 w-4" /></Button>
                      <Button size="sm" onClick={() => startEdit(m)} className="bg-yellow-400 text-black">تعديل</Button>
                      <Button size="sm" onClick={() => deleteMatch(m.id)} variant="destructive">حذف</Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="predictions">
            <Card className="border-yellow-400 bg-[#13213a]">
              <CardHeader className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-white/10 pb-4">
                <CardTitle className="text-yellow-300 flex items-center gap-2"><Gift /> توقعات الجماهير</CardTitle>
                <Button variant="destructive" onClick={deleteAllPredictions} className="font-bold"><Trash2 className="ml-2 h-4 w-4"/> مسح التوقعات</Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-white min-w-[600px]">
                    <thead className="bg-[#1e2a4a]"><tr><th className="p-4 text-cyan-300 font-bold">المباراة</th><th className="p-4 text-cyan-300 font-bold">الاسم</th><th className="p-4 text-cyan-300 font-bold">الهاتف</th><th className="p-4 text-cyan-300 font-bold text-center">التوقع</th><th className="p-4"></th></tr></thead>
                    <tbody>
                      {predictions.map(p => (
                        <tr key={p.id} className="border-b border-white/5 hover:bg-white/5"><td className="p-4 font-bold">{p.matchName}</td><td className="p-4">{p.name}</td><td className="p-4 text-yellow-400 font-mono tracking-wider">{p.phone}</td><td className="p-4 text-center"><Badge className="bg-emerald-500 text-white text-lg px-3 py-1 font-black">{p.homeScore} - {p.awayScore}</Badge></td><td className="p-4 text-left"><Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-900/50" onClick={() => deletePrediction(p.id)}><Trash2 className="h-5 w-5"/></Button></td></tr>
                      ))}
                    </tbody>
                  </table>
                  {predictions.length === 0 && <div className="text-center py-16 text-gray-500 font-bold text-xl">لا توجد توقعات حتى الآن</div>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cards">
            <Card className="border-yellow-400 bg-[#13213a]">
              <CardHeader className="flex flex-col sm:flex-row justify-between items-center border-b border-white/5 pb-4">
                 <CardTitle className="text-yellow-300">إدارة الإنذارات</CardTitle>
                 <Button variant="destructive" onClick={archiveAndResetCards} className="font-black"><ArchiveRestore className="ml-2 h-5 w-5" /> تصفير وأرشفة الإنذارات (قبل دور الـ 16)</Button>
              </CardHeader>
              <CardContent className="space-y-6 p-6">
                <div className={`grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-[#1e2a4a] rounded-2xl border ${activeTournament === 'juniors' ? 'border-cyan-500/30' : 'border-yellow-400/30'}`}>
                  <Input value={cardForm.player} onChange={e => setCardForm(p => ({...p, player: e.target.value}))} placeholder="اسم اللاعب" className="bg-[#0a1428] border-yellow-400 text-white" />
                  <select value={cardForm.team} onChange={e => setCardForm(p => ({...p, team: e.target.value}))} className="bg-[#0a1428] border border-yellow-400 rounded-2xl p-3 text-white">{currentTeamsList.map(t => <option key={t} value={t}>{t}</option>)}</select>
                  <select value={cardForm.type} onChange={e => setCardForm(p => ({...p, type: e.target.value as "yellow" | "red"}))} className="bg-[#0a1428] border border-yellow-400 rounded-2xl p-3 text-white"><option value="yellow">إنذار أصفر</option><option value="red">بطاقة حمراء</option></select>
                  <Button onClick={addCard} className={`font-black transition-all ${activeTournament === 'juniors' ? 'bg-cyan-500 text-white hover:bg-cyan-600' : 'bg-yellow-400 text-black hover:bg-yellow-500'}`}>تسجيل البطاقة</Button>
                </div>
                
                <div className="relative w-full sm:max-w-xs mx-auto"><Search className="absolute right-3 top-3 h-4 w-4 text-cyan-300" /><Input value={cardSearchTerm} onChange={(e) => setCardSearchTerm(e.target.value)} placeholder="بحث عن لاعب..." className="pr-10 bg-[#1e2a4a] border-yellow-400 text-white rounded-xl" /></div>

                <div className="space-y-3">{filteredCards.map(item => (
                  <Card key={item.id} className="bg-[#1e2a4a] border border-white/10">
                    <CardContent className="p-4 flex flex-col sm:flex-row justify-between items-center gap-4 text-white">
                      <div>
                        <h3 className="font-bold text-lg sm:text-xl text-white">{item.player}</h3>
                        <p className="text-cyan-300 text-sm font-bold">{item.team}</p>
                      </div>
                      <Badge className={`${item.status === 'متاح' ? 'bg-cyan-500' : item.status === 'إيقاف' ? 'bg-yellow-500' : 'bg-red-500'} text-black font-bold text-sm px-3`}>{item.status}</Badge>
                      <div className="mt-4 flex gap-4">
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => updateCard(item.id, Math.max(0, item.yellow - 1), item.red)} className="bg-[#0a1428] border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-black"><Minus className="h-4 w-4" /></Button>
                          <span className="px-4 py-1 bg-yellow-400/20 text-yellow-300 font-bold rounded">🟨 {item.yellow}</span>
                          <Button size="sm" variant="outline" onClick={() => updateCard(item.id, item.yellow + 1, item.red)} className="bg-[#0a1428] border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-black"><Plus className="h-4 w-4" /></Button>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => updateCard(item.id, item.yellow, Math.max(0, item.red - 1))} className="bg-[#0a1428] border-red-500 text-red-500 hover:bg-red-500 hover:text-white"><Minus className="h-4 w-4" /></Button>
                          <span className="px-4 py-1 bg-red-500/20 text-red-300 font-bold rounded">🟥 {item.red}</span>
                          <Button size="sm" variant="outline" onClick={() => updateCard(item.id, item.yellow, item.red + 1)} className="bg-[#0a1428] border-red-500 text-red-500 hover:bg-red-500 hover:text-white"><Plus className="h-4 w-4" /></Button>
                        </div>
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
              <CardHeader><CardTitle className="text-yellow-300">إدارة الأهداف وكروت الفيفا</CardTitle><Input placeholder="ابحث عن لاعب أو فريق..." value={goalSearchTerm} onChange={(e) => setGoalSearchTerm(e.target.value)} className="mt-4 max-w-md border-yellow-400 bg-[#1e2a4a] text-white" /></CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className={`grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-[#1e2a4a] rounded-2xl border ${activeTournament === 'juniors' ? 'border-cyan-500/30' : 'border-yellow-400/30'}`}>
                  <Input value={goalForm.player} onChange={e => setGoalForm(p => ({...p, player: e.target.value}))} placeholder="اسم اللاعب" className="bg-[#0a1428] border-yellow-400 text-white" />
                  <select value={goalForm.team} onChange={e => setGoalForm(p => ({...p, team: e.target.value}))} className="bg-[#0a1428] border border-yellow-400 rounded-2xl p-3 text-white">{currentTeamsList.map(t => <option key={t} value={t}>{t}</option>)}</select>
                  <Input type="number" value={goalForm.goalsCount} onChange={e => setGoalForm(p => ({...p, goalsCount: Number(e.target.value)}))} placeholder="عدد الأهداف" className="bg-[#0a1428] border-yellow-400 text-white" />
                  <Input value={goalForm.imageUrl} onChange={e => setGoalForm(p => ({...p, imageUrl: e.target.value}))} placeholder="رابط الصورة" className="bg-[#0a1428] border-yellow-400 text-white" />
                  
                  <div className="grid grid-cols-7 gap-2 mt-2 w-full md:col-span-4">
                     <div className="flex flex-col gap-1"><label className="text-[10px] text-cyan-300 text-center font-bold">التقييم</label><Input type="number" value={goalForm.rating} onChange={e => setGoalForm(p => ({...p, rating: Number(e.target.value)}))} className="bg-[#0a1428] border-yellow-400 text-white text-center font-black h-10 p-1" /></div>
                     <div className="flex flex-col gap-1"><label className="text-[10px] text-cyan-300 text-center font-bold">السرعة</label><Input type="number" value={goalForm.pac} onChange={e => setGoalForm(p => ({...p, pac: Number(e.target.value)}))} className="bg-[#0a1428] border-white/20 text-white text-center h-10 p-1" /></div>
                     <div className="flex flex-col gap-1"><label className="text-[10px] text-cyan-300 text-center font-bold">الشوط</label><Input type="number" value={goalForm.sho} onChange={e => setGoalForm(p => ({...p, sho: Number(e.target.value)}))} className="bg-[#0a1428] border-white/20 text-white text-center h-10 p-1" /></div>
                     <div className="flex flex-col gap-1"><label className="text-[10px] text-cyan-300 text-center font-bold">التمرير</label><Input type="number" value={goalForm.pas} onChange={e => setGoalForm(p => ({...p, pas: Number(e.target.value)}))} className="bg-[#0a1428] border-white/20 text-white text-center h-10 p-1" /></div>
                     <div className="flex flex-col gap-1"><label className="text-[10px] text-cyan-300 text-center font-bold">المراوغة</label><Input type="number" value={goalForm.dri} onChange={e => setGoalForm(p => ({...p, dri: Number(e.target.value)}))} className="bg-[#0a1428] border-white/20 text-white text-center h-10 p-1" /></div>
                     <div className="flex flex-col gap-1"><label className="text-[10px] text-cyan-300 text-center font-bold">الدفاع</label><Input type="number" value={goalForm.def} onChange={e => setGoalForm(p => ({...p, def: Number(e.target.value)}))} className="bg-[#0a1428] border-white/20 text-white text-center h-10 p-1" /></div>
                     <div className="flex flex-col gap-1"><label className="text-[10px] text-cyan-300 text-center font-bold">البدني</label><Input type="number" value={goalForm.phy} onChange={e => setGoalForm(p => ({...p, phy: Number(e.target.value)}))} className="bg-[#0a1428] border-white/20 text-white text-center h-10 p-1" /></div>
                  </div>

                  <div className="flex gap-4 mt-4 md:col-span-4 w-full">
                    <Button onClick={addOrUpdateGoal} className={`flex-1 font-black h-12 transition-all ${activeTournament === 'juniors' ? 'bg-cyan-500 text-white hover:bg-cyan-600' : 'bg-yellow-400 text-black hover:bg-yellow-500'}`}>
                      {editingGoalId ? "تعديل الهدف والطاقات" : "إضافة الهدف والطاقات"}
                    </Button>
                    {editingGoalId && (
                      <Button onClick={() => { setEditingGoalId(null); setGoalForm({ player: "", team: currentTeamsList[0] || "", goalsCount: 1, imageUrl: "", ...defaultStats }); }} className="bg-gray-600 hover:bg-gray-700 text-white font-bold h-12 px-8">إلغاء</Button>
                    )}
                  </div>
                </div>
                <div className="space-y-3">{filteredGoals.map(goal => (<Card key={goal.id} className="bg-[#1e2a4a] border border-white/10"><CardContent className="p-4 flex justify-between items-center text-white"><div className="flex items-center gap-4">{goal.imageUrl ? <img src={goal.imageUrl} className="h-10 w-10 rounded-full object-cover border border-yellow-400" /> : <div className="h-10 w-10 rounded-full bg-[#0a1428] flex items-center justify-center text-xl">👤</div>}<div><div className="font-bold">{goal.player} <span className="text-yellow-400 text-xs ml-1">({goal.rating || 99})</span></div><div className="text-cyan-300 text-sm">{goal.team} — {goal.goals} هدف</div></div></div><div className="flex gap-2"><Button size="sm" onClick={() => startEditGoal(goal)} className="bg-yellow-400 text-black hover:bg-yellow-500"><Edit className="h-4 w-4" /></Button><Button size="sm" variant="destructive" onClick={() => deleteGoal(goal.id)}><Trash2 className="h-4 w-4" /></Button></div></CardContent></Card>))}</div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="media">
            <Card className="border-emerald-500 bg-[#13213a]">
              <CardHeader><CardTitle className="text-emerald-400 flex items-center gap-2"><Video /> المركز الإعلامي للفيديوهات</CardTitle></CardHeader>
              <CardContent className="space-y-6 p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-[#1e2a4a] rounded-2xl"><Input value={mediaForm.title} onChange={e => setMediaForm(p => ({...p, title: e.target.value}))} placeholder="عنوان الفيديو" className="bg-[#0a1428] border-emerald-500 text-white" /><Input value={mediaForm.url} onChange={e => setMediaForm(p => ({...p, url: e.target.value}))} placeholder="رابط اليوتيوب" className="bg-[#0a1428] border-emerald-500 text-white" /><Button onClick={addMedia} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold h-full">إضافة للفيديو</Button></div>
                <div className="space-y-3">{mediaItems.map(item => (<div key={item.id} className="bg-[#1e2a4a] p-4 rounded-2xl flex justify-between items-center border border-emerald-500/30"><div><div className="font-bold text-white text-lg">{item.title}</div><a href={item.url} target="_blank" className="text-cyan-300 text-sm hover:underline">{item.url}</a></div><Button size="sm" variant="destructive" onClick={() => deleteMedia(item.id)}><Trash2 className="h-4 w-4" /></Button></div>))}</div>
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
          
          <TabsContent value="ticker">
            <Card className="border-yellow-400 bg-[#13213a]">
               <CardHeader><CardTitle className="text-yellow-300">شريط الأخبار العام</CardTitle></CardHeader>
               <CardContent className="p-6 space-y-6"><Input value={tickerText} onChange={e => setTickerText(e.target.value)} placeholder="اكتب الخبر هنا..." className="py-8 text-lg bg-[#1e2a4a] border-yellow-400 text-white" /><Button onClick={saveTicker} className="w-full bg-yellow-400 text-black py-7 font-bold">حفظ ونشر الخبر</Button></CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
}
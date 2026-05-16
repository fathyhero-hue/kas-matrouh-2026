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
const getLabelSuggestions = (round: string) => { if (round === "الملحق") return ["م 97", "م 98", "م 99", "م 100", "م 101", "م 102", "م 103", "م 104"]; if (round === "دور الستة عشر") return ["م 1", "م 2", "م 3", "م 4", "م 5", "م 6", "م 7", "م 8"]; if (round === "دور الثمانية") return ["مربع 1", "مربع 2", "مربع 3", "مربع 4"]; if (round === "نصف النهائي") return ["نصف 1", "نصف 2"]; if (round === "النهائي") return ["النهائي"]; return []; };
const pushNotification = async (title: string, body: string) => { try { const res = await fetch("/api/push-service", { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify({ title, body }) }); return res.ok; } catch(e) { return false; } };
const getAccurateLiveMinute = (match: any) => { const baseMinute = Number(match?.liveMinuteBase ?? match?.liveMinute ?? 0) || 0; const startedAt = Number(match?.timerStartedAt || 0); const pausedTotal = Number(match?.timerPausedTotal || 0) || 0; if (!match?.isTimerRunning || !startedAt) return Number(match?.liveMinute ?? baseMinute) || 0; const elapsed = Math.max(0, Date.now() - startedAt - pausedTotal); return baseMinute + Math.floor(elapsed / 60000); };

export default function AdminPage() {
  const [isAuth, setIsAuth] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [mainAppTab, setMainAppTab] = useState<'matrouh_cup' | 'elite_cup' | 'shop'>('matrouh_cup');
  const [cupEdition, setCupEdition] = useState<'edition_3' | 'edition_4'>('edition_3');
  const [activeTournament, setActiveTournament] = useState<'youth' | 'juniors'>('youth'); 
  const [activeTab, setActiveTab] = useState("champion");
  const [eliteActiveTab, setEliteActiveTab] = useState("reg_settings");
  
  const [eliteTeams, setEliteTeams] = useState<any[]>([]);
  const [eliteTeamForm, setEliteTeamForm] = useState({ name: "", logoUrl: "" });
  
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
  
  // 👈 تم تصليح السهم البرمي هنا لتجنب خطأ match is not defined
  const [quickMotmForm, setQuickMotmForm] = useState({ player: "", team: "", rating: 99 });
  const [time, setTime] = useState<Date | null>(null);

  const sortedTeams = useMemo(() => Array.from(new Set([...CLEANED_TEAM_NAMES, ...PLAYOFF_TEAMS])).sort((a, b) => a.localeCompare(b, "ar")), []);
  const sortedJuniorsTeams = useMemo(() => [...JUNIORS_TEAMS].sort((a, b) => a.localeCompare(b, "ar")), []);
  const currentTeamsList = useMemo(() => {
    if (cupEdition === 'edition_3') return activeTournament === 'youth' ? sortedTeams : sortedJuniorsTeams;
    return Array.from(new Set(rostersList.map(r => r.id))); 
  }, [cupEdition, activeTournament, sortedTeams, sortedJuniorsTeams, rostersList]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [matchForm, setMatchForm] = useState({ teamA: "", teamALogo: "", teamB: "", teamBLogo: "", homeGoals: 0, awayGoals: 0, matchLabel: "", round: "الجولة الأولى", date: new Date().toISOString().slice(0, 10), time: "15:30", status: "لم تبدأ" });
  const [bracketForm, setBracketForm] = useState({ round: "الملحق", matchLabel: "م 97", teamA: "", teamB: "", date: new Date().toISOString().slice(0, 10), time: "15:30" });
  const defaultStats = { rating: 99, pac: 99, sho: 99, pas: 99, dri: 99, def: 99, phy: 99 };
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [goalForm, setGoalForm] = useState({ player: "", team: currentTeamsList[0] || "", goalsCount: 1, imageUrl: "", ...defaultStats });
  const [editingMotmId, setEditingMotmId] = useState<string | null>(null); 
  const [motmForm, setMotmForm] = useState({ player: "", team: currentTeamsList[0] || "", imageUrl: "", matchName: "", sponsorName: SPONSORS[0].name, sponsorLogo: SPONSORS[0].src, ...defaultStats });
  const [cardForm, setCardForm] = useState({ player: "", team: currentTeamsList[0] || "", type: "yellow" as "yellow" | "red" });
  const [mediaForm, setMediaForm] = useState({ type: "news", title: "", url: "", imageUrl: "", body: "" });
  const defaultPlayer = { name: "", team: "", imageUrl: "", rating: 99 };
  const defaultCoach = { name: "", team: "", imageUrl: "", rating: 99 };
  const [formationForm, setFormationForm] = useState({ round: "دور المجموعات", players: Array(7).fill({...defaultPlayer}), coach: {...defaultCoach} });
  const [liveEventForms, setLiveEventForms] = useState<Record<string, { minute?: number, type: string, text: string }>>({});
  const [editingRosterId, setEditingRosterId] = useState<string | null>(null);
  const [rosterFormAdmin, setRosterFormAdmin] = useState({ managerName: "", managerPhone: "", password: "", isSubmitted: false, logoUrl: "", players: Array.from({ length: 12 }, () => ({ name: "", number: "" })) });

  const getColl = (base: string) => { let coll = base; if (cupEdition === 'edition_4') coll += '_ed4'; if (activeTournament === 'juniors') coll += '_juniors'; return coll; };
  useEffect(() => { const clockTimer = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(clockTimer); }, []);
  
  useEffect(() => { 
      if (cupEdition === 'edition_3' && activeTab === 'matches') setActiveTab('champion');
      if (cupEdition === 'edition_4' && activeTab === 'champion') setActiveTab('registration_settings');
  }, [cupEdition, activeTab]);

  useEffect(() => {
    setMatchForm(p => ({...p, teamA: "", teamALogo: "", teamB: "", teamBLogo: "", matchLabel: ""})); setGoalForm(p => ({...p, team: currentTeamsList[0] || "", player: "", goalsCount: 1, imageUrl: ""})); setCardForm(p => ({...p, team: currentTeamsList[0] || "", player: ""})); setMotmForm(p => ({...p, team: currentTeamsList[0] || "", player: "", imageUrl: "", matchName: ""})); setEditingId(null); setEditingGoalId(null); setEditingMotmId(null); setEditingRosterId(null);
  }, [activeTournament, currentTeamsList, cupEdition]);
  
  useEffect(() => {
    const existing = formationsList.find(f => f.round === formationForm.round);
    if(existing) { const playersArr = Array.isArray(existing.players) ? [...existing.players] : Array(7).fill({...defaultPlayer}); while(playersArr.length < 7) playersArr.push({...defaultPlayer}); setFormationForm({ round: existing.round, players: playersArr, coach: existing.coach || {...defaultCoach} }); } 
    else { setFormationForm(p => ({ ...p, players: Array(7).fill({...defaultPlayer}), coach: {...defaultCoach} })); }
  }, [formationForm.round, formationsList]);
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
    const unsubOrders = onSnapshot(collection(db, "orders"), (snap) => setOrdersList(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a:any,b:any)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")))));
    const unsubTicker = onSnapshot(doc(db, "settings", "ticker"), (docSnap) => setTickerText(docSnap.data()?.text || ""));
    const unsubEliteTeams = onSnapshot(collection(db, "elite_teams"), (snap) => setEliteTeams(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    
    const unsubBanned = onSnapshot(collection(db, "banned_entities"), (snap) => setBannedList(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubRestricted = onSnapshot(collection(db, "restricted_players"), (snap) => setRestrictedPlayers(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubRegMat = onSnapshot(doc(db, "settings", "registration_matrouh"), (docSnap) => { if(docSnap.exists()){ setRegDeadlineMatrouh(docSnap.data().deadline || ""); setRegPasswordMatrouh(docSnap.data().password || ""); setRegPriceMatrouh(docSnap.data().price || 500); } });
    const unsubRegElite = onSnapshot(doc(db, "settings", "registration_elite"), (docSnap) => { if(docSnap.exists()){ setRegDeadlineElite(docSnap.data().deadline || ""); setRegPasswordElite(docSnap.data().password || ""); setRegPriceElite(docSnap.data().price || 1000); } });

    const timerInterval = setInterval(() => { matchesRef.current.forEach(m => { if (m.isTimerRunning && m.status !== "انتهت" && m.status !== "استراحة" && m.status !== "ضربات جزاء" && m.status !== "ستبدأ بعد قليل") { const accurateMinute = getAccurateLiveMinute(m); if (accurateMinute !== Number(m.liveMinute || 0)) { updateDoc(doc(db, collName, m.id), { liveMinute: accurateMinute }); } } }); }, 5000); 
    return () => { unsubMatches(); unsubGoals(); unsubCards(); unsubMedia(); unsubPredictions(); unsubMotm(); unsubForms(); unsubRosters(); unsubOrders(); unsubTicker(); unsubEliteTeams(); unsubBanned(); unsubRestricted(); unsubRegMat(); unsubRegElite(); clearInterval(timerInterval); };
  }, [isAuth, activeTournament, cupEdition]);

  const handleLogin = () => passwordInput === ADMIN_PASSWORD ? setIsAuth(true) : alert("كلمة السر خاطئة");
  const handleAutoProgression = async (match: any) => { if (match.status !== "انتهت") return; const winner = match.homeGoals > match.awayGoals ? match.teamA : (match.awayGoals > match.homeGoals ? match.teamB : null); if (!winner) return; const prog = BRACKET_MAP[match.matchLabel]; if (prog) { const nextMatch = matches.find(m => m.matchLabel === prog.targetLabel && m.round === "دور الستة عشر"); if (nextMatch) { await updateDoc(doc(db, getColl("matches"), nextMatch.id), { [prog.targetSide]: winner }); } } };
  const saveBracketMatch = async () => { if (!bracketForm.teamA.trim() && !bracketForm.teamB.trim()) return alert("يجب اختيار الفرق أولاً!"); const existingMatch = matches.find(m => m.round === bracketForm.round && m.matchLabel === bracketForm.matchLabel); const dayName = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"][new Date(bracketForm.date).getDay()]; if (existingMatch) { await updateDoc(doc(db, getColl("matches"), existingMatch.id), { teamA: bracketForm.teamA || existingMatch.teamA, teamB: bracketForm.teamB || existingMatch.teamB, date: bracketForm.date, time: bracketForm.time, dayName }); alert("✅ تم التحديث"); } else { await addDoc(collection(db, getColl("matches")), { round: bracketForm.round, matchLabel: bracketForm.matchLabel, teamA: bracketForm.teamA, teamB: bracketForm.teamB, homeGoals: 0, awayGoals: 0, date: bracketForm.date, time: bracketForm.time, dayName, status: "لم تبدأ", isLive: false, streamClosed: false }); alert("✅ تم الإنشاء"); } };
  const saveMatch = async () => { if (!matchForm.teamA.trim() || !matchForm.teamB.trim()) return alert("يجب إدخال أسماء الفرق!"); const dayName = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"][new Date(matchForm.date).getDay()]; const data = { ...matchForm, dayName, isLive: false, streamClosed: false }; if (editingId) { await updateDoc(doc(db, getColl("matches"), editingId), data); setEditingId(null); alert("✅ تم التعديل"); } else { await addDoc(collection(db, getColl("matches")), data); alert("✅ تم الإضافة"); } setMatchForm({ teamA: "", teamALogo: "", teamB: "", teamBLogo: "", homeGoals: 0, awayGoals: 0, matchLabel: "", round: "الجولة الأولى", date: new Date().toISOString().slice(0, 10), time: "15:30", status: "لم تبدأ" }); };
  const startEdit = (match: any) => { setEditingId(match.id); setMatchForm({ teamA: match.teamA, teamALogo: match.teamALogo || "", teamB: match.teamB, teamBLogo: match.teamBLogo || "", homeGoals: match.homeGoals, awayGoals: match.awayGoals, matchLabel: match.matchLabel || "", round: match.round, date: match.date, time: match.time, status: match.status || "لم تبدأ" }); setActiveTab(cupEdition === 'edition_3' ? "knockout" : "matches"); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const deleteMatch = async (id: string) => confirm("متأكد من الحذف؟") && await deleteDoc(doc(db, getColl("matches"), id));
  
  const updateMatchLive = async (id: string, updates: any) => { const currentMatch = matchesRef.current.find(m => m.id === id) || matches.find(m => m.id === id); const nextUpdates = { ...updates }; if (Object.prototype.hasOwnProperty.call(nextUpdates, 'isTimerRunning')) { if (nextUpdates.isTimerRunning) { const baseMinute = getAccurateLiveMinute(currentMatch); nextUpdates.liveMinute = baseMinute; nextUpdates.liveMinuteBase = baseMinute; nextUpdates.timerStartedAt = Date.now(); nextUpdates.timerPausedTotal = 0; } else if (currentMatch) { const pausedMinute = getAccurateLiveMinute(currentMatch); nextUpdates.liveMinute = pausedMinute; nextUpdates.liveMinuteBase = pausedMinute; nextUpdates.timerStartedAt = null; nextUpdates.timerPausedTotal = 0; } } if (Object.prototype.hasOwnProperty.call(nextUpdates, 'liveMinute') && currentMatch?.isTimerRunning && !Object.prototype.hasOwnProperty.call(updates, 'isTimerRunning')) { nextUpdates.liveMinuteBase = Number(nextUpdates.liveMinute) || 0; nextUpdates.timerStartedAt = Date.now(); nextUpdates.timerPausedTotal = 0; } await updateDoc(doc(db, getColl("matches"), id), nextUpdates); if (nextUpdates.status === "انتهت" && currentMatch) handleAutoProgression({ ...currentMatch, ...nextUpdates }); };
  const addLiveEvent = async (matchId: string, currentLiveMinute: number) => { const form = liveEventForms[matchId] || {}; if (!form.text || !form.text.trim()) return alert("يرجى كتابة تفاصيل الحدث!"); const minute = form.minute !== undefined ? form.minute : currentLiveMinute; const currentMatch = matches.find(m => m.id === matchId); if(!currentMatch) return; const newEvent = { minute, type: form.type || 'info', text: form.text.trim(), createdAt: new Date().toISOString() }; await updateDoc(doc(db, getColl("matches"), matchId), { liveEvents: [...(currentMatch.liveEvents || []), newEvent] }); setLiveEventForms(p => ({ ...p, [matchId]: { minute: currentLiveMinute, type: 'info', text: '' } })); };
  const deleteLiveEvent = async (matchId: string, eventIndex: number) => { if(!confirm("هل تريد الحذف؟")) return; const currentMatch = matches.find(m => m.id === matchId); if(!currentMatch) return; const updatedEvents = [...(currentMatch.liveEvents || [])]; updatedEvents.splice(eventIndex, 1); await updateDoc(doc(db, getColl("matches"), matchId), { liveEvents: updatedEvents }); };

  const startEditRoster = (teamName: string) => { const existing = rostersList.find(r => r.id === teamName); let loadedPlayers = Array.from({ length: 12 }, () => ({ name: "", number: "" })); if (existing && existing.players) { loadedPlayers = [...existing.players]; while(loadedPlayers.length < 12) loadedPlayers.push({ name: "", number: "" }); } setRosterFormAdmin({ managerName: existing?.managerName || "", managerPhone: existing?.managerPhone || "", password: existing?.password || "", logoUrl: existing?.logoUrl || "", isSubmitted: existing?.isSubmitted || false, players: loadedPlayers.slice(0,12) }); setEditingRosterId(teamName); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const updateAdminRosterPlayer = (index: number, field: string, value: string) => { setRosterFormAdmin(prev => { const newPlayers = [...prev.players]; newPlayers[index] = { ...newPlayers[index], [field]: value }; return { ...prev, players: newPlayers }; }); };
  const saveRosterAdmin = async () => { if(!editingRosterId) return; try { await setDoc(doc(db, getColl("team_rosters"), editingRosterId), { teamName: editingRosterId, managerName: rosterFormAdmin.managerName, managerPhone: rosterFormAdmin.managerPhone, password: rosterFormAdmin.password, logoUrl: rosterFormAdmin.logoUrl, isSubmitted: rosterFormAdmin.isSubmitted, players: rosterFormAdmin.players, updatedAt: new Date().toISOString() }, { merge: true }); alert("تم الحفظ بنجاح! ✔️"); setEditingRosterId(null); } catch(e) { alert("حدث خطأ."); } };
  const deleteRoster = async (teamName: string) => { if(confirm(`هل أنت متأكد من مسح قائمة ${teamName} بالكامل؟`)) { await deleteDoc(doc(db, getColl("team_rosters"), teamName)); alert("تم مسح القائمة بنجاح."); } };
  const unlockRoster = async (teamName: string) => { if(confirm(`هل تريد فتح القفل لقائمة ${teamName}؟`)) { await updateDoc(doc(db, getColl("team_rosters"), teamName), { isSubmitted: false }); alert("تم فتح القائمة."); } };
  const lockRoster = async (teamName: string) => { await updateDoc(doc(db, getColl("team_rosters"), teamName), { isSubmitted: true }); alert("تم قفل القائمة واعتمادها."); };
  
  const openMotmPopup = (match: any) => { setMotmPopupMatch(match); setQuickMotmForm({ player: "", team: match.teamA, rating: 99 }); };
  const saveQuickMotm = async () => { if (!quickMotmForm.player.trim()) return alert("اكتب اسم اللاعب!"); try { await addDoc(collection(db, getColl("motm")), { player: quickMotmForm.player.trim(), team: quickMotmForm.team, matchName: `${motmPopupMatch.teamA} vs ${motmPopupMatch.teamB}`, imageUrl: "", sponsorName: SPONSORS[0].name, sponsorLogo: SPONSORS[0].src, rating: Number(quickMotmForm.rating), pac: 99, sho: 99, pas: 99, dri: 99, def: 99, phy: 99 }); alert("تم تسجيل النجم بنجاح!"); setMotmPopupMatch(null); } catch (e) { alert("حدث خطأ."); } };
  const addMotm = async () => { if (!motmForm.player.trim()) return alert("اكتب اسم اللاعب!"); const data = { ...motmForm, rating: Number(motmForm.rating), pac: Number(motmForm.pac), sho: Number(motmForm.sho), pas: Number(motmForm.pas), dri: Number(motmForm.dri), def: Number(motmForm.def), phy: Number(motmForm.phy) }; if (editingMotmId) { await updateDoc(doc(db, getColl("motm"), editingMotmId), data); setEditingMotmId(null); alert("تم التعديل"); } else { await addDoc(collection(db, getColl("motm")), data); alert("تم الإضافة"); } setMotmForm({ player: "", team: currentTeamsList[0] || "", imageUrl: "", matchName: "", sponsorName: SPONSORS[0].name, sponsorLogo: SPONSORS[0].src, ...defaultStats }); };
  const startEditMotm = (m: any) => { setEditingMotmId(m.id); setMotmForm({ player: m.player || "", team: m.team || currentTeamsList[0], imageUrl: m.imageUrl || "", matchName: m.matchName || "", sponsorName: m.sponsorName || SPONSORS[0].name, sponsorLogo: m.sponsorLogo || SPONSORS[0].src, rating: m.rating || 99, pac: m.pac || 99, sho: m.sho || 99, pas: m.pas || 99, dri: m.dri || 99, def: m.def || 99, phy: m.phy || 99 }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const deleteMotm = async (id: string) => confirm("حذف هذا اللاعب؟") && await deleteDoc(doc(db, getColl("motm"), id));

  const openPoster = async (match: any) => { setPosterMatch(match); setIsPreparingPoster(true); setPosterLogos({ a: "", b: "" }); const fetchBase64 = async (url: string) => { if (!url) return ""; try { const res = await fetch(`https://wsrv.nl/?url=${encodeURIComponent(url)}&output=png`); const blob = await res.blob(); return await new Promise<string>((resolve) => { const reader = new FileReader(); reader.onloadend = () => resolve(reader.result as string); reader.readAsDataURL(blob); }); } catch (e) { return url; } }; setPosterLogos({ a: await fetchBase64(match.teamALogo), b: await fetchBase64(match.teamBLogo) }); setIsPreparingPoster(false); };
  const downloadPoster = async () => { const element = document.getElementById("poster-canvas-node"); if (!element) return; setIsGeneratingPoster(true); try { await new Promise(resolve => setTimeout(resolve, 300)); const htmlToImage = await import('html-to-image'); const dataUrl = await htmlToImage.toJpeg(element, { quality: 0.95, backgroundColor: '#050a14', pixelRatio: 2 }); const link = document.createElement("a"); link.href = dataUrl; link.download = `Result_${posterMatch.teamA}_vs_${posterMatch.teamB}.jpg`; document.body.appendChild(link); link.click(); document.body.removeChild(link); } catch (err) {} setIsGeneratingPoster(false); };

  const addOrUpdateGoal = async () => { if (!goalForm.player.trim()) return alert("اكتب اسم اللاعب"); const statsData: any = { goals: Number(goalForm.goalsCount), rating: Number(goalForm.rating), pac: Number(goalForm.pac), sho: Number(goalForm.sho), pas: Number(goalForm.pas), dri: Number(goalForm.dri), def: Number(goalForm.def), phy: Number(goalForm.phy) }; if (goalForm.imageUrl.trim()) statsData.imageUrl = goalForm.imageUrl.trim(); if (editingGoalId) { await updateDoc(doc(db, getColl("goals"), editingGoalId), { player: goalForm.player.trim(), team: goalForm.team, ...statsData }); setEditingGoalId(null); alert("تم التعديل"); } else { const existingPlayer = goals.find(g => normalizeTeamName(g.player) === normalizeTeamName(goalForm.player.trim()) && g.team === goalForm.team); if (existingPlayer) { await updateDoc(doc(db, getColl("goals"), existingPlayer.id), { ...statsData, goals: (Number(existingPlayer.goals) || 0) + statsData.goals }); alert(`تم التحديث تراكمياً`); } else { await addDoc(collection(db, getColl("goals")), { player: goalForm.player.trim(), team: goalForm.team, ...statsData }); alert("تم الإضافة"); } } setGoalForm({ player: "", team: currentTeamsList[0] || "", goalsCount: 1, imageUrl: "", ...defaultStats }); };
  const startEditGoal = (goal: any) => { setEditingGoalId(goal.id); setGoalForm({ player: goal.player, team: goal.team, goalsCount: goal.goals, imageUrl: goal.imageUrl || "", rating: goal.rating || 99, pac: goal.pac || 99, sho: goal.sho || 99, pas: goal.pas || 99, dri: goal.dri || 99, def: goal.def || 99, phy: goal.phy || 99 }); };
  const deleteGoal = async (id: string) => confirm("حذف هذا الهدف؟") && await deleteDoc(doc(db, getColl("goals"), id));
  
  const addCard = async () => { if (!cardForm.player.trim()) return alert("اكتب اسم اللاعب"); const existingPlayer = cardEvents.find(c => normalizeTeamName(c.player) === normalizeTeamName(cardForm.player.trim()) && c.team === cardForm.team); if (existingPlayer) { await updateDoc(doc(db, getColl("cards"), existingPlayer.id), { yellow: (Number(existingPlayer.yellow) || 0) + (cardForm.type === "yellow" ? 1 : 0), red: (Number(existingPlayer.red) || 0) + (cardForm.type === "red" ? 1 : 0) }); alert(`تمت إضافة بطاقة تراكمية`); } else { await addDoc(collection(db, getColl("cards")), { player: cardForm.player.trim(), team: cardForm.team, yellow: cardForm.type === "yellow" ? 1 : 0, red: cardForm.type === "red" ? 1 : 0 }); alert("تم الإضافة"); } setCardForm(p => ({ ...p, player: "" })); };
  const updateCard = async (id: string, yellow: number, red: number) => await updateDoc(doc(db, getColl("cards"), id), { yellow, red });
  const deleteCard = async (id: string) => confirm("حذف البطاقة؟") && await deleteDoc(doc(db, getColl("cards"), id));
  const archiveAndResetCards = async () => { if (!confirm("تصفير للأرشيف؟")) return; try { for (const card of cardEvents) { if (card.yellow > 0 || card.red > 0) { await addDoc(collection(db, getColl("archived_cards")), { ...card, archivedAt: new Date().toISOString() }); await updateDoc(doc(db, getColl("cards"), card.id), { yellow: 0, red: 0 }); } } alert(`تمت الأرشفة بنجاح`); } catch (e) {} };

  const addMedia = async () => { if (!mediaForm.title.trim()) return alert("العنوان مطلوب"); await addDoc(collection(db, getColl("media")), mediaForm); setMediaForm({ type: "news", title: "", url: "", imageUrl: "", body: "" }); alert("تم الإضافة"); };
  const deleteMedia = async (id: string) => confirm("حذف العنصر؟") && await deleteDoc(doc(db, getColl("media"), id));
  const saveFormation = async () => { const existing = formationsList.find(f => f.round === formationForm.round); if(existing) { await updateDoc(doc(db, getColl("formations"), existing.id), { players: formationForm.players, coach: formationForm.coach || {...defaultCoach} }); alert("تم التحديث"); } else { await addDoc(collection(db, getColl("formations")), { round: formationForm.round, players: formationForm.players, coach: formationForm.coach || {...defaultCoach} }); alert("تم الحفظ"); } };
  const updateFormationPlayer = (index: number, field: string, value: any) => { setFormationForm(prev => { const newPlayers = [...prev.players]; newPlayers[index] = { ...newPlayers[index], [field]: value }; return { ...prev, players: newPlayers }; }); };
  const updateFormationCoach = (field: string, value: any) => { setFormationForm(prev => ({ ...prev, coach: { ...(prev.coach || {...defaultCoach}), [field]: value } })); };
  const deletePrediction = async (id: string) => { if (confirm("حذف التوقع؟")) { await deleteDoc(doc(db, getColl("predictions"), id)); alert("تم الحذف"); } };
  const deleteAllPredictions = async () => { if (!confirm("مسح جميع التوقعات؟")) return; for (const p of predictions) { await deleteDoc(doc(db, getColl("predictions"), p.id)); } alert("تم التصفية"); };
  const saveTicker = async () => { if (!tickerText.trim()) return alert("اكتب الخبر"); await setDoc(doc(db, "settings", "ticker"), { text: tickerText.trim() }); alert("تم النشر"); };
  const sendQuickNotification = async (title: string, body: string) => { const success = await pushNotification(title, body); if(success) alert(`تم الإرسال السريع`); };
  const sendNotification = async () => { if (!notifyTitle || !notifyBody) return alert("مطلوب العنوان والتفاصيل"); setIsSending(true); const success = await pushNotification(notifyTitle, notifyBody); if (success) { alert(`تم الإرسال للجميع`); setNotifyTitle(""); setNotifyBody(""); } setIsSending(false); };
  
  const addBannedEntity = async () => { if (!bannedForm.name.trim()) return alert("يرجى كتابة الاسم"); await addDoc(collection(db, "banned_entities"), { ...bannedForm, name: bannedForm.name.trim() }); setBannedForm({ name: "", type: "player" }); alert("تم الإضافة لسجل الحظر"); };
  const removeBannedEntity = async (id: string) => { if (confirm("رفع الحظر عن هذا الاسم؟")) await deleteDoc(doc(db, "banned_entities", id)); };
  
  const addRestrictedPlayer = async () => { if (!restrictedForm.name.trim()) return alert("يرجى كتابة اسم اللاعب"); await addDoc(collection(db, "restricted_players"), { name: restrictedForm.name.trim() }); setRestrictedForm({ name: "" }); alert("تم إضافة اللاعب لقائمة المقيدين"); };
  const removeRestrictedPlayer = async (id: string) => { if (confirm("إزالة اللاعب من القائمة المقيدة؟")) await deleteDoc(doc(db, "restricted_players", id)); };
  
  const saveRegistrationSettingsMatrouh = async () => { if (!regDeadlineMatrouh || !regPasswordMatrouh) return alert("الرجاء استكمال البيانات"); await setDoc(doc(db, "settings", "registration_matrouh"), { deadline: regDeadlineMatrouh, password: regPasswordMatrouh, price: Number(regPriceMatrouh) }, { merge: true }); alert("تم تحديث إعدادات وأسعار كأس مطروح 💾"); };
  const saveRegistrationSettingsElite = async () => { if (!regDeadlineElite || !regPasswordElite) return alert("الرجاء استكمال البيانات"); await setDoc(doc(db, "settings", "registration_elite"), { deadline: regDeadlineElite, password: regPasswordElite, price: Number(regPriceElite) }, { merge: true }); alert("تم تحديث إعدادات وأسعار كأس النخبة 💾"); };

  const addEliteTeam = async () => { if (!eliteTeamForm.name.trim()) return alert("أدخل اسم الفريق"); await addDoc(collection(db, "elite_teams"), eliteTeamForm); alert("تم إضافة الفريق للنخبة"); setEliteTeamForm({ name: "", logoUrl: "" }); };
  const deleteEliteTeam = async (id: string) => { if(confirm("حذف هذا الفريق؟")) await deleteDoc(doc(db, "elite_teams", id)); };

  const safeGoalSearch = goalSearchTerm.toLowerCase(); 
  const filteredGoals = goals.filter(g => normalizeTeamName(g.player).includes(safeGoalSearch) || normalizeTeamName(g.team).includes(safeGoalSearch));
  const safeCardSearch = cardSearchTerm.toLowerCase(); 
  const filteredCards = cardEvents.filter(c => normalizeTeamName(c.player).includes(safeCardSearch) || normalizeTeamName(c.team).includes(safeCardSearch));
  
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
  const liveMatchesList = matches.filter(m => {
    if (m.isLive || m.status === "live" || m.status === "مباشر" || m.status === "شغال الآن") return true;
    if (m.date === todayStr && m.time) {
      const now = time || new Date(); const [h, min] = m.time.split(':').map(Number);
      const matchTime = new Date(); matchTime.setHours(h, min, 0, 0);
      const diffMins = (now.getTime() - matchTime.getTime()) / 60000;
      if (diffMins >= -30 && diffMins <= 180 && m.status !== "انتهت") return true;
    }
    return false;
  });
  const liveMatches = sortMatches(liveMatchesList);

  const allAdminTabs = [
    { key: "champion", label: "👑 البطل", hideForEd4: true },
    { key: "registration_settings", label: "⚙️ إعدادات التسجيل والاشتراكات", hideForEd3: true },
    { key: "knockout", label: "🏆 الإقصائيات", hideForEd4: false },
    { key: "matches", label: "⚽ المباريات واللايف", hideForEd3: true },
    { key: "goals", label: "🥇 الهدافين", hideForEd4: false },
    { key: "cards", label: "🟨 الكروت", hideForEd4: false },
    { key: "motm", label: "🌟 نجوم المباريات", hideForEd4: false },
    { key: "rosters", label: "📋 القوائم", hideForEd4: false },
    { key: "totw", label: "🏟️ تشكيلة الجولة", hideForEd4: false },
    { key: "fantasy", label: "🎁 فانتزي", hideForEd4: false },
    { key: "media", label: "📰 الأخبار", hideForEd4: false },
    { key: "notifications", label: "🔔 إشعارات", hideForEd4: false },
    { key: "ticker", label: "✍️ شريط الأخبار", hideForEd4: false }
  ];

  if (!isAuth) return (
    <div dir="rtl" className="min-h-screen bg-[#0a1428] flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-yellow-400 bg-[#13213a]">
        <CardHeader className="text-center"><Trophy className="mx-auto h-12 w-12 text-yellow-400" /><CardTitle className="text-2xl font-black text-yellow-300 mt-4">إدارة مطروح الرياضية</CardTitle></CardHeader>
        <CardContent className="space-y-4"><Input type="password" placeholder="كلمة السر" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} className="bg-[#1e2a4a] border-yellow-400 text-white h-12 text-center text-xl" /><Button onClick={handleLogin} className="w-full bg-yellow-400 text-black font-bold h-12">دخول</Button></CardContent>
      </Card>
    </div>
  );

  return (
    <div dir="rtl" className="min-h-screen bg-[#0a1428] text-white pb-20 font-sans w-full overflow-x-hidden">
      <datalist id="teams-list">{currentTeamsList.map(t => <option key={t} value={t} />)}</datalist>
      
      {/* POPUPS */}
      {motmPopupMatch && (
        <div className="fixed inset-0 bg-black/95 z-[9999] flex flex-col items-center justify-center p-4">
          <Card className="w-full max-w-md bg-[#13213a] border-yellow-400 shadow-2xl">
            <CardHeader className="border-b border-white/10 pb-4">
              <CardTitle className="text-yellow-300 text-center text-xl sm:text-2xl flex items-center justify-center gap-2"><Star/> تسجيل نجم المباراة</CardTitle>
              <p className="text-cyan-300 text-center font-bold text-sm mt-2">{motmPopupMatch.teamA} <span className="text-white">VS</span> {motmPopupMatch.teamB}</p>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-6">
              <div><label className="text-cyan-300 font-bold mb-2 block">اسم اللاعب</label><Input value={quickMotmForm.player} onChange={e => setQuickMotmForm(p => ({...p, player: e.target.value}))} className="bg-[#1e2a4a] border-yellow-400 text-white font-bold h-12 w-full" /></div>
              <div><label className="text-cyan-300 font-bold mb-2 block">فريق اللاعب</label><select value={quickMotmForm.team} onChange={e => setQuickMotmForm(p => ({...p, team: e.target.value}))} className="bg-[#1e2a4a] border border-yellow-400 w-full rounded-xl p-3 text-white font-bold outline-none h-12"><option value={motmPopupMatch.teamA}>{motmPopupMatch.teamA}</option><option value={motmPopupMatch.teamB}>{motmPopupMatch.teamB}</option></select></div>
              <div><label className="text-cyan-300 font-bold mb-2 block">التقييم الأولي</label><Input type="number" value={quickMotmForm.rating} onChange={e => setQuickMotmForm(p => ({...p, rating: Number(e.target.value)}))} className="bg-[#1e2a4a] border-yellow-400 text-white font-bold text-center h-12 w-full" /></div>
              <div className="flex gap-4 mt-6"><Button onClick={saveQuickMotm} className="flex-1 bg-yellow-400 text-black font-black text-lg py-4 w-full">حفظ ✔️</Button><Button onClick={() => setMotmPopupMatch(null)} variant="outline" className="flex-1 border-red-500 text-red-400 hover:bg-red-500 hover:text-white py-4 w-full">إلغاء</Button></div>
            </CardContent>
          </Card>
        </div>
      )}

      {posterMatch && (
        <div className="fixed inset-0 bg-black/95 z-[9998] flex flex-col items-center justify-center p-4 overflow-y-auto w-full">
          <div className="w-full max-w-full overflow-x-auto flex justify-center items-center pb-4">
            <div id="poster-canvas-node" className="relative w-[400px] h-[711px] shrink-0 bg-gradient-to-b from-[#050a14] via-[#13213a] to-[#050a14] flex flex-col items-center overflow-hidden border border-yellow-400/20" dir="rtl">
               <div className="absolute inset-0 opacity-10 bg-[url('/pattern.png')] bg-repeat"></div>
               <div className="mt-8 z-10 flex flex-col items-center">
                  <img src="/logo.png" className="w-48 h-auto object-contain drop-shadow-[0_0_15px_rgba(250,204,21,0.5)] mb-2" alt="مطروح الرياضية" />
                  <h1 className="text-3xl font-black text-yellow-400 mt-2 tracking-wide">كأس مطروح</h1>
                  <p className="text-cyan-300 font-bold text-sm tracking-widest">النسخة الثالثة 2026</p>
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
                     <div className="text-white font-black text-xl mt-1" dir="ltr">({(posterMatch.penaltiesHome || []).filter((p:any)=>p==='scored').length} - {(posterMatch.penaltiesAway || []).filter((p:any)=>p==='scored').length})</div>
                  </div>
               )}
               <div className="absolute bottom-0 w-full flex flex-col items-center z-10 pb-6">
                  <div className="bg-[#1e2a4a] text-cyan-300 w-full text-center py-2 font-bold border-y border-white/5 text-sm mb-4">{getArabicDay(posterMatch.date)} • {posterMatch.date}</div>
                  <div className="flex items-center gap-4 text-white/50 text-xs font-bold"><Star className="w-4 h-4 text-yellow-400/50" /><span>إدارة المنصة: فتحي هيرو 🦅</span><Star className="w-4 h-4 text-yellow-400/50" /></div>
               </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 mt-6 w-full max-w-[400px]">
             <Button onClick={downloadPoster} disabled={isGeneratingPoster || isPreparingPoster} className="w-full bg-yellow-400 text-black hover:bg-yellow-500 font-black py-4 sm:py-6 text-lg sm:text-xl shadow-[0_0_15px_rgba(250,204,21,0.5)]">
               {isGeneratingPoster || isPreparingPoster ? <Loader2 className="animate-spin h-6 w-6 mr-2" /> : <Camera className="h-6 w-6 mr-2" />} تحميل البوستر
             </Button>
             <Button onClick={() => setPosterMatch(null)} variant="outline" className="w-full border-red-500 text-red-400 hover:bg-red-500 hover:text-white py-4 sm:py-6 font-bold text-lg">إغلاق</Button>
          </div>
        </div>
      )}

      {/* DASHBOARD */}
      <div className="mx-auto max-w-7xl p-3 sm:p-4 md:p-6 lg:p-8 w-full overflow-x-hidden">
        <header className="mb-6 sm:mb-8 flex flex-col sm:flex-row justify-between items-center gap-4 w-full border border-yellow-400/30 bg-[#13213a] p-4 sm:p-6 rounded-3xl shadow-xl">
          <div className="flex items-center gap-4">
             <img src="/logo.png" className="w-auto h-12 sm:h-16 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)] object-contain" alt="Logo" />
             <div>
               <h1 className="text-2xl sm:text-3xl font-black text-yellow-300 tracking-wide">مطروح الرياضية</h1>
               <p className="text-cyan-300 font-bold text-sm mt-1">لوحة الإدارة الموحدة والاشتراكات</p>
             </div>
          </div>
          <Button onClick={() => { setIsAuth(false); setPasswordInput(""); }} variant="destructive" className="font-bold flex items-center gap-2"><LogOut className="h-4 w-4" /> خروج</Button>
        </header>

        <div className="flex justify-center mb-6 overflow-x-auto custom-scrollbar pb-2 w-full">
          <div className="bg-[#1e2a4a] p-2 rounded-2xl border border-white/10 inline-flex shadow-xl gap-2 min-w-max">
            <button onClick={() => setMainAppTab('matrouh_cup')} className={`py-3 px-6 rounded-xl text-lg font-black transition-all ${mainAppTab === 'matrouh_cup' ? 'bg-yellow-400 text-black shadow-md' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>🏆 كأس مطروح</button>
            <button onClick={() => setMainAppTab('elite_cup')} className={`py-3 px-6 rounded-xl text-lg font-black transition-all ${mainAppTab === 'elite_cup' ? 'bg-indigo-500 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>🏅 بطولة كأس النخبة</button>
            <button onClick={() => setMainAppTab('shop')} className={`py-3 px-6 rounded-xl text-lg font-black transition-all ${mainAppTab === 'shop' ? 'bg-orange-500 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>🛒 المتجر والطلبات</button>
          </div>
        </div>

        {/* ELITE CUP TAB */}
        {mainAppTab === 'elite_cup' && (
          <div className="space-y-6 animate-in fade-in duration-500">
             <Tabs value={eliteActiveTab} onValueChange={setEliteActiveTab} className="w-full">
               <TabsList className="bg-[#13213a] border border-indigo-500/30 h-auto flex flex-wrap justify-center p-2 rounded-3xl gap-2 w-full shadow-xl">
                 <TabsTrigger value="reg_settings" className="data-[state=active]:bg-indigo-500 data-[state=active]:text-white text-gray-300 font-bold px-6 py-3 rounded-2xl">⚙️ إعدادات التسجيل والاشتراك</TabsTrigger>
                 <TabsTrigger value="teams" className="data-[state=active]:bg-indigo-500 data-[state=active]:text-white text-gray-300 font-bold px-6 py-3 rounded-2xl">🛡️ إدارة الفرق</TabsTrigger>
                 <TabsTrigger value="matches" className="data-[state=active]:bg-indigo-500 data-[state=active]:text-white text-gray-300 font-bold px-6 py-3 rounded-2xl">⚽ جدول المباريات</TabsTrigger>
                 <TabsTrigger value="stats" className="data-[state=active]:bg-indigo-500 data-[state=active]:text-white text-gray-300 font-bold px-6 py-3 rounded-2xl">📈 الإحصائيات</TabsTrigger>
               </TabsList>
               
               <TabsContent value="reg_settings" className="space-y-6 w-full mt-6">
                    <Card className="border-indigo-500 bg-[#13213a] w-full shadow-2xl rounded-3xl overflow-hidden">
                       <CardHeader className="bg-gradient-to-r from-indigo-900/40 to-[#1e2a4a] border-b border-indigo-500/30 p-6"><CardTitle className="text-indigo-400 text-2xl font-black flex items-center gap-2"><CalendarClock/> إعدادات التسجيل وموعد الإغلاق للنخبة</CardTitle></CardHeader>
                       <CardContent className="p-6 md:p-8">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                             <div><label className="text-indigo-300 font-bold mb-2 block">تاريخ إغلاق التسجيل</label><Input type="date" value={regDeadlineElite} onChange={e => setRegDeadlineElite(e.target.value)} className="bg-[#0a1428] border-indigo-500/50 text-white font-bold h-14" /></div>
                             <div><label className="text-indigo-300 font-bold mb-2 block">باسورد التسجيل الموحد للفرق</label><Input type="text" value={regPasswordElite} onChange={e => setRegPasswordElite(e.target.value)} className="bg-[#0a1428] border-indigo-500/50 text-white font-bold h-14" /></div>
                             <div><label className="text-yellow-400 font-bold mb-2 block">رسوم اشتراك النخبة (بالجنيه)</label><Input type="number" value={regPriceElite} onChange={e => setRegPriceElite(Number(e.target.value))} className="bg-[#0a1428] border-yellow-500/50 text-green-400 font-black h-14 text-lg" /></div>
                             <div className="md:col-span-3"><Button onClick={saveRegistrationSettingsElite} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black h-14 px-8 w-full shadow-lg">حفظ إعدادات التسجيل والاشتراك للنخبة 💾</Button></div>
                          </div>
                       </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                       <Card className="border-red-500/50 bg-[#13213a] rounded-3xl overflow-hidden shadow-2xl">
                          <CardHeader className="bg-[#1e2a4a] border-b border-red-500/20 p-6"><CardTitle className="text-red-400 text-xl font-black flex items-center gap-2"><Ban/> قائمة الحظر الشاملة (جميع البطولات)</CardTitle></CardHeader>
                          <CardContent className="p-6 space-y-6">
                             <div className="flex gap-2">
                                <select value={bannedForm.type} onChange={e => setBannedForm({...bannedForm, type: e.target.value})} className="bg-[#0a1428] border border-red-500/50 rounded-xl p-2 text-white font-bold outline-none w-32"><option value="player">لاعب</option><option value="team">فريق</option></select>
                                <Input value={bannedForm.name} onChange={e => setBannedForm({...bannedForm, name: e.target.value})} placeholder="اكتب الاسم..." className="flex-1 bg-[#0a1428] border-red-500/50 text-white font-bold" />
                                <Button onClick={addBannedEntity} className="bg-red-600 font-bold">حظر 🚫</Button>
                             </div>
                             <div className="max-h-64 overflow-y-auto custom-scrollbar border border-white/5 rounded-xl bg-[#0a1428] p-2">
                                {bannedList.map(b => (
                                   <div key={b.id} className="flex justify-between items-center bg-[#1e2a4a] p-2 rounded-lg mb-2">
                                      <div className="flex items-center gap-2"><Badge className={b.type === 'team' ? "bg-purple-600" : "bg-orange-600"}>{b.type === 'team' ? 'فريق' : 'لاعب'}</Badge><span className="font-bold text-white">{b.name}</span></div>
                                      <Button size="sm" variant="destructive" onClick={() => removeBannedEntity(b.id)}><Trash2 className="w-4 h-4"/></Button>
                                   </div>
                                ))}
                             </div>
                          </CardContent>
                       </Card>
                       <Card className="border-yellow-500/50 bg-[#13213a] rounded-3xl overflow-hidden shadow-2xl">
                          <CardHeader className="bg-[#1e2a4a] border-b border-yellow-500/20 p-6"><CardTitle className="text-yellow-400 text-xl font-black flex items-center gap-2"><AlertTriangle/> قائمة التقييد (قاعدة الـ 2 لجميع البطولات)</CardTitle></CardHeader>
                          <CardContent className="p-6 space-y-6">
                             <div className="flex gap-2">
                                <Input value={restrictedForm.name} onChange={e => setRestrictedForm({name: e.target.value})} placeholder="اسم اللاعب..." className="flex-1 bg-[#0a1428] border-yellow-500/50 text-white font-bold" />
                                <Button onClick={addRestrictedPlayer} className="bg-yellow-500 text-black font-black">تقييد ⚠️</Button>
                             </div>
                             <div className="max-h-64 overflow-y-auto custom-scrollbar border border-white/5 rounded-xl bg-[#0a1428] p-2">
                                {restrictedPlayers.map(r => (
                                   <div key={r.id} className="flex justify-between items-center bg-[#1e2a4a] p-2 rounded-lg mb-2">
                                      <div className="flex items-center gap-2"><UserX className="w-4 h-4 text-yellow-400"/><span className="font-bold text-white">{r.name}</span></div>
                                      <Button size="sm" variant="destructive" onClick={() => removeRestrictedPlayer(r.id)}><Trash2 className="w-4 h-4"/></Button>
                                   </div>
                                ))}
                             </div>
                          </CardContent>
                       </Card>
                    </div>
               </TabsContent>

               <TabsContent value="teams" className="space-y-6 w-full mt-6">
                 <Card className="border-indigo-500/50 bg-[#13213a] w-full rounded-3xl shadow-2xl">
                    <CardHeader className="bg-[#1e2a4a] border-b border-indigo-500/30 p-6"><CardTitle className="text-indigo-400 text-2xl font-black">إضافة فريق جديد لبطولة النخبة</CardTitle></CardHeader>
                    <CardContent className="p-6">
                       <div className="flex flex-col sm:flex-row gap-4">
                          <Input value={eliteTeamForm.name} onChange={e => setEliteTeamForm({...eliteTeamForm, name: e.target.value})} placeholder="اسم الفريق" className="bg-[#0a1428] border-indigo-500/50 text-white font-bold h-12" />
                          <Input value={eliteTeamForm.logoUrl} onChange={e => setEliteTeamForm({...eliteTeamForm, logoUrl: e.target.value})} placeholder="رابط الشعار (اختياري)" className="bg-[#0a1428] border-indigo-500/50 text-white font-bold h-12" dir="ltr" />
                          <Button onClick={addEliteTeam} className="bg-indigo-500 hover:bg-indigo-600 text-white font-black px-8 h-12">إضافة ➕</Button>
                       </div>
                    </CardContent>
                 </Card>
                 <Card className="border-indigo-500/30 bg-[#13213a] w-full rounded-3xl overflow-hidden shadow-xl">
                    <CardContent className="p-0">
                       <table className="w-full text-right text-white">
                         <thead className="bg-[#0a1428]"><tr><th className="p-4 text-indigo-300 border-b border-white/5">الفريق</th><th className="p-4 text-indigo-300 border-b border-white/5 text-center">إجراءات</th></tr></thead>
                         <tbody>
                           {eliteTeams.map(t => (
                              <tr key={t.id} className="border-b border-white/5 hover:bg-white/5">
                                 <td className="p-4 font-bold flex items-center gap-3">
                                   {t.logoUrl ? <img src={t.logoUrl} className="w-12 h-12 object-contain bg-[#0a1428] rounded-full p-1 border border-indigo-500/50" /> : <Shield className="w-10 h-10 text-gray-500" />}
                                   <span className="text-xl">{t.name}</span>
                                 </td>
                                 <td className="p-4 text-center"><Button variant="destructive" size="sm" onClick={() => deleteEliteTeam(t.id)}><Trash2 className="w-4 h-4"/></Button></td>
                              </tr>
                           ))}
                         </tbody>
                       </table>
                    </CardContent>
                 </Card>
               </TabsContent>
               {['matches', 'stats'].map(tab => (
                 <TabsContent key={tab} value={tab} className="w-full mt-6">
                   <div className="text-center py-20 bg-[#1e2a4a] border border-indigo-500/30 rounded-3xl shadow-xl max-w-3xl mx-auto">
                     <Activity className="w-20 h-20 mx-auto text-indigo-400 mb-6 animate-pulse" />
                     <h3 className="text-3xl font-black text-white mb-3">النظام قيد التطوير ⚙️</h3>
                     <p className="text-indigo-300 font-bold text-lg">سيتم تفعيل this النظام قريباً لتنظيم جدول المباريات والإحصائيات الخاصة بالنخبة.</p>
                   </div>
                 </TabsContent>
               ))}
             </Tabs>
          </div>
        )}

        {/* SHOP TAB */}
        {mainAppTab === 'shop' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <Card className="border-orange-500/50 bg-[#13213a] rounded-3xl overflow-hidden shadow-2xl">
              <CardHeader className="bg-[#1e2a4a] border-b border-orange-500/20 py-6"><CardTitle className="text-orange-400 text-2xl font-black">إدارة طلبات المتجر</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto w-full custom-scrollbar">
                  <table className="w-full text-right text-white min-w-[1000px]">
                    <thead className="bg-[#0a1428]">
                      <tr><th className="p-4 border-b border-white/10 text-cyan-300">الطلب</th><th className="p-4 border-b border-white/10 text-cyan-300">العميل</th><th className="p-4 border-b border-white/10 text-cyan-300">المنتجات</th><th className="p-4 border-b border-white/10 text-cyan-300">الإجمالي</th><th className="p-4 border-b border-white/10 text-cyan-300">طريقة الدفع</th><th className="p-4 border-b border-white/10 text-cyan-300">الإيصال</th><th className="p-4 border-b border-white/10 text-cyan-300">الحالة</th></tr>
                    </thead>
                    <tbody>
                      {ordersList.map(order => (
                        <tr key={order.id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="p-4"><Badge className="bg-gray-700">{order.id.slice(-6).toUpperCase()}</Badge><div className="text-xs text-gray-400 mt-2">{new Date(order.createdAt).toLocaleDateString()}</div></td>
                          <td className="p-4 font-bold">{order.customer?.name}<br/><span className="text-sm text-cyan-400" dir="ltr">{order.customer?.phone}</span></td>
                          <td className="p-4 text-sm">{order.items?.map((item:any, i:number)=><div key={i}>{item.title} (x{item.qty})</div>)}</td>
                          <td className="p-4 font-black text-yellow-400">{Number(order.total || 0).toLocaleString("ar-EG")} ج.م</td>
                          <td className="p-4"><Badge className="bg-[#1e2a4a] border border-white/10">{order.paymentMethod === "cash" ? "الدفع عند الاستلام" : order.paymentMethod}</Badge></td>
                          <td className="p-4">{order.customer?.receiptImage ? <a href={order.customer.receiptImage} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline font-bold">عرض الصورة</a> : "—"}</td>
                          <td className="p-4">
                            <select value={order.status} onChange={async (e) => await updateDoc(doc(db, "orders", order.id), { status: e.target.value })} className="bg-[#0a1428] border border-white/20 rounded-lg p-2 font-bold outline-none cursor-pointer">
                              <option value="طلب جديد">طلب جديد</option><option value="قيد التأكيد">قيد التأكيد</option><option value="قيد التجهيز">قيد التجهيز</option><option value="تم الشحن">تم الشحن</option><option value="تم التسليم">تم التسليم</option><option value="ملغي">ملغي</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* MATROUH CUP TAB */}
        {mainAppTab === 'matrouh_cup' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-center gap-4 mb-6">
              <div className="bg-[#1e2a4a] p-1.5 rounded-full border border-white/10 flex shadow-inner w-full sm:max-w-md">
                <button onClick={() => setCupEdition('edition_3')} className={`flex-1 py-2 rounded-full text-sm sm:text-base font-bold transition-all ${cupEdition === 'edition_3' ? 'bg-cyan-600 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>النسخة الثالثة</button>
                <button onClick={() => setCupEdition('edition_4')} className={`flex-1 py-2 rounded-full text-sm sm:text-base font-bold transition-all ${cupEdition === 'edition_4' ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>النسخة الرابعة</button>
              </div>
              <div className="bg-[#13213a] p-1.5 rounded-full border border-yellow-400/30 flex shadow-xl w-full sm:max-w-md">
                <button onClick={() => { setActiveTournament('youth'); setActiveTab(cupEdition === 'edition_3' ? 'champion' : 'registration_settings'); }} className={`flex-1 py-2 rounded-full text-sm sm:text-lg font-black transition-all ${activeTournament === 'youth' ? 'bg-yellow-400 text-black shadow-md' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>شباب</button>
                <button onClick={() => { setActiveTournament('juniors'); setActiveTab(cupEdition === 'edition_3' ? 'champion' : 'matches'); }} className={`flex-1 py-2 rounded-full text-sm sm:text-lg font-black transition-all ${activeTournament === 'juniors' ? 'bg-cyan-500 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>ناشئين</button>
              </div>
            </div>

            {cupEdition === 'edition_3' && (
              <div className="bg-gradient-to-r from-yellow-500/20 via-yellow-400/10 to-yellow-500/20 border border-yellow-500/50 text-yellow-300 text-center py-3 px-4 rounded-2xl mb-6 font-bold flex flex-col sm:flex-row items-center justify-center gap-3 shadow-lg">
                <Archive className="w-6 h-6 animate-pulse" />
                <span>هذه النسخة مؤرشفة (أرشيف البطولة) - جميع الإعدادات نهائية.</span>
              </div>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="bg-[#13213a] border border-yellow-400/30 h-auto flex flex-wrap justify-center p-2 rounded-3xl gap-2 w-full shadow-xl">
                {allAdminTabs.filter(tab => {
                   if (cupEdition === 'edition_3' && tab.hideForEd3) return false;
                   if (cupEdition === 'edition_4' && tab.hideForEd4) return false;
                   if (activeTournament === 'juniors' && tab.key === 'knockout') return false; 
                   return true;
                }).map(tab => (
                   <TabsTrigger key={tab.key} value={tab.key} className="data-[state=active]:bg-yellow-400 data-[state=active]:text-black text-gray-300 font-bold px-4 sm:px-6 py-2 sm:py-3 rounded-2xl text-sm sm:text-base w-full sm:w-auto">{tab.label}</TabsTrigger>
                ))}
              </TabsList>

              {activeTab === "champion" && cupEdition === 'edition_3' && (
                <TabsContent value="champion" className="space-y-6 w-full mt-6">
                   <Card className="border-yellow-400 bg-[#13213a] w-full rounded-3xl overflow-hidden shadow-2xl">
                     <CardHeader className="bg-[#1e2a4a] border-b border-yellow-400/30 p-6"><CardTitle className="text-yellow-300 text-2xl font-black">👑 البطل المتوج</CardTitle></CardHeader>
                     <CardContent className="p-6 md:p-8 text-center">
                        <p className="text-cyan-300 font-bold text-lg mb-6">يظهر للجمهور بصورة من مجلد public.</p>
                        <div className="w-48 h-48 mx-auto bg-[#0a1428] rounded-full border-4 border-yellow-400 flex items-center justify-center shadow-lg"><Trophy className="w-20 h-20 text-yellow-400" /></div>
                        <h2 className="text-5xl font-black text-white mt-6">{activeTournament === 'youth' ? 'وادي ماجد' : 'وادي الرمل'}</h2>
                        <Badge className="mt-4 bg-yellow-400 text-black px-6 py-2 font-black text-lg">بطل النسخة الثالثة</Badge>
                     </CardContent>
                   </Card>
                </TabsContent>
              )}

              {activeTab === "registration_settings" && cupEdition === 'edition_4' && (
                 <TabsContent value="registration_settings" className="space-y-6 w-full mt-6">
                    <Card className="border-red-500 bg-[#13213a] w-full shadow-2xl rounded-3xl overflow-hidden">
                       <CardHeader className="bg-gradient-to-r from-red-900/40 to-[#1e2a4a] border-b border-red-500/30 p-6"><CardTitle className="text-red-400 text-2xl font-black flex items-center gap-2"><CalendarClock/> إعدادات التسجيل والاشتراكات المالية (كأس مطروح)</CardTitle></CardHeader>
                       <CardContent className="p-6 md:p-8">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                             <div><label className="text-yellow-300 font-bold mb-2 block">تاريخ إغلاق التسجيل</label><Input type="date" value={regDeadlineMatrouh} onChange={e => setRegDeadlineMatrouh(e.target.value)} className="bg-[#0a1428] border-red-500/50 text-white font-bold h-14" /></div>
                             <div><label className="text-yellow-300 font-bold mb-2 block">باسورد التسجيل الموحد للفرق</label><Input type="text" value={regPasswordMatrouh} onChange={e => setRegPasswordMatrouh(e.target.value)} placeholder="مثال: Matrouh2026" className="bg-[#0a1428] border-red-500/50 text-white font-bold h-14" /></div>
                             <div><label className="text-yellow-300 font-bold mb-2 block">رسوم الاشتراك الحالية (بالجنيه المصري)</label><Input type="number" value={regPriceMatrouh} onChange={e => setRegPriceMatrouh(Number(e.target.value))} className="bg-[#0a1428] border-red-500/50 text-green-400 font-black h-14 text-lg" /></div>
                             <div className="md:col-span-3"><Button onClick={saveRegistrationSettingsMatrouh} className="bg-red-600 hover:bg-red-700 text-white font-black h-14 px-8 w-full shadow-lg">حفظ إعدادات التسجيل والاشتراك المالي 💾</Button></div>
                          </div>
                       </CardContent>
                    </Card>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                       <Card className="border-red-500/50 bg-[#13213a] rounded-3xl overflow-hidden shadow-2xl">
                          <CardHeader className="bg-[#1e2a4a] border-b border-red-500/20 p-6"><CardTitle className="text-red-400 text-xl font-black flex items-center gap-2"><Ban/> قائمة الحظر الشاملة (جميع البطولات)</CardTitle></CardHeader>
                          <CardContent className="p-6 space-y-6">
                             <div className="flex gap-2">
                                <select value={bannedForm.type} onChange={e => setBannedForm({...bannedForm, type: e.target.value})} className="bg-[#0a1428] border border-red-500/50 rounded-xl p-2 text-white font-bold outline-none w-32"><option value="player">لاعب</option><option value="team">فريق</option></select>
                                <Input value={bannedForm.name} onChange={e => setBannedForm({...bannedForm, name: e.target.value})} placeholder="اكتب الاسم..." className="flex-1 bg-[#0a1428] border-red-500/50 text-white font-bold" />
                                <Button onClick={addBannedEntity} className="bg-red-600 font-bold">حظر 🚫</Button>
                             </div>
                             <div className="max-h-64 overflow-y-auto custom-scrollbar border border-white/5 rounded-xl bg-[#0a1428] p-2">
                                {bannedList.map(b => (
                                   <div key={b.id} className="flex justify-between items-center bg-[#1e2a4a] p-2 rounded-lg mb-2">
                                      <div className="flex items-center gap-2"><Badge className={b.type === 'team' ? "bg-purple-600" : "bg-orange-600"}>{b.type === 'team' ? 'فريق' : 'لاعب'}</Badge><span className="font-bold text-white">{b.name}</span></div>
                                      <Button size="sm" variant="destructive" onClick={() => removeBannedEntity(b.id)}><Trash2 className="w-4 h-4"/></Button>
                                   </div>
                                ))}
                             </div>
                          </CardContent>
                       </Card>
                       <Card className="border-yellow-500/50 bg-[#13213a] rounded-3xl overflow-hidden shadow-2xl">
                          <CardHeader className="bg-[#1e2a4a] border-b border-yellow-500/20 p-6"><CardTitle className="text-yellow-400 text-xl font-black flex items-center gap-2"><AlertTriangle/> قائمة التقييد (قاعدة الـ 2 لجميع البطولات)</CardTitle></CardHeader>
                          <CardContent className="p-6 space-y-6">
                             <div className="flex gap-2">
                                <Input value={restrictedForm.name} onChange={e => setRestrictedForm({name: e.target.value})} placeholder="اسم اللاعب..." className="flex-1 bg-[#0a1428] border-yellow-500/50 text-white font-bold" />
                                <Button onClick={addRestrictedPlayer} className="bg-yellow-500 text-black font-black">تقييد ⚠️</Button>
                             </div>
                             <div className="max-h-64 overflow-y-auto custom-scrollbar border border-white/5 rounded-xl bg-[#0a1428] p-2">
                                {restrictedPlayers.map(r => (
                                   <div key={r.id} className="flex justify-between items-center bg-[#1e2a4a] p-2 rounded-lg mb-2">
                                      <div className="flex items-center gap-2"><UserX className="w-4 h-4 text-yellow-400"/><span className="font-bold text-white">{r.name}</span></div>
                                      <Button size="sm" variant="destructive" onClick={() => removeRestrictedPlayer(r.id)}><Trash2 className="w-4 h-4"/></Button>
                                   </div>
                                ))}
                             </div>
                          </CardContent>
                       </Card>
                    </div>
                 </TabsContent>
              )}

              <TabsContent value="knockout" className="space-y-6 w-full mt-6">
                  <Card className="border-cyan-500 bg-[#13213a] w-full shadow-2xl rounded-3xl overflow-hidden">
                    <CardHeader className="bg-[#1e2a4a] border-b border-cyan-500/30 p-6"><CardTitle className="text-cyan-400 text-2xl font-black flex items-center gap-2"><Trophy/> إدارة مباريات الإقصائيات</CardTitle></CardHeader>
                    <CardContent className="p-6 md:p-8 space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                         <div>
                            <label className="text-cyan-300 font-bold mb-2 block">الدور</label>
                            <select value={bracketForm.round} onChange={e => { setBracketForm(p => ({...p, round: e.target.value, matchLabel: getLabelSuggestions(e.target.value)[0] || ""})); setMatchForm(p => ({...p, round: e.target.value})); }} className="bg-[#0a1428] border border-cyan-500/50 w-full rounded-xl p-4 text-white font-bold outline-none h-14">
                               <option value="الملحق">الملحق</option><option value="دور الستة عشر">دور الستة عشر</option><option value="دور الثمانية">دور الثمانية</option><option value="نصف النهائي">نصف النهائي</option><option value="النهائي">النهائي</option>
                            </select>
                         </div>
                         <div>
                            <label className="text-cyan-300 font-bold mb-2 block">رقم المباراة</label>
                            <select value={bracketForm.matchLabel} onChange={e => { setBracketForm(p => ({...p, matchLabel: e.target.value})); setMatchForm(p => ({...p, matchLabel: e.target.value})); }} className="bg-[#0a1428] border border-cyan-500/50 w-full rounded-xl p-4 text-white font-bold outline-none h-14">
                               {getLabelSuggestions(bracketForm.round).map(l => <option key={l} value={l}>{l}</option>)}
                            </select>
                         </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 bg-[#0a1428] p-6 rounded-2xl border border-white/5">
                         <div><label className="text-yellow-300 font-bold mb-2 block">الفريق الأول</label><Input list="teams-list" value={bracketForm.teamA} onChange={e => { setBracketForm(p => ({...p, teamA: e.target.value})); setMatchForm(p => ({...p, teamA: e.target.value})); }} className="bg-[#1e2a4a] border-yellow-400 text-white font-bold h-14" /></div>
                         <div><label className="text-yellow-300 font-bold mb-2 block">الفريق الثاني</label><Input list="teams-list" value={bracketForm.teamB} onChange={e => { setBracketForm(p => ({...p, teamB: e.target.value})); setMatchForm(p => ({...p, teamB: e.target.value})); }} className="bg-[#1e2a4a] border-yellow-400 text-white font-bold h-14" /></div>
                         <div><label className="text-cyan-300 font-bold mb-2 block">التاريخ</label><Input type="date" value={bracketForm.date} onChange={e => { setBracketForm(p => ({...p, date: e.target.value})); setMatchForm(p => ({...p, date: e.target.value})); }} className="bg-[#1e2a4a] border-cyan-500/50 text-white font-bold h-14 text-right" /></div>
                         <div><label className="text-cyan-300 font-bold mb-2 block">الوقت</label><Input type="time" value={bracketForm.time} onChange={e => { setBracketForm(p => ({...p, time: e.target.value})); setMatchForm(p => ({...p, time: e.target.value})); }} className="bg-[#1e2a4a] border-cyan-500/50 text-white font-bold h-14 text-center" /></div>
                      </div>
                      <Button onClick={saveBracketMatch} className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-black py-6 text-xl shadow-lg">إنشاء / تحديث مباراة الإقصائيات ⚡</Button>
                    </CardContent>
                  </Card>
              </TabsContent>

              <TabsContent value="matches" className="space-y-8 w-full mt-6">
                <Card className="border-yellow-400 bg-[#13213a] w-full rounded-3xl overflow-hidden shadow-2xl">
                  <CardHeader className="bg-[#1e2a4a] border-b border-yellow-400/30 p-6"><CardTitle className="text-yellow-300 text-2xl font-black">{editingId ? "تعديل بيانات المباراة" : "إنشاء مباراة جديدة"}</CardTitle></CardHeader>
                  <CardContent className="p-6 md:p-8 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 bg-[#0a1428] p-6 rounded-2xl border border-white/5">
                      <div><label className="text-yellow-300 font-bold mb-2 block">الفريق الأول</label><Input list="teams-list" value={matchForm.teamA} onChange={e => setMatchForm({...matchForm, teamA: e.target.value})} className="bg-[#1e2a4a] border-yellow-400 text-white font-bold h-14" /></div>
                      <div><label className="text-yellow-300 font-bold mb-2 block">شعار 1 (رابط)</label><Input value={matchForm.teamALogo} onChange={e => setMatchForm({...matchForm, teamALogo: e.target.value})} className="bg-[#1e2a4a] border-white/10 text-white h-14" dir="ltr" /></div>
                      <div><label className="text-yellow-300 font-bold mb-2 block">الفريق الثاني</label><Input list="teams-list" value={matchForm.teamB} onChange={e => setMatchForm({...matchForm, teamB: e.target.value})} className="bg-[#1e2a4a] border-yellow-400 text-white font-bold h-14" /></div>
                      <div><label className="text-yellow-300 font-bold mb-2 block">شعار 2 (رابط)</label><Input value={matchForm.teamBLogo} onChange={e => setMatchForm({...matchForm, teamBLogo: e.target.value})} className="bg-[#1e2a4a] border-white/10 text-white h-14" dir="ltr" /></div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                      <div><label className="text-cyan-300 font-bold mb-2 block">التاريخ</label><Input type="date" value={matchForm.date} onChange={e => setMatchForm({...matchForm, date: e.target.value})} className="bg-[#0a1428] border-cyan-500/50 text-white font-bold h-14 text-right" /></div>
                      <div><label className="text-cyan-300 font-bold mb-2 block">الوقت</label><Input type="time" value={matchForm.time} onChange={e => setMatchForm({...matchForm, time: e.target.value})} className="bg-[#0a1428] border-cyan-500/50 text-white font-bold h-14 text-center" /></div>
                      <div>
                        <label className="text-cyan-300 font-bold mb-2 block">الجولة / الدور</label>
                        {activeTournament === 'youth' ? (
                          <Input value={matchForm.round} onChange={e => setMatchForm({...matchForm, round: e.target.value})} className="bg-[#0a1428] border-cyan-500/50 text-white font-bold h-14" />
                        ) : (
                          <select value={matchForm.round} onChange={e => setMatchForm({...matchForm, round: e.target.value})} className="bg-[#0a1428] border border-cyan-500/50 w-full rounded-xl p-4 text-white font-bold outline-none h-14">
                            <option value="الجولة الأولى">الجولة الأولى</option><option value="الجولة الثانية">الجولة الثانية</option><option value="الجولة الثالثة">الجولة الثالثة</option><option value="دور الثمانية">دور الثمانية</option><option value="نصف النهائي">نصف النهائي</option><option value="النهائي">النهائي</option>
                          </select>
                        )}
                      </div>
                      <div>
                        <label className="text-cyan-300 font-bold mb-2 block">الحالة</label>
                        <select value={matchForm.status} onChange={e => setMatchForm({...matchForm, status: e.target.value})} className="bg-[#0a1428] border border-cyan-500/50 w-full rounded-xl p-4 text-white font-bold outline-none h-14">
                          <option value="لم تبدأ">لم تبدأ</option><option value="مباشر">مباشر</option><option value="انتهت">انتهت</option><option value="تأجلت">تأجلت</option><option value="ملغاة">ملغاة</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-4 pt-4">
                      <Button onClick={saveMatch} className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-black font-black text-xl py-6">{editingId ? "تأكيد التعديل ✔️" : "حفظ المباراة 💾"}</Button>
                      {editingId && <Button onClick={() => setEditingId(null)} variant="outline" className="flex-1 bg-transparent border-red-500 text-red-500 hover:bg-red-500 hover:text-white font-bold py-6 text-lg">إلغاء التعديل ❌</Button>}
                    </div>
                  </CardContent>
                </Card>

                <div className="mb-6 bg-[#0a1428] p-4 rounded-3xl border border-white/5">
                   <div className="relative max-w-md mx-auto mb-6"><Search className="absolute right-4 top-4 h-5 w-5 text-cyan-300" /><Input value={koSearchTerm} onChange={e => setKoSearchTerm(e.target.value)} placeholder="بحث في المباريات..." className="pr-12 bg-[#1e2a4a] border-cyan-500/50 text-white h-14 rounded-2xl font-bold" /></div>
                   <div className="grid gap-6 w-full">
                     {matches.filter(m => !koSearchTerm || m.teamA.includes(koSearchTerm) || m.teamB.includes(koSearchTerm)).map((match) => (
                       <Card key={match.id} className={`w-full overflow-hidden rounded-3xl transition-all border-2 ${match.isLive ? 'border-red-500 bg-gradient-to-r from-red-900/20 to-[#1e2a4a] shadow-lg' : match.status === 'انتهت' ? 'border-white/10 bg-[#13213a] opacity-80' : 'border-cyan-500/30 bg-[#1e2a4a]'}`}>
                         <div className={`text-center py-2 text-xs font-black tracking-wider ${match.isLive ? 'bg-red-600 text-white' : 'bg-[#0a1428] text-gray-400'}`}>{getArabicDay(match.date)} • {match.date} • {match.time} • {match.round} {match.matchLabel ? `(${match.matchLabel})` : ""}</div>
                         <CardContent className="p-4 sm:p-6 w-full flex flex-col xl:flex-row gap-6">
                            <div className="xl:w-1/3 flex flex-col bg-[#0a1428] p-4 rounded-2xl border border-white/5">
                               <div className="flex justify-between items-center w-full mb-4 px-2">
                                  <div className="text-center w-1/3"><div className="text-sm text-cyan-300 font-bold mb-1">الطرف الأول</div><div className="font-black text-white text-lg">{match.teamA}</div></div>
                                  <div className="bg-[#1e2a4a] border border-yellow-400/30 rounded-xl px-4 py-2 font-black text-2xl text-yellow-400 shadow-inner">{match.homeGoals || 0} - {match.awayGoals || 0}</div>
                                  <div className="text-center w-1/3"><div className="text-sm text-cyan-300 font-bold mb-1">الطرف الثاني</div><div className="font-black text-white text-lg">{match.teamB}</div></div>
                               </div>
                               <div className="flex flex-wrap justify-center gap-2 mt-auto">
                                  <Button size="sm" onClick={() => startEdit(match)} className="bg-blue-600 text-white font-bold"><Edit className="h-4 w-4 mr-1"/>تعديل</Button>
                                  <Button size="sm" onClick={() => updateMatchLive(match.id, { isLive: !match.isLive })} className={match.isLive ? "bg-red-600 text-white font-bold animate-pulse" : "bg-[#1e2a4a] text-red-400 border border-red-500/50 hover:bg-red-500 hover:text-white font-bold"}>{match.isLive ? "🔴 إيقاف اللايف" : "تشغيل اللايف"}</Button>
                                  <Button size="sm" onClick={() => updateMatchLive(match.id, { status: "انتهت", isLive: false, streamClosed: true, isTimerRunning: false })} className="bg-emerald-600 text-white font-bold">إنهاء المباراة</Button>
                                  <Button size="sm" onClick={() => openPoster(match)} className="bg-purple-600 text-white font-bold"><Camera className="h-4 w-4 mr-1"/>بوستر</Button>
                                  <Button size="sm" onClick={() => openMotmPopup(match)} className="bg-yellow-500 text-black font-black"><Star className="h-4 w-4 mr-1"/>نجم</Button>
                                  <Button size="sm" onClick={() => deleteMatch(match.id)} variant="destructive" className="font-bold"><Trash2 className="h-4 w-4"/></Button>
                               </div>
                            </div>
                            
                            <div className="xl:w-2/3 grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                               <div className="space-y-4 bg-[#13213a] p-4 rounded-2xl border border-white/5">
                                 <h4 className="text-yellow-300 font-black flex items-center gap-2"><Activity className="h-5 w-5"/> الأهداف والحالة</h4>
                                 <div className="grid grid-cols-2 gap-4">
                                   <div className="bg-[#0a1428] p-3 rounded-xl border border-white/5 text-center">
                                     <div className="text-cyan-300 text-xs font-bold mb-2 truncate">{match.teamA}</div>
                                     <div className="flex items-center justify-center gap-3">
                                       <button onClick={() => updateMatchLive(match.id, { homeGoals: Math.max(0, (match.homeGoals || 0) - 1) })} className="w-8 h-8 rounded-full bg-red-500/20 text-red-400 font-black">-</button>
                                       <span className="text-2xl font-black text-white w-6">{match.homeGoals || 0}</span>
                                       <button onClick={() => updateMatchLive(match.id, { homeGoals: (match.homeGoals || 0) + 1 })} className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 font-black">+</button>
                                     </div>
                                   </div>
                                   <div className="bg-[#0a1428] p-3 rounded-xl border border-white/5 text-center">
                                     <div className="text-cyan-300 text-xs font-bold mb-2 truncate">{match.teamB}</div>
                                     <div className="flex items-center justify-center gap-3">
                                       <button onClick={() => updateMatchLive(match.id, { awayGoals: Math.max(0, (match.awayGoals || 0) - 1) })} className="w-8 h-8 rounded-full bg-red-500/20 text-red-400 font-black">-</button>
                                       <span className="text-2xl font-black text-white w-6">{match.awayGoals || 0}</span>
                                       <button onClick={() => updateMatchLive(match.id, { awayGoals: (match.awayGoals || 0) + 1 })} className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 font-black">+</button>
                                     </div>
                                   </div>
                                 </div>
                                 <div className="flex gap-2">
                                   <select value={match.status} onChange={e => updateMatchLive(match.id, { status: e.target.value })} className="flex-1 bg-[#0a1428] border border-cyan-500/30 rounded-xl p-2.5 text-white font-bold outline-none text-sm">
                                     <option value="لم تبدأ">لم تبدأ</option><option value="ستبدأ بعد قليل">ستبدأ بعد قليل</option><option value="الشوط الأول">الشوط الأول</option><option value="استراحة">استراحة</option><option value="الشوط الثاني">الشوط الثاني</option><option value="ضربات جزاء">ضربات جزاء</option><option value="انتهت">انتهت</option>
                                   </select>
                                 </div>
                               </div>
                               
                               <div className="space-y-4 bg-[#13213a] p-4 rounded-2xl border border-white/5 flex flex-col">
                                 <h4 className="text-cyan-300 font-black flex items-center justify-between"><span className="flex items-center gap-2"><Clock className="h-5 w-5"/> العداد والتايم لاين</span><Badge className="bg-red-600 text-white font-black px-3" dir="ltr">{getAccurateLiveMinute(match)}'</Badge></h4>
                                 <div className="flex gap-2">
                                   <Input type="number" value={match.liveMinute || 0} onChange={e => updateMatchLive(match.id, { liveMinute: parseInt(e.target.value) || 0, liveMinuteBase: parseInt(e.target.value) || 0, timerStartedAt: match.isTimerRunning ? Date.now() : null })} className="bg-[#0a1428] border-white/10 text-white font-black text-center w-20" />
                                   <Button onClick={() => updateMatchLive(match.id, { isTimerRunning: !match.isTimerRunning })} className={`flex-1 font-bold ${match.isTimerRunning ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'}`}>{match.isTimerRunning ? <><Pause className="h-4 w-4 mr-1"/> إيقاف</> : <><Play className="h-4 w-4 mr-1"/> تشغيل</>}</Button>
                                 </div>
                               </div>
                            </div>
                         </CardContent>
                       </Card>
                     ))}
                   </div>
                </div>
              </TabsContent>

              <TabsContent value="rosters" className="space-y-6 w-full mt-6">
                <Card className="border-blue-500 bg-[#13213a] w-full rounded-3xl overflow-hidden shadow-2xl">
                  <CardHeader className="bg-[#1e2a4a] border-b border-blue-500/30 p-6"><CardTitle className="text-blue-400 text-2xl font-black">إدارة قوائم الفرق</CardTitle></CardHeader>
                  <CardContent className="p-6 md:p-8">
                     <div className="overflow-x-auto w-full custom-scrollbar">
                       <table className="w-full text-right text-white min-w-[1000px]">
                         <thead className="bg-[#0a1428]">
                           <tr><th className="p-4 border-b border-white/10 text-cyan-300">الفريق</th><th className="p-4 border-b border-white/10 text-cyan-300">الرقم السري</th><th className="p-4 border-b border-white/10 text-cyan-300">المسئول</th><th className="p-4 border-b border-white/10 text-cyan-300">الحالة</th><th className="p-4 border-b border-white/10 text-cyan-300">اللاعبين المسجلين</th><th className="p-4 border-b border-white/10 text-cyan-300">إجراءات</th></tr>
                         </thead>
                         <tbody>
                           {currentTeamsList.map(teamName => {
                             const r = rostersList.find(x => x.id === teamName) || { password: "", isSubmitted: false, managerName: "", managerPhone: "", players: [] };
                             const registeredCount = (r.players || []).filter((p:any)=>p.name.trim() !== "").length;
                             return (
                               <tr key={teamName} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                 <td className="p-4 font-black text-lg">{teamName}</td>
                                 <td className="p-4"><Input type="text" value={r.password} onChange={e => setDoc(doc(db, getColl("team_rosters"), teamName), { password: e.target.value }, { merge: true })} className="w-32 bg-[#1e2a4a] border-white/10 text-yellow-400 font-bold h-10 text-center" /></td>
                                 <td className="p-4 text-sm font-bold text-cyan-300">{r.managerName || "—"}<br/><span dir="ltr" className="text-gray-400">{r.managerPhone || ""}</span></td>
                                 <td className="p-4">{r.isSubmitted ? <Badge className="bg-emerald-500 text-white font-bold"><Lock className="w-3 h-3 mr-1"/> مقفولة</Badge> : <Badge className="bg-gray-600 text-white font-bold"><Unlock className="w-3 h-3 mr-1"/> مفتوحة</Badge>}</td>
                                 <td className="p-4 font-black text-lg text-center">{registeredCount} / 12</td>
                                 <td className="p-4"><div className="flex gap-2"><Button size="sm" onClick={() => startEditRoster(teamName)} className="bg-blue-600 text-white"><Edit className="w-4 h-4"/></Button>{r.isSubmitted ? <Button size="sm" onClick={() => unlockRoster(teamName)} className="bg-yellow-600 text-white"><Unlock className="w-4 h-4"/></Button> : <Button size="sm" onClick={() => lockRoster(teamName)} className="bg-emerald-600 text-white"><Lock className="w-4 h-4"/></Button>}<Button size="sm" onClick={() => deleteRoster(teamName)} variant="destructive"><Trash2 className="w-4 h-4"/></Button></div></td>
                               </tr>
                             );
                           })}
                         </tbody>
                       </table>
                     </div>

                     {editingRosterId && (
                        <div className="mt-8 bg-[#0a1428] border-2 border-blue-500/50 p-6 rounded-3xl relative">
                           <Button onClick={() => setEditingRosterId(null)} className="absolute top-4 left-4 bg-red-500 hover:bg-red-600 px-3 py-1 text-sm h-auto font-bold">إغلاق X</Button>
                           <h3 className="text-2xl font-black text-blue-400 mb-6 border-b border-white/10 pb-4">تعديل قائمة: {editingRosterId}</h3>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                              <div><label className="block text-cyan-300 font-bold mb-2">اسم المسئول</label><Input value={rosterFormAdmin.managerName} onChange={e => setRosterFormAdmin(p=>({...p, managerName:e.target.value}))} className="bg-[#1e2a4a] border-white/10 text-white font-bold" /></div>
                              <div><label className="block text-cyan-300 font-bold mb-2">رقم الهاتف</label><Input value={rosterFormAdmin.managerPhone} onChange={e => setRosterFormAdmin(p=>({...p, managerPhone:e.target.value}))} className="bg-[#1e2a4a] border-white/10 text-white font-bold" dir="ltr" /></div>
                              <div><label className="block text-cyan-300 font-bold mb-2">رابط لوجو الفريق</label><Input value={rosterFormAdmin.logoUrl} onChange={e => setRosterFormAdmin(p=>({...p, logoUrl:e.target.value}))} className="bg-[#1e2a4a] border-white/10 text-white font-bold" dir="ltr" /></div>
                              <div className="flex items-center gap-4 mt-8"><label className="text-yellow-300 font-bold">حالة القائمة:</label><div className="flex gap-2"><Button onClick={() => setRosterFormAdmin(p=>({...p, isSubmitted:true}))} className={rosterFormAdmin.isSubmitted ? "bg-emerald-600 font-bold" : "bg-[#1e2a4a] text-gray-400"}>معتمدة</Button><Button onClick={() => setRosterFormAdmin(p=>({...p, isSubmitted:false}))} className={!rosterFormAdmin.isSubmitted ? "bg-yellow-600 font-bold" : "bg-[#1e2a4a] text-gray-400"}>مفتوحة</Button></div></div>
                           </div>
                           <h4 className="text-xl font-black text-yellow-300 mb-4">اللاعبين</h4>
                           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                              {rosterFormAdmin.players.map((p, i) => (
                                 <div key={i} className="flex gap-2 bg-[#1e2a4a] p-2 rounded-xl border border-white/5">
                                    <span className="text-gray-500 font-black w-6 pt-2">{i+1}.</span>
                                    <Input placeholder="اسم اللاعب" value={p.name} onChange={e => updateAdminRosterPlayer(i, 'name', e.target.value)} className="flex-1 bg-[#0a1428] border-white/5 text-white font-bold h-10" />
                                    <Input placeholder="رقم" type="number" value={p.number} onChange={e => updateAdminRosterPlayer(i, 'number', e.target.value)} className="w-16 bg-[#0a1428] border-white/5 text-yellow-400 font-black h-10 text-center" />
                                 </div>
                              ))}
                           </div>
                           <Button onClick={saveRosterAdmin} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-6 text-xl shadow-lg">حفظ القائمة 💾</Button>
                        </div>
                     )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="goals" className="space-y-6 w-full mt-6">
                <Card className="border-yellow-400 bg-[#13213a] w-full rounded-3xl overflow-hidden shadow-2xl">
                  <CardHeader className="bg-[#1e2a4a] border-b border-yellow-400/30 p-6"><CardTitle className="text-yellow-300 text-2xl font-black">{editingGoalId ? "تعديل هداف" : "إضافة هداف"}</CardTitle></CardHeader>
                  <CardContent className="p-6 md:p-8 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                      <div className="sm:col-span-1"><label className="text-cyan-300 font-bold mb-2 block">الفريق</label><Input list="teams-list" value={goalForm.team} onChange={e => setGoalForm({...goalForm, team: e.target.value})} className="bg-[#0a1428] border-cyan-500/50 text-white font-bold h-12" /></div>
                      <div className="sm:col-span-2"><label className="text-cyan-300 font-bold mb-2 block">اسم اللاعب</label><Input value={goalForm.player} onChange={e => setGoalForm({...goalForm, player: e.target.value})} className="bg-[#0a1428] border-cyan-500/50 text-white font-bold h-12" /></div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3">
                      <div><label className="text-yellow-300 font-bold mb-1 block text-sm">الأهداف</label><Input type="number" value={goalForm.goalsCount} onChange={e => setGoalForm({...goalForm, goalsCount: Number(e.target.value)})} className="bg-[#0a1428] border-yellow-400 text-white font-black h-12 text-center" /></div>
                      <div><label className="text-cyan-300 font-bold mb-1 block text-sm">RATING</label><Input type="number" value={goalForm.rating} onChange={e => setGoalForm({...goalForm, rating: Number(e.target.value)})} className="bg-[#0a1428] border-cyan-500/50 text-white font-bold h-12 text-center" /></div>
                      <div><label className="text-cyan-300 font-bold mb-1 block text-sm">PAC</label><Input type="number" value={goalForm.pac} onChange={e => setGoalForm({...goalForm, pac: Number(e.target.value)})} className="bg-[#0a1428] border-cyan-500/50 text-white font-bold h-12 text-center" /></div>
                      <div><label className="text-cyan-300 font-bold mb-1 block text-sm">SHO</label><Input type="number" value={goalForm.sho} onChange={e => setGoalForm({...goalForm, sho: Number(e.target.value)})} className="bg-[#0a1428] border-cyan-500/50 text-white font-bold h-12 text-center" /></div>
                      <div><label className="text-cyan-300 font-bold mb-1 block text-sm">PAS</label><Input type="number" value={goalForm.pas} onChange={e => setGoalForm({...goalForm, pas: Number(e.target.value)})} className="bg-[#0a1428] border-cyan-500/50 text-white font-bold h-12 text-center" /></div>
                      <div><label className="text-cyan-300 font-bold mb-1 block text-sm">DRI</label><Input type="number" value={goalForm.dri} onChange={e => setGoalForm({...goalForm, dri: Number(e.target.value)})} className="bg-[#0a1428] border-cyan-500/50 text-white font-bold h-12 text-center" /></div>
                      <div><label className="text-cyan-300 font-bold mb-1 block text-sm">DEF</label><Input type="number" value={goalForm.def} onChange={e => setGoalForm({...goalForm, def: Number(e.target.value)})} className="bg-[#0a1428] border-cyan-500/50 text-white font-bold h-12 text-center" /></div>
                      <div><label className="text-cyan-300 font-bold mb-1 block text-sm">PHY</label><Input type="number" value={goalForm.phy} onChange={e => setGoalForm({...goalForm, phy: Number(e.target.value)})} className="bg-[#0a1428] border-cyan-500/50 text-white font-bold h-12 text-center" /></div>
                    </div>
                    <div><label className="text-cyan-300 font-bold mb-2 block">رابط الصورة</label><Input value={goalForm.imageUrl} onChange={e => setGoalForm({...goalForm, imageUrl: e.target.value})} className="bg-[#0a1428] border-cyan-500/50 text-white h-12" dir="ltr" /></div>
                    <div className="flex gap-4"><Button onClick={addOrUpdateGoal} className="flex-1 bg-yellow-400 text-black font-black py-6 text-xl">{editingGoalId ? "تأكيد التعديل" : "إضافة الهداف"}</Button></div>
                  </CardContent>
                </Card>
                <Card className="border-cyan-500/30 bg-[#13213a] w-full rounded-3xl overflow-hidden">
                  <CardHeader className="flex flex-col sm:flex-row justify-between items-center gap-4 p-6 border-b border-white/10"><CardTitle className="text-yellow-300 font-black">سجل الهدافين</CardTitle><div className="relative w-full sm:w-64"><Search className="absolute right-3 top-3 h-4 w-4 text-cyan-300" /><Input value={goalSearchTerm} onChange={e => setGoalSearchTerm(e.target.value)} placeholder="بحث..." className="pr-10 bg-[#1e2a4a] border-cyan-500/30 text-white" /></div></CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto w-full custom-scrollbar"><table className="w-full text-right text-white"><thead className="bg-[#0a1428]"><tr><th className="p-4 text-cyan-300 border-b border-white/5">اللاعب</th><th className="p-4 text-cyan-300 border-b border-white/5">الفريق</th><th className="p-4 text-cyan-300 border-b border-white/5 text-center">الأهداف</th><th className="p-4 text-cyan-300 border-b border-white/5 text-center">إجراءات</th></tr></thead><tbody>{filteredGoals.sort((a,b) => b.goals - a.goals).map(g => (<tr key={g.id} className="border-b border-white/5 hover:bg-[#1e2a4a]"><td className="p-4 font-bold">{g.player}</td><td className="p-4 text-sm text-gray-300">{g.team}</td><td className="p-4 text-center font-black text-yellow-400 text-lg">{g.goals}</td><td className="p-4 text-center"><Button size="sm" onClick={() => startEditGoal(g)} className="bg-blue-600 text-white ml-2"><Edit className="w-4 h-4"/></Button><Button size="sm" variant="destructive" onClick={() => deleteGoal(g.id)}><Trash2 className="w-4 h-4"/></Button></td></tr>))}</tbody></table></div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="cards" className="space-y-6 w-full mt-6">
                <Card className="border-yellow-400 bg-[#13213a] w-full rounded-3xl overflow-hidden shadow-2xl">
                  <CardHeader className="bg-[#1e2a4a] border-b border-yellow-400/30 p-6 flex flex-col sm:flex-row justify-between items-center gap-4"><CardTitle className="text-yellow-300 text-2xl font-black">إدارة الكروت</CardTitle><Button onClick={archiveAndResetCards} variant="destructive" className="font-black border-2 border-red-700 shadow-lg">تصفير وأرشفة الكروت</Button></CardHeader>
                  <CardContent className="p-6 md:p-8 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 bg-[#0a1428] p-6 rounded-2xl border border-white/5">
                      <div className="sm:col-span-1"><label className="text-cyan-300 font-bold mb-2 block">الفريق</label><Input list="teams-list" value={cardForm.team} onChange={e => setCardForm({...cardForm, team: e.target.value})} className="bg-[#1e2a4a] border-cyan-500/50 text-white font-bold h-12" /></div>
                      <div className="sm:col-span-1"><label className="text-cyan-300 font-bold mb-2 block">اسم اللاعب</label><Input value={cardForm.player} onChange={e => setCardForm({...cardForm, player: e.target.value})} className="bg-[#1e2a4a] border-cyan-500/50 text-white font-bold h-12" /></div>
                      <div className="sm:col-span-1"><label className="text-cyan-300 font-bold mb-2 block">نوع الكارت</label><select value={cardForm.type} onChange={e => setCardForm({...cardForm, type: e.target.value as "yellow" | "red"})} className="bg-[#1e2a4a] border border-cyan-500/50 w-full rounded-lg p-3 text-white font-bold outline-none h-12"><option value="yellow">🟨 إنذار أصفر</option><option value="red">🟥 كارت أحمر</option></select></div>
                    </div>
                    <Button onClick={addCard} className="w-full bg-yellow-400 text-black font-black py-6 text-xl">إضافة الكارت ✔️</Button>
                  </CardContent>
                </Card>
                <Card className="border-cyan-500/30 bg-[#13213a] w-full rounded-3xl overflow-hidden">
                  <CardHeader className="flex flex-col sm:flex-row justify-between items-center gap-4 p-6 border-b border-white/10"><CardTitle className="text-yellow-300 font-black">سجل الكروت</CardTitle><div className="relative w-full sm:w-64"><Search className="absolute right-3 top-3 h-4 w-4 text-cyan-300" /><Input value={cardSearchTerm} onChange={e => setCardSearchTerm(e.target.value)} placeholder="بحث..." className="pr-10 bg-[#1e2a4a] border-cyan-500/30 text-white" /></div></CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto w-full custom-scrollbar"><table className="w-full text-right text-white"><thead className="bg-[#0a1428]"><tr><th className="p-4 text-cyan-300 border-b border-white/5">اللاعب</th><th className="p-4 text-cyan-300 border-b border-white/5">الفريق</th><th className="p-4 text-cyan-300 border-b border-white/5 text-center">الكروت</th><th className="p-4 text-cyan-300 border-b border-white/5 text-center">إجراءات</th></tr></thead><tbody>{filteredCards.sort((a, b) => b.red - a.red || b.yellow - a.yellow).map((c) => (
                      <tr key={c.id} className="border-b border-white/5 hover:bg-[#1e2a4a]"><td className="p-4 font-bold">{c.player}</td><td className="p-4 text-sm text-gray-300">{c.team}</td><td className="p-4 text-center flex items-center justify-center gap-3"><span className="font-black text-yellow-400">🟨 {c.yellow}</span><span className="font-black text-red-500">🟥 {c.red}</span></td><td className="p-4 text-center"><Button size="sm" variant="destructive" onClick={() => deleteCard(c.id)}><Trash2 className="w-4 h-4"/></Button></td></tr>
                    ))}</tbody></table></div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="motm" className="space-y-6 w-full mt-6">
                <Card className="border-yellow-400 bg-[#13213a] w-full rounded-3xl overflow-hidden shadow-2xl">
                  <CardHeader className="bg-[#1e2a4a] border-b border-yellow-400/30 p-6"><CardTitle className="text-yellow-300 text-2xl font-black">{editingMotmId ? "تعديل نجم المباراة" : "إضافة نجم مباراة"}</CardTitle></CardHeader>
                  <CardContent className="p-6 md:p-8 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 bg-[#0a1428] p-6 rounded-2xl border border-white/5">
                      <div><label className="text-cyan-300 font-bold mb-2 block">الفريق</label><Input list="teams-list" value={motmForm.team} onChange={e => setMotmForm({...motmForm, team: e.target.value})} className="bg-[#1e2a4a] border-cyan-500/50 text-white font-bold h-12" /></div>
                      <div><label className="text-cyan-300 font-bold mb-2 block">اسم اللاعب</label><Input value={motmForm.player} onChange={e => setMotmForm({...motmForm, player: e.target.value})} className="bg-[#1e2a4a] border-cyan-500/50 text-white font-bold h-12" /></div>
                      <div><label className="text-cyan-300 font-bold mb-2 block">مباراة</label><Input value={motmForm.matchName} onChange={e => setMotmForm({...motmForm, matchName: e.target.value})} className="bg-[#1e2a4a] border-cyan-500/50 text-white font-bold h-12" /></div>
                      <div><label className="text-cyan-300 font-bold mb-2 block">رابط الصورة</label><Input value={motmForm.imageUrl} onChange={e => setMotmForm({...motmForm, imageUrl: e.target.value})} className="bg-[#1e2a4a] border-cyan-500/50 text-white h-12" dir="ltr" /></div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3">
                      <div><label className="text-cyan-300 font-bold mb-1 block text-sm">RATING</label><Input type="number" value={motmForm.rating} onChange={e => setMotmForm({...motmForm, rating: Number(e.target.value)})} className="bg-[#0a1428] border-cyan-500/50 text-white font-bold h-12 text-center" /></div>
                      <div><label className="text-cyan-300 font-bold mb-1 block text-sm">PAC</label><Input type="number" value={motmForm.pac} onChange={e => setMotmForm({...motmForm, pac: Number(e.target.value)})} className="bg-[#0a1428] border-cyan-500/50 text-white font-bold h-12 text-center" /></div>
                      <div><label className="text-cyan-300 font-bold mb-1 block text-sm">SHO</label><Input type="number" value={motmForm.sho} onChange={e => setMotmForm({...motmForm, sho: Number(e.target.value)})} className="bg-[#0a1428] border-cyan-500/50 text-white font-bold h-12 text-center" /></div>
                      <div><label className="text-cyan-300 font-bold mb-1 block text-sm">PAS</label><Input type="number" value={motmForm.pas} onChange={e => setMotmForm({...motmForm, pas: Number(e.target.value)})} className="bg-[#0a1428] border-cyan-500/50 text-white font-bold h-12 text-center" /></div>
                      <div><label className="text-cyan-300 font-bold mb-1 block text-sm">DRI</label><Input type="number" value={motmForm.dri} onChange={e => setMotmForm({...motmForm, dri: Number(e.target.value)})} className="bg-[#0a1428] border-cyan-500/50 text-white font-bold h-12 text-center" /></div>
                      <div><label className="text-cyan-300 font-bold mb-1 block text-sm">DEF</label><Input type="number" value={motmForm.def} onChange={e => setMotmForm({...motmForm, def: Number(e.target.value)})} className="bg-[#0a1428] border-cyan-500/50 text-white font-bold h-12 text-center" /></div>
                      <div><label className="text-cyan-300 font-bold mb-1 block text-sm">PHY</label><Input type="number" value={motmForm.phy} onChange={e => setMotmForm({...motmForm, phy: Number(e.target.value)})} className="bg-[#0a1428] border-cyan-500/50 text-white font-bold h-12 text-center" /></div>
                    </div>
                    <div className="flex gap-4"><Button onClick={addMotm} className="flex-1 bg-yellow-400 text-black font-black py-6 text-xl shadow-lg">{editingMotmId ? "تأكيد التعديل" : "إضافة النجم"}</Button></div>
                  </CardContent>
                </Card>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 w-full">
                  {motmList.map((m, i) => (
                    <Card key={i} className="bg-[#13213a] border-cyan-500/30 overflow-hidden shadow-lg">
                      <CardContent className="p-4 flex gap-4 items-center">
                        <div className="w-16 h-16 rounded-full bg-[#0a1428] border-2 border-yellow-400 flex items-center justify-center overflow-hidden shrink-0">{m.imageUrl ? <img src={m.imageUrl} className="w-full h-full object-cover"/> : <span className="text-2xl">👤</span>}</div>
                        <div className="flex-1 min-w-0"><h3 className="font-black text-white truncate text-lg">{m.player}</h3><p className="text-cyan-300 text-xs font-bold truncate">{m.team}</p></div>
                        <div className="flex flex-col gap-2 shrink-0"><Button size="sm" onClick={() => startEditMotm(m)} className="bg-blue-600 text-white h-7"><Edit className="w-3 h-3"/></Button><Button size="sm" variant="destructive" onClick={() => deleteMotm(m.id)} className="h-7"><Trash2 className="w-3 h-3"/></Button></div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="totw" className="space-y-6 w-full mt-6">
                 <Card className="border-emerald-500 bg-[#13213a] w-full rounded-3xl overflow-hidden shadow-2xl">
                    <CardHeader className="bg-[#1e2a4a] border-b border-emerald-500/30 p-6 flex justify-between items-center flex-row">
                       <CardTitle className="text-emerald-400 text-2xl font-black">تشكيلة الجولة</CardTitle>
                       <select value={formationForm.round} onChange={e => setFormationForm(p => ({...p, round: e.target.value}))} className="bg-[#0a1428] border border-emerald-500 rounded-xl p-3 text-white font-bold outline-none cursor-pointer w-48"><option value="دور المجموعات">دور المجموعات</option><option value="الملحق">الملحق</option><option value="دور الستة عشر">دور الستة عشر</option><option value="دور الثمانية">دور الثمانية</option><option value="دور الأربعة">دور الأربعة</option><option value="النهائي">النهائي</option></select>
                    </CardHeader>
                    <CardContent className="p-6 md:p-8 space-y-8">
                       <div className="bg-gradient-to-r from-emerald-900/40 to-[#0a1428] border border-emerald-500/50 p-6 rounded-2xl">
                          <h3 className="text-xl font-black text-yellow-300 mb-4 border-b border-white/10 pb-2">أفضل مدير فني</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                             <div><Input value={formationForm.coach?.name || ''} onChange={e => updateFormationCoach('name', e.target.value)} placeholder="اسم المدرب" className="bg-[#1e2a4a] border-emerald-500/50 text-white font-bold" /></div>
                             <div><Input list="teams-list" value={formationForm.coach?.team || ''} onChange={e => updateFormationCoach('team', e.target.value)} placeholder="الفريق" className="bg-[#1e2a4a] border-emerald-500/50 text-white font-bold" /></div>
                             <div><Input type="number" value={formationForm.coach?.rating || 99} onChange={e => updateFormationCoach('rating', Number(e.target.value))} placeholder="التقييم" className="bg-[#1e2a4a] border-emerald-500/50 text-white font-black text-center" /></div>
                             <div><Input value={formationForm.coach?.imageUrl || ''} onChange={e => updateFormationCoach('imageUrl', e.target.value)} placeholder="رابط الصورة" className="bg-[#1e2a4a] border-white/10 text-white" dir="ltr" /></div>
                          </div>
                       </div>
                       <div className="space-y-4">
                          <h3 className="text-xl font-black text-yellow-300 mb-4 border-b border-white/10 pb-2">اللاعبين (7 أساسيين)</h3>
                          {["GK", "CB", "CB", "LM", "CM", "RM", "ST"].map((pos, i) => (
                            <div key={i} className="flex flex-col sm:flex-row items-center gap-4 bg-[#0a1428] p-4 rounded-xl border border-white/5">
                               <Badge className="bg-emerald-600 text-white font-black w-12 justify-center py-2 text-lg">{pos}</Badge>
                               <Input value={formationForm.players[i]?.name || ''} onChange={e => updateFormationPlayer(i, 'name', e.target.value)} placeholder="اسم اللاعب" className="flex-1 bg-[#1e2a4a] border-white/10 text-white font-bold" />
                               <Input list="teams-list" value={formationForm.players[i]?.team || ''} onChange={e => updateFormationPlayer(i, 'team', e.target.value)} placeholder="الفريق" className="w-full sm:w-40 bg-[#1e2a4a] border-white/10 text-white font-bold" />
                               <Input type="number" value={formationForm.players[i]?.rating || 99} onChange={e => updateFormationPlayer(i, 'rating', Number(e.target.value))} className="w-full sm:w-20 bg-[#1e2a4a] border-yellow-400/50 text-yellow-400 font-black text-center" />
                               <Input value={formationForm.players[i]?.imageUrl || ''} onChange={e => updateFormationPlayer(i, 'imageUrl', e.target.value)} placeholder="رابط الصورة" className="w-full sm:w-48 bg-[#1e2a4a] border-white/10 text-white" dir="ltr" />
                            </div>
                          ))}
                       </div>
                       <Button onClick={saveFormation} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-6 text-xl shadow-lg">حفظ التشكيلة 💾</Button>
                    </CardContent>
                 </Card>
              </TabsContent>

              <TabsContent value="fantasy" className="space-y-6 w-full mt-6">
                <Card className="border-emerald-500/50 bg-[#13213a] w-full rounded-3xl overflow-hidden">
                  <CardHeader className="bg-[#1e2a4a] border-b border-emerald-500/30 p-6 flex flex-col sm:flex-row justify-between items-center gap-4"><CardTitle className="text-emerald-400 text-2xl font-black">إدارة فانتزي التوقعات</CardTitle><Button onClick={deleteAllPredictions} variant="destructive" className="font-bold">مسح كل التوقعات</Button></CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto w-full custom-scrollbar"><table className="w-full text-right text-white"><thead className="bg-[#0a1428]"><tr><th className="p-4 text-cyan-300 border-b border-white/5">المتوقع</th><th className="p-4 text-cyan-300 border-b border-white/5">المباراة</th><th className="p-4 text-cyan-300 border-b border-white/5 text-center">توقعه</th><th className="p-4 text-cyan-300 border-b border-white/5 text-center">إلغاء</th></tr></thead><tbody>{predictions.map((p, i) => (<tr key={i} className="border-b border-white/5 hover:bg-[#1e2a4a]"><td className="p-4 font-bold">{p.name} <span className="text-gray-400 text-sm block" dir="ltr">{p.phone}</span></td><td className="p-4 text-cyan-300 font-bold">{p.matchName}</td><td className="p-4 text-center font-black text-yellow-400 text-xl" dir="ltr">{p.homeScore} - {p.awayScore}</td><td className="p-4 text-center"><Button size="sm" variant="destructive" onClick={() => deletePrediction(p.id)}><Trash2 className="w-4 h-4"/></Button></td></tr>))}</tbody></table></div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="media" className="space-y-6 w-full mt-6">
                <Card className="border-cyan-500 bg-[#13213a] w-full rounded-3xl overflow-hidden shadow-2xl">
                  <CardHeader className="bg-[#1e2a4a] border-b border-cyan-500/30 p-6"><CardTitle className="text-cyan-400 text-2xl font-black">إضافة خبر أو فيديو</CardTitle></CardHeader>
                  <CardContent className="p-6 md:p-8 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-[#0a1428] p-6 rounded-2xl border border-white/5">
                      <div><label className="text-cyan-300 font-bold mb-2 block">النوع</label><select value={mediaForm.type} onChange={e => setMediaForm({...mediaForm, type: e.target.value})} className="bg-[#1e2a4a] border border-cyan-500/50 w-full rounded-xl p-4 text-white font-bold outline-none h-14"><option value="news">📰 خبر</option><option value="video">🎥 فيديو يوتيوب</option></select></div>
                      <div><label className="text-cyan-300 font-bold mb-2 block">العنوان</label><Input value={mediaForm.title} onChange={e => setMediaForm({...mediaForm, title: e.target.value})} className="bg-[#1e2a4a] border-cyan-500/50 text-white font-bold h-14" /></div>
                    </div>
                    <Button onClick={addMedia} className="w-full bg-cyan-600 text-white font-black py-6 text-xl">نشر الآن</Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="notifications" className="space-y-6 w-full mt-6">
                <Card className="border-yellow-400 bg-[#13213a] w-full rounded-3xl overflow-hidden shadow-2xl">
                  <CardHeader className="bg-[#1e2a4a] border-b border-yellow-400/30 p-6"><CardTitle className="text-yellow-300 text-2xl font-black">إرسال إشعار فوري</CardTitle></CardHeader>
                  <CardContent className="p-6 md:p-8 space-y-6">
                    <div className="bg-[#0a1428] border border-white/10 p-6 rounded-2xl flex flex-col md:flex-row gap-4 mb-6 items-center">
                       <span className="text-cyan-300 font-bold whitespace-nowrap">إرسال سريع:</span>
                       <div className="flex flex-wrap gap-2">
                          <Button size="sm" onClick={() => sendQuickNotification("⚽ هدف جديد!", "تم تسجيل هدف الآن.")} className="bg-emerald-600 font-bold">هدف</Button>
                          <Button size="sm" onClick={() => sendQuickNotification("🔴 مباراة بدأت!", "المباراة بدأت لايف حالياً.")} className="bg-red-600 font-bold">لايف</Button>
                       </div>
                    </div>
                    <div className="space-y-4">
                       <Input value={notifyTitle} onChange={e => setNotifyTitle(e.target.value)} placeholder="عنوان الإشعار" className="w-full bg-[#0a1428] border-yellow-400 text-white h-14" />
                       <Input value={notifyBody} onChange={e => setNotifyBody(e.target.value)} placeholder="التفاصيل" className="w-full bg-[#0a1428] border-yellow-400 text-white h-14" />
                    </div>
                    <Button onClick={sendNotification} disabled={isSending} className="w-full bg-yellow-400 text-black py-6 font-black text-xl mt-6">{isSending ? "جاري الإرسال..." : "إرسال الآن 🚀"}</Button>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="ticker" className="w-full mt-6">
                <Card className="border-yellow-400 bg-[#13213a] w-full rounded-3xl overflow-hidden shadow-2xl">
                   <CardHeader className="bg-[#1e2a4a] border-b border-yellow-400/30 p-6"><CardTitle className="text-yellow-300 text-2xl font-black">شريط الأخبار المتحرك</CardTitle></CardHeader>
                   <CardContent className="p-6 md:p-8 space-y-6 w-full">
                     <Input value={tickerText} onChange={e => setTickerText(e.target.value)} placeholder="اكتب شريط الأخبار هنا..." className="w-full bg-[#0a1428] border-yellow-400 text-white font-bold h-14" />
                     <Button onClick={saveTicker} className="w-full bg-yellow-400 text-black py-6 font-black text-xl">تحديث شريط الأخبار ✍️</Button>
                   </CardContent>
                </Card>
              </TabsContent>

            </Tabs>
          </div>
        )}
      </div>
    </div>
  );
}
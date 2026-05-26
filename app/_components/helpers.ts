import { Shield } from "lucide-react";

export const JUNIORS_GROUP_A = ["سيف الوادي", "ميلانو", "النجيلة", "كابتن تيكا", "اصدقاء عز بوالمجدوبة"];
export const JUNIORS_GROUP_B = ["الاولمبي", "ابناء اكرامي", "غوط رباح", "اصدقاء مهدي", "وادي الرمل"];
export const KNOCKOUT_ROUNDS = ["الملحق", "دور الستة عشر", "دور الثمانية", "نصف النهائي", "النهائي"];

export type StandingRow = { 
  team: string; 
  played: number; 
  wins: number; 
  draws: number; 
  losses: number; 
  gf: number; 
  ga: number; 
  gd: number; 
  points: number; 
  rank: number; 
};

export function formatTime12(time24: string): string { 
  if (!time24) return "—"; 
  const [hours, minutes] = time24.split(":").map(Number); 
  const period = hours >= 12 ? "م" : "ص"; 
  return `${hours % 12 || 12}:${minutes.toString().padStart(2, "0")} ${period}`; 
}

export function getArabicDay(dateString: string): string { 
  if (!dateString) return ""; 
  const d = new Date(dateString); 
  if (isNaN(d.getTime())) return ""; 
  const days = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]; 
  return days[d.getDay()]; 
}

export const getYoutubeId = (url: string) => { 
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/; 
  const match = url?.match(regExp); 
  return (match && match[2].length === 11) ? match[2] : null; 
};

export const STANDINGS_HEADERS = ["#", "الفريق", "لعب", "ف", "ت", "خ", "له", "عليه", "فارق", "نقاط"];

export const cleanTeamString = (name: any) => 
  String(name || "").replace(/النجيلّة/g, "النجيلة").replace(/علّوش/g, "علوش").trim();

export function normalizeTeamName(name: string): string { 
  return String(name || "").trim().replace(/\s+/g, " ").replace(/أ|إ|آ/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/ـ/g, "").replace(/ّ/g, "").toLowerCase(); 
}

export function buildStandings(matchRows: any[], allTeams: string[]) {
  const table = new Map<string, StandingRow>(); 
  allTeams.forEach(team => table.set(normalizeTeamName(team), { team, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: 0, points: 0, rank: 0 }));
  
  const groupMatches = matchRows.filter(m => !KNOCKOUT_ROUNDS.includes(m.round));
  groupMatches.forEach(match => { 
    const hg = Number(match.homeGoals) ?? 0; 
    const ag = Number(match.awayGoals) ?? 0; 
    const hNorm = normalizeTeamName(match.home || match.teamA || ""); 
    const aNorm = normalizeTeamName(match.away || match.teamB || ""); 
    let home = table.get(hNorm); 
    let away = table.get(aNorm); 
    if (home) { 
      home.played++; 
      home.gf += hg; 
      home.ga += ag; 
      if (hg > ag) { home.wins++; home.points += 3; } 
      else if (hg === ag) { home.draws++; home.points++; } 
      else { home.losses++; } 
    } 
    if (away) { 
      away.played++; 
      away.ga += ag; 
      away.gf += hg; 
      if (ag > hg) { away.wins++; away.points += 3; } 
      else if (ag === hg) { away.draws++; away.points++; } 
      else { away.losses++; } 
    } 
  });
  
  const penalizedTeam = table.get(normalizeTeamName("17 فبراير")); 
  if (penalizedTeam) { penalizedTeam.points -= 3; }
  
  return Array.from(table.values())
    .map(row => ({ ...row, gd: row.gf - row.ga }))
    .sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.team.localeCompare(b.team, "ar"))
    .map((row, i) => ({ ...row, rank: i + 1 }));
}

export function zoneColor(rank: number, tourneyType: string) { 
  if (tourneyType === 'juniors') return rank <= 4 ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"; 
  return rank <= 8 ? "bg-emerald-500 text-white" : rank <= 24 ? "bg-cyan-500 text-white" : "bg-rose-500 text-white"; 
}

export function sortMatchesAsc(arr: any[]) { 
  return [...arr].sort((a, b) => { 
    if (a.date !== b.date) return a.date.localeCompare(b.date); 
    return (a.time || "00:00").localeCompare(b.time || "00:00"); 
  }); 
}

export const getWinnerData = (t1: string, t2: string, round: string, labelId: string, allMatchesArr: any[]) => {
  if (!t1 || !t2) return { win: null, match: null }; 
  let m = allMatchesArr.find(x => x.matchLabel === labelId);
  if (!m) { m = allMatchesArr.find(x => x.round === round && ((normalizeTeamName(x.teamA) === normalizeTeamName(t1) && normalizeTeamName(x.teamB) === normalizeTeamName(t2)) || (normalizeTeamName(x.teamA) === normalizeTeamName(t2) && normalizeTeamName(x.teamB) === normalizeTeamName(t1)))); }
  if (!m) { const isT1Real = !t1.includes("الفائز") && !t1.includes("المركز"); const isT2Real = !t2.includes("الفائز") && !t2.includes("المركز"); m = allMatchesArr.find(x => x.round === round && ((isT1Real && (normalizeTeamName(x.teamA) === normalizeTeamName(t1) || normalizeTeamName(x.teamB) === normalizeTeamName(t1))) || (isT2Real && (normalizeTeamName(x.teamA) === normalizeTeamName(t2) || normalizeTeamName(x.teamB) === normalizeTeamName(t2))))); }
  if (!m) return { win: null, match: null }; 
  let w = null;
  if (m.status === "انتهت") { 
    const h = Number(m.homeGoals) || 0; 
    const a = Number(m.awayGoals) || 0; 
    if (h > a) w = m.teamA; 
    else if (a > h) w = m.teamB; 
    else { 
      const hPen = (m.penaltiesHome || []).filter((p:any)=>p==='scored').length; 
      const aPen = (m.penaltiesAway || []).filter((p:any)=>p==='scored').length; 
      if (hPen > aPen) w = m.teamA; else if (aPen > hPen) w = m.teamB; 
    } 
  }
  return { win: w, match: m };
};
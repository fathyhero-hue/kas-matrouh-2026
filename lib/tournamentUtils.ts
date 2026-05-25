// lib/tournamentUtils.ts
import { TEAM_NAMES } from "@/data/tournament";

export const STANDINGS_HEADERS = ["#", "الفريق", "لعب", "ف", "ت", "خ", "له", "عليه", "فارق", "نقاط"];
export const CLEANED_TEAM_NAMES = Array.from(new Set(TEAM_NAMES.map(t => String(t || "").trim())));

export function normalizeTeamName(name: string): string { 
    return String(name || "").trim().toLowerCase(); 
}

export function zoneColor(rank: number) { 
    return rank <= 4 ? "bg-emerald-500" : "bg-rose-500"; 
}

export function buildStandings(matches: any[]) {
    const table = new Map();
    matches.filter(m => m.status === "انتهت").forEach(match => {
        [match.teamA, match.teamB].forEach((team, i) => {
            if (!table.has(team)) table.set(team, { team, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, points: 0 });
            const row = table.get(team);
            row.played++;
            const goalsFor = i === 0 ? Number(match.homeGoals) : Number(match.awayGoals);
            const goalsAgainst = i === 0 ? Number(match.awayGoals) : Number(match.homeGoals);
            row.gf += goalsFor; row.ga += goalsAgainst;
            if (goalsFor > goalsAgainst) { row.wins++; row.points += 3; }
            else if (goalsFor === goalsAgainst) { row.draws++; row.points += 1; }
            else { row.losses++; }
        });
    });
    return Array.from(table.values()).sort((a, b) => b.points - a.points).map((r, i) => ({ ...r, rank: i + 1 }));
}

export function getYoutubeId(url: string) {
    const match = url?.match(/(?:youtu\.be\/|youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=))([^"&?\/\s]{11})/);
    return match ? match[1] : null;
}
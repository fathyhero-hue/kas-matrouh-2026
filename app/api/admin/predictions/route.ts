import { NextRequest, NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/authorization";
import {
  buildPredictionLeaderboard,
  createPredictionMatchResolver,
  getCountedPredictionIds,
  isValidPredictionScore,
  normalizePredictionPhone,
  scorePrediction,
  type PredictionLeaderboardEntry,
  type PredictionMatch,
  type PredictionRecord,
} from "@/lib/sport/prediction-scoring";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const PAGE_SIZE = 1000;

async function readPredictions(supabase: ReturnType<typeof createServiceRoleClient>) {
  const rows: PredictionRecord[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("predictions")
      .select("id, match_id, bracket_id, match_name, name, phone, home_score, away_score, submitted_at")
      .order("submitted_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...((data || []) as PredictionRecord[]));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

async function readMatches(supabase: ReturnType<typeof createServiceRoleClient>) {
  const rows: PredictionMatch[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("matches")
      .select("id, legacy_id, bracket_id, team_a, team_b, match_date, match_time, status, is_live, home_goals, away_goals")
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...((data || []) as PredictionMatch[]));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

export async function GET(request: NextRequest) {
  const authorization = await authorizeAdminRequest(request, "matches.results.manage");
  if (authorization instanceof NextResponse) return authorization;

  try {
    const supabase = createServiceRoleClient();
    const [predictions, matches, bracketResult] = await Promise.all([
      readPredictions(supabase),
      readMatches(supabase),
      supabase.from("brackets").select("id, tournament, edition, label, legacy_suffix").order("tournament").order("edition"),
    ]);
    if (bracketResult.error) throw bracketResult.error;

    const brackets = (bracketResult.data || []).map((bracket) => ({
      id: bracket.id,
      label: bracket.label || `${bracket.tournament} ${bracket.edition || ""}`.trim(),
    }));
    const resolveMatch = createPredictionMatchResolver(matches);
    const countedIds = getCountedPredictionIds(predictions, matches);
    const leaderboards: Record<string, PredictionLeaderboardEntry[]> = Object.fromEntries(
      brackets.map(({ id }) => [id, buildPredictionLeaderboard(predictions, matches, id)]),
    );
    const rows = predictions.map((prediction) => {
      const match = resolveMatch(prediction);
      const score = scorePrediction(prediction, match);
      const counted = countedIds.has(prediction.id);
      const valid = isValidPredictionScore(prediction);
      return {
        id: prediction.id,
        bracket_id: match?.bracket_id || prediction.bracket_id || null,
        match_id: prediction.match_id,
        match_name: match?.team_a && match.team_b ? `${match.team_a} × ${match.team_b}` : prediction.match_name,
        team_a: match?.team_a || null,
        team_b: match?.team_b || null,
        match_date: match?.match_date || null,
        match_time: match?.match_time || null,
        status: match?.status || null,
        home_score: prediction.home_score,
        away_score: prediction.away_score,
        home_goals: match?.home_goals ?? null,
        away_goals: match?.away_goals ?? null,
        name: prediction.name,
        phone: prediction.phone,
        submitted_at: prediction.submitted_at,
        counted,
        outcome: !normalizePredictionPhone(prediction.phone) ? "review" : !valid ? "invalid"
          : !counted ? "duplicate" : !match ? "unmatched" : score.outcome,
        points: valid && counted && match ? score.points : null,
      };
    });

    return NextResponse.json({ brackets, predictions: rows, leaderboards }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Admin prediction list failed:", error);
    return NextResponse.json({ error: "تعذر تحميل التوقعات." }, { status: 500 });
  }
}

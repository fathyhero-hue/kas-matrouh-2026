import { NextRequest, NextResponse } from "next/server";
import { buildPredictionLeaderboard, type PredictionMatch, type PredictionRecord } from "@/lib/sport/prediction-scoring";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const PAGE_SIZE = 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function readMatches(supabase: ReturnType<typeof createServiceRoleClient>, bracketId: string) {
  const rows: PredictionMatch[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("matches")
      .select("id, legacy_id, bracket_id, status, is_live, home_goals, away_goals")
      .eq("bracket_id", bracketId)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...((data || []) as PredictionMatch[]));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

async function readPredictions(supabase: ReturnType<typeof createServiceRoleClient>, bracketId: string) {
  const rows: PredictionRecord[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("predictions")
      .select("id, match_id, bracket_id, name, phone, home_score, away_score, submitted_at")
      .eq("bracket_id", bracketId)
      .order("submitted_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...((data || []) as PredictionRecord[]));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

export async function GET(request: NextRequest) {
  const bracketId = request.nextUrl.searchParams.get("bracketId") || "";
  if (!UUID_PATTERN.test(bracketId)) {
    return NextResponse.json({ error: "معرّف البطولة غير صالح." }, { status: 400 });
  }

  const rawOffset = Number(request.nextUrl.searchParams.get("offset") || "0");
  const rawLimit = Number(request.nextUrl.searchParams.get("limit") || "50");
  if (!Number.isSafeInteger(rawOffset) || rawOffset < 0 || !Number.isSafeInteger(rawLimit) || rawLimit < 1) {
    return NextResponse.json({ error: "بيانات الصفحة غير صالحة." }, { status: 400 });
  }
  const offset = rawOffset;
  const limit = Math.min(rawLimit, 100);

  try {
    const supabase = createServiceRoleClient();
    const [matches, predictions] = await Promise.all([
      readMatches(supabase, bracketId),
      readPredictions(supabase, bracketId),
    ]);
    const leaderboard = buildPredictionLeaderboard(predictions, matches, bracketId);
    return NextResponse.json({
      entries: leaderboard.slice(offset, offset + limit),
      offset,
      limit,
      total: leaderboard.length,
    }, { headers: { "Cache-Control": "public, max-age=30, s-maxage=30, stale-while-revalidate=60" } });
  } catch (error) {
    console.error("Public prediction leaderboard query failed:", error);
    return NextResponse.json({ error: "تعذر تحميل ترتيب المتوقعين." }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";
import { isPredictionOpen, validatePrediction } from "@/lib/sport/predictions";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid body");
  } catch {
    return NextResponse.json({ error: "بيانات التوقع غير صالحة." }, { status: 400 });
  }

  const matchId = String(body.matchId || "");
  const bracketId = String(body.bracketId || "");
  if (!/^[0-9a-f-]{36}$/i.test(matchId) || !/^[0-9a-f-]{36}$/i.test(bracketId)) {
    return NextResponse.json({ error: "المباراة غير صالحة." }, { status: 400 });
  }
  const input = {
    name: String(body.name || ""), phone: String(body.phone || ""),
    homeScore: String(body.homeScore ?? ""), awayScore: String(body.awayScore ?? ""),
  };
  const errors = validatePrediction(input);
  if (Object.values(errors).some(Boolean)) {
    return NextResponse.json({ error: "أكمل البيانات المطلوبة لهذه المباراة.", fields: errors }, { status: 400 });
  }

  try {
    const supabase = createPublicClient();
    const { data: match, error: matchError } = await supabase.from("matches")
      .select("id, bracket_id, team_a, team_b, match_date, match_time, status, is_live")
      .eq("id", matchId).eq("bracket_id", bracketId).maybeSingle();
    if (matchError) {
      console.error("Prediction match lookup failed:", matchError);
      return NextResponse.json({ error: "تعذر التحقق من المباراة." }, { status: 500 });
    }
    if (!match) return NextResponse.json({ error: "المباراة غير موجودة في هذه البطولة." }, { status: 404 });
    if (!isPredictionOpen(match)) {
      return NextResponse.json({ error: "أُغلق التوقع لهذه المباراة." }, { status: 409 });
    }

    const { error } = await supabase.from("predictions").insert({
      match_id: match.id,
      bracket_id: match.bracket_id,
      match_name: `${match.team_a} vs ${match.team_b}`,
      name: input.name.trim(),
      phone: input.phone.trim(),
      home_score: Number(input.homeScore),
      away_score: Number(input.awayScore),
    });
    if (error) {
      console.error("Prediction insert failed:", error);
      return NextResponse.json({ error: "تعذر حفظ التوقع. حاول مرة أخرى." }, { status: 500 });
    }
    return NextResponse.json({ saved: true }, { status: 201 });
  } catch (error) {
    console.error("Prediction submission failed:", error);
    return NextResponse.json({ error: "الخادم غير متاح مؤقتاً. حاول مرة أخرى." }, { status: 503 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/authorization";
import { auditAdminMutation } from "@/lib/admin/audit";
import {
  createLiveMatchTransition,
  parseCairoKickoff,
  type LiveMatchAction,
  type LiveMatchSnapshot,
} from "@/lib/sport/home-match-schedule";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIONS = new Set<LiveMatchAction>(["start", "halftime", "resume", "finish"]);
const PAGE_SIZE = 1000;

export async function GET(request: NextRequest) {
  const authorization = await authorizeAdminRequest(request, "matches.live.manage");
  if (authorization instanceof NextResponse) return authorization;

  try {
    const db = createServiceRoleClient();
    const [matches, bracketsResult] = await Promise.all([
      (async () => {
        const rows = [];
        for (let from = 0; ; from += PAGE_SIZE) {
          const { data, error } = await db.from("matches")
            .select("id, bracket_id, team_a, team_a_logo, team_b, team_b_logo, match_date, match_time, status, is_live, home_goals, away_goals, live_events_enabled, live_event_base_home_goals, live_event_base_away_goals, live_minute, live_minute_base, timer_started_at, timer_paused_total, is_timer_running, updated_at")
            .is("archived_at", null)
            .order("match_date", { ascending: true })
            .order("match_time", { ascending: true })
            .order("id", { ascending: true })
            .range(from, from + PAGE_SIZE - 1);
          if (error) throw error;
          rows.push(...(data || []));
          if (!data || data.length < PAGE_SIZE) return rows;
        }
      })(),
      db.from("brackets").select("id, label, tournament, edition, legacy_suffix").order("tournament").order("edition"),
    ]);
    const { data: brackets, error: bracketsError } = bracketsResult;
    if (bracketsError) throw bracketsError;
    const venuesQuery = matches?.length
      ? await db.from("matches").select("id, venue").in("id", matches.map((match) => match.id))
      : { data: [], error: null };
    let venueByMatch = new Map<string, string | null>();
    if (venuesQuery.error) {
      const missingVenueColumn = venuesQuery.error.code === "42703" ||
        venuesQuery.error.code === "PGRST204" ||
        /column .*venue.* does not exist|could not find the ['"]venue['"] column/i.test(venuesQuery.error.message);
      if (!missingVenueColumn) throw venuesQuery.error;
      console.warn("The optional matches.venue column is not available yet; serving live management without venues.");
    } else {
      venueByMatch = new Map((venuesQuery.data || []).map((row) => [row.id, row.venue]));
    }
    const bracketById = new Map((brackets || []).map((bracket) => [bracket.id, bracket]));
    const now = new Date();
    const mappedMatches = (matches || []).map((match) => {
      const bracket = bracketById.get(match.bracket_id);
      return {
        ...match,
        venue: venueByMatch.get(match.id) || null,
        tournament: bracket?.label || [bracket?.tournament, bracket?.edition].filter(Boolean).join(" "),
      };
    });
    mappedMatches.sort((left, right) => {
      const priority = (match: (typeof mappedMatches)[number]) => {
        if (match.is_live || ["الشوط الأول", "استراحة", "الشوط الثاني", "ضربات جزاء"].includes(match.status || "")) return 0;
        const kickoff = parseCairoKickoff(match.match_date, match.match_time);
        const remaining = kickoff ? kickoff.getTime() - now.getTime() : Number.POSITIVE_INFINITY;
        return remaining >= 0 && remaining <= 2 * 60 * 60 * 1000 ? 1 : 2;
      };
      return priority(left) - priority(right) ||
        `${left.match_date || ""}T${left.match_time || ""}`.localeCompare(`${right.match_date || ""}T${right.match_time || ""}`);
    });
    return NextResponse.json({
      matches: mappedMatches,
      updatedAt: new Date().toISOString(),
      canCorrectScore: authorization.permissions.has("matches.live.correct_score"),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Admin live match list failed:", error);
    return NextResponse.json({ error: "تعذر تحميل المباريات." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "بيانات العملية غير صالحة." }, { status: 400 });
    }
    const values = body as Record<string, unknown>;
    const { matchId, action } = values;
    const permission = action === "correct_score"
      ? "matches.live.correct_score"
      : "matches.live.manage";
    const authorization = await authorizeAdminRequest(request, permission);
    if (authorization instanceof NextResponse) return authorization;

    if (action === "correct_score") {
      const homeGoals = values.homeGoals;
      const awayGoals = values.awayGoals;
      const reason = typeof values.reason === "string"
        ? values.reason.trim()
        : "";
      if (typeof matchId !== "string" || !UUID_PATTERN.test(matchId) ||
        typeof homeGoals !== "number" || !Number.isSafeInteger(homeGoals) || homeGoals < 0 ||
        typeof awayGoals !== "number" || !Number.isSafeInteger(awayGoals) || awayGoals < 0 ||
        reason.length < 1 || reason.length > 1000) {
        return NextResponse.json({ error: "أدخل نتيجة صحيحة وسببًا واضحًا للتصحيح." }, { status: 400 });
      }

      const db = createServiceRoleClient();
      const { data: correctedMatch, error } = await db.rpc("correct_match_live_score", {
        p_match_id: matchId,
        p_new_base_home_goals: homeGoals,
        p_new_base_away_goals: awayGoals,
        p_reason: reason,
        p_actor: authorization.userId,
      });
      if (error) {
        if (error.message.includes("SCORE_CORRECTION_FORBIDDEN")) {
          return NextResponse.json({ error: "لا تملك صلاحية تصحيح نتيجة المباراة." }, { status: 403 });
        }
        if (error.message.includes("INVALID_SCORE_BASELINE") ||
          error.message.includes("SCORE_CORRECTION_REASON_REQUIRED")) {
          return NextResponse.json({ error: "النتيجة أو سبب التصحيح غير صالح." }, { status: 400 });
        }
        if (error.message.includes("MATCH_NOT_FOUND")) {
          return NextResponse.json({ error: "المباراة غير موجودة." }, { status: 404 });
        }
        if (error.message.includes("LIVE_EVENTS_NOT_ENABLED")) {
          return NextResponse.json({ error: "فعّل متابعة أهداف المباراة قبل تصحيح رصيدها الأساسي." }, { status: 409 });
        }
        if (error.message.includes("SCORE_OUT_OF_RANGE")) {
          return NextResponse.json({ error: "النتيجة الناتجة عن التصحيح خارج النطاق المسموح." }, { status: 400 });
        }
        throw error;
      }

      await auditAdminMutation({
        actorUserId: authorization.userId,
        action: "matches.live.score.correct",
        permission: "matches.live.correct_score",
        entityType: "matches",
        entityId: matchId,
        metadata: { match_id: matchId },
        request,
      });
      return NextResponse.json({ ok: true, match: correctedMatch });
    }

    if (typeof matchId !== "string" || !UUID_PATTERN.test(matchId) ||
      typeof action !== "string" || !ACTIONS.has(action as LiveMatchAction)) {
      return NextResponse.json({ error: "المباراة أو الإجراء غير صالح." }, { status: 400 });
    }

    const db = createServiceRoleClient();
    const { data: match, error: matchError } = await db.from("matches")
      .select("id, status, is_live, live_minute, live_minute_base, timer_started_at, timer_paused_total, is_timer_running, updated_at, archived_at")
      .eq("id", matchId)
      .maybeSingle();
    if (matchError) throw matchError;
    if (!match) return NextResponse.json({ error: "المباراة غير موجودة." }, { status: 404 });
    if (match.archived_at) return NextResponse.json({ error: "المباراة مؤرشفة؛ استعدها قبل إدارة البث." }, { status: 409 });

    const previous = match as LiveMatchSnapshot & { id: string; updated_at: string | null };
    const patch = createLiveMatchTransition(previous, action as LiveMatchAction, new Date());
    if (!patch) {
      return NextResponse.json({ error: "لا يمكن تنفيذ هذا الانتقال من حالة المباراة الحالية." }, { status: 409 });
    }

    let update = db.from("matches").update(patch).eq("id", matchId);
    update = previous.status === null ? update.is("status", null) : update.eq("status", previous.status);
    update = previous.is_live === null ? update.is("is_live", null) : update.eq("is_live", previous.is_live);
    if (previous.updated_at) update = update.eq("updated_at", previous.updated_at);
    const { data: updated, error: updateError } = await update.select().maybeSingle();
    if (updateError) throw updateError;
    if (!updated) {
      return NextResponse.json({ error: "تغيرت حالة المباراة بالتزامن؛ حدّث القائمة وحاول مجددًا." }, { status: 409 });
    }

    await auditAdminMutation({
      actorUserId: authorization.userId,
      action: `matches.live.${action}`,
      permission: "matches.live.manage",
      entityType: "matches",
      entityId: matchId,
      metadata: {
        match_id: matchId,
        old_status: previous.status || "",
        new_status: String(patch.status),
        changed_fields: Object.keys(patch),
      },
      request,
    });
    return NextResponse.json({ ok: true, match: updated });
  } catch (error) {
    console.error("Admin live match update failed:", error);
    return NextResponse.json({ error: "تعذر تحديث حالة المباراة." }, { status: 500 });
  }
}

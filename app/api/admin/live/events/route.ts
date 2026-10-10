import { NextRequest, NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/authorization";
import { auditAdminMutation } from "@/lib/admin/audit";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CARD_TYPES = new Set(["yellow", "direct_red", "second_yellow_red"]);
const ACTIVE_STATUSES = new Set(["الشوط الأول", "استراحة", "الشوط الثاني", "ضربات جزاء"]);

type MatchRow = {
  id: string;
  bracket_id: string;
  team_a: string;
  team_b: string;
  status: string | null;
  is_live: boolean | null;
  live_events_enabled: boolean;
};

type MatchTeamSelection = Pick<MatchRow, "bracket_id" | "team_a" | "team_b">;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function inputError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function resolveSelection(
  db: ReturnType<typeof createServiceRoleClient>,
  match: MatchTeamSelection,
  teamRosterId: string,
  playerId: string,
) {
  const [{ data: team, error: teamError }, { data: player, error: playerError }] = await Promise.all([
    db.from("team_rosters").select("id, bracket_id, team_name").eq("id", teamRosterId).maybeSingle(),
    db.from("roster_players").select("id, roster_id").eq("id", playerId).maybeSingle(),
  ]);
  if (teamError) throw teamError;
  if (playerError) throw playerError;
  if (!team || team.bracket_id !== match.bracket_id ||
    !team.team_name || ![match.team_a, match.team_b].includes(team.team_name)) {
    throw new Error("الفريق المحدد لا يشارك في هذه المباراة.");
  }
  if (!player || player.roster_id !== team.id) {
    throw new Error("اللاعب المحدد لا ينتمي إلى الفريق المختار.");
  }
  return team;
}

export async function GET(request: NextRequest) {
  const authorization = await authorizeAdminRequest(request, "matches.live.manage");
  if (authorization instanceof NextResponse) return authorization;

  const matchId = text(request.nextUrl.searchParams.get("match_id"));
  if (!UUID_PATTERN.test(matchId)) return inputError("معرّف المباراة غير صالح.");

  try {
    const db = createServiceRoleClient();
    const { data: match, error: matchError } = await db.from("matches")
      .select("id, bracket_id, team_a, team_b, status, is_live, live_events_enabled, archived_at")
      .eq("id", matchId)
      .maybeSingle();
    if (matchError) throw matchError;
    if (!match) return inputError("المباراة غير موجودة.", 404);
    if (match.archived_at) return inputError("المباراة مؤرشفة؛ استعدها قبل إدارة أحداثها.", 409);

    const typedMatch = match as MatchRow;
    const [teamsQuery, goalsQuery, cardsQuery] = await Promise.all([
      db.from("team_rosters").select("id, team_name, roster_players(id, name)")
        .eq("bracket_id", match.bracket_id),
      db.from("match_goal_events")
        .select("id, team_roster_id, roster_player_id, event_type, match_minute, created_at")
        .eq("match_id", matchId)
        .is("revoked_at", null)
        .order("created_at", { ascending: true }),
      db.from("card_events")
        .select("id, team_roster_id, roster_player_id, card_type, match_minute, source_card_id, created_at")
        .eq("match_id", matchId)
        .order("created_at", { ascending: true }),
    ]);
    if (teamsQuery.error) throw teamsQuery.error;
    if (goalsQuery.error) throw goalsQuery.error;
    if (cardsQuery.error) throw cardsQuery.error;

    const exclusionQuery = await db.from("match_card_event_exclusions")
      .select("event_id")
      .eq("match_id", matchId);
    if (exclusionQuery.error) throw exclusionQuery.error;
    const excludedCardIds = new Set((exclusionQuery.data || []).map((row) => row.event_id));
    const allowedTeams = (teamsQuery.data || []).filter((team) =>
      team.team_name && [typedMatch.team_a, typedMatch.team_b].includes(team.team_name),
    );
    const teamById = new Map(allowedTeams.map((team) => [team.id, team]));
    const playerById = new Map(allowedTeams.flatMap((team) =>
      (team.roster_players || []).map((player) => [player.id, player] as const),
    ));
    const events = [
      ...(goalsQuery.data || []).map((event) => ({
        id: event.id,
        kind: "goal" as const,
        eventType: "goal",
        teamRosterId: event.team_roster_id,
        playerId: event.roster_player_id,
        teamName: teamById.get(event.team_roster_id)?.team_name || "فريق غير معروف",
        playerName: playerById.get(event.roster_player_id)?.name || "لاعب غير معروف",
        minute: event.match_minute,
        createdAt: event.created_at,
        editable: true,
      })),
      ...(cardsQuery.data || []).filter((event) => !excludedCardIds.has(event.id)).map((event) => ({
        id: event.id,
        kind: "card" as const,
        eventType: event.card_type,
        teamRosterId: event.team_roster_id,
        playerId: event.roster_player_id,
        teamName: teamById.get(event.team_roster_id)?.team_name || "فريق غير معروف",
        playerName: playerById.get(event.roster_player_id)?.name || "لاعب غير معروف",
        minute: event.match_minute,
        createdAt: event.created_at,
        editable: event.source_card_id === null,
      })),
    ].sort((left, right) => left.createdAt.localeCompare(right.createdAt));

    return NextResponse.json({
      match: {
        id: typedMatch.id,
        bracketId: typedMatch.bracket_id,
        teamA: typedMatch.team_a,
        teamB: typedMatch.team_b,
        status: typedMatch.status,
        isLive: typedMatch.is_live,
        liveEventsEnabled: typedMatch.live_events_enabled,
      },
      canFullyManage: authorization.permissions.has("matches.admin.full_control"),
      teams: allowedTeams.map((team) => ({
        id: team.id,
        name: team.team_name,
        players: (team.roster_players || [])
          .filter((player) => player.name)
          .map((player) => ({ id: player.id, name: player.name })),
      })),
      events,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Admin live event list failed:", error);
    return NextResponse.json({ error: "تعذر تحميل أحداث المباراة." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authorization = await authorizeAdminRequest(request, "matches.live.manage");
  if (authorization instanceof NextResponse) return authorization;

  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return inputError("بيانات الحدث غير صالحة.");
    }
    const values = body as Record<string, unknown>;
    const matchId = text(values.matchId);
    if (!UUID_PATTERN.test(matchId)) return inputError("معرّف المباراة غير صالح.");

    const db = createServiceRoleClient();
    const { data: match, error: matchError } = await db.from("matches")
      .select("id, bracket_id, team_a, team_b, status, is_live, live_events_enabled, archived_at")
      .eq("id", matchId)
      .maybeSingle();
    if (matchError) throw matchError;
    if (!match) return inputError("المباراة غير موجودة.", 404);
    if (match.archived_at) return inputError("المباراة مؤرشفة؛ استعدها قبل إدارة أحداثها.", 409);

    if (values.action === "enable") {
      const { data, error } = await db.rpc("enable_match_live_events", {
        p_match_id: matchId,
        p_actor: authorization.userId,
      });
      if (error) throw error;
      await auditAdminMutation({
        actorUserId: authorization.userId,
        action: "matches.live.events.enable",
        permission: "matches.live.manage",
        entityType: "matches",
        entityId: matchId,
        request,
      });
      return NextResponse.json({ ok: true, match: data });
    }

    const eventType = text(values.eventType);
    const teamRosterId = text(values.teamRosterId);
    const playerId = text(values.playerId);
    const idempotencyKey = text(values.idempotencyKey);
    const minute = Number(values.minute);
    if (!["goal", ...CARD_TYPES].includes(eventType) ||
      !UUID_PATTERN.test(teamRosterId) || !UUID_PATTERN.test(playerId) ||
      !UUID_PATTERN.test(idempotencyKey) || !Number.isInteger(minute) || minute < 1 || minute > 150) {
      return inputError("اختر الحدث والفريق واللاعب والدقيقة بصورة صحيحة.");
    }
    if (match.is_live !== true || !ACTIVE_STATUSES.has(match.status || "")) {
      return inputError("لا يمكن تسجيل أحداث جديدة إلا بعد بدء المباراة رسميًا.", 409);
    }
    if (eventType === "goal" && !match.live_events_enabled) {
      return inputError("فعّل تسجيل أحداث الأهداف لهذه المباراة أولًا.", 409);
    }
    const team = await resolveSelection(db, match, teamRosterId, playerId);

    let eventId: string;
    if (eventType === "goal") {
      const { data, error } = await db.rpc("create_match_goal_event", {
        p_bracket_id: match.bracket_id,
        p_match_id: matchId,
        p_team_roster_id: team.id,
        p_roster_player_id: playerId,
        p_match_minute: minute,
        p_idempotency_key: idempotencyKey,
        p_actor: authorization.userId,
      });
      if (error) {
        if (error.message.includes("IDEMPOTENCY_KEY_PAYLOAD_MISMATCH")) {
          return inputError("مفتاح العملية مستخدم لحدث مختلف.", 409);
        }
        if (error.message.includes("IDEMPOTENCY_EVENT_ALREADY_REVOKED")) {
          return inputError("لا يمكن إعادة استخدام مفتاح حدث ملغى.", 409);
        }
        throw error;
      }
      eventId = data.id;
    } else {
      const { data, error } = await db.rpc("create_live_card_event", {
        p_bracket_id: match.bracket_id,
        p_match_id: matchId,
        p_roster_player_id: playerId,
        p_team_roster_id: team.id,
        p_card_type: eventType,
        p_match_minute: minute,
        p_idempotency_key: idempotencyKey,
        p_actor: authorization.userId,
      });
      if (error) {
        if (error.message.includes("IDEMPOTENCY_KEY_PAYLOAD_MISMATCH")) {
          return inputError("مفتاح العملية مستخدم لحدث مختلف.", 409);
        }
        if (error.message.includes("IDEMPOTENCY_EVENT_ALREADY_DELETED")) {
          return inputError("لا يمكن إعادة استخدام مفتاح حدث ملغى.", 409);
        }
        throw error;
      }
      eventId = data.id;
    }

    await auditAdminMutation({
      actorUserId: authorization.userId,
      action: "matches.live.event.create",
      permission: "matches.live.manage",
      entityType: eventType === "goal" ? "match_goal_event" : "card_event",
      entityId: eventId,
      metadata: { match_id: matchId, event_type: eventType, minute },
      request,
    });
    return NextResponse.json({ ok: true, eventId });
  } catch (error) {
    console.error("Admin live event create failed:", error);
    return NextResponse.json({ error: "تعذر تسجيل الحدث." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const fullAuthorization = await authorizeAdminRequest(request, "matches.admin.full_control");
  const isFullControl = !(fullAuthorization instanceof NextResponse);
  const authorization = isFullControl ? fullAuthorization : await authorizeAdminRequest(request, "matches.live.manage");
  if (authorization instanceof NextResponse) return authorization;

  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return inputError("بيانات التعديل غير صالحة.");
    const values = body as Record<string, unknown>;
    const matchId = text(values.matchId);
    const eventId = text(values.eventId);
    const kind = text(values.kind);
    const eventType = text(values.eventType);
    const teamRosterId = text(values.teamRosterId);
    const playerId = text(values.playerId);
    const minute = Number(values.minute);
    const reason = typeof values.reason === "string" && values.reason.trim()
      ? values.reason.trim()
      : "تعديل حدث من لوحة إدارة المباراة";
    if (!UUID_PATTERN.test(matchId) || !UUID_PATTERN.test(eventId) ||
      !["goal", "card"].includes(kind) || !Number.isInteger(minute) || minute < 1 || minute > 150) {
      return inputError("بيانات الحدث أو الدقيقة غير صالحة.");
    }
    if ((kind === "goal" && eventType !== "goal") ||
      (kind === "card" && !CARD_TYPES.has(eventType)) ||
      !UUID_PATTERN.test(teamRosterId) || !UUID_PATTERN.test(playerId)) {
      return inputError("نوع الحدث أو هوية اللاعب غير صالحة.");
    }

    const db = createServiceRoleClient();
    const { data: match, error: matchError } = await db.from("matches")
      .select("id, bracket_id, team_a, team_b, archived_at")
      .eq("id", matchId)
      .maybeSingle();
    if (matchError) throw matchError;
    if (!match) return inputError("المباراة غير موجودة.", 404);
    if (match.archived_at) return inputError("المباراة مؤرشفة؛ استعدها قبل إدارة أحداثها.", 409);
    const team = await resolveSelection(db, match, teamRosterId, playerId);
    let oldMinute: number | null = null;
    let oldTeamRosterId = "";
    let oldPlayerId = "";

    if (kind === "goal") {
      const { data: current, error: currentError } = await db.from("match_goal_events")
        .select("id, team_roster_id, roster_player_id, match_minute")
        .eq("id", eventId)
        .eq("match_id", matchId)
        .is("revoked_at", null)
        .maybeSingle();
      if (currentError) throw currentError;
      if (!current) return inputError("الحدث غير موجود أو سبق إلغاؤه.", 404);
      oldMinute = current.match_minute;
      oldTeamRosterId = current.team_roster_id;
      oldPlayerId = current.roster_player_id;
      if (isFullControl) {
        const { error } = await db.rpc("admin_manage_match_event", {
          p_action: "update",
          p_kind: "goal",
          p_event_id: eventId,
          p_match_id: matchId,
          p_actor: authorization.userId,
          p_team_roster_id: team.id,
          p_roster_player_id: playerId,
          p_event_type: "goal",
          p_match_minute: minute,
          p_reason: reason,
        });
        if (error) {
          if (error.message.includes("MATCH_ADMIN_FORBIDDEN")) return inputError("هذه العملية متاحة للمسؤول الرئيسي المخوّل فقط.", 403);
          if (error.message.includes("MATCH_ARCHIVED")) return inputError("المباراة مؤرشفة؛ استعدها قبل إدارة أحداثها.", 409);
          if (error.message.includes("EVENT_ALREADY_REVOKED")) return inputError("سبق إلغاء الحدث.", 409);
          throw error;
        }
      } else {
      const { data: updated, error } = await db.rpc("update_match_goal_event", {
        p_event_id: eventId,
        p_team_roster_id: team.id,
        p_roster_player_id: playerId,
        p_match_minute: minute,
        p_actor: authorization.userId,
      });
      if (error) {
        if (error.message.includes("EVENT_ALREADY_REVOKED")) return inputError("سبق إلغاء الحدث.", 409);
        throw error;
      }
      if (!updated) return inputError("تغير الحدث بالتزامن؛ حدّث القائمة.", 409);
      }
    } else {
      const { data: current, error: currentError } = await db.from("card_events")
        .select("id, source_card_id, team_roster_id, roster_player_id, match_minute")
        .eq("id", eventId)
        .eq("match_id", matchId)
        .maybeSingle();
      if (currentError) throw currentError;
      if (!current) return inputError("الحدث غير موجود.", 404);
      if (current.source_card_id) return inputError("لا يمكن تعديل حدث بطاقة تاريخي.", 409);
      oldMinute = current.match_minute;
      oldTeamRosterId = current.team_roster_id;
      oldPlayerId = current.roster_player_id;
      if (isFullControl) {
        const { error } = await db.rpc("admin_manage_match_event", {
          p_action: "update",
          p_kind: "card",
          p_event_id: eventId,
          p_match_id: matchId,
          p_actor: authorization.userId,
          p_team_roster_id: team.id,
          p_roster_player_id: playerId,
          p_event_type: eventType,
          p_match_minute: minute,
          p_reason: reason,
        });
        if (error) {
          if (error.message.includes("MATCH_ADMIN_FORBIDDEN")) return inputError("هذه العملية متاحة للمسؤول الرئيسي المخوّل فقط.", 403);
          if (error.message.includes("MATCH_ARCHIVED")) return inputError("المباراة مؤرشفة؛ استعدها قبل إدارة أحداثها.", 409);
          if (error.message.includes("HISTORICAL_CARD_EVENT_IMMUTABLE")) return inputError("لا يمكن تعديل حدث بطاقة تاريخي.", 409);
          throw error;
        }
      } else {
      const { data, error } = await db.from("card_events").update({
        team_roster_id: team.id,
        roster_player_id: playerId,
        card_type: eventType,
        match_minute: minute,
      }).eq("id", eventId).eq("match_id", matchId).is("source_card_id", null).select("id").maybeSingle();
      if (error) throw error;
      if (!data) return inputError("تغير الحدث بالتزامن؛ حدّث القائمة.", 409);
      }
    }

    await auditAdminMutation({
      actorUserId: authorization.userId,
      action: "matches.live.event.update",
      permission: isFullControl ? "matches.admin.full_control" : "matches.live.manage",
      entityType: kind === "goal" ? "match_goal_event" : "card_event",
      entityId: eventId,
      metadata: {
        match_id: matchId,
        event_type: eventType,
        old_minute: oldMinute,
        old_team_roster_id: oldTeamRosterId,
        old_roster_player_id: oldPlayerId,
        team_roster_id: team.id,
        roster_player_id: playerId,
        minute,
      },
      request,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin live event update failed:", error);
    return NextResponse.json({ error: "تعذر تعديل الحدث." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const fullAuthorization = await authorizeAdminRequest(request, "matches.admin.full_control");
  const isFullControl = !(fullAuthorization instanceof NextResponse);
  const authorization = isFullControl ? fullAuthorization : await authorizeAdminRequest(request, "matches.live.manage");
  if (authorization instanceof NextResponse) return authorization;
  const matchId = text(request.nextUrl.searchParams.get("match_id"));
  const eventId = text(request.nextUrl.searchParams.get("event_id"));
  const kind = text(request.nextUrl.searchParams.get("kind"));
  if (!UUID_PATTERN.test(matchId) || !UUID_PATTERN.test(eventId) ||
    !["goal", "card"].includes(kind)) return inputError("معرّفات الحدث غير صالحة.");

  try {
    const db = createServiceRoleClient();
    let auditMetadata: Record<string, unknown> = { match_id: matchId, event_type: kind };
    const body = isFullControl ? await request.clone().json().catch(() => ({})) : {};
    const reason = typeof body.reason === "string" && body.reason.trim()
      ? body.reason.trim()
      : "إلغاء حدث من لوحة إدارة المباراة";
    if (kind === "goal") {
      const { data: existing, error: existingError } = await db.from("match_goal_events")
        .select("id, team_roster_id, roster_player_id, match_minute")
        .eq("id", eventId)
        .eq("match_id", matchId)
        .maybeSingle();
      if (existingError) throw existingError;
      if (!existing) return inputError("الحدث لا يتبع المباراة المحددة.", 404);
      if (isFullControl) {
        const { error } = await db.rpc("admin_manage_match_event", {
          p_action: "revoke",
          p_kind: "goal",
          p_event_id: eventId,
          p_match_id: matchId,
          p_actor: authorization.userId,
          p_reason: reason,
        });
        if (error) {
          if (error.message.includes("MATCH_ADMIN_FORBIDDEN")) return inputError("هذه العملية متاحة للمسؤول الرئيسي المخوّل فقط.", 403);
          throw error;
        }
      } else {
        const { data, error } = await db.rpc("revoke_match_goal_event", {
          p_event_id: eventId,
          p_actor: authorization.userId,
        });
        if (error) throw error;
        if (data.match_id !== matchId) throw new Error("Goal event match changed while being revoked.");
      }
      auditMetadata = {
        ...auditMetadata,
        team_roster_id: existing.team_roster_id,
        roster_player_id: existing.roster_player_id,
        minute: existing.match_minute,
      };
    } else {
      const { data: existing, error: existingError } = await db.from("card_events")
        .select("id, source_card_id, team_roster_id, roster_player_id, card_type, match_minute")
        .eq("id", eventId)
        .eq("match_id", matchId)
        .maybeSingle();
      if (existingError) throw existingError;
      if (!existing) return inputError("الحدث غير موجود.", 404);
      if (isFullControl) {
        const { error } = await db.rpc("admin_manage_match_event", {
          p_action: "revoke",
          p_kind: "card",
          p_event_id: eventId,
          p_match_id: matchId,
          p_actor: authorization.userId,
          p_reason: reason,
        });
        if (error) {
          if (error.message.includes("MATCH_ADMIN_FORBIDDEN")) return inputError("هذه العملية متاحة للمسؤول الرئيسي المخوّل فقط.", 403);
          throw error;
        }
      } else {
        if (existing.source_card_id) return inputError("لا يمكن إلغاء حدث بطاقة تاريخي.", 409);
        const { data, error } = await db.from("card_events").delete()
          .eq("id", eventId).eq("match_id", matchId).is("source_card_id", null)
          .select("id").maybeSingle();
        if (error) throw error;
        if (!data) return inputError("تغير الحدث بالتزامن؛ حدّث القائمة.", 409);
      }
      auditMetadata = {
        ...auditMetadata,
        event_type: existing.card_type,
        team_roster_id: existing.team_roster_id,
        roster_player_id: existing.roster_player_id,
        minute: existing.match_minute,
      };
    }

    await auditAdminMutation({
      actorUserId: authorization.userId,
      action: "matches.live.event.revoke",
      permission: isFullControl ? "matches.admin.full_control" : "matches.live.manage",
      entityType: kind === "goal" ? "match_goal_event" : "card_event",
      entityId: eventId,
      metadata: auditMetadata,
      request,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin live event revoke failed:", error);
    return NextResponse.json({ error: "تعذر إلغاء الحدث." }, { status: 500 });
  }
}

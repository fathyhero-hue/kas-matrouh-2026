import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { authorizeAdminRequest } from "@/lib/admin/authorization";
import { auditAdminMutation } from "@/lib/admin/audit";

export const runtime = "nodejs";

function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function bad(message: string) { return NextResponse.json({ error: message }, { status: 400 }); }

export async function GET(req: NextRequest) {
  const auth = await authorizeAdminRequest(req, "stats.goals.manage");
  if (auth instanceof NextResponse) return auth;
  const bracketId = text(req.nextUrl.searchParams.get("bracket_id"));
  if (!bracketId) return bad("bracket_id is required.");
  const db = createServiceRoleClient();
  const query = await db.from("card_events").select("id, bracket_id, match_id, roster_player_id, team_roster_id, card_type, source_card_id, source_card_ordinal, created_at").eq("bracket_id", bracketId).order("created_at");
  if (query.error) {
    console.error("Admin card events GET query error", { bracketId, code: query.error.code });
    return NextResponse.json({ error: "Unable to load card events." }, { status: 500 });
  }
  const rows = query.data || [];
  const playerIds = [...new Set(rows.map((row) => row.roster_player_id))];
  const teamIds = [...new Set(rows.map((row) => row.team_roster_id))];
  const matchIds = [...new Set(rows.map((row) => row.match_id))];
  const [playersQuery, teamsQuery, matchesQuery] = await Promise.all([
    playerIds.length ? db.from("roster_players").select("id, name, roster_id").in("id", playerIds) : Promise.resolve({ data: [], error: null }),
    teamIds.length ? db.from("team_rosters").select("id, team_name").in("id", teamIds) : Promise.resolve({ data: [], error: null }),
    matchIds.length ? db.from("matches").select("id, team_a, team_b, match_date, match_time").in("id", matchIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (playersQuery.error || teamsQuery.error || matchesQuery.error) {
    console.error("Admin card event identity query error", {
      bracketId,
      playerCode: playersQuery.error?.code,
      teamCode: teamsQuery.error?.code,
      matchCode: matchesQuery.error?.code,
    });
    return NextResponse.json({ error: "Unable to resolve card event identity." }, { status: 500 });
  }
  const players = playersQuery.data;
  const teams = teamsQuery.data;
  const matches = matchesQuery.data;
  const playerById = new Map((players || []).map((row) => [row.id, row]));
  const teamById = new Map((teams || []).map((row) => [row.id, row]));
  const matchById = new Map((matches || []).map((row) => [row.id, row]));
  return NextResponse.json({ rows: rows.map((row) => {
    const player = playerById.get(row.roster_player_id);
    return {
      ...row,
      player_name: player && player.roster_id === row.team_roster_id ? player.name || "لاعب غير معروف — يحتاج مراجعة" : "لاعب غير معروف — يحتاج مراجعة",
      team_name: teamById.get(row.team_roster_id)?.team_name || "فريق غير معروف — يحتاج مراجعة",
      match: matchById.get(row.match_id) || null,
    };
  }) });
}

export async function POST(req: NextRequest) {
  const auth = await authorizeAdminRequest(req, "stats.goals.manage");
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json() as Record<string, unknown>;
    const sourceCardId = text(body.source_card_id);
    const db = createServiceRoleClient();
    if (sourceCardId) {
      if (!Array.isArray(body.events)) return bad("Historical event assignments are required.");
      const query = await db.rpc("distribute_card_events", { p_source_card_id: sourceCardId, p_events: body.events, p_actor: auth.userId });
      if (query.error) return NextResponse.json({ error: "Historical card events could not be distributed." }, { status: 400 });
      await auditAdminMutation({ actorUserId: auth.userId, action: "stats.card_event.distribute", permission: "stats.goals.manage", entityType: "card", entityId: sourceCardId, request: req });
      return NextResponse.json({ ok: true, rows: query.data || [] });
    }

    const bracketId = text(body.bracket_id);
    const matchId = text(body.match_id);
    const playerId = text(body.roster_player_id);
    const teamId = text(body.team_roster_id);
    const cardType = text(body.card_type);
    const idempotencyKey = text(body.idempotency_key);
    if (!bracketId || !matchId || !playerId || !teamId || !idempotencyKey || !["yellow", "direct_red"].includes(cardType)) {
      return bad("Card event details and idempotency key are required.");
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
      return bad("Idempotency key must be a UUID.");
    }

    const [{ data: match, error: matchError }, { data: team, error: teamError }, { data: player, error: playerError }] = await Promise.all([
      db.from("matches").select("id, bracket_id, team_a, team_b").eq("id", matchId).maybeSingle(),
      db.from("team_rosters").select("id, bracket_id, team_name").eq("id", teamId).maybeSingle(),
      db.from("roster_players").select("id, roster_id").eq("id", playerId).maybeSingle(),
    ]);
    if (matchError) throw matchError;
    if (teamError) throw teamError;
    if (playerError) throw playerError;
    if (!match || match.bracket_id !== bracketId) return bad("Match is not in the selected tournament.");
    if (!team || team.bracket_id !== bracketId || !team.team_name || ![match.team_a, match.team_b].includes(team.team_name)) return bad("Team does not participate in this match.");
    if (!player || player.roster_id !== team.id) return bad("Player does not belong to the selected team.");

    const query = await db.rpc("create_card_event", {
      p_bracket_id: bracketId,
      p_match_id: matchId,
      p_roster_player_id: playerId,
      p_team_roster_id: teamId,
      p_card_type: cardType,
      p_idempotency_key: idempotencyKey,
      p_actor: auth.userId,
    });
    if (query.error) {
      if (query.error.message.includes("IDEMPOTENCY_KEY_PAYLOAD_MISMATCH")) return bad("Idempotency key was already used for a different card event.");
      if (query.error.message.includes("IDEMPOTENCY_EVENT_ALREADY_DELETED")) return NextResponse.json({ error: "This idempotency key belongs to a deleted card event." }, { status: 409 });
      throw query.error;
    }
    const row = query.data;
    await auditAdminMutation({ actorUserId: auth.userId, action: "stats.card_event.create", permission: "stats.goals.manage", entityType: "card_event", entityId: row.id, request: req });
    return NextResponse.json({ ok: true, row });
  } catch (error) {
    console.error("Admin card event save error:", error);
    return NextResponse.json({ error: "Card event could not be saved." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await authorizeAdminRequest(req, "stats.goals.manage");
  if (auth instanceof NextResponse) return auth;
  const id = text(req.nextUrl.searchParams.get("id"));
  if (!id) return bad("Card event ID is required.");
  const db = createServiceRoleClient();
  const existing = await db.from("card_events").select("id, source_card_id").eq("id", id).maybeSingle();
  if (existing.error) return NextResponse.json({ error: "Unable to verify card event." }, { status: 500 });
  if (!existing.data) return NextResponse.json({ error: "Card event not found." }, { status: 404 });
  if (existing.data.source_card_id) return bad("Historical card events cannot be deleted.");
  const query = await db.from("card_events").delete().eq("id", id);
  if (query.error) return NextResponse.json({ error: "Card event could not be deleted." }, { status: 500 });
  await auditAdminMutation({ actorUserId: auth.userId, action: "stats.card_event.delete", permission: "stats.goals.manage", entityType: "card_event", entityId: id, request: req });
  return NextResponse.json({ ok: true });
}

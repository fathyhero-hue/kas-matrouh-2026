import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { authorizeAdminRequest } from "@/lib/admin/authorization";
import { auditAdminMutation } from "@/lib/admin/audit";
import { pickAllowedFields } from "@/lib/admin/fields";
import { validateStatsPlayerSelection } from "@/lib/sport/stats-player";

export const runtime = "nodejs";

const ALLOWED_TABLES = new Set(["goals", "cards", "motm"]);
const IDENTITY_TABLES = new Set(["goals", "cards"]);

class StatsInputError extends Error {
  status = 400;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(req: NextRequest) {
  const authorization = await authorizeAdminRequest(req, "stats.goals.manage");
  if (authorization instanceof NextResponse) return authorization;
  const table = stringValue(req.nextUrl.searchParams.get("table"));
  const bracketId = stringValue(req.nextUrl.searchParams.get("bracket_id"));
  if (!ALLOWED_TABLES.has(table)) return NextResponse.json({ error: "Unsupported stats table." }, { status: 400 });
  if (!bracketId) return NextResponse.json({ error: "bracket_id is required." }, { status: 400 });
  const db = createServiceRoleClient();
  const query = await db.from(table).select("*").eq("bracket_id", bracketId);
  if (query.error) return NextResponse.json({ error: "Unable to load stats entries." }, { status: 500 });
  return NextResponse.json({ rows: query.data || [] });
}

async function resolvePlayerIdentity(supabase: ReturnType<typeof createServiceRoleClient>, body: Record<string, unknown>, bracketId: string) {
  const rosterPlayerId = stringValue(body.roster_player_id);
  const teamRosterId = stringValue(body.team_roster_id);
  if (!rosterPlayerId || !teamRosterId) {
    throw new StatsInputError("يجب اختيار لاعب وقائمة فريق صحيحة.");
  }

  const [{ data: roster, error: rosterError }, { data: player, error: playerError }] = await Promise.all([
    supabase.from("team_rosters").select("id, bracket_id, team_name").eq("id", teamRosterId).maybeSingle(),
    supabase.from("roster_players").select("id, roster_id, name").eq("id", rosterPlayerId).maybeSingle(),
  ]);
  if (rosterError) throw rosterError;
  if (playerError) throw playerError;
  const validation = validateStatsPlayerSelection({ bracketId, roster, player });
  if (!validation.ok) throw new StatsInputError(validation.error);

  return {
    roster_player_id: rosterPlayerId,
    team_roster_id: teamRosterId,
    player: validation.playerName,
    team: validation.teamName,
  };
}

async function validateCardMatch(supabase: ReturnType<typeof createServiceRoleClient>, body: Record<string, unknown>, bracketId: string, teamName: string) {
  const matchId = stringValue(body.match_id);
  if (!matchId) throw new StatsInputError("يجب اختيار المباراة المرتبطة بالبطاقة.");
  const { data: match, error } = await supabase.from("matches").select("id, bracket_id, team_a, team_b").eq("id", matchId).maybeSingle();
  if (error) throw error;
  if (!match || match.bracket_id !== bracketId) throw new StatsInputError("المباراة غير موجودة في هذه البطولة.");
  const teamKey = teamName.trim();
  if (match.team_a !== teamKey && match.team_b !== teamKey) throw new StatsInputError("المباراة لا تخص فريق اللاعب.");
  return matchId;
}

export async function POST(req: NextRequest) {
  const authorization = await authorizeAdminRequest(req, 'stats.goals.manage');
  if (authorization instanceof NextResponse) return authorization;
  try {
    const body = await req.json() as Record<string, unknown>;
    const table = String(body.table || "");
    if (!ALLOWED_TABLES.has(table)) return NextResponse.json({ error: "جدول غير مسموح." }, { status: 400 });
    const id = stringValue(body.id) || null;
    const supabase = createServiceRoleClient();

    if (IDENTITY_TABLES.has(table)) {
      const existing = id
        ? await supabase.from(table).select("id, bracket_id, match_id, roster_player_id, team_roster_id, player, team").eq("id", id).maybeSingle()
        : { data: null, error: null };
      if (existing.error) throw existing.error;
      if (id && !existing.data) throw new StatsInputError("السجل المطلوب غير موجود.");
      const existingRow = existing.data as { bracket_id?: string | null } | null;

      const bracketId = id ? stringValue(existingRow?.bracket_id) : stringValue(body.bracket_id);
      if (!bracketId) throw new StatsInputError("معرّف البطولة مفقود.");
      const patch: Record<string, unknown> = {};
      const identityRequested = ["roster_player_id", "team_roster_id", "player_name", "team_name"].some((key) => Object.prototype.hasOwnProperty.call(body, key));
      if (!id) {
        if (!Object.prototype.hasOwnProperty.call(body, "bracket_id")) throw new StatsInputError("معرّف البطولة مفقود.");
        patch.bracket_id = bracketId;
      }
      if (identityRequested || !id) Object.assign(patch, await resolvePlayerIdentity(supabase, body, bracketId));
      if (table === "cards") {
        const identity = patch.team as string || String((existingRow as { team?: string } | null)?.team || "");
        patch.match_id = await validateCardMatch(supabase, body, bracketId, identity);
      }

      if (table === "goals") {
        if (body.goals !== undefined) patch.goals = Number(body.goals) || 0;
        if (body.image_url !== undefined) patch.image_url = stringValue(body.image_url);
      } else {
        if (body.yellow !== undefined) patch.yellow = Number(body.yellow) || 0;
        if (body.red !== undefined) patch.red = Number(body.red) || 0;
      }
      if (!Object.keys(patch).length) throw new StatsInputError("لا توجد تغييرات صالحة.");
      const query = id
        ? await supabase.from(table).update(patch).eq("id", id).select().single()
        : await supabase.from(table).insert(patch).select().single();
      if (query.error) throw query.error;
      await auditAdminMutation({ actorUserId: authorization.userId, action: "stats.mutation", permission: "stats.goals.manage", entityType: "stats", request: req });
      return NextResponse.json({ ok: true, row: query.data });
    }

    const fieldsByTable: Record<string, readonly string[]> = { motm: ["player", "team", "match_name", "votes", "bracket_id", "image_url"] };
    const patch = pickAllowedFields(body, fieldsByTable[table] || []);
    const query = id
      ? await supabase.from(table).update(patch).eq("id", id).select().single()
      : await supabase.from(table).insert(patch).select().single();

    if (query.error) throw query.error;
    await auditAdminMutation({ actorUserId: authorization.userId, action: "stats.mutation", permission: "stats.goals.manage", entityType: "stats", request: req });
    return NextResponse.json({ ok: true, row: query.data });
  } catch (error: unknown) {
    console.error("Admin stats entry save error:", error);
    return NextResponse.json({ error: errorMessage(error, "فشل الحفظ.") }, { status: error instanceof StatsInputError ? error.status : 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const authorization = await authorizeAdminRequest(req, 'stats.goals.manage');
  if (authorization instanceof NextResponse) return authorization;
  try {
    const table = req.nextUrl.searchParams.get("table") || "";
    const id = req.nextUrl.searchParams.get("id");
    if (!ALLOWED_TABLES.has(table)) return NextResponse.json({ error: "جدول غير مسموح." }, { status: 400 });
    if (!id) return NextResponse.json({ error: "معرّف مفقود." }, { status: 400 });
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) throw error;
    await auditAdminMutation({ actorUserId: authorization.userId, action: "stats.mutation", permission: "stats.goals.manage", entityType: "stats", request: req });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error("Admin stats entry delete error:", error);
    return NextResponse.json({ error: errorMessage(error, "فشل الحذف.") }, { status: 500 });
  }
}

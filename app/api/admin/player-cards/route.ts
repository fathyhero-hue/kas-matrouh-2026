import { NextRequest, NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/authorization";
import { auditAdminMutation } from "@/lib/admin/audit";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { createCardNumber, getElitePlayerCardContext, getRosterPlayerCardContext, PLAYER_CARDS_PERMISSION } from "@/lib/player-cards/data";

export const runtime = "nodejs";

async function createCardForPlayer(
  supabase: ReturnType<typeof createServiceRoleClient>,
  actorUserId: string,
  playerId: string,
  teamRosterId: string,
) {
  const [{ data: player, error: playerError }, { data: roster, error: rosterError }] = await Promise.all([
    supabase.from("roster_players").select("id, roster_id, name").eq("id", playerId).eq("roster_id", teamRosterId).maybeSingle(),
    supabase.from("team_rosters").select("id, bracket_id, team_slug").eq("id", teamRosterId).maybeSingle(),
  ]);
  if (playerError) throw playerError;
  if (rosterError) throw rosterError;
  if (!player || !roster || !String(player.name || "").trim()) {
    throw new Error("اللاعب أو القائمة غير صالحين.");
  }

  const { data: existing, error: existingError } = await supabase
    .from("player_cards")
    .select("id, roster_player_id, team_roster_id, bracket_id, player_registration_id, card_number, status, template_key, template_version, display_overrides")
    .eq("roster_player_id", playerId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return { card: existing, created: false };

  const { data: card, error: insertError } = await supabase
    .from("player_cards")
    .insert({
      roster_player_id: playerId,
      team_roster_id: teamRosterId,
      bracket_id: roster.bracket_id,
      card_number: createCardNumber(),
      status: "ready",
      template_key: "player-card-v1",
      template_version: 1,
      display_overrides: {},
      created_by: actorUserId,
      updated_by: actorUserId,
    })
    .select("id, roster_player_id, team_roster_id, bracket_id, player_registration_id, card_number, status, template_key, template_version, display_overrides")
    .single();

  if (insertError?.code === "23505") {
    const { data: concurrent } = await supabase
      .from("player_cards")
      .select("id, roster_player_id, team_roster_id, bracket_id, player_registration_id, card_number, status, template_key, template_version, display_overrides")
      .eq("roster_player_id", playerId)
      .maybeSingle();
    if (concurrent) return { card: concurrent, created: false };
  }
  if (insertError) throw insertError;
  return { card, created: true };
}

export async function GET(request: NextRequest) {
  const authorization = await authorizeAdminRequest(request, PLAYER_CARDS_PERMISSION);
  if (authorization instanceof NextResponse) return authorization;

  try {
    const supabase = createServiceRoleClient();
    const tournament = request.nextUrl.searchParams.get("tournament") || "elite-cup";
    if (tournament === "elite-cup") {
      return NextResponse.json({ ok: true, teams: await getElitePlayerCardContext(supabase) });
    }

    const bracketId = request.nextUrl.searchParams.get("bracketId");
    if (!bracketId) return NextResponse.json({ error: "معرّف البطولة مطلوب." }, { status: 400 });
    return NextResponse.json({ ok: true, teams: await getRosterPlayerCardContext(supabase, bracketId) });
  } catch (error) {
    console.error("[player-cards] list failed", { message: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: "تعذر تحميل بطاقات اللاعبين." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authorization = await authorizeAdminRequest(request, PLAYER_CARDS_PERMISSION);
  if (authorization instanceof NextResponse) return authorization;

  try {
    const body = await request.json() as Record<string, unknown>;
    const action = body.action === "bulk_create" ? "bulk_create" : "create";
    const teamRosterId = typeof body.teamRosterId === "string" ? body.teamRosterId : "";
    if (!teamRosterId) return NextResponse.json({ error: "معرّف قائمة الفريق مطلوب." }, { status: 400 });

    const supabase = createServiceRoleClient();
    if (action === "create") {
      const playerId = typeof body.playerId === "string" ? body.playerId : "";
      if (!playerId) return NextResponse.json({ error: "معرّف اللاعب مطلوب." }, { status: 400 });
      const result = await createCardForPlayer(supabase, authorization.userId, playerId, teamRosterId);
      if (result.created) {
        await auditAdminMutation({
          actorUserId: authorization.userId,
          action: "player_cards.create",
          permission: PLAYER_CARDS_PERMISSION,
          entityType: "player_cards",
          entityId: result.card.id,
          metadata: { changed_fields: ["card_number"], team_slug: teamRosterId },
          request,
        });
      }
      return NextResponse.json({ ok: true, card: result.card, created: result.created });
    }

    const playerIds = Array.isArray(body.playerIds) ? body.playerIds.filter((value): value is string => typeof value === "string") : [];
    if (playerIds.length === 0 || playerIds.length > 100) return NextResponse.json({ error: "حدد لاعبًا واحدًا على الأقل وبحد أقصى 100 لاعب." }, { status: 400 });
    const results = [];
    for (const playerId of [...new Set(playerIds)]) {
      results.push(await createCardForPlayer(supabase, authorization.userId, playerId, teamRosterId));
    }
    const createdCards = results.filter((result) => result.created).map((result) => result.card);
    if (createdCards.length > 0) {
      await auditAdminMutation({
        actorUserId: authorization.userId,
        action: "player_cards.bulk_create",
        permission: PLAYER_CARDS_PERMISSION,
        entityType: "player_cards",
        metadata: { changed_fields: ["card_number"], team_slug: teamRosterId },
        request,
      });
    }
    return NextResponse.json({ ok: true, cards: results.map((result) => result.card), createdCount: createdCards.length });
  } catch (error) {
    console.error("[player-cards] create failed", { message: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: "تعذر إنشاء بطاقة اللاعب." }, { status: 500 });
  }
}

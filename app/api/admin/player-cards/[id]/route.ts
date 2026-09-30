import { NextRequest, NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/authorization";
import { auditAdminMutation } from "@/lib/admin/audit";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { PLAYER_CARDS_PERMISSION } from "@/lib/player-cards/data";

export const runtime = "nodejs";

function parseOverrides(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const output: Record<string, number> = {};
  for (const key of ["cropX", "cropY", "zoom"]) {
    if (input[key] === undefined) continue;
    const number = Number(input[key]);
    if (!Number.isFinite(number)) return null;
    if (key === "zoom" && (number < 1 || number > 2)) return null;
    if (key !== "zoom" && (number < 0 || number > 100)) return null;
    output[key] = number;
  }
  return output;
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const authorization = await authorizeAdminRequest(request, PLAYER_CARDS_PERMISSION);
  if (authorization instanceof NextResponse) return authorization;
  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: "معرّف البطاقة مطلوب." }, { status: 400 });

  try {
    const body = await request.json() as Record<string, unknown>;
    const displayOverrides = parseOverrides(body.display_overrides);
    if (!displayOverrides) return NextResponse.json({ error: "إعدادات العرض غير صالحة." }, { status: 400 });
    const { data, error } = await createServiceRoleClient()
      .from("player_cards")
      .update({ display_overrides: displayOverrides, updated_by: authorization.userId, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, roster_player_id, team_roster_id, bracket_id, player_registration_id, card_number, status, template_key, template_version, display_overrides")
      .single();
    if (error) throw error;
    await auditAdminMutation({
      actorUserId: authorization.userId,
      action: "player_cards.update",
      permission: PLAYER_CARDS_PERMISSION,
      entityType: "player_cards",
      entityId: id,
      metadata: { changed_fields: Object.keys(displayOverrides) },
      request,
    });
    return NextResponse.json({ ok: true, card: data });
  } catch (error) {
    console.error("[player-cards] update failed", { message: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: "تعذر حفظ تعديلات البطاقة." }, { status: 500 });
  }
}

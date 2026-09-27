import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { authorizeAdminRequest } from "@/lib/admin/authorization";
import { auditAdminMutation } from "@/lib/admin/audit";
import { pickAllowedFields } from "@/lib/admin/fields";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const authorization = await authorizeAdminRequest(req, 'rosters.edit');
  if (authorization instanceof NextResponse) return authorization;
  try {
    const body = await req.json();
    const id = body.id;
    const players = body.players;
    const patch = pickAllowedFields(body, ["team_name", "manager_name", "coach_name", "logo_url", "bracket_id", "tournament", "is_submitted", "submitted_at", "notes"]);
    const supabase = createServiceRoleClient();

    let rosterId = id as string | undefined;
    let roster;
    if (rosterId) {
      const { data, error } = await supabase.from("team_rosters").update(patch).eq("id", rosterId).select().single();
      if (error) throw error;
      roster = data;
    } else {
      const { data, error } = await supabase.from("team_rosters").insert(patch).select().single();
      if (error) throw error;
      roster = data;
      rosterId = data.id;
    }

    let playerIds: string[] = [];
    if (Array.isArray(players)) {
      // Update existing rows in place by slot instead of delete+reinsert, so
      // player ids stay stable across saves — otherwise any photo already
      // uploaded via /api/roster/upload-photo (keyed by player id) would get
      // orphaned the next time the admin saves the roster.
      const { data: existingPlayers } = await supabase.from("roster_players").select("id, slot_index").eq("roster_id", rosterId);
      const existingBySlot = new Map((existingPlayers || []).map((p: any) => [p.slot_index, p.id as string]));

      for (let i = 0; i < players.length; i++) {
        const p = players[i];
        const patch = { name: p.name || "", number: p.number || "", personal_image_url: p.personal_image_url || "", id_image_url: p.id_image_url || "" };
        const existingId = existingBySlot.get(i);
        if (existingId) {
          await supabase.from("roster_players").update(patch).eq("id", existingId);
          playerIds.push(existingId);
        } else {
          const { data: inserted } = await supabase.from("roster_players").insert({ roster_id: rosterId, slot_index: i, ...patch }).select("id").single();
          playerIds.push(inserted?.id as string);
        }
      }

      const extraIds = [...existingBySlot.entries()].filter(([slot]) => slot >= players.length).map(([, id]) => id);
      if (extraIds.length) await supabase.from("roster_players").delete().in("id", extraIds);
    }

    await auditAdminMutation({ actorUserId: authorization.userId, action: "rosters.mutation", permission: "rosters.edit", entityType: "rosters", request: req });
    return NextResponse.json({ ok: true, roster, playerIds });
  } catch (error: any) {
    console.error("Admin roster save error:", error);
    return NextResponse.json({ error: error?.message || "فشل حفظ القائمة." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const authorization = await authorizeAdminRequest(req, 'rosters.delete');
  if (authorization instanceof NextResponse) return authorization;
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "معرّف الفريق مفقود." }, { status: 400 });
    const supabase = createServiceRoleClient();
    await supabase.from("roster_players").delete().eq("roster_id", id);
    const { error } = await supabase.from("team_rosters").delete().eq("id", id);
    if (error) throw error;
    await auditAdminMutation({ actorUserId: authorization.userId, action: "rosters.mutation", permission: "rosters.edit", entityType: "rosters", request: req });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Admin roster delete error:", error);
    return NextResponse.json({ error: error?.message || "فشل حذف الفريق." }, { status: 500 });
  }
}

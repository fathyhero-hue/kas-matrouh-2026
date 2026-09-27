import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { authorizeAdminRequest } from "@/lib/admin/authorization";
import { auditAdminMutation } from "@/lib/admin/audit";
import { pickAllowedFields } from "@/lib/admin/fields";

export const runtime = "nodejs";

const ALLOWED_TABLES = new Set(["goals", "cards", "motm"]);

export async function POST(req: NextRequest) {
  const authorization = await authorizeAdminRequest(req, 'stats.goals.manage');
  if (authorization instanceof NextResponse) return authorization;
  try {
    const body = await req.json() as Record<string, unknown>;
    const table = String(body.table || "");
    const id = body.id;
    const fieldsByTable: Record<string, readonly string[]> = { goals: ["player_name", "team_name", "goals", "bracket_id", "image_url"], cards: ["player_name", "team_name", "yellow", "red", "bracket_id", "image_url"], motm: ["player_name", "team_name", "votes", "bracket_id", "image_url"] };
    const patch = pickAllowedFields(body, fieldsByTable[table] || []);
    if (!ALLOWED_TABLES.has(table)) return NextResponse.json({ error: "جدول غير مسموح." }, { status: 400 });
    const supabase = createServiceRoleClient();

    const query = id
      ? await supabase.from(table).update(patch).eq("id", id).select().single()
      : await supabase.from(table).insert(patch).select().single();

    if (query.error) throw query.error;
    await auditAdminMutation({ actorUserId: authorization.userId, action: "stats.mutation", permission: "stats.goals.manage", entityType: "stats", request: req });
    return NextResponse.json({ ok: true, row: query.data });
  } catch (error: any) {
    console.error("Admin stats entry save error:", error);
    return NextResponse.json({ error: error?.message || "فشل الحفظ." }, { status: 500 });
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
  } catch (error: any) {
    console.error("Admin stats entry delete error:", error);
    return NextResponse.json({ error: error?.message || "فشل الحذف." }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { authorizeAdminRequest } from "@/lib/admin/authorization";
import { auditAdminMutation } from "@/lib/admin/audit";
import { pickAllowedFields } from "@/lib/admin/fields";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const authorization = await authorizeAdminRequest(req, 'matches.edit');
  if (authorization instanceof NextResponse) return authorization;
  try {
    const body = await req.json();
    const id = body.id;
    const patch = pickAllowedFields(body, ["team_a", "team_b", "match_date", "match_time", "venue", "status", "is_live", "score_a", "score_b", "bracket_id", "group_name", "round", "notes"]);
    const supabase = createServiceRoleClient();

    if (id) {
      const { data, error } = await supabase.from("matches").update(patch).eq("id", id).select().single();
      if (error) throw error;
      await auditAdminMutation({ actorUserId: authorization.userId, action: "matches.mutation", permission: "matches.edit", entityType: "matches", request: req });
    return NextResponse.json({ ok: true, match: data });
    }

    if (!String(patch.team_a || "").trim() || !String(patch.team_b || "").trim()) {
      return NextResponse.json({ error: "يجب إدخال أسماء الفرق." }, { status: 400 });
    }
    const { data, error } = await supabase.from("matches").insert(patch).select().single();
    if (error) throw error;
    await auditAdminMutation({ actorUserId: authorization.userId, action: "matches.mutation", permission: "matches.edit", entityType: "matches", request: req });
    return NextResponse.json({ ok: true, match: data });
  } catch (error: any) {
    console.error("Admin match save error:", error);
    return NextResponse.json({ error: error?.message || "فشل حفظ المباراة." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const authorization = await authorizeAdminRequest(req, 'matches.delete');
  if (authorization instanceof NextResponse) return authorization;
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "معرّف المباراة مفقود." }, { status: 400 });
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from("matches").delete().eq("id", id);
    if (error) throw error;
    await auditAdminMutation({ actorUserId: authorization.userId, action: "matches.mutation", permission: "matches.edit", entityType: "matches", request: req });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Admin match delete error:", error);
    return NextResponse.json({ error: error?.message || "فشل حذف المباراة." }, { status: 500 });
  }
}

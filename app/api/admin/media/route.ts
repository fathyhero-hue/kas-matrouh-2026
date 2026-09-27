import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { authorizeAdminRequest } from "@/lib/admin/authorization";
import { auditAdminMutation } from "@/lib/admin/audit";
import { pickAllowedFields } from "@/lib/admin/fields";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const authorization = await authorizeAdminRequest(req, 'content.edit');
  if (authorization instanceof NextResponse) return authorization;
  try {
    const body = await req.json() as Record<string, unknown>;
    const id = body.id;
    const patch = pickAllowedFields(body, ["title", "body", "image_url", "category", "published", "published_at"]);
    const supabase = createServiceRoleClient();
    const query = id
      ? await supabase.from("media").update(patch).eq("id", id).select().single()
      : await supabase.from("media").insert(patch).select().single();
    if (query.error) throw query.error;
    await auditAdminMutation({ actorUserId: authorization.userId, action: "media.mutation", permission: "content.edit", entityType: "media", request: req });
    return NextResponse.json({ ok: true, row: query.data });
  } catch (error: any) {
    console.error("Admin media save error:", error);
    return NextResponse.json({ error: error?.message || "فشل الحفظ." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const authorization = await authorizeAdminRequest(req, 'content.delete');
  if (authorization instanceof NextResponse) return authorization;
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "معرّف مفقود." }, { status: 400 });
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from("media").delete().eq("id", id);
    if (error) throw error;
    await auditAdminMutation({ actorUserId: authorization.userId, action: "media.mutation", permission: "content.edit", entityType: "media", request: req });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Admin media delete error:", error);
    return NextResponse.json({ error: error?.message || "فشل الحذف." }, { status: 500 });
  }
}

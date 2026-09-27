import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { authorizeAdminRequest } from "@/lib/admin/authorization";
import { auditAdminMutation } from "@/lib/admin/audit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const authorization = await authorizeAdminRequest(req, 'content.edit');
  if (authorization instanceof NextResponse) return authorization;
  try {
    const { text } = await req.json();
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from("app_settings").upsert({ key: "ticker", value: { text: text || "" }, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) throw error;
    await auditAdminMutation({ actorUserId: authorization.userId, action: "app_settings.mutation", permission: "content.edit", entityType: "app_settings", request: req });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Admin ticker save error:", error);
    return NextResponse.json({ error: error?.message || "فشل الحفظ." }, { status: 500 });
  }
}

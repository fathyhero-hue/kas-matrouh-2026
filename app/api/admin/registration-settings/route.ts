import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { authorizeAdminRequest } from "@/lib/admin/authorization";
import { auditAdminMutation } from "@/lib/admin/audit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const authorization = await authorizeAdminRequest(req, 'settings.manage');
  if (authorization instanceof NextResponse) return authorization;
  try {
    const { tournament, deadline, password, price } = await req.json();
    if (!tournament) return NextResponse.json({ error: "بطولة غير معروفة." }, { status: 400 });
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("registration_settings")
      .upsert({ tournament, deadline, password, price }, { onConflict: "tournament" })
      .select()
      .single();
    if (error) throw error;
    await auditAdminMutation({ actorUserId: authorization.userId, action: "registration_settings.mutation", permission: "settings.manage", entityType: "registration_settings", request: req });
    return NextResponse.json({ ok: true, settings: data });
  } catch (error: any) {
    console.error("Admin registration settings save error:", error);
    return NextResponse.json({ error: error?.message || "فشل حفظ الإعدادات." }, { status: 500 });
  }
}

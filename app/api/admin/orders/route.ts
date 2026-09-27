import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { authorizeAdminRequest } from "@/lib/admin/authorization";
import { auditAdminMutation } from "@/lib/admin/audit";
import { pickAllowedFields } from "@/lib/admin/fields";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest) {
  const authorization = await authorizeAdminRequest(req, 'shop.orders.financial.manage');
  if (authorization instanceof NextResponse) return authorization;
  try {
    const body = await req.json() as Record<string, unknown>;
    const id = body.id;
    const patch = pickAllowedFields(body, ["payment_status", "status_label", "roster_access_active", "admin_manual_access"]);
    if (!id) return NextResponse.json({ error: "معرّف الطلب مفقود." }, { status: 400 });
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.from("orders").update(patch).eq("id", id).select().single();
    if (error) throw error;
    await auditAdminMutation({ actorUserId: authorization.userId, action: "orders.mutation", permission: "shop.orders.financial.manage", entityType: "orders", request: req });
    return NextResponse.json({ ok: true, order: data });
  } catch (error: any) {
    console.error("Admin order update error:", error);
    return NextResponse.json({ error: error?.message || "فشل تحديث الطلب." }, { status: 500 });
  }
}

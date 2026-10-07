import { NextRequest, NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/authorization";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { auditDisplayMetadata } from "@/lib/admin/audit-display";
import { getAuditActionLabel, getAuditResourceLabel } from "@/lib/admin/audit-labels";
import { failure, validId } from "@/lib/admin/management";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await authorizeAdminRequest(req, "audit.view");
  if (auth instanceof NextResponse) return auth;

  const params = req.nextUrl.searchParams;
  const page = Number(params.get("page") ?? 1);
  const actor = params.get("actor") ?? "";
  const action = params.get("action") ?? "";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) &&
    new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;

  if (!Number.isInteger(page) || page < 1 || page > 100000 ||
    (actor && !validId(actor)) ||
    (action && !/^[a-z][a-z0-9_.]{0,99}$/.test(action)) ||
    (from && !validDate(from)) || (to && !validDate(to)) ||
    (from && to && from > to)) return failure("فلاتر غير صالحة.");

  const db = createServiceRoleClient();
  let query = db.from("admin_audit_logs").select("id,actor_user_id,action,entity_type,entity_id,metadata,created_at", { count: "exact" });
  if (actor) query = query.eq("actor_user_id", actor);
  if (action) query = query.eq("action", action);
  if (from) query = query.gte("created_at", `${from}T00:00:00Z`);
  if (to) query = query.lt("created_at", new Date(Date.parse(`${to}T00:00:00Z`) + 86400000).toISOString());

  const result = await query.order("created_at", { ascending: false }).order("id", { ascending: false }).range((page - 1) * 25, page * 25 - 1);
  if (result.error) return failure("تعذر تحميل سجل النشاط.", 503);

  const actorIds = [...new Set((result.data ?? []).flatMap(row => row.actor_user_id ? [row.actor_user_id] : []))];
  const actors = actorIds.length ? await db.from("admin_profiles").select("user_id,display_name").in("user_id", actorIds) : { data: [], error: null };
  if (actors.error) return failure("تعذر تحميل أسماء المسؤولين.", 503);

  return NextResponse.json({
    page,
    total: result.count ?? 0,
    pageSize: 25,
    logs: (result.data ?? []).map(row => ({
      ...row,
      actor_name: actors.data?.find(a => a.user_id === row.actor_user_id)?.display_name ?? "مسؤول غير معروف",
      action_label: getAuditActionLabel(row.action),
      resource_label: getAuditResourceLabel(row.entity_type),
      metadata: auditDisplayMetadata(row.metadata),
    })),
  });
}

import { NextRequest, NextResponse } from "next/server";
import { isAdminRole } from "@/lib/admin/permissions";
import { atomicMutation, authorizeManagement, details, failure, readBody, validId } from "@/lib/admin/management";
type Context = { params: Promise<{ userId: string }> };
export const runtime = "nodejs";
export async function GET(req: NextRequest, context: Context) {
  const auth = await authorizeManagement(req, "admins.view");
  if (auth instanceof NextResponse) return auth;
  const { userId } = await context.params;
  if (!validId(userId)) return failure("معرف غير صالح.");
  try {
    const result = await details(userId);
    return result ? NextResponse.json(result) : failure("المسؤول غير موجود.", 404);
  } catch { return failure("تعذر تحميل التفاصيل.", 503); }
}
export async function PATCH(req: NextRequest, context: Context) {
  const body = await readBody(req);
  const auth = await authorizeManagement(req, body && "is_active" in body ? "admins.disable" : "admins.edit", true);
  if (auth instanceof NextResponse) return auth;
  const { userId } = await context.params;
  if (!validId(userId) || !body || !Object.keys(body).length || Object.keys(body).some(key => !["display_name", "role_key", "is_active"].includes(key))) return failure("بيانات غير صالحة.");
  if (("display_name" in body || "role_key" in body) && !auth.permissions.has("admins.edit")) return failure("غير مسموح بتعديل الحساب.", 403);
  if ("display_name" in body && (typeof body.display_name !== "string" || !body.display_name.trim() || body.display_name.trim().length > 100)) return failure("الاسم غير صالح.");
  if ("role_key" in body && !isAdminRole(body.role_key)) return failure("الدور غير صالح.");
  if ("is_active" in body && typeof body.is_active !== "boolean") return failure("الحالة غير صالحة.");
  if (userId === auth.userId && (body.is_active === false || ("role_key" in body && body.role_key !== "super_admin"))) return failure("لا يمكنك تعطيل نفسك أو خفض دورك.", 409);
  return atomicMutation(auth, userId, body);
}

import { NextRequest, NextResponse } from "next/server";
import { isAdminPermission } from "@/lib/admin/permissions";
import { atomicMutation, authorizeManagement, criticalPermissions, failure, readBody, validId } from "@/lib/admin/management";
export async function PATCH(req: NextRequest, context: { params: Promise<{ userId: string }> }) {
  const auth = await authorizeManagement(req, "admins.permissions.manage", true);
  if (auth instanceof NextResponse) return auth;
  const { userId } = await context.params;
  const body = await readBody(req);
  if (!validId(userId) || !body || Object.keys(body).some(k => !["permission_key", "effect"].includes(k)) || !isAdminPermission(body.permission_key) || !["allow", "deny", "inherit"].includes(String(body.effect))) return failure("بيانات الصلاحية غير صالحة.");
  if (userId === auth.userId && body.effect === "deny" && criticalPermissions.includes(body.permission_key)) return failure("لا يمكنك منع صلاحيات إدارة حسابك.", 409);
  return atomicMutation(auth, userId, {}, body.permission_key, String(body.effect));
}

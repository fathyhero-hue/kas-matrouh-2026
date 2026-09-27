import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { authorizeAdminRequest, resolvePermissions, type AdminAuthorizationContext } from "@/lib/admin/authorization";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { ADMIN_PERMISSIONS, isAdminRole, type AdminPermission } from "@/lib/admin/permissions";

export const profileFields = "user_id,display_name,role_key,is_active,created_at,last_login_at";
export const criticalPermissions: readonly AdminPermission[] = ["admins.view", "admins.create", "admins.edit", "admins.disable", "admins.permissions.manage", "admins.reset_password"];
export const failure = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
export const validId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
export async function readBody(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await req.json();
    return body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : null;
  } catch { return null; }
}
export async function authorizeManagement(req: NextRequest, permission: AdminPermission, mutation = false) {
  const authorization = await authorizeAdminRequest(req, permission);
  if (authorization instanceof NextResponse) return authorization;
  // Account writes stay reserved to super admins, including when a supervisor
  // accidentally receives an administrative ALLOW override.
  if (mutation && authorization.role !== "super_admin") return failure("إدارة الحسابات متاحة للمدير العام فقط.", 403);
  const origin = req.headers.get("origin");
  if (mutation && origin && origin !== req.nextUrl.origin) return failure("مصدر الطلب غير مسموح.", 403);
  return authorization;
}
export async function catalog(db = createServiceRoleClient()) {
  const [roles, permissions, rolePermissions] = await Promise.all([
    db.from("admin_roles").select("key,name").order("created_at"),
    db.from("admin_permissions").select("key,name").order("key"),
    db.from("admin_role_permissions").select("role_key,permission_key"),
  ]);
  if (roles.error || permissions.error || rolePermissions.error) throw new Error("CATALOG_UNAVAILABLE");
  return { roles: roles.data ?? [], permissions: permissions.data ?? [], rolePermissions: rolePermissions.data ?? [] };
}
export async function details(userId: string, db = createServiceRoleClient()) {
  const [profile, auth, overrides, catalogs] = await Promise.all([
    db.from("admin_profiles").select(profileFields).eq("user_id", userId).maybeSingle(),
    db.auth.admin.getUserById(userId),
    db.from("admin_permission_overrides").select("permission_key,effect").eq("user_id", userId),
    catalog(db),
  ]);
  if (profile.error || auth.error || overrides.error) throw new Error("DETAILS_UNAVAILABLE");
  if (!profile.data || !auth.data.user || !isAdminRole(profile.data.role_key)) return null;
  const role = profile.data.role_key;
  const roleRows = catalogs.rolePermissions.filter(row => row.role_key === role);
  const effective = resolvePermissions(role, roleRows, overrides.data ?? []);
  const baseline = role === "super_admin" ? [...ADMIN_PERMISSIONS] : roleRows.map(row => row.permission_key);
  return { admin: { ...profile.data, email: auth.data.user.email ?? null, last_sign_in_at: auth.data.user.last_sign_in_at ?? null }, overrides: overrides.data ?? [], effectivePermissions: [...effective], baseline, ...catalogs };
}
export async function atomicMutation(authorization: AdminAuthorizationContext, userId: string, patch: Record<string, unknown>, permission: string | null = null, effect: string | null = null) {
  const { data, error } = await createServiceRoleClient().rpc("admin_management_mutate", {
    p_actor: authorization.userId, p_target: userId, p_patch: patch, p_permission: permission, p_effect: effect,
  });
  if (error) {
    if (error.code === "23514") return failure("لا يمكن تنفيذ التغيير لأنه قد يقفل حسابك أو يفقد آخر مدير عام صلاحيات الإدارة.", 409);
    if (error.code === "42501") return failure("لم تعد لديك صلاحية تنفيذ العملية.", 403);
    if (error.code === "P0002") return failure("المسؤول غير موجود.", 404);
    if (error.code === "22023") return failure("بيانات غير صالحة.", 400);
    return failure("تعذر حفظ التغيير. تحقق من جاهزية خدمة إدارة المسؤولين.", 503);
  }
  return NextResponse.json({ ok: true, admin: data });
}

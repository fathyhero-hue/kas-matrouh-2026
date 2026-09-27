import "server-only";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_PERMISSIONS, resolvePermissionBaseline, isAdminPermission, isAdminRole, type AdminPermission, type AdminRole } from "@/lib/admin/permissions";
import { createServiceRoleClient } from "@/lib/supabase/server";

type Profile = { user_id: string; role_key: string | null; is_active: boolean | null };
type RolePermission = { permission_key: string };
type Override = { permission_key: string; effect: "allow" | "deny" };

export type AdminAuthorizationContext = { userId: string; role: AdminRole; permissions: ReadonlySet<AdminPermission> };

export class AdminAuthorizationError extends Error {
  constructor(readonly status: 401 | 403 | 503, readonly code: "AUTH_REQUIRED" | "ADMIN_FORBIDDEN" | "RBAC_NOT_READY", message: string) {
    super(message);
    this.name = "AdminAuthorizationError";
  }
}

function createSessionClient(request: NextRequest) {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} },
  });
}

export function resolvePermissions(role: AdminRole, roleRows: RolePermission[], overrides: Override[]) {
  return resolvePermissionBaseline(
    role === "super_admin" ? [...ADMIN_PERMISSIONS] : roleRows.flatMap(({ permission_key }) => isAdminPermission(permission_key) ? [permission_key] : []),
    overrides.flatMap(({ permission_key, effect }) => isAdminPermission(permission_key) ? [{ permission: permission_key, effect }] : []),
  );
}

export async function requireAdminPermission(request: NextRequest, permission?: AdminPermission): Promise<AdminAuthorizationContext> {
  const { data: { user } } = await createSessionClient(request).auth.getUser();
  if (!user) throw new AdminAuthorizationError(401, "AUTH_REQUIRED", "Authentication is required.");

  const db = createServiceRoleClient();
  const { data: rawProfile, error: profileError } = await db.from("admin_profiles")
    .select("user_id, role_key, is_active").eq("user_id", user.id).maybeSingle();
  const profile = rawProfile as Profile | null;
  if (profileError) {
    console.error("[admin-auth] profile lookup failed", { code: profileError.code, message: profileError.message });
    throw new AdminAuthorizationError(503, "RBAC_NOT_READY", "Administrative authorization is not ready.");
  }
  if (!profile || profile.is_active !== true || !isAdminRole(profile.role_key)) {
    throw new AdminAuthorizationError(403, "ADMIN_FORBIDDEN", "You are not authorized for this operation.");
  }

  const [{ data: roleData, error: roleError }, { data: overrideData, error: overrideError }] = await Promise.all([
    db.from("admin_role_permissions").select("permission_key").eq("role_key", profile.role_key),
    db.from("admin_permission_overrides").select("permission_key, effect").eq("user_id", user.id),
  ]);
  if (roleError || overrideError) {
    console.error("[admin-auth] permission lookup failed", { roleCode: roleError?.code, overrideCode: overrideError?.code });
    throw new AdminAuthorizationError(503, "RBAC_NOT_READY", "Administrative authorization is not ready.");
  }
  const permissions = resolvePermissions(profile.role_key, (roleData ?? []) as RolePermission[], (overrideData ?? []) as Override[]);
  if (permission && !permissions.has(permission)) throw new AdminAuthorizationError(403, "ADMIN_FORBIDDEN", "You are not authorized for this operation.");
  return { userId: user.id, role: profile.role_key, permissions };
}

export async function requireAdminPageAccess() {
  const cookieStore = await cookies();
  const sessionClient = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
  });
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) redirect("/admin/login");
  const { data: profile } = await createServiceRoleClient()
    .from("admin_profiles")
    .select("role_key, is_active")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile || profile.is_active !== true || !isAdminRole(profile.role_key)) redirect("/admin/login");
  return { userId: user.id, role: profile.role_key as AdminRole };
}
export async function authorizeAdminRequest(request: NextRequest, permission: AdminPermission) {
  try {
    return await requireAdminPermission(request, permission);
  } catch (error) {
    return adminAuthorizationResponse(error);
  }
}


export function adminAuthorizationResponse(error: unknown) {
  if (error instanceof AdminAuthorizationError) {
    return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  console.error("[admin-auth] unexpected authorization error");
  return NextResponse.json({ error: { code: "ADMIN_AUTH_ERROR", message: "Administrative authorization failed." } }, { status: 503 });
}

export async function requireAdminPagePermission(permission?: AdminPermission) {
  const cookieStore = await cookies();
  const request = { cookies: cookieStore } as unknown as NextRequest;
  try { return await requireAdminPermission(request, permission); }
  catch (error) {
    if (error instanceof AdminAuthorizationError && error.status === 403) redirect("/admin/forbidden");
    if (error instanceof AdminAuthorizationError && error.status === 401) redirect("/admin/login");
    throw error;
  }
}

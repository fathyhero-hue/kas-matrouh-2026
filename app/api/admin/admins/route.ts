import { NextRequest, NextResponse } from "next/server";
import { auditAdminMutation } from "@/lib/admin/audit";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/admin/permissions";
import { authorizeManagement, catalog, failure, profileFields, readBody } from "@/lib/admin/management";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  const authorization = await authorizeManagement(req, "admins.view");
  if (authorization instanceof NextResponse) return authorization;
  try {
    const db = createServiceRoleClient();
    const profiles: Record<string, unknown>[] = [];
    for (let offset = 0; ; offset += 500) {
      const result = await db.from("admin_profiles").select(profileFields).order("created_at", { ascending: false }).order("user_id").range(offset, offset + 499);
      if (result.error) return failure("تعذر تحميل المسؤولين.", 503);
      profiles.push(...result.data);
      if (result.data.length < 500) break;
    }
    const admins = [];
    for (let offset = 0; offset < profiles.length; offset += 20) {
      admins.push(...await Promise.all(profiles.slice(offset, offset + 20).map(async profile => {
        const { data, error } = await db.auth.admin.getUserById(String(profile.user_id));
        if (error) throw new Error("AUTH_LOOKUP_FAILED");
        return { ...profile, email: data.user?.email ?? null, last_sign_in_at: data.user?.last_sign_in_at ?? null };
      })));
    }
    return NextResponse.json({ admins, ...await catalog(db), viewer: { userId: authorization.userId, role: authorization.role, permissions: [...authorization.permissions] } });
  } catch { return failure("تعذر تحميل المسؤولين.", 503); }
}
export async function POST(req: NextRequest) {
  const authorization = await authorizeManagement(req, "admins.create", true);
  if (authorization instanceof NextResponse) return authorization;
  const body = await readBody(req);
  if (!body || Object.keys(body).some(key => !["display_name", "email", "password", "role_key", "is_active"].includes(key))) return failure("بيانات غير صالحة.");
  const { display_name: name, email, password, role_key: role, is_active: active } = body;
  if (typeof name !== "string" || !name.trim() || name.trim().length > 100 || typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || typeof password !== "string" || password.length < 12 || password.length > 128 || !isAdminRole(role) || typeof active !== "boolean") return failure("راجع الحقول؛ كلمة المرور من 12 إلى 128 حرفًا.");
  const db = createServiceRoleClient();
  const roleResult = await db.from("admin_roles").select("key").eq("key", role).maybeSingle();
  if (roleResult.error) return failure("تعذر التحقق من الدور.", 503);
  if (!roleResult.data) return failure("الدور غير موجود.");
  const created = await db.auth.admin.createUser({ email: email.trim().toLowerCase(), password, email_confirm: true });
  if (created.error || !created.data.user) return failure("تعذر إنشاء الحساب؛ تحقق من البريد ومتطلبات كلمة المرور.");
  const userId = created.data.user.id;
  let profile;
  try {
    profile = await db.from("admin_profiles").insert({ user_id: userId, display_name: name.trim(), role: "admin", role_key: role, is_active: active, created_by: authorization.userId }).select(profileFields).single();
    if (profile.error) throw new Error("PROFILE_CREATE_FAILED");
  } catch {
    // This ID belongs only to this operation; never clean up an email lookup.
    const cleanup = await db.auth.admin.deleteUser(userId);
    return failure(cleanup.error ? "فشل إنشاء الملف وفشل تنظيف حساب Auth؛ يلزم تدخل فني." : "فشل إنشاء الملف وتم تنظيف حساب Auth الجديد.", 500);
  }
  await auditAdminMutation({ actorUserId: authorization.userId, action: "admins.create", permission: "admins.create", entityType: "admin_profile", entityId: userId, metadata: { changed_fields: ["display_name", "role_key", "is_active"] }, request: req });
  return NextResponse.json({ ok: true, admin: { ...profile.data, email: created.data.user.email ?? null, last_sign_in_at: null } }, { status: 201 });
}

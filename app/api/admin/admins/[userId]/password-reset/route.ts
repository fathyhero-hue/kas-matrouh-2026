import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { auditAdminMutation } from "@/lib/admin/audit";
import { authorizeManagement, failure, validId } from "@/lib/admin/management";
export async function POST(req: NextRequest, context: { params: Promise<{ userId: string }> }) {
  const auth = await authorizeManagement(req, "admins.reset_password", true);
  if (auth instanceof NextResponse) return auth;
  const { userId } = await context.params;
  if (!validId(userId)) return failure("معرف غير صالح.");
  const db = createServiceRoleClient();
  const profile = await db.from("admin_profiles").select("user_id").eq("user_id", userId).maybeSingle();
  if (profile.error) return failure("تعذر التحقق من المسؤول.", 503);
  if (!profile.data) return failure("المسؤول غير موجود.", 404);
  const { data, error } = await db.auth.admin.getUserById(userId);
  if (error || !data.user?.email) return failure("تعذر العثور على البريد.", 503);
  // Trusted application origin; never use request Host or a body-provided URL.
  const sent = await db.auth.resetPasswordForEmail(data.user.email, { redirectTo: "https://matrouhcup.online/admin/reset-password" });
  if (sent.error) return failure("تعذر إرسال الرابط. حاول لاحقًا.", 503);
  await auditAdminMutation({ actorUserId: auth.userId, action: "admins.password.reset", permission: "admins.reset_password", entityType: "admin_profile", entityId: userId, request: req });
  return NextResponse.json({ ok: true });
}

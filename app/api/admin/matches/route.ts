import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { authorizeAdminRequest } from "@/lib/admin/authorization";
import { auditAdminMutation } from "@/lib/admin/audit";
import { pickAllowedFields } from "@/lib/admin/fields";

export const runtime = "nodejs";

function isMissingVenueColumn(error: { code?: string; message?: string }) {
  return error.code === "42703" || error.code === "PGRST204" ||
    /column .*venue.* does not exist|could not find the ['"]venue['"] column/i.test(error.message || "");
}

export async function POST(req: NextRequest) {
  const fullAuthorization = await authorizeAdminRequest(req, "matches.admin.full_control");
  const isFullControl = !(fullAuthorization instanceof NextResponse);
  let authorization = isFullControl ? fullAuthorization : await authorizeAdminRequest(req, "matches.edit");
  if (authorization instanceof NextResponse) return authorization;
  let auditPermission: "matches.edit" | "matches.live.manage" | "matches.admin.full_control" = isFullControl
    ? "matches.admin.full_control"
    : "matches.edit";
  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "بيانات المباراة غير صالحة." }, { status: 400 });
    }
    const id = body.id;
    if (["reset", "archive", "restore"].includes(body.action) && !isFullControl) {
      return NextResponse.json({ error: "هذه العملية متاحة للمسؤول الرئيسي المخوّل فقط." }, { status: 403 });
    }
    if (isFullControl && ["reset", "archive", "restore"].includes(body.action)) {
      if (typeof id !== "string" || !id) {
        return NextResponse.json({ error: "معرّف المباراة مفقود." }, { status: 400 });
      }
      const reason = typeof body.reason === "string" ? body.reason.trim() : "";
      if (!reason || reason.length > 1000) {
        return NextResponse.json({ error: "اكتب سببًا واضحًا للعملية (حتى 1000 حرف)." }, { status: 400 });
      }
      const { data, error } = await createServiceRoleClient().rpc("admin_manage_match", {
        p_action: body.action,
        p_match_id: id,
        p_actor: authorization.userId,
        p_patch: {},
        p_reason: reason,
      });
      if (error) {
        if (error.message.includes("MATCH_ADMIN_FORBIDDEN")) {
          return NextResponse.json({ error: "هذه العملية متاحة للمسؤول الرئيسي المخوّل فقط." }, { status: 403 });
        }
        if (error.message.includes("MATCH_NOT_FOUND")) {
          return NextResponse.json({ error: "المباراة غير موجودة." }, { status: 404 });
        }
        if (error.message.includes("MATCH_ADMIN_REASON_REQUIRED")) {
          return NextResponse.json({ error: "سبب العملية مطلوب." }, { status: 400 });
        }
        throw error;
      }
      const actionLabel = body.action === "reset" ? "match.reset" : body.action === "archive" ? "match.archive" : "match.restore";
      await auditAdminMutation({
        actorUserId: authorization.userId,
        action: actionLabel,
        permission: "matches.admin.full_control",
        entityType: "matches",
        entityId: id,
        metadata: { reason },
        request: req,
      });
      return NextResponse.json({ ok: true, match: data });
    }
    const patch = pickAllowedFields(body, ["team_a", "team_a_logo", "team_b", "team_b_logo", "home_goals", "away_goals", "home_penalty_goals", "away_penalty_goals", "match_date", "match_time", "day_name", "venue", "status", "is_live", "live_minute", "live_minute_base", "timer_started_at", "timer_paused_total", "is_timer_running", "bracket_id", "round", "stage", "match_label", "qualified_team", "next_match_label", "next_match_slot"]);
    if (Object.prototype.hasOwnProperty.call(patch, "venue")) {
      if (typeof patch.venue === "string") {
        const venue = patch.venue.trim();
        if (venue.length > 200) return NextResponse.json({ error: "اسم الملعب يجب ألا يتجاوز 200 حرف." }, { status: 400 });
        patch.venue = venue || null;
      } else if (patch.venue !== null) return NextResponse.json({ error: "اسم الملعب غير صالح." }, { status: 400 });
    }
    const liveStatuses = new Set(["الشوط الأول", "استراحة", "الشوط الثاني", "ضربات جزاء", "انتهت"]);
    const requiresLivePermission = Boolean(id) && (
      (typeof patch.status === "string" && liveStatuses.has(patch.status)) ||
      Object.prototype.hasOwnProperty.call(patch, "is_live") ||
      [
      "live_minute",
      "live_minute_base",
      "timer_started_at",
      "timer_paused_total",
      "is_timer_running",
      ].some((field) => Object.prototype.hasOwnProperty.call(patch, field))
    );
    if (requiresLivePermission) {
      if (!isFullControl) {
        const liveAuthorization = await authorizeAdminRequest(req, "matches.live.manage");
        if (liveAuthorization instanceof NextResponse) return liveAuthorization;
        authorization = liveAuthorization;
        auditPermission = "matches.live.manage";
      }
    }
    const supabase = createServiceRoleClient();

    if (id) {
      if (isFullControl) {
        const reason = typeof body.reason === "string" && body.reason.trim()
          ? body.reason.trim()
          : "تعديل من لوحة إدارة المباريات";
        const { data, error } = await supabase.rpc("admin_manage_match", {
          p_action: "update",
          p_match_id: id,
          p_actor: authorization.userId,
          p_patch: patch,
          p_reason: reason,
        });
        if (error) {
          if (error.message.includes("MATCH_ADMIN_FORBIDDEN")) {
            return NextResponse.json({ error: "هذه العملية متاحة للمسؤول الرئيسي المخوّل فقط." }, { status: 403 });
          }
          if (error.message.includes("MATCH_NOT_FOUND")) {
            return NextResponse.json({ error: "المباراة غير موجودة." }, { status: 404 });
          }
          if (error.message.includes("SCORE_BELOW_ACTIVE_GOAL_EVENTS")) {
            return NextResponse.json({ error: "النتيجة المطلوبة أقل من عدد الأهداف المسجلة؛ صحح أحداث الأهداف أولًا." }, { status: 409 });
          }
          if (error.message.includes("INVALID_MATCH_SCORE") || error.message.includes("INVALID_MATCH_TEAMS")) {
            return NextResponse.json({ error: "بيانات المباراة أو النتيجة غير صالحة." }, { status: 400 });
          }
          throw error;
        }
        await auditAdminMutation({ actorUserId: authorization.userId, action: "matches.mutation", permission: auditPermission, entityType: "matches", entityId: id, request: req });
        return NextResponse.json({ ok: true, match: data });
      }
      if (
        Object.prototype.hasOwnProperty.call(patch, "home_goals") ||
        Object.prototype.hasOwnProperty.call(patch, "away_goals") ||
        Object.prototype.hasOwnProperty.call(patch, "team_a") ||
        Object.prototype.hasOwnProperty.call(patch, "team_b") ||
        Object.prototype.hasOwnProperty.call(patch, "bracket_id")
      ) {
        const { data: current, error: currentError } = await supabase.from("matches")
          .select("live_events_enabled")
          .eq("id", id)
          .maybeSingle();
        if (currentError) throw currentError;
        if (current?.live_events_enabled) {
          return NextResponse.json(
            { error: "لا يمكن تغيير نتيجة المباراة أو الفرق أو البطولة بعد تفعيل أحداث الأهداف." },
            { status: 409 },
          );
        }
      }
      let result = await supabase.from("matches").update(patch).eq("id", id).select().single();
      if (result.error && isMissingVenueColumn(result.error) && Object.prototype.hasOwnProperty.call(patch, "venue")) {
        if (typeof patch.venue === "string" && patch.venue.length > 0) {
          return NextResponse.json({ error: "يلزم تطبيق تحديث مخطط الملعب قبل حفظ اسم الملعب." }, { status: 409 });
        }
        delete patch.venue;
        result = await supabase.from("matches").update(patch).eq("id", id).select().single();
      }
      if (result.error) throw result.error;
      const { data } = result;
      await auditAdminMutation({ actorUserId: authorization.userId, action: "matches.mutation", permission: auditPermission, entityType: "matches", request: req });
    return NextResponse.json({ ok: true, match: data });
    }

    if (!String(patch.team_a || "").trim() || !String(patch.team_b || "").trim()) {
      return NextResponse.json({ error: "يجب إدخال أسماء الفرق." }, { status: 400 });
    }
    let result = await supabase.from("matches").insert(patch).select().single();
    if (result.error && isMissingVenueColumn(result.error) && Object.prototype.hasOwnProperty.call(patch, "venue")) {
      if (typeof patch.venue === "string" && patch.venue.length > 0) {
        return NextResponse.json({ error: "يلزم تطبيق تحديث مخطط الملعب قبل حفظ اسم الملعب." }, { status: 409 });
      }
      delete patch.venue;
      result = await supabase.from("matches").insert(patch).select().single();
    }
    if (result.error) throw result.error;
    const { data } = result;
    await auditAdminMutation({ actorUserId: authorization.userId, action: "matches.mutation", permission: auditPermission, entityType: "matches", request: req });
    return NextResponse.json({ ok: true, match: data });
  } catch (error: unknown) {
    console.error("Admin match save error:", error);
    const message = error instanceof Error ? error.message : "فشل حفظ المباراة.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const authorization = await authorizeAdminRequest(req, "matches.admin.full_control");
  if (authorization instanceof NextResponse) return authorization;
  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "بيانات الأرشفة غير صالحة." }, { status: 400 });
    }
    const id = typeof body.id === "string" ? body.id : req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "معرّف المباراة مفقود." }, { status: 400 });
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (!reason || reason.length > 1000) {
      return NextResponse.json({ error: "اكتب سببًا واضحًا للأرشفة (حتى 1000 حرف)." }, { status: 400 });
    }
    const { data, error } = await createServiceRoleClient().rpc("admin_manage_match", {
      p_action: "archive",
      p_match_id: id,
      p_actor: authorization.userId,
      p_patch: {},
      p_reason: reason,
    });
    if (error) {
      if (error.message.includes("MATCH_ADMIN_FORBIDDEN")) {
        return NextResponse.json({ error: "أرشفة المباريات متاحة للمسؤول الرئيسي المخوّل فقط." }, { status: 403 });
      }
      if (error.message.includes("MATCH_NOT_FOUND")) {
        return NextResponse.json({ error: "المباراة غير موجودة." }, { status: 404 });
      }
      throw error;
    }
    await auditAdminMutation({ actorUserId: authorization.userId, action: "match.archive", permission: "matches.admin.full_control", entityType: "matches", entityId: id, request: req });
    return NextResponse.json({ ok: true, match: data });
  } catch (error: unknown) {
    console.error("Admin match archive error:", error);
    const message = error instanceof Error ? error.message : "فشلت أرشفة المباراة.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

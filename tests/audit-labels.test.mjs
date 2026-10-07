import assert from "node:assert/strict";
import test from "node:test";
import { harness } from "./admin-test-harness.mjs";

const labels = harness().load("lib/admin/audit-labels.ts");

test("known audit values have Arabic presentation labels", () => {
  assert.equal(labels.getAuditActionLabel("player_cards.create"), "إنشاء بطاقة لاعب");
  assert.equal(labels.getAuditResourceLabel("registration_settings"), "إعدادات التسجيل");
  assert.equal(labels.getAuditStatusLabel("ready"), "جاهزة");
  assert.equal(labels.getAuditDetailLabel("role_key"), "الدور الإداري");
  assert.equal(labels.getAuditDetailLabel("matches.edit"), "تعديل المباريات");
  assert.equal(labels.AUDIT_ACTION_OPTIONS.find((option) => option.label === "إنشاء بطاقة لاعب")?.value, "player_cards.create");
});

test("unknown audit values use a safe readable fallback", () => {
  assert.match(labels.getAuditActionLabel("player_cards.some_new_action"), /حركة إدارية/);
  assert.match(labels.getAuditActionLabel("player_cards.some_new_action"), /player_cards\.some_new_action/);
  assert.match(labels.getAuditResourceLabel("new_resource"), /قسم إداري/);
});

test("audit details are translated without exposing raw JSON", () => {
  assert.deepEqual(labels.formatAuditDetails({
    changed_fields: ["role_key", "is_active"],
    old_status: "draft",
    new_status: "ready",
    team_slug: "champions",
  }), [
    "الحقول: الدور الإداري، حالة التفعيل",
    "الحالة السابقة: مسودة",
    "الحالة الجديدة: جاهزة",
    "الفريق: champions",
  ]);
});

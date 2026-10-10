import assert from "node:assert/strict";
import test from "node:test";

import {
  ADMIN_PERMISSIONS,
  getRolePermissions,
  hasAdminPermission,
  isAdminPermission,
  isAdminRole,
  resolveAdminPermissions,
} from "../lib/admin/permissions.ts";

test("catalog contains only valid permission keys", () => {
  assert.equal(new Set(ADMIN_PERMISSIONS).size, ADMIN_PERMISSIONS.length);
  for (const permission of ADMIN_PERMISSIONS) assert.equal(isAdminPermission(permission), true);
  assert.equal(isAdminPermission("matches.unknown"), false);
});

test("role validation and super admin baseline", () => {
  assert.equal(isAdminRole("super_admin"), true);
  assert.equal(isAdminRole("not-a-role"), false);
  assert.equal(getRolePermissions("super_admin").length, ADMIN_PERMISSIONS.length);
  assert.equal(hasAdminPermission("super_admin", "settings.manage"), true);
  assert.equal(hasAdminPermission("super_admin", "settings.manage", [
    { permission: "settings.manage", effect: "deny" },
  ]), false);
});

test("supervisor is operational but cannot administer the system", () => {
  assert.equal(hasAdminPermission("supervisor", "matches.results.manage"), true);
  assert.equal(hasAdminPermission("supervisor", "rosters.approve"), true);
  assert.equal(hasAdminPermission("supervisor", "admins.view"), true);
  assert.equal(hasAdminPermission("supervisor", "admins.create"), false);
  assert.equal(hasAdminPermission("supervisor", "admins.permissions.manage"), false);
  assert.equal(hasAdminPermission("supervisor", "settings.manage"), false);
  assert.equal(hasAdminPermission("supervisor", "shop.orders.financial.manage"), false);
});

test("specialized roles stay within their domains by default", () => {
  assert.equal(hasAdminPermission("match_manager", "matches.results.manage"), true);
  assert.equal(hasAdminPermission("viewer", "matches.results.manage"), false);
  assert.equal(hasAdminPermission("match_manager", "rosters.edit"), false);
  assert.equal(hasAdminPermission("registration_manager", "rosters.players.manage"), true);
  assert.equal(hasAdminPermission("registration_manager", "matches.edit"), false);
  assert.equal(hasAdminPermission("tournament_manager", "tournaments.groups.manage"), true);
  assert.equal(hasAdminPermission("tournament_manager", "content.edit"), false);
  assert.equal(hasAdminPermission("content_manager", "notifications.send"), true);
  assert.equal(hasAdminPermission("content_manager", "shop.products.manage"), false);
  assert.equal(hasAdminPermission("shop_manager", "shop.orders.manage"), true);
  assert.equal(hasAdminPermission("shop_manager", "shop.orders.financial.manage"), false);
  assert.equal(hasAdminPermission("viewer", "matches.view"), true);
  assert.equal(hasAdminPermission("viewer", "matches.edit"), false);
});

test("per-admin overrides support grants and deny wins", () => {
  assert.equal(hasAdminPermission("viewer", "matches.edit"), false);
  assert.equal(hasAdminPermission("viewer", "matches.edit", [
    { permission: "matches.edit", effect: "allow" },
  ]), true);
  assert.equal(hasAdminPermission("supervisor", "matches.edit", [
    { permission: "matches.edit", effect: "deny" },
  ]), false);

  const resolved = resolveAdminPermissions("viewer", [
    { permission: "matches.edit", effect: "allow" },
    { permission: "matches.edit", effect: "deny" },
  ]);
  assert.equal(resolved.has("matches.edit"), false);
});

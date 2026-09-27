export const ADMIN_ROLES = [
  "super_admin",
  "supervisor",
  "match_manager",
  "registration_manager",
  "tournament_manager",
  "content_manager",
  "shop_manager",
  "viewer",
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ADMIN_PERMISSIONS = [
  "dashboard.view",
  "matches.view",
  "matches.create",
  "matches.edit",
  "matches.delete",
  "matches.schedule.manage",
  "matches.live.manage",
  "matches.results.manage",
  "stats.view",
  "stats.goals.manage",
  "stats.cards.manage",
  "stats.motm.manage",
  "stats.formations.manage",
  "stats.photos.upload",
  "rosters.view",
  "rosters.create",
  "rosters.edit",
  "rosters.delete",
  "rosters.approve",
  "rosters.players.manage",
  "rosters.photos.upload",
  "rosters.settings.manage",
  "rosters.restrictions.manage",
  "registrations.view",
  "registrations.edit",
  "registrations.delete",
  "registrations.photos.upload",
  "registrations.print",
  "teams.view",
  "teams.manage",
  "teams.access.grant",
  "teams.access.revoke",
  "tournaments.view",
  "tournaments.manage",
  "tournaments.groups.manage",
  "tournaments.registration-settings.manage",
  "tournaments.player-cards.manage",
  "content.view",
  "content.create",
  "content.edit",
  "content.delete",
  "content.publish",
  "notifications.send",
  "shop.products.view",
  "shop.products.manage",
  "shop.orders.view",
  "shop.orders.manage",
  "shop.orders.financial.manage",
  "admins.view",
  "admins.create",
  "admins.edit",
  "admins.disable",
  "admins.reset_password",
  "admins.permissions.manage",
  "audit.view",
  "settings.manage",
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];
export type PermissionOverride = {
  permission: AdminPermission;
  effect: "allow" | "deny";
};

const permissions = new Set<string>(ADMIN_PERMISSIONS);

const operationalPermissions = [
  "dashboard.view",
  "matches.view",
  "matches.create",
  "matches.edit",
  "matches.delete",
  "matches.schedule.manage",
  "matches.live.manage",
  "matches.results.manage",
  "stats.view",
  "stats.goals.manage",
  "stats.cards.manage",
  "stats.motm.manage",
  "stats.formations.manage",
  "stats.photos.upload",
  "rosters.view",
  "rosters.create",
  "rosters.edit",
  "rosters.delete",
  "rosters.approve",
  "rosters.players.manage",
  "rosters.photos.upload",
  "rosters.settings.manage",
  "rosters.restrictions.manage",
  "registrations.view",
  "registrations.edit",
  "registrations.delete",
  "registrations.photos.upload",
  "registrations.print",
  "teams.view",
  "teams.manage",
  "teams.access.grant",
  "teams.access.revoke",
  "tournaments.view",
  "tournaments.manage",
  "tournaments.groups.manage",
  "tournaments.registration-settings.manage",
  "tournaments.player-cards.manage",
  "content.view",
  "content.create",
  "content.edit",
  "content.delete",
  "content.publish",
  "notifications.send",
  "shop.products.view",
  "shop.products.manage",
  "shop.orders.view",
  "shop.orders.manage",
  "admins.view",
  "audit.view",
] as const satisfies readonly AdminPermission[];

const rolePermissions: Record<Exclude<AdminRole, "super_admin">, readonly AdminPermission[]> = {
  supervisor: operationalPermissions,
  match_manager: [
    "dashboard.view",
    "matches.view",
    "matches.create",
    "matches.edit",
    "matches.delete",
    "matches.schedule.manage",
    "matches.live.manage",
    "matches.results.manage",
    "stats.view",
    "stats.goals.manage",
    "stats.cards.manage",
    "stats.motm.manage",
    "stats.formations.manage",
    "stats.photos.upload",
  ],
  registration_manager: [
    "dashboard.view",
    "rosters.view",
    "rosters.create",
    "rosters.edit",
    "rosters.delete",
    "rosters.approve",
    "rosters.players.manage",
    "rosters.photos.upload",
    "rosters.settings.manage",
    "rosters.restrictions.manage",
    "registrations.view",
    "registrations.edit",
    "registrations.delete",
    "registrations.photos.upload",
    "registrations.print",
    "teams.view",
  ],
  tournament_manager: [
    "dashboard.view",
    "teams.view",
    "teams.manage",
    "teams.access.grant",
    "teams.access.revoke",
    "tournaments.view",
    "tournaments.manage",
    "tournaments.groups.manage",
    "tournaments.registration-settings.manage",
    "tournaments.player-cards.manage",
  ],
  content_manager: [
    "dashboard.view",
    "content.view",
    "content.create",
    "content.edit",
    "content.delete",
    "content.publish",
    "notifications.send",
  ],
  shop_manager: [
    "dashboard.view",
    "shop.products.view",
    "shop.products.manage",
    "shop.orders.view",
    "shop.orders.manage",
  ],
  viewer: [
    "dashboard.view",
    "matches.view",
    "stats.view",
    "rosters.view",
    "registrations.view",
    "teams.view",
    "tournaments.view",
    "content.view",
    "shop.products.view",
    "shop.orders.view",
    "admins.view",
    "audit.view",
  ],
};

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === "string" && ADMIN_ROLES.includes(value as AdminRole);
}

export function isAdminPermission(value: unknown): value is AdminPermission {
  return typeof value === "string" && permissions.has(value);
}

export function getRolePermissions(role: AdminRole): readonly AdminPermission[] {
  return role === "super_admin" ? ADMIN_PERMISSIONS : rolePermissions[role];
}

export function resolveAdminPermissions(
  role: AdminRole,
  overrides: readonly PermissionOverride[] = [],
): ReadonlySet<AdminPermission> {
  const resolved = new Set<AdminPermission>(getRolePermissions(role));

  // A deny wins if duplicate override rows contain both effects.
  const denied = new Set(overrides.filter(({ effect }) => effect === "deny").map(({ permission }) => permission));
  if (role !== "super_admin") {
    for (const permission of denied) resolved.delete(permission);
  }
  for (const { permission, effect } of overrides) {
    if (role === "super_admin" || denied.has(permission)) continue;
    if (effect === "allow") resolved.add(permission);
    else resolved.delete(permission);
  }

  return resolved;
}

export function hasAdminPermission(
  role: AdminRole,
  permission: AdminPermission,
  overrides: readonly PermissionOverride[] = [],
): boolean {
  return resolveAdminPermissions(role, overrides).has(permission);
}

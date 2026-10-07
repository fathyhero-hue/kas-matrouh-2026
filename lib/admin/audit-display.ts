import { isAdminPermission } from "./permissions";
import type { AuditDisplayMetadata } from "./audit-labels";

/** Deliberately narrower than stored metadata; never render arbitrary JSON. */
export function auditDisplayMetadata(value: unknown): AuditDisplayMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const metadata = value as Record<string, unknown>;
  const result: AuditDisplayMetadata = {};
  const fields = metadata.changed_fields;
  if (Array.isArray(fields)) {
    const safe = fields.filter((field): field is string => typeof field === "string" &&
      ([
        "display_name", "role_key", "is_active", "allow", "deny", "inherit",
        "card_number", "payment_status", "payment_method", "paid_at", "confirmed_by",
      ].includes(field) || isAdminPermission(field)));
    if (safe.length) result.changed_fields = safe;
  }
  for (const key of ["old_status", "new_status", "team_slug", "match_id"] as const) {
    const value = metadata[key];
    if (typeof value === "string" && value.length <= 200) result[key] = value;
  }
  return result;
}

import { isAdminPermission } from "./permissions";

/** Deliberately narrower than stored metadata; never render arbitrary JSON. */
export function auditDisplayMetadata(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const fields = (value as Record<string, unknown>).changed_fields;
  if (!Array.isArray(fields)) return {};
  const safe = fields.filter((field): field is string => typeof field === "string" &&
    (["display_name", "role_key", "is_active", "allow", "deny", "inherit"].includes(field) || isAdminPermission(field)));
  return safe.length ? { changed_fields: safe } : {};
}

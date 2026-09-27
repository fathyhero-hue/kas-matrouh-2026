import "server-only";
import type { NextRequest } from "next/server";
import type { AdminPermission } from "@/lib/admin/permissions";
import { createServiceRoleClient } from "@/lib/supabase/server";

export type AdminAuditInput = {
  actorUserId: string;
  action: string;
  permission: AdminPermission;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  request: NextRequest;
};

const SAFE_METADATA_KEYS = new Set(["changed_fields", "old_status", "new_status", "team_slug", "match_id"]);

function safeMetadata(metadata: Record<string, unknown> = {}) {
  return Object.fromEntries(Object.entries(metadata).filter(([key, value]) => SAFE_METADATA_KEYS.has(key) && (typeof value === "string" || Array.isArray(value) && value.every((item) => typeof item === "string"))));
}

export async function auditAdminMutation(input: AdminAuditInput) {
  const requestId = input.request.headers.get("x-request-id");
  const userAgent = input.request.headers.get("user-agent");
  const { error } = await createServiceRoleClient().from("admin_audit_logs").insert({
    actor_user_id: input.actorUserId,
    action: input.action,
    permission_key: input.permission,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    metadata: safeMetadata(input.metadata),
    request_id: requestId,
    user_agent: userAgent,
  });
  if (error) console.error("[admin-audit] write failed", { code: error.code, message: error.message, action: input.action, entityType: input.entityType });
}
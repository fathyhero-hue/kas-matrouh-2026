import { requireAdminPagePermission } from "@/lib/admin/authorization";
import { AuditLog } from "@/components/admin/audit-log";
export default async function AuditPage() { await requireAdminPagePermission("audit.view"); return <AuditLog />; }

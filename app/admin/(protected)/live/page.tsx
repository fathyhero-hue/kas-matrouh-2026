import { LiveMatchManager } from "@/components/admin/live-match-manager";
import { requireAdminPagePermission } from "@/lib/admin/authorization";

export const dynamic = "force-dynamic";

export default async function AdminLivePage() {
  await requireAdminPagePermission("matches.live.manage");
  return <LiveMatchManager />;
}

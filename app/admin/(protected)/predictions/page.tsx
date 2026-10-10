import { PredictionsManager } from "@/components/admin/predictions-manager";
import { requireAdminPagePermission } from "@/lib/admin/authorization";

export const dynamic = "force-dynamic";

export default async function AdminPredictionsPage() {
  await requireAdminPagePermission("matches.results.manage");
  return <PredictionsManager />;
}

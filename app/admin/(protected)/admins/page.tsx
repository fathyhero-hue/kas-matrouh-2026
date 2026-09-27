import { requireAdminPagePermission } from "@/lib/admin/authorization";
import { AdminManagement } from "@/components/admin/admin-management";
export default async function AdminsPage() {
  await requireAdminPagePermission("admins.view");
  return <AdminManagement />;
}

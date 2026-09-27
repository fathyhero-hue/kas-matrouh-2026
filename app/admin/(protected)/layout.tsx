import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdminPageAccess } from "@/lib/admin/authorization";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPageAccess();
  return <AdminShell>{children}</AdminShell>;
}

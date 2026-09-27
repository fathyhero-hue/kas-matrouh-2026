import { createServiceRoleClient } from "@/lib/supabase/server";
import { ShopProductsManager } from "@/components/admin/shop-products-manager";
import { OrdersManager } from "@/components/admin/orders-manager";

export const dynamic = "force-dynamic";

export default async function AdminShopPage() {
  const supabase = createServiceRoleClient();
  const [{ data: products }, { data: orders }] = await Promise.all([
    supabase.from("shop_products").select("*").order("sort_order", { ascending: true }),
    supabase.from("orders").select("*, order_items(*)").order("created_at", { ascending: false }).limit(150),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-h1 font-black">المتجر والطلبات</h1>
        <p className="mt-1 text-caption text-muted-foreground">إدارة منتجات المتجر ومتابعة الطلبات والمدفوعات</p>
      </div>

      <ShopProductsManager initialProducts={products || []} />
      <OrdersManager initialOrders={(orders || []) as any} />
    </div>
  );
}

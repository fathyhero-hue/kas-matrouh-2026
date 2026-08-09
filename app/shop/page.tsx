import { ShoppingBag } from "lucide-react";
import { createPublicClient } from "@/lib/supabase/public";
import { ProductCard } from "@/components/shop/product-card";
import { EmptyState } from "@/components/sport/empty-state";

export const revalidate = 30;

export default async function ShopPage() {
  const supabase = createPublicClient();
  const { data: products } = await supabase
    .from("shop_products")
    .select("id, title, name, price, image_url, description, stock")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const rows = products || [];

  return (
    <main dir="rtl" className="mx-auto max-w-5xl px-4 pb-16 pt-8 sm:px-6">
      <div className="mb-8 flex items-center gap-3">
        <ShoppingBag className="h-8 w-8 text-accent-blue" />
        <h1 className="text-h1 font-black">المتجر</h1>
      </div>

      {rows.length === 0 ? (
        <EmptyState message="لسه مفيش منتجات متاحة" />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {rows.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </main>
  );
}

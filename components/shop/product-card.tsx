"use client";

import { toast } from "sonner";
import { ShoppingCart, Package } from "lucide-react";
import { useCart } from "@/lib/shop/cart-context";

export type Product = {
  id: string;
  title: string | null;
  name: string | null;
  price: number | null;
  image_url: string | null;
  description: string | null;
  stock: number | null;
};

export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const title = product.title || product.name || "منتج";
  const outOfStock = product.stock !== null && product.stock <= 0;

  const handleAdd = () => {
    addItem({ id: product.id, title, price: Number(product.price || 0), imageUrl: product.image_url || "" });
    toast.success("تمت الإضافة للسلة 🛒");
  };

  return (
    <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-white/10">
      <div className="relative aspect-square w-full bg-secondary">
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image_url} alt={title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Package className="h-10 w-10 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="text-body font-black leading-snug">{title}</div>
        {product.description && <p className="mt-1 line-clamp-2 text-caption text-muted-foreground">{product.description}</p>}
        <div className="mt-3 flex items-center justify-between">
          <span className="text-h3 font-black text-accent-blue" dir="ltr">
            {Number(product.price || 0)} <span className="text-caption">ج.م</span>
          </span>
          <button
            onClick={handleAdd}
            disabled={outOfStock}
            className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-caption font-black text-primary-foreground disabled:opacity-50"
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            {outOfStock ? "نفذت الكمية" : "أضف للسلة"}
          </button>
        </div>
      </div>
    </div>
  );
}

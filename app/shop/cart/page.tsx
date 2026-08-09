"use client";

import Link from "next/link";
import { Minus, Plus, Trash2, ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/shop/cart-context";
import { EmptyState } from "@/components/sport/empty-state";

export default function CartPage() {
  const { items, setQty, removeItem, total } = useCart();

  return (
    <main dir="rtl" className="mx-auto max-w-2xl px-4 pb-16 pt-8 sm:px-6">
      <div className="mb-8 flex items-center gap-3">
        <ShoppingCart className="h-8 w-8 text-accent-blue" />
        <h1 className="text-h1 font-black">السلة</h1>
      </div>

      {items.length === 0 ? (
        <EmptyState message="السلة فاضية" hint="روح المتجر وضيف منتجات الأول" />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-card p-3 ring-1 ring-white/10">
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.imageUrl} alt={item.title} className="h-16 w-16 rounded-xl object-cover" />
              ) : (
                <div className="h-16 w-16 rounded-xl bg-secondary" />
              )}
              <div className="flex-1">
                <div className="text-body font-black">{item.title}</div>
                <div className="text-caption text-muted-foreground" dir="ltr">
                  {item.price} ج.م
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setQty(item.id, item.qty - 1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5">
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-6 text-center text-body font-black">{item.qty}</span>
                <button onClick={() => setQty(item.id, item.qty + 1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <button onClick={() => removeItem(item.id)} className="flex h-8 w-8 items-center justify-center rounded-full text-destructive hover:bg-destructive/10">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}

          <div className="flex items-center justify-between rounded-2xl bg-card p-4 ring-1 ring-white/10">
            <span className="text-body font-bold text-muted-foreground">الإجمالي</span>
            <span className="text-h2 font-black text-accent-blue" dir="ltr">
              {total} ج.م
            </span>
          </div>

          <Link
            href="/shop/checkout"
            className="block w-full rounded-2xl bg-primary py-4 text-center text-body font-black text-primary-foreground"
          >
            إتمام الطلب
          </Link>
        </div>
      )}
    </main>
  );
}

"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/shop/cart-context";

export function CartButton() {
  const { count } = useCart();

  return (
    <Link href="/shop/cart" className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/5 transition-colors hover:bg-white/10">
      <ShoppingCart className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -left-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-orange px-1 text-[10px] font-black text-white">
          {count}
        </span>
      )}
    </Link>
  );
}

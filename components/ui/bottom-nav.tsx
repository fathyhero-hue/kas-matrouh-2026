"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export type BottomNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

// Fixed mobile navigation, replacing the old horizontal tab strip. Desktop
// gets a normal top nav (rendered separately in the header); this only
// shows below the `sm` breakpoint.
export function BottomNav({ items }: { items: BottomNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav
      dir="rtl"
      className="fixed inset-x-0 bottom-0 z-50 flex items-stretch justify-around border-t border-white/10 bg-card/95 backdrop-blur-lg sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {items.map((item) => {
        const active = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-bold transition-colors",
              active ? "text-accent-blue" : "text-muted-foreground"
            )}
          >
            <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

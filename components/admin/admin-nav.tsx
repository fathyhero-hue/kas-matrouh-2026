"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Trophy, ClipboardList, ShoppingBag, LogOut, Star, Newspaper, IdCard } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const NAV_ITEMS = [
  { href: "/admin", label: "الرئيسية", icon: LayoutDashboard },
  { href: "/admin/matches", label: "المباريات", icon: Trophy },
  { href: "/admin/stats", label: "الإحصائيات", icon: Star },
  { href: "/admin/rosters", label: "القوائم", icon: ClipboardList },
  { href: "/admin/registrations", label: "كروت اللاعبين", icon: IdCard },
  { href: "/admin/media", label: "الإعلام", icon: Newspaper },
  { href: "/admin/shop", label: "المتجر", icon: ShoppingBag },
];

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/admin/login") return null;

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  };

  return (
    <header className="print:hidden sticky top-0 z-40 border-b border-white/10 bg-brand-dark/95 backdrop-blur-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2 text-body font-black">
          <Trophy className="h-5 w-5 text-accent-blue" />
          لوحة الإدارة
        </div>
        <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
          {NAV_ITEMS.map((item) => {
            const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-caption font-bold transition-colors ${
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                }`}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={logout}
          className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-caption font-bold text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
        >
          <LogOut className="h-3.5 w-3.5" />
          خروج
        </button>
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Trophy, ClipboardList, ShoppingBag, LogOut, Star, Newspaper, IdCard, Users, History } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { href: "/admin/admins", permission: "admins.view", label: "إدارة المسؤولين", icon: Users },
  { href: "/admin/audit", permission: "audit.view", label: "سجل النشاط", icon: History },
  { href: "/admin", permission: "dashboard.view", label: "الرئيسية", icon: LayoutDashboard },
  { href: "/admin/matches", permission: "matches.view", label: "المباريات", icon: Trophy },
  { href: "/admin/stats", permission: "stats.view", label: "الإحصائيات", icon: Star },
  { href: "/admin/rosters", permission: "rosters.view", label: "القوائم", icon: ClipboardList },
  { href: "/admin/registrations", permission: "registrations.view", label: "كروت اللاعبين", icon: IdCard },
  { href: "/admin/media", permission: "content.view", label: "الإعلام", icon: Newspaper },
  { href: "/admin/shop", permission: "shop.products.view", label: "المتجر", icon: ShoppingBag },
];

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [permissions, setPermissions] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    const load = () => fetch("/api/admin/me", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(data => { if (!cancelled) setPermissions(data?.permissions ?? []); }).catch(() => { if (!cancelled) setPermissions([]); });
    void load();
    window.addEventListener("admin-permissions-changed", load);
    return () => { cancelled = true; window.removeEventListener("admin-permissions-changed", load); };
  }, [pathname]);

  if (pathname === "/admin/login") return null;

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  };

  return (
    <header className="print:hidden sticky top-0 z-40 border-b border-white/10 bg-brand-dark/95 backdrop-blur-lg">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:flex-nowrap sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-body font-black sm:flex-none">
          <Trophy className="h-5 w-5 text-accent-blue" />
          لوحة الإدارة
        </div>
        <nav className="order-3 flex min-w-0 basis-full items-center gap-1 overflow-x-auto pb-0.5 sm:order-none sm:flex-1 sm:basis-auto">
          {NAV_ITEMS.filter((item) => !item.permission || permissions.includes(item.permission)).map((item) => {
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

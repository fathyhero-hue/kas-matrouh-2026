import Link from "next/link";
import { Trophy, ClipboardList, ArrowLeft, ShoppingBag, Star, Newspaper } from "lucide-react";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function getStats() {
  const supabase = createServiceRoleClient();
  const [{ count: liveCount }, { count: pendingRosters }, { count: pendingOrders }] = await Promise.all([
    supabase.from("matches").select("id", { count: "exact", head: true }).eq("is_live", true),
    supabase.from("team_rosters").select("id", { count: "exact", head: true }).eq("is_submitted", false),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("payment_status", "pending_payment"),
  ]);
  return {
    liveCount: liveCount || 0,
    pendingRosters: pendingRosters || 0,
    pendingOrders: pendingOrders || 0,
  };
}

export default async function AdminDashboard() {
  const stats = await getStats();

  const cards = [
    {
      href: "/admin/matches",
      icon: Trophy,
      title: "المباريات",
      subtitle: "التحكم باللايف، النتائج، والعداد",
      badge: stats.liveCount > 0 ? `${stats.liveCount} مباشر الآن` : undefined,
      badgeTone: "red" as const,
    },
    {
      href: "/admin/rosters",
      icon: ClipboardList,
      title: "القوائم والتسجيل",
      subtitle: "مراجعة قوائم الفرق وطلبات التسجيل",
      badge: stats.pendingRosters > 0 ? `${stats.pendingRosters} قيد المراجعة` : undefined,
      badgeTone: "orange" as const,
    },
    {
      href: "/admin/shop",
      icon: ShoppingBag,
      title: "المتجر والطلبات",
      subtitle: "المنتجات، الطلبات، والمدفوعات",
      badge: stats.pendingOrders > 0 ? `${stats.pendingOrders} بانتظار الدفع` : undefined,
      badgeTone: "orange" as const,
    },
    {
      href: "/admin/stats",
      icon: Star,
      title: "الهدافين والكروت ونجم المباراة",
      subtitle: "إحصائيات اللاعبين لكل بطولة",
    },
    {
      href: "/admin/media",
      icon: Newspaper,
      title: "الإعلام والإشعارات",
      subtitle: "الأخبار، شريط الأخبار، والإشعارات الفورية",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 font-black">لوحة التحكم</h1>
        <p className="mt-1 text-caption text-muted-foreground">إدارة البطولات والمحتوى في مكان واحد</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((c, i) => (
          <Link
            key={`${c.href}-${i}`}
            href={c.href}
            className="group flex items-center justify-between rounded-2xl bg-card p-5 ring-1 ring-white/10 transition-all hover:-translate-y-0.5 hover:ring-accent-blue/50"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary">
                <c.icon className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <div className="text-body font-black">{c.title}</div>
                <div className="text-caption text-muted-foreground">{c.subtitle}</div>
                {c.badge && (
                  <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-black ${c.badgeTone === "red" ? "bg-red-500/15 text-red-400" : "bg-accent-orange/15 text-accent-orange"}`}>
                    {c.badge}
                  </span>
                )}
              </div>
            </div>
            <ArrowLeft className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-1" />
          </Link>
        ))}
      </div>
    </div>
  );
}

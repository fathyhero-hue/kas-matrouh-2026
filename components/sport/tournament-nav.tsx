"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import type { TournamentSlug } from "@/lib/sport/tournaments";

const SECTIONS: { href: string; label: string }[] = [
  { href: "", label: "نظرة عامة" },
  { href: "/standings", label: "الترتيب" },
  { href: "/matches", label: "المباريات" },
  { href: "/knockout", label: "الأدوار الإقصائية" },
  { href: "/stats", label: "الإحصائيات" },
  { href: "/scorers", label: "الهدافين" },
  { href: "/cards", label: "البطاقات" },
  { href: "/rosters", label: "قوائم الفرق" },
  { href: "/team-of-week", label: "تشكيلة الجولة" },
  { href: "/motm", label: "نجم المباراة" },
  { href: "/fantasy", label: "توقع واكسب" },
];

export function TournamentNav({ slug }: { slug: TournamentSlug }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const base = `/${slug}`;
  const edition = searchParams.get("edition");
  const suffix = edition ? `?edition=${edition}` : "";

  return (
    <nav dir="rtl" className="scrollbar-hide flex gap-1 overflow-x-auto px-4 pb-3 sm:px-6">
      {SECTIONS.map((s) => {
        const href = base + s.href;
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href + suffix}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-caption font-bold transition-colors",
              active ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}

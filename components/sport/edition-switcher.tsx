"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { TOURNAMENTS, type TournamentSlug } from "@/lib/sport/tournaments";

export function EditionSwitcher({ slug }: { slug: TournamentSlug }) {
  const config = TOURNAMENTS[slug];
  if (config.editions.length < 2) return null;

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentEdition = searchParams.get("edition") || config.defaultEdition;

  return (
    <div dir="rtl" className="flex gap-2 px-4 pb-3 sm:px-6">
      {config.editions.map((ed) => {
        const params = new URLSearchParams(searchParams.toString());
        if (ed.key === config.defaultEdition) params.delete("edition");
        else params.set("edition", ed.key);
        const qs = params.toString();
        const href = qs ? `${pathname}?${qs}` : pathname;
        const active = ed.key === currentEdition;

        return (
          <Link
            key={ed.key}
            href={href}
            className={cn(
              "rounded-full px-4 py-1.5 text-caption font-black transition-colors",
              active ? "bg-accent-blue text-background" : "bg-white/5 text-muted-foreground hover:text-foreground"
            )}
          >
            {ed.label}
          </Link>
        );
      })}
    </div>
  );
}

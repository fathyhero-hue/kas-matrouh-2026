import { cn } from "@/lib/utils";

const VARIANTS = {
  purple: "bg-primary/15 text-primary",
  green: "bg-accent-green/15 text-accent-green",
  blue: "bg-accent-blue/15 text-accent-blue",
  orange: "bg-accent-orange/15 text-accent-orange",
} as const;

export function StatPill({
  label,
  value,
  variant = "purple",
  className,
}: {
  label: string;
  value: string | number;
  variant?: keyof typeof VARIANTS;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-caption font-black", VARIANTS[variant], className)}>
      <span>{label}</span>
      <span>{value}</span>
    </span>
  );
}

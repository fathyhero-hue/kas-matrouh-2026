import { Radio } from "lucide-react";

export function NewsTicker({ text }: { text: string }) {
  if (!text) return null;

  return (
    <div dir="rtl" className="flex items-stretch border-b border-white/10 bg-brand-dark">
      <div className="flex shrink-0 items-center gap-1.5 bg-primary px-4 text-caption font-black text-primary-foreground">
        <Radio className="h-3.5 w-3.5" />
        <span>عاجل</span>
      </div>
      <div className="flex-1 overflow-hidden py-2.5">
        <div className="animate-marquee whitespace-nowrap text-caption font-bold text-foreground/90">{text}</div>
      </div>
    </div>
  );
}

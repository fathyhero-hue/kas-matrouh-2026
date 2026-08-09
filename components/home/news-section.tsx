import Image from "next/image";
import { PlayCircle, Newspaper } from "lucide-react";

export type NewsItem = {
  id: string;
  type: string | null;
  title: string | null;
  url: string | null;
  image_url: string | null;
  body: string | null;
};

export function NewsSection({ items }: { items: NewsItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="mb-5 flex items-center gap-2">
        <Newspaper className="h-5 w-5 text-accent-blue" />
        <h2 className="text-h2 font-black">آخر الأخبار</h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <a
            key={item.id}
            href={item.url || "#"}
            target={item.url ? "_blank" : undefined}
            rel="noreferrer"
            className="group overflow-hidden rounded-2xl bg-card ring-1 ring-white/10 transition-all hover:-translate-y-1 hover:ring-accent-blue/50"
          >
            <div className="relative aspect-video w-full bg-secondary">
              {item.image_url ? (
                <Image src={item.image_url} alt={item.title || ""} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition-transform group-hover:scale-105" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Newspaper className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              {item.type === "videos" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <PlayCircle className="h-10 w-10 text-white" />
                </div>
              )}
            </div>
            <div className="p-4">
              <div className="text-body font-black leading-snug">{item.title}</div>
              {item.body && <p className="mt-1.5 line-clamp-2 text-caption text-muted-foreground">{item.body}</p>}
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

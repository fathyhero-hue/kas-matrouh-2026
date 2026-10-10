import Link from "next/link";
import Image from "next/image";
import { ShoppingBag, IdCard, ArrowLeft } from "lucide-react";
import { createPublicClient } from "@/lib/supabase/public";
import { LiveMatchSections } from "@/components/home/live-match-sections";
import { NewsTicker } from "@/components/home/news-ticker";
import { NewsSection } from "@/components/home/news-section";
import { SponsorsMarquee } from "@/components/home/sponsors-marquee";

export const revalidate = 15;

const TOURNAMENT_CARDS = [
  { href: "/matrouh-cup", title: "كأس مطروح", subtitle: "البطولة الرئيسية", image: "/images/tournaments/matrouh-cup.png" },
  { href: "/elite-cup", title: "كأس النخبة", subtitle: "بطولة النخبة", image: "/images/tournaments/elite-cup.png" },
  { href: "/ramadan-cup", title: "بطولة حزب الشعب الجمهوري", subtitle: "البطولة الرمضانية", image: "/images/tournaments/republican-party.png" },
];

async function getTicker() {
  const supabase = createPublicClient();
  const { data } = await supabase.from("app_settings").select("value").eq("key", "ticker").maybeSingle();
  const value = data?.value;
  return value && typeof value === "object" && !Array.isArray(value) &&
    "text" in value && typeof value.text === "string" ? value.text : "";
}

async function getNews() {
  const supabase = createPublicClient();
  const { data } = await supabase.from("media").select("id, type, title, url, image_url, body").order("created_at", { ascending: false }).limit(6);
  return data || [];
}

export default async function NewHomePage() {
  const [ticker, news] = await Promise.all([getTicker(), getNews()]);

  return (
    <main dir="rtl" className="min-h-screen">
      <NewsTicker text={ticker} />

      <section className="mx-auto max-w-5xl px-4 pb-10 pt-12 text-center sm:px-6">
        <div className="mx-auto mb-4 h-20 w-20 overflow-hidden rounded-full shadow-[0_0_30px_rgba(75,22,144,0.5)]">
          <Image src="/logo-circle.png" alt="مطروح الرياضية" width={80} height={80} className="h-full w-full object-cover" priority />
        </div>
        <h1 className="text-display font-black">مطروح الرياضية</h1>
        <p className="mx-auto mt-2 max-w-md text-body font-medium text-muted-foreground">
          كل البطولات، النتائج، والإحصائيات في مكان واحد
        </p>
      </section>

      <LiveMatchSections />

      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <h2 className="mb-5 text-h2 font-black">اختر البطولة</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {TOURNAMENT_CARDS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="group rounded-2xl bg-card p-6 text-center ring-1 ring-white/10 transition-all hover:-translate-y-1 hover:ring-accent-blue/50"
            >
              <div className="mx-auto flex h-24 w-24 items-center justify-center">
                <Image src={t.image} alt={t.title} width={96} height={96} sizes="96px" className="h-full w-full object-contain" />
              </div>
              <div className="mt-3 text-h3 font-black">{t.title}</div>
              <div className="mt-1 text-caption text-muted-foreground">{t.subtitle}</div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-3 px-4 pb-4 sm:grid-cols-2 sm:px-6">
        <Link
          href="/shop"
          className="group flex items-center justify-between rounded-2xl bg-gradient-to-l from-primary/20 to-primary/5 p-5 ring-1 ring-primary/30 transition-all hover:ring-primary/60"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary">
              <ShoppingBag className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <div className="text-body font-black">المتجر الرياضي</div>
              <div className="text-caption text-muted-foreground">تيشرتات، كابات، ومنتجات رسمية</div>
            </div>
          </div>
          <ArrowLeft className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-1" />
        </Link>

        <Link
          href="/player-card"
          className="group flex items-center justify-between rounded-2xl bg-gradient-to-l from-accent-blue/20 to-accent-blue/5 p-5 ring-1 ring-accent-blue/30 transition-all hover:ring-accent-blue/60"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-blue">
              <IdCard className="h-5 w-5 text-background" />
            </div>
            <div>
              <div className="text-body font-black">تسجيل كارت اللاعب</div>
              <div className="text-caption text-muted-foreground">اعمل بطاقتك التعريفية الرسمية</div>
            </div>
          </div>
          <ArrowLeft className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-1" />
        </Link>
      </section>

      <NewsSection items={news} />

      <SponsorsMarquee />
    </main>
  );
}

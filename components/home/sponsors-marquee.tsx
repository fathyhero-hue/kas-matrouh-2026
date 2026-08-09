const SPONSORS = [
  { name: "الفهد للديكور", src: "/alfahd.png" },
  { name: "أحمد عبدالعاطي المحامي", src: "/abdelaty.png" },
  { name: "دثار للزي العربي", src: "/dithar.png" },
  { name: "هيرو سبورت", src: "/hero-sport.png" },
];

export function SponsorsMarquee() {
  const track = [...SPONSORS, ...SPONSORS]; // duplicated for a seamless loop

  return (
    <section className="border-y border-white/10 bg-brand-dark py-10">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <p className="mb-6 text-center text-caption font-black uppercase tracking-[0.2em] text-muted-foreground">برعاية</p>

        <div
          className="group/marquee overflow-hidden"
          style={{ maskImage: "linear-gradient(to left, transparent, black 10%, black 90%, transparent)", WebkitMaskImage: "linear-gradient(to left, transparent, black 10%, black 90%, transparent)" }}
        >
          <div className="animate-marquee flex w-max items-center gap-5 group-hover/marquee:[animation-play-state:paused]">
            {track.map((s, i) => (
              <div
                key={s.name + i}
                className="flex h-20 w-40 shrink-0 items-center justify-center rounded-2xl bg-card ring-1 ring-white/10 transition-all hover:ring-accent-blue/40"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.src} alt={s.name} className="max-h-10 w-auto object-contain opacity-75 grayscale transition-all hover:opacity-100 hover:grayscale-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

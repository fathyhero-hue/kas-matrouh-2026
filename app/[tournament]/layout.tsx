import { notFound } from "next/navigation";
import { isTournamentSlug, TOURNAMENTS } from "@/lib/sport/tournaments";
import { TournamentNav } from "@/components/sport/tournament-nav";
import { EditionSwitcher } from "@/components/sport/edition-switcher";

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ tournament: string }>;
};

export default async function TournamentLayout({ children, params }: LayoutProps) {
  const { tournament: slug } = await params;
  if (!isTournamentSlug(slug)) notFound();

  const config = TOURNAMENTS[slug];

  return (
    <div>
      <div className="border-b border-white/10 bg-brand-dark">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-6 sm:px-6">
          <span className="text-4xl">{config.icon}</span>
          <h1 className="text-h1 font-black">{config.label}</h1>
        </div>
        <EditionSwitcher slug={slug} />
        <TournamentNav slug={slug} />
      </div>
      <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6">{children}</div>
    </div>
  );
}

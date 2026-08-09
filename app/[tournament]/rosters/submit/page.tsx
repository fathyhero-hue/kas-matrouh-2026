import { notFound } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { isTournamentSlug, resolveEdition, TOURNAMENTS, type TournamentPageProps } from "@/lib/sport/tournaments";
import { EmptyState } from "@/components/sport/empty-state";
import { RosterSubmitForm } from "@/components/roster/roster-submit-form";

const MAX_PLAYERS: Record<string, number> = {
  "elite-cup": 11,
};

const SUPPORTS_SUBMISSION = new Set(["matrouh-cup", "elite-cup"]);

export default async function RosterSubmitPage({ params, searchParams }: TournamentPageProps) {
  const { tournament: slug } = await params;
  if (!isTournamentSlug(slug)) notFound();
  const { edition: editionKey } = await searchParams;
  const edition = resolveEdition(slug, editionKey);
  const config = TOURNAMENTS[slug];

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6 flex items-center gap-3">
        <ClipboardList className="h-7 w-7 text-accent-blue" />
        <h1 className="text-h1 font-black">تقديم قائمة الفريق</h1>
      </div>

      {SUPPORTS_SUBMISSION.has(slug) ? (
        <RosterSubmitForm
          tournament={config.tournament}
          suffix={edition.suffix}
          maxPlayers={MAX_PLAYERS[slug] || 12}
        />
      ) : (
        <EmptyState message="تقديم القوائم غير متاح لهذه البطولة حالياً" />
      )}
    </div>
  );
}

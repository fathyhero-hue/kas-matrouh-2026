import { IdCard } from "lucide-react";
import { createPublicClient } from "@/lib/supabase/public";
import { RegistrationForm } from "@/components/player-card/registration-form";
import { EmptyState } from "@/components/sport/empty-state";
import { TOURNAMENTS, resolveEdition, type TournamentSlug } from "@/lib/sport/tournaments";
import { normalize } from "@/lib/sport/roster-link";

export const revalidate = 30;

// Only these two have a real roster/access-code system (see
// app/[tournament]/rosters/submit/page.tsx's SUPPORTS_SUBMISSION) — matching
// a player_registration_tournaments row's name against one of them is what
// turns on the secret-code gate + real team/player picker for that campaign.
const LINKABLE_SLUGS: TournamentSlug[] = ["matrouh-cup", "elite-cup"];

function resolveLinkedTournament(name: string): { tournamentKey: string; suffix: string } | null {
  const target = normalize(name);
  for (const slug of LINKABLE_SLUGS) {
    const config = TOURNAMENTS[slug];
    const label = normalize(config.label);
    // player_registration_tournaments rows are named e.g. "بطولة كأس مطروح"
    // while TOURNAMENTS labels are just "كأس مطروح" — match either containing
    // the other instead of requiring exact equality.
    if (target === label || target.includes(label) || label.includes(target)) {
      return { tournamentKey: config.tournament, suffix: resolveEdition(slug, undefined).suffix };
    }
  }
  return null;
}

export default async function PlayerCardPage() {
  const supabase = createPublicClient();
  const { data: tournaments } = await supabase
    .from("player_registration_tournaments")
    .select("id, name, logo_url")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const rows = (tournaments || []).map((t) => ({ ...t, linkedTournament: resolveLinkedTournament(t.name) }));

  return (
    <main dir="rtl" className="mx-auto max-w-xl px-4 pb-16 pt-8 sm:px-6">
      <div className="mb-8 flex items-center gap-3">
        <IdCard className="h-8 w-8 text-accent-blue" />
        <h1 className="text-h1 font-black">تسجيل كارت اللاعب</h1>
      </div>

      {rows.length === 0 ? (
        <EmptyState message="لسه مفيش بطولات مفتوحة للتسجيل" />
      ) : (
        <RegistrationForm tournaments={rows} />
      )}
    </main>
  );
}

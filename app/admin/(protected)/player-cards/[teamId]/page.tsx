import { notFound } from "next/navigation";
import { requireAdminPagePermission } from "@/lib/admin/authorization";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getPlayerCardTeamById } from "@/lib/player-cards/data";
import { PlayerCardsManager } from "@/components/admin/player-cards-manager";

export const dynamic = "force-dynamic";

export default async function PlayerCardsTeamPage({ params, searchParams }: { params: Promise<{ teamId: string }>; searchParams: Promise<{ tournament?: string }> }) {
  await requireAdminPagePermission("tournaments.player-cards.manage");
  const [{ teamId }, query] = await Promise.all([params, searchParams]);
  const team = await getPlayerCardTeamById(createServiceRoleClient(), teamId);
  if (!team) notFound();
  return <PlayerCardsManager team={team} tournament={query.tournament === "elite-cup" ? "كأس النخبة" : query.tournament || "البطولة"} />;
}

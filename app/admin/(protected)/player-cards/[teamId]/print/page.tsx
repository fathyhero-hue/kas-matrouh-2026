import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import QRCode from "qrcode";
import { requireAdminPagePermission } from "@/lib/admin/authorization";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { calculateA4Pages } from "@/lib/player-cards/pagination";
import { chunk } from "@/lib/player-cards/layout";
import { renderCardSvg, type CardRenderData } from "@/lib/player-cards/renderer";
import { getPlayerCardTeamById, type PlayerCardTeam } from "@/lib/player-cards/data";
import { PdfDownloadButton } from "@/components/admin/pdf-download-button";
import { PrintButton } from "@/components/admin/print-button";
import { PlayerCardsPrintPreview } from "@/components/admin/player-cards-print-preview";

export const dynamic = "force-dynamic";

function toCard(team: PlayerCardTeam, player: PlayerCardTeam["players"][number]): CardRenderData {
  const overrides = player.card?.display_overrides || {};
  return {
    fullName: player.name,
    role: "player",
    roleLabel: "\u0644\u0627\u0639\u0628",
    team: team.teamName,
    teamLogoUrl: team.logoUrl || undefined,
    tournament: "\u0643\u0623\u0633 \u0627\u0644\u0646\u062e\u0628\u0629",
    serial: player.card!.card_number,
    qrPayload: JSON.stringify({ type: "player-card", card: player.card!.card_number, player: player.id }),
    photoUrl: player.photoUrl || undefined,
    cropX: Number(overrides.cropX ?? 50),
    cropY: Number(overrides.cropY ?? 50),
    zoom: Number(overrides.zoom ?? 1),
    registrationDate: new Date().toISOString().slice(0, 10),
  };
}

async function renderPrintPages(cards: CardRenderData[]) {
  return Promise.all(chunk(cards, 4).map(async (items) => ({
    faces: await Promise.all(items.map(async (card) => {
      const qrDataUrl = await QRCode.toDataURL(card.qrPayload, { width: 220, margin: 0 });
      return {
        front: renderCardSvg(card, "front", qrDataUrl),
        back: renderCardSvg(card, "back", qrDataUrl),
      };
    })),
  })));
}

export default async function PlayerCardsPrintPage({ params }: { params: Promise<{ teamId: string }> }) {
  await requireAdminPagePermission("tournaments.player-cards.manage");
  const { teamId } = await params;
  const team = await getPlayerCardTeamById(createServiceRoleClient(), teamId);
  if (!team) notFound();

  const cards = team.players.filter((player) => player.card).map((player) => toCard(team, player));
  const pages = await renderPrintPages(cards);
  const pageCount = calculateA4Pages(cards.length);

  return (
    <main dir="rtl" className="min-h-screen bg-slate-100 p-3 text-black sm:p-6 print:bg-white print:p-0">
      <div className="screen-only mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/admin/player-cards/${team.id}`} className="mb-2 inline-flex items-center gap-2 text-caption font-black text-muted-foreground"><ArrowRight className="h-4 w-4" />{`\u0627\u0644\u0639\u0648\u062f\u0629 \u0644\u0644\u0641\u0631\u064a\u0642`}</Link>
          <h1 className="text-h2 font-black">{`\u0645\u0639\u0627\u064a\u0646\u0629 \u0628\u0637\u0627\u0642\u0627\u062a ${team.teamName}`}</h1>
          <p className="mt-1 text-caption text-gray-500">{`${cards.length} \u0628\u0637\u0627\u0642\u0629 · ${pageCount} \u0635\u0641\u062d\u0627\u062a · 4 \u0648\u062c\u0648\u0647 \u0623\u0645\u0627\u0645\u064a\u0629 + 4 \u062e\u0644\u0641\u064a\u0629 \u0644\u0643\u0644 \u0635\u0641\u062d\u0629`}</p>
        </div>
        <div className="flex gap-2"><PrintButton />{cards.length > 0 && <PdfDownloadButton cards={cards} filename={`${team.teamName}-player-cards.pdf`} />}</div>
      </div>

      {pages.length === 0 ? <div className="screen-only py-20 text-center text-gray-500">{`\u0644\u0627 \u062a\u0648\u062c\u062f \u0628\u0637\u0627\u0642\u0627\u062a \u062c\u0627\u0647\u0632\u0629 \u0644\u0644\u0637\u0628\u0627\u0639\u0629.`}</div> : <PlayerCardsPrintPreview pages={pages} cardCount={cards.length} />}
    </main>
  );
}

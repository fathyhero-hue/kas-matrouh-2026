import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { requireAdminPagePermission } from "@/lib/admin/authorization";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { calculateA4Pages } from "@/lib/player-cards/pagination";
import { chunk } from "@/lib/player-cards/layout";
import { getPlayerCardTeamById, type PlayerCardTeam } from "@/lib/player-cards/data";
import { IdCard, type IdCardData } from "@/components/player-card/id-card";
import { PdfDownloadButton } from "@/components/admin/pdf-download-button";
import { PrintButton } from "@/components/admin/print-button";

export const dynamic = "force-dynamic";

function toCard(team: PlayerCardTeam, player: PlayerCardTeam["players"][number]): IdCardData {
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

export default async function PlayerCardsPrintPage({ params }: { params: Promise<{ teamId: string }> }) {
  await requireAdminPagePermission("tournaments.player-cards.manage");
  const { teamId } = await params;
  const team = await getPlayerCardTeamById(createServiceRoleClient(), teamId);
  if (!team) notFound();

  const cards = team.players.filter((player) => player.card).map((player) => toCard(team, player));
  const cardPages = calculateA4Pages(cards.length);
  const pages = [
    ...chunk(cards, 4).map((items) => ({ face: "front" as const, items })),
    ...chunk(cards, 4).map((items) => ({ face: "back" as const, items })),
  ];

  return (
    <main dir="rtl" className="min-h-screen bg-slate-100 p-3 text-black sm:p-6 print:bg-white print:p-0">
      <style>{`
        @page { size: A4 portrait; margin: 0; }
        .player-card-page { aspect-ratio: 210 / 297; background: #fff; box-shadow: 0 12px 40px rgba(15,23,42,.16); display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: repeat(2, minmax(0, 1fr)); gap: 6mm; padding: 10mm; margin: 0 auto 20px; width: min(100%, 794px); }
        .player-card-cell { min-width: 0; min-height: 0; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .player-card-cell .print-card-grid { display: block; width: 100%; }
        .player-card-cell [data-card-face] { width: 100%; max-width: none; border-radius: 0; box-shadow: none; }
        .player-card-cell svg { display: block; width: 100%; height: auto; }
        @media print { .screen-only { display: none !important; } .player-card-page { width: 210mm; height: 297mm; margin: 0; box-shadow: none; break-after: page; } }
      `}</style>

      <div className="screen-only mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/admin/player-cards/${team.id}`} className="mb-2 inline-flex items-center gap-2 text-caption font-black text-muted-foreground"><ArrowRight className="h-4 w-4" />{`\u0627\u0644\u0639\u0648\u062f\u0629 \u0644\u0644\u0641\u0631\u064a\u0642`}</Link>
          <h1 className="text-h2 font-black">{`\u0645\u0639\u0627\u064a\u0646\u0629 \u0628\u0637\u0627\u0642\u0627\u062a ${team.teamName}`}</h1>
          <p className="mt-1 text-caption text-gray-500">{`${cards.length} \u0628\u0637\u0627\u0642\u0629 \u00b7 ${cardPages} \u0635\u0641\u062d\u0627\u062a \u0644\u0644\u0648\u062c\u0647 \u00b7 ${pages.length} \u0635\u0641\u062d\u0629 \u0644\u0644\u0648\u062c\u0647\u064a\u0646`}</p>
        </div>
        <div className="flex gap-2"><PrintButton />{cards.length > 0 && <PdfDownloadButton cards={cards} filename={`${team.teamName}-player-cards.pdf`} />}</div>
      </div>

      {pages.length === 0 ? <div className="screen-only py-20 text-center text-gray-500">{`\u0644\u0627 \u062a\u0648\u062c\u062f \u0628\u0637\u0627\u0642\u0627\u062a \u062c\u0627\u0647\u0632\u0629 \u0644\u0644\u0637\u0628\u0627\u0639\u0629.`}</div> : pages.map((page, pageIndex) => (
        <section key={`${page.face}-${pageIndex}`} className="player-card-page">
          {page.items.map((card) => <div key={`${page.face}-${card.serial}`} className="player-card-cell"><IdCard data={card} face={page.face} /></div>)}
        </section>
      ))}
    </main>
  );
}

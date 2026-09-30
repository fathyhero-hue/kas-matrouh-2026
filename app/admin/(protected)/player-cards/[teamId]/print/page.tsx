import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { requireAdminPagePermission } from "@/lib/admin/authorization";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { calculateA4Pages } from "@/lib/player-cards/pagination";
import { getPlayerCardTeamById } from "@/lib/player-cards/data";
import { IdCard, type IdCardData } from "@/components/player-card/id-card";
import { PdfDownloadButton } from "@/components/admin/pdf-download-button";
import { PrintButton } from "@/components/admin/print-button";

export const dynamic = "force-dynamic";

export default async function PlayerCardsPrintPage({ params }: { params: Promise<{ teamId: string }> }) {
  await requireAdminPagePermission("tournaments.player-cards.manage");
  const { teamId } = await params;
  const team = await getPlayerCardTeamById(createServiceRoleClient(), teamId);
  if (!team) notFound();

  const cards: IdCardData[] = team.players.filter((player) => player.card).map((player) => {
    const overrides = player.card?.display_overrides || {};
    return {
      fullName: player.name,
      role: "player",
      roleLabel: "لاعب",
      team: team.teamName,
      teamLogoUrl: team.logoUrl || undefined,
      tournament: "كأس النخبة",
      serial: player.card!.card_number,
      qrPayload: JSON.stringify({ type: "player-card", card: player.card!.card_number, player: player.id }),
      photoUrl: player.photoUrl || undefined,
      cropX: Number(overrides.cropX ?? 50),
      cropY: Number(overrides.cropY ?? 50),
      zoom: Number(overrides.zoom ?? 1),
      registrationDate: new Date().toISOString().slice(0, 10),
    };
  });
  const pages = calculateA4Pages(cards.length);

  return <main dir="rtl" className="min-h-screen bg-white p-6 text-black print:p-0">
    <style>{`@page { size: A4 portrait; margin: 10mm; } .player-card-pages { display:grid; grid-template-columns:repeat(2,92mm); gap:6mm; justify-content:center; } .player-card-cell { width:92mm; break-inside:avoid; } .player-card-cell .print-card-grid { display:block; } .player-card-cell [data-card-face] { width:92mm; max-width:none; border-radius:0; box-shadow:none; } .player-card-cell svg { display:block; width:92mm; height:auto; } .player-card-cell:nth-child(4n) { break-after:page; } @media print { .print-only-page { break-after:page; } }`}</style>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden"><div><Link href={`/admin/player-cards/${team.id}`} className="mb-2 inline-flex items-center gap-2 text-caption font-black text-muted-foreground"><ArrowRight className="h-4 w-4" />العودة للفريق</Link><h1 className="text-h2 font-black">معاينة بطاقات {team.teamName}</h1><p className="mt-1 text-caption text-gray-500">{cards.length} بطاقة · {pages} صفحات A4 · المعروض هنا الوجه الأمامي. التنزيل الفردي يحفظ الوجهين.</p></div><div className="flex gap-2"><PrintButton />{cards.length > 0 && <PdfDownloadButton cards={cards} filename={`${team.teamName}-player-cards.pdf`} />}</div></div>
    {cards.length === 0 ? <div className="py-20 text-center text-gray-500 print:hidden">لا توجد بطاقات جاهزة للطباعة.</div> : <div className="player-card-pages">{cards.map((card) => <div key={card.serial} className="player-card-cell"><IdCard data={card} face="front" /></div>)}</div>}
  </main>;
}

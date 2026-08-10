import { createServiceRoleClient } from "@/lib/supabase/server";
import { IdCard, type IdCardData } from "@/components/player-card/id-card";
import { PrintButton } from "@/components/admin/print-button";
import { PdfDownloadButton } from "@/components/admin/pdf-download-button";

export const dynamic = "force-dynamic";

// Fetched server-side (no CORS restrictions here) and inlined as a data URI so the
// browser never needs a cross-origin fetch when rasterizing the card for PDF export.
async function toDataUri(url: string | null | undefined): Promise<string | undefined> {
  if (!url) return undefined;
  if (url.startsWith("data:")) return url;
  try {
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const contentType = res.headers.get("content-type") || "image/png";
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:${contentType};base64,${buf.toString("base64")}`;
  } catch {
    return undefined;
  }
}

export default async function RegistrationsPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ tournament?: string }>;
}) {
  const { tournament } = await searchParams;
  const supabase = createServiceRoleClient();
  let query = supabase.from("player_registrations").select("*").order("team_name", { ascending: true });
  if (tournament) query = query.eq("tournament_name", tournament);
  const { data: registrations } = await query;
  const rows = registrations || [];

  const cards: IdCardData[] = await Promise.all(
    rows.map(async (r: any) => {
      const [photoUrl, tournamentLogoUrl] = await Promise.all([toDataUri(r.photo_url), toDataUri(r.tournament_logo_url)]);
      return {
        fullName: r.full_name,
        role: r.role,
        roleLabel: r.role_label,
        team: r.team_name || "لاعب حر",
        tournament: r.tournament_name,
        tournamentLogoUrl,
        serial: r.serial_number,
        qrPayload: r.qr_payload,
        birthDate: r.birth_date,
        registrationDate: r.registration_date,
        nationalId: r.national_id,
        photoUrl,
        cropX: r.crop_x,
        cropY: r.crop_y,
        zoom: r.zoom,
      };
    })
  );

  return (
    <main dir="rtl" className="min-h-screen bg-white p-6 text-black print:p-0">
      <style>{`
        @page { size: A4; margin: 8mm; }
        @media print {
          html, body { background: white; }
        }
        .print-page {
          display: grid;
          grid-template-columns: repeat(2, 94mm);
          gap: 5mm;
          justify-content: center;
          align-content: center;
        }
        .print-card-cell {
          break-inside: avoid;
        }
        .print-card-cell:nth-child(4n) {
          break-after: page;
        }
      `}</style>

      <h1 className="mb-4 text-h2 font-black text-black print:hidden">
        بطاقات المسجّلين {tournament ? `— ${tournament}` : ""} ({cards.length})
      </h1>

      {cards.length === 0 ? (
        <p className="text-body text-gray-500 print:hidden">لا توجد بطاقات لتصديرها.</p>
      ) : (
        <div className="print-page">
          {cards.map((data, i) => (
            <div key={rows[i].id} className="print-card-cell" data-print-card>
              <IdCard data={data} />
            </div>
          ))}
        </div>
      )}

      <PrintButton />
      {cards.length > 0 && <PdfDownloadButton filename={`player-cards${tournament ? `-${tournament}` : ""}.pdf`} />}
    </main>
  );
}

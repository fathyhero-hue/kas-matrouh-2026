import { createServiceRoleClient } from "@/lib/supabase/server";
import { IdCard, type IdCardData } from "@/components/player-card/id-card";
import { PrintButton } from "@/components/admin/print-button";

export const dynamic = "force-dynamic";

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

  return (
    <main dir="rtl" className="min-h-screen bg-white p-6 text-black print:p-0">
      <style>{`
        @page { size: A4; margin: 10mm; }
        @media print {
          html, body { background: white; }
        }
        .print-page {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10mm;
          justify-items: center;
          align-content: start;
        }
        .print-card-cell {
          width: 90mm;
          break-inside: avoid;
        }
        .print-card-cell:nth-child(4n) {
          break-after: page;
        }
      `}</style>

      <h1 className="mb-4 text-h2 font-black text-black print:hidden">
        بطاقات المسجّلين {tournament ? `— ${tournament}` : ""} ({rows.length})
      </h1>

      {rows.length === 0 ? (
        <p className="text-body text-gray-500 print:hidden">لا توجد بطاقات لتصديرها.</p>
      ) : (
        <div className="print-page">
          {rows.map((r: any) => {
            const data: IdCardData = {
              fullName: r.full_name,
              role: r.role,
              roleLabel: r.role_label,
              team: r.team_name || "لاعب حر",
              tournament: r.tournament_name,
              tournamentLogoUrl: r.tournament_logo_url || undefined,
              serial: r.serial_number,
              qrPayload: r.qr_payload,
              birthDate: r.birth_date,
              registrationDate: r.registration_date,
              nationalId: r.national_id,
              photoUrl: r.photo_url,
              cropX: r.crop_x,
              cropY: r.crop_y,
              zoom: r.zoom,
            };
            return (
              <div key={r.id} className="print-card-cell">
                <IdCard data={data} />
              </div>
            );
          })}
        </div>
      )}

      <PrintButton />
    </main>
  );
}

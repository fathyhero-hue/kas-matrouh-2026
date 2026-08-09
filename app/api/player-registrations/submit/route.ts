import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const fullName = String(form.get("fullName") || "").trim();
    const birthDate = String(form.get("birthDate") || "").trim();
    const nationalId = String(form.get("nationalId") || "").trim();
    const teamName = String(form.get("teamName") || "لاعب حر").trim();
    const role = String(form.get("role") || "player");
    const roleLabel = String(form.get("roleLabel") || "");
    const tournamentId = String(form.get("tournamentId") || "") || null;
    const tournamentName = String(form.get("tournamentName") || "بطولة رياضية");
    const tournamentLogoUrl = String(form.get("tournamentLogoUrl") || "");
    const brandLogoUrl = String(form.get("brandLogoUrl") || "");
    const cropX = Number(form.get("cropX") || 50);
    const cropY = Number(form.get("cropY") || 50);
    const zoom = Number(form.get("zoom") || 1);
    const serialNumber = String(form.get("serialNumber") || "");
    const qrPayload = String(form.get("qrPayload") || "");
    const registrationDate = String(form.get("registrationDate") || new Date().toISOString().slice(0, 10));

    if (!fullName || !birthDate || !nationalId) {
      return NextResponse.json({ error: "بيانات التسجيل غير مكتملة." }, { status: 400 });
    }

    const supabase = createServiceRoleClient();

    let photoUrl = String(form.get("existingPhotoUrl") || "");
    const photoFile = form.get("photo") as File | null;
    if (photoFile) {
      const safeName = `${Date.now()}_${fullName.replace(/[^\w؀-ۿ-]+/g, "_")}.jpg`;
      const { error } = await supabase.storage.from("player-registration-photos").upload(safeName, photoFile, { contentType: photoFile.type, upsert: true });
      if (!error) {
        const { data } = supabase.storage.from("player-registration-photos").getPublicUrl(safeName);
        photoUrl = data.publicUrl;
      }
    }

    const { data: row, error: insertErr } = await supabase
      .from("player_registrations")
      .insert({
        player_name: fullName,
        full_name: fullName,
        role,
        role_label: roleLabel,
        team_name: teamName,
        birth_date: birthDate,
        national_id: nationalId,
        registration_date: registrationDate,
        tournament_id: tournamentId,
        tournament_name: tournamentName,
        tournament_logo_url: tournamentLogoUrl,
        brand_logo_url: brandLogoUrl,
        photo_url: photoUrl,
        crop_x: cropX,
        crop_y: cropY,
        zoom,
        serial_number: serialNumber,
        qr_payload: qrPayload,
        status: "new",
      })
      .select("id")
      .single();

    if (insertErr || !row) {
      console.error("Player registration insert failed:", insertErr);
      return NextResponse.json({ error: "فشل حفظ بيانات التسجيل." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: row.id, photoUrl });
  } catch (error: any) {
    console.error("Player registration submit error:", error);
    return NextResponse.json({ error: error?.message || "حدث خطأ أثناء التسجيل." }, { status: 500 });
  }
}

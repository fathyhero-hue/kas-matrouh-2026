import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const KINDS = new Set(["logo", "coach", "personal", "id"]);

// One photo per request — called repeatedly by the roster submit form after
// /api/roster/submit creates the team/player rows, so no single request ever
// carries more than one file (avoids the Vercel body-size 413 that a whole
// squad's photos in one request used to hit).
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const rosterId = String(form.get("rosterId") || "");
    const kind = String(form.get("kind") || "");
    const playerId = String(form.get("playerId") || "");
    const file = form.get("file") as File | null;

    if (!rosterId || !file) return NextResponse.json({ error: "بيانات الرفع غير مكتملة." }, { status: 400 });
    if (!KINDS.has(kind)) return NextResponse.json({ error: "نوع الصورة غير معروف." }, { status: 400 });
    if (kind !== "logo" && kind !== "coach" && !playerId) return NextResponse.json({ error: "بيانات اللاعب غير مكتملة." }, { status: 400 });
    if (file.size > MAX_PHOTO_BYTES) return NextResponse.json({ error: "حجم الصورة كبير جداً (أقصى حد 2 ميجا)." }, { status: 400 });

    const supabase = createServiceRoleClient();

    // Confirm rosterId (and playerId, if given) actually belong to this
    // roster before writing anywhere.
    const { data: roster } = await supabase.from("team_rosters").select("id").eq("id", rosterId).maybeSingle();
    if (!roster) return NextResponse.json({ error: "فريق غير معروف." }, { status: 400 });
    if (playerId) {
      const { data: player } = await supabase.from("roster_players").select("id").eq("id", playerId).eq("roster_id", rosterId).maybeSingle();
      if (!player) return NextResponse.json({ error: "لاعب غير معروف." }, { status: 400 });
    }

    const path = `${rosterId}/${kind}_${playerId || "team"}_${Date.now()}`;
    const { error: uploadErr } = await supabase.storage.from("roster-photos").upload(path, file, { contentType: file.type, upsert: true });
    if (uploadErr) {
      console.error("Roster photo upload failed:", uploadErr);
      return NextResponse.json({ error: "فشل رفع الصورة." }, { status: 500 });
    }

    const { data: signed } = await supabase.storage.from("roster-photos").createSignedUrl(path, 60 * 60 * 24 * 365);
    const url = signed?.signedUrl || "";

    if (kind === "logo") {
      await supabase.from("team_rosters").update({ logo_url: url }).eq("id", rosterId);
    } else if (kind === "coach") {
      await supabase.from("team_rosters").update({ coach_photo_url: url }).eq("id", rosterId);
    } else if (kind === "personal") {
      await supabase.from("roster_players").update({ personal_image_url: url }).eq("id", playerId);
    } else {
      await supabase.from("roster_players").update({ id_image_url: url }).eq("id", playerId);
    }

    return NextResponse.json({ ok: true, url });
  } catch (error: any) {
    console.error("Roster photo upload error:", error);
    return NextResponse.json({ error: error?.message || "فشل رفع الصورة." }, { status: 500 });
  }
}

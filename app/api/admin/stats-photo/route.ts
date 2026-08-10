import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

// Manual-upload fallback for players who aren't in any submitted roster yet
// (e.g. a late substitute) — used by goals/cards/motm/team-of-week forms
// instead of asking the admin to paste an image URL.
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("photo") as File | null;
    if (!file) return NextResponse.json({ error: "لم يتم إرفاق صورة." }, { status: 400 });
    if (file.size > MAX_PHOTO_BYTES) return NextResponse.json({ error: "حجم الصورة كبير جداً (أقصى حد 2 ميجا)." }, { status: 400 });

    const supabase = createServiceRoleClient();
    const ext = file.type === "image/png" ? "png" : "jpg";
    // ASCII-safe path (Supabase Storage rejects non-ASCII keys) under the
    // existing public player-registration-photos bucket.
    const path = `stats/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("player-registration-photos").upload(path, file, { contentType: file.type, upsert: true });
    if (error) {
      console.error("Stats photo upload failed:", error);
      return NextResponse.json({ error: "فشل رفع الصورة." }, { status: 500 });
    }

    const { data } = supabase.storage.from("player-registration-photos").getPublicUrl(path);
    return NextResponse.json({ ok: true, url: data.publicUrl });
  } catch (error: any) {
    console.error("Stats photo upload error:", error);
    return NextResponse.json({ error: error?.message || "فشل رفع الصورة." }, { status: 500 });
  }
}

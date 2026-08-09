import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest) {
  try {
    const form = await req.formData();
    const id = String(form.get("id") || "");
    if (!id) return NextResponse.json({ error: "معرّف التسجيل مفقود." }, { status: 400 });

    const supabase = createServiceRoleClient();

    const patch: Record<string, any> = {};
    const setIfPresent = (formKey: string, column: string) => {
      const value = form.get(formKey);
      if (value !== null) patch[column] = String(value);
    };
    setIfPresent("fullName", "full_name");
    setIfPresent("fullName", "player_name");
    setIfPresent("role", "role");
    setIfPresent("roleLabel", "role_label");
    setIfPresent("teamName", "team_name");
    setIfPresent("birthDate", "birth_date");
    setIfPresent("nationalId", "national_id");
    setIfPresent("tournamentName", "tournament_name");
    if (form.get("cropX") !== null) patch.crop_x = Number(form.get("cropX"));
    if (form.get("cropY") !== null) patch.crop_y = Number(form.get("cropY"));
    if (form.get("zoom") !== null) patch.zoom = Number(form.get("zoom"));

    const photoFile = form.get("photo") as File | null;
    if (photoFile && photoFile.size > 0) {
      if (photoFile.size > 4 * 1024 * 1024) return NextResponse.json({ error: "حجم الصورة كبير (أقصى 4 ميجا)." }, { status: 400 });
      // Supabase Storage rejects non-ASCII keys, so use the row id + timestamp — never user-provided text.
      const ext = photoFile.type.split("/")[1] || "jpg";
      const path = `${id}_${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("player-registration-photos").upload(path, photoFile, { contentType: photoFile.type, upsert: true });
      if (error) {
        console.error("Admin player registration photo upload failed:", error);
        return NextResponse.json({ error: "فشل رفع الصورة." }, { status: 500 });
      }
      const { data } = supabase.storage.from("player-registration-photos").getPublicUrl(path);
      patch.photo_url = data.publicUrl;
    }

    if (Object.keys(patch).length === 0) return NextResponse.json({ error: "لا يوجد تعديل." }, { status: 400 });

    const { data: row, error: updateErr } = await supabase.from("player_registrations").update(patch).eq("id", id).select().single();
    if (updateErr || !row) {
      console.error("Admin player registration update error:", updateErr);
      return NextResponse.json({ error: "فشل حفظ التعديل." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, row });
  } catch (error: any) {
    console.error("Admin player registration patch error:", error);
    return NextResponse.json({ error: error?.message || "فشل حفظ التعديل." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "معرّف التسجيل مفقود." }, { status: 400 });
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from("player_registrations").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Admin player registration delete error:", error);
    return NextResponse.json({ error: error?.message || "فشل الحذف." }, { status: 500 });
  }
}

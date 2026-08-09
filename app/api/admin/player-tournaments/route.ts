import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const id = String(form.get("id") || "") || undefined;
    const name = String(form.get("name") || "").trim();
    const sortOrder = Number(form.get("sort_order") || 0);
    const isActive = String(form.get("is_active") || "true") === "true";
    const logoFile = form.get("logo") as File | null;

    if (!name) return NextResponse.json({ error: "اكتب اسم البطولة." }, { status: 400 });

    const supabase = createServiceRoleClient();
    let logoUrl = String(form.get("existing_logo_url") || "");

    if (logoFile && logoFile.size > 0) {
      const safeName = name.replace(/[^\w؀-ۿ-]+/g, "_").slice(0, 40);
      const ext = logoFile.type.split("/")[1] || "png";
      const path = `${Date.now()}_${safeName}.${ext}`;
      const { error } = await supabase.storage.from("tournament-logos").upload(path, logoFile, { contentType: logoFile.type, upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("tournament-logos").getPublicUrl(path);
      logoUrl = data.publicUrl;
    }

    const patch = { name, logo_url: logoUrl, sort_order: sortOrder, is_active: isActive };
    const query = id
      ? await supabase.from("player_registration_tournaments").update(patch).eq("id", id).select().single()
      : await supabase.from("player_registration_tournaments").insert(patch).select().single();

    if (query.error) throw query.error;
    return NextResponse.json({ ok: true, tournament: query.data });
  } catch (error: any) {
    console.error("Admin player tournament save error:", error);
    return NextResponse.json({ error: error?.message || "فشل الحفظ." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, ...patch } = await req.json();
    if (!id) return NextResponse.json({ error: "معرّف مفقود." }, { status: 400 });
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.from("player_registration_tournaments").update(patch).eq("id", id).select().single();
    if (error) throw error;
    return NextResponse.json({ ok: true, tournament: data });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "فشلت العملية." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "معرّف مفقود." }, { status: 400 });
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from("player_registration_tournaments").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "فشل الحذف." }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const id = String(form.get("id") || "") || undefined;
    const title = String(form.get("title") || "").trim();
    const price = Number(form.get("price") || 0);
    const category = String(form.get("category") || "");
    const description = String(form.get("description") || "");
    const stockRaw = String(form.get("stock") || "");
    const sortOrder = Number(form.get("sort_order") || 0);
    const isActive = String(form.get("is_active") || "true") === "true";
    const imageFile = form.get("image") as File | null;

    if (!title) return NextResponse.json({ error: "اكتب اسم المنتج." }, { status: 400 });

    const supabase = createServiceRoleClient();
    let imageUrl = String(form.get("existing_image_url") || "");

    if (imageFile && imageFile.size > 0) {
      // Supabase Storage rejects non-ASCII keys, so the (Arabic) title can't be part of the path.
      const ext = imageFile.type.split("/")[1] || "jpg";
      const path = `${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("shop-product-images").upload(path, imageFile, { contentType: imageFile.type, upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("shop-product-images").getPublicUrl(path);
      imageUrl = data.publicUrl;
    }

    const patch = {
      title,
      name: title,
      price,
      category,
      description,
      stock: stockRaw === "" ? null : Number(stockRaw),
      sort_order: sortOrder,
      is_active: isActive,
      image_url: imageUrl,
    };

    const query = id
      ? await supabase.from("shop_products").update(patch).eq("id", id).select().single()
      : await supabase.from("shop_products").insert(patch).select().single();

    if (query.error) throw query.error;
    return NextResponse.json({ ok: true, product: query.data });
  } catch (error: any) {
    console.error("Admin shop product save error:", error);
    return NextResponse.json({ error: error?.message || "فشل حفظ المنتج." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, ...patch } = await req.json();
    if (!id) return NextResponse.json({ error: "معرّف المنتج مفقود." }, { status: 400 });
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.from("shop_products").update(patch).eq("id", id).select().single();
    if (error) throw error;
    return NextResponse.json({ ok: true, product: data });
  } catch (error: any) {
    console.error("Admin shop product patch error:", error);
    return NextResponse.json({ error: error?.message || "فشلت العملية." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "معرّف المنتج مفقود." }, { status: 400 });
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from("shop_products").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Admin shop product delete error:", error);
    return NextResponse.json({ error: error?.message || "فشل حذف المنتج." }, { status: 500 });
  }
}

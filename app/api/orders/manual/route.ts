import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const name = String(form.get("name") || "").trim();
    const phone = String(form.get("phone") || "").trim();
    const address = String(form.get("address") || "").trim();
    const paymentMethod = String(form.get("paymentMethod") || "cash");
    const notes = String(form.get("notes") || "");
    const items = JSON.parse(String(form.get("items") || "[]"));
    const total = Number(form.get("total") || 0);

    if (!name || !phone || !address || !items.length) {
      return NextResponse.json({ error: "بيانات الطلب غير مكتملة." }, { status: 400 });
    }

    const supabase = createServiceRoleClient();

    let receiptUrl = "";
    const receiptFile = form.get("receiptImage") as File | null;
    if (receiptFile) {
      const path = `order_${Date.now()}`;
      const { error } = await supabase.storage.from("receipts").upload(path, receiptFile, { contentType: receiptFile.type, upsert: true });
      if (!error) {
        const { data: signed } = await supabase.storage.from("receipts").createSignedUrl(path, 60 * 60 * 24 * 365);
        receiptUrl = signed?.signedUrl || path;
      }
    }

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        type: "shop_order",
        source: "matrouhcup-shop",
        customer_name: name,
        customer_phone: phone,
        customer_address: address,
        customer_receipt_image_url: receiptUrl,
        customer_notes: notes,
        customer_raw: { name, phone, address, paymentMethod, notes, receiptImage: receiptUrl },
        total,
        currency: "EGP",
        payment_method: paymentMethod,
        payment_status: paymentMethod === "cash" ? "cash_on_delivery" : "manual_review",
        status_label: "طلب جديد",
      })
      .select("id")
      .single();

    if (orderErr || !order) {
      console.error("Manual order insert failed:", orderErr);
      return NextResponse.json({ error: "فشل إنشاء الطلب." }, { status: 500 });
    }

    await supabase.from("order_items").insert(
      items.map((item: any) => ({
        order_id: order.id,
        item_ref_id: item.id || null,
        title: item.title || item.name || "منتج رياضي",
        price: Number(item.price || 0),
        qty: Number(item.qty || 1),
        image_url: item.imageUrl || null,
      }))
    );

    return NextResponse.json({ ok: true, orderId: order.id });
  } catch (error: any) {
    console.error("Manual order error:", error);
    return NextResponse.json({ error: error?.message || "حدث خطأ أثناء إرسال الطلب." }, { status: 500 });
  }
}

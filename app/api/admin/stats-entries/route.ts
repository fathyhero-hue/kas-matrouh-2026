import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ALLOWED_TABLES = new Set(["goals", "cards", "motm"]);

export async function POST(req: NextRequest) {
  try {
    const { table, id, ...patch } = await req.json();
    if (!ALLOWED_TABLES.has(table)) return NextResponse.json({ error: "جدول غير مسموح." }, { status: 400 });
    const supabase = createServiceRoleClient();

    const query = id
      ? await supabase.from(table).update(patch).eq("id", id).select().single()
      : await supabase.from(table).insert(patch).select().single();

    if (query.error) throw query.error;
    return NextResponse.json({ ok: true, row: query.data });
  } catch (error: any) {
    console.error("Admin stats entry save error:", error);
    return NextResponse.json({ error: error?.message || "فشل الحفظ." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const table = req.nextUrl.searchParams.get("table") || "";
    const id = req.nextUrl.searchParams.get("id");
    if (!ALLOWED_TABLES.has(table)) return NextResponse.json({ error: "جدول غير مسموح." }, { status: 400 });
    if (!id) return NextResponse.json({ error: "معرّف مفقود." }, { status: 400 });
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Admin stats entry delete error:", error);
    return NextResponse.json({ error: error?.message || "فشل الحذف." }, { status: 500 });
  }
}

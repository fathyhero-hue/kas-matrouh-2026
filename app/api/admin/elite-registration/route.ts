import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { authorizeAdminRequest } from "@/lib/admin/authorization";
import { auditAdminMutation } from "@/lib/admin/audit";
import { ensureEliteTeamRoster } from "@/lib/paymob/elite-roster-sync";

export const runtime = "nodejs";

function normalizeTeamName(name: string): string {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/أ|إ|آ/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .toLowerCase();
}

function generateAccessPassword() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Admin-side cash confirmation. New confirmations are paid cash registrations;
// legacy manual_access rows remain untouched until their meaning is reviewed.
export async function POST(req: NextRequest) {
  const authorization = await authorizeAdminRequest(req, 'registrations.edit');
  if (authorization instanceof NextResponse) return authorization;
  try {
    const { teamName: teamNameRaw, managerName, phone } = await req.json();
    const teamName = String(teamNameRaw || "").trim();
    const supabase = createServiceRoleClient();
    const { data: officialTeams, error: teamsError } = await supabase.from("elite_teams").select("name").order("name", { ascending: true });
    if (teamsError) throw teamsError;
    const match = (officialTeams || []).map((row: { name: string }) => row.name).find((t) => normalizeTeamName(t) === normalizeTeamName(teamName));
    if (!match) return NextResponse.json({ error: "هذا الفريق غير مدرج ضمن الفرق المسموح لها بالاشتراك في كأس النخبة." }, { status: 400 });

    const { data: existingOrders } = await supabase
      .from("orders")
      .select("id, team_name, payment_status")
      .eq("tournament", "elite_cup")
      .eq("type", "tournament_registration")
      .in("payment_status", ["paid", "manual_access"]);

    const alreadyActive = (existingOrders || []).some((o: { team_name: string | null }) => normalizeTeamName(o.team_name || "") === normalizeTeamName(match));
    if (alreadyActive) return NextResponse.json({ error: `فريق "${match}" مفعّل بالفعل.` }, { status: 400 });

    const { data: settings } = await supabase.from("registration_settings").select("price").eq("tournament", "elite").maybeSingle();
    const price = Number(settings?.price || 1500);
    const accessPassword = generateAccessPassword();

    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        type: "tournament_registration",
        tournament: "elite_cup",
        tournament_label: "بطولة كأس النخبة",
        customer_name: managerName || match,
        customer_manager_name: managerName || null,
        customer_phone: phone || null,
        customer_team_name: match,
        team_name: match,
        manager_name: managerName || null,
        phone: phone || null,
        total: price,
        currency: "EGP",
        payment_method: "cash",
        payment_status: "paid",
        status_label: "تم الدفع نقداً وتأكيده من الإدارة",
        paid_at: new Date().toISOString(),
        confirmed_by: authorization.userId,
        access_password: accessPassword,
        roster_access_password: accessPassword,
        roster_access_active: true,
        admin_manual_access: false,
      })
      .select()
      .single();

    if (error || !order) throw error || new Error("فشل إنشاء التفعيل");

    await ensureEliteTeamRoster(supabase, { teamName: match, managerName, phone });

    await auditAdminMutation({
      actorUserId: authorization.userId,
      action: "elite_registration.cash_payment.confirm",
      permission: "registrations.edit",
      entityType: "orders",
      entityId: order.id,
      metadata: { changed_fields: ["payment_status", "payment_method", "paid_at", "confirmed_by"] },
      request: req,
    });
    return NextResponse.json({ ok: true, order });
  } catch (error: unknown) {
    console.error("Elite manual activation error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "فشل تأكيد الدفع النقدي." }, { status: 500 });
  }
}

// Reverts an admin-granted manual activation — never touches real Paymob
// payments (payment_status must currently be "manual_access").
export async function DELETE(req: NextRequest) {
  const authorization = await authorizeAdminRequest(req, 'registrations.edit');
  if (authorization instanceof NextResponse) return authorization;
  try {
    const orderId = req.nextUrl.searchParams.get("orderId");
    if (!orderId) return NextResponse.json({ error: "معرّف الطلب مفقود." }, { status: 400 });

    const supabase = createServiceRoleClient();
    const { data: order } = await supabase.from("orders").select("id, payment_status").eq("id", orderId).maybeSingle();
    if (!order) return NextResponse.json({ error: "الطلب غير موجود." }, { status: 404 });
    if (order.payment_status !== "manual_access") {
      return NextResponse.json({ error: "متاح إلغاؤه فقط للتفعيل اليدوي، مش للدفع الحقيقي." }, { status: 400 });
    }

    const { error } = await supabase
      .from("orders")
      .update({ payment_status: "cancelled", status_label: "تم إلغاء التفعيل اليدوي", roster_access_active: false, admin_manual_access: false })
      .eq("id", orderId);
    if (error) throw error;

    await auditAdminMutation({ actorUserId: authorization.userId, action: "orders.mutation", permission: "registrations.edit", entityType: "orders", request: req });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error("Elite manual deactivation error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "فشل إلغاء التفعيل." }, { status: 500 });
  }
}

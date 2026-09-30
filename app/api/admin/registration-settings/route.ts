import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { authorizeAdminRequest } from "@/lib/admin/authorization";
import { auditAdminMutation } from "@/lib/admin/audit";

export const runtime = "nodejs";

const REGISTRATION_KEYS = new Set(["matrouh", "elite", "ramadan"]);

function parseRegistrationKey(value: unknown) {
  return typeof value === "string" && REGISTRATION_KEYS.has(value) ? value : null;
}

function isDateOnly(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return date.getUTCFullYear() === Number(value.slice(0, 4))
    && date.getUTCMonth() + 1 === Number(value.slice(5, 7))
    && date.getUTCDate() === Number(value.slice(8, 10));
}

function parseDeadline(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  return isDateOnly(value) ? value : undefined;
}

export async function GET(req: NextRequest) {
  const authorization = await authorizeAdminRequest(req, "rosters.view");
  if (authorization instanceof NextResponse) return authorization;

  const tournament = parseRegistrationKey(req.nextUrl.searchParams.get("tournament"));
  if (!tournament) return NextResponse.json({ error: "A valid tournament is required." }, { status: 400 });

  try {
    const { data, error } = await createServiceRoleClient()
      .from("registration_settings")
      .select("tournament, deadline, password, price")
      .eq("tournament", tournament)
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json({ ok: true, settings: data });
  } catch (error: unknown) {
    console.error("Admin registration settings read error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load registration settings." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authorization = await authorizeAdminRequest(req, "rosters.settings.manage");
  if (authorization instanceof NextResponse) return authorization;
  try {
    const body = await req.json() as Record<string, unknown>;
    const tournament = parseRegistrationKey(body.tournament);
    const deadline = parseDeadline(body.deadline);
    const password = body.password ?? "";
    const price = body.price ?? 0;
    if (!tournament) return NextResponse.json({ error: "A valid tournament is required." }, { status: 400 });
    if (deadline === undefined) return NextResponse.json({ error: "Deadline must be a valid date (YYYY-MM-DD)." }, { status: 400 });
    if (typeof password !== "string") return NextResponse.json({ error: "Password must be a string." }, { status: 400 });
    if (typeof price !== "number" || !Number.isFinite(price) || price < 0) {
      return NextResponse.json({ error: "Price must be a non-negative number." }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("registration_settings")
      .upsert({ tournament, deadline, password, price }, { onConflict: "tournament" })
      .select()
      .single();
    if (error) throw error;
    await auditAdminMutation({ actorUserId: authorization.userId, action: "registration_settings.mutation", permission: "rosters.settings.manage", entityType: "registration_settings", request: req });
    return NextResponse.json({ ok: true, settings: data });
  } catch (error: unknown) {
    console.error("Admin registration settings save error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to save registration settings." }, { status: 500 });
  }
}

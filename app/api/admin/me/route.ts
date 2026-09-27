import { NextRequest, NextResponse } from "next/server";
import { adminAuthorizationResponse, requireAdminPermission } from "@/lib/admin/authorization";
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdminPermission(req);
    return NextResponse.json({ userId: auth.userId, role: auth.role, permissions: [...auth.permissions] });
  } catch (error) { return adminAuthorizationResponse(error); }
}

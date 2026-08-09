import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";

// Read-only admin check for Route Handlers (no response cookie refresh needed —
// middleware already refreshes the session on page navigations).
export async function getRouteAdmin(req: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll() {
          // no-op: this client is read-only within a Route Handler
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, isAdmin: false };

  const { data: profile } = await supabase.from("admin_profiles").select("user_id").eq("user_id", user.id).maybeSingle();
  return { user, isAdmin: !!profile };
}

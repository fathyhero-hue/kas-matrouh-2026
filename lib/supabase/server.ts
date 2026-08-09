import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client for use in Route Handlers only — bypasses RLS.
// Never import this in a "use client" component.
export function createServiceRoleClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

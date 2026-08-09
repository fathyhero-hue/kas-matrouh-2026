import { createClient } from "@supabase/supabase-js";

// Read-only client for Server Components rendering public pages. Uses the
// anon key (safe to expose — RLS is what actually scopes access), no
// cookies/session needed since these are public, unauthenticated reads.
//
// `cache: "no-store"` on every request is required here: Next.js
// auto-intercepts `fetch()` inside Server Components, and without this it
// was caching supabase-js's REST calls across *different* queries (e.g. one
// roster's lookup returning empty got served back for a completely
// different team). Each page already controls its own freshness via
// `export const revalidate`, so per-request caching here is redundant and
// actively wrong.
export function createPublicClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
}

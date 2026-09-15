// lib/supabase/client.ts
// Browser-side Supabase client, for client components that need to react to
// auth state directly (e.g. onAuthStateChange). Most of the app talks to
// Supabase through Server Actions/Route Handlers via lib/supabase/server.ts
// instead — this is only for the few places that need it client-side.

import { createBrowserClient } from "@supabase/ssr";
import { requireEnv } from "../env";

export function createClient() {
  return createBrowserClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"));
}

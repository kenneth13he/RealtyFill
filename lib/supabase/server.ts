// lib/supabase/server.ts
// Server-side Supabase client for Server Components, Route Handlers, and
// Server Actions. Always create a fresh client per request (per @supabase/ssr's
// own guidance) rather than sharing one across requests.
//
// `cookies()` is async in this Next.js version (see next/headers docs) — the
// setAll write can fail when called from a plain Server Component (which
// can't set cookies), which is expected and safe to ignore here since
// proxy.ts's session refresh is the real cookie-writing path for that case.

import { createServerClient } from "@supabase/ssr";
import { requireEnv } from "../env";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component render — can't set cookies there.
        }
      },
    },
  });
}

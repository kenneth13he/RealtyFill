// lib/supabase/admin.ts
// Service-role Supabase client — bypasses row-level security entirely.
// Server-only, and only for operations that genuinely need elevated
// privileges (e.g. issuing a signed Storage URL after this app's own code
// has already verified deal ownership). Never import this from anything
// that runs in the browser, and never use it as a shortcut around an
// ownership check — it removes the DB's own safety net, so the calling code
// becomes the only thing standing between one user and another user's data.

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requireEnv } from "../env";

export function createAdminClient() {
  return createSupabaseClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// lib/rateLimit.ts
// Sliding-window rate limiter backed by Postgres (see
// supabase/migrations/0003_rate_limits_support_hardening.sql).
//
// This used to be an in-memory Map, justified by the deployment plan's
// commitment to "a single persistent Node process (not serverless/
// multi-instance)". The app then shipped on Vercel, which is exactly
// serverless and multi-instance, and nothing caught the contradiction: each
// warm function instance kept its own counters, so every limit was silently
// multiplied by however many instances happened to be running. Under real
// concurrency that weakens the login brute-force limits and, more
// expensively, the cap on /api/extract-listing — the one endpoint that
// spends money per call against ANTHROPIC_API_KEY.
//
// Counting happens inside a single SQL statement so two simultaneous
// requests can't both read the same count and each decide they're under the
// limit. See check_rate_limit() in that migration.
//
// The service-role client is used deliberately: sign-in and sign-up are rate
// limited *before* there is a session to authenticate with, so this can't go
// through the user-scoped client. The table is unreadable by anon and
// authenticated for the same reason.

import { createAdminClient } from "./supabase/admin";
import { logError } from "./logger";

/** Roughly one in this many calls also clears out long-expired rows. */
const PRUNE_ODDS = 200;

export interface RateLimitOptions {
  /**
   * What to do when the limiter itself fails (database unreachable, etc.).
   *
   * `true` (default) lets the request through: for login and password reset,
   * a Supabase outage means those flows are broken anyway, so refusing here
   * adds nothing but confusion.
   *
   * `false` refuses. Use it where letting an unbounded number of requests
   * through costs real money — /api/extract-listing is the case that matters,
   * since every call bills the Anthropic key.
   */
  failOpen?: boolean;
}

/**
 * @returns true if the call is allowed, false if `key` has exceeded `limit`
 * calls within the current `windowMs` window.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  options: RateLimitOptions = {}
): Promise<boolean> {
  const { failOpen = true } = options;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: Math.max(1, Math.ceil(windowMs / 1000)),
    });

    if (error) throw new Error(error.message);

    if (Math.random() < 1 / PRUNE_ODDS) {
      // Fire-and-forget: a failed prune is housekeeping, not a reason to
      // fail the caller's request.
      void supabase.rpc("prune_rate_limits").then(
        () => {},
        () => {}
      );
    }

    return data === true;
  } catch (err) {
    logError({ route: "rateLimit", key, failOpen }, err);
    return failOpen;
  }
}

// lib/siteOrigin.ts
// The origin to send Supabase's auth redirects back to.
//
// This used to be `process.env.NEXT_PUBLIC_SITE_URL`, interpolated directly
// into every redirectTo. Two things made that fragile, and together they
// produced a silent failure that looked nothing like its cause:
//
//   1. NEXT_PUBLIC_* is inlined at BUILD time, so the value is whatever was
//      set when the deployment was built — not what the project's env says
//      now. Changing it without redeploying changes nothing.
//   2. If the resulting URL isn't in Supabase's redirect allow-list, Supabase
//      doesn't error. It quietly falls back to the project's Site URL. So a
//      Google sign-in completed successfully, then dropped the user on the
//      landing page with no session and no message — the code was never
//      exchanged, because /auth/callback was never reached.
//
// Deriving the origin from the request means it is always the host the user
// is actually on: production, a preview deployment, or localhost, with
// nothing to keep in sync.
//
// ## On trusting the Host header
//
// A caller can send any Host they like, so this value must never be treated
// as authenticated. It isn't: it only ever becomes a `redirectTo` handed to
// Supabase, which refuses any origin missing from the project's allow-list.
// That list is the real control. This function decides which of the allowed
// origins to use — not whether an origin is allowed.

import { headers } from "next/headers";

/** The subset of Headers this needs — lets the logic be tested without a request. */
interface HeaderLike {
  get(name: string): string | null | undefined;
}

/**
 * Pure form, mirroring lib/clientIp.ts's shape so both are testable the same way.
 *
 * @returns an origin with no trailing slash, e.g. "https://realtyfill.vercel.app".
 */
export function originFromHeaders(h: HeaderLike): string {
  // x-forwarded-host is what a proxy (Vercel's edge, in production) sets to
  // the host the browser actually asked for; `host` is the direct one, used
  // in local dev.
  const host = h.get("x-forwarded-host") ?? h.get("host");

  if (host) {
    // Vercel always terminates TLS, so the forwarded proto is authoritative
    // there. Locally it's absent and the host is loopback, which is http.
    const isLoopback = host.startsWith("localhost") || host.startsWith("127.0.0.1");
    const proto = h.get("x-forwarded-proto") ?? (isLoopback ? "http" : "https");
    return `${proto}://${host}`;
  }

  // Only reached if there's no Host header at all, which a browser never
  // omits. Kept so the env var still works as a deliberate override.
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

export async function siteOrigin(): Promise<string> {
  return originFromHeaders(await headers());
}

/** The full callback URL Supabase should return to, carrying where to land afterwards. */
export async function authCallbackUrl(redirectTo: string): Promise<string> {
  return `${await siteOrigin()}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`;
}

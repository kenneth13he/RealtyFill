// lib/clientIp.ts
// Work out who is calling, for rate-limit keying.
//
// The previous version read `x-forwarded-for.split(",")[0]` — the LEFTMOST
// entry. That position is whatever the client sent, because proxies append to
// this header rather than replace it. An attacker rotating a forged
// X-Forwarded-For therefore landed in a brand-new rate-limit bucket on every
// request, which made the sign-in brute-force cap decorative.
//
// Order of preference below is "least forgeable first":
//   1. x-vercel-forwarded-for — Vercel sets this itself and strips any
//      client-supplied copy, so a caller cannot influence it.
//   2. The LAST hop of x-forwarded-for — appended by the closest proxy, i.e.
//      the one we actually run behind. Everything to its left is upstream
//      claims, which may be genuine or may be invented by the client.
//   3. "unknown" — a single shared bucket. In local dev with no proxy this is
//      everyone, which is fine; in production it should never be reached.
//
// Deliberately a pure function over Headers so it can be unit-tested and used
// from both Server Actions (`await headers()`) and Route Handlers
// (`request.headers`).

/** @returns a rate-limit-keyable identifier for the caller. */
export function clientIpFrom(headers: Headers): string {
  const vercel = headers.get("x-vercel-forwarded-for");
  if (vercel) {
    const first = vercel.split(",")[0]?.trim();
    if (first) return first;
  }

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded
      .split(",")
      .map((hop) => hop.trim())
      .filter(Boolean);
    // Last hop, not first — see the header comment.
    const last = hops[hops.length - 1];
    if (last) return last;
  }

  return "unknown";
}

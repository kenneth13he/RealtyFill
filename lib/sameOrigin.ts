// lib/sameOrigin.ts
// Origin check for state-changing API routes — a second lock behind the
// SameSite=Lax session cookie.
//
// SameSite=Lax (the @supabase/ssr default) already stops a cross-site POST
// from carrying the session, so this is defence in depth rather than a hole
// being plugged. It exists because that protection is invisible in this
// codebase: it lives in a library default, and nothing here would notice if a
// future cookie-config change turned it off.
//
// Server Actions don't need this — Next performs its own Origin/Host check on
// them (see node_modules/next/dist/docs/.../guides/server-actions.md). Route
// Handlers get no such treatment, so they check explicitly.
//
// Requiring the header rather than allowing it to be absent is deliberate:
// per the Fetch standard, browsers send Origin on every request whose method
// isn't a CORS-safelisted one, so every real POST/PATCH/DELETE from this app's
// own UI has it. A mutating request without an Origin is not a browser we
// serve, and treating "absent" as "allowed" would give any non-browser client
// a trivial bypass of the whole check.

/**
 * @returns true when this request demonstrably came from this app's own
 * origin. Never throws — a malformed Origin is simply not same-origin.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;

  try {
    // Compare host (hostname + port), not the full origin string: the scheme
    // is not recoverable from the Host header, so including it would compare
    // a value we have against one we'd have to assume.
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * The refusal to return when {@link isSameOrigin} says no.
 *
 * A plain `Response` rather than `NextResponse` so this module stays free of
 * Next imports and can be unit-tested on its own.
 */
export function crossOriginRefusal(): Response {
  return new Response(JSON.stringify({ error: "Cross-origin request refused" }), {
    status: 403,
    headers: { "content-type": "application/json" },
  });
}

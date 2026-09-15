// lib/safeRedirect.ts
// One definition of "a redirect target we're willing to follow", shared by
// every place that takes one from user input.
//
// This used to live as a private helper inside app/login/actions.ts, which
// meant app/auth/callback/route.ts — the one path that builds its redirect by
// concatenating onto the origin — never got it. That gap was exploitable:
// `?redirectTo=@evil.com` produced "https://<host>@evil.com", where everything
// before the "@" parses as userinfo and the real host is evil.com. The link
// looked like ours and landed somewhere else.
//
// The rule is deliberately strict rather than clever: a legitimate target in
// this app is always a plain in-app path, so anything that isn't one is
// replaced with the fallback instead of being sanitized into shape. There is
// no case where we want to send a user to another site after sign-in.

/** Where to send someone when the requested target isn't usable. */
export const DEFAULT_REDIRECT = "/dashboard";

/**
 * Reduce an untrusted redirect target to a same-origin path.
 *
 * @returns `raw` when it is a plain in-app path, otherwise `fallback`.
 */
export function safeRedirectTarget(raw: unknown, fallback: string = DEFAULT_REDIRECT): string {
  if (typeof raw !== "string" || raw.length === 0) return fallback;

  // Must be an absolute in-app path. This alone rejects "@evil.com",
  // "evil.com", "https://evil.com" and "javascript:..." — none of them start
  // with a slash.
  if (raw[0] !== "/") return fallback;

  // "//evil.com" is a scheme-relative URL, and browsers normalize "\" to "/"
  // during parsing, so "/\evil.com" is the same attack wearing a backslash.
  // Both are absolute paths by the test above, so they need their own check.
  if (raw[1] === "/" || raw[1] === "\\") return fallback;

  // Control characters never appear in a real path, and some parsers strip
  // them before resolving — so a target carrying an embedded NUL, CR or LF
  // can pass the checks above as written and mean something else once parsed.
  if (/[\u0000-\u001f\u007f]/.test(raw)) return fallback;

  return raw;
}

/**
 * Resolve an untrusted redirect target against this app's own origin.
 *
 * The final `origin` comparison is the actual guarantee: even if
 * {@link safeRedirectTarget} were ever loosened by mistake, a target that
 * resolves off-origin still can't be returned from here.
 *
 * @returns an absolute URL that is always on `origin`.
 */
export function sameOriginRedirect(origin: string, raw: unknown, fallback: string = DEFAULT_REDIRECT): URL {
  const target = safeRedirectTarget(raw, fallback);
  const url = new URL(target, origin);
  if (url.origin !== new URL(origin).origin) {
    return new URL(fallback, origin);
  }
  return url;
}

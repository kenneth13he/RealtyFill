// next.config.ts
// Security response headers for every route.
//
// Two tiers on purpose:
//
//   - Everything except CSP is *enforced*. These are unambiguous and can't
//     break a working page: they turn off MIME sniffing, refuse framing,
//     trim the Referer sent to other sites, and switch off browser features
//     this app never uses.
//
//   - The Content Security Policy ships as **Report-Only** first. A CSP that
//     is even slightly wrong doesn't degrade — it blanks the page, and no
//     one has clicked through this app in a real browser yet (see
//     REMAINING_WORK.md item 11). Report-Only means violations are logged to
//     the browser console and nothing is blocked, so the policy can be
//     confirmed against the real thing before it's allowed to break it.
//     Flipping it on is one line: see CSP_HEADER below.
//
// The nonce-based strict CSP in Next's own guide was not used. It requires
// every page to be dynamically rendered, which would give up the static
// rendering of /terms and /privacy, and it can't be validated here anyway
// for the same "no browser testing yet" reason.

import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Supabase is a genuine third-party origin for this app: the browser talks
// to it directly for auth and Postgres, and the PDF preview iframe ends up
// there because /api/deals/[dealId]/download/[form] redirects to a signed
// Storage URL. Read from the env var rather than hardcoded so a project
// swap doesn't silently break the policy.
const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
  : "";

const CSP_DIRECTIVES = [
  `default-src 'self'`,
  // 'unsafe-inline' is the cost of not using nonces (see the header comment).
  // React and Next both emit inline bootstrap scripts; 'unsafe-eval' is only
  // needed in dev, where React uses eval for better stack traces.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  // Tailwind v4 and Next both inject inline <style> at render time.
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' blob: data:`,
  `font-src 'self' data:`,
  // Supabase Auth, PostgREST and Storage are all called from the browser.
  `connect-src 'self' ${supabaseOrigin}`.trim(),
  // The generated-PDF preview iframe lands on a Supabase signed URL.
  `frame-src 'self' blob: ${supabaseOrigin}`.trim(),
  `object-src 'none'`,
  `base-uri 'self'`,
  // Sign-in and every other form posts to this app and nowhere else.
  `form-action 'self'`,
  `frame-ancestors 'none'`,
  // Production only. It does nothing in a Report-Only policy (Chromium logs
  // a console notice saying so on every page load), and once enforcing it has
  // no business in a local http:// dev server.
  ...(isDev ? [] : [`upgrade-insecure-requests`]),
].join("; ");

// To enforce the policy, change this to "Content-Security-Policy" — but only
// after clicking through the app (sign in, intake, generate, preview a PDF)
// with the console open and seeing no violations reported.
const CSP_HEADER = "Content-Security-Policy";

const securityHeaders = [
  // Don't let a browser second-guess a declared Content-Type — the PDF
  // download path in particular should never be re-interpreted as HTML.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Clickjacking. frame-ancestors in the CSP is the modern equivalent, but
  // this one is enforced today while the CSP is still report-only.
  { key: "X-Frame-Options", value: "DENY" },
  // A deal URL contains a deal id; don't leak the full path to other sites.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // None of these are used, and turning them off means a compromised
  // dependency can't quietly ask for them either.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  // Vercel already sends HSTS; setting it explicitly keeps it true on any
  // other host, and makes the intent visible in the repo rather than being
  // a property of one platform.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: CSP_HEADER, value: CSP_DIRECTIVES },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

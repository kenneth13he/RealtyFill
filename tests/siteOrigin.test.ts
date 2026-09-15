// tests/siteOrigin.test.ts
// The origin handed to Supabase as an auth redirect target.
//
// Getting this wrong fails silently and confusingly: Supabase doesn't reject
// an unlisted redirect, it substitutes the project's Site URL. Google sign-in
// then "succeeds" and drops the user on the landing page with no session,
// because /auth/callback was never reached and the code was never exchanged.
// That is exactly the bug these cover.

import assert from "node:assert/strict";
import { test, describe } from "node:test";

import { originFromHeaders } from "../lib/siteOrigin";

/** Stands in for a real Headers object; lookups are case-insensitive, as they are on the real one. */
function h(values: Record<string, string>) {
  const map = new Map(Object.entries(values).map(([k, v]) => [k.toLowerCase(), v]));
  return { get: (name: string) => map.get(name.toLowerCase()) ?? null };
}

describe("originFromHeaders", () => {
  test("prefers the forwarded host over the direct one behind a proxy", () => {
    assert.equal(
      originFromHeaders(
        h({ "x-forwarded-host": "realtyfill.vercel.app", "x-forwarded-proto": "https", host: "internal:3000" })
      ),
      "https://realtyfill.vercel.app"
    );
  });

  test("falls back to the direct host when nothing is forwarded", () => {
    assert.equal(originFromHeaders(h({ host: "realtyfill.vercel.app" })), "https://realtyfill.vercel.app");
  });

  test("assumes http for loopback and https for everything else", () => {
    assert.equal(originFromHeaders(h({ host: "localhost:3000" })), "http://localhost:3000");
    assert.equal(originFromHeaders(h({ host: "127.0.0.1:3000" })), "http://127.0.0.1:3000");
    assert.equal(originFromHeaders(h({ host: "example.com" })), "https://example.com");
  });

  test("an explicit forwarded proto wins over the guess", () => {
    assert.equal(originFromHeaders(h({ host: "localhost:3000", "x-forwarded-proto": "https" })), "https://localhost:3000");
  });

  test("a preview deployment gets its own origin, not production's", () => {
    // The whole point of deriving this per request rather than baking one
    // value in at build time: NEXT_PUBLIC_* is inlined at build, so a preview
    // would otherwise send users to the production callback.
    assert.equal(
      originFromHeaders(h({ "x-forwarded-host": "realtyfill-abc123-realty-fill.vercel.app", "x-forwarded-proto": "https" })),
      "https://realtyfill-abc123-realty-fill.vercel.app"
    );
  });

  test("falls back to the env var only when there is no host at all", () => {
    const original = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://configured.example/";
    try {
      // Trailing slashes are stripped, so callers can always append a path.
      assert.equal(originFromHeaders(h({})), "https://configured.example");
    } finally {
      if (original === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = original;
    }
  });

  test("never returns a trailing slash, so appending a path is always safe", () => {
    for (const origin of [
      originFromHeaders(h({ host: "realtyfill.vercel.app" })),
      originFromHeaders(h({ host: "localhost:3000" })),
    ]) {
      assert.ok(!origin.endsWith("/"), `${origin} ends with a slash`);
      assert.doesNotThrow(() => new URL("/auth/callback", origin));
    }
  });
});

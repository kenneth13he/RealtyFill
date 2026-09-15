// tests/requestIdentity.test.ts
// Two small helpers that decide "who is calling" and "did they come from us".
// Both are pure over Headers/Request so they can be tested without a server.

import assert from "node:assert/strict";
import { test, describe } from "node:test";

import { clientIpFrom } from "../lib/clientIp";
import { isSameOrigin } from "../lib/sameOrigin";

describe("clientIpFrom", () => {
  test("prefers the platform header a caller cannot forge", () => {
    const h = new Headers({
      "x-vercel-forwarded-for": "203.0.113.9",
      "x-forwarded-for": "1.2.3.4, 203.0.113.9",
    });
    assert.equal(clientIpFrom(h), "203.0.113.9");
  });

  test("takes the LAST forwarded hop, not the client-controlled first one", () => {
    // "9.9.9.9" here is what an attacker put in the request; "203.0.113.9" is
    // what our own proxy appended. Keying on the former is the bug this fixes.
    const h = new Headers({ "x-forwarded-for": "9.9.9.9, 203.0.113.9" });
    assert.equal(clientIpFrom(h), "203.0.113.9");
  });

  test("a forged header cannot manufacture a fresh rate-limit bucket", () => {
    const real = "203.0.113.9";
    const keys = new Set<string>();
    for (const forged of ["1.1.1.1", "2.2.2.2", "3.3.3.3", "not-an-ip", ""]) {
      const h = new Headers({ "x-forwarded-for": `${forged}, ${real}` });
      keys.add(clientIpFrom(h));
    }
    // Every spoof attempt lands in the same bucket — that IS the fix.
    assert.deepEqual([...keys], [real]);
  });

  test("handles a single-hop header and odd whitespace", () => {
    assert.equal(clientIpFrom(new Headers({ "x-forwarded-for": "203.0.113.9" })), "203.0.113.9");
    assert.equal(clientIpFrom(new Headers({ "x-forwarded-for": "  203.0.113.9  " })), "203.0.113.9");
  });

  test("falls back to a shared bucket rather than throwing", () => {
    assert.equal(clientIpFrom(new Headers()), "unknown");
    assert.equal(clientIpFrom(new Headers({ "x-forwarded-for": "" })), "unknown");
    assert.equal(clientIpFrom(new Headers({ "x-forwarded-for": " , , " })), "unknown");
  });
});

describe("isSameOrigin", () => {
  function req(headers: Record<string, string>): Request {
    return new Request("https://realtyfill.vercel.app/api/deals", { method: "POST", headers });
  }

  test("accepts a request from our own origin", () => {
    assert.equal(
      isSameOrigin(req({ origin: "https://realtyfill.vercel.app", host: "realtyfill.vercel.app" })),
      true
    );
  });

  test("accepts localhost with a port", () => {
    assert.equal(isSameOrigin(req({ origin: "http://localhost:3000", host: "localhost:3000" })), true);
  });

  test("rejects a cross-site origin", () => {
    assert.equal(
      isSameOrigin(req({ origin: "https://evil.com", host: "realtyfill.vercel.app" })),
      false
    );
  });

  test("rejects a lookalike subdomain", () => {
    assert.equal(
      isSameOrigin(req({ origin: "https://realtyfill.vercel.app.evil.com", host: "realtyfill.vercel.app" })),
      false
    );
  });

  test("rejects a port mismatch on the same hostname", () => {
    assert.equal(isSameOrigin(req({ origin: "http://localhost:4000", host: "localhost:3000" })), false);
  });

  test("rejects a missing or malformed Origin rather than assuming the best", () => {
    assert.equal(isSameOrigin(req({ host: "realtyfill.vercel.app" })), false);
    assert.equal(isSameOrigin(req({ origin: "null", host: "realtyfill.vercel.app" })), false);
    assert.equal(isSameOrigin(req({ origin: "!!!", host: "realtyfill.vercel.app" })), false);
  });
});

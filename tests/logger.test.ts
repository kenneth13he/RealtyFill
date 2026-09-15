// tests/logger.test.ts
// The error reference is what connects a user saying "it didn't work" to a
// line in the logs, so the two halves have to agree: the ref that gets
// logged must be the ref that gets shown.

import assert from "node:assert/strict";
import { test, describe } from "node:test";

import { logError, userFacingError } from "../lib/logger";

function captureStderr(fn: () => void): string[] {
  const lines: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => void lines.push(args.map(String).join(" "));
  try {
    fn();
  } finally {
    console.error = original;
  }
  return lines;
}

describe("logError", () => {
  test("returns the same reference it writes to the log", () => {
    let ref = "";
    const lines = captureStderr(() => {
      ref = logError({ route: "test" }, new Error("boom"));
    });
    assert.match(ref, /^[0-9a-f]{10}$/);
    const logged = JSON.parse(lines[0]);
    assert.equal(logged.ref, ref, "the reference shown to the user must match the one logged");
  });

  test("logs the message, stack and context", () => {
    const lines = captureStderr(() => {
      logError({ route: "generate", userId: "u1", dealId: "d1" }, new Error("boom"));
    });
    const logged = JSON.parse(lines[0]);
    assert.equal(logged.level, "error");
    assert.equal(logged.message, "boom");
    assert.equal(logged.route, "generate");
    assert.equal(logged.userId, "u1");
    assert.equal(logged.dealId, "d1");
    assert.ok(logged.stack?.includes("Error: boom"));
    assert.ok(Date.parse(logged.timestamp) > 0);
  });

  test("handles a thrown non-Error", () => {
    const lines = captureStderr(() => logError({ route: "test" }, "just a string"));
    assert.equal(JSON.parse(lines[0]).message, "just a string");
  });

  test("references are unique across calls", () => {
    const refs = new Set<string>();
    captureStderr(() => {
      for (let i = 0; i < 200; i++) refs.add(logError({ route: "test" }, new Error("x")));
    });
    assert.equal(refs.size, 200);
  });
});

describe("userFacingError", () => {
  test("includes the reference so a support request can quote it", () => {
    const text = userFacingError("abc1234567");
    assert.ok(text.includes("abc1234567"));
  });

  test("never carries the internal error message", () => {
    // The whole point: an internal message can name tables, storage paths
    // and field ids, and this string is rendered in a browser.
    let ref = "";
    captureStderr(() => {
      ref = logError({ route: "test" }, new Error("relation \"deals\" does not exist at /var/task/secret"));
    });
    const text = userFacingError(ref, "Couldn't generate your forms.");
    assert.ok(!text.includes("relation"));
    assert.ok(!text.includes("/var/task"));
    assert.ok(text.includes(ref));
  });
});

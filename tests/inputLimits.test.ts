// tests/inputLimits.test.ts
// Before these limits existed, /api/deals/[dealId]/intake stored the request
// body verbatim: any size, any shape. These check both halves — that real
// answers still save, and that the things that shouldn't reach Postgres
// don't.

import assert from "node:assert/strict";
import { test, describe } from "node:test";

import { LIMITS, InputTooLargeError, validateAnswers } from "../lib/inputLimits";
import { getIntakeFormSchema } from "../lib/schemas";

describe("validateAnswers", () => {
  test("accepts a realistic full intake", () => {
    // The real schema, every field filled — the limits must not be tighter
    // than actual use.
    const answers: Record<string, string> = {};
    for (const group of getIntakeFormSchema().groups) {
      for (const field of group.fields) answers[field.key] = "a reasonable answer value";
    }
    const out = validateAnswers(answers);
    assert.equal(Object.keys(out).length, Object.keys(answers).length);
  });

  test("rejects a non-object body", () => {
    for (const bad of [null, undefined, "a string", 42, [1, 2, 3]]) {
      assert.throws(() => validateAnswers(bad), InputTooLargeError, `accepted ${JSON.stringify(bad)}`);
    }
  });

  test("rejects a non-string answer value", () => {
    // Everything downstream indexes answers as Record<string, string>; a
    // nested object wouldn't error here, it would surface as a mangled value
    // in a generated legal document.
    assert.throws(() => validateAnswers({ tenant1_full_name: { first: "A" } }), InputTooLargeError);
    assert.throws(() => validateAnswers({ rent_amount: 1500 }), InputTooLargeError);
    assert.throws(() => validateAnswers({ things: ["a", "b"] }), InputTooLargeError);
  });

  test("treats null and undefined as cleared rather than rejecting the save", () => {
    const out = validateAnswers({ a: null, b: undefined, c: "kept" });
    assert.deepEqual(out, { a: "", b: "", c: "kept" });
  });

  test("rejects too many keys", () => {
    const answers: Record<string, string> = {};
    for (let i = 0; i < LIMITS.answerKeys + 1; i++) answers[`k${i}`] = "x";
    assert.throws(() => validateAnswers(answers), InputTooLargeError);
  });

  test("rejects an over-long key or value", () => {
    assert.throws(() => validateAnswers({ ["k".repeat(LIMITS.answerKeyChars + 1)]: "x" }), InputTooLargeError);
    assert.throws(() => validateAnswers({ note: "x".repeat(LIMITS.answerValueChars + 1) }), InputTooLargeError);
  });

  test("rejects a blob that is too large overall", () => {
    // Each value is individually legal; together they aren't.
    const answers: Record<string, string> = {};
    const chunk = "x".repeat(LIMITS.answerValueChars);
    for (let i = 0; i < Math.ceil(LIMITS.answersJsonBytes / LIMITS.answerValueChars) + 1; i++) {
      answers[`k${i}`] = chunk;
    }
    assert.throws(() => validateAnswers(answers), InputTooLargeError);
  });

  test("returns only validated keys, not the original object", () => {
    const input = { a: "1" };
    const out = validateAnswers(input);
    assert.notEqual(out, input, "should not hand back the caller's object");
    assert.deepEqual(out, { a: "1" });
  });
});

describe("LIMITS", () => {
  test("upload limits leave room for a real listing export", () => {
    // A REALM export is a few hundred KB; these must not be tighter.
    assert.ok(LIMITS.fileBytes >= 5 * 1024 * 1024);
    assert.ok(LIMITS.totalUploadBytes >= LIMITS.fileBytes);
    assert.ok(LIMITS.fileCount >= 3, "a main sheet plus schedules must fit");
  });

  test("answer limits leave room for the real schema", () => {
    const fieldCount = getIntakeFormSchema().groups.reduce((n, g) => n + g.fields.length, 0);
    assert.ok(LIMITS.answerKeys > fieldCount, `${LIMITS.answerKeys} must exceed the ${fieldCount} real fields`);
  });
});

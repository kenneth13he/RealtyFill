// tests/admin.test.ts
// isAdminUser is the only thing standing between a signed-in realtor and
// every other realtor's support history, so its edge cases are worth
// pinning down rather than eyeballing.

import assert from "node:assert/strict";
import { test, describe, afterEach } from "node:test";

import { adminPrincipals, adminsConfigured, isAdminUser } from "../lib/admin";

const ORIGINAL = process.env.ADMIN_PRINCIPALS;
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.ADMIN_PRINCIPALS;
  else process.env.ADMIN_PRINCIPALS = ORIGINAL;
});

function withPrincipals(value: string | undefined, fn: () => void) {
  if (value === undefined) delete process.env.ADMIN_PRINCIPALS;
  else process.env.ADMIN_PRINCIPALS = value;
  fn();
}

const CHRIS = { id: "282cd91f-602f-420b-8d89-2d880706fe3c", email: "chrisluo1029384756@gmail.com" };
const STRANGER = { id: "00000000-0000-4000-8000-000000000001", email: "someone@example.com" };

describe("adminPrincipals", () => {
  test("splits emails and ids, tolerating whitespace and a trailing comma", () => {
    withPrincipals(" a@example.com , 282cd91f-602f-420b-8d89-2d880706fe3c ,", () => {
      assert.deepEqual(adminPrincipals(), [
        { email: "a@example.com" },
        { id: "282cd91f-602f-420b-8d89-2d880706fe3c" },
      ]);
    });
  });

  test("an unset or empty variable yields nobody", () => {
    withPrincipals(undefined, () => assert.deepEqual(adminPrincipals(), []));
    withPrincipals("", () => assert.deepEqual(adminPrincipals(), []));
    withPrincipals("  ,  ,", () => assert.deepEqual(adminPrincipals(), []));
  });
});

describe("isAdminUser", () => {
  test("matches a configured email", () => {
    withPrincipals("chrisluo1029384756@gmail.com,kenneth08he@gmail.com", () => {
      assert.equal(isAdminUser(CHRIS), true);
      assert.equal(isAdminUser(STRANGER), false);
    });
  });

  test("matches a configured user id", () => {
    withPrincipals(CHRIS.id, () => {
      assert.equal(isAdminUser(CHRIS), true);
      assert.equal(isAdminUser({ id: STRANGER.id, email: CHRIS.email }), false);
    });
  });

  test("is case-insensitive on both sides", () => {
    withPrincipals("ChrisLuo1029384756@GMail.com", () => {
      assert.equal(isAdminUser({ id: CHRIS.id, email: "CHRISLUO1029384756@gmail.com" }), true);
    });
  });

  test("nobody is an admin when the variable is unset", () => {
    // The failure mode that matters: a missing env var must not read as
    // "allow everyone". The API returns 503 in this case rather than
    // silently granting or silently denying.
    withPrincipals(undefined, () => {
      assert.equal(isAdminUser(CHRIS), false);
      assert.equal(adminsConfigured(), false);
    });
  });

  test("a null or partial user is never an admin", () => {
    withPrincipals("chrisluo1029384756@gmail.com", () => {
      assert.equal(isAdminUser(null), false);
      assert.equal(isAdminUser(undefined), false);
      assert.equal(isAdminUser({ id: null, email: null }), false);
      assert.equal(isAdminUser({}), false);
    });
  });

  test("an empty-string email does not match an empty principal", () => {
    // Guards the classic bug where "" == "" lets an account with no email
    // through a list that happens to contain a blank entry.
    withPrincipals(",,", () => {
      assert.equal(isAdminUser({ id: "x", email: "" }), false);
    });
  });
});

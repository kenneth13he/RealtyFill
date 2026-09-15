// tests/extractionConversion.test.ts
// toStoredAnswers is the step between what the model says and what gets
// written into a real deal. It was inline in the route handler and therefore
// untestable; these cover it now that it's a function.
//
// Deterministic — no API calls, unlike scripts/extraction_eval.ts.

import assert from "node:assert/strict";
import { test, describe } from "node:test";

import { buildFieldSchema, toStoredAnswers } from "../app/api/extract-listing/route";

describe("toStoredAnswers", () => {
  test("passes plain string values straight through", () => {
    const { answers } = toStoredAnswers({
      fields: { buyer_full_name: "Bob Smith", purchase_price_amount: "950000" },
      flagged: {},
    });
    assert.equal(answers.buyer_full_name, "Bob Smith");
    assert.equal(answers.purchase_price_amount, "950000");
  });

  test("renames aliased keys to where the answer is actually stored", () => {
    // The model is asked for heat_included; the deal stores
    // heat_responsibility. An eval asserting on the raw model output reported
    // a false failure here, which is why this conversion is now shared.
    const { answers } = toStoredAnswers({ fields: { heat_included: true }, flagged: {} });
    assert.equal(answers.heat_responsibility, "/1");
    assert.equal(answers.heat_included, undefined);
  });

  test("maps booleans to each field's own option codes, which are not uniform", () => {
    // gas_included true means "/1", but rent_deposit_required true means
    // "/2" — the codes differ per field, so a single convention would put
    // the wrong answer on a real form.
    const { answers } = toStoredAnswers({
      fields: { gas_included: true, rent_deposit_required: true, property_is_condo: false },
      flagged: {},
    });
    assert.equal(answers.gas_included, "/1");
    assert.equal(answers.rent_deposit_required, "/2");
    assert.equal(answers.property_is_condo, "/2");
  });

  test("drops character-indexed keys from a malformed response", () => {
    // Observed for real: the model returned `fields` as a raw string, and
    // Object.entries() turned it into {"0":"B","1":"o","2":"b"}. Without
    // this guard that is written character-by-character into saved answers.
    const { answers } = toStoredAnswers({
      fields: { "0": "B", "1": "o", "2": "b", buyer_full_name: "Bob" },
      flagged: {},
    });
    assert.deepEqual(Object.keys(answers), ["buyer_full_name"]);
  });

  test("skips empty values rather than blanking a saved answer", () => {
    const { answers } = toStoredAnswers({
      fields: { buyer_full_name: "", seller_full_name: "Jane" },
      flagged: {},
    });
    assert.equal(answers.buyer_full_name, undefined);
    assert.equal(answers.seller_full_name, "Jane");
  });

  test("splits a tenant's full name for 2229E's separate boxes", () => {
    const { answers } = toStoredAnswers({ fields: { tenant1_full_name: "Alice Chen" }, flagged: {} });
    assert.equal(answers.tenant1_first_name, "Alice");
    assert.equal(answers.tenant1_last_name, "Chen");
  });

  test("flag keys are renamed the same way values are", () => {
    // Otherwise the review page highlights a field key that doesn't exist in
    // the schema, and the "Go to field" button has nothing to jump to.
    const { flagged } = toStoredAnswers({
      fields: {},
      flagged: { heat_included: "listing is unclear" },
    });
    assert.equal(flagged.heat_responsibility, "listing is unclear");
  });
});

describe("buildFieldSchema option codes", () => {
  test("radio fields are constrained to their real codes, never free text", () => {
    // The model returned the literal word "Landlord" for a radio field when
    // it was offered as a plain string. That value can't be written to the
    // PDF — the Python validator rejects the whole fill at generate time.
    const schema = buildFieldSchema("lease_tenant");
    for (const [key, spec] of Object.entries(schema)) {
      if (!spec.enum) continue;
      assert.ok(spec.enum.length > 0, `${key} has an empty enum`);
      for (const value of spec.enum) {
        assert.match(value, /^\//, `${key} offers "${value}", which is not an option code`);
      }
    }
  });

  test("the aliased stored keys are never offered alongside their boolean", () => {
    // Offering both heat_included and heat_responsibility let the model fill
    // each independently, and they disagreed.
    const schema = buildFieldSchema("lease_tenant");
    for (const stored of ["heat_responsibility", "water_responsibility", "electricity_responsibility", "onsite_laundry"]) {
      assert.ok(!schema[stored], `${stored} should not be offered directly`);
    }
    assert.ok(schema.heat_included, "the boolean form should still be offered");
  });
});

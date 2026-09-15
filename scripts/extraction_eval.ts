// scripts/extraction_eval.ts
// Evaluation harness for the "Update with more info" box — the one place in
// the app where free text becomes form data, and the feature the product
// actually exists for.
//
// Every other test in tests/ is deterministic. This one calls the real model,
// so it costs money per run and can vary between runs. It is therefore a
// script you run deliberately, not part of `npm test`.
//
//   npx tsx scripts/extraction_eval.ts                  # every case
//   npx tsx scripts/extraction_eval.ts --set sale_buyer # one form set
//   npx tsx scripts/extraction_eval.ts --only rent      # cases matching a substring
//   npx tsx scripts/extraction_eval.ts --repeat 3       # stability across runs
//   npx tsx scripts/extraction_eval.ts --json out.json  # machine-readable results
//
// A case declares what it expects, in three kinds:
//   expect   — these keys must come back with these values (a substring match,
//              so "Bob Smith" satisfies an expectation of "Bob")
//   absent   — these keys must NOT be filled: the guard against the model
//              inventing a value, or writing into a field that means
//              something adjacent but different
//   flagged  — these keys must be reported as needing human judgment rather
//              than guessed at. Genuine ambiguity SHOULD flag; that's the
//              product behaving correctly, not a failure.
//
// Requires ANTHROPIC_API_KEY (and the Supabase vars, since route.ts imports
// the schema loader). Load .env.local before running.

import { loadEnvLocal } from "./loadEnv";
loadEnvLocal();

import { extractWithRetry, toStoredAnswers } from "../app/api/extract-listing/route";
import { claudeExtractWithTool } from "../lib/claude";
import { FORM_SET_IDS, type FormSetId } from "../lib/formTypes";

interface EvalCase {
  name: string;
  set: FormSetId;
  /** What the realtor types into the box. */
  text: string;
  /** What's already saved on the deal, if the case depends on it. */
  current?: Record<string, string>;
  expect?: Record<string, string>;
  absent?: string[];
  flagged?: string[];
  /** Why this case exists, when it isn't obvious. */
  note?: string;
}

const CASES: EvalCase[] = [
  // ---------------------------------------------------------------- sale_buyer
  {
    name: "buyer named in the shortest possible way",
    set: "sale_buyer",
    text: "Bob is Buyer",
    expect: { buyer_full_name: "Bob" },
    absent: ["tenant1_full_name"],
    note: "The originally reported bug: this used to flag as ambiguous against tenant1_full_name.",
  },
  {
    name: "full purchase sentence",
    set: "sale_buyer",
    text: "Bob Smith is the buyer, Jane Doe is selling, price is 950000, closing Nov 30 2026",
    expect: {
      buyer_full_name: "Bob Smith",
      seller_full_name: "Jane Doe",
      purchase_price_amount: "950000",
      completion_date: "2026-11-30",
    },
  },
  {
    name: "price written with symbols and commas",
    set: "sale_buyer",
    text: "Offer is $1,250,000.00 with a $50,000 deposit",
    expect: { purchase_price_amount: "1250000", purchase_deposit_amount: "50000" },
    note: "Money must reach the PDF as digits only — no $ or commas.",
  },
  {
    name: "condo specifics",
    set: "sale_buyer",
    text: "Unit 1706, Level 17, TSCC 2510, one parking space and one locker. Building is The Rosedale.",
    expect: { condo_apt_unit_no: "1706", condo_level_no: "17", condo_property_name: "Rosedale" },
    absent: ["condo_unit_number"],
    note:
      "This case was written expecting 1706 in condo_unit_number and the model was right to refuse. " +
      "On Form 101, 'Unit __, Level __, Plan No. __' is the LEGAL unit per the condominium plan, " +
      "which is frequently not the suite number on the door — 1706 is the apartment number and " +
      "belongs in condo_apt_unit_no. Putting a suite number on the legal-description line would " +
      "misdescribe the property being purchased. Kept as a case because that distinction is exactly " +
      "the kind of thing a future prompt change could quietly break. " +
      "Asserts `absent` rather than `flagged` deliberately. Over three runs the model flagged " +
      "condo_unit_number once and omitted it the other twice, and both are defensible — the prompt " +
      "says a field the text never raises belongs in neither channel, and a suite number arguably " +
      "doesn't raise the legal unit number at all. What must never happen is 1706 landing in that " +
      "field, so that is what's asserted. Testing the coin flip instead just produced a flaky case.",
  },
  {
    name: "relative date must not be guessed",
    set: "sale_buyer",
    text: "Closing is 60 days after acceptance",
    absent: ["completion_date"],
    note: "There is no acceptance date on file, so an ISO date here would be invented.",
  },
  {
    name: "irrevocable time and date",
    set: "sale_buyer",
    text: "Offer is irrevocable until 11:59 PM on October 3, 2026",
    expect: { irrevocable_until_time: "11:59", irrevocable_date: "2026-10-03" },
  },
  {
    name: "correcting a name already on file",
    set: "sale_buyer",
    text: "Buyer's last name is actually Smithe, not Smith",
    current: { buyer_full_name: "Bob Smith" },
    expect: { buyer_full_name: "Bob Smithe" },
    note: "A partial correction must keep the first name rather than flagging.",
  },
  {
    name: "genuinely ambiguous party",
    set: "sale_buyer",
    text: "Chris is involved in this deal",
    flagged: ["buyer_full_name"],
    absent: ["buyer_full_name", "seller_full_name"],
    note: "No role stated. Flagging is the correct behaviour here.",
  },
  {
    name: "irrelevant chatter",
    set: "sale_buyer",
    text: "Thanks, talk tomorrow!",
    absent: ["buyer_full_name", "seller_full_name", "purchase_price_amount"],
    note: "Nothing extractable: must not invent, and must not flag everything either.",
  },

  // -------------------------------------------------------------- sale_seller
  {
    name: "seller side basics",
    set: "sale_seller",
    text: "Seller is Maria Lopez, listing at 1,250,000, MLS C1234567",
    expect: { seller_full_name: "Maria Lopez", listing_price: "1250000", mls_number: "C1234567" },
    absent: ["tenant1_full_name", "monthly_rent_amount"],
  },
  {
    name: "listing period",
    set: "sale_seller",
    text: "Listing runs from Sept 1 2026 to Dec 1 2026, commission 5%",
    expect: { listing_start_date: "2026-09-01", listing_expiry_date: "2026-12-01" },
  },

  // ------------------------------------------------------------ lease_tenant
  {
    name: "lease basics still work",
    set: "lease_tenant",
    text: "Bob is the tenant, rent is 2400 a month due on the 1st, landlord is Acme Holdings",
    expect: {
      tenant1_full_name: "Bob",
      monthly_rent_amount: "2400",
      rent_due_day: "1",
      landlord_full_name: "Acme Holdings",
    },
    absent: ["buyer_full_name"],
    note: "Regression guard: the lease path must be unaffected by the set-aware change.",
  },
  {
    name: "two tenants",
    set: "lease_tenant",
    text: "Tenants are Alice Chen and Marcus Webb",
    expect: { tenant1_full_name: "Alice Chen", tenant2_full_name: "Marcus Webb" },
  },
  {
    name: "utility stated as a feature, not an inclusion",
    set: "lease_tenant",
    text: "Heating Source: Gas. A/C: Central Air.",
    absent: ["gas_included", "ac_included"],
    note: "A property FEATURE is not an INCLUDED SERVICE — the distinction that caused a real mis-fill.",
  },
  {
    name: "utility stated as an inclusion",
    set: "lease_tenant",
    text: "Heat and water are included in the rent; tenant pays hydro.",
    expect: { heat_responsibility: "/1", water_responsibility: "/1" },
  },

  // ---------------------------------------------------------- lease_landlord
  {
    name: "landlord side listing terms",
    set: "lease_landlord",
    text: "Landlord is 123 Holdings Inc, asking 3200/month, listing expires March 31 2027",
    expect: { landlord_full_name: "123 Holdings Inc", monthly_rent_amount: "3200" },
    absent: ["buyer_full_name", "purchase_price_amount"],
  },

  // ------------------------------------------------------- shared / property
  {
    name: "address with MLS area code",
    set: "sale_buyer",
    text: "Property is 203 College St, Unit 1706, Toronto C01, ON M5T 1P9",
    expect: {
      property_street_number: "203",
      property_street_name: "College",
      property_unit_number: "1706",
      property_city: "Toronto C01",
      property_postal_code: "M5T 1P9",
    },
  },
  {
    name: "brokerage sides must not be swapped",
    set: "sale_buyer",
    text: "LISTING CONTRACTED WITH: Sutton Group Realty. CO-OP: Royal LePage Signature.",
    expect: { listing_brokerage_name: "Sutton", coop_brokerage_name: "Royal LePage" },
    note: "Getting these backwards puts the wrong brokerage on a commission agreement.",
  },
];

// ---------------------------------------------------------------------------

interface CaseResult {
  name: string;
  set: FormSetId;
  pass: boolean;
  failures: string[];
  fields: Record<string, unknown>;
  flagged: Record<string, string>;
  ms: number;
}

async function runCase(c: EvalCase): Promise<CaseResult> {
  const started = Date.now();
  const currentBlock = c.current
    ? `Values already on file:
${JSON.stringify(c.current, null, 2)}

`
    : "";

  // Goes through the route's own retry/validation rather than calling the
  // model directly, so the eval measures the pipeline the app actually runs.
  const { result, lastErr } = await extractWithRetry(
    c.set,
    `${currentBlock}New information:
"""
${c.text}
"""`
  );
  if (!result) {
    return {
      name: c.name, set: c.set, pass: false,
      failures: [`extraction failed: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`],
      fields: {}, flagged: {}, ms: Date.now() - started,
    };
  }
  const out = result;

  // Assert on what the deal actually stores, not the raw model output — the
  // route converts booleans to option codes and renames aliased keys, so the
  // two are genuinely different shapes.
  const { answers: fields, flagged } = toStoredAnswers({
    fields: (out?.fields ?? {}) as Record<string, string | boolean>,
    flagged: out?.flagged ?? {},
  });
  const failures: string[] = [];

  for (const [key, want] of Object.entries(c.expect ?? {})) {
    const got = fields[key];
    if (got === undefined || got === null || got === "") {
      failures.push(`missing ${key} (wanted "${want}")`);
    } else if (!String(got).toLowerCase().includes(want.toLowerCase())) {
      failures.push(`${key} = "${got}", wanted to contain "${want}"`);
    }
  }
  for (const key of c.absent ?? []) {
    const got = fields[key];
    if (got !== undefined && got !== null && got !== "") {
      failures.push(`${key} should be empty but was "${got}"`);
    }
  }
  for (const key of c.flagged ?? []) {
    if (!flagged[key]) failures.push(`${key} should have been flagged for review`);
  }

  return { name: c.name, set: c.set, pass: failures.length === 0, failures, fields, flagged, ms: Date.now() - started };
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  const setFilter = arg("set");
  const only = arg("only");
  const repeat = Number(arg("repeat") ?? 1);
  const jsonOut = arg("json");

  if (setFilter && !FORM_SET_IDS.includes(setFilter as FormSetId)) {
    console.error(`Unknown set "${setFilter}". One of: ${FORM_SET_IDS.join(", ")}`);
    process.exit(2);
  }

  const cases = CASES.filter(
    (c) => (!setFilter || c.set === setFilter) && (!only || c.name.toLowerCase().includes(only.toLowerCase()))
  );
  if (cases.length === 0) {
    console.error("No cases matched.");
    process.exit(2);
  }

  console.log(`Running ${cases.length} case(s)${repeat > 1 ? ` x${repeat}` : ""} against the live model.\n`);

  const all: CaseResult[] = [];
  // Counts how many of the `repeat` runs each case passed, which is what
  // exposes a flaky case as distinct from a broken one.
  const passesByName = new Map<string, number>();

  for (let round = 1; round <= repeat; round++) {
    if (repeat > 1) console.log(`--- round ${round}/${repeat} ---`);
    for (const c of cases) {
      let r: CaseResult;
      try {
        r = await runCase(c);
      } catch (err) {
        r = {
          name: c.name, set: c.set, pass: false,
          failures: [`threw: ${err instanceof Error ? err.message : String(err)}`],
          fields: {}, flagged: {}, ms: 0,
        };
      }
      all.push(r);
      passesByName.set(r.name, (passesByName.get(r.name) ?? 0) + (r.pass ? 1 : 0));
      console.log(`${r.pass ? "PASS" : "FAIL"}  [${r.set}] ${r.name}  (${r.ms}ms)`);
      for (const f of r.failures) console.log(`        ${f}`);
      if (!r.pass) {
        console.log(`        got fields : ${JSON.stringify(r.fields)}`);
        console.log(`        got flagged: ${JSON.stringify(r.flagged)}`);
      }
    }
  }

  const passed = all.filter((r) => r.pass).length;
  console.log(`\n${passed}/${all.length} passed.`);

  if (repeat > 1) {
    const flaky = [...passesByName.entries()].filter(([, n]) => n > 0 && n < repeat);
    if (flaky.length) {
      console.log(`\nInconsistent across rounds (passed some, failed others):`);
      for (const [name, n] of flaky) console.log(`  ${n}/${repeat}  ${name}`);
    }
  }

  if (jsonOut) {
    const fs = await import("fs/promises");
    await fs.writeFile(jsonOut, JSON.stringify({ ranAt: new Date().toISOString(), results: all }, null, 2));
    console.log(`\nWrote ${jsonOut}`);
  }

  process.exit(passed === all.length ? 0 : 1);
}

void main();

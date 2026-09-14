// app/api/extract-listing/route.ts
// Parses a listing export (e.g. a REALM printout) — either pasted as text or
// uploaded as a PDF — into intake_form_schema.json answers, via the Claude
// API (lib/claude.ts, forced tool use). This is the one AI-assisted step in
// the app.
//
// Two output channels, not two tiers of fields: the model puts a value in
// `fields` when it's confident, or names the field in `flagged` with a short
// reason when it isn't — for ANY field, not just the utility ones. This
// replaces an earlier version that forced the six utility/service-inclusion
// fields (gas, A/C, laundry, electricity, heat, water) to always guess "not
// included" when the listing was silent. That rule was wrong often enough to
// matter in practice — verified on a real listing where the real signed
// lease had A/C included despite the listing never saying so, while gas
// (also never stated) really was excluded. Forcing a guess on a coin flip is
// worse than asking a human. The model may still apply the "unmentioned
// utility is usually not included" convention when it's actually confident,
// but a real-estate-savvy read of the listing's own language decides that
// per case now, not a blanket default.
//
// Accepts two request shapes:
//   - JSON: { text: string } — pasted listing text
//   - multipart/form-data: one or more "file" fields containing PDFs — each
//     sent to Claude natively as its own `document` content block (base64),
//     NOT flattened to text first. An earlier version pre-extracted text via
//     lib/pdfText.ts / pypdf, which loses table/column layout (e.g. REALM's
//     two-column property-info table can linearize into a jumbled
//     label/value order) — sending the actual PDF lets Claude read the real
//     layout instead. Multiple files (main listing sheet + Schedules/
//     Addenda attachments) are sent together in one message so the model can
//     pull a fact from whichever document actually states it — e.g. rent
//     payment method is often on a Schedule, not the main sheet — rather
//     than only reading the first file.

import { NextResponse } from "next/server";
import { claudeExtractWithTool } from "@/lib/claude";
import { splitFullName } from "@/lib/splitFullName";
import { createClient } from "@/lib/supabase/server";
import type Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `You are extracting structured data from a real-estate listing export (e.g. a REALM/MLS printout) for an Ontario rental deal. Accuracy matters more than completeness — this feeds real legal/transactional forms.

Rules:
- Only put a value in \`fields\` if you're genuinely confident in it, either because the listing states it directly, or because a well-established real estate convention makes it a safe inference (e.g. commission phrasing, standard deposit terminology).
- If something is ambiguous, contradictory, or you're genuinely unsure — put it in \`flagged\` with a short reason instead of guessing. Never force an answer you're not confident in just to fill every field.
- \`flagged\` is only for a field the text actually raises but leaves unclear (e.g. it hints at a deposit without saying how much). A field the text simply never brings up at all — no relevant words anywhere — should be left out of both \`fields\` and \`flagged\` entirely. This input is sometimes a short partial update (e.g. "tenant's name is X, rent due the 2nd") rather than a full listing, so most fields will legitimately be untouched — that's expected, not something to report.
- Don't manufacture ambiguity. If a name/value in the text matches (exactly, or as a same-person variant) a value already on file for some field, that's a simple restatement or confirmation of that field — fill it (or skip it if unchanged) rather than inventing a competing interpretation (e.g. "maybe this is actually a different, second person") or flagging it. Read names the way a person would: "Kenneth He" said plainly as a tenant's name is a first+last name, full stop — do not second-guess whether a surname could secretly be a pronoun, or whether a single name mentioned alone might really mean a different field is being replaced. Only flag a real conflict — the text plainly asserting a second, different tenant, or a value that contradicts what's on file — not a hypothetical one you constructed.
- When the text is phrased as a direct instruction to change a specific thing (e.g. "change tenant 1's last name to Andrei", "set the rent to X", "update the address to Y") rather than a description of the property, it's a command from the realtor about their own client/deal — just do it. The realtor knows their own client's actual name; never second-guess a given value because it "looks unusual" for that kind of field (e.g. whether a surname could also be used as a first name elsewhere) — that instinct is wrong here and only produces false flags. For a field that stores a combined full name (tenant1_full_name, tenant2_full_name, landlord_full_name), if the instruction changes only the first or only the last name, keep the other part from the value already on file and output the recombined full name — don't flag it as ambiguous just because the instruction only specified one part. Only flag a direct instruction if it's genuinely unparseable (e.g. it never actually states what value to change something to).
- Distinguish a property/unit FEATURE (e.g. "Heating Source: Gas", "A/C: Central Air", "Laundry Features: Ensuite") from an INCLUDED SERVICE (e.g. "gas is paid by the landlord", "A/C included in rent"). These are different facts. For the six inclusion fields (gas_included, ac_included, onsite_laundry_included, electricity_included, heat_included, water_included): you MAY apply the convention that an unmentioned utility is usually not included in rent (agents tend to advertise inclusions as a selling point) — but only when you're actually confident that convention applies here. If the listing's phrasing makes you genuinely unsure either way, put that field in \`flagged\` instead of guessing "not included" by default.
- Brokerage disambiguation: the listing brokerage represents the landlord/seller and is the one named under a heading like "LISTING CONTRACTED WITH". Everything under a "CO-OP" heading is a different brokerage — the buyer's/tenant's side. A "Prepared By" name at the very top of the document is just whoever printed the report for their own records — it does NOT indicate which side is the listing brokerage vs the co-op brokerage; ignore "Prepared By" entirely when deciding this, and use only the "LISTING CONTRACTED WITH" / "CO-OP" headings.
- Money amounts should be plain numeric strings with no currency symbols or commas (e.g. "3900.00").
- The listing may span several pages with dense tabular data (property details, room info, history) — check every page, not just the first, before deciding a field is absent. You may also be given more than one document at once — e.g. a main listing sheet plus one or more Schedules/Addenda attachments. Treat them as one combined source for the same deal: a fact can appear on any of them (rent payment method, for instance, is often stated on a Schedule rather than the main sheet), so check all of them before deciding a field is absent — don't assume only the first document matters.
- property_city: include the municipality/city name, and if the listing separately states a TRREB-style area or community code (e.g. "C01", "W08", "E03" — sometimes labelled "Area", "Community", or shown as part of a community name), append it after the city name (e.g. "Toronto C01"). Don't invent a code that isn't stated anywhere in the document.
- Before finalizing, re-scan the document once more against the full field list to catch anything you missed reading — a directly-stated value you overlooked, a page you skipped. This is a check for reading errors, not a reason to convert a field you correctly flagged as ambiguous into a guess. If your first pass legitimately flagged something because the listing's own language is genuinely ambiguous, it should still be flagged after the re-scan — the re-scan does not lower the bar for what counts as "confident."`;

const TOOL_NAME = "record_listing_extraction";

const FIELD_SCHEMA = {
  property_street_number: { type: "string" },
  property_street_name: { type: "string" },
  property_unit_number: { type: "string" },
  property_city: { type: "string", description: "e.g. 'Toronto C01' — append the MLS area/community code if the listing states one" },
  property_province: { type: "string" },
  property_postal_code: { type: "string" },
  property_is_condo: { type: "boolean" },
  monthly_rent_amount: { type: "string", description: "numeric only, e.g. '3900.00'" },
  rent_due_day: { type: "string", description: "day of the month rent is due, e.g. '1st', '2nd'" },
  rent_payment_method: { type: "string", description: "how rent will be paid, e.g. 'Post-dated cheques', 'e-transfer' — often stated on a Schedule/Addendum, not the main listing sheet" },
  lease_term_description: { type: "string", description: "e.g. '1 Year'" },
  landlord_full_name: { type: "string" },
  tenant1_full_name: { type: "string" },
  tenant2_full_name: { type: "string", description: "second tenant, if any" },
  property_parking_info: { type: "string", description: "e.g. 'None', '1 space'" },
  rent_deposit_required: { type: "boolean" },
  key_deposit_required: { type: "boolean" },
  key_deposit_amount: { type: "string", description: "numeric only, e.g. '300'" },
  tenant_insurance_required: { type: "boolean" },
  commission_terms: { type: "string", description: "e.g. 'Half Month Rent'" },
  holdover_days: { type: "string", description: "numeric only" },
  listing_brokerage_name: { type: "string" },
  listing_brokerage_agent_name: { type: "string" },
  listing_brokerage_phone: { type: "string" },
  coop_brokerage_name: { type: "string" },
  coop_brokerage_agent_name: { type: "string" },
  coop_brokerage_phone: { type: "string" },
  coop_brokerage_address: { type: "string", description: "co-op/tenant-side brokerage's mailing address" },
  gas_included: { type: "boolean" },
  ac_included: { type: "boolean" },
  onsite_laundry_included: { type: "boolean" },
  electricity_included: { type: "boolean" },
  heat_included: { type: "boolean" },
  water_included: { type: "boolean" },
} as const;

interface ExtractionResult {
  fields: Partial<Record<keyof typeof FIELD_SCHEMA, string | boolean>>;
  flagged: Partial<Record<keyof typeof FIELD_SCHEMA, string>>;
}

async function getUserContent(request: Request): Promise<Anthropic.MessageParam["content"]> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const files = formData.getAll("file").filter((f): f is File => f instanceof File);
    if (files.length === 0) {
      throw new Error("No PDF file provided");
    }
    const nonPdf = files.find((f) => f.type !== "application/pdf");
    if (nonPdf) {
      throw new Error(`"${nonPdf.name}" isn't a PDF`);
    }

    const documentBlocks = await Promise.all(
      files.map(async (file) => ({
        type: "document" as const,
        source: {
          type: "base64" as const,
          media_type: "application/pdf" as const,
          data: Buffer.from(await file.arrayBuffer()).toString("base64"),
        },
      }))
    );

    const instruction =
      files.length > 1
        ? `Extract the listing fields from these ${files.length} PDF documents per the system instructions. They're all for the same property/deal (e.g. a main listing sheet plus Schedule/Addendum attachments) — read all of them as one combined source rather than assuming only the first file matters.`
        : "Extract the listing fields from this PDF per the system instructions.";

    return [...documentBlocks, { type: "text", text: instruction }];
  }

  const body = await request.json();
  const text = typeof body?.text === "string" ? body.text : "";
  if (!text.trim()) {
    throw new Error("No listing text found");
  }
  const currentAnswers =
    body?.currentAnswers && typeof body.currentAnswers === "object" ? body.currentAnswers : null;

  if (currentAnswers && Object.keys(currentAnswers).length > 0) {
    return `This deal already has the following values on file (JSON):\n\n${JSON.stringify(currentAnswers, null, 2)}\n\nNew text to read — a partial update/addition to the deal above, not a fresh listing. Use the values already on file to resolve references (e.g. a bare brokerage/person name that matches one already on file belongs to that same field) instead of flagging them as ambiguous. Only include a field in \`fields\` if this new text adds or changes it — don't re-emit values that are already correct and untouched by this text.\n\n"""\n${text}\n"""`;
  }

  return `Listing text:\n\n"""\n${text}\n"""`;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let userContent: Anthropic.MessageParam["content"];
  try {
    userContent = await getUserContent(request);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid request" }, { status: 400 });
  }


  function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  // Forced tool use is normally reliable, but on rare occasions the model
  // returns a malformed tool_use.input (observed: a `fields` value that was a
  // raw string instead of an object) — Object.entries() on that silently
  // produces garbage numeric-index keys, which would then get merged into
  // deal.json by the caller and corrupt real deal data. One retry clears it
  // every time it's been observed to happen; only give up and surface an
  // error if it's malformed twice in a row.
  let result: ExtractionResult | null = null;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2 && !result; attempt++) {
    try {
      const candidate = await claudeExtractWithTool<ExtractionResult>(
        SYSTEM_PROMPT,
        userContent,
        TOOL_NAME,
        "Record extracted listing fields, splitting confident values from ones that need human judgment.",
        {
          type: "object",
          properties: {
            fields: {
              type: "object",
              description: "Confidently-extracted or safely-inferred values, keyed by field name. Omit anything you're not sure about.",
              properties: FIELD_SCHEMA,
              additionalProperties: false,
            },
            flagged: {
              type: "object",
              description: "field name -> short reason it couldn't be confidently filled",
              additionalProperties: { type: "string" },
            },
          },
          required: ["fields", "flagged"],
        }
      );
      if (isPlainObject(candidate?.fields) && isPlainObject(candidate?.flagged)) {
        result = candidate;
      } else {
        lastErr = new Error("Extraction returned malformed output");
      }
    } catch (err) {
      lastErr = err;
    }
  }

  if (!result) {
    return NextResponse.json(
      { error: lastErr instanceof Error ? lastErr.message : "Extraction failed (is ANTHROPIC_API_KEY set?)" },
      { status: 502 }
    );
  }

  const answers: Record<string, string> = {};
  const flagged: Record<string, string> = {};

  const booleanFieldTargets: Record<string, { trueVal: string; falseVal: string }> = {
    property_is_condo: { trueVal: "/1", falseVal: "/2" },
    rent_deposit_required: { trueVal: "/2", falseVal: "/1" },
    key_deposit_required: { trueVal: "/2", falseVal: "/1" },
    tenant_insurance_required: { trueVal: "/2", falseVal: "/1" },
    gas_included: { trueVal: "/1", falseVal: "/2" },
    ac_included: { trueVal: "/1", falseVal: "/2" },
    onsite_laundry_included: { trueVal: "/1", falseVal: "/2" },
    electricity_included: { trueVal: "/1", falseVal: "/2" },
    heat_included: { trueVal: "/1", falseVal: "/2" },
    water_included: { trueVal: "/1", falseVal: "/2" },
  };
  const answerKeyOverrides: Record<string, string> = {
    onsite_laundry_included: "onsite_laundry",
    electricity_included: "electricity_responsibility",
    heat_included: "heat_responsibility",
    water_included: "water_responsibility",
  };

  for (const [sourceKey, value] of Object.entries(result.fields ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    const answerKey = answerKeyOverrides[sourceKey] ?? sourceKey;

    if (typeof value === "boolean") {
      const codes = booleanFieldTargets[sourceKey];
      answers[answerKey] = codes ? (value ? codes.trueVal : codes.falseVal) : value ? "/1" : "/2";
    } else {
      answers[answerKey] = value;
    }
  }

  // The 2229E form has separate first/last name fields rather than one full-name
  // field (see intake_form_schema.json's tenant1_first_name/tenant1_last_name) —
  // split so a name extracted here reaches that form too, not just Forms
  // 400/410/324/372 which take the combined tenant*_full_name field directly.
  for (const [fullNameKey, firstKey, lastKey] of [
    ["tenant1_full_name", "tenant1_first_name", "tenant1_last_name"],
    ["tenant2_full_name", "tenant2_first_name", "tenant2_last_name"],
  ] as const) {
    const fullName = answers[fullNameKey];
    if (!fullName) continue;
    const { firstName, lastName } = splitFullName(fullName);
    answers[firstKey] = firstName;
    answers[lastKey] = lastName;
  }

  for (const [sourceKey, reason] of Object.entries(result.flagged ?? {})) {
    const answerKey = answerKeyOverrides[sourceKey] ?? sourceKey;
    flagged[answerKey] = reason;
  }

  return NextResponse.json({ answers, flagged });
}

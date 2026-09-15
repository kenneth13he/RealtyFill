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
//   - multipart/form-data: one or more "file" fields containing PDFs and/or
//     plain-text (.txt) files. A PDF is sent to Claude natively as its own
//     `document` content block (base64), NOT flattened to text first — an
//     earlier version pre-extracted text via lib/pdfText.ts / pypdf, which
//     loses table/column layout (e.g. REALM's two-column property-info
//     table can linearize into a jumbled label/value order) — sending the
//     actual PDF lets Claude read the real layout instead. A .txt file has
//     no layout to preserve, so it's just read as text and folded into the
//     message the same way pasted text is. Multiple files (main listing
//     sheet + Schedules/Addenda attachments, any mix of PDF/.txt) are sent
//     together in one message so the model can pull a fact from whichever
//     document actually states it — e.g. rent payment method is often on a
//     Schedule, not the main sheet — rather than only reading the first file.

import { NextResponse } from "next/server";
import { claudeExtractWithTool } from "@/lib/claude";
import { splitFullName } from "@/lib/splitFullName";
import { createClient } from "@/lib/supabase/server";
import { getOwnedDeal } from "@/lib/supabase/getOwnedDeal";
import { getIntakeFormSchema } from "@/lib/schemas";
import { DEFAULT_FORM_SET, filterSchemaForSet, toFormSetId, type FormSetId } from "@/lib/formTypes";
import { checkRateLimit } from "@/lib/rateLimit";
import { LIMITS } from "@/lib/inputLimits";
import { logError, userFacingError } from "@/lib/logger";
import type Anthropic from "@anthropic-ai/sdk";

// This route waits on a single Opus call with a whole listing document and
// forced tool use, which can run well past a minute on a long PDF. The
// platform's default function timeout is far shorter than that, so without
// this the request is killed mid-inference and the realtor sees a generic
// failure after a long wait. Requires a Vercel plan allowing durations this
// long; on Hobby the cap is lower and the build clamps it.
export const maxDuration = 300;

// Which transaction this deal actually is.
//
// This prompt used to be a constant that opened "for an Ontario rental
// deal", and the tool schema below was a hardcoded list of 34 lease fields
// with no buyer, seller, purchase price or closing date in it at all. On a
// sale deal that meant the model was asked to read a purchase update using
// only rental vocabulary: "Bob is Buyer" had no buyer field to land in, the
// nearest match was tenant1_full_name, and it correctly refused to guess and
// flagged the mismatch instead. The model was right — the question it was
// handed was wrong. Both the framing and the field list now follow the
// deal's own form set.
const TRANSACTION_FRAMING: Record<FormSetId, string> = {
  lease_tenant:
    "an Ontario residential LEASE, working for the TENANT's side. The parties are a landlord and one or more tenants.",
  lease_landlord:
    "an Ontario residential LEASE, working for the LANDLORD's (listing) side. The parties are a landlord and one or more tenants.",
  sale_buyer:
    "an Ontario residential PURCHASE, working for the BUYER's side. The parties are a buyer and a seller — there is no tenant, no landlord and no rent in this transaction, so read words like \"buyer\" and \"seller\" literally.",
  sale_seller:
    "an Ontario residential SALE, working for the SELLER's (listing) side. The parties are a seller and a buyer — there is no tenant, no landlord and no rent in this transaction, so read words like \"buyer\" and \"seller\" literally.",
};

export const buildSystemPrompt = (setId: FormSetId) => `You are extracting structured data from a real-estate document — an MLS/REALM printout, an email, or a short note the realtor typed — for ${TRANSACTION_FRAMING[setId]} Accuracy matters more than completeness — this feeds real legal/transactional forms.

Only the fields in the tool schema exist for this deal; they are already narrowed to this transaction type. If the text mentions something with no matching field, leave it out rather than forcing it into a field that means something else.

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

// Hand-tuned entries: the fields where the type isn't simply "string", or
// where a description earned its place by fixing a real extraction mistake.
// Anything in the intake schema that isn't listed here is generated below as
// a plain string keyed by its own label, so adding a field to the intake
// schema makes it extractable without touching this file.
const FIELD_HINTS: Record<string, { type: string; description?: string }> = {
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
};

/**
 * The tool schema for one deal: every question its form set actually asks.
 *
 * Built from the intake schema rather than hardcoded, so the model is only
 * ever offered fields that exist for this transaction — a purchase deal is
 * never shown `tenant1_full_name`, which is what made "Bob is Buyer"
 * ambiguous in the first place.
 *
 * Hidden fields are skipped: they're computed (split names, date parts,
 * amounts in words) and filling them directly would fight lib/profileMapper.
 */
export function buildFieldSchema(setId: FormSetId): Record<string, { type: string; description?: string }> {
  const schema = filterSchemaForSet(getIntakeFormSchema(), setId);
  const properties: Record<string, { type: string; description?: string }> = {};

  for (const group of schema.groups) {
    for (const field of group.fields) {
      if (field.hidden) continue;

      const hint = FIELD_HINTS[field.key];
      if (hint) {
        properties[field.key] = hint;
        continue;
      }

      // Everything reaching a PDF is written as text, so dates and money are
      // strings with a stated format rather than JSON types — profileMapper
      // parses ISO dates into the day/month/year blanks these forms print.
      const description =
        field.type === "date"
          ? `${field.label} — ISO format, yyyy-mm-dd`
          : field.type === "currency" || field.type === "number"
            ? `${field.label} — numeric only, no currency symbols or commas`
            : field.label;
      properties[field.key] = { type: "string", description };
    }
  }

  // The utility inclusion fields are stored under different answer keys than
  // the model is asked for (see answerKeyOverrides below), so they'd never
  // be generated by the loop above from their real keys.
  for (const key of ["onsite_laundry_included", "electricity_included", "heat_included", "water_included"]) {
    if (FIELD_HINTS[key] && !properties[key]) {
      const stored = { onsite_laundry_included: "onsite_laundry", electricity_included: "electricity_responsibility",
                       heat_included: "heat_responsibility", water_included: "water_responsibility" }[key]!;
      if (schema.groups.some((g) => g.fields.some((f) => f.key === stored))) {
        properties[key] = FIELD_HINTS[key];
      }
    }
  }

  return properties;
}

interface ExtractionResult {
  fields: Record<string, string | boolean>;
  flagged: Record<string, string>;
}

async function getUserContent(request: Request): Promise<Anthropic.MessageParam["content"]> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const files = formData.getAll("file").filter((f): f is File => f instanceof File);
    if (files.length === 0) {
      throw new Error("No file provided");
    }
    // PDFs go to Claude as a native `document` block (preserves table/column
    // layout — important for MLS listing sheets). A plain text file has no
    // layout to preserve, so it's just read as text and folded in the same
    // way pasted text already is — some browsers don't set a MIME type for
    // .txt at all, hence the extension fallback.
    const isPdf = (f: File) => f.type === "application/pdf";
    const isText = (f: File) => f.type === "text/plain" || f.type === "" || f.name.toLowerCase().endsWith(".txt");
    const unsupported = files.find((f) => !isPdf(f) && !isText(f));
    if (unsupported) {
      throw new Error(`"${unsupported.name}" isn't a supported file type — only PDF and plain text (.txt) are.`);
    }

    // Size is checked before anything is read into memory. Rate limiting
    // caps how often this endpoint is called, not how much each call sends,
    // and every byte of a PDF here is billed as tokens against
    // ANTHROPIC_API_KEY once it reaches the model.
    if (files.length > LIMITS.fileCount) {
      throw new Error(`Too many files at once (max ${LIMITS.fileCount}).`);
    }
    const tooBig = files.find((f) => f.size > LIMITS.fileBytes);
    if (tooBig) {
      throw new Error(
        `"${tooBig.name}" is too large (${Math.round(tooBig.size / 1024 / 1024)} MB; max ${LIMITS.fileBytes / 1024 / 1024} MB).`
      );
    }
    const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
    if (totalBytes > LIMITS.totalUploadBytes) {
      throw new Error(`Those files are too large together (max ${LIMITS.totalUploadBytes / 1024 / 1024} MB).`);
    }

    const blocks = await Promise.all(
      files.map(async (file) => {
        if (isPdf(file)) {
          return {
            type: "document" as const,
            source: {
              type: "base64" as const,
              media_type: "application/pdf" as const,
              data: Buffer.from(await file.arrayBuffer()).toString("base64"),
            },
          };
        }
        return { type: "text" as const, text: `File "${file.name}":\n\n"""\n${await file.text()}\n"""` };
      })
    );

    const instruction =
      files.length > 1
        ? `Extract the listing fields from these ${files.length} documents per the system instructions. They're all for the same property/deal (e.g. a main listing sheet plus Schedule/Addendum attachments) — read all of them as one combined source rather than assuming only the first file matters.`
        : "Extract the listing fields from this document per the system instructions.";

    return [...blocks, { type: "text", text: instruction }];
  }

  const body = await request.json();
  const text = typeof body?.text === "string" ? body.text : "";
  if (!text.trim()) {
    throw new Error("No listing text found");
  }
  // Same reasoning as the upload limits above: this text is billed as tokens.
  if (text.length > LIMITS.pastedTextChars) {
    throw new Error(`That's too much text to read at once (max ${LIMITS.pastedTextChars.toLocaleString()} characters).`);
  }
  const currentAnswers =
    body?.currentAnswers && typeof body.currentAnswers === "object" ? body.currentAnswers : null;

  if (currentAnswers && Object.keys(currentAnswers).length > 0) {
    return `This deal already has the following values on file (JSON):\n\n${JSON.stringify(currentAnswers, null, 2)}\n\nNew text to read — a partial update/addition to the deal above, not a fresh listing. Use the values already on file to resolve references (e.g. a bare brokerage/person name that matches one already on file belongs to that same field) instead of flagging them as ambiguous. Only include a field in \`fields\` if this new text adds or changes it — don't re-emit values that are already correct and untouched by this text.\n\n"""\n${text}\n"""`;
  }

  return `Listing text:\n\n"""\n${text}\n"""`;
}

/**
 * Which form set's fields to offer the model.
 *
 * `dealId` comes in on the query string rather than in the body on purpose:
 * this endpoint accepts both JSON and multipart, a body can only be read
 * once, and getUserContent() below needs it.
 *
 * Falls back to the default set when no usable deal id is given, so the
 * endpoint keeps working for any caller that hasn't been updated.
 */
async function resolveFormSet(
  request: Request,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<FormSetId> {
  const dealId = new URL(request.url).searchParams.get("dealId");
  if (!dealId) return DEFAULT_FORM_SET;
  const deal = await getOwnedDeal(supabase, dealId);
  return deal ? toFormSetId(deal.form_set) : DEFAULT_FORM_SET;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // This is the one endpoint in the app that costs real money per call
  // (Claude API). Per-user rather than per-IP, since it's already
  // authenticated — a generous cap meant to catch a runaway client/bug or
  // abuse, not to constrain normal usage (a realtor pasting updates all day
  // won't come close to 60/hour).
  // failOpen: false — every call past this point bills ANTHROPIC_API_KEY, so
  // if the limiter itself can't be reached, refusing is the cheap mistake and
  // allowing is the expensive one. This is the only call site that inverts
  // the default.
  if (!(await checkRateLimit(`extract:${user.id}`, 60, 60 * 60 * 1000, { failOpen: false }))) {
    return NextResponse.json({ error: "Rate limit exceeded — please wait a while before trying again." }, { status: 429 });
  }

  // Which deal this is for decides which fields exist. Read from the request
  // but never trusted — getOwnedDeal is RLS-scoped, so a deal id belonging to
  // someone else comes back null and is treated as "not specified".
  const setId = await resolveFormSet(request, supabase);

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
        buildSystemPrompt(setId),
        userContent,
        TOOL_NAME,
        "Record extracted listing fields, splitting confident values from ones that need human judgment.",
        {
          type: "object",
          properties: {
            fields: {
              type: "object",
              description: "Confidently-extracted or safely-inferred values, keyed by field name. Omit anything you're not sure about.",
              properties: buildFieldSchema(setId),
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
    const ref = logError({ route: "extract-listing", userId: user.id }, lastErr);
    return NextResponse.json(
      { error: userFacingError(ref, "Couldn't read that listing."), ref },
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

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
//   - multipart/form-data: a "file" field containing a PDF — sent to Claude
//     natively as a `document` content block (base64), NOT flattened to text
//     first. An earlier version pre-extracted text via lib/pdfText.ts /
//     pypdf, which loses table/column layout (e.g. REALM's two-column
//     property-info table can linearize into a jumbled label/value order) —
//     sending the actual PDF lets Claude read the real layout instead.

import { NextResponse } from "next/server";
import { claudeExtractWithTool } from "@/lib/claude";
import type Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `You are extracting structured data from a real-estate listing export (e.g. a REALM/MLS printout) for an Ontario rental deal. Accuracy matters more than completeness — this feeds real legal/transactional forms.

Rules:
- Only put a value in \`fields\` if you're genuinely confident in it, either because the listing states it directly, or because a well-established real estate convention makes it a safe inference (e.g. commission phrasing, standard deposit terminology).
- If something is ambiguous, contradictory, or you're genuinely unsure — put it in \`flagged\` with a short reason instead of guessing. Never force an answer you're not confident in just to fill every field.
- Distinguish a property/unit FEATURE (e.g. "Heating Source: Gas", "A/C: Central Air", "Laundry Features: Ensuite") from an INCLUDED SERVICE (e.g. "gas is paid by the landlord", "A/C included in rent"). These are different facts. For the six inclusion fields (gas_included, ac_included, onsite_laundry_included, electricity_included, heat_included, water_included): you MAY apply the convention that an unmentioned utility is usually not included in rent (agents tend to advertise inclusions as a selling point) — but only when you're actually confident that convention applies here. If the listing's phrasing makes you genuinely unsure either way, put that field in \`flagged\` instead of guessing "not included" by default.
- Brokerage disambiguation: the listing brokerage represents the landlord/seller and is the one named under a heading like "LISTING CONTRACTED WITH". Everything under a "CO-OP" heading is a different brokerage — the buyer's/tenant's side. A "Prepared By" name at the very top of the document is just whoever printed the report for their own records — it does NOT indicate which side is the listing brokerage vs the co-op brokerage; ignore "Prepared By" entirely when deciding this, and use only the "LISTING CONTRACTED WITH" / "CO-OP" headings.
- Money amounts should be plain numeric strings with no currency symbols or commas (e.g. "3900.00").
- The listing may span several pages with dense tabular data (property details, room info, history) — check every page, not just the first, before deciding a field is absent.
- Before finalizing, re-scan the document once more against the full field list to catch anything you missed reading — a directly-stated value you overlooked, a page you skipped. This is a check for reading errors, not a reason to convert a field you correctly flagged as ambiguous into a guess. If your first pass legitimately flagged something because the listing's own language is genuinely ambiguous, it should still be flagged after the re-scan — the re-scan does not lower the bar for what counts as "confident."`;

const TOOL_NAME = "record_listing_extraction";

const FIELD_SCHEMA = {
  property_street_number: { type: "string" },
  property_street_name: { type: "string" },
  property_unit_number: { type: "string" },
  property_city: { type: "string" },
  property_province: { type: "string" },
  property_postal_code: { type: "string" },
  property_is_condo: { type: "boolean" },
  monthly_rent_amount: { type: "string", description: "numeric only, e.g. '3900.00'" },
  lease_term_description: { type: "string", description: "e.g. '1 Year'" },
  landlord_full_name: { type: "string" },
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
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new Error("No PDF file provided");
    }
    if (file.type !== "application/pdf") {
      throw new Error("Uploaded file must be a PDF");
    }
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    return [
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
      { type: "text", text: "Extract the listing fields from this PDF per the system instructions." },
    ];
  }

  const body = await request.json();
  const text = typeof body?.text === "string" ? body.text : "";
  return `Listing text:\n\n"""\n${text}\n"""`;
}

export async function POST(request: Request) {
  let userContent: Anthropic.MessageParam["content"];
  try {
    userContent = await getUserContent(request);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid request" }, { status: 400 });
  }

  const isEmptyText = typeof userContent === "string" && !userContent.replace(/Listing text:|"""/g, "").trim();
  if (isEmptyText) {
    return NextResponse.json({ error: "No listing text found" }, { status: 400 });
  }

  let result: ExtractionResult;
  try {
    result = await claudeExtractWithTool<ExtractionResult>(
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
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Extraction failed (is ANTHROPIC_API_KEY set?)" },
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

  for (const [sourceKey, reason] of Object.entries(result.flagged ?? {})) {
    const answerKey = answerKeyOverrides[sourceKey] ?? sourceKey;
    flagged[answerKey] = reason;
  }

  return NextResponse.json({ answers, flagged });
}

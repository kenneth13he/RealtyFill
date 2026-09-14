// app/api/generate/route.ts
// Fill pipeline endpoint — turns reviewed intake answers into filled PDFs.
// This is the "fill pipeline" endpoint from mvp-build-plan.md Phase 1 Step 5 /
// Phase 2 Step 14.
//
// Input: { selectedForms: FormId[] }.
// Steps:
//   1. Load the deal's reviewed intake answers from data/deal.json (Phase 1
//      storage — never raw/unreviewed data; the /review page is what writes
//      the final reviewed copy before calling this route).
//   2. For each selected form, map answers -> that form's field_id values
//      (lib/profileMapper.ts).
//   3. Fill forms/blank_templates/<form>_blank.pdf -> data/output/<form>.pdf
//      (lib/pdfFill.ts). Phase 2 swaps local output for private object
//      storage + a signed URL.
// Output: [{ form, downloadUrl }] for the forms actually generated.
//
// Hard rule carried over from the project context doc: never write a value
// into any signature field, on any form — enforced inside profileMapper, not
// here, so every caller of the mapper gets this for free.

import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { ALL_FORM_IDS, FormId } from "@/lib/schemas";
import { mapIntakeToFormFields } from "@/lib/profileMapper";
import { fillPdf } from "@/lib/pdfFill";

const DATA_DIR = path.join(process.cwd(), "data");
const DEAL_PATH = path.join(DATA_DIR, "deal.json");
const OUTPUT_DIR = path.join(DATA_DIR, "output");
const TEMPLATES_DIR = path.join(process.cwd(), "forms", "blank_templates");

export async function POST(request: Request) {
  const body = await request.json();
  const selectedForms: FormId[] = Array.isArray(body?.selectedForms) ? body.selectedForms : [];

  const invalid = selectedForms.filter((f) => !ALL_FORM_IDS.includes(f));
  if (invalid.length > 0) {
    return NextResponse.json({ error: `Unknown form id(s): ${invalid.join(", ")}` }, { status: 400 });
  }
  if (selectedForms.length === 0) {
    return NextResponse.json({ error: "selectedForms must include at least one form" }, { status: 400 });
  }

  let intakeAnswers: Record<string, string>;
  try {
    intakeAnswers = JSON.parse(await fs.readFile(DEAL_PATH, "utf-8"));
  } catch {
    return NextResponse.json({ error: "No intake data found — fill out /intake first" }, { status: 400 });
  }

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const results: { form: FormId; downloadUrl: string }[] = [];
  try {
    for (const formId of selectedForms) {
      const fields = mapIntakeToFormFields(intakeAnswers, formId);
      const blankPath = path.join(TEMPLATES_DIR, `${formId}_blank.pdf`);
      const outputPath = path.join(OUTPUT_DIR, `${formId}.pdf`);
      await fillPdf(blankPath, fields, outputPath);
      results.push({ form: formId, downloadUrl: `/api/download/${formId}` });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate PDF" },
      { status: 500 }
    );
  }

  return NextResponse.json({ results });
}

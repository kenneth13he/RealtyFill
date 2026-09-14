// app/api/generate/route.ts
// Backend endpoint that turns reviewed intake answers into filled PDFs.
// This is the "fill pipeline" endpoint from mvp-build-plan.md Phase 1 Step 5 /
// Phase 2 Step 14.
//
// Input: { dealId, selectedForms: string[] } — selectedForms is a subset of
//   ["2229e", "form_400", "form_410", "form_324", "form_372"].
// Steps:
//   1. Load the deal's reviewed intake answers (never raw/unreviewed data).
//   2. For each selected form, use lib/profileMapper.ts to turn intake answers
//      into that form's { field_id: value } map (per forms/schemas/*_raw.json).
//   3. Call lib/pdfFill.ts to fill forms/blank_templates/<form>_blank.pdf with
//      that map and produce an output PDF.
//   4. Store each output PDF (Phase 1: local scratch; Phase 2: private object
//      storage with a short-lived signed URL — never public).
// Output: list of { form, downloadUrl } for the forms actually generated.
//
// Hard rule carried over from the project context doc: never write a value
// into any signature field, on any form, ever.

export async function POST(request: Request) {
  // TODO: load reviewed intake answers for dealId
  // TODO: for each selectedForm, map answers -> field_id values (lib/profileMapper.ts)
  // TODO: fill blank template -> output PDF (lib/pdfFill.ts)
  // TODO: store output, return signed/download URLs
  // NEVER: write to a signature field
  return new Response(null, { status: 501 });
}

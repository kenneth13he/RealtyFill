// lib/pdfFill.ts
// Fills one blank PDF template with a { field_id: value } map and writes the
// output PDF. This is the "hard part" already proven to work for the 2229E
// (see project-context.md section 5) — reverse-engineered radio-group value
// semantics, verified visually across every page.
//
// OPEN DECISION (not yet made — flag before Phase 2 Step 8 scaffolding):
// the working fill logic today is Python (pypdf), living in ./scripts/
// (fill_fillable_fields.py, extract_form_field_info.py). Two ways forward:
//   (a) shell out to those Python scripts from this Node/Next.js route, or
//   (b) port the fill logic to a JS PDF library (e.g. pdf-lib) so the whole
//       app is one language/runtime.
// (a) is faster to ship for the Phase 1 demo since the Python already works;
// (b) is cleaner for Phase 2 deployment (no Python runtime dependency on the
// server). Pick one before Step 5/14 are actually implemented.
//
// Hard rule: never write a value into a signature field, on any form, ever.

export async function fillPdf(
  blankTemplatePath: string,
  fieldValues: Record<string, string>,
  outputPath: string
): Promise<void> {
  // TODO: decide (a) shell out to scripts/fill_fillable_fields.py
  //         or (b) port to pdf-lib — see OPEN DECISION above
  // TODO: assert no signature field_id is present in fieldValues before filling
}

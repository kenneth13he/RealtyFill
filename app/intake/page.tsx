// app/intake/page.tsx
// The Deal Intake Form (mvp-build-plan.md Phase 1 Step 4 / Phase 2 Step 12).
// Renders one form section per group in forms/schemas/intake_form_schema.json
// (Parties, Property, Rent & Deposits, Term & Conditions, Utilities, Brokerage,
// plus form-specific sections for 324/372/410).
//
// Responsibilities:
// - Read intake_form_schema.json (via lib/schemas.ts) and render fields by group.
// - Support an optional "paste a REALM listing export" flow that pre-fills the
//   Property group only — pre-filled values must remain editable (see the
//   "known traps" note in forms/schemas/README.md: listing features like
//   heating source / A/C / laundry are NOT the same as included-service fields).
// - On submit, POST the answers to /api/intake to persist against a deal.
//
// Explicitly NOT this file's job: mapping answers to PDF field IDs (that's
// lib/profileMapper.ts) or generating PDFs (that's /api/generate).

export default function IntakePage() {
  // TODO: render form groups from intake_form_schema.json
  // TODO: "paste listing export" pre-fill for the Property group
  // TODO: submit handler -> POST /api/intake
  return null;
}

// lib/schemas.ts
// Loads and exposes the JSON schemas under forms/schemas/ to the rest of the app:
//   - intake_form_schema.json (drives the /intake UI)
//   - deal_profile_schema.json (shared fields across 2+ forms)
//   - <form>_raw.json x5 (per-form field structure: id, type, page, radio/checkbox values)
//
// This is the single place that reads those files, so the frontend (rendering
// the intake form) and backend (mapping answers to PDF fields) both consume
// the same parsed, typed shape rather than each re-parsing JSON independently.

export function getIntakeFormSchema() {
  // TODO: read + parse forms/schemas/intake_form_schema.json
}

export function getDealProfileSchema() {
  // TODO: read + parse forms/schemas/deal_profile_schema.json
}

export function getRawFormSchema(formId: "2229e" | "form_400" | "form_410" | "form_324" | "form_372") {
  // TODO: read + parse forms/schemas/<formId>_raw.json
}

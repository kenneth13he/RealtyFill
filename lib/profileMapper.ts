// lib/profileMapper.ts
// Maps one set of Deal Intake Form answers (keyed by intake_form_schema.json's
// field "key"s) into the { field_id: value } shape each individual PDF needs
// (keyed by that form's own field IDs, per forms/schemas/<form>_raw.json).
//
// This is the "Property Profile reuse" logic: a single intake answer like
// tenant1_full_name fans out to txtbuyer1 on Form 400, txtbuyer1 + txtbuyersig1
// on Form 410/324/372, and txtbuyer1FName + txtbuyer1LName (split) on the 2229E —
// see forms/schemas/deal_profile_schema.json for the full mapping table.
//
// Radio/checkbox fields must be mapped to their exact value code (e.g. "/1",
// "/2") as documented in intake_form_schema.json's "options" — never pass a
// human label like "Yes" straight through to the fill step.

export function mapIntakeToFormFields(
  intakeAnswers: Record<string, unknown>,
  formId: "2229e" | "form_400" | "form_410" | "form_324" | "form_372"
): Record<string, string> {
  // TODO: walk intake_form_schema.json's fields, for each one whose `targets`
  //   includes this formId, write intakeAnswers[key] -> targets[formId] field_id(s)
  // TODO: apply radio/checkbox value-code translation from `options`
  // TODO: never emit a value for any field_id known to be a signature field
  return {};
}

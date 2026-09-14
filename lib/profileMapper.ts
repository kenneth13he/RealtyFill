// lib/profileMapper.ts
// Maps one set of Deal Intake Form answers (keyed by intake_form_schema.json's
// field "key"s) into the [{field_id, page, value}] list scripts/fill_fillable_fields.py
// needs to fill one specific PDF (keyed by that form's own field IDs, per
// forms/schemas/<form>_raw.json).
//
// This is the "Property Profile reuse" logic: a single intake answer like
// tenant1_full_name fans out to txtbuyer1 on Form 400, txtbuyer1 + txtbuyersig1
// on Form 410/324/372 — see forms/schemas/deal_profile_schema.json for the
// full mapping table this was built from.
//
// Radio/checkbox fields are stored in intake answers as their value code
// already (e.g. "/1", "/2") since app/intake's UI writes the code, not the
// human label — see IntakeField.options in lib/schemas.ts.

import { FormId, IntakeFormSchema, RawFieldInfo, getIntakeFormSchema, getRawFormSchema } from "./schemas";

export interface FillableField {
  field_id: string;
  page: number;
  value: string;
}

// Signature fields are never written to, on any form, per the project's firm
// product/legal boundary — matched by common naming patterns across all five forms.
const SIGNATURE_FIELD_PATTERN = /sig|Signature/i;

// Exception: txtbuyersig#/txtsellersig#/txtTenantNSig are the printed-NAME
// column of each landlord/tenant signature row, not the signature itself,
// despite the misleading "sig" in their field ID — confirmed by inspecting
// the actual PDF layout (2229E page 7: each row prints "Name | Signature |
// Date" as three columns, but only ONE fillable field exists per row, and
// its rect (x: 17.7-251.7 of a ~612pt page) lines up with the leftmost
// "Name" column only — the real Signature/Date columns have no fillable
// field at all, so there's nothing for this exception to accidentally
// collide with). This file's own header comment already documented these
// exact fields as intended fill targets before the blanket pattern above
// was added and silently broke that — this restores it precisely rather
// than loosening the rule for every "sig"-named field on every form.
const NAME_FIELD_EXCEPTION = /^txt(?:buyer|seller)sig\d+$|^txtTenant\dSig$/;

export function mapIntakeToFormFields(
  intakeAnswers: Record<string, string>,
  formId: FormId,
  schema: IntakeFormSchema = getIntakeFormSchema(),
  rawFields: RawFieldInfo[] = getRawFormSchema(formId)
): FillableField[] {
  const pageByFieldId = new Map(rawFields.map((f) => [f.field_id, f.page]));
  const out: FillableField[] = [];

  for (const group of schema.groups) {
    for (const field of group.fields) {
      const targetIds = field.targets[formId];
      if (!targetIds) continue;

      const answer = intakeAnswers[field.key];
      if (answer === undefined || answer === null || answer === "") continue;

      for (const fieldId of targetIds) {
        if (SIGNATURE_FIELD_PATTERN.test(fieldId) && !NAME_FIELD_EXCEPTION.test(fieldId)) continue;
        const page = pageByFieldId.get(fieldId);
        if (page === undefined) continue; // field not present on this form/page — skip rather than error
        out.push({ field_id: fieldId, page, value: answer });
      }
    }
  }

  return out;
}

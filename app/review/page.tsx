// app/review/page.tsx
// Review + form-selection screen (mvp-build-plan.md Phase 1 Step 6 / Phase 2 Step 13).
// Shown after the intake form is submitted, before any PDF is generated.
//
// Responsibilities:
// - Show a summary of every answer collected in /intake, grouped the same way,
//   with an "edit" affordance per field/group (never edit-in-place silently —
//   the "human always reviews before anything is generated" principle from the
//   project context doc has to be visibly true here, not just claimed).
// - Let the realtor check which of the five supported forms to generate
//   (2229E, Form 400, Form 410, Form 324, Form 372) — not all forms need every
//   answer, so only show/require fields relevant to the currently checked forms.
// - On confirm, POST the reviewed answers + selected form list to /api/generate.

export default function ReviewPage() {
  // TODO: render read-only summary of intake answers, grouped
  // TODO: per-field edit affordance (routes back into intake state, not a silent PATCH)
  // TODO: checkboxes for the 5 target forms
  // TODO: submit handler -> POST /api/generate
  return null;
}

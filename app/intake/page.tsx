// app/intake/page.tsx
// The Deal Intake Form (mvp-build-plan.md Phase 1 Step 4 / Phase 2 Step 12).
// Server component: loads intake_form_schema.json via lib/schemas.ts and
// hands it to the client-side renderer (IntakeForm.tsx) which owns the
// actual form state/submission.

import { getIntakeFormSchema } from "@/lib/schemas";
import Header from "@/components/Header";
import IntakeForm from "./IntakeForm";

export default function IntakePage() {
  const schema = getIntakeFormSchema();
  return (
    <>
      <Header active="intake" />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">New Deal — Intake</h1>
        <p className="mt-1 text-[var(--color-text-muted)]">
          Fill this out once — it flows into every form you generate for this deal.
        </p>
        <div className="mt-8">
          <IntakeForm schema={schema} />
        </div>
      </main>
    </>
  );
}

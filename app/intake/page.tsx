// app/intake/page.tsx
// The Deal Intake Form (mvp-build-plan.md Phase 1 Step 4 / Phase 2 Step 12).
// Server component: loads intake_form_schema.json via lib/schemas.ts and the
// deal's saved answers from data/deal.json (same read app/review/page.tsx
// does), handing both to the client-side renderer (IntakeForm.tsx) so
// "Edit answers" from /review actually opens with the existing deal loaded
// instead of a blank form that would overwrite it on submit.

import fs from "fs/promises";
import path from "path";
import { getIntakeFormSchema } from "@/lib/schemas";
import Header from "@/components/Header";
import IntakeForm from "./IntakeForm";

async function loadDealAnswers(): Promise<Record<string, string>> {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), "data", "deal.json"), "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export default async function IntakePage() {
  const [schema, initialAnswers] = await Promise.all([getIntakeFormSchema(), loadDealAnswers()]);
  const isEditing = Object.keys(initialAnswers).length > 0;
  return (
    <>
      <Header active="intake" />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">
          {isEditing ? "Edit Deal — Intake" : "New Deal — Intake"}
        </h1>
        <p className="mt-1 text-[var(--color-text-muted)]">
          {isEditing
            ? "Editing the current deal's saved answers — changes here won't take effect until you continue to review."
            : "Fill this out once — it flows into every form you generate for this deal."}
        </p>
        <div className="mt-8">
          <IntakeForm schema={schema} initialAnswers={initialAnswers} />
        </div>
      </main>
    </>
  );
}

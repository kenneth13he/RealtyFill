// app/review/page.tsx
// Review + form-selection screen (mvp-build-plan.md Phase 1 Step 6 / Phase 2
// Step 13). Server component: reads the saved intake answers from
// data/deal.json directly (Phase 1 local storage — Phase 2 swaps this for a
// `deal_intake` DB read scoped to the logged-in realtor) and hands them to
// the client-side ReviewForm, which owns form-selection + generation.

import fs from "fs/promises";
import path from "path";
import Header from "@/components/Header";
import { getIntakeFormSchema } from "@/lib/schemas";
import ReviewForm from "./ReviewForm";

async function loadDealAnswers(): Promise<Record<string, string>> {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), "data", "deal.json"), "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export default async function ReviewPage() {
  const [answers, schema] = await Promise.all([loadDealAnswers(), getIntakeFormSchema()]);
  return (
    <>
      <Header active="review" />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">Review & Generate</h1>
        <p className="mt-1 text-[var(--color-text-muted)]">
          Double-check what you entered, pick which forms to generate, then download the filled PDFs.
        </p>
        <div className="mt-8">
          <ReviewForm answers={answers} schema={schema} />
        </div>
      </main>
    </>
  );
}

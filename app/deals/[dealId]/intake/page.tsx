// app/deals/[dealId]/intake/page.tsx
// The Deal Intake Form for one deal. Phase 2 replacement for app/intake/page.tsx:
// reads deal_intake.answers from Postgres (RLS-scoped to the signed-in user)
// instead of the old single data/deal.json. proxy.ts already blocks a
// logged-out visitor from reaching this route at all; notFound() here
// additionally covers a logged-in user hitting a dealId that isn't theirs
// (RLS makes the row simply not appear, same as truly not existing) or that
// truly doesn't exist.

import { notFound } from "next/navigation";
import { getIntakeFormSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";
import Header from "@/components/Header";
import IntakeForm from "./IntakeForm";

export default async function IntakePage({ params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  const supabase = await createClient();

  const [{ data: deal }, { data: intakeRow }, schema] = await Promise.all([
    supabase.from("deals").select("id, label").eq("id", dealId).maybeSingle(),
    supabase.from("deal_intake").select("answers").eq("deal_id", dealId).maybeSingle(),
    getIntakeFormSchema(),
  ]);

  if (!deal) {
    notFound();
  }

  const initialAnswers = (intakeRow?.answers as Record<string, string>) ?? {};
  const isEditing = Object.keys(initialAnswers).length > 0;

  return (
    <>
      <Header active="intake" dealId={dealId} />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">{deal.label}</h1>
        <p className="mt-1 text-[var(--color-text-muted)]">
          {isEditing
            ? "Editing this deal's saved answers — changes here won't take effect until you continue to review."
            : "Fill this out once — it flows into every form you generate for this deal."}
        </p>
        <div className="mt-8">
          <IntakeForm dealId={dealId} schema={schema} initialAnswers={initialAnswers} />
        </div>
      </main>
    </>
  );
}

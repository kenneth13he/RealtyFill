// app/review/ReviewForm.tsx
// Client-side review + form-selection + generate UI. Shows the saved intake
// answers read-only, grouped and labeled the same way the intake form was
// (via the schema, not raw keys — was a known gap, fixed here), with a link
// back to /intake to correct anything — no silent in-place editing. Lets the
// realtor check which of the five forms to generate, and on submit calls
// /api/generate, then lists download links for whatever came back.

"use client";

import { useState } from "react";
import Link from "next/link";
import { ALL_FORM_IDS, FORM_LABELS, FormId, IntakeFormSchema } from "@/lib/formTypes";

export default function ReviewForm({
  answers,
  schema,
}: {
  answers: Record<string, string>;
  schema: IntakeFormSchema;
}) {
  const [selected, setSelected] = useState<Set<FormId>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{ form: FormId; downloadUrl: string }[]>([]);

  function toggle(formId: FormId) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(formId)) next.delete(formId);
      else next.add(formId);
      return next;
    });
  }

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setResults([]);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedForms: Array.from(selected) }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to generate");
      setResults(body.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  }

  const groupsWithAnswers = schema.groups
    .map((group) => ({
      ...group,
      fields: group.fields.filter((field) => {
        const value = answers[field.key];
        return value !== undefined && value !== "" && value !== "/Off";
      }),
    }))
    .filter((group) => group.fields.length > 0);

  const hasAnswers = groupsWithAnswers.length > 0;

  return (
    <div className="flex flex-col gap-6 pb-16">
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--color-text)]">Answers on file</h2>
          <Link href="/intake" className="text-sm font-medium text-[var(--color-accent)] hover:underline">
            Edit answers
          </Link>
        </div>

        {!hasAnswers ? (
          <p className="mt-3 text-sm text-[var(--color-text-muted)]">
            No intake data yet —{" "}
            <Link href="/intake" className="font-medium text-[var(--color-accent)] hover:underline">
              fill out the intake form first
            </Link>
            .
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-5">
            {groupsWithAnswers.map((group) => (
              <div key={group.group}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                  {group.label}
                </h3>
                <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                  {group.fields.map((field) => {
                    const rawValue = answers[field.key];
                    const displayValue =
                      field.type === "radio"
                        ? field.options?.find((o) => o.value === rawValue)?.label ?? rawValue
                        : field.type === "checkbox"
                          ? rawValue === "/1"
                            ? "Yes"
                            : "No"
                          : rawValue;
                    return (
                      <div key={field.key} className="flex justify-between gap-3 border-b border-[var(--color-border)]/60 py-1.5 text-sm">
                        <dt className="text-[var(--color-text-muted)]">{field.label}</dt>
                        <dd className="text-right font-medium text-[var(--color-text)]">{displayValue}</dd>
                      </div>
                    );
                  })}
                </dl>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h2 className="text-base font-semibold text-[var(--color-text)]">Select forms to generate</h2>
        <div className="mt-3 flex flex-col gap-2">
          {ALL_FORM_IDS.map((formId) => (
            <label
              key={formId}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--color-border)] px-3 py-2.5 text-sm transition-colors has-[:checked]:border-[var(--color-accent)] has-[:checked]:bg-[var(--color-accent)]/5"
            >
              <input
                type="checkbox"
                checked={selected.has(formId)}
                onChange={() => toggle(formId)}
                className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
              />
              <span className="font-medium text-[var(--color-text)]">{FORM_LABELS[formId]}</span>
            </label>
          ))}
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating || selected.size === 0 || !hasAnswers}
          className="mt-4 w-full rounded-lg bg-[var(--color-accent)] px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
        >
          {generating ? "Generating…" : "Generate selected forms"}
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-md border border-[var(--color-error-border)] bg-[var(--color-error-bg)] px-3 py-2 text-sm text-[var(--color-error-text)]">
          {error}
        </p>
      )}

      {results.length > 0 && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-5">
          <h2 className="text-base font-semibold text-green-900">Generated PDFs</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {results.map((r) => (
              <li key={r.form}>
                <a
                  href={r.downloadUrl}
                  className="flex items-center gap-2 rounded-lg border border-green-200 bg-white px-3 py-2.5 text-sm font-medium text-green-900 transition-colors hover:border-green-400"
                >
                  <span aria-hidden>↓</span>
                  {FORM_LABELS[r.form]}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

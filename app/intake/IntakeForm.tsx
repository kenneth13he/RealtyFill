// app/intake/IntakeForm.tsx
// Client-side renderer for the Deal Intake Form. Takes the parsed
// intake_form_schema.json (via props, loaded server-side by page.tsx) and
// renders one section per group, one input per field, respecting each
// field's `type`, `options` (radio/checkbox value codes — never the human
// label), and simple `condition` strings (e.g. only show key deposit amount
// if key_deposit_required == '/2').
//
// Fields with `derived_from` (currently just monthly_rent_words) are
// computed automatically from their source field rather than typed — see
// the effect below and lib/numberToWords.ts.
//
// On submit, POSTs the full answer map to /api/intake, then navigates to
// /review — the human-reviews-before-anything-is-generated step.

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { IntakeField, IntakeFormSchema } from "@/lib/formTypes";
import { numberToWords } from "@/lib/numberToWords";

function fieldIsVisible(condition: string | undefined, answers: Record<string, string>): boolean {
  if (!condition) return true;
  const match = condition.match(/^(\w+)\s*==\s*'([^']*)'$/);
  if (!match) return true;
  const [, key, expected] = match;
  return answers[key] === expected;
}

const inputClasses =
  "w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text)] shadow-sm outline-none transition-colors focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20";

function Field({
  field,
  value,
  flagReason,
  onChange,
}: {
  field: IntakeField;
  value: string;
  flagReason?: string;
  onChange: (value: string) => void;
}) {
  const isDerived = Boolean(field.derived_from);
  return (
    <div className={field.type === "long_text" ? "sm:col-span-2" : undefined}>
      <label htmlFor={field.key} className="mb-1 block text-sm font-medium text-[var(--color-text)]">
        {field.label}
      </label>
      {flagReason && (
        <p className="mb-1 text-xs italic text-[var(--color-text-muted)]">
          Not filled from listing — {flagReason}
        </p>
      )}
      {field.type === "radio" ? (
        <select id={field.key} value={value} onChange={(e) => onChange(e.target.value)} className={inputClasses}>
          <option value="" disabled>
            Select…
          </option>
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : field.type === "checkbox" ? (
        <input
          id={field.key}
          type="checkbox"
          checked={value === "/1"}
          onChange={(e) => onChange(e.target.checked ? "/1" : "/Off")}
          className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
        />
      ) : field.type === "long_text" ? (
        <textarea
          id={field.key}
          value={value || field.default || ""}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className={inputClasses}
        />
      ) : (
        <input
          id={field.key}
          type={field.type === "date" ? "date" : field.type === "number" || field.type === "currency" ? "number" : "text"}
          value={value || field.default || ""}
          onChange={(e) => onChange(e.target.value)}
          readOnly={isDerived}
          className={inputClasses + (isDerived ? " bg-[var(--color-bg)] text-[var(--color-text-muted)]" : "")}
        />
      )}
    </div>
  );
}

export default function IntakeForm({ schema }: { schema: IntakeFormSchema }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listingText, setListingText] = useState("");
  const [listingFile, setListingFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [flaggedFields, setFlaggedFields] = useState<Record<string, string>>({});

  // monthly_rent_words is derived from monthly_rent_amount (lib/numberToWords.ts)
  // rather than typed — matches the real Form 400 convention ("$3,900.00" ->
  // "Three Thousand Nine Hundred"), verified against the real ground-truth form.
  useEffect(() => {
    const words = numberToWords(answers.monthly_rent_amount ?? "");
    setAnswers((prev) => (prev.monthly_rent_words === words ? prev : { ...prev, monthly_rent_words: words }));
  }, [answers.monthly_rent_amount]);

  function setField(key: string, value: string) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    // Editing a field by hand means the realtor has provided it — clear any unresolved flag.
    setFlaggedFields((prev) => {
      if (!(key in prev)) return prev;
      const { [key]: _removed, ...rest } = prev;
      return rest;
    });
  }

  async function runExtraction(request: () => Promise<Response>) {
    setExtracting(true);
    setExtractError(null);
    try {
      const res = await request();
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Extraction failed");
      setAnswers((prev) => ({ ...prev, ...body.answers }));
      if (body.flagged && typeof body.flagged === "object") {
        setFlaggedFields((prev) => ({ ...prev, ...body.flagged }));
      }
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : "Extraction failed");
    } finally {
      setExtracting(false);
    }
  }

  async function handleExtractListingText() {
    if (!listingText.trim()) return;
    await runExtraction(() =>
      fetch("/api/extract-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: listingText }),
      })
    );
  }

  async function handleExtractListingFile() {
    if (!listingFile) return;
    const formData = new FormData();
    formData.append("file", listingFile);
    await runExtraction(() => fetch("/api/extract-listing", { method: "POST", body: formData }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answers),
      });
      if (!res.ok) throw new Error("Failed to save intake answers");
      router.push("/review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 pb-24">
      <div className="rounded-xl border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/5 p-5">
        <h2 className="text-base font-semibold text-[var(--color-text)]">Pre-fill from a listing export (optional)</h2>
        <p className="mt-1.5 text-sm text-[var(--color-text-muted)]">
          Upload or paste a listing export to pre-fill this form. Where the listing is genuinely ambiguous about
          something (e.g. whether a utility is included in rent, not just present in the unit), the field is left
          blank with a note instead of guessing.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-[var(--color-border)] bg-white p-4">
            <label htmlFor="listing-file" className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">
              Upload listing PDF
            </label>
            <input
              id="listing-file"
              type="file"
              accept="application/pdf"
              onChange={(e) => setListingFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-[var(--color-text-muted)] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--color-accent)]/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[var(--color-accent)] hover:file:bg-[var(--color-accent)]/20"
            />
            <button
              type="button"
              onClick={handleExtractListingFile}
              disabled={extracting || !listingFile}
              className="mt-3 w-full rounded-md bg-[var(--color-accent)] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {extracting ? "Extracting…" : "Extract from PDF"}
            </button>
          </div>

          <div className="rounded-lg border border-[var(--color-border)] bg-white p-4">
            <label htmlFor="listing-text" className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">
              Paste listing text
            </label>
            <textarea
              id="listing-text"
              value={listingText}
              onChange={(e) => setListingText(e.target.value)}
              rows={3}
              placeholder="Paste listing text here…"
              className={inputClasses}
            />
            <button
              type="button"
              onClick={handleExtractListingText}
              disabled={extracting || !listingText.trim()}
              className="mt-3 w-full rounded-md bg-[var(--color-accent)] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {extracting ? "Extracting…" : "Extract from pasted text"}
            </button>
          </div>
        </div>

        {extractError && (
          <p role="alert" className="mt-3 rounded-md border border-[var(--color-error-border)] bg-[var(--color-error-bg)] px-3 py-2 text-sm text-[var(--color-error-text)]">
            {extractError}
          </p>
        )}
      </div>

      {schema.groups.map((group) => {
        const visibleFields = group.fields.filter((field) => fieldIsVisible(field.condition, answers));
        if (visibleFields.length === 0) return null;
        return (
          <div key={group.group} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <h2 className="text-base font-semibold text-[var(--color-text)]">{group.label}</h2>
            {group.note && <p className="mt-1 text-sm text-[var(--color-text-muted)]">{group.note}</p>}
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {visibleFields.map((field) => (
                <Field
                  key={field.key}
                  field={field}
                  value={answers[field.key] ?? ""}
                  flagReason={flaggedFields[field.key]}
                  onChange={(value) => setField(field.key, value)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {error && (
        <p role="alert" className="rounded-md border border-[var(--color-error-border)] bg-[var(--color-error-bg)] px-3 py-2 text-sm text-[var(--color-error-text)]">
          {error}
        </p>
      )}

      <div className="sticky bottom-0 -mx-6 border-t border-[var(--color-border)] bg-[var(--color-bg)]/95 px-6 py-4 backdrop-blur">
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-[var(--color-accent)] px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
        >
          {saving ? "Saving…" : "Continue to review →"}
        </button>
      </div>
    </form>
  );
}

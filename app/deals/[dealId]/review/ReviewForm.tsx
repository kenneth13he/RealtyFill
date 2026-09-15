// app/deals/[dealId]/review/ReviewForm.tsx
// Client-side review + form-selection + generate UI for one deal. Phase 2:
// reads/writes /api/deals/[dealId]/intake and /api/deals/[dealId]/generate
// instead of the old Phase 1 singleton /api/intake and /api/generate.
//
// `initialResults`/`initialSelected` let the page show forms that were
// already generated on a previous visit — Phase 1 never needed this since
// output was ephemeral and scoped to one demo deal, but now that a deal's
// generated PDFs actually persist in Storage, revisiting it should show what
// was already made rather than looking freshly empty every time.

"use client";

import { useEffect, useRef, useState } from "react";
import { FORM_LABELS, FormId, IntakeFormSchema } from "@/lib/formTypes";
import { useDerivedIntakeAnswers } from "@/lib/useDerivedIntakeAnswers";
import IntakeFieldsEditor from "@/components/IntakeFieldsEditor";

export default function ReviewForm({
  dealId,
  answers: initialAnswers,
  schema,
  initialResults = [],
  formIds,
}: {
  dealId: string;
  answers: Record<string, string>;
  schema: IntakeFormSchema;
  initialResults?: { form: FormId; downloadUrl: string }[];
  /** The forms in this deal's set — not every form the app knows about. */
  formIds: FormId[];
}) {
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [editing, setEditing] = useState(false);
  const [autosaving, setAutosaving] = useState(false);
  const [selected, setSelected] = useState<Set<FormId>>(new Set(initialResults.map((r) => r.form)));
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{ form: FormId; downloadUrl: string }[]>(initialResults);
  const [hasGenerated, setHasGenerated] = useState(initialResults.length > 0);
  const [previewing, setPreviewing] = useState<FormId | null>(null);
  const [updateText, setUpdateText] = useState("");
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateFlagged, setUpdateFlagged] = useState<Record<string, string>>({});
  const [changedKeys, setChangedKeys] = useState<Set<string>>(new Set());

  useDerivedIntakeAnswers(answers, setAnswers);

  // Mirrors `answers` for the debounced autosave below, so the save always
  // sends the latest values even though the setTimeout callback closes over
  // whatever `answers` looked like when it was scheduled.
  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const selectedRef = useRef(selected);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      const res = await fetch(`/api/deals/${dealId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedForms: Array.from(selectedRef.current) }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to generate");
      setResults(body.results);
      setHasGenerated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  }

  function setField(key: string, value: string) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    // Deliberately not marked in `changedKeys` — that drives the "Updated"
    // badge/highlight, which exists to surface what the AI changed on your
    // behalf via "Update with more info". A field you just typed into
    // yourself needs no such flag — you already know you changed it.
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      void autosaveAndMaybeRegenerate();
    }, 800);
  }

  async function autosaveAndMaybeRegenerate() {
    setAutosaving(true);
    try {
      const res = await fetch(`/api/deals/${dealId}/intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answersRef.current),
      });
      if (!res.ok) throw new Error("Failed to save changes");
      if (hasGenerated && selectedRef.current.size > 0) {
        await handleGenerate();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setAutosaving(false);
    }
  }

  async function handleUpdateAndRegenerate() {
    if (!updateText.trim()) return;
    setUpdating(true);
    setUpdateError(null);
    try {
      const extractRes = await fetch(`/api/extract-listing?dealId=${dealId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: updateText, currentAnswers: answers }),
      });
      const extractBody = await extractRes.json();
      if (!extractRes.ok) throw new Error(extractBody.error ?? "Failed to read that update");

      const mergedAnswers = { ...answers, ...extractBody.answers };
      setAnswers(mergedAnswers);
      setUpdateFlagged(extractBody.flagged ?? {});
      setChangedKeys((prev) => new Set([...prev, ...Object.keys(extractBody.answers ?? {})]));

      const saveRes = await fetch(`/api/deals/${dealId}/intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mergedAnswers),
      });
      if (!saveRes.ok) throw new Error("Failed to save updated answers");

      setUpdateText("");
      // Only regenerate if there's actually something to regenerate. This
      // box is available before the first generate too (paste the listing
      // details in, then generate once), and calling generate with nothing
      // selected would fail with "selectedForms must include at least one
      // form" — an error about a step the user hasn't taken yet.
      if (hasGenerated && selectedRef.current.size > 0) {
        await handleGenerate();
      }
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setUpdating(false);
    }
  }

  const groupsWithAnswers = schema.groups
    .map((group) => ({
      ...group,
      fields: group.fields.filter((field) => {
        if (field.hidden) return false;
        const value = answers[field.key];
        return value !== undefined && value !== "" && value !== "/Off";
      }),
    }))
    .filter((group) => group.fields.length > 0);

  const hasAnswers = groupsWithAnswers.length > 0;

  // (An empty-field warning used to live here. Removed: "(optional)" in the
  // label is too crude a proxy for "required" — it counted ~37 fields on a
  // realistic deal, most of them things a realtor legitimately wouldn't have
  // or need, which made it noise rather than a signal. The per-field red
  // asterisks in the editor already cover this at the point of entry.)

  const affectedForms = new Set<FormId>();
  if (changedKeys.size > 0) {
    for (const group of schema.groups) {
      for (const field of group.fields) {
        if (!changedKeys.has(field.key)) continue;
        for (const formId of Object.keys(field.targets) as FormId[]) affectedForms.add(formId);
      }
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-16">
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--color-text)]">Answers on file</h2>
          <div className="flex items-center gap-3">
            {editing && autosaving && <span className="text-xs text-[var(--color-text-muted)]">Saving…</span>}
            <button
              type="button"
              onClick={() => setEditing((prev) => !prev)}
              className="text-sm font-medium text-[var(--color-accent)] hover:underline"
            >
              {editing ? "Done editing" : "Edit answers"}
            </button>
          </div>
        </div>

        {editing ? (
          <div className="mt-4">
            <IntakeFieldsEditor schema={schema} answers={answers} onChange={setField} />
          </div>
        ) : !hasAnswers ? (
          <p className="mt-3 text-sm text-[var(--color-text-muted)]">
            No intake data yet —{" "}
            <button type="button" onClick={() => setEditing(true)} className="font-medium text-[var(--color-accent)] hover:underline">
              fill in the answers
            </button>
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
                    const wasChanged = changedKeys.has(field.key);
                    return (
                      <div
                        key={field.key}
                        className={
                          "flex justify-between gap-3 border-b py-1.5 text-sm" +
                          (wasChanged
                            ? " -mx-2 rounded-md border-transparent bg-amber-50 px-2 ring-1 ring-inset ring-amber-300"
                            : " border-[var(--color-border)]/60")
                        }
                      >
                        <dt className="text-[var(--color-text-muted)]">
                          {field.label}
                          {wasChanged && (
                            <span className="ml-1.5 rounded-full bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
                              Updated
                            </span>
                          )}
                        </dt>
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
          {formIds.map((formId) => (
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

      {/* Shown before the first generate too, not just after — pasting the
          details in is often the first thing you'd want to do on a new deal,
          and hiding this until after a generate made that non-obvious. */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h2 className="text-base font-semibold text-[var(--color-text)]">Update with more info</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Paste any new or corrected details (an email, a note, an updated listing) and matching fields are filled
            in for you.
            {hasGenerated ? " The forms you've generated are then updated automatically." : ""}
          </p>
          <textarea
            value={updateText}
            onChange={(e) => setUpdateText(e.target.value)}
            rows={3}
            placeholder="Paste additional or corrected info here…"
            className="mt-3 w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text)] shadow-sm outline-none transition-colors focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20"
          />
          <button
            type="button"
            onClick={handleUpdateAndRegenerate}
            disabled={updating || generating || !updateText.trim()}
            className="mt-3 w-full rounded-lg bg-[var(--color-accent)] px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
          >
            {updating ? "Updating…" : hasGenerated ? "Update & regenerate forms" : "Add this info"}
          </button>
          {updateError && (
            <p role="alert" className="mt-3 rounded-md border border-[var(--color-error-border)] bg-[var(--color-error-bg)] px-3 py-2 text-sm text-[var(--color-error-text)]">
              {updateError}
            </p>
          )}
          {Object.keys(updateFlagged).length > 0 && (
            <p className="mt-3 text-xs italic text-[var(--color-text-muted)]">
              Left unchanged (ambiguous): {Object.entries(updateFlagged).map(([key, reason]) => `${key} (${reason})`).join("; ")}
            </p>
          )}
      </div>

      {results.length > 0 && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-5">
          <h2 className="text-base font-semibold text-green-900">Generated PDFs</h2>
          <p className="mt-1 text-sm text-green-800">
            Click a form to preview it. You can edit fields directly in the viewer below — use its own toolbar
            (not a button here) to save, since that&apos;s what actually captures your edits.
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {results.map((r) => {
              const isOpen = previewing === r.form;
              return (
                <li key={r.form} className="rounded-lg border border-green-200 bg-white">
                  <button
                    type="button"
                    onClick={() => setPreviewing((prev) => (prev === r.form ? null : r.form))}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium text-green-900">
                      {FORM_LABELS[r.form]}
                      {affectedForms.has(r.form) && (
                        <span className="rounded-full bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
                          Updated
                        </span>
                      )}
                    </span>
                    <span aria-hidden className="text-green-700">
                      {isOpen ? "▲" : "▼"}
                    </span>
                  </button>
                  {isOpen && (
                    <iframe
                      title={`Preview of ${FORM_LABELS[r.form]}`}
                      src={`${r.downloadUrl}?inline=1`}
                      className="h-[80vh] w-full border-t border-green-200"
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

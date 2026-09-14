// components/IntakeFieldsEditor.tsx
// The grouped intake-field renderer — one section per schema group, one
// input per visible field — shared by app/intake/IntakeForm.tsx (the
// full "New/Edit Deal" page) and app/review/ReviewForm.tsx's inline editor,
// so both present/edit fields identically instead of drifting apart.

"use client";

import type { IntakeField, IntakeFormSchema } from "@/lib/formTypes";

export function fieldIsVisible(condition: string | undefined, answers: Record<string, string>): boolean {
  if (!condition) return true;
  const match = condition.match(/^(\w+)\s*==\s*'([^']*)'$/);
  if (!match) return true;
  const [, key, expected] = match;
  return answers[key] === expected;
}

export const intakeInputClasses =
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
  // Labels already mark genuinely optional fields with "(optional)" (e.g.
  // "Tenant 2 — First Name (optional)") — anything else that's still empty
  // is flagged so it's obvious what's missing before generating forms.
  const isOptional = field.label.toLowerCase().includes("(optional)");
  const isMissing = !isOptional && field.type !== "checkbox" && !isDerived && !value;
  const missingInputClasses = isMissing ? " border-red-300 focus:border-red-400 focus:ring-red-400/20" : "";
  return (
    <div className={field.type === "long_text" ? "sm:col-span-2" : undefined}>
      <label htmlFor={field.key} className="mb-1 flex items-center gap-1 text-sm font-medium text-[var(--color-text)]">
        <span>{field.label}</span>
        {isMissing && (
          <span className="text-red-500" title="Missing — needed for the forms that use it">
            *
          </span>
        )}
      </label>
      {flagReason && (
        <p className="mb-1 text-xs italic text-[var(--color-text-muted)]">
          Not filled from listing — {flagReason}
        </p>
      )}
      {field.type === "radio" ? (
        <select
          id={field.key}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={intakeInputClasses + missingInputClasses}
        >
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
          className={intakeInputClasses + missingInputClasses}
        />
      ) : (
        <input
          id={field.key}
          type={field.type === "date" ? "date" : field.type === "number" || field.type === "currency" ? "number" : "text"}
          value={value || field.default || ""}
          onChange={(e) => onChange(e.target.value)}
          readOnly={isDerived}
          className={
            intakeInputClasses + (isDerived ? " bg-[var(--color-bg)] text-[var(--color-text-muted)]" : missingInputClasses)
          }
        />
      )}
    </div>
  );
}

export default function IntakeFieldsEditor({
  schema,
  answers,
  flaggedFields,
  onChange,
}: {
  schema: IntakeFormSchema;
  answers: Record<string, string>;
  flaggedFields?: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      {schema.groups.map((group) => {
        const visibleFields = group.fields.filter((field) => !field.hidden && fieldIsVisible(field.condition, answers));
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
                  flagReason={flaggedFields?.[field.key]}
                  onChange={(value) => onChange(field.key, value)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

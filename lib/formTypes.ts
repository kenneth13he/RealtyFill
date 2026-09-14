// lib/formTypes.ts
// Client-safe types and constants shared by both server code (lib/schemas.ts,
// which reads forms/schemas/*.json off disk) and client components (like
// app/review/ReviewForm.tsx) that only need the shapes/labels, not file I/O.
// Kept separate from lib/schemas.ts specifically so importing this file never
// pulls Node's `fs` into a client bundle.

export type FormId = "2229e" | "form_400" | "form_410" | "form_324" | "form_372";

export interface IntakeFieldOption {
  value: string;
  label: string;
}

export interface IntakeField {
  key: string;
  label: string;
  type: "text" | "long_text" | "currency" | "date" | "number" | "radio" | "checkbox";
  options?: IntakeFieldOption[];
  targets: Partial<Record<FormId, string[]>>;
  profile?: string;
  condition?: string;
  default?: string;
  derived_from?: string;
  form_specific?: FormId;
  note?: string;
}

export interface IntakeGroup {
  group: string;
  label: string;
  note?: string;
  form_specific?: FormId;
  fields: IntakeField[];
}

export interface IntakeFormSchema {
  groups: IntakeGroup[];
}

export interface RawFieldInfo {
  field_id: string;
  type: "text" | "checkbox" | "radio_group" | "choice";
  page: number;
  rect?: number[];
  checked_value?: string;
  unchecked_value?: string;
  radio_options?: { value: string; rect: number[] }[];
  choice_options?: { value: string; text: string }[];
}

export const FORM_LABELS: Record<FormId, string> = {
  "2229e": "2229E — Residential Tenancy Agreement (Standard Lease)",
  form_400: "Form 400 — Agreement to Lease (Residential)",
  form_410: "Form 410 — Rental Application (Residential)",
  form_324: "Form 324 — Confirmation of Co-operation and Representation",
  form_372: "Form 372 — Tenant Designated Representation Agreement",
};

export const ALL_FORM_IDS: FormId[] = ["2229e", "form_400", "form_410", "form_324", "form_372"];

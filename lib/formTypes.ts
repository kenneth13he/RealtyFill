// lib/formTypes.ts
// Client-safe types and constants shared by both server code (lib/schemas.ts,
// which reads forms/schemas/*.json off disk) and client components (like
// app/review/ReviewForm.tsx) that only need the shapes/labels, not file I/O.
// Kept separate from lib/schemas.ts specifically so importing this file never
// pulls Node's `fs` into a client bundle.

// Every form the app knows about, across all four sets. Only the lease-tenant
// five are generatable today — see FORM_SETS below for why the rest aren't.
export type FormId =
  // Lease — tenant side (the original set)
  | "2229e"
  | "form_400"
  | "form_410"
  | "form_324"
  | "form_372"
  // Lease — landlord / listing side
  | "form_272"
  | "form_292"
  | "form_401"
  // Purchase — buyer side
  | "form_101"
  | "form_303"
  | "form_320"
  | "form_371"
  | "form_801"
  // Sale — seller / listing side
  | "form_203"
  | "form_244"
  | "form_271"
  | "form_291";

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
  /** Form sets this field applies to. Absent means every set. */
  sets?: FormSetId[];
  note?: string;
  // Computed automatically (see lib/splitFullName.ts) and never rendered as
  // its own input — exists purely so its `targets` still get filled (e.g.
  // 2229E's separate first/last name boxes) from a single Full Name field.
  hidden?: boolean;
}

export interface IntakeGroup {
  group: string;
  label: string;
  note?: string;
  form_specific?: FormId;
  /** Form sets this group applies to. Absent means every set. */
  sets?: FormSetId[];
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

  form_272: "Form 272 — Listing Agreement, Landlord Designated Representation",
  form_292: "Form 292 — MLS® Data Information Form (Condo, Lease/Sub-Lease)",
  form_401: "Form 401 — Schedule to Agreement to Lease (Residential)",

  form_101: "Form 101 — Agreement of Purchase and Sale (Condominium Resale)",
  form_303: "Form 303 — Schedule to Buyer Representation Agreement",
  form_320: "Form 320 — Confirmation of Co-operation and Representation (Buyer/Seller)",
  form_371: "Form 371 — Buyer Designated Representation Agreement",
  form_801: "Form 801 — Offer Summary Document",

  form_203: "Form 203 — Schedule to Listing Agreement (Authority to Offer for Sale)",
  form_244: "Form 244 — Seller's Direction re: Property/Offers",
  form_271: "Form 271 — Listing Agreement, Seller Designated Representation",
  form_291: "Form 291 — MLS® Data Information Form (Condo, Sale)",
};

// PropTx's MLS data forms (291 sale / 292 lease) are deliberately absent from
// the sets above. They are 13-page data-entry sheets — hundreds of checkboxes
// with max-select rules and a 99-row room table — whose content barely
// overlaps the intake schema, and a realtor enters that data in PropTx
// directly. Their blanks stay in forms/blank_templates/ if that changes.

// ---------------------------------------------------------------------------
// Form sets
//
// A deal is for exactly one kind of transaction, and each kind needs its own
// bundle of forms. Which set a deal belongs to is stored on the deal itself
// (deals.form_set) and fixed at creation — the forms, and eventually the
// intake questions, differ enough between them that switching mid-deal would
// mean discarding answers.
//
// `ready: false` means the set is registered but cannot generate anything yet.
// The blank templates for the three pending sets are in the repo but were
// downloaded as flat PDFs with zero AcroForm fields, so there is nothing for
// the fill pipeline to write into (it fills *named fields*; it can't type onto
// a page). Each set's folder README explains this. Making one ready takes:
//   1. fillable templates re-sourced from WEBForms / the OREA member portal,
//   2. `scripts/extract_form_field_info.py` run over them into forms/schemas/,
//   3. intake-schema `targets` added for the new field ids,
//   4. `ready: true` here.
// ---------------------------------------------------------------------------

export type FormSetId = "lease_tenant" | "lease_landlord" | "sale_buyer" | "sale_seller";

export interface FormSet {
  id: FormSetId;
  label: string;
  description: string;
  /** Subdirectory of forms/blank_templates/ holding this set's blanks. "" = the root (legacy location). */
  templateDir: string;
  formIds: FormId[];
  ready: boolean;
}

export const FORM_SETS: Record<FormSetId, FormSet> = {
  lease_tenant: {
    id: "lease_tenant",
    label: "Condo for lease — tenant side",
    description: "You represent the tenant. Lease agreement, rental application, and co-operation forms.",
    templateDir: "",
    formIds: ["2229e", "form_400", "form_410", "form_324", "form_372"],
    ready: true,
  },
  lease_landlord: {
    id: "lease_landlord",
    label: "Condo for lease — landlord side",
    description: "You represent the landlord. Listing agreement and lease schedule.",
    templateDir: "lease_landlord_condo",
    formIds: ["form_272", "form_401"],
    ready: true,
  },
  sale_buyer: {
    id: "sale_buyer",
    label: "Condo for sale — buyer side",
    description: "You represent the buyer. Agreement of purchase and sale, buyer representation, and offer summary.",
    templateDir: "purchase_buyer_condo",
    formIds: ["form_101", "form_303", "form_320", "form_371", "form_801"],
    ready: true,
  },
  sale_seller: {
    id: "sale_seller",
    label: "Condo for sale — seller side",
    description: "You represent the seller. Listing agreement, seller's direction, and schedule.",
    templateDir: "sale_seller_condo",
    formIds: ["form_203", "form_244", "form_271"],
    ready: true,
  },
};

export const FORM_SET_IDS = Object.keys(FORM_SETS) as FormSetId[];

/** The set every pre-existing deal belongs to — matches the 0002 migration's column default. */
export const DEFAULT_FORM_SET: FormSetId = "lease_tenant";

export function isFormSetId(value: unknown): value is FormSetId {
  return typeof value === "string" && value in FORM_SETS;
}

/** Normalises whatever came back from the database into a set id we can trust. */
export function toFormSetId(value: unknown): FormSetId {
  return isFormSetId(value) ? value : DEFAULT_FORM_SET;
}

export function formIdsForSet(setId: FormSetId): FormId[] {
  return FORM_SETS[setId].formIds;
}

export const ALL_FORM_IDS: FormId[] = FORM_SET_IDS.flatMap((setId) => FORM_SETS[setId].formIds);

/**
 * Narrow the intake schema to the questions one form set actually needs.
 *
 * The schema covers all four sets, so without this a purchase deal would ask
 * for rent, utilities and tenant insurance. Groups and fields with no `sets`
 * key apply everywhere (property address, brokerage), which keeps the common
 * ones from having to list every set.
 */
export function filterSchemaForSet(schema: IntakeFormSchema, setId: FormSetId): IntakeFormSchema {
  const applies = (sets?: FormSetId[]) => !sets || sets.includes(setId);
  return {
    groups: schema.groups
      .filter((g) => applies(g.sets))
      .map((g) => ({ ...g, fields: g.fields.filter((f) => applies(f.sets)) }))
      .filter((g) => g.fields.length > 0),
  };
}

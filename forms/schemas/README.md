# forms/schemas — what's here and what's left

## Files

| File | What it is | Status |
|---|---|---|
| `2229e_raw.json` | Raw field dump for the **2229E Residential Tenancy Agreement** (Standard Lease) — 93 fields, field_id/type/page/position only, no semantics. | Structure done. |
| `form_400_raw.json` | Raw field dump for **Form 400 — Agreement to Lease (Residential)** — 88 fields. | Structure done. |
| `form_410_raw.json` | Raw field dump for **Form 410 — Rental Application (Residential)** — 121 fields. | Structure done. |
| `form_324_raw.json` | Raw field dump for **Form 324 — Confirmation of Co-operation and Representation (Tenant/Landlord)** — 48 fields. | Structure done. |
| `form_372_raw.json` | Raw field dump for **Form 372 — Tenant Designated Representation Agreement** — 42 fields (incl. Schedule A). | Structure done. |
| `deal_profile_schema.json` | The **shared Property Profile** — fields that repeat across 2+ of the five forms (tenant/landlord names, property address, rent, term, brokerage info), each mapped to its `field_id` per form. Enter these once, reuse everywhere. | Done for the fields identified so far. |
| `intake_form_schema.json` | The **Deal Intake Form** the realtor actually fills out — every field grouped into UI sections (Parties, Property, Rent & Deposits, Term & Conditions, Utilities, Brokerage, plus form-specific sections for 324/372/410), each with a label, input type, radio/checkbox value codes, and which form field_id(s) it writes to. **This is the contract the frontend (renders the form) and backend (maps answers → PDF fields) both build against.** | First draft done — covers the fields with known real-world semantics (see below). Needs a pass to fill gaps. |

## How the raw schemas relate to the intake schema

`*_raw.json` = "every field this PDF has, and where it sits on the page" (from `pypdf`, no meaning attached).
`intake_form_schema.json` = "what a human actually needs to type, and which raw field(s) that answer goes into" — built by cross-referencing the raw field IDs against real filled copies of these forms (field names like `txtbuyer1`, `txtseller1`, `chkOpt_Condo` turned out to be self-describing once matched against known filled values).

## What's NOT yet in `intake_form_schema.json` (still needs to be filled out)

- **Form 410's full field set isn't fully itemized.** Only the fields with no other source (DOB, driver's license, occupation, present address/landlord) are listed individually. The raw file has 121 fields total — prior employment, financial obligations, personal references, automobile info, and Applicant #2's full mirror set are **not yet broken into intake fields**. Needs a pass through `form_410_raw.json` to decide which of these the demo actually needs to collect vs. leave blank.
- **Form 400's signature/witness/acknowledgement block** (witnesses, spousal consent, lawyer info, "for office use only" commission trust section) is intentionally left out — these are signing-time fields, not pre-fill data, consistent with "never auto-fill signatures."
- **Form 324's second representation scenario blocks** (`LANDLORD BROKERAGE (Multiple Representation)` options b, and `PROPERTY LEASED BY TENANT BROKERAGE` a/b) exist in the raw schema but aren't yet in the intake form — only the scenario that applied to the one real deal we have ground truth for is mapped. Needs generalizing once we see a second real Form 324 example with different checkboxes selected.
- **Radio-group value semantics for Form 400's utility checkboxes** (`chkOpt_cable_l`, `chkOpt_oil_l`, `chkOpt_hot_l`, `chkOpt_other1_l/2_l/3_l`) are confirmed to exist and follow the same Landlord/Tenant pattern as the ones already mapped (`chkOpt_gas_l`, `chkOpt_elec_l`, `chkOpt_sewage_l`, `chkOpt_condfee_l`) but aren't individually broken out in the intake form yet — currently only gas/electricity/sewage/condo-fees are exposed.
- **No validation rules yet** (required vs. optional per selected form, currency formatting, date formatting per form's expected pattern — e.g. 2229E wants `yyyy/mm/dd` while Form 400 wants separate day/month/year fields for the same date).
- **No "which forms is this field needed for" gating** — right now every field is always shown; the intake UI should eventually only ask for a field if at least one of the *currently selected* forms needs it (e.g. don't ask Form 410 applicant questions if the realtor only selected the 2229E).

## Known traps (don't naively auto-map from a listing)

Carried over from ground-truth testing against a real listing + real signed lease — a listing's "features" are not the same as "included services," and a 1:1 field copy from a REALM export will be wrong on these:
- Listing "Heating Source: Gas" ≠ "Gas included in rent" (`chkOpt_Gas`)
- Listing "A/C: Central Air" (a unit feature) ≠ "Air conditioning included" (`chkOpt_AC`, a paid service)
- Listing "Laundry Features: Ensuite" (a fixture) ≠ "On-Site Laundry" (`chkOpt_OnSiteLaund`, a building service)

These three intake fields must always be asked directly, never pre-filled silently from a listing paste.

# RealtyFill — MVP Build Plan (Step by Step)

Source context: `project-context.md`. This breaks Phase 1 (Demo) and Phase 2 (MVP) into concrete, ordered build steps. Each step lists the goal, what to actually do, and the "done" condition.

---

## Phase 1 — Demo (prove the concept, no real users yet)

Goal: show the parents a real messy-note → filled-PDF result — across a **realtor-selectable set of forms**, not just the lease — and get an honest reaction.

### Target form set for the demo
Based on the real 203 College St #1706 deal documents on hand, the demo should support selecting and filling any/all of:
- **2229E** — Residential Tenancy Agreement (Standard Form of Lease) — 93 fields, already schema'd.
- **Form 400** — Agreement to Lease (Residential), incl. Schedule A additional terms.
- **Form 410** — Rental Application (Residential).
- **Form 324** — Confirmation of Co-operation and Representation (Tenant/Landlord).
- **Form 372** — Tenant Designated Representation Agreement (Authority for Lease), incl. Schedule A.

These five share a large amount of overlapping data (tenant/landlord names, property address, rent, term, brokerage info), which is exactly the "Property Profile" reuse case from section 6 of the context doc — worth building for the demo now rather than retrofitting later.

### Step 1 — Lock each form's field schema
- Already have: 93 fillable fields on the 2229E (types: text, radio_group), reverse-engineered radio-group semantics (e.g. `chkOpt_Condo`: `/1`=Yes, `/2`=No).
- Do: for each of Forms 400, 410, 324, 372, run the same field-discovery process (`check_fillable_fields.py` / `extract_form_field_info.py`) to confirm whether each is a real fillable AcroForm (like 2229E) or a flat/scanned layout requiring coordinate-based overlay instead — check this before assuming a uniform pipeline.
- Do: write out each form's full field list as a JSON schema (field_id → type → allowed values), one file per form.
- Done when: five schema files exist (`lease_2229e_schema.json`, `form_400_schema.json`, `form_410_schema.json`, `form_324_schema.json`, `form_372_schema.json`), each covering 100% of that form's fields.

### Step 2 — Define the shared "Property Profile" schema
- Do: identify the fields that repeat across two or more of the five forms (tenant name(s), landlord name, property address/unit, rent amount, lease term/dates, brokerage names, agent names) and define them once as a `deal_profile_schema.json`, with each per-form schema referencing which of its fields map to a profile field vs. which are form-specific.
- Done when: every profile field's mapping into each of the five form schemas is documented (a simple lookup table is enough — profile field → target field_id per form).

### Step 3 — Collect one real (or realistic) input example
- Do: get one redacted client intake note/email from the parents (the REALM listing export + the real 203 College St document set already on hand can stand in as ground truth if a fresh example isn't available in time). Redact/replace real PII (names, driver's license numbers, personal emails) with fictional placeholders before this becomes a checked-in fixture.
- Done when: you have `sample_input.txt` (messy raw text) and, separately, the ground-truth values a human would fill in by hand across all five forms, for comparison later.

### Step 4 — Build the extraction prompt (LLM: text → structured JSON)
- Do: write a prompt that takes messy text + the `deal_profile_schema.json` (plus any form-specific fields for whichever forms are selected) and returns one JSON object, explicitly instructed to:
  - Leave a field null/flagged rather than guess when a mapping isn't direct.
  - Distinguish "property/unit feature" (e.g., has A/C) from "included service" (e.g., A/C paid for by landlord) — the traps found in section 4 of the context doc.
- Do: run it against `sample_input.txt`, inspect the JSON output by hand.
- Done when: extraction output is a valid JSON object matching the profile schema, with obviously-uncertain fields flagged instead of guessed.

### Step 5 — Build the form-selection + fill pipeline
- Already have: a fill script that takes a `field_values.json` and produces a filled PDF from a blank AcroForm template (proven on 2229E).
- Do: extend it to (a) accept a list of selected forms, (b) for each selected form, map profile fields + that form's own extracted fields into its schema, and (c) output one filled PDF per selected form.
- Done when: running one command with a chosen subset of the five forms (e.g. just 2229E + Form 400, or all five) produces correctly filled PDFs for exactly those forms, no manual JSON editing in between.

### Step 6 — Build a minimal form-selection + review/edit UI
- Even for a demo, the "human always reviews" principle should be visible, not just claimed.
- Do: a simple CLI or single-page UI (no auth, no DB) that lets the user check which of the five forms to generate, shows extracted profile + per-form field values next to the source text, and lets them edit before generating.
- Done when: a non-technical person could select any subset of the five forms, correct a flagged field, and generate exactly those filled PDFs.

### Step 7 — Package the before/after demo
- Do: put together a short walkthrough — messy input → form selection (e.g. picking all five) → extracted fields (with one deliberately-flagged uncertain field) → five filled PDFs — for showing the parents.
- Done when: you can run the full demo live in under 5 minutes and answer "would you pay for this?" afterward.

**Phase 1 exit criteria:** parents have seen the real demo — selecting and generating multiple forms from one input — and given a genuine reaction (positive or not) on time-saved and willingness to pay.

---

## Phase 2 — Full App / MVP (usable by one real realtor on a real deal)

Goal: a small web app, not a script — someone other than you can run it unassisted.

### Step 8 — Choose and scaffold the stack
- Next.js (React) + Tailwind, Next.js API routes for backend logic to start.
- Do: `create-next-app`, set up Tailwind, basic folder structure (`/app`, `/lib`, `/api`).
- Done when: a blank Next.js app runs locally.

### Step 9 — Auth
- Do: integrate a managed auth provider (Supabase Auth, Clerk, or Auth.js). Email+password to start, magic-link if time allows.
- Done when: a user can sign up, log in, log out, and a logged-out user is redirected away from protected pages.

### Step 10 — Database + row-level security
- Do: set up Postgres (Supabase or Neon). Core tables: `users` (handled by auth), `deals` (one per property/client relationship, holding the shared Property Profile fields from Phase 1 Step 2), `documents` (uploaded raw input), `form_fills` (generated filled forms + their field values, one row per form per deal).
- Do: enable row-level security so a realtor can only query their own `deals`/`documents`/`form_fills`.
- Done when: querying as user A never returns user B's rows, enforced at the DB level (test this directly, not just through the UI).

### Step 11 — File storage
- Do: set up private object storage (Supabase Storage or S3), no public bucket access, short-lived signed URLs for the owning user only.
- Done when: uploading a document stores it privately and a signed download link works only for its owner.

### Step 12 — Upload/paste input UI
- Do: build the page where a realtor pastes text or uploads a document (intake note, listing export) tied to a `deal`.
- Done when: an uploaded/pasted document is saved to storage and linked to a `deal` row.

### Step 13 — Server-side extraction endpoint
- Do: move the Phase 1 extraction prompt (profile schema + per-form fields) into an API route. Server-side only — LLM API key never touches the frontend. Send only the fields the task actually needs (data minimization).
- Done when: hitting the endpoint with a `deal`'s raw input returns structured JSON for the Property Profile plus any form-specific fields, persisted against the `deal`.

### Step 14 — Form-selection + review/edit UI
- Do: build the UI (from Phase 1's minimal version, now wired to real data) that lets the realtor pick which of the five supported forms to generate for this `deal`, shows extracted values (profile + per-form) next to the source text, flags uncertain ones, and lets the realtor correct before generating.
- Done when: edits persist and only the *reviewed* JSON is used to generate PDFs — never the raw extraction output directly.

### Step 15 — Generate + download filled PDFs
- Do: wire the reviewed JSON into the fill pipeline (already form-selection-aware from Phase 1 Step 5), expose a "Generate" action, store each result in private storage, offer signed download links.
- Done when: a realtor can go from upload → select forms → review → download correctly filled PDFs for exactly the forms they chose, entirely through the UI.

### Step 16 — Property Profile persistence across sessions
- Do: persist the `deal`-level Property Profile (already defined as a schema in Phase 1 Step 2) so that returning to the same `deal` later, or generating an additional form for it, reuses the profile without re-extraction.
- Done when: generating a new form for an existing `deal` pre-fills all shared profile fields automatically, with only form-specific fields needing (re-)extraction.

### Step 17 — Add forms beyond the initial five (as they come up)
- Do: repeat Phase 1 Step 1's per-form work (field-type discovery, schema, radio-group semantics) for the next form the parents actually need beyond 2229E/400/410/324/372 — e.g. Agreement of Purchase and Sale for sales-side deals.
- Done when: the same select → review → generate flow works for the new form, reusing the Property Profile where fields overlap.

### Step 18 — Security pass before any real client data
- Do: confirm HTTPS everywhere, secrets in env vars/secrets manager, rate limiting on login/upload endpoints, audit logging (who touched what deal/document, when), retention/deletion policy defined.
- Done when: each item above is explicitly checked off, not assumed.

### Step 19 — Pricing + first real user
- Do: wire up billing (flat $20–30/month) via Stripe or similar once the parents (first real user) are ready to use it on an actual deal.
- Done when: one realtor is using the app on a real client deal, paying or on a trial, with all reviews happening through the UI (no manual script runs).

**Phase 2 exit criteria:** one real realtor completes a real deal's paperwork through the app end-to-end, and you have their direct feedback on time saved vs. their old process.

---

## Explicit non-goals for MVP (from context doc — do not build yet)
- No auto-fill or auto-generation of signatures, ever.
- No MLS/REALM scraping or automated login — input stays "user uploads/pastes/shares one link at a time."
- No usage-based billing — flat monthly only.
- No e-signature integration, team/brokerage tier, or additional provinces — Phase 3, only after real paying users exist.

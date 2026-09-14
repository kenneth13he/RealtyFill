# Project Structure — task & checklist per file

Every file below has a matching header comment in the file itself. This doc is the one-page index — use it to see the whole app's shape and what's left, without opening every file. Update both (the file's header comment and this doc) together when a file's job changes.

Status legend: 🔲 not started · 🟡 stubbed (header comment + TODOs, no logic) · ✅ implemented

---

## `app/` — frontend (Next.js App Router)

### `app/layout.tsx` 🟡
Root layout wrapping every page.
- [ ] Confirm base HTML shell is enough for Phase 1 (no global CSS/theming needed yet)
- [ ] Phase 2: wrap `{children}` with an auth/session provider (Step 9)

### `app/page.tsx` 🟡
Home page.
- [ ] Phase 1: single CTA linking to `/intake`
- [ ] Phase 2: realtor's deal dashboard (list deals, behind auth)

### `app/intake/page.tsx` 🟡
The Deal Intake Form — renders `forms/schemas/intake_form_schema.json` grouped by section.
- [ ] Render each group (Parties, Property, Rent & Deposits, Term & Conditions, Utilities, Brokerage, form-specific sections) from the schema
- [ ] "Paste a REALM listing export" flow that pre-fills only the Property group
- [ ] Pre-filled property fields stay editable (listing-feature traps — see `forms/schemas/README.md`)
- [ ] Submit handler → `POST /api/intake`
- [ ] Field-level input types per schema (`text`, `currency`, `date`, `radio`, `checkbox`, `long_text`)
- [ ] Conditional fields (e.g. deposit amount only shown if `rent_deposit_required == '/2'`)

### `app/review/page.tsx` 🟡
Review + form-selection screen, shown before any PDF is generated.
- [ ] Read-only summary of intake answers, grouped
- [ ] Per-field edit affordance (routes back into intake state, not silent PATCH)
- [ ] Checkboxes for the five target forms (2229E, 400, 410, 324, 372)
- [ ] Only show/require fields relevant to the *currently checked* forms
- [ ] Submit handler → `POST /api/generate`

---

## `app/api/` — backend (Next.js Route Handlers)

### `app/api/intake/route.ts` 🟡
Persists Deal Intake Form answers.
- [ ] Phase 1: validate body against `intake_form_schema.json`, write to scratch/deal JSON
- [ ] Phase 2: persist to `deal_intake` table (Postgres, row-level security scoped to auth'd user)
- [ ] Reject/ignore any field key not present in the schema

### `app/api/generate/route.ts` 🟡
Fill pipeline endpoint — turns reviewed intake answers into filled PDFs.
- [ ] Load the deal's *reviewed* intake answers (never raw/unreviewed data)
- [ ] For each selected form, call `lib/profileMapper.ts` to build that form's field map
- [ ] Call `lib/pdfFill.ts` to produce the output PDF from `forms/blank_templates/`
- [ ] Store output (Phase 1: local scratch; Phase 2: private object storage + signed URL)
- [ ] Return `{ form, downloadUrl }[]` for the generated forms
- [ ] **Hard rule**: never write to a signature field, on any form, ever

---

## `lib/` — shared logic (used by both frontend and backend)

### `lib/schemas.ts` 🟡
Single place that reads/parses `forms/schemas/*.json`.
- [ ] `getIntakeFormSchema()` — parse `intake_form_schema.json`
- [ ] `getDealProfileSchema()` — parse `deal_profile_schema.json`
- [ ] `getRawFormSchema(formId)` — parse one of the five `*_raw.json` files
- [ ] Add TypeScript types matching the JSON shapes so both frontend and backend get type safety

### `lib/profileMapper.ts` 🟡
Maps intake answers (by `key`) → one form's `{ field_id: value }` map (by that form's own field IDs).
- [ ] Walk `intake_form_schema.json`'s fields, write to each field's `targets[formId]`
- [ ] Translate radio/checkbox human values to their value codes (`/1`, `/2`, etc.) via each field's `options`
- [ ] Never emit a value for a known signature field_id
- [ ] Unit test against the real ground-truth values already reverse-engineered (see `forms/schemas/README.md` and the `2229e_values.json`-style dumps used during schema-building — regenerate those from local filled PDFs if needed, never commit them)

### `lib/pdfFill.ts` 🟡
Fills one blank template with a field-value map, writes the output PDF.
- [ ] **Open decision**: shell out to `scripts/fill_fillable_fields.py` (fast, already proven) vs. port to a JS PDF lib like `pdf-lib` (no Python runtime dependency in Phase 2 deploy) — decide before implementing
- [ ] Assert no signature field_id is present in the incoming value map before filling
- [ ] Return a path/buffer the API route can store

---

## `scripts/` — Python PDF helpers (prototype, proven working)

### `scripts/check_fillable_fields.py` ✅
Confirms whether a given PDF has real AcroForm fields or is flat/scanned. Used in Step 1 to confirm all five forms are genuinely fillable.

### `scripts/extract_form_field_info.py` ✅
Dumps a PDF's full field list (id, type, page, position, radio/checkbox value codes) to JSON. Produced every file in `forms/schemas/*_raw.json`.

### `scripts/fill_fillable_fields.py` ✅
Takes a blank template + a `field_values.json` ([{field_id, page, value}, ...]) and writes a filled output PDF. Already proven end-to-end on the 2229E (see `project-context.md` section 5). This is the logic `lib/pdfFill.ts` needs to either call or port.

### `scripts/blank_fillable_fields.py` ✅
Clears every field's value from a filled PDF to produce a true blank template, scanning every page's own annotations (not just each field's "canonical" page) so multi-page/shared fields get cleared everywhere. Used to produce `forms/blank_templates/*_blank.pdf`.

---

## `forms/` — data (already substantially done — see `forms/schemas/README.md` for its own detailed status table)

- `forms/schemas/*_raw.json` ✅ — raw field structure per form (392 fields total across 5 forms)
- `forms/schemas/deal_profile_schema.json` ✅ — shared fields across 2+ forms
- `forms/schemas/intake_form_schema.json` 🟡 — first draft done, gaps listed in `forms/schemas/README.md` (Form 410's full field set, Form 400's utility checkbox semantics, Form 324's alternate representation scenarios, validation/gating rules)
- `forms/blank_templates/*_blank.pdf` ✅ — true blank templates, verified free of the real deal's PII (grep-checked against known names/emails/IDs before being treated as safe)

---

## Not yet created (intentionally deferred)

- `package.json` / Next.js scaffold itself (`create-next-app`) — not yet run. Everything above is structure + comments only, per current request; running the actual scaffold is Phase 2 Step 8.
- Auth, database, and file-storage config (Phase 2 Steps 9–11) — no code needed until the scaffold exists.
- Any LLM/extraction code — the current design (see `mvp-build-plan.md`'s Phase 1 "Design decision" note) uses a structured intake form instead of free-text extraction for deal-specific fields, so there is no extraction prompt/endpoint in this structure. The only place AI could still help is optionally parsing a pasted listing export into the Property group — not yet decided whether that needs an LLM at all versus a simple structured parse (the REALM export is already labeled/tabular).

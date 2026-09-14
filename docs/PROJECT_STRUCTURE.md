# Project Structure — task & checklist per file

Every file below has a matching header comment in the file itself. This doc is the one-page index — use it to see the whole app's shape and what's left, without opening every file. Update both (the file's header comment and this doc) together when a file's job changes.

Status legend: 🔲 not started · 🟡 stubbed (header comment + TODOs, no logic) · ✅ implemented

---

## `app/` — frontend (Next.js App Router)

### `app/layout.tsx` ✅
Root layout wrapping every page. No CSS/theming yet (fine for Phase 1).
- [ ] Phase 2: wrap `{children}` with an auth/session provider (Step 9)

### `app/page.tsx` ✅
Home page — single CTA into `/intake`.
- [ ] Phase 2: realtor's deal dashboard (list deals, behind auth)

### `app/intake/page.tsx` ✅ + `app/intake/IntakeForm.tsx` ✅
The Deal Intake Form. Server component (`page.tsx`) loads `intake_form_schema.json` via `lib/schemas.ts`; client component (`IntakeForm.tsx`) renders it grouped by section and owns all form state.
- [x] Render each group from the schema
- [x] Field-level input types (`text`, `currency`, `date`, `radio` → `<select>`, `checkbox`, `long_text`)
- [x] Conditional fields (e.g. deposit amount only shown if `rent_deposit_required == '/2'`)
- [x] Submit handler → `POST /api/intake`
- [x] Listing pre-fill flow across most of the intake form (not just Property — also deposits, insurance, commission, holdover, brokerage info), via `/api/extract-listing` (Claude) — supports both pasting text and uploading a listing PDF directly; pre-filled values stay fully editable
- [x] Fields the model wasn't confident enough to fill show an italic "Not filled from listing — `<reason>`" hint instead of a guessed value; editing the field by hand clears the hint. (The "ASSUMED — VERIFY" badge for confidently-guessed utility fields was removed per user request — those fields now render the same as any other pre-filled field, no special marker.)
- [x] `monthly_rent_words` auto-derives from `monthly_rent_amount` (`lib/numberToWords.ts`) instead of being typed — renders read-only, visually distinct (muted background/text) so it's clear it's computed, not editable. Verified against the real ground-truth values from the filled Form 400 ("$3,900.00" → "Three Thousand Nine Hundred", "$7,800.00" → "Seven Thousand Eight Hundred").
- [ ] Client-side validation (currently relies on native HTML input types only — an empty required field can be submitted)
- [ ] Human-readable per-field labels are used, but there's no "required" visual indicator yet

### `app/review/page.tsx` ✅ + `app/review/ReviewForm.tsx` ✅
Review + form-selection screen, shown before any PDF is generated. Server component reads `data/deal.json`; client component owns selection + generation.
- [x] Summary of intake answers grouped and labeled via the schema (not raw keys)
- [x] Checkboxes for the five target forms
- [x] Submit handler → `POST /api/generate`
- [x] Generated forms are clickable rows, not plain download links — clicking one expands an inline `<iframe>` preview (`?inline=1` on the download route) using the browser's own native PDF viewer. Since these are real fillable AcroForms, the native viewer lets the realtor edit any field directly and save via its own toolbar — no custom PDF editor was built; the browser already does this for a real fillable form. No separate "Download" button is shown alongside the preview, since that would silently discard whatever the realtor just edited (we have no way to read edits made in the browser's native viewer back onto our server) — the native toolbar's own save/download is the only correct path once someone's edited it.
- [ ] Per-field edit affordance beyond "go back to /intake" (currently just a link back, no inline edit)
- [ ] Only show/require fields relevant to the *currently checked* forms

---

## `app/api/` — backend (Next.js Route Handlers)

### `app/api/intake/route.ts` ✅
Persists Deal Intake Form answers to `data/deal.json` (Phase 1 local storage).
- [x] `POST` saves the full answer map; `GET` returns it
- [ ] Phase 2: persist to `deal_intake` table (Postgres, row-level security scoped to auth'd user) instead of a local file
- [ ] Validate body against `intake_form_schema.json` / reject unknown keys (currently accepts anything)

### `app/api/generate/route.ts` ✅
Fill pipeline endpoint — turns reviewed intake answers into filled PDFs. Verified working end-to-end against real blank templates.
- [x] Loads `data/deal.json`, maps each selected form via `lib/profileMapper.ts`, fills via `lib/pdfFill.ts`
- [x] Returns `{ form, downloadUrl }[]`
- [x] **Hard rule enforced**: `lib/profileMapper.ts` strips any field_id matching a signature-field naming pattern before it ever reaches the fill step
- [ ] Phase 2: private object storage + signed URLs instead of local `data/output/`

### `app/api/download/[form]/route.ts` ✅
Serves a generated PDF from `data/output/`. Phase 1 only (unauthenticated local file read) — Phase 2 replaces with a signed URL.
- [x] `?inline=1` serves with `Content-Disposition: inline` instead of `attachment`, so the PDF renders inside `app/review/ReviewForm.tsx`'s preview `<iframe>` instead of forcing a download. Verified the header actually switches (`curl -sI`) and, more importantly, verified in a real (non-headless-shell) Chromium browser that clicking a form opens the native PDF viewer inline with **no download event fired** — an earlier test using Playwright's stripped-down `chrome-headless-shell` build falsely showed a download firing, since that build has no PDF viewer extension; real Chrome does, and that's what matters here.

### `app/api/extract-listing/route.ts` ✅
The one AI-assisted endpoint in the app. Accepts either pasted listing text (JSON `{text}`) or an uploaded listing PDF (`multipart/form-data`). A PDF is sent to Claude **natively as a `document` content block** (base64) — not pre-flattened to text — so the model reads the real page layout (e.g. REALM's two-column property-info table) instead of a linearized wall of text. Both input paths converge on the same Claude call (`lib/claude.ts`, forced tool use).

**Design**: rather than a fixed rule ("utility fields always guess 'not included' when the listing is silent"), the model itself decides per field whether it's confident enough to fill it. Every field lands in one of two output channels:
- **`fields`** — the model is confident (directly stated, or a safe real-estate convention applies). Mapped into `answers` and pre-fills the form like any other field.
- **`flagged`** — the model isn't confident, with a short reason. Left blank in the form with an inline "Not filled from listing — `<reason>`" hint instead of a guessed value.

(An earlier version also returned `inferredKeys` for the six utility fields specifically, driving an "ASSUMED — VERIFY" badge on confidently-guessed utility fields. Removed per user request — those fields no longer render any different from other pre-filled fields. The `flagged`/blank-with-reason path is unaffected and remains the real safety mechanism.)

This replaced an earlier version that force-guessed the six utility fields with a blanket "silence = not included" rule — found wrong in real testing (the real signed lease for 203 College St had A/C included despite the listing never saying so, while gas — also unstated — really was excluded). The user found a Python prototype using this fields/flagged tool-use pattern and asked to port the approach in.

- [x] Verified against the real 203 College St listing PDF across 6+ separate real API calls (not a single lucky run): all 22 directly-stated fields (address, landlord, deposits, insurance, commission, holdover, both brokerage sides correctly disambiguated) came back correct every time.
- [x] **Honest finding, not glossed over**: whether `ac_included` specifically gets flagged vs. confidently guessed is genuinely non-deterministic — across 6 real calls with the same input it split roughly evenly, even after tightening the prompt's self-check instruction (see below). This is inherent model stochasticity on a genuine judgment call, not something a prompt tweak fully eliminates. Worth knowing if this field's behavior looks inconsistent between demo runs — since the "ASSUMED — VERIFY" badge was removed, a confidently-guessed `ac_included` now looks the same as any other pre-filled field, so the `flagged` path (blank + reason) is the only remaining visible signal that something was uncertain.
- [x] Bumped `max_tokens` 4096 → 8192 and clarified the self-check instruction after finding it was itself introducing a regression: an early version of the "re-scan before finalizing" instruction pushed the model to convert legitimately-flagged fields into guesses (verified: 3/3 native-PDF runs guessed `ac_included` instead of flagging it, where the pre-self-check version had flagged it correctly). Reworded to explicitly say the re-scan is for catching *reading* errors, not for lowering the confidence bar on fields already correctly flagged as ambiguous — this measurably helped (1/3 flagged correctly afterward, up from 0/3) but per the finding above, didn't eliminate the non-determinism.
- [x] Explicit brokerage disambiguation instruction in the prompt — an earlier version swapped listing vs. co-op brokerage because it read the "Prepared By" header (whoever printed the report) as signal for which side is which; found by checking output against a real filled Form 400, fixed by telling the model to key off the "LISTING CONTRACTED WITH" / "CO-OP" headings instead and ignore "Prepared By" entirely
- [ ] No retry/fallback on API errors — currently just surfaces the error to the UI
- [ ] No file-size limit on the upload yet

---

## `lib/` — shared logic (used by both frontend and backend)

### `lib/formTypes.ts` ✅
Client-safe types and constants (`FormId`, `IntakeFormSchema`, `FORM_LABELS`, `ALL_FORM_IDS`) — no `fs` import, so client components can import it without Turbopack pulling Node built-ins into the browser bundle (this split exists because the first version didn't have it and broke the build — see fix history below).

### `lib/schemas.ts` ✅
Server-only: reads/parses `forms/schemas/*.json`, re-exports everything from `formTypes.ts` for convenience.
- [x] `getIntakeFormSchema()`, `getRawFormSchema(formId)`
- [ ] `getDealProfileSchema()` was speced but hasn't been needed yet — `deal_profile_schema.json` was superseded in practice by `intake_form_schema.json`'s own per-field `targets`, which already encodes the same reuse mapping directly. Consider whether `deal_profile_schema.json` is still worth keeping as a separate file or should be treated as historical/reference-only.

### `lib/profileMapper.ts` ✅
Maps intake answers → one form's `[{field_id, page, value}]` list (the exact shape `scripts/fill_fillable_fields.py` expects).
- [x] Walks `intake_form_schema.json`'s fields, resolves each target's page via the raw schema
- [x] Skips any field_id matching `/sig|Signature/i` — the hard "never touch a signature field" rule
- [x] Verified against real filled PDFs (inspected actual output `/V` values post-generation, not just "no errors thrown")
- [ ] No automated test suite yet — verification so far has been manual `pypdf` inspection after each generate call

### `lib/pdfFill.ts` ✅
Fills one blank template, writes the output PDF.
- [x] **Decision made**: shells out to `scripts/fill_fillable_fields.py` via `child_process.execFile` (kept the proven Python logic rather than porting to a JS lib)
- [ ] Revisit if Python becomes a real deployment constraint in Phase 2

### `lib/claude.ts` ✅ (current)
Wrapper around the Anthropic API for the listing-extraction feature. Model `claude-opus-5` at `effort: "medium"` (bumped up from an earlier `"low"` once extraction started requiring real judgment — deciding fields vs. flagged, not just reading values off a page — rather than the speed/cost trade of a purely mechanical task). Reads `ANTHROPIC_API_KEY` from `.env.local` (gitignored; `.env.example` documents the variable).
- [x] Replaced `lib/ollama.ts` as the active path after real-PDF testing: `gpt-oss:20b` (local, 20B reasoning model) took ~60-90s and non-deterministically mis-applied the "feature ≠ included service" instruction across runs; `llama3.2:3b` (local, fast) was ~10x faster but reliably misparsed the address format ("203 College St 1706" → street number 1706, unit null) on repeated tries. Claude: ~6s total, every field correct, on the real listing PDF.
- [x] Uses forced tool use (`tool_choice: {type: "tool", ...}`) with a JSON Schema `input_schema` instead of asking for JSON in prose and regex-extracting it — Anthropic validates the shape server-side, so there's no more markdown-fence-stripping/parse-failure surface. `claudeExtractWithTool<T>()` is generic so any future tool-based extraction call can reuse it.

### `lib/ollama.ts` 🟡 (kept for reference / offline use)
The original local-model path. No longer called by `app/api/extract-listing/route.ts`, but left in place — useful if the app ever needs to run fully offline/free, at the cost of the speed/accuracy tradeoffs documented in `lib/claude.ts`'s header.

### `lib/numberToWords.ts` ✅
Converts a numeric string to Title Case words for the `monthly_rent_words` field on Form 400 (`txtp_rentwords`), which expects the rent written out (e.g. "Three Thousand Nine Hundred"), not digits. Used by `app/intake/IntakeForm.tsx` to auto-derive that field from `monthly_rent_amount` instead of asking the realtor to type it twice.
- [x] Verified against the real ground-truth values from the filled Form 400 you shared: "3900.00" → "Three Thousand Nine Hundred", "7800.00" → "Seven Thousand Eight Hundred" (exact match), plus edge cases (cents, six-figure amounts, zero, empty string).

---

## `scripts/` — Python PDF helpers (prototype, proven working)

### `scripts/check_fillable_fields.py` ✅
Confirms whether a given PDF has real AcroForm fields or is flat/scanned. Used in Step 1 to confirm all five forms are genuinely fillable.

### `scripts/extract_form_field_info.py` ✅ (bug fixed)
Dumps a PDF's full field list (id, type, page, position, radio/checkbox value codes) to JSON. **Had a real bug**: silently dropped any text field appearing as multiple widgets across pages (its multi-widget handling only covered checkbox/radio fields) — this caused Form 400 to be missing 20 fields (`txtbuyer1`, `txtseller1`, the whole address) and Form 372 to be missing 6, discovered by inspecting actual generated PDF output and finding blank tenant/landlord/address fields. Fixed; all five raw schemas regenerated and re-verified PII-clean.

### `scripts/fill_fillable_fields.py` ✅
Takes a blank template + a `field_values.json` and writes a filled output PDF. Proven end-to-end across all five forms, called live by `lib/pdfFill.ts`.

### `scripts/blank_fillable_fields.py` ✅
Clears every field's value from a filled PDF to produce a true blank template, scanning every page's own annotations. Used to produce `forms/blank_templates/*_blank.pdf`.

**Removed**: `scripts/extract_pdf_text.py` and `lib/pdfText.ts` (pypdf-based text extraction for uploaded listing PDFs) — superseded once `/api/extract-listing` started sending PDFs to Claude natively as a `document` content block instead of pre-flattening them to text. Deleted rather than left as unused dead code, per this project's own convention.

---

## `forms/` — data (see `forms/schemas/README.md` for its own detailed status table)

- `forms/schemas/*_raw.json` ✅ — raw field structure per form (2229E: 93, Form 400: 108, Form 410: 121, Form 324: 48, Form 372: 48 — 418 fields total)
- `forms/schemas/deal_profile_schema.json` 🟡 — built early, largely superseded by `intake_form_schema.json`'s own `targets` mapping (see `lib/schemas.ts` note above)
- `forms/schemas/intake_form_schema.json` ✅ — live, driving the actual `/intake` UI. Known gaps unchanged from before: Form 410's full field set isn't fully itemized (only the fields with no other source are listed), Form 400's non-gas/electricity/sewage/condo-fee utility checkboxes aren't individually exposed, Form 324's alternate representation scenarios aren't covered.
- `forms/blank_templates/*_blank.pdf` ✅ — true blank templates, verified PII-clean, used live by the fill pipeline

---

## MVP status: working end-to-end

Verified flow: `/intake` (optionally pre-filled via a pasted listing export + Ollama) → `POST /api/intake` → `/review` → select forms → `POST /api/generate` → real filled PDFs via `/api/download/[form]`. Tested with fictional data across all five forms; actual output field values inspected with `pypdf` after generation, not just "the request succeeded."

Quick start: `npm install && npm run dev`, then visit `http://localhost:3000` → "Start a new deal". The listing-extraction feature additionally requires `ollama serve` running locally with `gpt-oss:20b` pulled.

### Known gaps (not blocking the demo)
- No client-side validation — a realtor could submit an empty required field.
- `/review` shows raw intake keys, not human-readable labels.
- Single-deal local storage (`data/deal.json`) — a new intake submission overwrites the previous one; no multi-deal concept until Phase 2's database work.
- No automated tests — all verification so far has been manual (build, type-check, live requests, `pypdf` inspection of output).
- `deal_profile_schema.json`'s relationship to `intake_form_schema.json` needs a decision (keep as reference doc, or retire it).

## Not yet started

- Auth, database, and file-storage config (Phase 2 Steps 9–11).
- Any LLM use beyond the one scoped listing-extraction endpoint — deal-specific fields remain direct realtor entry by design (see `mvp-build-plan.md`'s Phase 1 "Design decision" note).

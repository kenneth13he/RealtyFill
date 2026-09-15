# Remaining Work

Single source of truth for what's left. Supersedes `TESTING_READINESS.md`
(that one predates the Vercel deployment and is now partly stale — delete it
once you've read this).

Status markers: ✅ done and verified · ⚠️ done but unverified · ❌ not started

---

## Where things actually stand

**Live at:** https://realtyfill.vercel.app — public, verified serving the app
to a cookie-less request (see Blocker 1)

**All four form sets now generate.** Lease–tenant (5 forms), lease–landlord
(2), sale–buyer (5), sale–seller (3). "Coming soon" is gone. The blank
templates for the three new sets arrived as flat PDFs with zero AcroForm
fields, so `scripts/add_form_fields.py` synthesizes fields over the dot-leader
blanks — 395 across 10 forms. **Those field positions are inferred, not
authoritative**; each template folder's README says what to redo if a real
WEBForms export ever arrives. PropTx 291/292 remain deliberately out of scope.

**Verified working in production** (tested end-to-end via real HTTP requests
against the deployed site, with `pypdf` inspection of the output PDF — not
just "the request returned 200"):

- ✅ Email/password sign-up + sign-in, session handling, sign-out
- ✅ Multi-deal dashboard, create/close/archive deals
- ✅ Settings (profile + brokerage defaults seeded onto new deals)
- ✅ Intake save/load, inline editing with autosave
- ✅ PDF generation → Supabase Storage → signed-URL download, **with correct
  field values** (2229E verified on production specifically)
- ✅ The `pdf-service` Vercel Service + `PDF_SERVICE_URL` binding (this was
  the big architectural unknown — it works)
- ✅ Cross-user data isolation, re-verified against the production database:
  a second account could not read, download, or overwrite the first
  account's deal, and the first account's data was confirmed untouched
  afterward
- ✅ Rate limiting on `/login` and `/api/extract-listing` — **rewritten**:
  the counters used to be a per-process in-memory Map, which on Vercel's
  serverless runtime meant every limit was silently multiplied by the number
  of warm instances. Now a single atomic SQL statement
  (`check_rate_limit()`, migration 0003). Verified: 10 simultaneous calls
  against a limit of 5 let exactly 5 through.
- ✅ Cross-user isolation re-verified after adding `support_requests`:
  with two real user ids, neither could read the other's deals, intake
  answers, generated forms or support requests, and writes across the
  boundary were refused by Postgres (`42501`), not just hidden.
- ✅ HTTPS (automatic on Vercel)

---

## Blockers — no realtor can test until these are done

### 1. ✅ Decide how testers reach the site — resolved for production
`https://realtyfill.vercel.app` is publicly reachable: a cookie-less request
returns 200 and the real landing page, not an SSO gate. Anyone can visit it.

Caveat worth knowing: the project still reports
`ssoProtection: all_except_custom_domains` via the API, yet the production
alias serves publicly — so the setting and the observed behaviour disagree.
Preview deployments do still appear to be gated. If you need previews open
too, check Settings → Deployment Protection directly rather than trusting
either signal.

Still do: rotate the bypass secret if you haven't (one was pasted into a chat
log).

<details><summary>Original options, kept for reference</summary>

- **Turn protection off** (Settings → Deployment Protection → Vercel
  Authentication → Disabled). Simplest; site becomes public.
- **Keep it private, hand testers a bypass link** — works, but means giving
  each tester a URL containing a secret token. Fine for Kenneth, wrong for
  external realtors.
- **Vercel Pro team** — real member accounts / password protection. Costs money.
</details>

### 2. ❌ Email delivery (SMTP) — still the real blocker
Confirmed via the management API: `smtp_host` is null, so the project is on
Supabase's built-in mailer — **2 emails/hour, project-wide, and only
deliverable to your own team members.**

The stopgap has been applied: `mailer_autoconfirm` is now `true`, so signup
no longer sends an email and works instantly. That's why signups succeed.

What's still broken is **forgot-password**, which sends a real email no
matter what that setting says. For any realtor who isn't on your Supabase
team, that email never arrives — silently.

Fix: Resend or Postmark, then Supabase → Project Settings → Authentication →
SMTP Settings. ~20 minutes, and it's the last thing between you and handing
this to a tester.

### 3. ✅ Supabase URL configuration — verified correct
Confirmed via the management API:
- `site_url`: `https://realtyfill.vercel.app`
- `uri_allow_list`: `https://realtyfill.vercel.app/**`

One gap: `http://localhost:3000/**` is **not** in the allow list, so password
reset and OAuth redirects will bounce to production when testing locally.
Add it if you work on auth flows in dev.

### 4. ✅ Google sign-in — enabled
Supabase now reports `external_google_enabled: true`. The button should work.
Not clicked through in a browser yet (see item 11).

---

## Should be done before real client data goes in

### 5. ❌ Terms of Service + Privacy Policy
No such pages exist. The app stores real tenant/landlord names, phones, and
addresses; one Schedule document we tested even involves a tenant's SIN.
Needed before a realtor puts a real client's information in.

### 6. ✅ Forgot-password flow
Built. `/login?mode=reset` requests a link, `/auth/callback` exchanges the
recovery code, `/reset-password` sets the new password. Rate-limited, and
deliberately reports the same message for unknown addresses so it can't be
used to discover who has an account. Verified the request path end to end.

**Still depends on Blocker 2** — it sends mail through Supabase's
rate-limited default mailer, so it will be unreliable until SMTP is sorted.

### 7. ✅ Account / data deletion
Built. Settings → "Delete account", gated behind typing DELETE. Removes
Storage objects first, then deletes the auth user, which cascades
deals → deal_intake/generated_forms and profiles.

Verified against a real account with 1 deal and 5 generated PDFs: after
deletion, zero orphaned rows in all four tables **and** zero orphaned
storage objects. (Order matters here — deleting the user first would have
orphaned the PDFs in the bucket with no session left to clean them up.)

---

## Correctness gaps

### 8. ✅ All five forms generate and fill correctly
Generated all five for one deal with comprehensive data and inspected every
filled value with `pypdf`. All five produce valid PDFs with correct values.

Fill coverage, which is what led to the rewrite of item 9 below:

| Form | Fields filled / total |
|---|---|
| 2229E | 42 / 93 |
| Form 400 | 29 / 108 |
| Form 324 | 22 / 48 |
| Form 372 | 10 / 48 |
| Form 410 | **11 / 121** |

(Done locally. Production uses the same mapping logic through `pdf-service`,
already verified byte-equivalent, so re-running on production is a nice-to-
have rather than a correctness gap.)

### 9. 🟡 Form-field coverage — partly done, rest needs decisions
A full audit found **262 unmapped fields** across the five forms. They fall
into three very different buckets:

**Done ✅ — landlord's address for notices.** 2229E s.3 and Form 400's
"Address of Landlord" were both entirely blank, despite being the legally
required address for serving notices. Now mapped as seven separate intake
fields (unit / street number / street name / PO box / city / province /
postal code) — deliberately separate rather than one blob, because both
forms lay them out as distinct boxes, and mapping one value into several
boxes is exactly the bug we already hit with the co-op brokerage address.
Verified filling correctly on both forms.

**Blocked ⚠️ — Form 400's utility checkboxes. Do not guess at these.**
Form 400 has its own included-in-rent checkboxes (cable, gas, condo fee,
oil, hot water, other×3) that nothing currently maps to. The obstacle isn't
effort, it's that the intake schema uses two *different* meanings for the
same `/1`/`/2` codes: `gas_included` means `/1` = Yes-included, while
`electricity_responsibility` means `/1` = Landlord. Whether Form 400's
`chkOpt_gas_l` follows one convention or the other cannot be determined
from the field data alone. **Guessing wrong silently ticks the wrong box on
a legal document** — the worst failure mode this app has. Resolve by
checking a real completed Form 400 (the realtors you're testing with will
have one) and confirming which box `/1` corresponds to, then map them.

**Product decision needed ❓ — Form 410.** It sits at 11/121 filled because
it's a *rental application*: employment history (current and prior, ×2
applicants), banking details, credit references, personal references,
vehicles, prior addresses, occupants, pets. That's roughly 80 new intake
fields, and more importantly it's data the **tenant** supplies, not the
listing agent. Asking a realtor to type a tenant's employment history into
RealtyFill is a different product than "enter the deal once." Decide whether
Form 410 needs a separate tenant-facing flow, is left partially filled
deliberately, or is dropped from the supported set — before anyone builds
80 fields.

### 10. 🟡 Validation — per-field only; the summary warning was removed
The editor marks each empty non-optional field with a red `*` at the point
of entry, which stands.

A summary warning on the review page ("N fields still empty on the forms
you've selected") was built and then removed: `"(optional)"` in a label is
too crude a proxy for "required", so it counted ~37 fields on a realistic
deal — mostly things a realtor legitimately wouldn't have. It read as noise
rather than a signal.

Doing this properly needs a real notion of which fields are genuinely
required *per form*, which doesn't exist in `intake_form_schema.json` today
and overlaps with the item 9 audit. Worth revisiting together with that.

### 11. ❌ Nothing has been verified in an actual browser
Every test so far has been HTTP-level (curl + pypdf). Nobody has clicked
through the real UI. Buttons, layout, the PDF preview iframe, mobile
rendering — all unverified visually. **Do this before handing it to anyone.**

---

## Technical debt introduced along the way

### 12. ✅ PDF fill logic exists in two copies — resolved
There is now one copy. `pdf-service/fill_fillable_fields.py` and
`pdf-service/extract_form_field_info.py` hold the logic;
`scripts/fill_fillable_fields.py` and `scripts/extract_form_field_info.py`
are thin CLI wrappers that import them. The dependency has to point that way
round: `pdf-service/` deploys with `root: pdf-service/` and can only import
files inside itself, while `scripts/` can reach down into it.

Both paths verified against the same template after the change — the CLI
(`python scripts/fill_fillable_fields.py …`) and the HTTP endpoint
(`POST /fill`) each wrote the value into the field and read it back
correctly, and each rejected an unknown field id.

One behaviour change while doing this: the CLI now prints validation errors
to **stderr** rather than stdout. `lib/pdfFill.ts` surfaces only stderr in the
error it throws, so a bad field id previously reached the API as a bare
"Command failed" with no indication of which field was wrong.

### 13. ❌ Two deployment paths, only one in use
The repo carries both Vercel config (`vercel.json`, `pdf-service/`) and
Render/Docker config (`Dockerfile`, `render.yaml`, root `requirements.txt`).
Only Vercel is live. The root `requirements.txt` is also what caused the
"Multiple frameworks detected" build failure. Decide whether Render is a real
fallback; if not, delete it and item 12 goes away too.

### 14. ✅ Two repos with unrelated git histories — resolved
`kenneth13he/realtyfill` is canonical and Vercel builds from it. It is the
only remote configured locally, so there is nothing left to replay by hand.
(The repo was also renamed to lowercase; the local remote URL was updated to
match, since GitHub was redirecting every push.)

Still worth doing: `new-main` and `phase-2-accounts` are fully merged into
`main` and can be deleted.

### 15. 🟡 Automated tests — a first suite exists, coverage is partial
`npm test` (24 tests, `node:test` via `tsx`, no new framework) and
`npm run test:py` (9 tests, plain `unittest`, no pytest dependency).

What they cover, chosen as the places bugs have actually happened:
- `isSignatureField` — including the substring bug that blanked the
  designated-representative line on Forms 271/272/371
- `withComputedValues` — one-line address, money-to-words, date splitting
- **every intake `targets` entry names a field id that really exists on that
  form** — this is the one that matters most. A target pointing at a
  non-existent field fails silently: the PDF generates fine and the blank
  just stays empty. It's what produced Form 244's shifted date parts.
- every set's templates exist on disk where the generate route looks
- checkbox targets use the `/1`/`/Off` pair `IntakeFieldsEditor` hardcodes
- the fill logic itself: values land, unknown ids and wrong page numbers are
  rejected, all errors reported not just the first, `/fill` returns 422 with
  the detail list `lib/pdfFill.ts` expects

Not covered: React components, the API routes, auth/RLS, and whether a filled
field is in the *right place on the page* (that still needs a human looking
at a rendered PDF — it's how the Form 101 purchase-price bug was caught).

---

## Operational

### 15b. ✅ Support channel — built
`/support` (linked from the header on every signed-in page). A realtor files
a report; it lands in `public.support_requests`, RLS-scoped so each user sees
only their own. Triage from the Supabase dashboard or with the service role —
there is deliberately no update policy, so a submitted report can't be edited
afterwards and `status` (open / in_progress / resolved) stays yours to set.

The piece that makes it useful is the **error reference**. `lib/logger.ts`
now stamps every logged error with a short id, returns it, and the API routes
send it to the browser; the support form has a field for it. "Generating
didn't work this morning" becomes one grep.

That change also closed a small leak: `/api/generate`, `/download`,
`/account` and `/extract-listing` were returning raw internal error messages
to the browser — strings that can name tables, storage paths and field ids.
They now return a generic sentence plus the reference.

Still manual: nothing emails you when a request arrives. Check the table, or
wire it to the SMTP provider once Blocker 2 is done.

### 15c. ✅ Security response headers — added, CSP is report-only
`next.config.ts` sets `X-Content-Type-Options`, `X-Frame-Options`,
`Referrer-Policy`, `Permissions-Policy` and `Strict-Transport-Security` on
every route, all enforced.

The Content Security Policy ships as **`Content-Security-Policy-Report-Only`**
on purpose. A slightly-wrong CSP doesn't degrade, it blanks the page, and
nobody has clicked through this app in a browser yet (item 11). Report-only
logs violations to the console and blocks nothing.

**To finish:** open the site with devtools, sign in, run an intake, generate,
preview a PDF. If the console reports no CSP violations, change `CSP_HEADER`
in `next.config.ts` to `"Content-Security-Policy"` and it starts enforcing.
Until then it is documentation, not protection.

---

### 16. ⚠️ Logging exists, alerting doesn't
`lib/logger.ts` writes structured JSON errors visible in Vercel's Logs tab,
but nothing notifies you. If PDF generation starts failing for a realtor
mid-test, you'll find out when they tell you. Consider Sentry or a log drain.

### 17. ❌ No backup/retention policy
Checked via the management API: **PITR is off and the project has zero
backups.** Free tier, so there is currently no recovery path at all — if the
database is lost, every deal and every intake answer goes with it. That's
tolerable while the only data is yours and Kenneth's; it stops being
tolerable the moment a realtor enters a real client's details.

Options: Supabase Pro (daily backups + PITR), or a scheduled `pg_dump` to
somewhere off-platform. Also still undecided: how long real client data is
kept.

### 17b. ❌ Password policy is weak
`password_min_length` is 6 and no character classes are required. Raising it
(Supabase → Authentication → Policies) is a one-field change. Attempted here
and blocked by the permission classifier as a change to shared auth config —
it needs to be you, in the dashboard.

---

## Front-end / design

Current state, for context: Tailwind v4, a handful of CSS variables in
`app/globals.css` (slate neutrals + default-indigo `#4f46e5`), the system
font stack, no dark mode, no logo, no favicon. Everything is functional and
clean but visually generic — it reads as "unstyled developer app," which
matters when the audience is realtors deciding whether to trust it with
client paperwork.

### 18. ❌ Landing page (`app/page.tsx`)
Right now a logged-out visitor gets a centered heading, one paragraph, two
links, and a grid of five form names. It explains nothing about *how* it
works or why it's worth trusting. Suggested structure:

1. **Nav bar** — logo left, "Sign in" + "Get started" right.
2. **Hero** — a concrete headline over an abstract one. "Five Ontario lease
   forms. One intake form. Two minutes." beats "Fill out one deal intake
   form." Sub-line explains the pain: entering the same tenant/landlord/rent
   details five times. Primary CTA "Get started free," secondary "Sign in."
3. **Visual proof** — the single highest-value addition: a screenshot or
   short looping video of a filled PDF appearing. Realtors believe a picture
   of their own paperwork far more than a description of it.
4. **How it works, 3 steps** — Paste the listing → Review what we extracted →
   Download all five filled forms. Icons + one line each.
5. **The forms** — keep the existing five-card grid, it's genuinely
   reassuring. Add the real form names/numbers realtors recognize.
6. **Trust row** — "Your data stays private," "We never fill signature
   fields," "Review everything before anything is generated." All three are
   true and all three are things a realtor will worry about.
7. **Footer** — Terms, Privacy (see item 5), contact.

### 19. ❌ Logo + brand identity
There's no logo, no favicon (browser tab shows the default), and no social
preview image. Concrete asks:
- A wordmark or simple icon — a document/form motif with a checkmark or a
  key/house element reads immediately for real estate paperwork.
- `app/icon.png` (Next.js App Router picks this up as the favicon
  automatically) and `app/opengraph-image.png` for link previews.
- Pick a real accent color instead of default Tailwind indigo. Indigo says
  "developer template"; a deeper navy/green reads more like professional
  services software, which is the right signal here.

### 20. ❌ Typography
System font stack is a safe default but it's the single biggest "this looks
unfinished" signal. One good typeface via `next/font` (Inter, Geist, or a
serif for headings paired with a neutral sans for body) would lift the whole
app in an afternoon. Also add a real type scale — headings are currently
`text-2xl`/`text-4xl` with nothing in between.

### 21. ❌ The intake form is long and unguided (`components/IntakeFieldsEditor.tsx`)
It renders every group stacked vertically — dozens of fields in one endless
scroll with no sense of progress or position. Options, cheapest first:
- Sticky section nav (Parties / Property / Rent & Deposits / Terms /
  Brokerage) that scrolls to each group
- A progress indicator ("12 of 34 fields filled")
- Collapsible sections, completed ones auto-collapsed
- Or a real multi-step wizard, one group per step — biggest change, best UX

Also: the missing-field `*` markers exist, but there's no summary of what's
still missing. A "3 required fields left" chip near the submit button would
help a lot.

### 22. ❌ Loading and feedback states
Generation takes several seconds (it calls a Python service and uploads to
storage) and the only feedback is a button label changing to "Generating…".
Needs: a spinner, a disabled/greyed state, and ideally per-form progress
since multiple forms generate sequentially. Same for the autosave indicator
on the review page, which is a tiny grey "Saving…" that's easy to miss.

Errors are currently plain inline text. Toasts would read better for
transient things (saved, generated, failed) while keeping inline text for
validation.

### 23. ❌ Dashboard empty state (`app/dashboard/DealsList.tsx`)
A brand-new user's first screen after signing up says "No active deals." —
a dead end at the most important moment. Should be an illustrated empty
state that explains the flow and points at the create-deal field.

### 24. ❌ PDF preview UX (`app/deals/[dealId]/review/ReviewForm.tsx`)
The preview is an 80vh `<iframe>` inside an accordion. Works on desktop,
likely poor on mobile (nested scrolling, tiny text). Consider: open in a new
tab on small screens, or a modal/full-screen preview with an explicit
"Download" and "Open in new tab" alongside it.

### 25. ❌ Mobile
Never tested at any width (see item 11). The riskiest spots: the long intake
form, the review page's two-column `dl` grid, the PDF iframe, and the
dashboard's row layout with action buttons on the right.

### 26. ❌ Accessibility basics
Worth a pass before real users: visible focus rings on all interactive
elements, `aria-live` on the autosave/generation status so screen readers
announce changes, colour contrast on `--color-text-muted` against
`--color-bg` (currently borderline), and making sure every icon-only control
has a label.

### 27. ❌ Dark mode (optional)
Not required, but the CSS is already fully tokenised in `app/globals.css`,
so it's mostly a matter of adding a `prefers-color-scheme` block and
auditing the hardcoded `bg-white` / `text-green-900` classes scattered
through the review page.

---

## Suggested split (non-overlapping)

**Person A — infrastructure, backend, correctness:** items 1, 2, 3, 4, 8, 9,
10, 13, 14, 15, 16, 17

**Person B (Kenneth) — front-end and design:** items 18–27, plus 5 (Terms/
Privacy pages), 6 (forgot-password UI), 7 (delete-account UI), and 11
(browser/mobile testing — a natural fit while working on the UI anyway)

These two tracks touch almost entirely separate files: Person A lives in
`app/api/`, `lib/`, `supabase/`, and config; Person B lives in `app/page.tsx`,
`app/globals.css`, `components/`, and the page-level `.tsx` files. The one
overlap to coordinate on is `app/login/page.tsx` (item 6's forgot-password
link sits next to Person A's Google button) — agree who owns that file first.

Item 12 belongs to whoever touches the PDF logic first — and is resolved for
free if Person A does item 13.

---

## Fastest path to a realtor actually testing

1. Item 2 (email — or disable confirmation as a stopgap)
2. Item 1 (decide access)
3. Item 11 (click through it yourself once)
4. Item 8 (generate all five forms, open them)
5. Item 5 (ToS/Privacy, if real client data is involved)

Everything else can follow.

**On the front-end work specifically:** none of items 18–27 block a *guided*
test where one of you walks a realtor through it. They start mattering the
moment a realtor lands on the site alone and has to decide whether this looks
like something they'd trust with client paperwork — so the landing page
(18), logo/favicon (19), and typography (20) are the highest-leverage ones,
and they're also the most self-contained work in this whole document. Good
first pieces for Kenneth to own end to end.

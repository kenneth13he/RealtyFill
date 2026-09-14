# Testing Readiness — before we hand this to real realtors

Where things stand: accounts, multi-deal storage, the dashboard, and settings
(Phase 2 of `mvp-build-plan.md`) are built and tested — but tested via direct
API calls against a dev Supabase project, not clicked through in a real
browser, and not deployed anywhere. This is what's left before a real realtor
can actually try it on a real deal.

Split into two tracks that don't touch the same files, so you can both work
at the same time without stepping on each other. Track 1 is
infra/hosting/security config; Track 2 is app pages, legal content, and
schema data. Check the "touches" line under each item if you want to
double-check before starting.

---

## Track 1 — Infrastructure & Security

Goal: a real URL, reachable from outside your machine, that won't quietly
fail or leak data once real people are on it.

### 1. Deploy to a real host
**Why:** everything so far only runs on `localhost`. `lib/pdfFill.ts` shells
out to a local Python script — this rules out Vercel's default serverless
functions (no Python at runtime). Use a host that runs a persistent Node
process instead: Render, Railway, Fly.io, or a small VM.
**Touches:** hosting config only (new files like a `Dockerfile`/`render.yaml`
if the host needs one) — no existing app code.

### 2. Fix the email problem before it blocks real signups
**Why:** Supabase's built-in mailer is rate-limited (we hit it ourselves
during testing last night after just two signups — confirmed the actual
Supabase error: `"email rate limit exceeded"`). A batch of real realtor
signups will hit this immediately.
**Do:** configure a real SMTP provider (Resend, Postmark, SendGrid, etc.) in
the Supabase dashboard's Auth settings.
**Touches:** Supabase dashboard config only, no code.

### 3. Move secrets to the real host's environment
**Why:** `.env.local` values (Supabase keys, `ANTHROPIC_API_KEY`) need to
live in the host's own env var config for production, never committed.
**Do:** also update `NEXT_PUBLIC_SITE_URL` to the real deployed URL (used to
build the email-confirmation link).

### 4. Confirm HTTPS is actually on
Most hosts default to this — verify rather than assume, per the original
plan's Step 17.

### 5. Add basic error monitoring
**Why:** right now, if PDF generation or the extraction call fails for a real
realtor, you won't know unless they happen to tell you.
**Do:** something simple is fine to start — Sentry, or just structured
server-side logs you can actually check on the host.

### 6. Re-run the security check against production
**Why:** cross-user data isolation was verified against a local dev Supabase
project (two test accounts, confirmed neither could read or write the
other's deal). Re-run the same check against the real production database
before any real client data goes in — a config difference between dev/prod
(e.g. RLS accidentally not enabled on a table) wouldn't be caught otherwise.

### 7. Know the rate-limiter's limitation
`lib/rateLimit.ts` is in-memory, per-process — correct for the single-host
deployment above, but resets on every restart/redeploy. Not something to fix,
just something to know if it ever seems to stop working.

---

## Track 2 — Product, Legal & UX for Real Users

Goal: safe and complete enough to responsibly hand to a realtor who's about
to type a real client's information into it.

### 1. Terms of Service + Privacy Policy
**Why:** this app collects real tenant/landlord names, phone numbers, and
addresses — and one of the Schedule documents we tested against even
involves collecting a tenant's SIN. There is currently no Terms of Service or
Privacy Policy page anywhere in the app. Needed before any realtor puts a
real client's info in.
**Touches:** new pages, e.g. `app/terms/page.tsx`, `app/privacy/page.tsx`,
linked from the signup page.

### 2. Forgot-password flow
**Why:** doesn't exist at all right now — `app/login/actions.ts` only has
`signIn`/`signUp`/`signOut`. A realtor who forgets their password has no way
back in except creating a new account.
**Do:** Supabase Auth already supports `resetPasswordForEmail()` — wire it up
plus a page for setting the new password.
**Touches:** `app/login/`, a new page for the reset-password step.

### 3. Account/data deletion
**Why:** the original plan's Step 17 called for a retention/deletion policy,
and realtors will reasonably expect to be able to delete their account and
everything in it.
**Do:** add a "Delete my account" action to Settings.
**Touches:** `app/settings/`, a new API route.

### 4. Known form-field gaps
**Why:** already flagged in `docs/PROJECT_STRUCTURE.md` — Form 410's full
field set isn't fully itemized (only fields with no other source are
listed), Form 400's non-gas/electricity/sewage/condo-fee utility checkboxes
aren't individually exposed, Form 324's alternate representation scenarios
aren't covered. A realtor testing a real deal will plausibly hit one of
these.
**Touches:** `forms/schemas/intake_form_schema.json`,
`components/IntakeFieldsEditor.tsx`.

### 5. Client-side validation
**Why:** a required field can currently be submitted empty — the review page
visually flags missing fields with a red `*`, but nothing stops the actual
"Generate" click.
**Touches:** `components/IntakeFieldsEditor.tsx`.

### 6. Mobile check
**Why:** realtors will very plausibly try this from a phone; the intake and
review pages haven't been checked at narrow widths.

### 7. A feedback channel for testers
**Why:** you need a way for testers to tell you what broke. Even a `mailto:`
link or a Google Form beats nothing.

---

## Either person / non-technical
- Recruit the actual realtor testers.
- Write a short "how to use this" doc for them (the intake → review →
  generate flow, what "Update with more info" does, where to report bugs).

## Explicitly not needed for this round
- Billing/Stripe — deferred by design until there's a paying user.
- A full field-level audit log — status filtering (Active/Closed/Archived)
  on the dashboard already covers "history" for now.

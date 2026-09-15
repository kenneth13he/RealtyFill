// app/page.tsx
// Logged-out landing page. A signed-in visit redirects straight to
// /dashboard — this page is only ever the pitch + sign-in/sign-up entry point.
//
// Visual direction: bold flat brand flood (vivid indigo), very large geometric
// display type, a lime accent, and hard colour inversions between sections
// (brand → white → deep ink) rather than one continuous pale page. The product
// mockup is rendered tonally in-brand instead of as a white screenshot.
//
// Footer links to /terms and /privacy, which landed alongside this redesign
// (REMAINING_WORK.md item 5). They were held back while those pages didn't
// exist — a dead footer link reads worse than a shorter footer.

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import LandingNav from "@/components/landing/LandingNav";
import VisualProof from "@/components/landing/VisualProof";
import Marquee from "@/components/landing/Marquee";
import FadeIn from "@/components/landing/FadeIn";

const STEPS: [string, string, string][] = [
  ["01", "Drop the listing", "Upload a listing PDF or paste the text. Property details fill themselves in."],
  ["02", "Check what we found", "Every field is editable. Anything genuinely unclear gets flagged — never guessed silently."],
  ["03", "Download the set", "Preview and edit each filled PDF right in the browser, then download."],
];

const FORMS: [string, string][] = [
  ["2229E", "Residential Tenancy Agreement (Standard Lease)"],
  ["Form 400", "Agreement to Lease (Residential)"],
  ["Form 410", "Rental Application (Residential)"],
  ["Form 324", "Confirmation of Co-operation and Representation"],
  ["Form 372", "Tenant Designated Representation Agreement"],
];

const TRUST: [string, string][] = [
  ["Your data stays yours", "Row-level security means only you can read your own deals — enforced at the database, not just in the interface."],
  ["Signature fields stay blank", "Every generated PDF leaves signatures untouched. Always. No exceptions."],
  ["Nothing ships unreviewed", "You see and confirm every field before a single PDF gets generated."],
];

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="bg-[var(--brand)]">
      <LandingNav />

      {/* ---------------- HERO ---------------- */}
      <section className="relative overflow-hidden">
        {/* Line-art document, bleeding off the left edge */}
        <svg
          aria-hidden
          viewBox="0 0 420 560"
          className="pointer-events-none absolute -left-24 top-10 hidden h-[560px] w-[420px] text-white/20 lg:block"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <rect x="60" y="40" width="250" height="330" rx="14" />
          <path d="M240 40v56a14 14 0 0 0 14 14h56" />
          <path d="M92 130h120M92 166h150M92 202h150M92 238h96" />
          <rect x="92" y="272" width="110" height="26" rx="6" />
          <circle cx="300" cy="392" r="62" />
          <path d="M272 392l20 20 40-44" strokeWidth="3" />
          <path d="M120 400c-40 30-60 70-52 120M340 150c50 16 72 54 64 104" />
        </svg>

        <div className="relative mx-auto max-w-7xl px-6 pt-10 pb-20 sm:pt-16">
          <div className="lg:pl-[28%]">
            <h1 className="text-[3.25rem] font-semibold leading-[0.95] tracking-tight text-white sm:text-7xl xl:text-8xl">
              Five lease forms.
              <br />
              One intake.
            </h1>

            <div className="mt-5 inline-block border-2 border-dashed border-white/35 px-5 py-2">
              <span className="text-[3.25rem] font-semibold leading-none tracking-tight text-[var(--lime)] sm:text-7xl xl:text-8xl">
                two minutes.
              </span>
            </div>

            <p className="mt-9 max-w-lg text-lg leading-relaxed text-white/70">
              Stop retyping the same tenant, landlord, and rent details into five separate PDFs. Enter it once,
              review it, download the whole set — filled correctly.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/login?mode=signup"
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-[var(--lime)] px-8 py-4 text-base font-semibold text-[var(--brand-deep)] transition-transform hover:-translate-y-0.5"
              >
                Get started free
                <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/30 px-8 py-4 text-base font-semibold text-white transition-colors hover:bg-white/10"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- PRODUCT MOCKUP ---------------- */}
      <section className="mx-auto max-w-7xl px-6 pb-24">
        <FadeIn>
          <VisualProof />
        </FadeIn>
      </section>

      {/* ---------------- STATEMENT + TICKER ---------------- */}
      <section className="px-6 py-28 text-center">
        <FadeIn>
          <h2 className="mx-auto max-w-5xl text-[2.75rem] font-semibold leading-[0.98] tracking-tight text-white sm:text-6xl xl:text-7xl">
            Built so you can get back to <span className="text-[var(--lime)]">closing deals</span>
          </h2>
          <div className="mt-12 flex justify-center">
            <Marquee
              className="max-w-md border border-white/25 text-white/70"
              items={["Keep scrolling", "Five forms", "One intake", "Zero retyping"]}
            />
          </div>
        </FadeIn>
      </section>

      {/* ---------------- HOW IT WORKS (white) ---------------- */}
      <section className="bg-white py-28">
        <div className="mx-auto max-w-7xl px-6">
          <FadeIn>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--brand)]">How it works</p>
            <h2 className="mt-5 max-w-3xl text-[2.5rem] font-semibold leading-[1] tracking-tight text-[var(--brand-deep)] sm:text-6xl">
              Three steps. That&apos;s the whole job.
            </h2>
          </FadeIn>

          <div className="mt-16 grid grid-cols-1 gap-px overflow-hidden rounded-3xl bg-slate-200 md:grid-cols-3">
            {STEPS.map(([n, title, body], i) => (
              <FadeIn key={n} delayMs={i * 120} className="bg-white">
                <div className="h-full bg-white p-8">
                  <span className="text-5xl font-semibold tracking-tight text-[var(--brand)]/25">{n}</span>
                  <h3 className="mt-6 text-2xl font-semibold text-[var(--brand-deep)]">{title}</h3>
                  <p className="mt-3 leading-relaxed text-slate-600">{body}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- FORMS (deep ink) ---------------- */}
      <section className="bg-[var(--brand-deep)] py-28">
        <div className="mx-auto max-w-7xl px-6">
          <FadeIn>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--lime)]">The set</p>
            <h2 className="mt-5 max-w-3xl text-[2.5rem] font-semibold leading-[1] tracking-tight text-white sm:text-6xl">
              Every form a lease needs.
            </h2>
          </FadeIn>

          <div className="mt-14 divide-y divide-white/10 border-y border-white/10">
            {FORMS.map(([code, name], i) => (
              <FadeIn key={code} delayMs={i * 70}>
                <div className="group flex flex-col gap-2 py-7 transition-colors sm:flex-row sm:items-center sm:gap-8">
                  <span className="w-32 shrink-0 text-2xl font-semibold text-[var(--lime)]">{code}</span>
                  <span className="text-lg text-white/70 transition-colors group-hover:text-white">{name}</span>
                  <span
                    aria-hidden
                    className="ml-auto hidden text-white/25 transition-all group-hover:translate-x-1 group-hover:text-[var(--lime)] sm:block"
                  >
                    →
                  </span>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- TRUST (white) ---------------- */}
      <section className="bg-white py-28">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 gap-12 md:grid-cols-3">
            {TRUST.map(([title, body], i) => (
              <FadeIn key={title} delayMs={i * 120}>
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--lime)] text-lg font-bold text-[var(--brand-deep)]" aria-hidden>
                  ✓
                </span>
                <h3 className="mt-6 text-xl font-semibold text-[var(--brand-deep)]">{title}</h3>
                <p className="mt-3 leading-relaxed text-slate-600">{body}</p>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- CLOSING CTA ---------------- */}
      <section className="bg-[var(--brand)] py-32">
        <FadeIn className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-[2.75rem] font-semibold leading-[0.98] tracking-tight text-white sm:text-7xl">
            Stop typing the same deal <span className="text-[var(--lime)]">five times.</span>
          </h2>
          <Link
            href="/login?mode=signup"
            className="group mt-12 inline-flex items-center gap-2 rounded-full bg-[var(--lime)] px-10 py-5 text-lg font-semibold text-[var(--brand-deep)] transition-transform hover:-translate-y-0.5"
          >
            Get started free
            <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
          </Link>
        </FadeIn>
      </section>

      <footer className="bg-[var(--brand-deep)] py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 text-sm text-white/45 sm:flex-row">
          <span className="text-base font-semibold text-white">
            realty<span className="text-[var(--lime)]">fill</span>
          </span>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="transition-colors hover:text-white">
              Terms of Service
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-white">
              Privacy Policy
            </Link>
            <span>© {new Date().getFullYear()} RealtyFill</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

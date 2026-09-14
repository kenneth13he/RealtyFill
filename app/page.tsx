// app/page.tsx
// Home page. Phase 1: single entry point into the intake -> review -> generate
// flow. Phase 2 replaces this with a realtor's deal dashboard (list of their
// deals via Supabase, behind auth) — see docs/PROJECT_STRUCTURE.md.

import Link from "next/link";
import Header from "@/components/Header";

export default function HomePage() {
  return (
    <>
      <Header />
      <main className="mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-[var(--color-text)]">RealtyFill</h1>
        <p className="mt-4 max-w-lg text-lg text-[var(--color-text-muted)]">
          Fill out one deal intake form — optionally pre-filled from a listing PDF — and generate the Ontario lease
          paperwork it feeds. Enter it once, not five times.
        </p>
        <Link
          href="/intake"
          className="mt-8 inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)]"
        >
          Start a new deal
          <span aria-hidden>→</span>
        </Link>

        <dl className="mt-16 grid grid-cols-1 gap-6 text-left sm:grid-cols-2">
          {[
            ["2229E", "Residential Tenancy Agreement (Standard Lease)"],
            ["Form 400", "Agreement to Lease (Residential)"],
            ["Form 410", "Rental Application (Residential)"],
            ["Form 324", "Confirmation of Co-operation and Representation"],
            ["Form 372", "Tenant Designated Representation Agreement"],
          ].map(([name, desc]) => (
            <div key={name} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <dt className="font-semibold text-[var(--color-text)]">{name}</dt>
              <dd className="mt-1 text-sm text-[var(--color-text-muted)]">{desc}</dd>
            </div>
          ))}
        </dl>
      </main>
    </>
  );
}

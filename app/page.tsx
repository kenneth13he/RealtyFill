// app/page.tsx
// Home page. Phase 1: single entry point into the intake -> review -> generate
// flow. Phase 2 replaces this with a realtor's deal dashboard (list of their
// deals via Supabase, behind auth) — see docs/PROJECT_STRUCTURE.md.

import fs from "fs/promises";
import path from "path";
import Link from "next/link";
import Header from "@/components/Header";
import StartNewDealButton from "@/components/StartNewDealButton";

async function hasExistingDeal(): Promise<boolean> {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), "data", "deal.json"), "utf-8");
    return Object.keys(JSON.parse(raw)).length > 0;
  } catch {
    return false;
  }
}

export default async function HomePage() {
  const existingDeal = await hasExistingDeal();
  return (
    <>
      <Header />
      <main className="mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-[var(--color-text)]">RealtyFill</h1>
        <p className="mt-4 max-w-lg text-lg text-[var(--color-text-muted)]">
          Fill out one deal intake form — optionally pre-filled from a listing PDF — and generate the Ontario lease
          paperwork it feeds. Enter it once, not five times.
        </p>
        <div className="mt-8 flex items-center gap-4">
          <StartNewDealButton hasExistingDeal={existingDeal} />
          {existingDeal && (
            <Link href="/review" className="text-sm font-medium text-[var(--color-accent)] hover:underline">
              Continue current deal →
            </Link>
          )}
        </div>

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

// app/page.tsx
// Logged-out landing page. Phase 2: a signed-in visit redirects straight to
// /dashboard (the multi-deal list) — this page is only ever the pitch +
// sign-in/sign-up entry point now, replacing the old single-deal
// "Start a new deal" button that only ever made sense when there was one
// deal, singular, for the whole app.

import { redirect } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect("/dashboard");
  }

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
          <Link
            href="/login?mode=signup"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)]"
          >
            Sign up
            <span aria-hidden>→</span>
          </Link>
          <Link href="/login" className="text-sm font-medium text-[var(--color-accent)] hover:underline">
            Sign in
          </Link>
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

        <footer className="mt-16 border-t border-[var(--color-border)] pt-6 text-sm text-[var(--color-text-muted)]">
          <Link href="/terms" className="hover:underline">
            Terms of Service
          </Link>
          <span className="mx-2">·</span>
          <Link href="/privacy" className="hover:underline">
            Privacy Policy
          </Link>
        </footer>
      </main>
    </>
  );
}

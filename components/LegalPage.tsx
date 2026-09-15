// components/LegalPage.tsx
// Shared shell for the Terms and Privacy pages — same prose styling and
// navigation on both, so they can't drift apart visually.
//
// These are reached straight from the landing footer, so they get the same
// brand chrome (deep-ink bar on top, deep-ink footer below) with the prose
// itself left plain and light. Legal copy is read, not skimmed — the brand
// belongs around it, not in it.

import Link from "next/link";
import Wordmark from "@/components/Wordmark";

export const LEGAL_CONTACT_EMAIL = "[YOUR CONTACT EMAIL]";
export const LEGAL_ENTITY_NAME = "[YOUR LEGAL NAME OR COMPANY]";
export const LEGAL_LAST_UPDATED = "September 14, 2026";

export default function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-[var(--brand-deep)]">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-xl">
            <Wordmark tone="dark" />
          </Link>
          <Link href="/" className="text-sm font-medium text-white/55 transition-colors hover:text-white">
            ← Back
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-text)] sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">Last updated: {LEGAL_LAST_UPDATED}</p>
        <div className="mt-8 flex flex-col gap-6 text-sm leading-relaxed text-[var(--color-text)]">{children}</div>
      </main>

      <footer className="bg-[var(--brand-deep)] py-8">
        <div className="mx-auto flex max-w-2xl flex-col items-center justify-between gap-3 px-6 text-sm text-white/45 sm:flex-row">
          <Wordmark tone="dark" className="text-base" />
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

export function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-[var(--color-text)]">{heading}</h2>
      <div className="mt-2 flex flex-col gap-3 text-[var(--color-text-muted)]">{children}</div>
    </section>
  );
}

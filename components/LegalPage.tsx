// components/LegalPage.tsx
// Shared shell for the Terms and Privacy pages — same prose styling and
// back-link on both, so they can't drift apart visually.

import Link from "next/link";

export const LEGAL_CONTACT_EMAIL = "[YOUR CONTACT EMAIL]";
export const LEGAL_ENTITY_NAME = "[YOUR LEGAL NAME OR COMPANY]";
export const LEGAL_LAST_UPDATED = "September 14, 2026";

export default function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/" className="text-sm font-medium text-[var(--color-accent)] hover:underline">
        ← Back
      </Link>
      <h1 className="mt-6 text-3xl font-bold tracking-tight text-[var(--color-text)]">{title}</h1>
      <p className="mt-2 text-sm text-[var(--color-text-muted)]">Last updated: {LEGAL_LAST_UPDATED}</p>
      <div className="mt-8 flex flex-col gap-6 text-sm leading-relaxed text-[var(--color-text)]">{children}</div>
      <div className="mt-12 border-t border-[var(--color-border)] pt-6 text-sm text-[var(--color-text-muted)]">
        <Link href="/terms" className="hover:underline">
          Terms of Service
        </Link>
        <span className="mx-2">·</span>
        <Link href="/privacy" className="hover:underline">
          Privacy Policy
        </Link>
      </div>
    </main>
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

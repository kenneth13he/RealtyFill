// components/Header.tsx
// Shared top bar across every page — app name + a step indicator showing
// where the realtor is in the Intake → Review → Generate flow for one deal.
// Phase 2: pages live under /deals/[dealId]/..., so the steps need that
// dealId to link anywhere — pass it whenever `active` is set. A "Dashboard"
// link is also shown so there's a way back to the multi-deal list.

import Link from "next/link";

function steps(dealId: string) {
  return [
    { key: "intake", label: "1. Intake", href: `/deals/${dealId}/intake` },
    { key: "review", label: "2. Review & Generate", href: `/deals/${dealId}/review` },
  ] as const;
}

export default function Header({ active, dealId }: { active?: "intake" | "review"; dealId?: string }) {
  return (
    <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-lg font-semibold tracking-tight text-[var(--color-text)]">
            RealtyFill
          </Link>
          {active && dealId && (
            <Link href="/dashboard" className="text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-accent)]">
              ← Dashboard
            </Link>
          )}
        </div>
        {active && dealId && (
          <nav className="flex gap-1 text-sm">
            {steps(dealId).map((step) => (
              <Link
                key={step.key}
                href={step.href}
                className={
                  "rounded-full px-3 py-1 font-medium transition-colors " +
                  (step.key === active
                    ? "bg-[var(--color-accent)] text-white"
                    : "text-[var(--color-text-muted)] hover:bg-[var(--color-accent)]/10")
                }
              >
                {step.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}

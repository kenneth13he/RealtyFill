// components/Header.tsx
// Shared top bar across every page — app name + a step indicator showing
// where the realtor is in the Intake → Review → Generate flow. `active`
// highlights the current step; steps before it don't need to be clickable
// yet since there's only one deal in Phase 1 storage.

import Link from "next/link";

const STEPS = [
  { key: "intake", label: "1. Intake", href: "/intake" },
  { key: "review", label: "2. Review & Generate", href: "/review" },
] as const;

export default function Header({ active }: { active?: "intake" | "review" }) {
  return (
    <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight text-[var(--color-text)]">
          RealtyFill
        </Link>
        {active && (
          <nav className="flex gap-1 text-sm">
            {STEPS.map((step) => (
              <span
                key={step.key}
                className={
                  "rounded-full px-3 py-1 font-medium " +
                  (step.key === active
                    ? "bg-[var(--color-accent)] text-white"
                    : "text-[var(--color-text-muted)]")
                }
              >
                {step.label}
              </span>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}

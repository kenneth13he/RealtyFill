// components/Header.tsx
// Shared top bar across every page — app name + a step indicator showing
// where the realtor is in the Intake → Review → Generate flow for one deal,
// plus Settings/Sign out for a signed-in visitor. Phase 2: pages live under
// /deals/[dealId]/..., so the steps need that dealId to link anywhere — pass
// it whenever `active` is set. Async server component: checks auth itself
// rather than every page threading a `user` prop through just for this.

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";

function steps(dealId: string) {
  return [
    { key: "intake", label: "1. Intake", href: `/deals/${dealId}/intake` },
    { key: "review", label: "2. Review & Generate", href: `/deals/${dealId}/review` },
  ] as const;
}

export default async function Header({ active, dealId }: { active?: "intake" | "review"; dealId?: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
        <div className="flex items-center gap-4">
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
          {user && (
            <div className="flex items-center gap-3 text-sm">
              <Link href="/settings" className="font-medium text-[var(--color-text-muted)] hover:text-[var(--color-accent)]">
                Settings
              </Link>
              <form action={signOut}>
                <button type="submit" className="font-medium text-[var(--color-text-muted)] hover:text-[var(--color-accent)]">
                  Sign out
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

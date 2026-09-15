// components/Header.tsx
// Shared top bar across every signed-in page — app name + a step indicator
// showing where the realtor is in the Intake → Review → Generate flow for one
// deal, plus Settings/Sign out. Phase 2: pages live under /deals/[dealId]/...,
// so the steps need that dealId to link anywhere — pass it whenever `active`
// is set. Async server component: checks auth itself rather than every page
// threading a `user` prop through just for this.
//
// Rendered in deep ink with the lime accent, matching the landing page's nav
// and footer. The page body below stays light for form readability — the bar
// is what carries the brand into the app, so signing in doesn't feel like
// landing on a different product.

import Link from "next/link";
import Wordmark from "@/components/Wordmark";
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
    <header className="bg-[var(--brand-deep)]">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-y-3 px-6 py-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-xl">
            <Wordmark tone="dark" />
          </Link>
          {active && dealId && (
            <Link href="/dashboard" className="text-sm font-medium text-white/55 transition-colors hover:text-white">
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
                      ? "bg-[var(--lime)] text-[var(--brand-deep)]"
                      : "text-white/60 hover:bg-white/10 hover:text-white")
                  }
                >
                  {step.label}
                </Link>
              ))}
            </nav>
          )}
          {user && (
            <div className="flex items-center gap-3 text-sm">
              <Link href="/settings" className="font-medium text-white/60 transition-colors hover:text-white">
                Settings
              </Link>
              <form action={signOut}>
                <button
                  type="submit"
                  className="font-medium text-white/60 transition-colors hover:text-white"
                >
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

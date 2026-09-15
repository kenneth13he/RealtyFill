// app/reset-password/page.tsx
// Step 2 of password recovery — where the emailed link lands after
// /auth/callback has exchanged the recovery code for a session. Not listed
// in proxy.ts's PROTECTED_PREFIXES: the user arriving here is mid-recovery
// and the action itself verifies there's a real session before changing
// anything, so gating the page too would just turn an expired link into a
// confusing redirect instead of a clear message.

import type { Metadata } from "next";
import Link from "next/link";
import { updatePassword } from "@/app/login/actions";

export const metadata: Metadata = {
  title: "Set a new password — RealtyFill",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">Set a new password</h1>
      <p className="mt-1 text-[var(--color-text-muted)]">Enter a new password for your account.</p>

      {error && (
        <p role="alert" className="mt-4 rounded-md border border-[var(--color-error-border)] bg-[var(--color-error-bg)] px-3 py-2 text-sm text-[var(--color-error-text)]">
          {error}
        </p>
      )}

      <form action={updatePassword} className="mt-6 flex flex-col gap-4">
        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-[var(--color-text)]">
            New password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text)] shadow-sm outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20"
          />
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">At least 6 characters.</p>
        </div>
        <button
          type="submit"
          className="mt-2 w-full rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)]"
        >
          Update password
        </button>
      </form>

      <p className="mt-4 text-sm text-[var(--color-text-muted)]">
        <Link href="/login" className="font-medium text-[var(--color-accent)] hover:underline">
          Back to sign in
        </Link>
      </p>
    </main>
  );
}

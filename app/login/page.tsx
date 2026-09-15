// app/login/page.tsx
// Combined sign-in / sign-up page. `mode=signup` in the query string switches
// which Server Action the form posts to; `error` surfaces a failed attempt;
// `redirectTo` (set by proxy.ts when it bounces an unauthenticated visitor
// off a protected page) is threaded through so login lands back where the
// user was headed instead of always dropping them on the dashboard.

import Link from "next/link";
import { signIn, signUp, signInWithGoogle } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; error?: string; message?: string; redirectTo?: string }>;
}) {
  const { mode, error, message, redirectTo } = await searchParams;
  const isSignup = mode === "signup";

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">RealtyFill</h1>
      <p className="mt-1 text-[var(--color-text-muted)]">{isSignup ? "Create an account" : "Sign in"}</p>

      {error && (
        <p role="alert" className="mt-4 rounded-md border border-[var(--color-error-border)] bg-[var(--color-error-bg)] px-3 py-2 text-sm text-[var(--color-error-text)]">
          {error}
        </p>
      )}
      {message && !error && (
        <p role="status" className="mt-4 rounded-md border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5 px-3 py-2 text-sm text-[var(--color-text)]">
          {message}
        </p>
      )}

      {/* Same action for sign-in and sign-up — OAuth creates the account on
          first use, so there's no separate "sign up with Google" path. */}
      <form action={signInWithGoogle} className="mt-6">
        <input type="hidden" name="redirectTo" value={redirectTo ?? "/dashboard"} />
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-[var(--color-border)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-bg)]"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
            <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
          </svg>
          Continue with Google
        </button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-[var(--color-border)]" />
        <span className="text-xs text-[var(--color-text-muted)]">or</span>
        <span className="h-px flex-1 bg-[var(--color-border)]" />
      </div>

      <form action={isSignup ? signUp : signIn} className="flex flex-col gap-4">
        <input type="hidden" name="redirectTo" value={redirectTo ?? "/dashboard"} />
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-[var(--color-text)]">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text)] shadow-sm outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20"
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-[var(--color-text)]">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete={isSignup ? "new-password" : "current-password"}
            className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text)] shadow-sm outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20"
          />
        </div>
        <button
          type="submit"
          className="mt-2 w-full rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)]"
        >
          {isSignup ? "Create account" : "Sign in"}
        </button>
      </form>

      <p className="mt-4 text-sm text-[var(--color-text-muted)]">
        {isSignup ? (
          <>
            Already have an account?{" "}
            <Link href={`/login${redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ""}`} className="font-medium text-[var(--color-accent)] hover:underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            Don&apos;t have an account?{" "}
            <Link href={`/login?mode=signup${redirectTo ? `&redirectTo=${encodeURIComponent(redirectTo)}` : ""}`} className="font-medium text-[var(--color-accent)] hover:underline">
              Sign up
            </Link>
          </>
        )}
      </p>

      <p className="mt-6 text-xs leading-relaxed text-[var(--color-text-muted)]">
        By continuing you agree to our{" "}
        <Link href="/terms" className="underline hover:text-[var(--color-text)]">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline hover:text-[var(--color-text)]">
          Privacy Policy
        </Link>
        .
      </p>
    </main>
  );
}

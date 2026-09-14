// app/login/page.tsx
// Combined sign-in / sign-up page. `mode=signup` in the query string switches
// which Server Action the form posts to; `error` surfaces a failed attempt;
// `redirectTo` (set by proxy.ts when it bounces an unauthenticated visitor
// off a protected page) is threaded through so login lands back where the
// user was headed instead of always dropping them on the dashboard.

import Link from "next/link";
import { signIn, signUp } from "./actions";

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

      <form action={isSignup ? signUp : signIn} className="mt-6 flex flex-col gap-4">
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
    </main>
  );
}

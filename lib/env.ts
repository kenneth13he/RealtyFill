// lib/env.ts
// Fail loudly on a missing environment variable instead of quietly passing
// `undefined` onwards.
//
// Every Supabase client in this app read its config with a `!` non-null
// assertion, which tells TypeScript to stop worrying but does nothing at
// runtime. A missing NEXT_PUBLIC_SUPABASE_ANON_KEY therefore didn't fail at
// startup — it produced a client pointed at `undefined` and surfaced much
// later as an unrelated-looking auth error. (That exact failure already
// happened once during deployment; see REMAINING_WORK.md item 15.)
//
// Note for NEXT_PUBLIC_* names: those are inlined at build time, so a
// missing one is baked into the bundle and this check fires on first use
// rather than at deploy. Still better than a silent `undefined`.

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. ` +
        `Set it in .env.local for local development, or in the hosting platform's environment settings for a deployment.`
    );
  }
  return value;
}

// lib/admin.ts
// Who is allowed to read and answer everyone's support requests.
//
// Configured by the ADMIN_PRINCIPALS environment variable: a comma-separated
// list of email addresses and/or user ids.
//
// NOT NEXT_PUBLIC_. It must never reach the browser bundle — not because the
// list is a secret, but because a value the client can read is a value the
// client can be tempted to trust, and admin checks belong on the server.
//
// ## Why ids are accepted as well as emails
//
// Email confirmation is currently OFF on this project (`mailer_autoconfirm`
// is true, the stopgap for the unconfigured SMTP provider — see
// REMAINING_WORK.md blocker 2). That means anybody can sign up using an
// address they don't own and Supabase will mark it confirmed immediately.
// While that is true, an email entry in this list is only as strong as
// "nobody else signed up with that address first".
//
// A user id can't be claimed that way, so it is the stronger form. Once an
// admin has an account, switch their entry from the address to their id
// (Supabase → Authentication → Users). Turning email confirmation back on
// after SMTP is configured also closes the gap.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AdminPrincipal {
  id?: string;
  email?: string;
}

/** Parses ADMIN_PRINCIPALS. Blank entries are ignored, so a trailing comma is harmless. */
export function adminPrincipals(raw = process.env.ADMIN_PRINCIPALS): AdminPrincipal[] {
  return (raw ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => (UUID.test(entry) ? { id: entry.toLowerCase() } : { email: entry.toLowerCase() }));
}

/**
 * Is this signed-in user an admin?
 *
 * Takes the user object rather than an email so the caller can't accidentally
 * pass a client-supplied string — the only sane source is
 * `supabase.auth.getUser()`, which validates the session against Supabase.
 */
export function isAdminUser(user: { id?: string | null; email?: string | null } | null | undefined): boolean {
  if (!user) return false;
  const id = user.id?.toLowerCase();
  const email = user.email?.toLowerCase();
  return adminPrincipals().some((p) => (p.id && p.id === id) || (p.email && p.email === email));
}

/** True when nobody is configured — used to fail loudly rather than silently locking everyone out. */
export function adminsConfigured(): boolean {
  return adminPrincipals().length > 0;
}

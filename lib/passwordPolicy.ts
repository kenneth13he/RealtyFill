// lib/passwordPolicy.ts
// One password rule for the whole app.
//
// Before this, sign-up enforced nothing (it deferred entirely to Supabase's
// six-character default) and password reset enforced six inline. One password
// is the only thing standing between an attacker and every tenant's name,
// income, employer and rental history across all of a realtor's deals, so six
// characters is too low a bar for this data.
//
// IMPORTANT — this is not the whole control. The Supabase anon key is public
// by design, so a determined caller can invoke Supabase Auth directly and
// bypass anything enforced here. This module governs the app's own forms; the
// authoritative minimum has to be set in the Supabase dashboard
// (Authentication > Policies > Password), along with leaked-password
// protection. Keep the two in sync — this constant is the app-side half.

export const MIN_PASSWORD_LENGTH = 10;

export const PASSWORD_REQUIREMENT = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;

/**
 * @returns null when the password is acceptable, otherwise the message to
 * show the user.
 */
export function checkPassword(password: unknown): string | null {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return PASSWORD_REQUIREMENT;
  }
  return null;
}

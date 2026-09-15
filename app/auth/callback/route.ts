// app/auth/callback/route.ts
// Where Supabase's email-confirmation link points (set via signUp's
// `emailRedirectTo` in app/login/actions.ts). Exchanges the one-time `code`
// for a real session — this is the step that was missing before: signUp()
// alone doesn't establish a session when email confirmation is required
// (confirmed against this project's own Supabase settings, which have
// mailer_autoconfirm off), so without this route a confirmed user would have
// no way to actually get logged in.
//
// `redirectTo` arrives on the query string and is therefore attacker-chosen.
// It used to be concatenated straight onto the origin, which was an open
// redirect: "?redirectTo=@evil.com" produced "https://<host>@evil.com", where
// everything before the "@" is parsed as userinfo and the real host is
// evil.com. It now goes through lib/safeRedirect, which reduces it to an
// in-app path and re-checks the resolved origin. See tests/safeRedirect.test.ts.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sameOriginRedirect } from "@/lib/safeRedirect";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(sameOriginRedirect(origin, searchParams.get("redirectTo")));
    }
  }

  const failed = new URL("/login", origin);
  failed.searchParams.set("error", "That confirmation link is invalid or expired — please sign up again.");
  return NextResponse.redirect(failed);
}

// app/auth/callback/route.ts
// Where Supabase's email-confirmation link points (set via signUp's
// `emailRedirectTo` in app/login/actions.ts). Exchanges the one-time `code`
// for a real session — this is the step that was missing before: signUp()
// alone doesn't establish a session when email confirmation is required
// (confirmed against this project's own Supabase settings, which have
// mailer_autoconfirm off), so without this route a confirmed user would have
// no way to actually get logged in.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirectTo = searchParams.get("redirectTo") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${redirectTo}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("That confirmation link is invalid or expired — please sign up again.")}`
  );
}

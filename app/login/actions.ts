// app/login/actions.ts
// Server Actions backing app/login/page.tsx. Each is reachable via a direct
// POST regardless of the UI (per Next's own Server Function security note),
// but there's nothing here a POST-only caller gains beyond what the form
// itself offers — these just create/verify a Supabase Auth session.

"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rateLimit";

function safeRedirectTarget(raw: FormDataEntryValue | null): string {
  const value = typeof raw === "string" ? raw : "";
  // Only ever redirect within this app — never follow an absolute/external URL.
  return value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

// Best-effort client IP: trusts the first hop's x-forwarded-for, which is
// fine once Step 9 puts a real reverse proxy/host in front of this (it sets
// that header itself) — in local dev without one, everything just shares a
// single "unknown" bucket, which is an acceptable dev-only limitation.
async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function signIn(formData: FormData) {
  const redirectTo = safeRedirectTarget(formData.get("redirectTo"));

  if (!checkRateLimit(`signin:${await clientIp()}`, 10, 5 * 60 * 1000)) {
    redirect(`/login?error=${encodeURIComponent("Too many sign-in attempts — please wait a few minutes and try again.")}&redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}&redirectTo=${encodeURIComponent(redirectTo)}`);
  }
  redirect(redirectTo);
}

export async function signUp(formData: FormData) {
  const redirectTo = safeRedirectTarget(formData.get("redirectTo"));

  if (!checkRateLimit(`signup:${await clientIp()}`, 5, 15 * 60 * 1000)) {
    redirect(`/login?mode=signup&error=${encodeURIComponent("Too many sign-up attempts — please wait a while and try again.")}&redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`,
    },
  });
  if (error) {
    redirect(`/login?mode=signup&error=${encodeURIComponent(error.message)}&redirectTo=${encodeURIComponent(redirectTo)}`);
  }
  // Email confirmation is on for this project (confirmed against its own
  // Auth settings) — signUp succeeding does NOT mean a session exists yet.
  // Without this check, a brand-new account gets redirected straight to a
  // protected page with no real session and immediately bounced back here
  // by proxy.ts, looking like signup silently failed.
  if (!data.session) {
    redirect(`/login?message=${encodeURIComponent("Check your email to confirm your account, then sign in.")}`);
  }
  redirect(redirectTo);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

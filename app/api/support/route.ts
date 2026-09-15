// app/api/support/route.ts
// Lets a signed-in realtor report a problem from inside the app, and read
// back what they've already reported.
//
// Why this exists at all: before it, a user whose generate failed had no way
// to tell anyone, and there was no way to connect "it didn't work this
// morning" to a line in the logs. `error_ref` closes that loop — lib/logger.ts
// stamps every logged error with a short reference, the API routes return it
// to the browser, and the form carries it back here.
//
// Rows are RLS-scoped (support_requests_select_own / _insert_own in
// supabase/migrations/0003), so a user only ever sees their own. Triage is
// done with the service role or in the Supabase dashboard — deliberately no
// update policy, so a submitted report can't be edited after the fact and
// `status` stays yours to set.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { logError, userFacingError } from "@/lib/logger";

// Matches the length checks on the table, so an over-long body is rejected
// here with a readable message instead of as a database constraint error.
const LIMITS = { subject: 200, body: 5000, error_ref: 64, page_url: 500 } as const;

function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("support_requests")
    .select("id, subject, body, status, error_ref, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    const ref = logError({ route: "support-list", userId: user.id }, error);
    return NextResponse.json({ error: userFacingError(ref, "Couldn't load your requests."), ref }, { status: 500 });
  }
  return NextResponse.json({ requests: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Someone hammering this would fill the table and the inbox; 10 an hour is
  // far above any genuine use.
  if (!(await checkRateLimit(`support:${user.id}`, 10, 60 * 60 * 1000))) {
    return NextResponse.json(
      { error: "You've sent several requests recently — please wait a little before sending another." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => ({}));

  const subject = clean(body?.subject, LIMITS.subject);
  const message = clean(body?.body, LIMITS.body);
  if (!subject || !message) {
    return NextResponse.json({ error: "Both a subject and a description are required." }, { status: 400 });
  }

  // A deal id is accepted but never trusted: confirm it's actually theirs
  // before attaching it, so a report can't be used to probe which ids exist.
  let dealId: string | null = null;
  const claimedDealId = clean(body?.dealId, 64);
  if (claimedDealId) {
    const { data: deal } = await supabase.from("deals").select("id").eq("id", claimedDealId).maybeSingle();
    dealId = deal?.id ?? null;
  }

  const { data, error } = await supabase
    .from("support_requests")
    .insert({
      user_id: user.id,
      deal_id: dealId,
      subject,
      body: message,
      error_ref: clean(body?.errorRef, LIMITS.error_ref),
      page_url: clean(body?.pageUrl, LIMITS.page_url),
      // Read from the request, not from client-supplied JSON — it's for
      // reproducing a rendering bug, and a value the page could set itself
      // would be worth nothing.
      user_agent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
    })
    .select("id, created_at")
    .single();

  if (error) {
    const ref = logError({ route: "support-create", userId: user.id }, error);
    return NextResponse.json({ error: userFacingError(ref, "Couldn't send your request."), ref }, { status: 500 });
  }

  return NextResponse.json({ request: data });
}

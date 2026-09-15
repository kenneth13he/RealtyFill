// app/api/health/route.ts
// Liveness check for an uptime monitor (UptimeRobot, Better Stack, Vercel's
// own checks — anything that can poll a URL and alert on a non-200).
//
// Deliberately more than `return "ok"`: a Next.js app can happily serve
// pages while the thing it actually depends on is unreachable, which is the
// outage that matters here. So this makes one trivial round-trip to Postgres
// and reports 503 if that fails. Item 16 in REMAINING_WORK.md — "logging
// exists, alerting doesn't" — is what this is for: nothing here alerts, but
// it gives a monitor something truthful to poll.
//
// Public on purpose (no auth): a monitor has no session. Nothing identifying
// is returned — no counts, no versions, no error text — so it's not a
// reconnaissance surface.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/logger";

// Never cached: a cached 200 would report health long after the database
// stopped answering, which is worse than no check at all.
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();

  try {
    const supabase = createAdminClient();
    // head:true fetches no rows — this is a connectivity probe, not a query.
    const { error } = await supabase.from("deals").select("id", { count: "exact", head: true }).limit(1);
    if (error) throw new Error(error.message);

    return NextResponse.json(
      { status: "ok", database: "ok", latencyMs: Date.now() - startedAt },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    logError({ route: "health" }, err);
    return NextResponse.json(
      { status: "degraded", database: "unreachable", latencyMs: Date.now() - startedAt },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}

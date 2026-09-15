// app/api/health/route.ts
// Liveness probe for an uptime monitor. Deliberately unauthenticated — a
// monitor has no session — and deliberately vague: "ok"/"degraded" plus a
// latency number, never a version, a hostname or an error message.
//
// It is rate limited because it is the one open endpoint that touches the
// database: without a cap, anyone who finds the URL can make us run a
// service-role query as fast as they can send requests. The limit is set far
// above real monitoring (a typical monitor polls every 30-60 seconds, and
// several monitors from several regions still land nowhere near 60/minute
// from one address), so it bounds abuse without ever throttling the thing it
// exists for.
//
// failOpen stays at its default (true): if the limiter itself can't be
// reached, that almost certainly means the database is down, which is exactly
// the moment a health check must still answer rather than return 429.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rateLimit";
import { clientIpFrom } from "@/lib/clientIp";
import { logError } from "@/lib/logger";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function GET(request: Request) {
  if (!(await checkRateLimit(`health:${clientIpFrom(request.headers)}`, 60, 60 * 1000))) {
    return NextResponse.json({ status: "rate_limited" }, { status: 429, headers: NO_STORE });
  }

  const startedAt = Date.now();
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("deals").select("id", { count: "exact", head: true }).limit(1);
    if (error) throw new Error(error.message);
    return NextResponse.json(
      { status: "ok", database: "ok", latencyMs: Date.now() - startedAt },
      { headers: NO_STORE }
    );
  } catch (err) {
    logError({ route: "health" }, err);
    return NextResponse.json(
      { status: "degraded", database: "unreachable", latencyMs: Date.now() - startedAt },
      { status: 503, headers: NO_STORE }
    );
  }
}

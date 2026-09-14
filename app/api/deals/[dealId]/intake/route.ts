// app/api/deals/[dealId]/intake/route.ts
// Persists Deal Intake Form answers for one deal. Phase 2 replacement for
// the old app/api/intake/route.ts, which read/wrote a single local
// data/deal.json — now Postgres, scoped to the deal in the URL.
//
// Uses the request-scoped Supabase client (lib/supabase/server.ts), which
// carries the signed-in user's own session — so every query here is also
// enforced by the deal_intake RLS policy (supabase/migrations/0001_init.sql),
// not just the explicit `user` check below. Two layers deliberately, per the
// plan's Step 10 security pass: don't rely on RLS as the only line of
// defense, and don't rely on the app-level check alone either.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnedDeal } from "@/lib/supabase/getOwnedDeal";

export async function GET(_request: Request, { params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await getOwnedDeal(supabase, dealId))) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }

  const { data, error } = await supabase.from("deal_intake").select("answers").eq("deal_id", dealId).maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data?.answers ?? {});
}

export async function POST(request: Request, { params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  const body = await request.json();
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Expected a JSON object of intake answers" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await getOwnedDeal(supabase, dealId))) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("deal_intake")
    .upsert({ deal_id: dealId, answers: body, updated_at: new Date().toISOString() }, { onConflict: "deal_id" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Best-effort — surfaces "recently touched" ordering on the dashboard.
  // Not critical enough to fail the request if it errors.
  await supabase.from("deals").update({ updated_at: new Date().toISOString() }).eq("id", dealId);

  return NextResponse.json({ ok: true });
}

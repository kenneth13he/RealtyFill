// app/api/deals/route.ts
// List/create deals for the signed-in user (Step 6's dashboard). Creating a
// deal seeds an empty deal_intake row so downstream reads (GET on
// /api/deals/[dealId]/intake) can always assume the row exists rather than
// branching on "not created yet" everywhere.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase.from("deals").select("*").order("updated_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ deals: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const label = typeof body?.label === "string" && body.label.trim() ? body.label.trim() : "Untitled deal";

  const { data: deal, error } = await supabase.from("deals").insert({ user_id: user.id, label }).select().single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Seed brokerage defaults from the user's profile (Settings, Step 7) so a
  // new deal doesn't start from a completely blank slate every time.
  const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
  const seedAnswers: Record<string, string> = {};
  if (profile?.brokerage_name) seedAnswers.listing_brokerage_name = profile.brokerage_name;
  if (profile?.full_name) seedAnswers.listing_brokerage_agent_name = profile.full_name;
  if (profile?.phone) seedAnswers.listing_brokerage_phone = profile.phone;

  const { error: intakeErr } = await supabase.from("deal_intake").insert({ deal_id: deal.id, answers: seedAnswers });
  if (intakeErr) {
    return NextResponse.json({ error: intakeErr.message }, { status: 500 });
  }

  return NextResponse.json({ deal });
}

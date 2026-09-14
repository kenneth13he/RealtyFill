// app/api/deals/[dealId]/route.ts
// Update a single deal's label/status (Step 6 dashboard: close/archive a
// deal, or rename it from its default "Untitled deal").

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnedDeal } from "@/lib/supabase/getOwnedDeal";

const VALID_STATUSES = ["active", "closed", "archived"];

export async function PATCH(request: Request, { params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  const body = await request.json().catch(() => ({}));

  const update: Record<string, string> = {};
  if (typeof body?.label === "string" && body.label.trim()) update.label = body.label.trim();
  if (typeof body?.status === "string") {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` }, { status: 400 });
    }
    update.status = body.status;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update — pass label and/or status" }, { status: 400 });
  }
  update.updated_at = new Date().toISOString();

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

  const { data: deal, error } = await supabase.from("deals").update(update).eq("id", dealId).select().single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ deal });
}

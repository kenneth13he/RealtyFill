// app/api/admin/support/route.ts
// Admin side of the support loop: read everyone's requests, reply, set status.
//
// Every other route in this app is scoped to the caller's own rows by RLS.
// This one deliberately isn't — triage means reading other people's data — so
// the admin check is the only thing standing between a signed-in realtor and
// every other realtor's support history. It is therefore done first, before
// anything is read, and against the session user from supabase.auth.getUser()
// rather than anything the request body claims.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminUser, adminsConfigured } from "@/lib/admin";
import { logError, userFacingError } from "@/lib/logger";

const STATUSES = ["open", "in_progress", "resolved"] as const;
const MAX_REPLY = 5000;

/** @returns the signed-in admin, or a response to return instead. */
async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!adminsConfigured()) {
    // An unset variable must not read as "allow" or as a confusing 404 —
    // it's a deployment mistake and should say so in the logs.
    const ref = logError({ route: "admin-support", userId: user.id }, new Error("ADMIN_PRINCIPALS is not set"));
    return { error: NextResponse.json({ error: userFacingError(ref, "Support admin isn't configured."), ref }, { status: 503 }) };
  }
  if (!isAdminUser(user)) {
    // 404, not 403: a non-admin shouldn't learn that this endpoint exists.
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  return { user };
}

export async function GET() {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;

  // Service role: RLS would otherwise limit this to the admin's own rows,
  // and reading everyone's is the entire purpose of this endpoint.
  const admin = createAdminClient();

  const { data: requests, error } = await admin
    .from("support_requests")
    .select("id, user_id, deal_id, subject, body, status, error_ref, page_url, user_agent, admin_reply, replied_at, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    const ref = logError({ route: "admin-support-list", userId: gate.user.id }, error);
    return NextResponse.json({ error: userFacingError(ref, "Couldn't load support requests."), ref }, { status: 500 });
  }

  // auth.users isn't reachable through PostgREST, so emails and deal labels
  // are fetched separately and joined here rather than in SQL.
  const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emailById = new Map((authUsers?.users ?? []).map((u) => [u.id, u.email ?? ""]));

  const dealIds = [...new Set((requests ?? []).map((r) => r.deal_id).filter(Boolean))] as string[];
  const labelById = new Map<string, string>();
  if (dealIds.length > 0) {
    const { data: deals } = await admin.from("deals").select("id, label").in("id", dealIds);
    for (const d of deals ?? []) labelById.set(d.id, d.label);
  }

  return NextResponse.json({
    requests: (requests ?? []).map((r) => ({
      ...r,
      email: emailById.get(r.user_id) ?? "(deleted account)",
      deal_label: r.deal_id ? (labelById.get(r.deal_id) ?? "(deleted deal)") : null,
    })),
  });
}

export async function PATCH(request: Request) {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;

  const body = await request.json().catch(() => ({}));
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) {
      return NextResponse.json({ error: `status must be one of: ${STATUSES.join(", ")}` }, { status: 400 });
    }
    update.status = body.status;
  }

  if (body.reply !== undefined) {
    const reply = typeof body.reply === "string" ? body.reply.trim() : "";
    if (reply.length > MAX_REPLY) {
      return NextResponse.json({ error: `Reply is too long (max ${MAX_REPLY} characters)` }, { status: 400 });
    }
    // An empty reply clears it rather than storing "", so the user's page can
    // treat "no reply yet" as a single condition.
    update.admin_reply = reply || null;
    update.replied_at = reply ? new Date().toISOString() : null;
    update.replied_by = reply ? gate.user.id : null;
  }

  if (Object.keys(update).length === 1) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("support_requests")
    .update(update)
    .eq("id", id)
    .select("id, status, admin_reply, replied_at")
    .maybeSingle();

  if (error) {
    const ref = logError({ route: "admin-support-reply", userId: gate.user.id, requestId: id }, error);
    return NextResponse.json({ error: userFacingError(ref, "Couldn't save that."), ref }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Support request not found" }, { status: 404 });
  }

  return NextResponse.json({ request: data });
}

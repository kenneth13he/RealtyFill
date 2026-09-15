// app/api/deals/[dealId]/download/[form]/route.ts
// Phase 2 replacement for app/api/download/[form]/route.ts: instead of
// reading data/output/ (unauthenticated local disk), looks up which Storage
// object holds this deal's generated PDF (generated_forms table, itself
// RLS-scoped to the owning user) and redirects to a short-lived signed URL —
// exactly what the original Phase 1 comment said Phase 2 would do.
//
// `?inline=1` (same convention as before) omits the `download` option so the
// PDF renders inside an <iframe> instead of forcing a save-as — see
// app/review/ReviewForm.tsx's preview panel, which relies on the browser's
// own native PDF viewer to let the realtor edit AcroForm fields directly.

import { NextResponse } from "next/server";
import { ALL_FORM_IDS, FORM_LABELS, FormId } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";
import { getOwnedDeal } from "@/lib/supabase/getOwnedDeal";
import { logError, userFacingError } from "@/lib/logger";

export async function GET(request: Request, { params }: { params: Promise<{ dealId: string; form: string }> }) {
  const { dealId, form } = await params;
  if (!ALL_FORM_IDS.includes(form as FormId)) {
    return NextResponse.json({ error: "Unknown form id" }, { status: 400 });
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

  const { data: row, error } = await supabase
    .from("generated_forms")
    .select("storage_path")
    .eq("deal_id", dealId)
    .eq("form_id", form)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "Not generated yet — run Generate first" }, { status: 404 });
  }

  const isInline = new URL(request.url).searchParams.get("inline") === "1";
  const { data: signed, error: signErr } = await supabase.storage
    .from("generated-forms")
    .createSignedUrl(row.storage_path, 60, isInline ? undefined : { download: `${FORM_LABELS[form as FormId].split(" — ")[0]}.pdf` });
  if (signErr || !signed) {
    const ref = logError({ route: "download", userId: user.id, dealId, form }, signErr ?? new Error("createSignedUrl returned no data"));
    return NextResponse.json({ error: userFacingError(ref, "Couldn't prepare that download."), ref }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl);
}

// app/api/deals/[dealId]/generate/route.ts
// Fill pipeline endpoint — turns one deal's reviewed intake answers into
// filled PDFs. Phase 2 replacement for app/api/generate/route.ts: the fill
// pipeline itself (lib/profileMapper.ts, lib/pdfFill.ts) is untouched — only
// where the input comes from and the output goes changed, per the plan
// (Postgres instead of data/deal.json, Supabase Storage instead of
// data/output/, at path {user_id}/{dealId}/{form}.pdf per the bucket's RLS
// policy in supabase/migrations/0001_init.sql).
//
// lib/pdfFill.ts writes to a local file path (it shells out to a Python
// script), so each form is filled to a temp file, read back into memory,
// uploaded to Storage, then the temp file is removed — there's no
// local-disk output that needs to persist between requests.
//
// Hard rule carried over from the project context doc: never write a value
// into any signature field, on any form — enforced inside profileMapper, not
// here, so every caller of the mapper gets this for free.

import { NextResponse } from "next/server";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { FORM_SETS, FormId, formIdsForSet, toFormSetId } from "@/lib/schemas";
import { mapIntakeToFormFields } from "@/lib/profileMapper";
import { fillPdf } from "@/lib/pdfFill";
import { createClient } from "@/lib/supabase/server";
import { getOwnedDeal } from "@/lib/supabase/getOwnedDeal";
import { logError } from "@/lib/logger";

const TEMPLATES_DIR = path.join(process.cwd(), "forms", "blank_templates");

export async function POST(request: Request, { params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  const body = await request.json();
  const selectedForms: FormId[] = Array.isArray(body?.selectedForms) ? body.selectedForms : [];

  if (selectedForms.length === 0) {
    return NextResponse.json({ error: "selectedForms must include at least one form" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const deal = await getOwnedDeal(supabase, dealId);
  if (!deal) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }

  // Validate against this deal's own form set, not the global list of every
  // form the app knows about. A buyer-side form on a lease deal would be
  // mapped from lease intake answers and produce a plausible-looking but
  // wrong legal document, so it's rejected rather than best-efforted.
  const formSet = FORM_SETS[toFormSetId(deal.form_set)];
  if (!formSet.ready) {
    return NextResponse.json(
      { error: `"${formSet.label}" forms aren't ready to fill yet.` },
      { status: 400 }
    );
  }
  const allowed = formIdsForSet(formSet.id);
  const invalid = selectedForms.filter((f) => !allowed.includes(f));
  if (invalid.length > 0) {
    return NextResponse.json(
      { error: `Form(s) not in this deal's set (${formSet.label}): ${invalid.join(", ")}` },
      { status: 400 }
    );
  }

  const { data: intakeRow, error: intakeErr } = await supabase
    .from("deal_intake")
    .select("answers")
    .eq("deal_id", dealId)
    .maybeSingle();
  if (intakeErr) {
    logError({ route: "generate", userId: user.id, dealId }, intakeErr);
    return NextResponse.json({ error: intakeErr.message }, { status: 500 });
  }
  if (!intakeRow) {
    return NextResponse.json({ error: "No intake data found — fill out intake first" }, { status: 400 });
  }
  const intakeAnswers = intakeRow.answers as Record<string, string>;

  const results: { form: FormId; downloadUrl: string }[] = [];
  try {
    for (const formId of selectedForms) {
      const fields = mapIntakeToFormFields(intakeAnswers, formId);
      const blankPath = path.join(TEMPLATES_DIR, formSet.templateDir, `${formId}_blank.pdf`);
      const tmpOutputPath = path.join(os.tmpdir(), `realtyfill_${dealId}_${formId}_${Date.now()}.pdf`);

      await fillPdf(blankPath, fields, tmpOutputPath);
      const pdfBytes = await fs.readFile(tmpOutputPath);
      await fs.unlink(tmpOutputPath).catch(() => {});

      const storagePath = `${user.id}/${dealId}/${formId}.pdf`;
      const { error: uploadErr } = await supabase.storage
        .from("generated-forms")
        .upload(storagePath, pdfBytes, { contentType: "application/pdf", upsert: true });
      if (uploadErr) {
        throw new Error(`Failed to store ${formId}: ${uploadErr.message}`);
      }

      const { error: rowErr } = await supabase
        .from("generated_forms")
        .upsert(
          { deal_id: dealId, form_id: formId, storage_path: storagePath, generated_at: new Date().toISOString() },
          { onConflict: "deal_id,form_id" }
        );
      if (rowErr) {
        throw new Error(`Failed to record ${formId}: ${rowErr.message}`);
      }

      results.push({ form: formId, downloadUrl: `/api/deals/${dealId}/download/${formId}` });
    }
  } catch (err) {
    logError({ route: "generate", userId: user.id, dealId, selectedForms }, err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to generate PDF" }, { status: 500 });
  }

  return NextResponse.json({ results });
}

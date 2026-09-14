// app/api/download/[form]/route.ts
// Serves a generated filled PDF from data/output/. Phase 1 only — Phase 2
// (Step 11/14) replaces this with a signed URL from private object storage,
// scoped to the owning realtor, instead of an unauthenticated local file read.

import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { ALL_FORM_IDS, FORM_LABELS, FormId } from "@/lib/schemas";

const OUTPUT_DIR = path.join(process.cwd(), "data", "output");

export async function GET(_request: Request, { params }: { params: Promise<{ form: string }> }) {
  const { form } = await params;
  if (!ALL_FORM_IDS.includes(form as FormId)) {
    return NextResponse.json({ error: "Unknown form id" }, { status: 400 });
  }

  const filePath = path.join(OUTPUT_DIR, `${form}.pdf`);
  let buffer: Buffer;
  try {
    buffer = await fs.readFile(filePath);
  } catch {
    return NextResponse.json({ error: "Not generated yet — run /review first" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${FORM_LABELS[form as FormId].split(" — ")[0]}.pdf"`,
    },
  });
}

// lib/pdfFill.ts
// Fills one blank PDF template with a field-value list and writes the output
// PDF. This is the "hard part" already proven to work for the 2229E (see
// project-context.md section 5) — reverse-engineered radio-group value
// semantics, verified visually across every page.
//
// Implementation choice made: shells out to scripts/fill_fillable_fields.py
// (Python/pypdf) rather than porting to a JS PDF library. Reasoning: that
// script is already proven correct against real forms; porting risked
// re-introducing bugs (like the multi-page field-clearing bug caught while
// building forms/blank_templates/*_blank.pdf) for no functional gain at this
// stage. Revisit only if Python becomes a real deployment constraint.

import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { FillableField } from "./profileMapper";

const execFileAsync = promisify(execFile);

const SCRIPT_PATH = path.join(process.cwd(), "scripts", "fill_fillable_fields.py");

export async function fillPdf(
  blankTemplatePath: string,
  fields: FillableField[],
  outputPath: string
): Promise<void> {
  const tmpJsonPath = path.join(os.tmpdir(), `field_values_${Date.now()}_${Math.random().toString(36).slice(2)}.json`);
  await fs.writeFile(tmpJsonPath, JSON.stringify(fields, null, 2));

  try {
    await execFileAsync("python3", [SCRIPT_PATH, blankTemplatePath, tmpJsonPath, outputPath]);
  } finally {
    await fs.unlink(tmpJsonPath).catch(() => {});
  }
}

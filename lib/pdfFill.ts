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

// On Windows, "python"/"python3" can resolve to the Microsoft Store's app
// execution alias stub instead of a real interpreter, depending on PATH
// order in whatever shell launched `next dev` — so probe candidates instead
// of assuming one name works.
const PYTHON_CANDIDATES = process.platform === "win32" ? ["python", "py", "python3"] : ["python3", "python"];
let resolvedPythonBin: string | null = null;

async function resolvePythonBin(): Promise<string> {
  if (resolvedPythonBin) return resolvedPythonBin;
  for (const candidate of PYTHON_CANDIDATES) {
    try {
      const { stdout } = await execFileAsync(candidate, ["--version"]);
      if (/^Python \d/.test(stdout.trim())) {
        resolvedPythonBin = candidate;
        return candidate;
      }
    } catch {
      // try next candidate
    }
  }
  throw new Error(
    `No working Python interpreter found on PATH (tried: ${PYTHON_CANDIDATES.join(", ")}). Install Python 3 and ensure it's on PATH.`
  );
}

export async function fillPdf(
  blankTemplatePath: string,
  fields: FillableField[],
  outputPath: string
): Promise<void> {
  const tmpJsonPath = path.join(os.tmpdir(), `field_values_${Date.now()}_${Math.random().toString(36).slice(2)}.json`);
  await fs.writeFile(tmpJsonPath, JSON.stringify(fields, null, 2));

  try {
    const pythonBin = await resolvePythonBin();
    await execFileAsync(pythonBin, [SCRIPT_PATH, blankTemplatePath, tmpJsonPath, outputPath]);
  } catch (err) {
    const stderr = (err as { stderr?: string })?.stderr;
    throw new Error(stderr ? `fill_fillable_fields.py failed: ${stderr}` : String(err));
  } finally {
    await fs.unlink(tmpJsonPath).catch(() => {});
  }
}

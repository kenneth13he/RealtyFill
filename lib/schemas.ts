// lib/schemas.ts
// Server-only: reads and parses the JSON schemas under forms/schemas/.
//   - intake_form_schema.json (drives the /intake UI)
//   - <form>_raw.json x5 (per-form field structure: id, type, page, radio/checkbox values)
//
// Kept server-only (imports Node's `fs`) so it can never end up in a client
// bundle — see lib/formTypes.ts for the client-safe types/constants this file
// re-exports for convenience.

import fs from "fs";
import path from "path";
import { FormId, IntakeFormSchema, RawFieldInfo } from "./formTypes";

export * from "./formTypes";

const SCHEMAS_DIR = path.join(process.cwd(), "forms", "schemas");

function readJson<T>(filename: string): T {
  const raw = fs.readFileSync(path.join(SCHEMAS_DIR, filename), "utf-8");
  return JSON.parse(raw) as T;
}

export function getIntakeFormSchema(): IntakeFormSchema {
  return readJson<IntakeFormSchema>("intake_form_schema.json");
}

// Only forms in a `ready` set have an extracted field schema. The other three
// sets' templates are flat PDFs with no fillable fields, so there is nothing
// to extract yet — hence Partial, and an explicit error rather than a
// confusing ENOENT if something ever routes a pending form here.
const RAW_SCHEMA_FILES: Partial<Record<FormId, string>> = {
  "2229e": "2229e_raw.json",
  form_400: "form_400_raw.json",
  form_410: "form_410_raw.json",
  form_324: "form_324_raw.json",
  form_372: "form_372_raw.json",
};

export function getRawFormSchema(formId: FormId): RawFieldInfo[] {
  const filename = RAW_SCHEMA_FILES[formId];
  if (!filename) {
    throw new Error(
      `No field schema for "${formId}" — its blank template isn't fillable yet. ` +
        `See forms/blank_templates/*/README.md.`
    );
  }
  return readJson<RawFieldInfo[]>(filename);
}

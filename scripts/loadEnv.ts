// scripts/loadEnv.ts
// Reads .env.local into process.env for scripts run directly with tsx.
//
// Next.js loads .env.local itself, so nothing under app/ or lib/ needs this —
// but a standalone script gets no such treatment. Without it
// scripts/extraction_eval.ts failed every case with "Could not resolve
// authentication method", which reads like an expired key rather than an
// unset one.
//
// Existing values win, so `ANTHROPIC_API_KEY=... npx tsx script.ts` still
// overrides the file.

import fs from "fs";
import path from "path";

export function loadEnvLocal(file = path.join(process.cwd(), ".env.local")): void {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match) continue;
    const [, key, raw] = match;
    if (process.env[key] !== undefined) continue;
    // Strip one layer of matching quotes, the way dotenv does.
    process.env[key] = raw.replace(/^(['"])(.*)\1$/, "$2");
  }
}

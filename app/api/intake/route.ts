// app/api/intake/route.ts
// Persists Deal Intake Form answers.
//
// Phase 1 storage: a single local JSON file at data/deal.json (gitignored —
// this is real client/deal data, never committed). Phase 2 (Step 10/12) swaps
// this for the `deal_intake` table in Postgres, scoped to the logged-in
// realtor via row-level security — the request/response shape here is
// designed to carry over unchanged.

import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const DEAL_PATH = path.join(DATA_DIR, "deal.json");

export async function POST(request: Request) {
  const body = await request.json();
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Expected a JSON object of intake answers" }, { status: 400 });
  }

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DEAL_PATH, JSON.stringify(body, null, 2));

  return NextResponse.json({ ok: true });
}

export async function GET() {
  try {
    const raw = await fs.readFile(DEAL_PATH, "utf-8");
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({});
  }
}

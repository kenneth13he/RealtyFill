// app/api/intake/route.ts
// Backend endpoint that persists the Deal Intake Form's answers.
// Phase 1: can just write field_values.json to disk/scratch for the demo.
// Phase 2 (Step 10/12): POST here saves into the `deal_intake` table (Postgres,
// row-level security scoped to the logged-in realtor's own deals).
//
// Input: JSON body matching the shape described by
//   forms/schemas/intake_form_schema.json (one value per intake field "key").
// Output: the created/updated deal_intake record (or, for Phase 1, just ok:true).
//
// Explicitly NOT this file's job: mapping intake answers to per-PDF field IDs
// (lib/profileMapper.ts) or touching any LLM/API key (there is no LLM call in
// this path per the current design — see mvp-build-plan.md's "Design decision"
// note under Phase 1).

export async function POST(request: Request) {
  // TODO Phase 1: validate body against intake_form_schema.json, write to scratch/deal JSON
  // TODO Phase 2: persist to `deal_intake` table via Supabase, scoped to auth'd user
  return new Response(null, { status: 501 });
}

// lib/supabase/getOwnedDeal.ts
// Explicit ownership check, used at the top of every deal-scoped route
// before reading or writing anything else for that deal. RLS (see
// supabase/migrations/0001_init.sql) already blocks a non-owner's write —
// confirmed directly (two real accounts, one tried to overwrite the other's
// deal_intake row, got rejected) — but relying on that alone means a
// rejected write surfaces as a raw Postgres/RLS error message to the client
// ("new row violates row-level security policy...", which leaks internal
// schema detail and isn't a clean UX). Checking ownership first lets every
// route fail the same clean way — 404, as if the deal simply doesn't exist
// for this user — before ever attempting the real operation.

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- avoids depending on generated DB types that don't exist yet
export async function getOwnedDeal(supabase: any, dealId: string): Promise<{ id: string } | null> {
  const { data, error } = await supabase.from("deals").select("id").eq("id", dealId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

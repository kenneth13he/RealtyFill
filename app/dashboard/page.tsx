// app/dashboard/page.tsx
// The multi-deal dashboard (Phase 2 Step 6) — the whole reason Phase 1's
// single data/deal.json couldn't support this: a realtor can now have
// several deals active at once instead of one. Server component fetches the
// signed-in user's deals (RLS-scoped) and hands them to the client-side
// list, which owns create/filter/status-change interactions.

import Header from "@/components/Header";
import { createClient } from "@/lib/supabase/server";
import DealsList, { type Deal } from "./DealsList";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("deals").select("*").order("updated_at", { ascending: false });

  return (
    <>
      <Header width="wide" />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-4xl font-semibold tracking-tight text-[var(--color-text)]">Your deals</h1>
        <p className="mt-2 text-[var(--color-text-muted)]">Create a new deal or pick up where you left off.</p>
        <div className="mt-10">
          <DealsList initialDeals={(data as Deal[]) ?? []} loadError={error?.message ?? null} />
        </div>
      </main>
    </>
  );
}

// app/admin/support/page.tsx
// Support triage. The counterpart to /support, which is what a realtor sees.
//
// Gated twice on purpose: here, so a non-admin never renders the page, and
// again inside /api/admin/support, so nobody reaches the data by calling the
// endpoint directly. proxy.ts doesn't cover /admin (its matcher guards
// /deals, /dashboard, /settings), and even if it did, Next's own docs warn
// against proxy being the only line of defence.
//
// notFound() rather than a "forbidden" page: a signed-in realtor poking at
// /admin/support shouldn't learn that it exists.

import { notFound, redirect } from "next/navigation";
import Header from "@/components/Header";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser, adminsConfigured } from "@/lib/admin";
import AdminSupportList from "./AdminSupportList";

export default async function AdminSupportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirectTo=${encodeURIComponent("/admin/support")}`);
  }
  if (!adminsConfigured() || !isAdminUser(user)) {
    notFound();
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-text)]">Support</h1>
        <p className="mt-1 text-[var(--color-text-muted)]">
          Every request across all accounts. Replies appear on the user&apos;s own support page.
        </p>
        <div className="mt-8">
          <AdminSupportList />
        </div>
      </main>
    </>
  );
}

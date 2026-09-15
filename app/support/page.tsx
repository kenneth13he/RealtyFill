// app/support/page.tsx
// Support inbox for one realtor: report a problem, see what you've reported.
//
// proxy.ts doesn't guard this path (it guards /deals, /dashboard, /settings),
// so auth is checked here and the visitor is sent to /login with a return
// path — the same shape proxy.ts uses, so the experience matches.
//
// ?ref= prefills the error reference, so an error message elsewhere in the
// app can link straight here with it already filled in.

import { redirect } from "next/navigation";
import Header from "@/components/Header";
import { createClient } from "@/lib/supabase/server";
import SupportForm, { type SupportRequest } from "./SupportForm";

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?redirectTo=${encodeURIComponent("/support")}`);
  }

  const params = await searchParams;
  const { data } = await supabase
    .from("support_requests")
    .select("id, subject, body, status, error_ref, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-text)]">Support</h1>
        <p className="mt-1 text-[var(--color-text-muted)]">
          Something not working? Tell us and we&apos;ll look into it.
        </p>
        <div className="mt-8">
          <SupportForm
            initialRequests={(data ?? []) as SupportRequest[]}
            initialErrorRef={firstParam(params.ref).slice(0, 64)}
            initialDealId={firstParam(params.dealId).slice(0, 64)}
          />
        </div>
      </main>
    </>
  );
}

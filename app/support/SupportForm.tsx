// app/support/SupportForm.tsx
// Report a problem, and see what you've already reported.
//
// The error-reference field is the point of this whole screen. When
// something fails, the API now returns a short reference (see lib/logger.ts)
// and the UI shows it; pasting it here is what turns "it didn't work" into a
// single grep through the logs. It's prefilled from ?ref= so an error message
// can link straight here with it already filled in.

"use client";

import { useEffect, useState } from "react";

export interface SupportRequest {
  id: string;
  subject: string;
  body: string;
  status: "open" | "in_progress" | "resolved";
  error_ref: string | null;
  created_at: string;
}

const inputClasses =
  "w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text)] shadow-sm outline-none transition-colors focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20";

const STATUS_LABELS: Record<SupportRequest["status"], string> = {
  open: "Open",
  in_progress: "Being looked at",
  resolved: "Resolved",
};

const STATUS_CLASSES: Record<SupportRequest["status"], string> = {
  open: "bg-amber-100 text-amber-900",
  in_progress: "bg-sky-100 text-sky-900",
  resolved: "bg-emerald-100 text-emerald-900",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function SupportForm({
  initialRequests,
  initialErrorRef,
  initialDealId,
}: {
  initialRequests: SupportRequest[];
  initialErrorRef: string;
  initialDealId: string;
}) {
  const [requests, setRequests] = useState(initialRequests);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [errorRef, setErrorRef] = useState(initialErrorRef);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageUrl, setPageUrl] = useState("");

  // document isn't available during SSR, so read it after mount rather than
  // rendering two different trees.
  useEffect(() => {
    setPageUrl(document.referrer || window.location.href);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    setSent(false);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          body,
          errorRef: errorRef || undefined,
          dealId: initialDealId || undefined,
          pageUrl: pageUrl || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Couldn't send your request.");

      setSent(true);
      setRequests((prev) => [
        {
          id: data?.request?.id ?? crypto.randomUUID(),
          subject,
          body,
          status: "open",
          error_ref: errorRef || null,
          created_at: data?.request?.created_at ?? new Date().toISOString(),
        },
        ...prev,
      ]);
      setSubject("");
      setBody("");
      setErrorRef("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h2 className="text-base font-semibold text-[var(--color-text)]">Report a problem</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Tell us what you were doing and what happened. We can see your account and deals, so you
            don&apos;t need to include any client details.
          </p>

          <div className="mt-4 flex flex-col gap-4">
            <div>
              <label htmlFor="subject" className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                Subject
              </label>
              <input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={200}
                required
                placeholder="Generating forms failed"
                className={inputClasses}
              />
            </div>

            <div>
              <label htmlFor="body" className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                What happened?
              </label>
              <textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={5000}
                required
                rows={6}
                placeholder="I clicked Generate on the review page and got an error after about ten seconds."
                className={inputClasses}
              />
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">{body.length}/5000</p>
            </div>

            <div>
              <label htmlFor="errorRef" className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                Error reference <span className="font-normal text-[var(--color-text-muted)]">(optional)</span>
              </label>
              <input
                id="errorRef"
                value={errorRef}
                onChange={(e) => setErrorRef(e.target.value)}
                maxLength={64}
                placeholder="e.g. 4f2a91c0be"
                className={inputClasses}
              />
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                If you saw an error message with a reference code, paste it here — it takes us straight
                to what went wrong.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        {sent && (
          <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">
            Sent — we&apos;ll take a look. You can see it below.
          </p>
        )}

        <div>
          <button
            type="submit"
            disabled={sending || !subject.trim() || !body.trim()}
            className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send request"}
          </button>
        </div>
      </form>

      <section>
        <h2 className="text-base font-semibold text-[var(--color-text)]">Your requests</h2>
        {requests.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Nothing reported yet.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {requests.map((req) => (
              <li
                key={req.id}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-[var(--color-text)]">{req.subject}</span>
                  <span className={"rounded-full px-2 py-0.5 text-xs font-medium " + STATUS_CLASSES[req.status]}>
                    {STATUS_LABELS[req.status]}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--color-text-muted)]">{req.body}</p>
                <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                  {formatDate(req.created_at)}
                  {req.error_ref && <> · reference {req.error_ref}</>}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

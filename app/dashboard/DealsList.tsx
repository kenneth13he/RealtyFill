// app/dashboard/DealsList.tsx
// Client-side deal list: create a new deal, filter by status, and
// close/reopen/archive one. Status filtering here IS "history" per the
// scope agreed for this plan — a full field-level audit log is explicitly
// out of scope for now.
//
// The form-set picker hides the native radio and paints the tile instead.
// Three reasons it's worth the extra markup: the whole tile becomes the hit
// target, the selected state can be a real border+ring rather than a 13px
// dot, and the "coming soon" sets can be visibly inert without the greyed-out
// native control doing the explaining. The input is still a real focusable
// radio (sr-only, not display:none), so keyboard and screen-reader behaviour
// is unchanged — `has-[:focus-visible]` puts the focus ring on the tile when
// the hidden input inside it takes focus.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Spinner from "@/components/Spinner";
import { DEFAULT_FORM_SET, FORM_SETS, FORM_SET_IDS, FormSetId, toFormSetId } from "@/lib/formTypes";

export interface Deal {
  id: string;
  label: string;
  status: "active" | "closed" | "archived";
  form_set: string;
  created_at: string;
  updated_at: string;
}

const STATUS_FILTERS = ["active", "closed", "archived"] as const;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function DealsList({ initialDeals, loadError }: { initialDeals: Deal[]; loadError: string | null }) {
  const router = useRouter();
  const [deals, setDeals] = useState<Deal[]>(initialDeals);
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]>("active");
  const [newLabel, setNewLabel] = useState("");
  const [newFormSet, setNewFormSet] = useState<FormSetId>(DEFAULT_FORM_SET);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(loadError);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  // Which deal is showing its "are you sure" row, and which is mid-delete.
  // Separate from `updatingId` so a delete in flight can't be confused with a
  // status change in flight — they disable different things.
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Announced to screen readers. Status changes and deletions both mutate the
  // list without moving focus, which is silent without this.
  const [liveStatus, setLiveStatus] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newLabel.trim() || undefined, formSet: newFormSet }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to create deal");
      router.push(`/deals/${body.deal.id}/intake`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setCreating(false);
    }
  }

  async function handleStatusChange(dealId: string, status: Deal["status"]) {
    setUpdatingId(dealId);
    setError(null);
    try {
      const res = await fetch(`/api/deals/${dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to update deal");
      setDeals((prev) => prev.map((d) => (d.id === dealId ? body.deal : d)));
      setLiveStatus(`Deal moved to ${status}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setUpdatingId(null);
    }
  }

  // Permanent, unlike Archive. The route deletes the deal's stored PDFs before
  // the row, so nothing is left orphaned in Storage — see
  // app/api/deals/[dealId]/route.ts for why that order matters.
  async function handleDelete(dealId: string) {
    const label = deals.find((d) => d.id === dealId)?.label ?? "Deal";
    setDeletingId(dealId);
    setError(null);
    try {
      const res = await fetch(`/api/deals/${dealId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to delete deal");
      }
      setDeals((prev) => prev.filter((d) => d.id !== dealId));
      setConfirmingDeleteId(null);
      setLiveStatus(`${label} deleted.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setDeletingId(null);
    }
  }

  const visibleDeals = deals.filter((d) => d.status === filter);

  return (
    <div className="flex flex-col gap-10">
      {/* Deleting a deal or changing its status rewrites the list without
          moving focus — silent to a screen reader without this. Visually
          hidden because the change is already obvious on screen. */}
      <p aria-live="polite" className="sr-only">
        {liveStatus}
      </p>

      {/* ---------------- CREATE ---------------- */}
      <form
        onSubmit={handleCreate}
        className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm"
      >
        <div className="border-b border-[var(--color-border)] bg-[var(--brand-deep)] px-6 py-4">
          <h2 className="text-base font-semibold text-white">Start a new deal</h2>
          <p className="mt-0.5 text-sm text-white/50">
            Pick the forms you need — this can&apos;t be changed later.
          </p>
        </div>

        <div className="p-6">
          <fieldset>
            <legend className="sr-only">Which forms do you need?</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {FORM_SET_IDS.map((setId) => {
                const set = FORM_SETS[setId];
                const isSelected = newFormSet === setId;
                return (
                  <label
                    key={setId}
                    className={
                      "relative block rounded-xl border p-4 transition-all " +
                      "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--color-accent)] has-[:focus-visible]:ring-offset-2 " +
                      (!set.ready
                        ? "cursor-not-allowed border-[var(--color-border)] bg-[var(--color-bg)]"
                        : isSelected
                          ? "cursor-pointer border-[var(--color-accent)] bg-[var(--color-accent)]/[0.04] ring-2 ring-[var(--color-accent)]/25"
                          : "cursor-pointer border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-accent)]/60 hover:bg-[var(--color-accent)]/[0.02]")
                    }
                  >
                    <input
                      type="radio"
                      name="formSet"
                      value={setId}
                      checked={isSelected}
                      disabled={!set.ready}
                      onChange={() => setNewFormSet(setId)}
                      className="sr-only"
                    />

                    {/* Selection dot, pinned top-right so it never sits in the
                        middle of a two-line title. */}
                    <span
                      aria-hidden
                      className={
                        "absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors " +
                        (isSelected
                          ? "border-[var(--color-accent)] bg-[var(--color-accent)]"
                          : "border-[var(--color-border)] bg-transparent")
                      }
                    >
                      {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </span>

                    <div className={"pr-8 " + (set.ready ? "" : "opacity-55")}>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-sm font-semibold text-[var(--color-text)]">{set.label}</span>
                        {!set.ready && (
                          <span className="whitespace-nowrap rounded-full bg-[var(--color-border)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                            Soon
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-text-muted)]">
                        {set.description}
                      </p>
                      <p className="mt-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-accent)]">
                        {set.formIds.length} forms
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-5 flex flex-col gap-3 border-t border-[var(--color-border)] pt-5 sm:flex-row">
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              aria-label="Deal name"
              placeholder="e.g. 203 College St #1706 (optional — you can rename later)"
              className="flex-1 rounded-lg border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--color-text)] outline-none transition-shadow placeholder:text-[var(--color-text-muted)]/70 focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20"
            />
            <button
              type="submit"
              disabled={creating}
              className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[var(--color-accent)] px-6 py-2.5 text-sm font-semibold text-white outline-none transition-colors hover:bg-[var(--color-accent-hover)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {creating && <Spinner />}
              {creating ? "Creating…" : "Create deal"}
            </button>
          </div>
        </div>
      </form>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-[var(--color-error-border)] bg-[var(--color-error-bg)] px-3.5 py-2.5 text-sm text-[var(--color-error-text)]"
        >
          {error}
        </p>
      )}

      {/* ---------------- LIST ---------------- */}
      <div>
        <div className="flex gap-1 border-b border-[var(--color-border)]">
          {STATUS_FILTERS.map((status) => {
            const count = deals.filter((d) => d.status === status).length;
            return (
              <button
                key={status}
                type="button"
                onClick={() => setFilter(status)}
                className={
                  "-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium capitalize outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] " +
                  (filter === status
                    ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                    : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]")
                }
              >
                {status}
                <span
                  className={
                    "rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums " +
                    (filter === status
                      ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                      : "bg-[var(--color-border)] text-[var(--color-text-muted)]")
                  }
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {visibleDeals.length === 0 ? (
          <div className="mt-6 rounded-2xl border-2 border-dashed border-[var(--color-border)] px-6 py-14 text-center">
            <p className="text-sm font-medium text-[var(--color-text)]">No {filter} deals</p>
            <p className="mx-auto mt-1.5 max-w-xs text-sm text-[var(--color-text-muted)]">
              {filter === "active"
                ? "Pick a form set above and create your first deal."
                : `Deals you mark as ${filter} will show up here.`}
            </p>
          </div>
        ) : (
          <ul className="mt-6 flex flex-col gap-2.5">
            {visibleDeals.map((deal) => (
              <li
                key={deal.id}
                className="group flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4 transition-all hover:border-[var(--color-accent)]/50 hover:shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <Link
                  href={`/deals/${deal.id}/review`}
                  className="flex min-w-0 flex-1 items-center gap-4 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
                >
                  {/* Document glyph — gives each row an anchor so a list of
                      similar addresses doesn't read as undifferentiated text. */}
                  <span
                    aria-hidden
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent)]/10 text-[var(--color-accent)] transition-colors group-hover:bg-[var(--color-accent)] group-hover:text-white"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                      <path d="M14 3v5h5" />
                    </svg>
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-[var(--color-text)]">{deal.label}</span>
                    <span className="mt-0.5 block text-xs text-[var(--color-text-muted)]">
                      {FORM_SETS[toFormSetId(deal.form_set)].label} · Updated {formatDate(deal.updated_at)}
                    </span>
                  </span>
                </Link>

                {confirmingDeleteId === deal.id ? (
                  /* Replaces the action buttons rather than sitting beside
                     them, so the only things clickable while confirming are
                     "Delete forever" and "Cancel". */
                  <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs">
                    <span className="font-medium text-[var(--color-error-text)]">Delete permanently?</span>
                    <button
                      type="button"
                      disabled={deletingId === deal.id}
                      onClick={() => handleDelete(deal.id)}
                      className="flex items-center gap-1.5 rounded-lg bg-[var(--color-error-text)] px-3 py-1.5 font-semibold text-white outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--color-error-text)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {deletingId === deal.id && <Spinner className="h-3.5 w-3.5" />}
                      {deletingId === deal.id ? "Deleting…" : "Delete forever"}
                    </button>
                    <button
                      type="button"
                      disabled={deletingId === deal.id}
                      onClick={() => setConfirmingDeleteId(null)}
                      className="rounded-lg px-2 py-1.5 font-medium text-[var(--color-text-muted)] outline-none transition-colors hover:text-[var(--color-text)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] disabled:opacity-40"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs">
                    {deal.status === "active" && (
                      <StatusButton
                        busy={updatingId === deal.id}
                        onClick={() => handleStatusChange(deal.id, "closed")}
                      >
                        Close
                      </StatusButton>
                    )}
                    {deal.status === "closed" && (
                      <>
                        <StatusButton
                          busy={updatingId === deal.id}
                          onClick={() => handleStatusChange(deal.id, "active")}
                        >
                          Reopen
                        </StatusButton>
                        <StatusButton
                          busy={updatingId === deal.id}
                          onClick={() => handleStatusChange(deal.id, "archived")}
                        >
                          Archive
                        </StatusButton>
                      </>
                    )}
                    {deal.status === "archived" && (
                      <StatusButton
                        busy={updatingId === deal.id}
                        onClick={() => handleStatusChange(deal.id, "active")}
                      >
                        Reactivate
                      </StatusButton>
                    )}
                    {/* Archive hides a deal; this erases it, along with every
                        PDF generated from it. A realtor needs the second one to
                        be able to remove a client's information on request. */}
                    <button
                      type="button"
                      disabled={updatingId === deal.id}
                      onClick={() => setConfirmingDeleteId(deal.id)}
                      aria-label={`Delete ${deal.label}`}
                      className="rounded-lg border border-transparent px-3 py-1.5 font-medium text-[var(--color-text-muted)] outline-none transition-colors hover:border-[var(--color-error-border)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error-text)] focus-visible:ring-2 focus-visible:ring-[var(--color-error-text)] focus-visible:ring-offset-2 disabled:opacity-40"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatusButton({
  busy,
  onClick,
  children,
}: {
  busy: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 font-medium text-[var(--color-text-muted)] outline-none transition-colors hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-accent)]/5 hover:text-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

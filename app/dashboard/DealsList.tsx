// app/dashboard/DealsList.tsx
// Client-side deal list: create a new deal, filter by status, and
// close/reopen/archive one. Status filtering here IS "history" per the
// scope agreed for this plan — a full field-level audit log is explicitly
// out of scope for now.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setUpdatingId(null);
    }
  }

  const visibleDeals = deals.filter((d) => d.status === filter);

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleCreate} className="rounded-xl border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/5 p-5">
        <h2 className="text-base font-semibold text-[var(--color-text)]">Start a new deal</h2>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-[var(--color-text)]">Which forms do you need?</legend>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
            This can&apos;t be changed later — each set asks for different information.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {FORM_SET_IDS.map((setId) => {
              const set = FORM_SETS[setId];
              const isSelected = newFormSet === setId;
              return (
                <label
                  key={setId}
                  className={
                    "flex gap-2.5 rounded-lg border p-3 text-left transition-colors " +
                    (!set.ready
                      ? "cursor-not-allowed border-[var(--color-border)] bg-[var(--color-bg)] opacity-60"
                      : isSelected
                        ? "cursor-pointer border-[var(--color-accent)] bg-white ring-2 ring-[var(--color-accent)]/20"
                        : "cursor-pointer border-[var(--color-border)] bg-white hover:border-[var(--color-accent)]/50")
                  }
                >
                  <input
                    type="radio"
                    name="formSet"
                    value={setId}
                    checked={isSelected}
                    disabled={!set.ready}
                    onChange={() => setNewFormSet(setId)}
                    className="mt-0.5 shrink-0 accent-[var(--color-accent)]"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-[var(--color-text)]">
                      {set.label}
                      {!set.ready && (
                        <span className="ml-1.5 rounded bg-[var(--color-border)] px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                          Coming soon
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs text-[var(--color-text-muted)]">{set.description}</span>
                    <span className="mt-1 block text-xs text-[var(--color-text-muted)]">
                      {set.formIds.length} forms
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="e.g. 203 College St #1706 (optional — you can rename later)"
            className="flex-1 rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text)] shadow-sm outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20"
          />
          <button
            type="submit"
            disabled={creating}
            className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {creating ? "Creating…" : "Create deal"}
          </button>
        </div>
      </form>

      {error && (
        <p role="alert" className="rounded-md border border-[var(--color-error-border)] bg-[var(--color-error-bg)] px-3 py-2 text-sm text-[var(--color-error-text)]">
          {error}
        </p>
      )}

      <div className="flex gap-1 border-b border-[var(--color-border)]">
        {STATUS_FILTERS.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setFilter(status)}
            className={
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium capitalize transition-colors " +
              (filter === status
                ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]")
            }
          >
            {status} ({deals.filter((d) => d.status === status).length})
          </button>
        ))}
      </div>

      {visibleDeals.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">No {filter} deals.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visibleDeals.map((deal) => (
            <li
              key={deal.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3"
            >
              <Link href={`/deals/${deal.id}/review`} className="min-w-0 flex-1">
                <p className="truncate font-medium text-[var(--color-text)]">{deal.label}</p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {FORM_SETS[toFormSetId(deal.form_set)].label} · Updated {formatDate(deal.updated_at)}
                </p>
              </Link>
              <div className="flex shrink-0 items-center gap-2 text-xs">
                {deal.status === "active" && (
                  <button
                    type="button"
                    disabled={updatingId === deal.id}
                    onClick={() => handleStatusChange(deal.id, "closed")}
                    className="rounded-md border border-[var(--color-border)] px-2.5 py-1.5 font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] disabled:opacity-40"
                  >
                    Close
                  </button>
                )}
                {deal.status === "closed" && (
                  <>
                    <button
                      type="button"
                      disabled={updatingId === deal.id}
                      onClick={() => handleStatusChange(deal.id, "active")}
                      className="rounded-md border border-[var(--color-border)] px-2.5 py-1.5 font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] disabled:opacity-40"
                    >
                      Reopen
                    </button>
                    <button
                      type="button"
                      disabled={updatingId === deal.id}
                      onClick={() => handleStatusChange(deal.id, "archived")}
                      className="rounded-md border border-[var(--color-border)] px-2.5 py-1.5 font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] disabled:opacity-40"
                    >
                      Archive
                    </button>
                  </>
                )}
                {deal.status === "archived" && (
                  <button
                    type="button"
                    disabled={updatingId === deal.id}
                    onClick={() => handleStatusChange(deal.id, "active")}
                    className="rounded-md border border-[var(--color-border)] px-2.5 py-1.5 font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] disabled:opacity-40"
                  >
                    Reactivate
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

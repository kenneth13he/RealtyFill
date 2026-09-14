// app/settings/SettingsForm.tsx
// Profile + brokerage defaults. Saved values are seeded onto a new deal's
// intake answers when it's created (app/api/deals/route.ts's POST handler)
// so a realtor doesn't retype their own brokerage info on every new deal.

"use client";

import { useState } from "react";

export interface Profile {
  full_name: string;
  phone: string;
  brokerage_name: string;
  brokerage_address: string;
}

const inputClasses =
  "w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text)] shadow-sm outline-none transition-colors focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20";

export default function SettingsForm({ initialProfile }: { initialProfile: Profile }) {
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField(key: keyof Profile, value: string) {
    setProfile((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (!res.ok) throw new Error("Failed to save");
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h2 className="text-base font-semibold text-[var(--color-text)]">Profile</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="full_name" className="mb-1 block text-sm font-medium text-[var(--color-text)]">
              Full name
            </label>
            <input
              id="full_name"
              value={profile.full_name}
              onChange={(e) => setField("full_name", e.target.value)}
              className={inputClasses}
            />
          </div>
          <div>
            <label htmlFor="phone" className="mb-1 block text-sm font-medium text-[var(--color-text)]">
              Phone
            </label>
            <input id="phone" value={profile.phone} onChange={(e) => setField("phone", e.target.value)} className={inputClasses} />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h2 className="text-base font-semibold text-[var(--color-text)]">Brokerage defaults</h2>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Pre-fills the listing brokerage fields on every new deal you create — you can still change them per deal.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="brokerage_name" className="mb-1 block text-sm font-medium text-[var(--color-text)]">
              Brokerage name
            </label>
            <input
              id="brokerage_name"
              value={profile.brokerage_name}
              onChange={(e) => setField("brokerage_name", e.target.value)}
              className={inputClasses}
            />
          </div>
          <div>
            <label htmlFor="brokerage_address" className="mb-1 block text-sm font-medium text-[var(--color-text)]">
              Brokerage address
            </label>
            <input
              id="brokerage_address"
              value={profile.brokerage_address}
              onChange={(e) => setField("brokerage_address", e.target.value)}
              className={inputClasses}
            />
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-md border border-[var(--color-error-border)] bg-[var(--color-error-bg)] px-3 py-2 text-sm text-[var(--color-error-text)]">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {saved && <span className="text-sm text-[var(--color-text-muted)]">Saved.</span>}
      </div>
    </form>
  );
}

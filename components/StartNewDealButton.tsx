// components/StartNewDealButton.tsx
// The home page's "Start a new deal" action. Phase 1 storage is a single
// data/deal.json — there's no per-deal storage yet — so /intake always shows
// whatever's currently saved (needed so "Edit answers" on /review opens with
// the real deal loaded, not blank). That means actually starting a new deal
// has to clear the saved answers first, or it's just "edit the same deal"
// with an extra click. Confirms before wiping if there's something to lose.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function StartNewDealButton({ hasExistingDeal }: { hasExistingDeal: boolean }) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);

  async function handleClick() {
    if (hasExistingDeal) {
      const confirmed = window.confirm(
        "Starting a new deal clears the current deal's saved answers (Phase 1 only keeps one deal at a time). Continue?"
      );
      if (!confirmed) return;
    }
    setStarting(true);
    try {
      await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
    } finally {
      router.push("/intake");
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={starting}
      className="mt-8 inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {starting ? "Starting…" : "Start a new deal"}
      <span aria-hidden>→</span>
    </button>
  );
}

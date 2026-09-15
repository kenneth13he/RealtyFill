// components/landing/LandingNav.tsx
// Marketing nav for the logged-out landing page — distinct from
// components/Header.tsx, which is the in-app nav for signed-in pages (deal
// step indicator, Settings/Sign out) and doesn't fit a pre-signup visitor.
// Sits transparent over the hero's brand flood and only gains a solid
// background once scrolled past it.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Wordmark from "@/components/Wordmark";

export default function LandingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 24);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`sticky top-0 z-50 transition-colors duration-300 ${
        scrolled ? "bg-[var(--brand)]/95 backdrop-blur-xl" : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-2xl">
          <Wordmark tone="dark" />
        </Link>

        <div className="flex items-center gap-8">
          <Link
            href="/login"
            className="hidden items-center gap-1.5 text-sm font-medium text-white/80 transition-colors hover:text-white sm:flex"
          >
            <span aria-hidden className="text-[var(--lime)]">→</span> Sign in
          </Link>
          <Link
            href="/login?mode=signup"
            className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-[var(--brand)] transition-transform hover:-translate-y-0.5"
          >
            Get started
          </Link>
        </div>
      </div>
    </nav>
  );
}

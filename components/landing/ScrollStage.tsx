// components/landing/ScrollStage.tsx
// The scroll-driven hero. A tall outer container with a sticky viewport
// inside: the tower stays pinned while you scroll past it, its floors light
// from the ground up, and the copy beside it advances through three panels.
//
// Why sticky rather than a scroll-jacking library: the page keeps its native
// scroll the whole time. Nothing intercepts the wheel, momentum is untouched,
// and Cmd+F / keyboard scrolling / the scrollbar all behave normally. The only
// thing tied to scroll position is what gets painted.
//
// Below `lg` this collapses to a plain stacked layout (see the second block).
// A pinned scroll story on a phone means a long stretch where dragging appears
// to do nothing, which reads as a broken page rather than as an effect.
//
// Reduced motion: the scroll-linked parts stay — they're a direct response to
// the user's own input, not autoplay — but pointer parallax and the idle drift
// are switched off.

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Tower, { FLOORS, TOWER_PX } from "./Tower";

const FORMS: [string, string][] = [
  ["2229E", "Standard Lease"],
  ["Form 400", "Agreement to Lease"],
  ["Form 410", "Rental Application"],
  ["Form 324", "Co-operation & Representation"],
  ["Form 372", "Tenant Representation"],
];

/** Opacity/offset for a panel that owns the scroll range [start, end]. */
function panelStyle(p: number, start: number, end: number) {
  const fade = 0.07;
  const rising = (p - (start - fade)) / fade;
  const falling = (end + fade - p) / fade;
  const o = Math.max(0, Math.min(1, Math.min(rising, falling)));
  return {
    opacity: o,
    transform: `translateY(${(1 - o) * 18}px)`,
    pointerEvents: (o > 0.5 ? "auto" : "none") as "auto" | "none",
  };
}

export default function ScrollStage() {
  const ref = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0);
  const [mx, setMx] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    let raf = 0;
    function read() {
      const el = ref.current;
      if (!el) return;
      const travel = el.offsetHeight - window.innerHeight;
      const scrolled = -el.getBoundingClientRect().top;
      setP(travel > 0 ? Math.max(0, Math.min(1, scrolled / travel)) : 0);
    }
    function onScroll() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(read);
    }
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // One floor is lit before any scrolling so the tower never reads as "off".
  const lit = 1 + Math.round(p * (FLOORS - 1));

  // Stays off-axis for the whole range. An earlier pass swung -20° → +22°,
  // which put the tower dead face-on at the midpoint — one flat rectangle with
  // no side visible, so it stopped reading as a 3D object exactly where most
  // of the scrolling happens. Never crossing 0 keeps a side wall in view.
  const yaw = -34 + p * 22 + (reduced ? 0 : mx * 8);

  return (
    <>
      {/* ---------------- DESKTOP: pinned scroll story ---------------- */}
      <div ref={ref} className="relative hidden lg:block" style={{ height: "320vh" }}>
        <div
          className="sticky top-0 flex h-screen items-center overflow-hidden"
          onPointerMove={(e) => setMx((e.clientX / window.innerWidth - 0.5) * 2)}
          onPointerLeave={() => setMx(0)}
        >
          <div className="mx-auto grid w-full max-w-7xl grid-cols-2 items-center gap-8 px-6">
            {/* Copy column. Panels are stacked in a grid cell so they
                cross-fade in place instead of shifting the layout. */}
            <div className="grid min-h-[26rem] grid-cols-1 grid-rows-1">
              <div className="col-start-1 row-start-1 self-center transition-none" style={panelStyle(p, 0, 0.3)}>
                <h1 className="text-[3.5rem] font-semibold leading-[0.95] tracking-tight text-white xl:text-7xl">
                  Five lease forms.
                  <br />
                  One intake.
                </h1>
                <div className="mt-5 inline-block border-2 border-dashed border-white/35 px-5 py-2">
                  <span className="text-[3.5rem] font-semibold leading-none tracking-tight text-[var(--lime)] xl:text-7xl">
                    two minutes.
                  </span>
                </div>
                <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Link
                    href="/login?mode=signup"
                    className="group inline-flex items-center justify-center gap-2 rounded-full bg-[var(--lime)] px-8 py-4 text-base font-semibold text-[var(--brand-deep)] transition-transform hover:-translate-y-0.5"
                  >
                    Get started free
                    <span aria-hidden className="transition-transform group-hover:translate-x-1">
                      →
                    </span>
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-white/30 px-8 py-4 text-base font-semibold text-white transition-colors hover:bg-white/10"
                  >
                    Sign in
                  </Link>
                </div>
              </div>

              <div className="col-start-1 row-start-1 self-center" style={panelStyle(p, 0.36, 0.63)}>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--lime)]">Enter it once</p>
                <h2 className="mt-5 text-[3rem] font-semibold leading-[1] tracking-tight text-white xl:text-6xl">
                  Tenant, landlord, rent, term.
                </h2>
                <p className="mt-6 max-w-md text-lg leading-relaxed text-white/70">
                  Drop in the listing PDF and the details fill themselves in. Every field stays editable, and anything
                  genuinely unclear gets flagged — never guessed silently.
                </p>
              </div>

              <div className="col-start-1 row-start-1 self-center" style={panelStyle(p, 0.69, 1.01)}>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--lime)]">The whole set</p>
                <h2 className="mt-5 text-[3rem] font-semibold leading-[1] tracking-tight text-white xl:text-6xl">
                  Filled correctly.
                </h2>
                <ul className="mt-8 space-y-2.5">
                  {FORMS.map(([code, name], i) => {
                    // Each form checks off as its share of the final third of
                    // the scroll goes by, so the list resolves in step with
                    // the building finishing.
                    const done = p > 0.7 + i * 0.055;
                    return (
                      <li key={code} className="flex items-center gap-3.5">
                        <span
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition-all duration-300"
                          style={{
                            background: done ? "var(--lime)" : "rgba(255,255,255,0.09)",
                            color: done ? "var(--brand-deep)" : "rgba(255,255,255,0.3)",
                          }}
                        >
                          ✓
                        </span>
                        <span
                          className="text-base font-semibold transition-colors duration-300"
                          style={{ color: done ? "#fff" : "rgba(255,255,255,0.4)" }}
                        >
                          {code}
                        </span>
                        <span
                          className="text-sm transition-colors duration-300"
                          style={{ color: done ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.22)" }}
                        >
                          {name}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>

            {/* Tower column */}
            <div className="relative">
              <Tower lit={lit} yaw={yaw} style={{ height: TOWER_PX }} />
              <div className="mt-2 text-center text-xs font-medium uppercase tracking-[0.18em] text-white/35">
                {lit} of {FLOORS} floors lit
                {p < 0.95 && " · keep scrolling"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- MOBILE / SMALL: plain stacked ---------------- */}
      <div className="lg:hidden">
        <div className="mx-auto max-w-7xl px-6 pt-8 pb-16">
          <h1 className="text-[3.25rem] font-semibold leading-[0.95] tracking-tight text-white sm:text-7xl">
            Five lease forms.
            <br />
            One intake.
          </h1>
          <div className="mt-5 inline-block border-2 border-dashed border-white/35 px-5 py-2">
            <span className="text-[3.25rem] font-semibold leading-none tracking-tight text-[var(--lime)] sm:text-7xl">
              two minutes.
            </span>
          </div>
          <p className="mt-8 max-w-lg text-lg leading-relaxed text-white/70">
            Stop retyping the same tenant, landlord, and rent details into five separate PDFs. Enter it once, review
            it, download the whole set — filled correctly.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/login?mode=signup"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--lime)] px-8 py-4 text-base font-semibold text-[var(--brand-deep)]"
            >
              Get started free <span aria-hidden>→</span>
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/30 px-8 py-4 text-base font-semibold text-white"
            >
              Sign in
            </Link>
          </div>

          {/* Height is derived from the tower's own rendered size rather than
              guessed — the floors are absolutely positioned and would
              otherwise spill over the section below. */}
          <Tower
            lit={FLOORS}
            yaw={-24}
            scale={0.68}
            className="mt-12"
            style={{ height: TOWER_PX * 0.68 }}
          />
        </div>
      </div>
    </>
  );
}

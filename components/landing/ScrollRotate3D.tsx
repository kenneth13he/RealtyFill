// components/landing/ScrollRotate3D.tsx
// Scroll-driven 3D rotation: the wrapped element starts laid back in space
// (rotateX) and straightens up to flat as it scrolls through the viewport.
// The "it rises to meet you" effect that reads as depth rather than as a
// flat page with a fade on it.
//
// Driven off scroll position rather than a one-shot IntersectionObserver,
// because the whole point is that the angle tracks the scroll continuously.
// rAF-throttled so it doesn't thrash layout on every scroll event, and
// skipped entirely under prefers-reduced-motion (renders flat immediately).

"use client";

import { useEffect, useRef, useState } from "react";

export default function ScrollRotate3D({
  children,
  className,
  startDeg = 22,
  perspective = 1400,
}: {
  children: React.ReactNode;
  className?: string;
  startDeg?: number;
  perspective?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [deg, setDeg] = useState(startDeg);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDeg(0);
      return;
    }

    let frame = 0;
    function update() {
      frame = 0;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      // progress: 0 when the element's top is at the bottom of the viewport,
      // 1 once it has risen to roughly the middle — clamped at both ends.
      const start = window.innerHeight;
      const end = window.innerHeight * 0.45;
      const progress = Math.min(1, Math.max(0, (start - rect.top) / (start - end)));
      setDeg(startDeg * (1 - progress));
    }

    function onScroll() {
      if (!frame) frame = requestAnimationFrame(update);
    }

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [startDeg]);

  return (
    <div style={{ perspective: `${perspective}px` }} className={className}>
      <div
        ref={ref}
        className="will-change-transform"
        style={{ transform: `rotateX(${deg}deg)`, transformStyle: "preserve-3d" }}
      >
        {children}
      </div>
    </div>
  );
}

// components/landing/FadeIn.tsx
// Section reveal: instead of a flat opacity fade, the block rises out of
// depth — starts pushed back and tipped away in 3D (translateZ + rotateX),
// then settles flat as it scrolls into view. Keeps the whole page consistent
// with the spatial/3D treatment on the hero scene.
//
// Plain IntersectionObserver + a CSS transition, no animation library.
// Respects prefers-reduced-motion by rendering visible immediately rather
// than forcing motion on someone who's opted out of it.

"use client";

import { useEffect, useRef, useState } from "react";

export default function FadeIn({
  children,
  className,
  delayMs = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div style={{ perspective: "1200px" }} className={className}>
      <div
        ref={ref}
        className="transition-all duration-[900ms] ease-out will-change-transform"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0) translateZ(0) rotateX(0deg)" : "translateY(28px) translateZ(-80px) rotateX(8deg)",
          transitionDelay: `${delayMs}ms`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

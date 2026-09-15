// components/landing/Tilt3D.tsx
// Mouse-follow 3D tilt — the card leans toward the cursor in real 3D space
// (rotateX/rotateY under a perspective ancestor). One of the signature moves
// in the Dora-style "spatial web" look the landing page is going for.
//
// Pure CSS transforms driven by pointer position, no 3D library: a landing
// page doesn't justify shipping Three.js. Disabled entirely under
// prefers-reduced-motion and on touch devices (no hover to follow, and the
// tilt would just fight with scrolling).

"use client";

import { useRef, useState } from "react";

export default function Tilt3D({
  children,
  className,
  maxTiltDeg = 10,
  scaleOnHover = 1.02,
}: {
  children: React.ReactNode;
  className?: string;
  maxTiltDeg?: number;
  scaleOnHover?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState<string>("");

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "touch") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // -0.5 .. 0.5 relative to the card's own centre
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setTransform(
      `rotateY(${px * maxTiltDeg * 2}deg) rotateX(${-py * maxTiltDeg * 2}deg) scale(${scaleOnHover})`
    );
  }

  function reset() {
    setTransform("");
  }

  return (
    <div
      ref={ref}
      onPointerMove={handlePointerMove}
      onPointerLeave={reset}
      className={`transition-transform duration-300 ease-out will-change-transform ${className ?? ""}`}
      style={{ transform: transform || "rotateX(0deg) rotateY(0deg) scale(1)", transformStyle: "preserve-3d" }}
    >
      {children}
    </div>
  );
}

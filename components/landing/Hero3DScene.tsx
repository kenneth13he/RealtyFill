// components/landing/Hero3DScene.tsx
// The hero's 3D stage: a field of lease documents suspended in space that the
// camera flies through as you scroll, with the whole scene parallaxing toward
// the cursor. Real 3D — every card sits at its own translate3d(x,y,z) inside a
// preserve-3d stage under a shared perspective, so near cards genuinely occlude
// and sweep past far ones rather than being a 2D fake.
//
// CSS 3D rather than WebGL on purpose: this is the only 3D surface in the whole
// product, and it isn't worth a ~200KB Three.js/R3F dependency on the one page
// a realtor sees before they've even signed up. If the scene ever needs real
// lighting/materials, that's the moment to reach for R3F — not before.
//
// Motion is skipped wholesale under prefers-reduced-motion (static, readable
// layout instead), and the whole thing is aria-hidden: it's atmosphere, and a
// screen reader reading out nine decorative "2229E" cards would be noise.

"use client";

import { useEffect, useRef, useState } from "react";

type Doc = { x: number; y: number; z: number; rotY: number; rotX: number; label: string; delay: number };

// Hand-placed rather than random so the composition stays balanced and the
// flight path threads between cards instead of straight through one.
const DOCS: Doc[] = [
  { x: -420, y: -150, z: -220, rotY: 26, rotX: -8, label: "2229E", delay: 0 },
  { x: 380, y: -190, z: -340, rotY: -22, rotX: -6, label: "Form 400", delay: 1.4 },
  { x: -300, y: 170, z: -520, rotY: 18, rotX: 10, label: "Form 410", delay: 2.8 },
  { x: 460, y: 120, z: -180, rotY: -28, rotX: 7, label: "Form 324", delay: 0.7 },
  { x: -520, y: 40, z: -760, rotY: 30, rotX: -4, label: "Form 372", delay: 2.1 },
  { x: 180, y: -260, z: -900, rotY: -16, rotX: -10, label: "2229E", delay: 3.5 },
  { x: -120, y: 250, z: -1050, rotY: 12, rotX: 9, label: "Form 400", delay: 1.9 },
  { x: 560, y: -60, z: -620, rotY: -24, rotX: 3, label: "Form 410", delay: 3.1 },
  { x: -600, y: -230, z: -420, rotY: 22, rotX: -9, label: "Form 324", delay: 2.4 },
];

export default function Hero3DScene() {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [dolly, setDolly] = useState(0);
  const [reduced, setReduced] = useState(false);
  const frame = useRef(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setReduced(true);
      return;
    }

    function onPointer(e: PointerEvent) {
      if (e.pointerType === "touch") return;
      // -0.5..0.5 across the viewport
      const px = e.clientX / window.innerWidth - 0.5;
      const py = e.clientY / window.innerHeight - 0.5;
      setTilt({ x: px, y: py });
    }

    function update() {
      frame.current = 0;
      // Camera pushes forward through the field as the hero scrolls away.
      setDolly(window.scrollY);
    }
    function onScroll() {
      if (!frame.current) frame.current = requestAnimationFrame(update);
    }

    update();
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("scroll", onScroll);
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, []);

  const sceneTransform = reduced
    ? "none"
    : `translateZ(${dolly * 1.15}px) rotateY(${tilt.x * 14}deg) rotateX(${-tilt.y * 10}deg)`;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Perspective floor grid — gives the depth an actual reference plane */}
      <div
        className="absolute inset-x-0 bottom-0 h-[55%] opacity-[0.28]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(125,211,252,0.35) 1px, transparent 1px), linear-gradient(to bottom, rgba(125,211,252,0.35) 1px, transparent 1px)",
          backgroundSize: "70px 70px",
          transform: "perspective(420px) rotateX(70deg)",
          transformOrigin: "bottom center",
          maskImage: "linear-gradient(to top, black 10%, transparent 85%)",
          WebkitMaskImage: "linear-gradient(to top, black 10%, transparent 85%)",
        }}
      />

      {/* Document field */}
      <div className="absolute inset-0" style={{ perspective: "1100px" }}>
        <div
          className="absolute left-1/2 top-1/2 h-0 w-0"
          style={{
            transformStyle: "preserve-3d",
            transform: sceneTransform,
            transition: reduced ? undefined : "transform 220ms cubic-bezier(0.22,1,0.36,1)",
          }}
        >
          {DOCS.map((d, i) => (
            <div
              key={i}
              className={reduced ? "" : "rf-float"}
              style={{
                position: "absolute",
                transformStyle: "preserve-3d",
                transform: `translate3d(${d.x}px, ${d.y}px, ${d.z}px) rotateY(${d.rotY}deg) rotateX(${d.rotX}deg)`,
                animationDelay: `${d.delay}s`,
              }}
            >
              <DocCard label={d.label} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DocCard({ label }: { label: string }) {
  return (
    <div
      className="w-[190px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-sky-300/25 bg-slate-900/70 p-3 backdrop-blur-sm"
      style={{ boxShadow: "0 0 0 1px rgba(56,189,248,0.10), 0 30px 60px -20px rgba(2,6,23,0.9), 0 0 45px -12px rgba(56,189,248,0.45)" }}
    >
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
        <span className="text-[11px] font-semibold tracking-wide text-sky-200/90">{label}</span>
        <span className="ml-auto text-[9px] font-medium text-emerald-300/90">FILLED</span>
      </div>
      <div className="mt-3 space-y-1.5">
        <div className="h-1.5 w-full rounded-full bg-slate-100/20" />
        <div className="h-1.5 w-[85%] rounded-full bg-slate-100/15" />
        <div className="h-1.5 w-[92%] rounded-full bg-slate-100/15" />
        <div className="h-1.5 w-[60%] rounded-full bg-sky-400/40" />
        <div className="h-1.5 w-[78%] rounded-full bg-slate-100/10" />
      </div>
    </div>
  );
}

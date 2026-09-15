// components/landing/Tower.tsx
// The apartment tower that anchors the landing page — a real CSS 3D object
// (perspective + preserve-3d), not an image or a pre-rendered sprite, so it
// responds continuously to scroll and pointer position.
//
// Deliberately NOT WebGL/three.js: this is a marketing page, and a 600KB
// renderer for one building is a bad trade. The whole thing is ~150 divs with
// transforms, which the compositor handles without dropping frames.
//
// Every face is fully opaque. An earlier pass used translucent walls and the
// result read as a glass display case rather than a building — you could see
// the far windows through the near ones. Opaque faces + a darker tone per
// facing direction is what makes it read as solid.
//
// The metaphor: `lit` floors = progress. The building is dark when you land
// and fully lit by the bottom of the scroll, which is the same story the copy
// tells (one intake → every form filled).

const FLOORS = 12;
const FLOOR_H = 38; // px per storey
const WIDTH = 190; // front/back face width
const DEPTH = 130; // side face width
const MAST = 54; // roof mast + beacon, above the top floor
const FRONT_WINDOWS = 4;
const SIDE_WINDOWS = 3;

// Floors are absolutely positioned inside a zero-size origin, so the stack
// contributes no layout height of its own. These two constants are what keep
// it honest: the drawing spans from -(stack + mast + half a floor) up to
// +half a floor, so CENTER_SHIFT slides that span's midpoint onto the origin,
// and TOWER_PX is the box a caller must reserve to hold the result. Getting
// CENTER_SHIFT wrong doesn't clip anything — it silently lets the building
// overlap whatever sits above or below it.
const CENTER_SHIFT = ((FLOORS - 1) * FLOOR_H + MAST) / 2;
/** Height a caller should reserve for the tower at scale 1. Includes slack for
    the perspective/rotateX growth, which pushes the far edges outward. */
export const TOWER_PX = FLOORS * FLOOR_H + MAST + 56;

// One tone per facing direction — the cheapest way to fake directional light,
// and what stops the silhouette from flattening into one indigo blob.
const FACE_FRONT = "#1d1a6b";
const FACE_SIDE = "#141152";
const FACE_BACK = "#100e40";
const FACE_ROOF = "#272377";

function Windows({ count, lit, tone }: { count: number; lit: boolean; tone: "front" | "side" }) {
  return (
    <div className="flex h-full items-center justify-center gap-[7px] px-[10px]">
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="h-[13px] flex-1 rounded-[2px] transition-colors duration-500"
          style={{
            background: lit
              ? tone === "front"
                ? "var(--lime)"
                : "#a8d12f" // side windows sit in shade; same hue, stepped down
              : "rgba(255,255,255,0.07)",
            boxShadow: lit && tone === "front" ? "0 0 12px rgba(201,247,61,0.45)" : "none",
          }}
        />
      ))}
    </div>
  );
}

export default function Tower({
  lit,
  yaw,
  pitch = 9,
  scale = 1,
  className,
  style,
}: {
  /** How many storeys are lit, from the ground up. */
  lit: number;
  /** Rotation about the vertical axis, in degrees. */
  yaw: number;
  pitch?: number;
  /** Uniform 2D scale of the finished render. Applied to the perspective
      element so it can't interfere with the 3D transforms inside. */
  scale?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`flex items-center justify-center ${className ?? ""}`}
      style={{
        ...style,
        perspective: "1400px",
        transform: scale === 1 ? undefined : `scale(${scale})`,
      }}
      aria-hidden
    >
      {/* Shifts the stack so its middle sits at the scene's centre — the floors
          themselves grow upward from the origin. Kept as a separate 2D wrapper
          so it doesn't get swept into the 3D rotation below. */}
      <div style={{ transform: `translateY(${CENTER_SHIFT}px)`, transformStyle: "preserve-3d" }}>
        <div
          className="relative h-0 w-0"
          style={{
            transform: `rotateX(${pitch}deg) rotateY(${yaw}deg)`,
            transformStyle: "preserve-3d",
            willChange: "transform",
          }}
        >
          {Array.from({ length: FLOORS }).map((_, i) => {
            const isLit = i < lit;
            const isTop = i === FLOORS - 1;
            return (
              <div
                key={i}
                className="absolute left-0 top-0"
                style={{
                  transform: `translateY(${-i * FLOOR_H}px)`,
                  transformStyle: "preserve-3d",
                }}
              >
                {/* front */}
                <div
                  className="absolute"
                  style={{
                    left: -WIDTH / 2,
                    top: -FLOOR_H / 2,
                    width: WIDTH,
                    height: FLOOR_H,
                    background: FACE_FRONT,
                    borderTop: "1px solid rgba(255,255,255,0.07)",
                    transform: `translateZ(${DEPTH / 2}px)`,
                  }}
                >
                  <Windows count={FRONT_WINDOWS} lit={isLit} tone="front" />
                </div>

                {/* right */}
                <div
                  className="absolute"
                  style={{
                    left: -DEPTH / 2,
                    top: -FLOOR_H / 2,
                    width: DEPTH,
                    height: FLOOR_H,
                    background: FACE_SIDE,
                    borderTop: "1px solid rgba(255,255,255,0.05)",
                    transform: `rotateY(90deg) translateZ(${WIDTH / 2}px)`,
                  }}
                >
                  <Windows count={SIDE_WINDOWS} lit={isLit} tone="side" />
                </div>

                {/* left */}
                <div
                  className="absolute"
                  style={{
                    left: -DEPTH / 2,
                    top: -FLOOR_H / 2,
                    width: DEPTH,
                    height: FLOOR_H,
                    background: FACE_SIDE,
                    borderTop: "1px solid rgba(255,255,255,0.05)",
                    transform: `rotateY(-90deg) translateZ(${WIDTH / 2}px)`,
                  }}
                >
                  <Windows count={SIDE_WINDOWS} lit={isLit} tone="side" />
                </div>

                {/* back — plain, but present so the silhouette stays solid at
                    any yaw the pointer can reach */}
                <div
                  className="absolute"
                  style={{
                    left: -WIDTH / 2,
                    top: -FLOOR_H / 2,
                    width: WIDTH,
                    height: FLOOR_H,
                    background: FACE_BACK,
                    transform: `translateZ(${-DEPTH / 2}px) rotateY(180deg)`,
                  }}
                />

                {isTop && (
                  <>
                    {/* roof slab */}
                    <div
                      className="absolute"
                      style={{
                        left: -WIDTH / 2,
                        top: -DEPTH / 2,
                        width: WIDTH,
                        height: DEPTH,
                        background: FACE_ROOF,
                        transform: `rotateX(90deg) translateZ(${FLOOR_H / 2}px)`,
                      }}
                    />
                    {/* mast + beacon, so the top reads as a roofline rather
                        than a cut-off stack */}
                    <div
                      className="absolute"
                      style={{
                        left: -1,
                        top: -FLOOR_H / 2 - 46,
                        width: 2,
                        height: 46,
                        background: "rgba(255,255,255,0.28)",
                        transform: `translateZ(0px)`,
                      }}
                    />
                    <div
                      className="absolute rounded-full"
                      style={{
                        left: -4,
                        top: -FLOOR_H / 2 - 54,
                        width: 8,
                        height: 8,
                        background: "var(--lime)",
                        boxShadow: "0 0 16px 3px rgba(201,247,61,0.6)",
                      }}
                    />
                  </>
                )}
              </div>
            );
          })}

          {/* Ground shadow — grounds the tower so it doesn't float. Sits just
              below the base floor, rotated flat. */}
          <div
            className="absolute rounded-[50%]"
            style={{
              left: -WIDTH * 0.75,
              top: -DEPTH * 0.5,
              width: WIDTH * 1.5,
              height: DEPTH,
              background: "radial-gradient(ellipse at center, rgba(0,0,0,0.38), rgba(0,0,0,0) 70%)",
              transform: `translateY(${FLOOR_H / 2}px) rotateX(90deg)`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

export { FLOORS };

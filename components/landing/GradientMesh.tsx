// components/landing/GradientMesh.tsx
// Soft blurred colour blobs behind the hero — the depth/atmosphere layer of
// the Dora-style look. Kept deliberately low-saturation against the light
// background: this app asks realtors to trust it with client paperwork, so
// the aim is "premium and dimensional," not "neon crypto landing page."
//
// Purely decorative, so aria-hidden and pointer-events-none — it must never
// sit in the way of the CTA buttons above it.

export default function GradientMesh() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div
        className="absolute -top-32 left-1/2 h-[42rem] w-[42rem] -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(30,58,95,0.16) 0%, rgba(30,58,95,0) 70%)" }}
      />
      <div
        className="absolute -top-16 right-[8%] h-[30rem] w-[30rem] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(13,148,136,0.14) 0%, rgba(13,148,136,0) 70%)" }}
      />
      <div
        className="absolute top-40 left-[4%] h-[26rem] w-[26rem] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(99,102,241,0.12) 0%, rgba(99,102,241,0) 70%)" }}
      />
    </div>
  );
}

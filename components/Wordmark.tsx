// components/Wordmark.tsx
// The one definition of the logo. It appears in four places (landing nav,
// landing footer, in-app header, auth pages) and was previously re-typed at
// each one, which is how the lowercase/lime treatment ended up inconsistent.
//
// `tone` picks the pair for the background it sits on, not a colour scheme:
//   dark  — white + lime, for brand/deep-ink backgrounds
//   light — deep ink + indigo, because lime on white is unreadable
// Sizing is left to the caller via className, since the nav, footer and app
// header all want different scales from the same mark.

export default function Wordmark({
  tone = "dark",
  className,
}: {
  tone?: "dark" | "light";
  className?: string;
}) {
  const base = tone === "dark" ? "text-white" : "text-[var(--brand-deep)]";
  const accent = tone === "dark" ? "text-[var(--lime)]" : "text-[var(--brand)]";

  return (
    <span className={`font-semibold tracking-tight ${base} ${className ?? ""}`}>
      realty<span className={accent}>fill</span>
    </span>
  );
}

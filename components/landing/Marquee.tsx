// components/landing/Marquee.tsx
// The scrolling ticker pill. Renders the phrase list twice back-to-back and
// slides the pair exactly 50%, so the loop is seamless rather than snapping
// when it restarts. Decorative, so aria-hidden — a screen reader doesn't need
// "KEEP SCROLLING" read to it on repeat.

export default function Marquee({
  items,
  className,
}: {
  items: string[];
  className?: string;
}) {
  const track = [...items, ...items];
  return (
    <div aria-hidden className={`overflow-hidden rounded-full ${className ?? ""}`}>
      <div className="rf-marquee-track flex w-max items-center gap-10 px-6 py-2.5">
        {track.map((item, i) => (
          <span key={i} className="flex shrink-0 items-center gap-10 text-xs font-semibold uppercase tracking-[0.18em]">
            {item}
            <span className="text-[var(--lime)]">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}

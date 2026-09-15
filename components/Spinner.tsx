// components/Spinner.tsx
// The one spinner. Generation takes several seconds (Python fill service plus
// a Storage upload) and until now the only signal was a button label changing
// to "Generating…" — text that's easy to miss and impossible to distinguish
// from a stuck page.
//
// aria-hidden on purpose: this is decoration. The *status* is announced by the
// aria-live region that sits beside it, so a screen reader hears "Generating
// Form 400, 2 of 5" rather than being told a graphic is spinning. Callers must
// provide that text — a spinner alone is not an accessible loading state.
//
// Honours prefers-reduced-motion via the `motion-reduce` variant: the ring
// stops rotating but stays visible, so the affordance survives without the
// movement.

export default function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      className={"h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none " + className}
    >
      {/* Track, then the arc that reads as the moving part. */}
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

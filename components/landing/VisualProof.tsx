// components/landing/VisualProof.tsx
// Large tonal product mockup for the landing page: the intake form on the
// left, the five generated forms on the right. Rendered *in* the brand palette
// (indigo on indigo) rather than as a white screenshot dropped onto colour —
// that's what keeps it feeling like part of the page instead of pasted in.
//
// Built from divs rather than a real screenshot: keeps any real (or
// realistic-looking) client data out of a public marketing asset, and doesn't
// go stale the moment the actual UI changes.

const FIELDS: [string, string][] = [
  ["Tenant", "Alex Taylor"],
  ["Landlord", "Jordan Smith"],
  ["Property", "100 Fake St, Unit 1201"],
  ["Monthly rent", "$2,500.00"],
  ["Term", "1 Year — starts Oct 1"],
];

const FORMS: [string, string][] = [
  ["2229E", "Standard Lease"],
  ["Form 400", "Agreement to Lease"],
  ["Form 410", "Rental Application"],
  ["Form 324", "Co-operation & Representation"],
  ["Form 372", "Tenant Representation"],
];

export default function VisualProof() {
  return (
    <div className="overflow-hidden rounded-[28px] border border-white/15 bg-white/[0.07] p-3 backdrop-blur-sm sm:p-4">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] sm:gap-4">
        {/* Intake side */}
        <div className="rounded-[20px] bg-[color-mix(in_srgb,var(--brand)_55%,black)] p-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/50">Deal intake</span>
            <span className="rounded-full bg-[var(--lime)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--brand-deep)]">
              Once
            </span>
          </div>

          <div className="mt-6 space-y-4">
            {FIELDS.map(([label, value]) => (
              <div key={label}>
                <div className="text-[11px] font-medium uppercase tracking-wider text-white/40">{label}</div>
                <div className="mt-1.5 rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-sm font-medium text-white">
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Output side */}
        <div className="rounded-[20px] bg-[color-mix(in_srgb,var(--brand)_35%,black)] p-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/50">Generated forms</span>
            <span className="text-[11px] font-semibold text-[var(--lime)]">5 / 5 filled</span>
          </div>

          <div className="mt-6 space-y-2.5">
            {FORMS.map(([code, name], i) => (
              <div
                key={code}
                className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3.5"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--lime)] text-xs font-bold text-[var(--brand-deep)]">
                  ✓
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white">{code}</div>
                  <div className="truncate text-xs text-white/45">{name}</div>
                </div>
                {/* Tonal "page content" bars, shortest on the last row so the
                    stack reads as documents rather than repeated list rows. */}
                <div className="ml-auto hidden w-32 shrink-0 space-y-1.5 sm:block" aria-hidden>
                  <div className="h-1 w-full rounded-full bg-white/15" />
                  <div className="h-1 rounded-full bg-white/10" style={{ width: `${88 - i * 9}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

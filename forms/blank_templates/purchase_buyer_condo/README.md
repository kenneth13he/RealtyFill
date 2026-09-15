# Purchase (Buyer) — Condominium Resale

Second form set, received 2026-09-14. **Not wired into the app yet** — parked
here until the remaining sets arrive and the "choose your form set" feature is
built.

| File | OREA form | Purpose |
|---|---|---|
| `form_101_blank.pdf` | 101 (Rev. May 2026) | Agreement of Purchase and Sale — Condominium Resale |
| `form_303_blank.pdf` | 303 (Rev. Feb 2024) | Schedule — Buyer Representation Agreement |
| `form_320_blank.pdf` | 320 (Rev. 2026) | Confirmation of Co-operation and Representation — Buyer/Seller |
| `form_371_blank.pdf` | 371 (Rev. 2026) | Buyer Designated Representation Agreement |
| `form_801_blank.pdf` | 801 (Rev. 2024) | Offer Summary Document |

## ⚠️ These copies are NOT fillable

All five have **zero AcroForm fields** — they're flat PDFs. The lease-set
templates one directory up have 48–121 fields each, which is what the whole
fill pipeline depends on (`lib/pdfFill.ts` → `pypdf`, which writes values into
named fields; it has nothing to write into here).

These are the read-only/preview PDFs OREA publishes publicly. The fillable
versions come from WEBForms / the OREA member portal — the same place the
lease set must have come from. **Re-download these five from there** before any
mapping work starts; replacing the files later is cheap, but mapping against a
flat PDF is impossible.

## Notes for when this gets built

- **320 is the buy-side twin of 324** (already mapped for the lease set) —
  same layout, "Buyer/Seller" instead of "Tenant/Landlord". Likewise **371 is
  the twin of 372**. Expect much of that mapping to transfer, but verify field
  IDs rather than assuming — the lease and purchase variants are separate
  documents and OREA doesn't guarantee matching internal names.
- **101 is the big one** (6 pages) and is the purchase analogue of 400.
- 303 and 801 are short and mostly party names + dates.

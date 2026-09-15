# Sale (Seller / Listing side) — Condo

Third form set, received 2026-09-14. **Not wired into the app yet** — parked
here until the remaining sets arrive and the "choose your form set" feature is
built.

| File | Form | Purpose |
|---|---|---|
| `form_203_blank.pdf` | OREA 203 (Rev. 2023) | Schedule — Listing Agreement, Authority to Offer for Sale |
| `form_244_blank.pdf` | OREA 244 (Rev. 2026) | Seller's Direction re: Property/Offers |
| `form_271_blank.pdf` | OREA 271 (Rev. 2026) | Listing Agreement — Seller Designated Representation |
| `form_291_blank.pdf` | **PropTx** 291 (Rev. 11/2025) | MLS® Data Information Form — Condo/Co-op/Co-Ownership/Time Share, Sale |

## ⚠️ Same problem as the purchase set: not fillable

Zero AcroForm fields on all four. Re-download the fillable versions from
WEBForms / the member portal before any mapping work — see
`../purchase_buyer_condo/README.md` for the full explanation.

Note 291 is a **PropTx** form, not OREA, so it may come from a different
source than the other three.

## Notes for when this gets built

- **Seller-side twins of forms already mapped:** 271 ↔ 372/371 (designated
  representation), 203 ↔ 303 (schedule). Verify field IDs rather than
  assuming they match.
- **291 is the outlier and by far the biggest job.** 13 pages of MLS data
  entry — hundreds of checkboxes with max-select rules ("Max 6", "Check 1"),
  conditional mandatory fields, and a 99-row room table. It's a data-entry
  form for the MLS system, not an agreement between parties, so almost none
  of its content overlaps the intake schema the other forms share. Treat it
  as its own scoping question — possibly out of scope for v1 — rather than
  "one more form in the set."
- 244 is short: property/seller/brokerage identity, MLS numbers, an
  offer-conveyance date/time, and two free-text direction lines.

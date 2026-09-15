# Lease (Landlord / Listing side) — Condo

Fourth form set, received 2026-09-14. Registered in the app's form-set list
but **not generatable yet** — see below.

| File | Form | Purpose |
|---|---|---|
| `form_272_blank.pdf` | OREA 272 (Rev. 2026) | Listing Agreement — Landlord Designated Representation, Authority to Offer for Lease |
| `form_292_blank.pdf` | **PropTx** 292 (Rev. 11/2025) | MLS® Data Information Form — Condo/Co-op/Co-Ownership/Time Share, Lease/Sub-Lease |
| `form_401_blank.pdf` | OREA 401 (Rev. 2023) | Schedule — Agreement to Lease, Residential |

## ⚠️ Not fillable

Zero AcroForm fields on all three, same as the other two pending sets. Needs
fillable versions from WEBForms / the member portal before mapping. See
`../purchase_buyer_condo/README.md` for the full explanation.

## Notes for when this gets built

- **272 is the landlord-side mirror of 372** (tenant designated
  representation), which is already mapped for the live lease set — the same
  brokerage / party / commission / listing-period shape with "Landlord" in
  place of "Tenant". Verify field IDs rather than assuming.
- **401 is the schedule to Form 400**, already in the live set. Its four
  fields (tenant, landlord, property, date) all exist in the intake schema
  today, so this is the cheapest of the twelve pending forms to wire up.
- **292 is the lease twin of 291** and carries the same warning: 13 pages of
  MLS data entry, hundreds of checkboxes, a 99-row room table, and almost no
  overlap with the intake schema. It does have a handful of lease-specific
  fields the other forms share (lease price, lease term, payment frequency
  and method, deposit/credit-check/employment-letter flags), but those are a
  small fraction of the form.

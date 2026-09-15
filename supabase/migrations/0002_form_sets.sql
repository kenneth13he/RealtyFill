-- 0002_form_sets.sql
-- A deal is for one kind of transaction, and each kind needs a different
-- bundle of OREA/PropTx forms. Record which set a deal belongs to so the
-- review page offers the right forms and the generate endpoint can reject
-- anything outside that set.
--
-- Default is 'lease_tenant' because that is the only set that existed before
-- this migration — every pre-existing deal is one of those, and the default
-- keeps them valid without a backfill. It must stay in sync with
-- DEFAULT_FORM_SET in lib/formTypes.ts.
--
-- The set is fixed at creation: the forms (and eventually the intake
-- questions) differ enough between sets that switching mid-deal would mean
-- silently discarding answers. Nothing in the app issues an UPDATE on this
-- column; there is deliberately no UI for changing it.

alter table public.deals
  add column form_set text not null default 'lease_tenant'
  check (form_set in ('lease_tenant', 'lease_landlord', 'sale_buyer', 'sale_seller'));

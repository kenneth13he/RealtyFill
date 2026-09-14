-- 0001_init.sql
-- Phase 2 schema: accounts + multi-deal storage, replacing the single local
-- data/deal.json file. See ~/.claude/plans/stateful-stargazing-abelson.md
-- for the full plan this implements.

create extension if not exists pgcrypto;

-- One row per deal a realtor is working. `label` is just a human-friendly
-- name for the dashboard list (e.g. the property address) — the real data
-- lives in deal_intake.
create table public.deals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'Untitled deal',
  status text not null default 'active' check (status in ('active', 'closed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The intake answers blob — same Record<string,string> shape the app
-- already uses everywhere (lib/formTypes.ts, IntakeFieldsEditor.tsx, etc.),
-- just stored in Postgres instead of data/deal.json.
create table public.deal_intake (
  deal_id uuid primary key references public.deals(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Tracks which forms have been generated for a deal and where the PDF lives
-- in Storage, so the review page can show "already generated" status
-- without listing the bucket every time.
create table public.generated_forms (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  form_id text not null,
  storage_path text not null,
  generated_at timestamptz not null default now(),
  unique (deal_id, form_id)
);

-- One row per user: profile + brokerage defaults, reused when creating a
-- new deal (Settings page, Step 7 of the plan).
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  brokerage_name text,
  brokerage_address text,
  updated_at timestamptz not null default now()
);

alter table public.deals enable row level security;
alter table public.deal_intake enable row level security;
alter table public.generated_forms enable row level security;
alter table public.profiles enable row level security;

create policy "deals_owner" on public.deals
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "deal_intake_owner" on public.deal_intake
  for all
  using (exists (select 1 from public.deals d where d.id = deal_intake.deal_id and d.user_id = auth.uid()))
  with check (exists (select 1 from public.deals d where d.id = deal_intake.deal_id and d.user_id = auth.uid()));

create policy "generated_forms_owner" on public.generated_forms
  for all
  using (exists (select 1 from public.deals d where d.id = generated_forms.deal_id and d.user_id = auth.uid()))
  with check (exists (select 1 from public.deals d where d.id = generated_forms.deal_id and d.user_id = auth.uid()));

create policy "profiles_owner" on public.profiles
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Private bucket for generated PDFs (Step 4/5). Objects are keyed
-- {user_id}/{deal_id}/{form_id}.pdf; the policies below let a user manage
-- only objects under their own user_id prefix.
insert into storage.buckets (id, name, public)
values ('generated-forms', 'generated-forms', false)
on conflict (id) do nothing;

create policy "generated_forms_bucket_owner_select" on storage.objects
  for select
  using (bucket_id = 'generated-forms' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "generated_forms_bucket_owner_insert" on storage.objects
  for insert
  with check (bucket_id = 'generated-forms' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "generated_forms_bucket_owner_update" on storage.objects
  for update
  using (bucket_id = 'generated-forms' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "generated_forms_bucket_owner_delete" on storage.objects
  for delete
  using (bucket_id = 'generated-forms' and (storage.foldername(name))[1] = auth.uid()::text);

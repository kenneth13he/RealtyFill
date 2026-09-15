-- 0003_rate_limits_support_hardening.sql
--
-- Three things that only start mattering once more than one person uses the
-- site at a time:
--   1. Rate limiting that actually works on serverless.
--   2. A support inbox, so a realtor who hits a problem can report it from
--      inside the app instead of the problem being invisible.
--   3. Indexes and storage constraints the free-tier dataset didn't need.

-- ---------------------------------------------------------------------------
-- 1. Shared rate limiting
--
-- lib/rateLimit.ts kept its counters in a per-process in-memory Map, with a
-- comment justifying that by the deployment plan's commitment to "a single
-- persistent Node process (not serverless/multi-instance)". The app is
-- deployed on Vercel, which is exactly serverless and multi-instance, so
-- every limit was silently being multiplied by however many function
-- instances happened to be warm. That weakens login brute-force protection
-- and, more expensively, the cap on /api/extract-listing — the only endpoint
-- that spends money per call against ANTHROPIC_API_KEY.
--
-- Counters live here instead so every instance shares one.
-- ---------------------------------------------------------------------------

create table public.rate_limits (
  key text primary key,
  count integer not null default 0,
  reset_at timestamptz not null
);

-- No RLS policies are defined on purpose: RLS is enabled and no policy grants
-- access, so no end-user role can read or write this table. Only the service
-- role (which bypasses RLS) reaches it, via the function below.
alter table public.rate_limits enable row level security;

-- Supabase grants table privileges to anon/authenticated by default, so RLS
-- would be the only thing stopping a read. Belt and braces — take the grant
-- away too, and a future policy added by mistake still won't expose it.
revoke all on table public.rate_limits from anon, authenticated;

-- One statement, so concurrent requests can't both read "count = 4" and each
-- decide they're under a limit of 5. The upsert is the lock.
create or replace function public.check_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := now();
  v_count integer;
begin
  insert into public.rate_limits as rl (key, count, reset_at)
  values (p_key, 1, v_now + make_interval(secs => p_window_seconds))
  on conflict (key) do update
    set count = case when rl.reset_at <= v_now then 1 else rl.count + 1 end,
        reset_at = case when rl.reset_at <= v_now
                        then v_now + make_interval(secs => p_window_seconds)
                        else rl.reset_at end
  returning rl.count into v_count;

  return v_count <= p_limit;
end;
$$;

-- security definer means this runs as its owner, so it must not be callable
-- by anyone who could use it to probe or grief the table.
revoke all on function public.check_rate_limit(text, integer, integer) from public;
revoke all on function public.check_rate_limit(text, integer, integer) from anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;

-- Expired rows are dead weight; nothing reads them. Called opportunistically
-- rather than scheduled, so this needs no pg_cron (unavailable on free tier).
create or replace function public.prune_rate_limits()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted integer;
begin
  delete from public.rate_limits where reset_at <= now() - interval '1 hour';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.prune_rate_limits() from public;
revoke all on function public.prune_rate_limits() from anon, authenticated;
grant execute on function public.prune_rate_limits() to service_role;

create index rate_limits_reset_at_idx on public.rate_limits (reset_at);

-- ---------------------------------------------------------------------------
-- 2. Support requests
--
-- Without this, a realtor whose generate silently fails has no way to tell
-- anyone, and you have no way to connect their complaint to the error in the
-- logs. `error_ref` is the link: lib/logger.ts now stamps every logged error
-- with a short id and the API returns it to the browser, so the user can
-- quote it and you can grep for it.
-- ---------------------------------------------------------------------------

create table public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Kept if the deal is deleted: the report is still worth reading, and
  -- losing it would hide exactly the bugs that cause people to delete things.
  deal_id uuid references public.deals(id) on delete set null,
  subject text not null check (length(trim(subject)) between 1 and 200),
  body text not null check (length(trim(body)) between 1 and 5000),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  error_ref text check (error_ref is null or length(error_ref) <= 64),
  page_url text check (page_url is null or length(page_url) <= 500),
  user_agent text check (user_agent is null or length(user_agent) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.support_requests enable row level security;

-- A user may file a request and read their own. Deliberately no update or
-- delete policy: a submitted report shouldn't be editable after the fact,
-- and `status` is yours to set, not theirs. You read and triage these with
-- the service role (or in the Supabase dashboard).
create policy "support_requests_insert_own" on public.support_requests
  for insert
  with check (auth.uid() = user_id);

create policy "support_requests_select_own" on public.support_requests
  for select
  using (auth.uid() = user_id);

create index support_requests_user_id_created_at_idx
  on public.support_requests (user_id, created_at desc);
create index support_requests_status_created_at_idx
  on public.support_requests (status, created_at desc);

-- ---------------------------------------------------------------------------
-- 3. Indexes and storage constraints
-- ---------------------------------------------------------------------------

-- The dashboard's main query is `where user_id = ... order by updated_at`.
-- With 9 rows a sequential scan is free; with a hundred realtors' deals it
-- isn't, and adding the index later means doing it under load.
create index deals_user_id_updated_at_idx on public.deals (user_id, updated_at desc);
create index deals_user_id_status_idx on public.deals (user_id, status);

-- The bucket accepted any file of any size. Nothing but this app writes to
-- it today, but a bucket with no ceiling is a storage-exhaustion lever on a
-- 1 GB free tier, and "only PDFs" is simply true of what we store.
-- 25 MB is far above the largest form (2229E fills to ~700 KB).
update storage.buckets
   set file_size_limit = 26214400,
       allowed_mime_types = array['application/pdf']
 where id = 'generated-forms';

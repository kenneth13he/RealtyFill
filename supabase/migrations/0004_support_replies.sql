-- 0004_support_replies.sql
-- Close the support loop.
--
-- 0003 gave users a way to send a request and gave you a way to read it, but
-- nothing carried a message back: the only signal reaching the user was the
-- status badge. Replying meant leaving the app for an email client, which
-- splits the conversation from the ticket.

alter table public.support_requests
  add column admin_reply text check (admin_reply is null or length(admin_reply) <= 5000),
  add column replied_at timestamptz,
  -- Which admin answered. Kept for accountability once more than one person
  -- is triaging; null for replies written before this column existed.
  add column replied_by uuid references auth.users(id) on delete set null;

-- The existing support_requests_select_own policy is `for select using
-- (auth.uid() = user_id)` with no column list, so the new columns are
-- readable by the request's author automatically — which is the point.
--
-- There is still deliberately no update policy for end users: replies and
-- status are written by the admin route using the service role, after it has
-- checked the caller against ADMIN_PRINCIPALS. A user must not be able to
-- edit a reply, their own request, or their own ticket's status.

-- Triage reads "newest unanswered first"; without this that's a sequential
-- scan once the table is more than a handful of rows.
create index support_requests_open_idx
  on public.support_requests (created_at desc)
  where status <> 'resolved';

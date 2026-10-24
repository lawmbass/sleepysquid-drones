-- ADDITIVE, NOT YET APPLIED (needs Lawrence's yes). Drones Supabase project, schema "portal" only.
-- Admin "Bot reports" box: Resolve / Dismiss / Reopen state for each issue item. Reports stay append-only;
-- nothing is ever deleted: resolving hides an item, reopening shows it again, every change is kept in history.
-- issue_id = first 24 hex of sha256(report_id || ':0:' || notes) (see libs/aiPortal/issues.js), stable across reloads.
create table if not exists portal.issue_resolutions (
  issue_id    text primary key,
  client_id   text not null,
  report_id   uuid,
  status      text not null check (status in ('resolved','open')),
  action      text check (action in ('resolve','dismiss','clear_notes','reopen')),
  resolved_by text,            -- admin email
  resolved_at timestamptz,
  updated_by  text not null,
  updated_at  timestamptz not null default now(),
  history     jsonb not null default '[]'::jsonb  -- [{action, by, at}]
);
create index if not exists issue_resolutions_client_idx on portal.issue_resolutions (client_id);
alter table portal.issue_resolutions enable row level security; -- service role only; no client policies
comment on table portal.issue_resolutions is 'Admin-only resolve/reopen state for dashboard bot-report items. Never hard-deleted.';
-- Rollback (only if abandoning the feature): drop table portal.issue_resolutions;

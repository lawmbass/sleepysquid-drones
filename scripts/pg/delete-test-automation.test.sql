-- Real-Postgres check for portal_013. Run: scripts/pg/run-delete-test-automation.sh (needs a local Postgres).
\set ON_ERROR_STOP 1
drop schema if exists portal cascade; create schema portal;
do $$ begin if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if; end $$;
create table portal.clients (id text primary key, name text, deleted_at timestamptz);
create table portal.automations (client_id text, automation_id text, name text, primary key (client_id, automation_id));
create table portal.reports (report_id uuid primary key default gen_random_uuid(), client_id text, automation_id text, counts jsonb);
create table portal.issue_resolutions (issue_id text primary key, client_id text, report_id uuid);
create function portal.reports_append_only() returns trigger language plpgsql as $$ begin raise exception 'portal_reports is append-only'; end $$;
create trigger portal_reports_no_change before update or delete on portal.reports for each row execute function portal.reports_append_only();
grant usage on schema portal to service_role, anon, authenticated;
grant all on all tables in schema portal to service_role;

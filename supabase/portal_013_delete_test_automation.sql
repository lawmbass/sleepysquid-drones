-- portal_013: admin delete for TEST automations only (connection tests / setup checks), e.g. Logs' "logs-test".
-- Apply in the Drones project (etbesmtdsjlmadaexvrv) SQL editor. Safe to re-run. Backward compatible with
-- the code before and after this PR, so it can be applied before or after the deploy.
-- Append-only protection on portal.reports stays in force: the trigger lets a DELETE through only inside
-- portal.hard_delete_client() (unchanged) or inside portal.delete_test_automation() for that one
-- client + automation. Updates to reports are still always blocked.

create or replace function portal.reports_append_only() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE'
     and current_setting('portal.hard_delete_client', true) = old.client_id
     and exists (select 1 from portal.clients c where c.id = old.client_id and c.deleted_at is not null) then
    return old;
  end if;
  if tg_op = 'DELETE'
     and current_setting('portal.delete_test_automation', true) = old.client_id || '/' || old.automation_id then
    return old;
  end if;
  raise exception 'portal_reports is append-only; send a correction report instead';
end $$;

-- Same rule as libs/aiPortal/tags.js isInternalAutomation / isTestCounts.
create or replace function portal.is_test_automation(p_client text, p_automation text) returns boolean
language sql stable set search_path = portal, pg_temp as $$
  select p_automation ~* '^logs-|(^|[-_])(test|tests|connection-test|setup-check|healthcheck|health-check)([-_]|$)'
      or (exists (select 1 from portal.reports r where r.client_id = p_client and r.automation_id = p_automation)
          and not exists (
            select 1 from portal.reports r
             where r.client_id = p_client and r.automation_id = p_automation
               and (r.counts is null or jsonb_typeof(r.counts) <> 'object' or r.counts = '{}'::jsonb
                    or exists (select 1 from jsonb_object_keys(r.counts) k where k !~ '^(test_|connection_test|setup_check)'))));
$$;

-- Deletes one test automation: its issue resolutions, its reports, then the automation row. Returns counts.
-- PT404 = nothing by that id for that client, PT409 = not a test automation (nothing deleted).
create or replace function portal.delete_test_automation(p_client text, p_automation text) returns jsonb
language plpgsql security definer set search_path = portal, pg_temp as $$
declare n jsonb := '{}'::jsonb; k int;
begin
  if not exists (select 1 from portal.automations where client_id = p_client and automation_id = p_automation)
     and not exists (select 1 from portal.reports where client_id = p_client and automation_id = p_automation) then
    raise exception 'No such test automation' using errcode = 'PT404';
  end if;
  if not portal.is_test_automation(p_client, p_automation) then
    raise exception 'Only test automations can be deleted' using errcode = 'PT409';
  end if;
  perform set_config('portal.delete_test_automation', p_client || '/' || p_automation, true);  -- transaction-local
  delete from portal.issue_resolutions where client_id = p_client
     and report_id in (select report_id from portal.reports where client_id = p_client and automation_id = p_automation);
  get diagnostics k = row_count; n := n || jsonb_build_object('issue_resolutions', k);
  delete from portal.reports where client_id = p_client and automation_id = p_automation;
  get diagnostics k = row_count; n := n || jsonb_build_object('reports', k);
  delete from portal.automations where client_id = p_client and automation_id = p_automation;
  get diagnostics k = row_count; n := n || jsonb_build_object('automations', k);
  perform set_config('portal.delete_test_automation', '', true);
  return n;
end $$;

revoke all on function portal.delete_test_automation(text, text) from public, anon, authenticated;
revoke all on function portal.is_test_automation(text, text) from public, anon, authenticated;
grant execute on function portal.delete_test_automation(text, text) to service_role;
notify pgrst, 'reload schema';

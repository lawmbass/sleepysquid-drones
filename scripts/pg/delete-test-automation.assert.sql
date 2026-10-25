\set ON_ERROR_STOP 1
insert into portal.clients values ('acme','Acme',null);
insert into portal.automations values ('acme','logs-test','Logs connection test'), ('acme','lead-followup','Lead follow-up'), ('acme','zap-1','Zap');
insert into portal.reports (report_id, client_id, automation_id, counts) values
  ('00000000-0000-0000-0000-000000000001','acme','logs-test','{"test_reports_sent":1}'),
  ('00000000-0000-0000-0000-000000000002','acme','lead-followup','{"leads_qualified":3}'),
  ('00000000-0000-0000-0000-000000000003','acme','zap-1','{"connection_test":1}');
insert into portal.issue_resolutions values ('i1','acme','00000000-0000-0000-0000-000000000001'), ('i2','acme','00000000-0000-0000-0000-000000000002');
do $$ declare r jsonb; ok boolean;
begin
  -- 1. test automation deletes (as service_role, like PostgREST)
  set local role service_role;
  r := portal.delete_test_automation('acme','logs-test');
  assert r = '{"issue_resolutions":1,"reports":1,"automations":1}'::jsonb, 'counts ' || r;
  assert not exists (select 1 from portal.automations where automation_id='logs-test'), 'automation left';
  -- 1b. test-only counts with a non-test id also deletes
  r := portal.delete_test_automation('acme','zap-1'); assert r->>'reports' = '1';
  -- 2. real automation refused, nothing deleted
  begin perform portal.delete_test_automation('acme','lead-followup'); raise exception 'NOT_REFUSED';
  exception when sqlstate 'PT409' then null; end;
  begin perform portal.delete_test_automation('acme','nope'); raise exception 'NOT_404';
  exception when sqlstate 'PT404' then null; end;
  reset role;
  assert (select count(*) from portal.reports) = 1 and (select count(*) from portal.automations) = 1 and (select count(*) from portal.issue_resolutions) = 1, 'real rows changed';
  -- 3. direct delete still blocked, even with a forged flag for a different automation
  ok := false; begin delete from portal.reports where automation_id='lead-followup'; exception when raise_exception then ok := true; end; assert ok, 'direct delete allowed';
  perform set_config('portal.delete_test_automation', 'acme/logs-test', true);
  ok := false; begin delete from portal.reports where automation_id='lead-followup'; exception when raise_exception then ok := true; end; assert ok, 'flag leak';
  ok := false; begin update portal.reports set counts='{}' where automation_id='lead-followup'; exception when raise_exception then ok := true; end; assert ok, 'update allowed';
  -- 4. anon cannot call it
  set local role anon;
  ok := false; begin perform portal.delete_test_automation('acme','lead-followup'); exception when insufficient_privilege then ok := true; end; assert ok, 'anon could execute';
  reset role;
  raise notice 'ALL PASS';
end $$;

-- Verifies security step 5. Raises on the first failure; prints "step5 verify: ok" on success.
-- Runs as a simulated signed-in user inside a transaction that is rolled back.
begin;

do $$
declare
  n int;
  v_err text;
  v_me uuid := '00000000-0000-0000-0000-00000000a001';
  v_other uuid := '00000000-0000-0000-0000-00000000b002';
begin
  -- 1. Every actor-taking Field Log function carries the guard.
  select count(*) into n
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace
    and p.proname in ('field_log_append_xm_link', 'field_log_approve_report', 'field_log_create_draft',
                      'field_log_deny_report', 'field_log_finalize_verdict', 'field_log_reassign_followup',
                      'field_log_request_sup_followup', 'field_log_request_tech_followup')
    and p.prosrc not like '%field_log_assert_acting_user%';
  if n > 0 then raise exception 'step5: % Field Log functions are missing the acting-user guard', n; end if;

  -- 2. Signed-in caller: own id passes, someone else's id is refused.
  perform set_config('request.jwt.claims', json_build_object('sub', v_me, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_me::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform public.field_log_assert_acting_user(v_me);
  begin
    perform public.field_log_assert_acting_user(v_other);
    raise exception 'step5: a signed-in user could act as someone else';
  exception when insufficient_privilege then null;
  end;

  -- 3. The guard runs before the function body: impersonation is refused even for a missing report.
  begin
    perform public.field_log_deny_report(gen_random_uuid(), v_other, null);
    raise exception 'step5: deny_report accepted another user as actor';
  exception when insufficient_privilege then null;
  end;

  -- 4. Service-role callers are not restricted.
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform public.field_log_assert_acting_user(v_other);

  raise notice 'step5 verify: ok';
end
$$;

rollback;

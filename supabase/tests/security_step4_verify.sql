-- Verifies security step 4. Raises on the first failure; prints "step4 verify: ok" on success.
do $$
declare
  t text;
begin
  foreach t in array array['app_owners', 'user_roles', 'user_pc_org_eligibility',
                           'pc_org_console_eligibility_derived', 'exec_pc_org_access_derived', 'rpc_policy'] loop
    if not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass) then
      raise exception 'step4: RLS is not enabled on %', t;
    end if;
    if has_table_privilege('anon', 'public.' || t, 'SELECT') then
      raise exception 'step4: anon can read %', t;
    end if;
    if has_table_privilege('authenticated', 'public.' || t, 'INSERT,UPDATE,DELETE') then
      raise exception 'step4: signed-in users can write %', t;
    end if;
    if not has_table_privilege('service_role', 'public.' || t, 'SELECT') then
      raise exception 'step4: service role lost read access to %', t;
    end if;
  end loop;

  foreach t in array array['app_owners', 'user_roles', 'user_pc_org_eligibility',
                           'pc_org_console_eligibility_derived', 'exec_pc_org_access_derived'] loop
    if not has_table_privilege('authenticated', 'public.' || t, 'SELECT') then
      raise exception 'step4: signed-in users lost SELECT on % (own-row policy needs it)', t;
    end if;
    if not exists (select 1 from pg_policy where polrelid = ('public.' || t)::regclass and polcmd = 'r') then
      raise exception 'step4: no own-row select policy on %', t;
    end if;
  end loop;

  if has_table_privilege('authenticated', 'public.rpc_policy', 'SELECT') then
    raise exception 'step4: signed-in users can still read rpc_policy';
  end if;
  raise notice 'step4 verify: ok';
end
$$;

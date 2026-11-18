-- Verifies security step 3. Raises on the first failure; prints "step3 verify: ok" on success.
do $$
declare
  t text;
begin
  foreach t in array array['schedule', 'shift_validation_batch', 'shift_validation_row'] loop
    if not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass) then
      raise exception 'step3: RLS is not enabled on %', t;
    end if;
    if has_table_privilege('anon', 'public.' || t, 'SELECT,INSERT,UPDATE,DELETE') then
      raise exception 'step3: anon still has access to %', t;
    end if;
    if has_table_privilege('authenticated', 'public.' || t, 'INSERT,UPDATE,DELETE') then
      raise exception 'step3: signed-in users can still write %', t;
    end if;
    if not has_table_privilege('service_role', 'public.' || t, 'SELECT')
       or not has_table_privilege('service_role', 'public.' || t, 'INSERT')
       or not has_table_privilege('service_role', 'public.' || t, 'UPDATE')
       or not has_table_privilege('service_role', 'public.' || t, 'DELETE') then
      raise exception 'step3: service role lost access to %', t;
    end if;
  end loop;

  if has_table_privilege('authenticated', 'public.schedule', 'SELECT') then
    raise exception 'step3: signed-in users can still read schedule';
  end if;
  foreach t in array array['shift_validation_batch', 'shift_validation_row'] loop
    if not has_table_privilege('authenticated', 'public.' || t, 'SELECT') then
      raise exception 'step3: signed-in users lost read access to %', t;
    end if;
    if not exists (select 1 from pg_policy where polrelid = ('public.' || t)::regclass and polcmd = 'r') then
      raise exception 'step3: no select policy on %', t;
    end if;
  end loop;

  if has_function_privilege('anon', 'api.current_user_pc_org_ids()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'api.current_user_pc_org_ids()', 'EXECUTE') then
    raise exception 'step3: api.current_user_pc_org_ids has the wrong execute grants';
  end if;
  raise notice 'step3 verify: ok';
end
$$;

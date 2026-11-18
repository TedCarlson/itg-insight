-- Verifies security step 2. Raises on the first failure; prints "step2 verify: ok" on success.
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.password_setup_code'::regclass) then
    raise exception 'step2: RLS is not enabled on password_setup_code';
  end if;
  if has_table_privilege('authenticated', 'public.password_setup_code', 'SELECT')
     or has_table_privilege('anon', 'public.password_setup_code', 'SELECT') then
    raise exception 'step2: signed-in or signed-out callers can still read password_setup_code';
  end if;
  if not (has_table_privilege('service_role', 'public.password_setup_code', 'SELECT')
          and has_table_privilege('service_role', 'public.password_setup_code', 'INSERT')
          and has_table_privilege('service_role', 'public.password_setup_code', 'UPDATE')
          and has_table_privilege('service_role', 'public.password_setup_code', 'DELETE')) then
    raise exception 'step2: service role lost access the auth code routes need';
  end if;
  if not (select rolbypassrls from pg_roles where rolname = 'service_role') then
    raise exception 'step2: service_role does not bypass RLS, so the auth code routes would see no rows';
  end if;
  raise notice 'step2 verify: ok';
end
$$;

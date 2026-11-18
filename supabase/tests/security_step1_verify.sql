-- Verifies security step 1. Raises on the first failure; prints "step1 verify: ok" on success.
-- The new-function probe is created inside this transaction and rolled back.
begin;

do $$
declare
  n int;
begin
  -- 1. anon executes no app function.
  select count(*) into n
  from pg_proc p
  join pg_namespace s on s.oid = p.pronamespace
  where s.nspname in ('public', 'api', 'core')
    and p.prokind in ('f', 'p')
    and not exists (select 1 from pg_depend d
                    where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
    and has_function_privilege('anon', p.oid, 'EXECUTE');
  if n > 0 then raise exception 'step1: anon can still execute % app functions', n; end if;

  -- 2. Every role that could execute a function before still can.
  select count(*) into n
  from security_audit.function_acl_snapshot s
  cross join (values ('authenticated'), ('service_role')) r(role)
  where s.step = 'step1'
    and exists (select 1 from pg_proc p where p.oid = s.fn_oid)
    and (s.proacl is null
         or exists (select 1 from aclexplode(s.proacl) a
                    where a.privilege_type = 'EXECUTE'
                      and (a.grantee = 0 or a.grantee = (select oid from pg_roles where rolname = r.role))))
    and not has_function_privilege(r.role, s.fn_oid, 'EXECUTE');
  if n > 0 then raise exception 'step1: % function grants lost for authenticated/service_role', n; end if;

  -- 3. Spot-check the verified exploit path.
  if has_function_privilege('anon', 'public.field_log_approve_report(uuid, uuid, text)', 'EXECUTE') then
    raise exception 'step1: anon can still approve field log reports';
  end if;
  if not has_function_privilege('authenticated', 'public.field_log_approve_report(uuid, uuid, text)', 'EXECUTE') then
    raise exception 'step1: signed-in users lost field_log_approve_report';
  end if;
end
$$;

-- 4. A newly created function is not anon-callable but is callable when signed in.
create function public.__step1_probe() returns int language sql as 'select 1';
do $$
begin
  if has_function_privilege('anon', 'public.__step1_probe()', 'EXECUTE') then
    raise exception 'step1: new functions are still anon-callable';
  end if;
  if not has_function_privilege('authenticated', 'public.__step1_probe()', 'EXECUTE') then
    raise exception 'step1: new functions are not callable by authenticated';
  end if;
  raise notice 'step1 verify: ok';
end
$$;

rollback;

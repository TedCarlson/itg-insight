-- Rolls back security step 1 by restoring PUBLIC and anon EXECUTE exactly as they were,
-- using the ACL snapshot the migration saved. Grants kept for signed-in and service roles
-- were held before the migration too, so they stay.
-- Run only on Ted's call: this re-opens anon access to every app function.
begin;

do $$
declare
  r record;
begin
  for r in
    select s.fn_signature, s.proacl
    from security_audit.function_acl_snapshot s
    where s.step = 'step1'
      and exists (select 1 from pg_proc p where p.oid = s.fn_oid)
  loop
    -- A null ACL meant the built-in default, which includes PUBLIC.
    if r.proacl is null
       or exists (select 1 from aclexplode(r.proacl) a where a.grantee = 0 and a.privilege_type = 'EXECUTE') then
      execute format('grant execute on function %s to public', r.fn_signature);
    end if;
    if exists (select 1 from aclexplode(r.proacl) a
               where a.grantee = (select oid from pg_roles where rolname = 'anon')
                 and a.privilege_type = 'EXECUTE') then
      execute format('grant execute on function %s to anon', r.fn_signature);
    end if;
  end loop;
end
$$;

alter default privileges for role postgres grant execute on functions to public;
alter default privileges for role postgres in schema public grant all on functions to anon;

alter default privileges for role postgres in schema core revoke execute on functions from authenticated, service_role;
alter default privileges for role postgres in schema metrics revoke execute on functions from authenticated, service_role;
alter default privileges for role postgres in schema metrics_next revoke execute on functions from authenticated, service_role;
alter default privileges for role postgres in schema metrics_vnext revoke execute on functions from authenticated, service_role;

commit;

-- Read-only. Run before and after security step 1 and compare.
-- Expected after: anon_exec = 0; authenticated_exec, service_role_exec and both hashes unchanged.
with f as (
  select p.oid::regprocedure::text as sig,
         has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
         has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth,
         has_function_privilege('service_role', p.oid, 'EXECUTE') as svc
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'api', 'core')
    and p.prokind in ('f', 'p')
    and not exists (
      select 1 from pg_depend d
      where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e'
    )
)
select count(*) as functions,
       count(*) filter (where anon) as anon_exec,
       count(*) filter (where auth) as authenticated_exec,
       count(*) filter (where svc) as service_role_exec,
       md5(string_agg(sig || ':' || auth, ',' order by sig)) as authenticated_hash,
       md5(string_agg(sig || ':' || svc, ',' order by sig)) as service_role_hash
from f;

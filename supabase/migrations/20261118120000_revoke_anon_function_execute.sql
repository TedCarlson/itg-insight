-- Security step 1: signed-out (anon) callers can no longer execute app functions.
--
-- Before this migration, every function in the API-exposed schemas (public, api, core)
-- was executable by anon, either by explicit grant or through the PUBLIC default.
-- SECURITY DEFINER functions bypass RLS, so the public anon key could approve
-- Field Log reports, edit people and assignments, and delete metric batches.
--
-- Function preserved:
--   * authenticated, service_role, supabase_auth_admin and supabase_storage_admin keep
--     EXECUTE on every function they could execute before (explicitly re-granted
--     before PUBLIC is revoked).
--   * Trigger and event-trigger functions do not check EXECUTE when they fire.
--   * Extension-owned functions (pg_trgm in public) are left unchanged.
--   * The prior ACL of every touched function is kept in security_audit.function_acl_snapshot
--     so supabase/security/step1_rollback.sql can restore it exactly.

create schema if not exists security_audit;
revoke all on schema security_audit from public, anon, authenticated;

create table if not exists security_audit.function_acl_snapshot (
  step text not null,
  fn_signature text not null,
  fn_oid oid not null,
  proacl aclitem[],
  captured_at timestamptz not null default now(),
  primary key (step, fn_signature)
);
revoke all on security_audit.function_acl_snapshot from public, anon, authenticated;

create temporary table step1_target_functions as
select p.oid, p.oid::regprocedure as sig, p.proacl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'api', 'core')
  and p.prokind in ('f', 'p')
  and not exists (
    select 1 from pg_depend d
    where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e'
  );

insert into security_audit.function_acl_snapshot (step, fn_signature, fn_oid, proacl)
select 'step1', sig::text, oid, proacl
from step1_target_functions
on conflict (step, fn_signature) do nothing;

do $$
declare
  r record;
  k text;
begin
  for r in select sig from step1_target_functions loop
    foreach k in array array['authenticated', 'service_role', 'supabase_auth_admin', 'supabase_storage_admin'] loop
      if exists (select 1 from pg_roles where rolname = k)
         and has_function_privilege(k, r.sig, 'EXECUTE') then
        execute format('grant execute on function %s to %I', r.sig, k);
      end if;
    end loop;
    execute format('revoke execute on function %s from public, anon', r.sig);
  end loop;
end
$$;

drop table step1_target_functions;

-- Stop new functions from becoming anon-callable.
-- PUBLIC can only be removed from the role-wide default (per-schema defaults cannot
-- subtract a global grant), so signed-in and service callers get per-schema defaults
-- in every app schema to keep new functions working for them.
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke all on functions from anon;

alter default privileges for role postgres in schema public grant execute on functions to authenticated, service_role;
alter default privileges for role postgres in schema api grant execute on functions to authenticated, service_role;
alter default privileges for role postgres in schema core grant execute on functions to authenticated, service_role;
alter default privileges for role postgres in schema metrics grant execute on functions to authenticated, service_role;
alter default privileges for role postgres in schema metrics_next grant execute on functions to authenticated, service_role;
alter default privileges for role postgres in schema metrics_vnext grant execute on functions to authenticated, service_role;

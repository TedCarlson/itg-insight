-- Security step 3: RLS on schedule and the shift validation tables.
--
-- schedule: only the admin catalogue reads or writes it, through the service role.
--   It becomes server-only.
-- shift_validation_batch / shift_validation_row: the upload route writes them through
--   the service role. Signed-in pages (Route Lock calendar, Shift Validation) read
--   them for the selected org. Signed-in users keep read access to every org that
--   api.can_access_pc_org allows, which is the database's own org-access rule, and
--   lose write access.
--
-- Views over these tables run with owner rights and the sweep functions are
-- SECURITY DEFINER, so neither is affected. Rollback: supabase/security/step3_rollback.sql.

-- Resolves the caller's accessible orgs once per query rather than per row.
-- Definer so it keeps working if the access tables it reads get RLS later.
create or replace function api.current_user_pc_org_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public, api
as $fn$
  select coalesce(array_agg(o.pc_org_id), '{}'::uuid[])
  from public.pc_org o
  where api.can_access_pc_org(o.pc_org_id);
$fn$;
revoke execute on function api.current_user_pc_org_ids() from public, anon;
grant execute on function api.current_user_pc_org_ids() to authenticated, service_role;

alter table public.schedule enable row level security;
revoke all on table public.schedule from anon, authenticated;

alter table public.shift_validation_batch enable row level security;
revoke all on table public.shift_validation_batch from anon, authenticated;
grant select on table public.shift_validation_batch to authenticated;
create policy shift_validation_batch_select_accessible_org
  on public.shift_validation_batch
  for select to authenticated
  using (pc_org_id in (select unnest(api.current_user_pc_org_ids())));

alter table public.shift_validation_row enable row level security;
revoke all on table public.shift_validation_row from anon, authenticated;
grant select on table public.shift_validation_row to authenticated;
create policy shift_validation_row_select_accessible_org
  on public.shift_validation_row
  for select to authenticated
  using (pc_org_id in (select unnest(api.current_user_pc_org_ids())));

-- Security step 4: access-control tables show each signed-in user only their own rows.
--
-- Every app read and write of these tables runs as the service role (admin screens,
-- quota, invite and org-user routes), which bypasses RLS. The only signed-in readers
-- are invoker functions, chiefly api.can_access_pc_org (called by the app via RPC and
-- by api.assert_pc_org_access, api.can_manage_pc_org_console, api.roster_current_full_v2
-- and api.roster_drilldown). It only reads the caller's own rows, which the policies
-- below allow. Definer functions run as the owner and are unaffected.
--
-- rpc_policy is read only by a definer function and an owner-rights view, so it
-- becomes server-only. roles and permission_def are non-sensitive catalogues the app
-- reads as the signed-in user; they are left unchanged.
-- Rollback: supabase/security/step4_rollback.sql.

alter table public.app_owners enable row level security;
revoke all on table public.app_owners from anon, authenticated;
grant select on table public.app_owners to authenticated;
create policy app_owners_select_own on public.app_owners
  for select to authenticated
  using (auth_user_id = (select auth.uid()));

alter table public.user_roles enable row level security;
revoke all on table public.user_roles from anon, authenticated;
grant select on table public.user_roles to authenticated;
create policy user_roles_select_own on public.user_roles
  for select to authenticated
  using (auth_user_id = (select auth.uid()));

alter table public.user_pc_org_eligibility enable row level security;
revoke all on table public.user_pc_org_eligibility from anon, authenticated;
grant select on table public.user_pc_org_eligibility to authenticated;
create policy user_pc_org_eligibility_select_own on public.user_pc_org_eligibility
  for select to authenticated
  using (auth_user_id = (select auth.uid()));

alter table public.pc_org_console_eligibility_derived enable row level security;
revoke all on table public.pc_org_console_eligibility_derived from anon, authenticated;
grant select on table public.pc_org_console_eligibility_derived to authenticated;
create policy pc_org_console_eligibility_derived_select_own on public.pc_org_console_eligibility_derived
  for select to authenticated
  using (auth_user_id = (select auth.uid()));

-- Same person match api.can_access_pc_org uses for derived leadership access.
alter table public.exec_pc_org_access_derived enable row level security;
revoke all on table public.exec_pc_org_access_derived from anon, authenticated;
grant select on table public.exec_pc_org_access_derived to authenticated;
create policy exec_pc_org_access_derived_select_own on public.exec_pc_org_access_derived
  for select to authenticated
  using (leader_person_id = (
    select up.person_id from public.user_profile up where up.auth_user_id = (select auth.uid())
  ));

alter table public.rpc_policy enable row level security;
revoke all on table public.rpc_policy from anon, authenticated;

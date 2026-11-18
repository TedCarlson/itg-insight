-- Rolls back security step 4 to the prior state: RLS off on all six tables and
-- signed-in SELECT on rpc_policy restored (the other five kept SELECT throughout).
-- Run only on Ted's call: this re-exposes every user's access rows to every signed-in user.
begin;

drop policy if exists app_owners_select_own on public.app_owners;
drop policy if exists user_roles_select_own on public.user_roles;
drop policy if exists user_pc_org_eligibility_select_own on public.user_pc_org_eligibility;
drop policy if exists pc_org_console_eligibility_derived_select_own on public.pc_org_console_eligibility_derived;
drop policy if exists exec_pc_org_access_derived_select_own on public.exec_pc_org_access_derived;

alter table public.app_owners disable row level security;
alter table public.user_roles disable row level security;
alter table public.user_pc_org_eligibility disable row level security;
alter table public.pc_org_console_eligibility_derived disable row level security;
alter table public.exec_pc_org_access_derived disable row level security;
alter table public.rpc_policy disable row level security;

grant select on table public.rpc_policy to authenticated;

commit;

-- Align People creation authorization with people_onboarding_org_options.
--
-- ADMIN users may create onboarding records for any active workspace-backed
-- PC org exposed by the onboarding-org options RPC.
--
-- Non-admin users remain restricted to active workspace memberships.

create or replace function public.people_create_for_current_user(
  p_auth_user_id uuid,
  p_full_name text,
  p_tech_id text default null::text,
  p_nt_login text default null::text,
  p_csg text default null::text,
  p_mobile text default null::text,
  p_email text default null::text,
  p_prospecting_affiliation_id uuid default null::uuid,
  p_onboarding_pc_org_id uuid default null::uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'core'
as $function$
declare
  v_app_user_id uuid;
  v_person_id uuid;
  v_profile record;
  v_onboarding_pc_org_id uuid;
  v_onboarding_pc_org_name text;
begin
  select
    up.auth_user_id,
    up.core_person_id,
    up.person_id,
    up.selected_pc_org_id,
    coalesce(up.is_admin, false) as is_admin,
    au.email
  into v_profile
  from public.user_profile up
  left join auth.users au
    on au.id = up.auth_user_id
  where up.auth_user_id = p_auth_user_id
  limit 1;

  if v_profile.auth_user_id is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'User profile not found'
    );
  end if;

  v_onboarding_pc_org_id :=
    coalesce(p_onboarding_pc_org_id, v_profile.selected_pc_org_id);

  if v_onboarding_pc_org_id is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'Selected PC org not found'
    );
  end if;

  select au.app_user_id
  into v_app_user_id
  from core.app_users au
  where au.auth_user_id = p_auth_user_id
  limit 1;

  if v_app_user_id is null then
    insert into core.app_users (
      auth_user_id,
      person_id,
      display_name,
      primary_email,
      status
    )
    values (
      p_auth_user_id,
      coalesce(v_profile.core_person_id, v_profile.person_id),
      split_part(coalesce(v_profile.email, 'App User'), '@', 1),
      v_profile.email,
      'active'
    )
    returning app_user_id into v_app_user_id;
  else
    update core.app_users
    set
      person_id = coalesce(
        v_profile.core_person_id,
        v_profile.person_id,
        core.app_users.person_id
      ),
      primary_email = coalesce(
        v_profile.email,
        core.app_users.primary_email
      ),
      status = 'active',
      updated_at = now()
    where app_user_id = v_app_user_id;
  end if;

  if v_profile.is_admin then
    if not exists (
      select 1
      from core.workspaces w
      join public.pc_org po
        on po.pc_org_id = w.legacy_pc_org_id
       and po.fulfillment_center_id is not null
      where w.status = 'active'
        and w.legacy_pc_org_id = v_onboarding_pc_org_id
    ) then
      return jsonb_build_object(
        'ok', false,
        'error', 'Selected onboarding org is not available to this user'
      );
    end if;
  else
    if not exists (
      select 1
      from core.memberships m
      join core.workspaces w
        on w.workspace_id = m.workspace_id
      join public.pc_org po
        on po.pc_org_id = w.legacy_pc_org_id
       and po.fulfillment_center_id is not null
      where m.app_user_id = v_app_user_id
        and m.status = 'active'
        and w.status = 'active'
        and w.legacy_pc_org_id = v_onboarding_pc_org_id
    ) then
      return jsonb_build_object(
        'ok', false,
        'error', 'Selected onboarding org is not available to this user'
      );
    end if;
  end if;

  insert into core.people (
    full_name,
    status,
    prospecting_affiliation_id,
    onboarding_pc_org_id,
    created_by_app_user_id,
    updated_by_app_user_id
  )
  values (
    p_full_name,
    'onboarding',
    p_prospecting_affiliation_id,
    v_onboarding_pc_org_id,
    v_app_user_id,
    v_app_user_id
  )
  returning person_id into v_person_id;

  if p_tech_id is not null and trim(p_tech_id) <> '' then
    insert into core.person_identifiers (
      person_id,
      identifier_type,
      identifier_value,
      is_primary
    )
    values (
      v_person_id,
      'TECH_ID',
      trim(p_tech_id),
      true
    );
  end if;

  if p_nt_login is not null and trim(p_nt_login) <> '' then
    insert into core.person_identifiers (
      person_id,
      identifier_type,
      identifier_value,
      is_primary
    )
    values (
      v_person_id,
      'NT_LOGIN',
      trim(p_nt_login),
      true
    );
  end if;

  if p_csg is not null and trim(p_csg) <> '' then
    insert into core.person_identifiers (
      person_id,
      identifier_type,
      identifier_value,
      is_primary
    )
    values (
      v_person_id,
      'CSG',
      trim(p_csg),
      true
    );
  end if;

  if p_mobile is not null and trim(p_mobile) <> '' then
    insert into core.person_contacts (
      person_id,
      contact_type,
      contact_value,
      is_primary
    )
    values (
      v_person_id,
      'phone',
      trim(p_mobile),
      true
    );
  end if;

  if p_email is not null and trim(p_email) <> '' then
    insert into core.person_contacts (
      person_id,
      contact_type,
      contact_value,
      is_primary
    )
    values (
      v_person_id,
      'email',
      trim(p_email),
      true
    );
  end if;

  select coalesce(
    po.pc_org_name,
    po.fulfillment_center_name
  )
  into v_onboarding_pc_org_name
  from public.pc_org po
  where po.pc_org_id = v_onboarding_pc_org_id
  limit 1;

  return jsonb_build_object(
    'ok', true,
    'person_id', v_person_id,
    'onboarding_pc_org_id', v_onboarding_pc_org_id,
    'onboarding_pc_org_name', v_onboarding_pc_org_name
  );
end;
$function$;

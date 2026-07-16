do $$
declare
  v_config_id uuid;
  v_canonical_rule_id uuid;
begin
  select config_version_id
    into v_config_id
  from public.field_log_config_version
  where status = 'published'
  order by published_at desc nulls last, created_at desc
  limit 1;

  if v_config_id is null then
    raise exception 'No published Field Log configuration found.';
  end if;

  if exists (
    select 1
    from unnest(array['U31', 'U44']) required_code
    where not exists (
      select 1
      from public.field_log_ucode u
      where u.config_version_id = v_config_id
        and upper(u.ucode) = required_code
        and u.is_active = true
    )
  ) then
    raise exception 'Active U31 and U44 codes are required in published Field Log configuration %.',
      v_config_id;
  end if;

  insert into public.field_log_ucode_group (
    config_version_id,
    ucode_group_key,
    label,
    description,
    sort_order,
    is_active
  )
  values (
    v_config_id,
    'u_code_applied_codes',
    'U-Code Applied Codes',
    'Allowed U-codes for the U-Code Applied Field Log workflow.',
    20,
    true
  )
  on conflict (config_version_id, ucode_group_key)
  do update set
    label = excluded.label,
    description = excluded.description,
    is_active = true,
    updated_at = now();

  insert into public.field_log_ucode_group_item (
    config_version_id,
    ucode_group_key,
    ucode,
    sort_order,
    is_active
  )
  select
    v_config_id,
    'u_code_applied_codes',
    ucode,
    case upper(ucode) when 'U31' then 10 else 20 end,
    true
  from public.field_log_ucode
  where config_version_id = v_config_id
    and upper(ucode) in ('U31', 'U44')
  on conflict (config_version_id, ucode_group_key, ucode)
  do update set
    sort_order = excluded.sort_order,
    is_active = true;

  update public.field_log_rule
  set
    ucode_group_key = 'u_code_applied_codes',
    show_ucode = true,
    require_ucode = true,
    updated_at = now()
  where config_version_id = v_config_id
    and category_key = 'u_code_applied'
    and subcategory_key is null;

  select rule_id
    into v_canonical_rule_id
  from public.field_log_rule
  where config_version_id = v_config_id
    and category_key = 'u_code_applied'
    and subcategory_key is null
  order by created_at, rule_id
  limit 1;

  if v_canonical_rule_id is null then
    raise exception 'No U-Code Applied rule found in published configuration %.',
      v_config_id;
  end if;

  update public.field_log_rule
  set
    is_active = (rule_id = v_canonical_rule_id),
    updated_at = now()
  where config_version_id = v_config_id
    and category_key = 'u_code_applied'
    and subcategory_key is null;
end;
$$;

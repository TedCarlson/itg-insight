-- Add Commercial Battery Billing to the active Field Log runtime configuration.
-- Also normalize submit validation so every rule's required labeled evidence
-- is enforced through field_log_rule_photo_requirement.

do $$
declare
  v_config_version_id uuid;
  v_rule_id uuid;
begin
  -- Match field_log_runtime_bootstrap:
  -- prefer the latest draft, otherwise use the latest published configuration.
  select config_version_id
    into v_config_version_id
  from public.field_log_config_version
  where status = 'draft'
  order by version_no desc, created_at desc
  limit 1;

  if v_config_version_id is null then
    select config_version_id
      into v_config_version_id
    from public.field_log_config_version
    where status = 'published'
    order by version_no desc, published_at desc nulls last, created_at desc
    limit 1;
  end if;

  if v_config_version_id is null then
    raise exception 'No active Field Log configuration found';
  end if;

  insert into public.field_log_category (
    category_key,
    label,
    description,
    sort_order,
    is_active,
    config_version_id
  )
  values (
    'commercial_battery_billing',
    'Commercial Battery Billing',
    'Commercial battery billing packet with work order and serial number evidence.',
    65,
    true,
    v_config_version_id
  )
  on conflict (config_version_id, category_key)
  do update
    set label = excluded.label,
        description = excluded.description,
        sort_order = excluded.sort_order,
        is_active = true,
        updated_at = now();

  insert into public.field_log_photo_label (
    photo_label_key,
    label,
    description,
    sort_order,
    is_active,
    config_version_id
  )
  values
    (
      'workorder_screenshot',
      'Work Order Screenshot',
      'Screenshot of the work order selected from mobile files.',
      10,
      true,
      v_config_version_id
    ),
    (
      'battery_serial_number',
      'Battery Serial Number',
      'Clear photo of the installed battery serial number.',
      20,
      true,
      v_config_version_id
    )
  on conflict (config_version_id, photo_label_key)
  do update
    set label = excluded.label,
        description = excluded.description,
        sort_order = excluded.sort_order,
        is_active = true,
        updated_at = now();

  select rule_id
    into v_rule_id
  from public.field_log_rule
  where config_version_id = v_config_version_id
    and category_key = 'commercial_battery_billing'
    and subcategory_key is null
  limit 1;

  if v_rule_id is null then
    insert into public.field_log_rule (
      category_key,
      subcategory_key,
      show_subcategory,
      require_subcategory,
      show_ucode,
      require_ucode,
      ucode_group_key,
      xm_allowed,
      comment_required,
      min_photo_count,
      location_required,
      location_compare_required,
      location_tolerance_m,
      allow_technician_submit,
      allow_supervisor_submit,
      active_text_instruction,
      sort_order,
      is_active,
      config_version_id
    )
    values (
      'commercial_battery_billing',
      null,
      false,
      false,
      false,
      false,
      null,
      false,
      true,
      2,
      false,
      false,
      null,
      true,
      true,
      'Upload the work order screenshot and a clear battery serial number photo. Enter the billing code in Notes.',
      65,
      true,
      v_config_version_id
    )
    returning rule_id into v_rule_id;
  else
    update public.field_log_rule
       set show_subcategory = false,
           require_subcategory = false,
           show_ucode = false,
           require_ucode = false,
           ucode_group_key = null,
           xm_allowed = false,
           comment_required = true,
           min_photo_count = 2,
           location_required = false,
           location_compare_required = false,
           location_tolerance_m = null,
           allow_technician_submit = true,
           allow_supervisor_submit = true,
           active_text_instruction =
             'Upload the work order screenshot and a clear battery serial number photo. Enter the billing code in Notes.',
           sort_order = 65,
           is_active = true,
           updated_at = now()
     where rule_id = v_rule_id;
  end if;

  insert into public.field_log_rule_photo_requirement (
    rule_id,
    photo_label_key,
    required,
    sort_order,
    is_active
  )
  values
    (
      v_rule_id,
      'workorder_screenshot',
      true,
      10,
      true
    ),
    (
      v_rule_id,
      'battery_serial_number',
      true,
      20,
      true
    )
  on conflict (rule_id, photo_label_key)
  do update
    set required = excluded.required,
        sort_order = excluded.sort_order,
        is_active = excluded.is_active;
end
$$;

create or replace function public.field_log_validate_submit(
  p_report_id uuid
)
returns table (
  ok boolean,
  errors jsonb
)
language plpgsql
set search_path to 'public'
as $function$
declare
  v_detail public.field_log_report_detail_v%rowtype;
  v_errors jsonb := '[]'::jsonb;
  v_missing_required_evidence jsonb := '[]'::jsonb;
begin
  select *
    into v_detail
  from public.field_log_report_detail_v
  where report_id = p_report_id;

  if v_detail.report_id is null then
    return query
    select false, jsonb_build_array('Report not found');

    return;
  end if;

  if coalesce(v_detail.job_number, '') = '' then
    v_errors := v_errors || jsonb_build_array('Job number is required');
  end if;

  if coalesce(v_detail.require_subcategory, false)
     and v_detail.subcategory_key is null then
    v_errors := v_errors || jsonb_build_array('Subcategory is required');
  end if;

  if coalesce(v_detail.comment_required, false)
     and nullif(trim(coalesce(v_detail.comment, '')), '') is null then
    v_errors := v_errors || jsonb_build_array('Comment is required');
  end if;

  if coalesce(v_detail.require_ucode, false)
     and nullif(trim(coalesce(v_detail.selected_ucode, '')), '') is null then
    v_errors := v_errors || jsonb_build_array('U-Code is required');
  end if;

  if coalesce(v_detail.location_required, false)
     and (
       v_detail.gps_lat is null
       or v_detail.gps_lng is null
     ) then
    v_errors := v_errors || jsonb_build_array('Location capture is required');
  end if;

  -- Enforce all required labeled evidence defined by the report's runtime rule.
  select coalesce(
    jsonb_agg(
      to_jsonb(coalesce(pl.label, pr.photo_label_key))
      order by pr.sort_order, pr.photo_label_key
    ),
    '[]'::jsonb
  )
    into v_missing_required_evidence
  from public.field_log_rule_photo_requirement pr
  left join public.field_log_photo_label pl
    on pl.config_version_id = v_detail.config_version_id
   and pl.photo_label_key = pr.photo_label_key
   and pl.is_active = true
  where pr.rule_id = v_detail.rule_id
    and pr.required = true
    and pr.is_active = true
    and not exists (
      select 1
      from public.field_log_attachment a
      where a.report_id = p_report_id
        and a.deleted_at is null
        and a.photo_label_key = pr.photo_label_key
    );

  if jsonb_array_length(v_missing_required_evidence) > 0 then
    v_errors := v_errors || jsonb_build_array(
      'Missing required evidence: ' || (
        select string_agg(value #>> '{}', ', ')
        from jsonb_array_elements(v_missing_required_evidence) value
      )
    );
  end if;

  -- Preserve minimum-photo-count validation for rules that do not define
  -- individually labeled required evidence.
  if jsonb_array_length(v_missing_required_evidence) = 0
     and coalesce(v_detail.min_photo_count, 0) > 0
     and not exists (
       select 1
       from public.field_log_rule_photo_requirement pr
       where pr.rule_id = v_detail.rule_id
         and pr.required = true
         and pr.is_active = true
     )
     and coalesce(v_detail.photo_count, 0) < v_detail.min_photo_count then
    v_errors := v_errors || jsonb_build_array(
      format(
        'At least %s photo(s) required',
        v_detail.min_photo_count
      )
    );
  end if;

  return query
  select
    jsonb_array_length(v_errors) = 0,
    v_errors;
end;
$function$;

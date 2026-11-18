-- Keep Workforce discovery aligned with the active-row rule used by the
-- Workforce surface. An assignment whose end_date is today is already closed
-- for interactive Workforce purposes and must not hide its person from the
-- processing/add-assignment picker.

create or replace function public.workforce_person_search(
  p_pc_org_id uuid,
  p_query text default null
)
returns table (
  person_id uuid,
  person_status text,
  full_name text,
  tech_id text,
  position_title text,
  is_in_workforce boolean,
  assignment_id uuid,
  active_assignment_count integer,
  active_here_label text,
  active_elsewhere_label text
)
language sql
security definer
set search_path to 'public', 'core'
as $$
  with identifier_pivot as (
    select
      pi.person_id,
      max(pi.identifier_value) filter (where pi.identifier_type = 'TECH_ID') as tech_id
    from core.person_identifiers pi
    group by pi.person_id
  ),
  active_assignments as (
    select
      a.person_id,
      a.assignment_id,
      a.position_title,
      w.legacy_pc_org_id as pc_org_id,
      coalesce(po.pc_org_name, po.fulfillment_center_name, w.legacy_pc_org_id::text) as pc_org_label
    from core.assignments a
    join core.workspaces w
      on w.workspace_id = a.workspace_id
    left join public.pc_org po
      on po.pc_org_id = w.legacy_pc_org_id
    where a.assignment_status = 'active'
      and a.start_date <= current_date
      and (a.end_date is null or a.end_date > current_date)
  ),
  selected_org_assignment as (
    select distinct on (aa.person_id)
      aa.person_id,
      aa.assignment_id,
      aa.position_title,
      aa.pc_org_label
    from active_assignments aa
    where aa.pc_org_id = p_pc_org_id
    order by aa.person_id, aa.pc_org_label
  ),
  assignment_summary as (
    select
      aa.person_id,
      count(*)::integer as active_assignment_count,
      string_agg(
        distinct aa.pc_org_label,
        ', '
        order by aa.pc_org_label
      ) filter (where aa.pc_org_id <> p_pc_org_id) as active_elsewhere_label
    from active_assignments aa
    group by aa.person_id
  )
  select
    p.person_id,
    p.status as person_status,
    p.full_name,
    ids.tech_id,
    soa.position_title,
    (soa.assignment_id is not null)::boolean as is_in_workforce,
    soa.assignment_id,
    coalesce(asm.active_assignment_count, 0)::integer as active_assignment_count,
    soa.pc_org_label as active_here_label,
    asm.active_elsewhere_label
  from core.people p
  left join identifier_pivot ids
    on ids.person_id = p.person_id
  left join selected_org_assignment soa
    on soa.person_id = p.person_id
  left join assignment_summary asm
    on asm.person_id = p.person_id
  where
    p_query is null
    or trim(p_query) = ''
    or lower(coalesce(p.full_name, '')) like '%' || lower(p_query) || '%'
    or lower(coalesce(ids.tech_id, '')) like '%' || lower(p_query) || '%'
  order by p.full_name
  limit 50;
$$;

create or replace function public.workforce_person_search(
  p_pc_org_id uuid,
  p_query text default null,
  p_mode text default null
)
returns table (
  person_id uuid,
  person_status text,
  full_name text,
  tech_id text,
  position_title text,
  is_in_workforce boolean,
  assignment_id uuid,
  active_assignment_count integer,
  active_here_label text,
  active_elsewhere_label text
)
language sql
security definer
set search_path to 'public', 'core'
as $$
  with identifier_pivot as (
    select
      pi.person_id,
      max(pi.identifier_value) filter (where pi.identifier_type = 'TECH_ID') as tech_id
    from core.person_identifiers pi
    group by pi.person_id
  ),
  active_assignments as (
    select
      a.person_id,
      a.assignment_id,
      a.position_title,
      w.legacy_pc_org_id as pc_org_id,
      coalesce(po.pc_org_name, po.fulfillment_center_name, w.legacy_pc_org_id::text) as pc_org_label
    from core.assignments a
    join core.workspaces w
      on w.workspace_id = a.workspace_id
    left join public.pc_org po
      on po.pc_org_id = w.legacy_pc_org_id
    where a.assignment_status = 'active'
      and a.start_date <= current_date
      and (a.end_date is null or a.end_date > current_date)
  ),
  selected_org_assignment as (
    select distinct on (aa.person_id)
      aa.person_id,
      aa.assignment_id,
      aa.position_title,
      aa.pc_org_label
    from active_assignments aa
    where aa.pc_org_id = p_pc_org_id
    order by aa.person_id, aa.pc_org_label
  ),
  assignment_summary as (
    select
      aa.person_id,
      count(*)::integer as active_assignment_count,
      string_agg(
        distinct aa.pc_org_label,
        ', '
        order by aa.pc_org_label
      ) filter (where aa.pc_org_id <> p_pc_org_id) as active_elsewhere_label
    from active_assignments aa
    group by aa.person_id
  )
  select
    p.person_id,
    p.status as person_status,
    p.full_name,
    ids.tech_id,
    soa.position_title,
    (soa.assignment_id is not null)::boolean as is_in_workforce,
    soa.assignment_id,
    coalesce(asm.active_assignment_count, 0)::integer as active_assignment_count,
    soa.pc_org_label as active_here_label,
    asm.active_elsewhere_label
  from core.people p
  left join identifier_pivot ids
    on ids.person_id = p.person_id
  left join selected_org_assignment soa
    on soa.person_id = p.person_id
  left join assignment_summary asm
    on asm.person_id = p.person_id
  where
    (
      p_query is null
      or trim(p_query) = ''
      or lower(coalesce(p.full_name, '')) like '%' || lower(p_query) || '%'
      or lower(coalesce(ids.tech_id, '')) like '%' || lower(p_query) || '%'
    )
    and (
      p_mode is null
      or p_mode <> 'processing'
      or (
        p.status = 'active'
        and coalesce(asm.active_assignment_count, 0) = 0
        and ids.tech_id is not null
      )
    )
  order by p.full_name
  limit 50;
$$;

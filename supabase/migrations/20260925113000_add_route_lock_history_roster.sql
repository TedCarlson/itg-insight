-- Route Lock reporting needs to resolve the assignment that existed when the
-- historical evidence was recorded. The operational roster view intentionally
-- collapses each person to their current assignment, so it must not be used as
-- the identity source for historical reports.
create or replace view public.route_lock_history_roster_v as
select
  a.assignment_id,
  w.legacy_pc_org_id as pc_org_id,
  a.person_id,
  p.full_name,
  a.tech_id,
  coalesce(cpf.position_title, a.position_title) as position_title,
  a.start_date,
  a.end_date,
  case
    when coalesce(a.assignment_status, 'active') <> 'active' then false
    when coalesce(p.status, 'active') <> 'active' then false
    when a.end_date is null then true
    when a.end_date >= current_date then true
    else false
  end as assignment_active,
  a.reports_to_assignment_id,
  wao.affiliation_label as co_name
from core.assignments a
join core.workspaces w
  on w.workspace_id = a.workspace_id
join core.people p
  on p.person_id = a.person_id
left join lateral (
  select
    fact.position_title,
    fact.affiliation_id
  from public.company_profile_fact fact
  where fact.person_id = a.person_id
    and fact.pc_org_id = w.legacy_pc_org_id
    and fact.effective_start_date <= coalesce(a.end_date, current_date)
  order by
    case
      when fact.effective_end_date is null
        or fact.effective_end_date >= a.start_date then 0
      else 1
    end,
    fact.effective_start_date desc,
    fact.created_at desc
  limit 1
) cpf on true
left join lateral (
  select options.affiliation_label
  from public.workforce_affiliation_options() options(
    affiliation_id,
    affiliation_type,
    affiliation_code,
    affiliation_label
  )
  where options.affiliation_id = cpf.affiliation_id
  limit 1
) wao on true
where w.legacy_pc_org_id is not null
  and nullif(btrim(a.tech_id), '') is not null;

comment on view public.route_lock_history_roster_v is
  'All technician assignments, including ended/inactive assignments, for historical Route Lock reporting.';

revoke all on public.route_lock_history_roster_v from anon, authenticated;
grant select on public.route_lock_history_roster_v to service_role;

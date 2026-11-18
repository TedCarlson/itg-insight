-- Field Log was still reading the legacy user_profile.person_id column while
-- current onboarding writes the canonical link to user_profile.core_person_id.
-- Snapshot the effective person identity on every report so all existing Field
-- Log views continue to resolve the technician consistently.

create or replace function public.field_log_fill_subject_identity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_person_id uuid;
begin
  if new.subject_person_id is null and new.created_by_user_id is not null then
    select coalesce(up.core_person_id, up.person_id)
      into v_person_id
    from public.user_profile up
    where up.auth_user_id = new.created_by_user_id
    limit 1;

    new.subject_person_id := v_person_id;
  else
    v_person_id := new.subject_person_id;
  end if;

  if v_person_id is null then
    return new;
  end if;

  if nullif(trim(coalesce(new.subject_full_name, '')), '') is null then
    select coalesce(
      (
        select w.full_name
        from public.workforce_person_identity_v w
        where w.person_id = v_person_id
        limit 1
      ),
      (
        select p.full_name
        from public.person p
        where p.person_id = v_person_id
        limit 1
      )
    ) into new.subject_full_name;
  end if;

  if nullif(trim(coalesce(new.subject_tech_id, '')), '') is null
     and new.pc_org_id is not null then
    select w.tech_id
      into new.subject_tech_id
    from public.workforce_current_v w
    where w.person_id = v_person_id
      and w.pc_org_id = new.pc_org_id
      and nullif(trim(coalesce(w.tech_id, '')), '') is not null
    order by
      w.is_primary desc nulls last,
      w.is_active desc nulls last,
      w.updated_at desc nulls last,
      coalesce(w.start_date, '1900-01-01'::date) desc
    limit 1;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_field_log_fill_subject_identity
  on public.field_log_report;

create trigger trg_field_log_fill_subject_identity
before insert or update of
  created_by_user_id,
  pc_org_id,
  subject_person_id,
  subject_full_name,
  subject_tech_id
on public.field_log_report
for each row
execute function public.field_log_fill_subject_identity();

-- Repair previously submitted reports whose creator is linked through the
-- canonical core_person_id but whose Field Log identity snapshot is blank.
with resolved as (
  select
    r.report_id,
    coalesce(r.subject_person_id, up.core_person_id, up.person_id) as person_id
  from public.field_log_report r
  left join public.user_profile up
    on up.auth_user_id = r.created_by_user_id
  where coalesce(r.subject_person_id, up.core_person_id, up.person_id) is not null
    and (
      r.subject_person_id is null
      or nullif(trim(coalesce(r.subject_full_name, '')), '') is null
      or nullif(trim(coalesce(r.subject_tech_id, '')), '') is null
    )
), identity_snapshot as (
  select
    x.report_id,
    x.person_id,
    coalesce(wpi.full_name, p.full_name) as full_name,
    ta.tech_id
  from resolved x
  left join public.person p
    on p.person_id = x.person_id
  left join public.workforce_person_identity_v wpi
    on wpi.person_id = x.person_id
  left join public.field_log_report r
    on r.report_id = x.report_id
  left join lateral (
    select w.tech_id
    from public.workforce_current_v w
    where w.person_id = x.person_id
      and w.pc_org_id = r.pc_org_id
      and nullif(trim(coalesce(w.tech_id, '')), '') is not null
    order by
      w.is_primary desc nulls last,
      w.is_active desc nulls last,
      w.updated_at desc nulls last,
      coalesce(w.start_date, '1900-01-01'::date) desc
    limit 1
  ) ta on true
)
update public.field_log_report r
set
  subject_person_id = coalesce(r.subject_person_id, x.person_id),
  subject_full_name = coalesce(
    nullif(trim(coalesce(r.subject_full_name, '')), ''),
    x.full_name
  ),
  subject_tech_id = coalesce(
    nullif(trim(coalesce(r.subject_tech_id, '')), ''),
    x.tech_id
  )
from identity_snapshot x
where r.report_id = x.report_id
  and (
    r.subject_person_id is null
    or (
      nullif(trim(coalesce(r.subject_full_name, '')), '') is null
      and x.full_name is not null
    )
    or (
      nullif(trim(coalesce(r.subject_tech_id, '')), '') is null
      and x.tech_id is not null
    )
  );

comment on function public.field_log_fill_subject_identity() is
'Snapshots the effective user_profile person (core_person_id first) and current-workforce identity onto Field Log reports.';

-- Bound the payload returned by the frequently refreshed "My Logs" surface.
-- The previous function aggregated the user's complete submission history.
drop function if exists public.field_log_get_my_submissions(uuid);

create function public.field_log_get_my_submissions(
  p_created_by_user_id uuid,
  p_limit integer default 50
) returns jsonb
language sql
stable
set search_path = public
as $$
select coalesce(
  jsonb_agg(
    jsonb_build_object(
      'report_id', m.report_id,
      'created_by_user_id', m.created_by_user_id,
      'status', m.status,
      'category_key', m.category_key,
      'category_label', m.category_label,
      'subcategory_key', m.subcategory_key,
      'subcategory_label', m.subcategory_label,
      'job_number', m.job_number,
      'job_type', m.job_type,
      'submitted_at', m.submitted_at,
      'photo_count', m.photo_count,
      'edit_unlocked', m.edit_unlocked,
      'locked', m.locked,
      'followup_note', m.followup_note,
      'tech_person_id', m.tech_person_id,
      'tech_full_name', m.tech_full_name,
      'tech_id', m.tech_id,
      'approved_by_full_name', m.approved_by_full_name,
      'evidence_declared', m.evidence_declared,
      'xm_declared', m.xm_declared,
      'xm_link_valid', m.xm_link_valid,
      'min_photo_count', m.min_photo_count,
      'evidence_badge', m.evidence_badge
    )
    order by m.submitted_at desc nulls last, m.report_id desc
  ),
  '[]'::jsonb
)
from (
  select *
  from public.field_log_my_submissions_v
  where created_by_user_id = p_created_by_user_id
  order by submitted_at desc nulls last, report_id desc
  limit greatest(1, least(coalesce(p_limit, 50), 100))
) m;
$$;

grant execute on function public.field_log_get_my_submissions(uuid, integer)
  to authenticated, service_role;

alter table public.field_log_event
  drop constraint if exists field_log_event_event_type_check;

alter table public.field_log_event
  add constraint field_log_event_event_type_check check (
    event_type in (
      'created', 'status_changed', 'approved', 'locked', 'xm_declared', 'xm_verified',
      'tech_followup_opened', 'sup_followup_opened', 'resubmitted',
      'closed_by_leadership', 'followup_reassigned', 'case_update', 'case_status_changed'
    )
  );

insert into public.field_log_event (
  report_id, event_type, from_status, to_status, actor_user_id, note, meta
)
select
  r.report_id,
  'status_changed',
  'open',
  'closed',
  null,
  'Initial tNPS email program cutoff: cases submitted before July 12, 2026 closed prior to first digest.',
  jsonb_build_object(
    'bucket', 'workflow',
    'source', 'tnps_email_initial_cutoff_repair',
    'cutoff', '2026-07-12T04:00:00.000Z'
  )
from public.field_log_report r
join public.field_log_report_post_call pc on pc.report_id = r.report_id
where r.category_key = 'post_call'
  and r.subcategory_key in ('detractor_risk', 'tnps_detractor', 'tnps_passive')
  and r.submitted_at < '2026-07-12T04:00:00.000Z'::timestamptz
  and pc.case_status = 'closed'
  and not exists (
    select 1 from public.field_log_event e
    where e.report_id = r.report_id
      and e.meta ->> 'source' in ('tnps_email_initial_cutoff', 'tnps_email_initial_cutoff_repair')
  );

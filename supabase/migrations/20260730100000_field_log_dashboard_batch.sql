create or replace function public.field_log_dashboard_batch(
  p_pc_org_id uuid,
  p_auth_user_id uuid,
  p_scope_mode text default 'org',
  p_interest text default 'review',
  p_window_days integer default 30,
  p_limit integer default 25
) returns jsonb
language sql
stable
set search_path = public
as $$
with params as (
  select
    greatest(1, least(coalesce(p_window_days, 30), 90)) as window_days,
    greatest(1, least(coalesce(p_limit, 25), 50)) as item_limit,
    case
      when p_scope_mode = 'self' then 'self'
      else 'org'
    end as scope_mode,
    case
      when p_interest in ('my_work', 'review', 'follow_up', 'cases', 'billing', 'aging', 'history')
        then p_interest
      else 'review'
    end as interest
),
scoped as (
  select
    r.report_id,
    r.status,
    r.category_key,
    r.subcategory_key,
    r.job_number,
    r.subject_full_name,
    r.subject_tech_id,
    r.created_by_user_id,
    r.submitted_at,
    r.updated_at,
    r.approved_at,
    r.billing_email_sent_at,
    pc.case_status
  from public.field_log_report r
  cross join params p
  left join public.field_log_report_post_call pc on pc.report_id = r.report_id
  where r.pc_org_id = p_pc_org_id
    and (p.scope_mode = 'org' or r.created_by_user_id = p_auth_user_id)
    and coalesce(r.submitted_at, r.updated_at, r.created_at)
      >= now() - make_interval(days => p.window_days)
),
category_rollup as (
  select
    category_key as key,
    count(*) filter (where submitted_at is not null)::integer as submitted,
    count(*) filter (where status in ('approved', 'closed'))::integer as approved,
    count(*) filter (where status = 'rejected')::integer as rejected,
    count(*) filter (
      where status not in ('approved', 'closed', 'rejected')
    )::integer as open,
    count(*) filter (
      where status in ('tech_followup_required', 'sup_followup_required')
    )::integer as follow_up,
    count(*) filter (
      where status not in ('approved', 'closed', 'rejected')
        and coalesce(submitted_at, updated_at) < now() - interval '2 days'
    )::integer as aging,
    count(*) filter (
      where category_key = 'post_call'
        and coalesce(case_status, 'open') not in ('closed', 'resolved')
    )::integer as open_cases,
    count(*) filter (
      where category_key = 'post_call'
        and subcategory_key in ('detractor_risk', 'tnps_detractor', 'tnps_passive')
        and coalesce(case_status, 'open') not in ('closed', 'resolved')
    )::integer as tnps_open,
    count(*) filter (
      where category_key in ('new_drop', 'conduit_pull_install', 'commercial_battery_billing')
        and status = 'approved'
        and billing_email_sent_at is null
    )::integer as billing_pending
  from scoped
  group by category_key
),
totals as (
  select
    count(*) filter (where submitted_at is not null)::integer as submitted,
    count(*) filter (where status in ('approved', 'closed', 'rejected'))::integer as handled,
    count(*) filter (where status not in ('approved', 'closed', 'rejected'))::integer as open,
    count(*) filter (
      where status in ('tech_followup_required', 'sup_followup_required')
    )::integer as follow_up,
    count(*) filter (
      where status not in ('approved', 'closed', 'rejected')
        and coalesce(submitted_at, updated_at) < now() - interval '2 days'
    )::integer as aging,
    count(*) filter (
      where category_key in ('new_drop', 'conduit_pull_install', 'commercial_battery_billing')
        and status = 'approved'
        and billing_email_sent_at is null
    )::integer as billing_pending
  from scoped
),
ranked_items as (
  select s.*
  from scoped s
  cross join params p
  where
    (p.interest = 'my_work' and s.created_by_user_id = p_auth_user_id)
    or (p.interest = 'review' and s.status in ('pending_review', 'sup_followup_required'))
    or (p.interest = 'follow_up' and s.status in ('tech_followup_required', 'sup_followup_required'))
    or (
      p.interest = 'cases'
      and s.category_key = 'post_call'
      and coalesce(s.case_status, 'open') not in ('closed', 'resolved')
    )
    or (
      p.interest = 'billing'
      and s.category_key in ('new_drop', 'conduit_pull_install', 'commercial_battery_billing')
      and s.status = 'approved'
      and s.billing_email_sent_at is null
    )
    or (
      p.interest = 'aging'
      and s.status not in ('approved', 'closed', 'rejected')
      and coalesce(s.submitted_at, s.updated_at) < now() - interval '2 days'
    )
    or p.interest = 'history'
  order by
    case s.status
      when 'pending_review' then 0
      when 'sup_followup_required' then 1
      when 'tech_followup_required' then 2
      else 3
    end,
    coalesce(s.submitted_at, s.updated_at) desc nulls last
  limit (select item_limit from params)
)
select jsonb_build_object(
  'summary',
  coalesce(
    (select to_jsonb(t) from totals t),
    jsonb_build_object(
      'submitted', 0,
      'handled', 0,
      'open', 0,
      'follow_up', 0,
      'aging', 0,
      'billing_pending', 0
    )
  ),
  'categories',
  coalesce(
    (
      select jsonb_agg(to_jsonb(c) order by c.key)
      from category_rollup c
    ),
    '[]'::jsonb
  ),
  'work_items',
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'report_id', i.report_id,
          'status', i.status,
          'category_key', i.category_key,
          'subcategory_key', i.subcategory_key,
          'job_number', i.job_number,
          'subject_full_name', i.subject_full_name,
          'subject_tech_id', i.subject_tech_id,
          'submitted_at', i.submitted_at,
          'updated_at', i.updated_at,
          'case_status', i.case_status
        )
        order by
          case i.status
            when 'pending_review' then 0
            when 'sup_followup_required' then 1
            when 'tech_followup_required' then 2
            else 3
          end,
          coalesce(i.submitted_at, i.updated_at) desc nulls last
      )
      from ranked_items i
    ),
    '[]'::jsonb
  ),
  'meta',
  jsonb_build_object(
    'interest', (select interest from params),
    'scope_mode', (select scope_mode from params),
    'window_days', (select window_days from params),
    'limit', (select item_limit from params)
  )
);
$$;

revoke all on function public.field_log_dashboard_batch(uuid, uuid, text, text, integer, integer)
  from public, anon, authenticated;

grant execute on function public.field_log_dashboard_batch(uuid, uuid, text, text, integer, integer)
  to service_role;

-- Rolls back security step 5: restores the exact pre-step-5 definitions and drops the helper.
-- Run only on Ted's call: this lets signed-in users act in another user's name again.
begin;

CREATE OR REPLACE FUNCTION public.field_log_append_xm_link(p_report_id uuid, p_action_by_user_id uuid, p_xm_link text, p_note text DEFAULT NULL::text)
 RETURNS field_log_report
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_valid boolean;
  v_report public.field_log_report%rowtype;
begin
  v_valid := public.field_log_validate_xm_link(p_xm_link);

  update public.field_log_report
     set xm_link = p_xm_link,
         xm_link_valid = v_valid,
         xm_verified_by_user_id = case when v_valid then p_action_by_user_id else null end,
         xm_verified_at = case when v_valid then now() else null end
   where report_id = p_report_id
     and status in ('pending_review','sup_followup_required')
     and locked = false
  returning * into v_report;

  if v_report.report_id is null then
    raise exception 'Report not found, locked, or not reviewable: %', p_report_id;
  end if;

  insert into public.field_log_review_action (
    report_id, action_type, action_by_user_id, note
  )
  values (
    p_report_id,
    case when v_valid then 'xm_verify' else 'xm_link_append' end,
    p_action_by_user_id,
    coalesce(p_note, p_xm_link)
  );

  return v_report;
end;
$function$;

CREATE OR REPLACE FUNCTION public.field_log_approve_report(p_report_id uuid, p_action_by_user_id uuid, p_note text, p_xm_link text)
 RETURNS field_log_report
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_report public.field_log_report%rowtype;
begin
  if nullif(trim(coalesce(p_xm_link, '')), '') is not null then
    perform public.field_log_append_xm_link(
      p_report_id,
      p_action_by_user_id,
      p_xm_link,
      p_note
    );
  end if;

  select *
    into v_report
  from public.field_log_approve_report(
    p_report_id,
    p_action_by_user_id,
    p_note
  );

  return v_report;
end;
$function$;

CREATE OR REPLACE FUNCTION public.field_log_approve_report(p_report_id uuid, p_action_by_user_id uuid, p_note text DEFAULT NULL::text)
 RETURNS field_log_report
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ok boolean;
  v_report public.field_log_report%rowtype;
begin
  select public.field_log_is_approvable(p_report_id) into v_ok;

  if coalesce(v_ok, false) = false then
    raise exception 'Report is not approvable: %', p_report_id;
  end if;

  update public.field_log_report
     set status = 'approved',
         approval_owner_user_id = p_action_by_user_id,
         approved_at = now(),
         locked = true,
         edit_unlocked = false
   where report_id = p_report_id
     and locked = false
  returning * into v_report;

  if v_report.report_id is null then
    raise exception 'Approval failed for report: %', p_report_id;
  end if;

  if v_report.category_key = 'qc' then
    update public.field_log_report_qc
       set supervisor_review_decision = 'approved',
           approval_note = p_note
     where report_id = p_report_id;
  end if;

  insert into public.field_log_review_action (
    report_id, action_type, action_by_user_id, note
  )
  values (
    p_report_id, 'approve', p_action_by_user_id, p_note
  );

  return v_report;
end;
$function$;

CREATE OR REPLACE FUNCTION public.field_log_create_draft(p_created_by_user_id uuid, p_pc_org_id uuid, p_category_key text, p_subcategory_key text, p_job_number text, p_job_type text DEFAULT NULL::text, p_subject_person_id uuid DEFAULT NULL::uuid, p_subject_full_name text DEFAULT NULL::text, p_subject_tech_id text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_rule public.field_log_rules_v%rowtype;
  v_report_id uuid;
  v_existing_report_id uuid;
  v_local_today date;

  v_subject_person_id uuid;
  v_subject_full_name text;
  v_subject_tech_id text;
begin
  if p_pc_org_id is null then
    raise exception 'pc_org_id is required';
  end if;

  v_local_today := timezone('America/New_York', now())::date;

  select r.report_id
    into v_existing_report_id
  from public.field_log_report r
  where r.created_by_user_id = p_created_by_user_id
    and r.pc_org_id = p_pc_org_id
    and coalesce(r.job_number, '') = coalesce(p_job_number, '')
    and timezone('America/New_York', r.created_at)::date = v_local_today
    and r.status = 'draft'
  order by r.created_at desc
  limit 1;

  if v_existing_report_id is not null then
    return v_existing_report_id;
  end if;

  select *
    into v_rule
  from public.field_log_rules_v
  where category_key = p_category_key
    and subcategory_key is not distinct from p_subcategory_key
  limit 1;

  if v_rule.rule_id is null then
    raise exception 'No active published field log rule found for category=% subcategory=%',
      p_category_key, p_subcategory_key;
  end if;

  v_subject_person_id := p_subject_person_id;
  v_subject_full_name := nullif(trim(coalesce(p_subject_full_name, '')), '');
  v_subject_tech_id := nullif(trim(coalesce(p_subject_tech_id, '')), '');

  if v_subject_person_id is null then
    select up.person_id
      into v_subject_person_id
    from public.user_profile up
    where up.auth_user_id = p_created_by_user_id
    limit 1;
  end if;

  if v_subject_full_name is null and v_subject_person_id is not null then
    select p.full_name
      into v_subject_full_name
    from public.person p
    where p.person_id = v_subject_person_id
    limit 1;
  end if;

  if v_subject_tech_id is null and v_subject_person_id is not null then
    select a.tech_id
      into v_subject_tech_id
    from public.assignment a
    where a.person_id = v_subject_person_id
      and a.pc_org_id = p_pc_org_id
      and (a.active = true or a.active is null)
    order by coalesce(a.start_date, '1900-01-01'::date) desc
    limit 1;
  end if;

  insert into public.field_log_report (
    config_version_id,
    rule_id,
    category_key,
    subcategory_key,
    status,
    created_by_user_id,
    job_number,
    job_type,
    pc_org_id,
    subject_person_id,
    subject_full_name,
    subject_tech_id
  )
  values (
    v_rule.config_version_id,
    v_rule.rule_id,
    p_category_key,
    p_subcategory_key,
    'draft',
    p_created_by_user_id,
    p_job_number,
    p_job_type,
    p_pc_org_id,
    v_subject_person_id,
    v_subject_full_name,
    v_subject_tech_id
  )
  returning report_id into v_report_id;

  if p_category_key = 'qc' then
    insert into public.field_log_report_qc (report_id, qc_mode)
    values (v_report_id, 'self_qc');
  elsif p_category_key = 'not_done' or p_category_key = 'u_code_applied' then
    insert into public.field_log_report_not_done (report_id)
    values (v_report_id);
  elsif p_category_key = 'post_call' then
    insert into public.field_log_report_post_call (report_id)
    values (v_report_id);
  end if;

  return v_report_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.field_log_create_draft(p_created_by_user_id uuid, p_pc_org_id uuid, p_category_key text, p_subcategory_key text, p_job_number text, p_job_type text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_rule public.field_log_rules_v%rowtype;
  v_report_id uuid;
  v_existing_report_id uuid;
  v_local_today date;
begin
  if p_pc_org_id is null then
    raise exception 'pc_org_id is required';
  end if;

  v_local_today := timezone('America/New_York', now())::date;

  -- dedup: same tech + org + local date + job number + draft
  select r.report_id
    into v_existing_report_id
  from public.field_log_report r
  where r.created_by_user_id = p_created_by_user_id
    and r.pc_org_id = p_pc_org_id
    and coalesce(r.job_number, '') = coalesce(p_job_number, '')
    and timezone('America/New_York', r.created_at)::date = v_local_today
    and r.status = 'draft'
  order by r.created_at desc
  limit 1;

  if v_existing_report_id is not null then
    return v_existing_report_id;
  end if;

  select *
    into v_rule
  from public.field_log_rules_v
  where category_key = p_category_key
    and subcategory_key is not distinct from p_subcategory_key
  limit 1;

  if v_rule.rule_id is null then
    raise exception 'No active published field log rule found for category=% subcategory=%',
      p_category_key, p_subcategory_key;
  end if;

  insert into public.field_log_report (
    config_version_id,
    rule_id,
    category_key,
    subcategory_key,
    status,
    created_by_user_id,
    job_number,
    job_type,
    pc_org_id
  )
  values (
    v_rule.config_version_id,
    v_rule.rule_id,
    p_category_key,
    p_subcategory_key,
    'draft',
    p_created_by_user_id,
    p_job_number,
    p_job_type,
    p_pc_org_id
  )
  returning report_id into v_report_id;

  if p_category_key = 'qc' then
    insert into public.field_log_report_qc (report_id, qc_mode)
    values (v_report_id, 'self_qc');
  elsif p_category_key = 'not_done' or p_category_key = 'u_code_applied' then
    insert into public.field_log_report_not_done (report_id)
    values (v_report_id);
  elsif p_category_key = 'post_call' then
    insert into public.field_log_report_post_call (report_id)
    values (v_report_id);
  end if;

  return v_report_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.field_log_deny_report(p_report_id uuid, p_action_by_user_id uuid, p_note text)
 RETURNS field_log_report
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_report public.field_log_report%rowtype;
begin
  if nullif(trim(p_note), '') is null then
    raise exception 'Denial note is required.';
  end if;

  update public.field_log_report
     set status = 'rejected',
         followup_note = p_note,
         edit_unlocked = false,
         approved_at = null
   where report_id = p_report_id
     and status in ('pending_review', 'sup_followup_required')
  returning * into v_report;

  if v_report.report_id is null then
    raise exception 'Field Log is not in a denial-ready state.';
  end if;

  insert into public.field_log_review_action (
    report_id,
    action_by_user_id,
    action_type,
    note
  )
  values (
    p_report_id,
    p_action_by_user_id,
    'reject',
    p_note
  );

  return v_report;
end;
$function$;

CREATE OR REPLACE FUNCTION public.field_log_finalize_verdict(p_report_id uuid, p_action_by_user_id uuid, p_verdict text, p_note text DEFAULT NULL::text)
 RETURNS field_log_report
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_report public.field_log_report%rowtype;
  v_action_type text;
  v_qc_decision text;
  v_event_type text;
begin
  if p_verdict not in (
    'pass',
    'fail_supervisor_corrected',
    'fail_tech_followup',
    'no_action',
    'closed_by_leadership'
  ) then
    raise exception 'Invalid Field Log verdict: %', p_verdict;
  end if;

  if p_verdict in ('fail_tech_followup', 'closed_by_leadership')
     and nullif(trim(coalesce(p_note, '')), '') is null then
    raise exception '% verdict requires a note.', p_verdict;
  end if;

  if p_verdict = 'fail_tech_followup' then
    update public.field_log_report
       set status = 'tech_followup_required',
           submitted_at = coalesce(submitted_at, now()),
           followup_requested_by_user_id = p_action_by_user_id,
           followup_note = p_note,
           edit_unlocked = true,
           locked = false,
           updated_at = now()
     where report_id = p_report_id
       and locked = false
     returning * into v_report;

    v_action_type := 'tech_followup';
    v_qc_decision := 'tech_followup';
    v_event_type := 'tech_followup_opened';

  elsif p_verdict = 'closed_by_leadership' then
    update public.field_log_report
       set status = 'closed',
           submitted_at = coalesce(submitted_at, now()),
           approval_owner_user_id = p_action_by_user_id,
           approved_at = now(),
           followup_requested_by_user_id = null,
           followup_note = p_note,
           edit_unlocked = false,
           locked = true,
           updated_at = now()
     where report_id = p_report_id
       and locked = false
     returning * into v_report;

    v_action_type := 'close';
    v_qc_decision := 'closed';
    v_event_type := 'closed_by_leadership';

  else
    if exists (
      select 1
      from public.field_log_report r
      where r.report_id = p_report_id
        and coalesce(r.xm_declared, false) = true
        and coalesce(r.xm_link_valid, false) = false
    ) then
      raise exception 'XM evidence cannot be finalized without a validated XM link.';
    end if;

    update public.field_log_report
       set status = 'approved',
           submitted_at = coalesce(submitted_at, now()),
           approval_owner_user_id = p_action_by_user_id,
           approved_at = now(),
           followup_requested_by_user_id = null,
           followup_note = p_note,
           edit_unlocked = false,
           locked = true,
           updated_at = now()
     where report_id = p_report_id
       and locked = false
     returning * into v_report;

    v_action_type := case when p_verdict = 'no_action' then 'reject' else 'approve' end;
    v_qc_decision := case when p_verdict = 'no_action' then 'rejected' else 'approved' end;
    v_event_type := 'approved';
  end if;

  if v_report.report_id is null then
    raise exception 'Verdict finalize failed for report: %', p_report_id;
  end if;

  if v_report.category_key = 'qc' then
    update public.field_log_report_qc
       set supervisor_review_decision = v_qc_decision,
           approval_note = p_note
     where report_id = p_report_id;
  end if;

  insert into public.field_log_review_action (
    report_id,
    action_type,
    action_by_user_id,
    note
  )
  values (
    p_report_id,
    v_action_type,
    p_action_by_user_id,
    p_note
  );

  insert into public.field_log_event (
    report_id,
    event_type,
    from_status,
    to_status,
    actor_user_id,
    note,
    meta
  )
  values (
    p_report_id,
    v_event_type,
    null,
    v_report.status,
    p_action_by_user_id,
    p_note,
    jsonb_build_object(
      'verdict', p_verdict,
      'review_action_type', v_action_type
    )
  );

  return v_report;
end;
$function$;

CREATE OR REPLACE FUNCTION public.field_log_reassign_followup(p_report_id uuid, p_action_by_user_id uuid, p_followup_owner_person_id uuid, p_note text DEFAULT NULL::text)
 RETURNS field_log_report
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_report public.field_log_report%rowtype;
  v_from_owner_person_id uuid;
begin
  if p_report_id is null then
    raise exception 'report_id is required.';
  end if;

  if p_action_by_user_id is null then
    raise exception 'action_by_user_id is required.';
  end if;

  if p_followup_owner_person_id is null then
    raise exception 'followup_owner_person_id is required.';
  end if;

  select r.followup_owner_person_id
    into v_from_owner_person_id
  from public.field_log_report r
  where r.report_id = p_report_id;

  update public.field_log_report
     set followup_owner_person_id = p_followup_owner_person_id,
         followup_assigned_at = now(),
         followup_assigned_by_user_id = p_action_by_user_id,
         followup_assignment_note = p_note,
         updated_at = now()
   where report_id = p_report_id
     and status in ('tech_followup_required', 'sup_followup_required')
     and locked = false
   returning * into v_report;

  if v_report.report_id is null then
    raise exception 'Follow-up reassignment failed for report: %', p_report_id;
  end if;

  insert into public.field_log_review_action (
    report_id,
    action_type,
    action_by_user_id,
    note
  )
  values (
    p_report_id,
    'reassign_followup',
    p_action_by_user_id,
    p_note
  );

  insert into public.field_log_event (
    report_id,
    event_type,
    from_status,
    to_status,
    actor_user_id,
    note,
    meta
  )
  values (
    p_report_id,
    'followup_reassigned',
    v_report.status,
    v_report.status,
    p_action_by_user_id,
    p_note,
    jsonb_build_object(
      'from_followup_owner_person_id', v_from_owner_person_id,
      'to_followup_owner_person_id', p_followup_owner_person_id,
      'review_action_type', 'reassign_followup'
    )
  );

  return v_report;
end;
$function$;

CREATE OR REPLACE FUNCTION public.field_log_request_sup_followup(p_report_id uuid, p_action_by_user_id uuid, p_note text DEFAULT NULL::text)
 RETURNS field_log_report
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_report public.field_log_report%rowtype;
begin
  update public.field_log_report
     set status = 'sup_followup_required',
         approval_owner_user_id = p_action_by_user_id,
         followup_requested_by_user_id = p_action_by_user_id,
         followup_note = p_note,
         edit_unlocked = false
   where report_id = p_report_id
     and status = 'pending_review'
     and locked = false
  returning * into v_report;

  if v_report.report_id is null then
    raise exception 'Supervisor follow-up failed for report: %', p_report_id;
  end if;

  if v_report.category_key = 'qc' then
    update public.field_log_report_qc
       set supervisor_review_decision = 'sup_followup',
           approval_note = p_note
     where report_id = p_report_id;
  end if;

  insert into public.field_log_review_action (
    report_id, action_type, action_by_user_id, note
  )
  values (
    p_report_id, 'sup_followup', p_action_by_user_id, p_note
  );

  return v_report;
end;
$function$;

CREATE OR REPLACE FUNCTION public.field_log_request_tech_followup(p_report_id uuid, p_action_by_user_id uuid, p_note text DEFAULT NULL::text)
 RETURNS field_log_report
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_report public.field_log_report%rowtype;
begin
  update public.field_log_report
     set status = 'tech_followup_required',
         followup_requested_by_user_id = p_action_by_user_id,
         followup_note = p_note,
         edit_unlocked = true,
         xm_declared = false,
         xm_link = null,
         xm_link_valid = false,
         xm_verified_by_user_id = null,
         xm_verified_at = null
   where report_id = p_report_id
     and status in ('pending_review','sup_followup_required')
     and locked = false
  returning * into v_report;

  if v_report.report_id is null then
    raise exception 'Tech follow-up failed for report: %', p_report_id;
  end if;

  if v_report.category_key = 'qc' then
    update public.field_log_report_qc
       set supervisor_review_decision = 'tech_followup',
           approval_note = p_note
     where report_id = p_report_id;
  end if;

  insert into public.field_log_review_action (
    report_id, action_type, action_by_user_id, note
  )
  values (
    p_report_id, 'tech_followup', p_action_by_user_id, p_note
  );

  return v_report;
end;
$function$;

drop function if exists public.field_log_assert_acting_user(uuid);

commit;

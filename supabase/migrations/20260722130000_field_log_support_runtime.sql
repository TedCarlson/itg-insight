begin;

CREATE OR REPLACE FUNCTION public.field_log_get_report_detail(p_report_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
select jsonb_build_object(
  'report_id', d.report_id,
  'config_version_id', d.config_version_id,
  'rule_id', d.rule_id,

  'category_key', d.category_key,
  'category_label', d.category_label,
  'subcategory_key', d.subcategory_key,
  'subcategory_label', d.subcategory_label,

  'status', d.status,

  'entry_source_role',
  case
    when d.created_by_user_id is null then null
    when d.tech_person_id is not null
      and exists (
        select 1
        from public.user_profile up
        where up.auth_user_id = d.created_by_user_id
          and (
            up.person_id = d.tech_person_id
            or up.core_person_id = d.tech_person_id
          )
      )
      then 'TECH'
    when exists (
      select 1
      from public.user_profile up
      join public.company_profile_fact cpf
        on cpf.person_id = coalesce(up.person_id, up.core_person_id)
       and cpf.pc_org_id = d.pc_org_id
      where up.auth_user_id = d.created_by_user_id
        and cpf.active_flag = true
        and cpf.effective_start_date <= current_date
        and (cpf.effective_end_date is null or cpf.effective_end_date >= current_date)
        and (
          upper(trim(coalesce(cpf.role_type, ''))) = 'SUPPORT'
          or lower(trim(coalesce(cpf.position_title, ''))) = 'support'
        )
    )
      then 'SUPPORT'
    else 'ITG_SUPERVISOR'
  end,

'workflow_mode',
  case
    when d.created_by_user_id is null then null
    when d.tech_person_id is not null
      and exists (
        select 1
        from public.user_profile up
        where up.auth_user_id = d.created_by_user_id
          and (
            up.person_id = d.tech_person_id
            or up.core_person_id = d.tech_person_id
          )
      )
      then 'tech_submission'
    when exists (
      select 1
      from public.user_profile up
      join public.company_profile_fact cpf
        on cpf.person_id = coalesce(up.person_id, up.core_person_id)
       and cpf.pc_org_id = d.pc_org_id
      where up.auth_user_id = d.created_by_user_id
        and cpf.active_flag = true
        and cpf.effective_start_date <= current_date
        and (cpf.effective_end_date is null or cpf.effective_end_date >= current_date)
        and (
          upper(trim(coalesce(cpf.role_type, ''))) = 'SUPPORT'
          or lower(trim(coalesce(cpf.position_title, ''))) = 'support'
        )
    )
      then 'qc_event_entry'
    else 'supervisor_verdict'
  end,

'requires_approval_to_close',
  (
    d.tech_person_id is not null
    and exists (
      select 1
      from public.user_profile up
      where up.auth_user_id = d.created_by_user_id
        and (
          up.person_id = d.tech_person_id
          or up.core_person_id = d.tech_person_id
        )
    )
  ),

'can_close_on_entry',
  (
    d.created_by_user_id is not null
    and not (
      d.tech_person_id is not null
      and exists (
        select 1
        from public.user_profile up
        where up.auth_user_id = d.created_by_user_id
          and (
            up.person_id = d.tech_person_id
            or up.core_person_id = d.tech_person_id
          )
      )
    )
  ),

  'created_at', d.created_at,
  'updated_at', d.updated_at,
  'created_by_user_id', d.created_by_user_id,
  'submitted_at', d.submitted_at,

  'job_number', d.job_number,
  'job_type', d.job_type,
  'comment', d.comment,

  'evidence_declared', d.evidence_declared,
  'xm_declared', d.xm_declared,
  'xm_link', d.xm_link,
  'xm_link_valid', d.xm_link_valid,
  'xm_verified_by_user_id', d.xm_verified_by_user_id,
  'xm_verified_at', d.xm_verified_at,

  'photo_count', d.photo_count,
  'photo_deleted_at', d.photo_deleted_at,

  'gps_lat', d.gps_lat,
  'gps_lng', d.gps_lng,
  'gps_accuracy_m', d.gps_accuracy_m,
  'location_captured_at', d.location_captured_at,

  'approval_owner_user_id', d.approval_owner_user_id,
  'approved_at', d.approved_at,
  'followup_requested_by_user_id', d.followup_requested_by_user_id,
  'followup_note', d.followup_note,

  'edit_unlocked', d.edit_unlocked,
  'locked', d.locked,

  'rule', jsonb_build_object(
    'show_subcategory', d.show_subcategory,
    'require_subcategory', d.require_subcategory,
    'show_ucode', d.show_ucode,
    'require_ucode', d.require_ucode,
    'ucode_group_key', d.ucode_group_key,
    'ucodes', d.ucodes_json,
    'xm_allowed', d.xm_allowed,
    'comment_required', d.comment_required,
    'min_photo_count', d.min_photo_count,
    'location_required', d.location_required,
    'location_compare_required', d.location_compare_required,
    'location_tolerance_m', d.location_tolerance_m,
    'allow_technician_submit', d.allow_technician_submit,
    'allow_supervisor_submit', d.allow_supervisor_submit,
    'active_text_instruction', d.active_text_instruction,
    'photo_requirements', d.photo_requirements_json
  ),

  'qc', jsonb_build_object(
    'qc_mode', d.qc_mode,
    'supervisor_review_decision', d.supervisor_review_decision,
    'approval_note', d.qc_approval_note
  ),

  'not_done', jsonb_build_object(
    'selected_ucode', d.selected_ucode,
    'customer_contact_attempted', d.customer_contact_attempted,
    'access_issue', d.access_issue,
    'safety_issue', d.safety_issue,
    'escalation_required', d.escalation_required,
    'escalation_type', d.escalation_type
  ),

  'post_call', jsonb_build_object(
    'risk_level', d.risk_level,
    'tnps_risk_flag', d.tnps_risk_flag,
    'followup_recommended', d.followup_recommended
  ),

  'attachments', d.attachments_json,
  'actions', d.actions_json,

  'created_by_full_name', d.created_by_full_name,
  'tech_person_id', d.tech_person_id,
  'tech_full_name', d.tech_full_name,
  'tech_id', d.tech_id,
  'xm_verified_by_full_name', d.xm_verified_by_full_name,
  'approved_by_full_name', d.approved_by_full_name,
  'followup_requested_by_full_name', d.followup_requested_by_full_name
)
from public.field_log_report_detail_v d
where d.report_id = p_report_id;
$$;

comment on function public.field_log_get_report_detail(uuid) is
'Field Log runtime recognizes an active SUPPORT workforce seat in the report PC organization and maps it to qc_event_entry.';

commit;

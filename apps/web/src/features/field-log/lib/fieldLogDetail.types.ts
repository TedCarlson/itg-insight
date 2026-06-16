export type FieldLogRule = {
  show_subcategory: boolean;
  require_subcategory: boolean;
  show_ucode: boolean;
  require_ucode: boolean;
  ucode_group_key: string | null;
  ucodes: Array<{ ucode: string; label: string; sort_order: number }>;
  xm_allowed: boolean;
  comment_required: boolean;
  min_photo_count: number;
  location_required: boolean;
  location_compare_required: boolean;
  location_tolerance_m: number | null;
  allow_technician_submit: boolean;
  allow_supervisor_submit: boolean;
  active_text_instruction: string | null;
  photo_requirements: Array<{
    photo_label_key: string;
    label: string;
    required: boolean;
    sort_order: number;
  }>;
};

export type FieldLogQcDetail = {
  qc_mode: string | null;
  supervisor_review_decision: string | null;
  approval_note: string | null;
};

export type FieldLogNotDoneDetail = {
  selected_ucode: string | null;
  customer_contact_attempted: boolean | null;
  access_issue: boolean | null;
  safety_issue: boolean | null;
  escalation_required: boolean | null;
  escalation_type: string | null;
};

export type FieldLogPostCallDetail = {
  risk_level: string | null;
  tnps_risk_flag: boolean | null;
  followup_recommended: boolean | null;
  technician_comments?: string | null;
  customer_contact_feedback?: string | null;
  lessons_takeaways?: string | null;
  case_status?: string | null;
  closed_at?: string | null;
  reopened_at?: string | null;
};

export type FieldLogAttachment = {
  attachment_id: string;
  photo_label_key: string | null;
  file_path: string;
  file_name: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  uploaded_at: string | null;
  deleted_at: string | null;
};

export type FieldLogReviewAction = {
  review_action_id: string;
  action_at: string;
  action_by_user_id: string | null;
  action_type: string;
  note: string | null;
};

export type FieldLogTimelineEvent = {
  event_id: string;
  event_at: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  actor_user_id: string | null;
  note: string | null;
  meta: Record<string, unknown>;
};

export type FieldLogDetailPayload = {
  report_id: string;
  pc_org_id?: string | null;
  category_key: string;
  category_label: string | null;
  subcategory_key: string | null;
  subcategory_label: string | null;
  status: string;
  entry_source_role?: string | null;
  workflow_mode?: string | null;
  requires_approval_to_close?: boolean | null;
  can_close_on_entry?: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  created_by_user_id: string | null;
  submitted_at: string | null;
  job_number: string;
  job_type: string | null;
  comment: string | null;
  evidence_declared: string | null;
  xm_declared: boolean;
  xm_link: string | null;
  xm_link_valid: boolean;
  xm_verified_by_user_id: string | null;
  xm_verified_at: string | null;
  photo_count: number;
  photo_deleted_at: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  gps_accuracy_m: number | null;
  location_captured_at: string | null;
  approval_owner_user_id: string | null;
  approved_at: string | null;
  followup_requested_by_user_id: string | null;
  followup_note: string | null;
  followup_owner_person_id?: string | null;
  followup_assigned_at?: string | null;
  followup_assigned_by_user_id?: string | null;
  followup_assignment_note?: string | null;
  edit_unlocked: boolean;
  locked: boolean;
  rule: FieldLogRule;
  qc: FieldLogQcDetail;
  not_done: FieldLogNotDoneDetail;
  post_call: FieldLogPostCallDetail;
  attachments: FieldLogAttachment[];
  actions: FieldLogReviewAction[];
};

export type FieldLogApiResponse<T = unknown> = {
  ok: boolean;
  data?: T;
  error?: string;
};
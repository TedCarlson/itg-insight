import type { AppRole } from "@/shared/navigation/types";

export type FieldLogEntrySource = AppRole | "QC_AGENT";

export type FieldLogWorkflowMode =
  | "tech_submission"
  | "supervisor_verdict"
  | "leadership_epi_entry"
  | "qc_event_entry"
  | "unavailable";

export type FieldLogVerdict =
  | "pass"
  | "fail_supervisor_corrected"
  | "fail_tech_followup"
  | "no_action"
  | "closed_by_leadership";

export type FieldLogWorkflowAction =
  | "submit"
  | "resubmit"
  | "approve"
  | "request_tech_followup"
  | "finalize_pass"
  | "finalize_supervisor_corrected"
  | "finalize_tech_followup"
  | "mark_no_action";

export type FieldLogWorkflowModel = {
  entrySource: FieldLogEntrySource;
  workflowMode: FieldLogWorkflowMode;

  isTechSourced: boolean;
  requiresApprovalToClose: boolean;

  canSubmitEntry: boolean;
  canApprove: boolean;
  canCloseOnEntry: boolean;
  canAssignFinalVerdict: boolean;

  allowedActions: FieldLogWorkflowAction[];
  verdictOptions: FieldLogVerdict[];

  reviewLabel: string;
  primaryActionLabel: string;
};

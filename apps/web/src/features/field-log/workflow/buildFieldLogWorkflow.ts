import type {
  FieldLogEntrySource,
  FieldLogVerdict,
  FieldLogWorkflowAction,
  FieldLogWorkflowMode,
  FieldLogWorkflowModel,
} from "./fieldLogWorkflow.types";

const SUPERVISOR_SOURCES: FieldLogEntrySource[] = [
  "ITG_SUPERVISOR",
  "BP_SUPERVISOR",
];

const LEADERSHIP_SOURCES: FieldLogEntrySource[] = [
  "COMPANY_MANAGER",
  "BP_LEAD",
  "BP_OWNER",
  "DIRECTOR",
  "APP_OWNER",
  "ADMIN",
];

function resolveWorkflowMode(
  entrySource: FieldLogEntrySource,
): FieldLogWorkflowMode {
  if (entrySource === "TECH") return "tech_submission";
  if (entrySource === "QC_AGENT") return "qc_event_entry";
  if (SUPERVISOR_SOURCES.includes(entrySource)) return "supervisor_verdict";
  if (LEADERSHIP_SOURCES.includes(entrySource)) return "leadership_epi_entry";
  return "unavailable";
}

function nonTechVerdicts(): FieldLogVerdict[] {
  return [
    "pass",
    "fail_supervisor_corrected",
    "fail_tech_followup",
    "no_action",
  ];
}

function nonTechActions(): FieldLogWorkflowAction[] {
  return [
    "finalize_pass",
    "finalize_supervisor_corrected",
    "finalize_tech_followup",
    "mark_no_action",
  ];
}

export function buildFieldLogWorkflow(args: {
  entrySource: FieldLogEntrySource;
  status?: string | null;
}): FieldLogWorkflowModel {
  const { entrySource } = args;

  const workflowMode = resolveWorkflowMode(entrySource);
  const isTechSourced = entrySource === "TECH";
  const isUnavailable = workflowMode === "unavailable";

  if (isUnavailable) {
    return {
      entrySource,
      workflowMode,
      isTechSourced: false,
      requiresApprovalToClose: false,
      canSubmitEntry: false,
      canApprove: false,
      canCloseOnEntry: false,
      canAssignFinalVerdict: false,
      allowedActions: [],
      verdictOptions: [],
      reviewLabel: "Unavailable",
      primaryActionLabel: "Unavailable",
    };
  }

  if (isTechSourced) {
    return {
      entrySource,
      workflowMode,
      isTechSourced: true,
      requiresApprovalToClose: true,
      canSubmitEntry: true,
      canApprove: false,
      canCloseOnEntry: false,
      canAssignFinalVerdict: false,
      allowedActions: ["submit", "resubmit"],
      verdictOptions: [],
      reviewLabel: "Tech Submission",
      primaryActionLabel: "Submit for Review",
    };
  }

  return {
    entrySource,
    workflowMode,
    isTechSourced: false,
    requiresApprovalToClose: false,
    canSubmitEntry: true,
    canApprove: true,
    canCloseOnEntry: true,
    canAssignFinalVerdict: true,
    allowedActions: nonTechActions(),
    verdictOptions: nonTechVerdicts(),
    reviewLabel:
      workflowMode === "qc_event_entry"
        ? "QC Event Entry"
        : workflowMode === "supervisor_verdict"
          ? "Supervisor Verdict"
          : "Leadership EPI Entry",
    primaryActionLabel: "Finalize Entry",
  };
}

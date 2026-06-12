import type { FieldLogVerdict } from "./fieldLogWorkflow.types";

export type FieldLogOutcomeAction = {
  action: string;
  label: string;
  tone?: "default" | "danger" | "success";
};

export type FieldLogOutcomeProfile = {
  primaryActions: FieldLogOutcomeAction[];
};

export const FIELD_LOG_OUTCOME_PROFILES: Record<
  string,
  FieldLogOutcomeProfile
> = {
  qc: {
    primaryActions: [
      {
        action: "pass",
        label: "Pass QC",
        tone: "success",
      },
      {
        action: "fail_supervisor_corrected",
        label: "Fail — Supervisor Corrected",
      },
      {
        action: "fail_tech_followup",
        label: "Fail — Tech Follow-Up",
        tone: "danger",
      },
    ],
  },

  not_done: {
    primaryActions: [
      {
        action: "pass",
        label: "Approve U-Code",
        tone: "success",
      },
      {
        action: "fail_tech_followup",
        label: "Invalid / Reject",
        tone: "danger",
      },
    ],
  },

  post_call: {
    primaryActions: [
      {
        action: "close",
        label: "Notate & Close Follow-Up",
        tone: "success",
      },
    ],
  },

  new_drop: {
    primaryActions: [
      {
        action: "pass",
        label: "Approve New Drop",
        tone: "success",
      },
    ],
  },

  conduit_pull_install: {
    primaryActions: [
      {
        action: "pass",
        label: "Approve Conduit Pull",
        tone: "success",
      },
    ],
  },

  epi: {
    primaryActions: [
      {
        action: "acknowledge",
        label: "Acknowledge Event",
      },
      {
        action: "update",
        label: "Notate / Update",
      },
      {
        action: "close",
        label: "Close",
        tone: "success",
      },
    ],
  },
};

export function getFieldLogOutcomeProfile(
  categoryKey: string | null | undefined,
): FieldLogOutcomeProfile {
  return (
    FIELD_LOG_OUTCOME_PROFILES[
      String(categoryKey ?? "").trim()
    ] ??
    FIELD_LOG_OUTCOME_PROFILES.epi
  );
}


export function outcomeActionToVerdict(action: string): FieldLogVerdict {
  if (action === "close") return "pass";
  if (action === "acknowledge") return "pass";
  if (action === "update") return "no_action";
  if (action === "pass") return "pass";
  if (action === "fail_supervisor_corrected") return "fail_supervisor_corrected";
  if (action === "fail_tech_followup") return "fail_tech_followup";
  return "no_action";
}

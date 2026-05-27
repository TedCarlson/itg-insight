"use client";

import type { FieldLogWorkflowModel } from "../workflow";

function yesNo(value: boolean) {
  return value ? "Yes" : "No";
}

export function FieldLogWorkflowCard(props: {
  workflow: FieldLogWorkflowModel;
  recordEntrySourceRole?: string | null;
  recordWorkflowMode?: string | null;
  requiresApprovalToClose?: boolean | null;
  canCloseOnEntry?: boolean | null;
}) {
  const source = props.recordEntrySourceRole ?? props.workflow.entrySource;
  const mode = props.recordWorkflowMode ?? props.workflow.workflowMode;
  const requiresApproval =
    props.requiresApprovalToClose ?? props.workflow.requiresApprovalToClose;
  const canCloseOnEntry =
    props.canCloseOnEntry ?? props.workflow.canCloseOnEntry;

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="text-base font-semibold">Workflow</div>

      <div className="mt-3 grid gap-2 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Entry Source</span>
          <span className="font-medium">{source}</span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Mode</span>
          <span className="font-medium">{mode}</span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Requires Approval to Close</span>
          <span className="font-medium">{yesNo(requiresApproval)}</span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Can Close on Entry</span>
          <span className="font-medium">{yesNo(canCloseOnEntry)}</span>
        </div>
      </div>
    </section>
  );
}

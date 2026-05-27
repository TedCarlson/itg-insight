"use client";

import type { FieldLogVerdict, FieldLogWorkflowModel } from "../workflow";
import {
  getFieldLogOutcomeProfile,
  outcomeActionToVerdict,
} from "../workflow/fieldLogOutcomeProfiles";

type FieldLogVerdictActionsCardProps = {
  busy: boolean;
  workflow: FieldLogWorkflowModel;
  categoryKey: string;
  note: string;
  onNoteChange: (value: string) => void;
  onFinalizeVerdict: (verdict: FieldLogVerdict) => void | Promise<void>;
};

function buttonClass(tone?: "default" | "danger" | "success") {
  if (tone === "success") {
    return "rounded-xl bg-green-600 px-4 py-3 font-semibold text-white disabled:opacity-60";
  }

  if (tone === "danger") {
    return "rounded-xl border border-red-300 px-4 py-3 font-semibold text-red-700 disabled:opacity-60";
  }

  return "rounded-xl border px-4 py-3 font-semibold disabled:opacity-60";
}

export function FieldLogVerdictActionsCard(props: FieldLogVerdictActionsCardProps) {
  const {
    busy,
    workflow,
    categoryKey,
    note,
    onNoteChange,
    onFinalizeVerdict,
  } = props;

  if (workflow.isTechSourced || !workflow.canAssignFinalVerdict) return null;

  const profile = getFieldLogOutcomeProfile(categoryKey);

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="text-base font-semibold">{workflow.reviewLabel}</div>

      <div className="mt-2 text-sm text-muted-foreground">
        Non-tech entries can be finalized during entry and remain auditable.
      </div>

      <div className="mt-3 space-y-2">
        <div className="text-sm font-medium">Verdict Note</div>
        <textarea
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="Document the decision, correction, or closure note…"
          rows={4}
          className="w-full rounded-xl border px-3 py-3"
        />
      </div>

      <div className="mt-4 grid gap-2">
        {profile.primaryActions.map((action) => (
          <button
            key={action.action}
            type="button"
            disabled={busy}
            onClick={() => void onFinalizeVerdict(outcomeActionToVerdict(action.action))}
            className={buttonClass(action.tone)}
          >
            {action.label}
          </button>
        ))}
      </div>
    </section>
  );
}

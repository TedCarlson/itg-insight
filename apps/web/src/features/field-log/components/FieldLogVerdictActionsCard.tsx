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
  xmAllowed: boolean;
  xmDeclared: boolean;
  evidenceDeclared?: string | null;
  existingXmLink?: string | null;
  xmLinkValid: boolean;
  xmLink: string;
  onXmLinkChange: (value: string) => void;
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
    xmAllowed,
    xmDeclared,
    evidenceDeclared,
    existingXmLink,
    xmLinkValid,
    xmLink,
    onXmLinkChange,
    onNoteChange,
    onFinalizeVerdict,
  } = props;

  if (workflow.isTechSourced || !workflow.canAssignFinalVerdict) return null;

  const profile = getFieldLogOutcomeProfile(categoryKey);
  const isNewDrop = categoryKey === "new_drop";
  const xmRequired = xmAllowed && (xmDeclared || evidenceDeclared === "xm_platform");
  const effectiveXmLink =
    String(xmLink ?? "").trim() || String(existingXmLink ?? "").trim();
  const xmBlocked = xmRequired && !xmLinkValid && effectiveXmLink.length === 0;

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="text-base font-semibold">
        {isNewDrop ? "New Drop Review" : workflow.reviewLabel}
      </div>

      <div className="mt-2 text-sm text-muted-foreground">
        {isNewDrop
          ? "Review the submitted New Drop evidence and approve the record."
          : "Review and finalize this non-tech Field Log record."}
      </div>

      {xmRequired ? (
        <div className="mt-4 rounded-xl border bg-muted/30 p-3">
          <div className="text-sm font-semibold">XM Evidence Validation</div>
          <div className="mt-1 text-sm text-muted-foreground">
            This record claims XM evidence. Paste the XM link before finalizing.
          </div>

          <input
            value={String(xmLink ?? existingXmLink ?? "")}
            onChange={(e) => onXmLinkChange(e.target.value)}
            placeholder="https://xm.optek.comcast.net/..."
            className="mt-3 w-full rounded-xl border px-3 py-3"
          />

          <div className={`mt-2 text-sm font-medium ${xmLinkValid ? "text-green-600" : xmBlocked ? "text-red-600" : "text-blue-600"}`}>
            {xmLinkValid
              ? "XM link validated."
              : xmBlocked
                ? "XM link required before finalizing."
                : "XM link entered. Finalize will validate and append it."}
          </div>
        </div>
      ) : null}

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
            disabled={busy || xmBlocked}
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

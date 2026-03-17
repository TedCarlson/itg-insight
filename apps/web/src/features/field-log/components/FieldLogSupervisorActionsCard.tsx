// Replace the entire file:
// apps/web/src/features/field-log/components/FieldLogSupervisorActionsCard.tsx

"use client";

type FieldLogSupervisorActionsCardProps = {
  busy: boolean;
  canApprove: boolean;
  xmAllowed: boolean;
  xmDeclared: boolean;
  xmLinkValid: boolean;
  xmLink: string;
  followupNote: string;

  photoCount: number;
  minPhotoCount: number;

  onXmLinkChange: (value: string) => void;
  onFollowupNoteChange: (value: string) => void;
  onApprove: () => void | Promise<void>;
  onRequestTechFollowup: () => void | Promise<void>;
  onRequestSupervisorFollowup: () => void | Promise<void>;
};

export function FieldLogSupervisorActionsCard(
  props: FieldLogSupervisorActionsCardProps,
) {
  const {
    busy,
    canApprove,
    xmAllowed,
    xmDeclared,
    xmLinkValid,
    xmLink,
    followupNote,
    photoCount,
    minPhotoCount,
    onXmLinkChange,
    onFollowupNoteChange,
    onApprove,
    onRequestTechFollowup,
    onRequestSupervisorFollowup,
  } = props;

  if (!canApprove) return null;

  const xmApprovalRequired = xmAllowed && xmDeclared;
  const hasXmCandidate = xmLinkValid || xmLink.trim().length > 0;

  const photosRequired = !xmApprovalRequired && minPhotoCount > 0;
  const photoGap = Math.max(0, minPhotoCount - photoCount);
  const photoRequirementMet = photoCount >= minPhotoCount;

  const approvalBlocked =
    (xmApprovalRequired && !hasXmCandidate) ||
    (photosRequired && !photoRequirementMet);

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="text-base font-semibold">Supervisor Actions</div>

      <div className="mt-3 rounded-xl border bg-muted/30 p-3 text-sm">
        <div className="font-medium">Approval Check</div>

        {xmApprovalRequired ? (
          <div className="mt-2 space-y-1 text-muted-foreground">
            <div>
              XM evidence required: <span className="font-medium text-foreground">Yes</span>
            </div>
            <div>
              XM status:{" "}
              <span className={`font-medium ${xmLinkValid ? "text-green-600" : "text-red-600"}`}>
                {xmLinkValid
                  ? "Validated"
                  : xmLink.trim().length > 0
                    ? "Ready to validate on approval"
                    : "Missing"}
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-2 space-y-1 text-muted-foreground">
            <div>
              Photos uploaded:{" "}
              <span className="font-medium text-foreground">
                {photoCount} / {minPhotoCount}
              </span>
            </div>

            {photoRequirementMet ? (
              <div className="font-medium text-green-600">
                Photo requirement met. Ready for approval.
              </div>
            ) : (
              <div className="font-medium text-amber-600">
                {photoGap} more photo{photoGap === 1 ? "" : "s"} required before approval.
              </div>
            )}
          </div>
        )}
      </div>

      {xmApprovalRequired ? (
        <div className="mt-3 space-y-3">
          <input
            value={xmLink}
            onChange={(e) => onXmLinkChange(e.target.value)}
            placeholder="https://xm.optek.comcast.net/..."
            className="w-full rounded-xl border px-3 py-3"
          />

          {xmLinkValid ? (
            <div className="text-sm font-medium text-green-600">
              XM link validated. Ready for approval.
            </div>
          ) : xmLink.trim().length > 0 ? (
            <div className="text-sm font-medium text-blue-600">
              XM link entered. Approval will validate and append it.
            </div>
          ) : (
            <div className="text-sm font-medium text-red-600">
              XM link required before approval.
            </div>
          )}
        </div>
      ) : null}

      <div className="mt-3 space-y-2">
        <div className="text-sm font-medium">Supervisor Note</div>
        <textarea
          value={followupNote}
          onChange={(e) => onFollowupNoteChange(e.target.value)}
          placeholder="Add a short note for approval or follow-up…"
          rows={4}
          className="w-full rounded-xl border px-3 py-3"
        />
        <div className="text-xs text-muted-foreground">
          Recommended for all review actions. Required for follow-up requests.
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        <button
          type="button"
          disabled={busy || approvalBlocked}
          onClick={() => void onApprove()}
          className={`rounded-xl px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${
            approvalBlocked ? "bg-slate-400" : "bg-blue-600"
          }`}
        >
          {busy ? "Working…" : "Approve"}
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => void onRequestTechFollowup()}
          className="rounded-xl border px-4 py-3 font-semibold"
        >
          Request Tech Follow-Up
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => void onRequestSupervisorFollowup()}
          className="rounded-xl border px-4 py-3 font-semibold"
        >
          Supervisor Follow-Up
        </button>
      </div>
    </section>
  );
}
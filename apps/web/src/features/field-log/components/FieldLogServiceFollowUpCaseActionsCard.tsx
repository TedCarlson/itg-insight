"use client";

type CaseStatus =
  | "open"
  | "in_progress"
  | "pending_customer"
  | "resolved"
  | "closed"
  | "reopened";

type Props = {
  busy: boolean;
  uploadingEvidence: boolean;
  visible: boolean;
  caseStatus: string | null;
  technicianComments: string;
  customerContactFeedback: string;
  lessonsTakeaways: string;
  appendNote: string;
  onTechnicianCommentsChange: (value: string) => void;
  onCustomerContactFeedbackChange: (value: string) => void;
  onLessonsTakeawaysChange: (value: string) => void;
  onAppendNoteChange: (value: string) => void;
  onCommitUpdate: () => void | Promise<void>;
  onAppendNote: () => void | Promise<void>;
  onChangeStatus: (status: CaseStatus) => void | Promise<void>;
  onPickEvidenceFiles: (event: React.ChangeEvent<HTMLInputElement>) => void | Promise<void>;
};

function niceStatus(value: string | null | undefined) {
  return (value ?? "open").replaceAll("_", " ").toUpperCase();
}

export function FieldLogServiceFollowUpCaseActionsCard(props: Props) {
  const {
    busy,
    uploadingEvidence,
    visible,
    caseStatus,
    technicianComments,
    customerContactFeedback,
    lessonsTakeaways,
    appendNote,
    onTechnicianCommentsChange,
    onCustomerContactFeedbackChange,
    onLessonsTakeawaysChange,
    onAppendNoteChange,
    onCommitUpdate,
    onAppendNote,
    onChangeStatus,
    onPickEvidenceFiles,
  } = props;

  if (!visible) return null;

  const normalizedStatus = caseStatus ?? "open";
  const isClosed = normalizedStatus === "closed";
  const disabled = busy || uploadingEvidence;

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold">Case Management</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Status: <span className="font-medium text-foreground">{niceStatus(normalizedStatus)}</span>
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            Add updates, upload evidence, and move this case through close or reopen.
          </div>
        </div>
      </div>

      {isClosed ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          This case is closed. You can still append updates, upload evidence, or reopen it.
        </div>
      ) : null}

      <div className="mt-4 rounded-xl border border-dashed p-3">
        <label className="block space-y-2">
          <span className="text-sm font-medium">Add Case Update</span>
          <textarea
            value={appendNote}
            onChange={(e) => onAppendNoteChange(e.target.value)}
            rows={4}
            placeholder="Add customer contact, correction, follow-up note, or case progress."
            disabled={disabled}
            className="w-full rounded-xl border px-3 py-3 disabled:bg-muted/40 disabled:text-muted-foreground"
          />
        </label>

        <button
          type="button"
          disabled={disabled || !appendNote.trim()}
          onClick={() => void onAppendNote()}
          className="mt-3 w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Adding Update…" : "Add Update"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block rounded-xl border px-3 py-3 text-sm">
          <div className="font-medium">Upload Evidence</div>
          <div className="mt-1 text-muted-foreground">
            Add images, PDFs, or support files.
          </div>
          <input
            type="file"
            accept="image/*,application/pdf"
            multiple
            disabled={disabled}
            className="mt-3 block w-full text-sm"
            onChange={(e) => void onPickEvidenceFiles(e)}
          />
        </label>

        <label className="block rounded-xl border px-3 py-3 text-sm">
          <div className="font-medium">Capture Evidence</div>
          <div className="mt-1 text-muted-foreground">
            Use the device camera.
          </div>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            disabled={disabled}
            className="mt-3 block w-full text-sm"
            onChange={(e) => void onPickEvidenceFiles(e)}
          />
        </label>
      </div>

      <div className="mt-4 space-y-3">
        <label className="block space-y-2">
          <span className="text-sm font-medium">Technician Comments</span>
          <textarea
            value={technicianComments}
            onChange={(e) => onTechnicianCommentsChange(e.target.value)}
            rows={3}
            disabled={isClosed || disabled}
            className="w-full rounded-xl border px-3 py-3 disabled:bg-muted/40 disabled:text-muted-foreground"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium">Customer Contact Feedback</span>
          <textarea
            value={customerContactFeedback}
            onChange={(e) => onCustomerContactFeedbackChange(e.target.value)}
            rows={3}
            disabled={isClosed || disabled}
            className="w-full rounded-xl border px-3 py-3 disabled:bg-muted/40 disabled:text-muted-foreground"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium">Lessons / Takeaways</span>
          <textarea
            value={lessonsTakeaways}
            onChange={(e) => onLessonsTakeawaysChange(e.target.value)}
            rows={3}
            disabled={isClosed || disabled}
            className="w-full rounded-xl border px-3 py-3 disabled:bg-muted/40 disabled:text-muted-foreground"
          />
        </label>
      </div>

      <div className="mt-4 grid gap-2">
        <button
          type="button"
          disabled={isClosed || disabled}
          onClick={() => void onCommitUpdate()}
          className="rounded-xl border px-4 py-3 font-semibold disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save Case Detail"}
        </button>

        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={busy || isClosed}
            onClick={() => void onChangeStatus("in_progress")}
            className="rounded-xl border px-4 py-3 font-semibold disabled:opacity-60"
          >
            Mark In Progress
          </button>

          <button
            type="button"
            disabled={busy || isClosed}
            onClick={() => void onChangeStatus("pending_customer")}
            className="rounded-xl border px-4 py-3 font-semibold disabled:opacity-60"
          >
            Pending Customer
          </button>

          <button
            type="button"
            disabled={busy || isClosed}
            onClick={() => void onChangeStatus("resolved")}
            className="rounded-xl border px-4 py-3 font-semibold disabled:opacity-60"
          >
            Resolve
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => void onChangeStatus(isClosed ? "reopened" : "closed")}
            className={`rounded-xl px-4 py-3 font-semibold disabled:opacity-60 ${
              isClosed
                ? "border text-foreground"
                : "border border-green-300 text-green-700"
            }`}
          >
            {isClosed ? "Reopen Case" : "Close Case"}
          </button>
        </div>
      </div>
    </section>
  );
}

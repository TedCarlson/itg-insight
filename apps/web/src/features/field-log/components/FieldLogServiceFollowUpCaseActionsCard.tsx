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
};

function niceStatus(value: string | null | undefined) {
  return (value ?? "open").replaceAll("_", " ").toUpperCase();
}

export function FieldLogServiceFollowUpCaseActionsCard(props: Props) {
  const {
    busy,
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
  } = props;

  if (!visible) return null;

  const normalizedStatus = caseStatus ?? "open";
  const isClosed = normalizedStatus === "closed";

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold">Case Actions</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Current status: {niceStatus(normalizedStatus)}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            Service Follow Up is case management. Evidence is optional, and closed cases can receive appended updates.
          </div>
        </div>
      </div>

      {isClosed ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          This case is closed. Existing case notes are preserved below. Use append to add new information without rewriting the saved thread.
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        <label className="block space-y-2">
          <span className="text-sm font-medium">Technician Comments</span>
          <textarea
            value={technicianComments}
            onChange={(e) => onTechnicianCommentsChange(e.target.value)}
            rows={4}
            disabled={isClosed || busy}
            className="w-full rounded-xl border px-3 py-3 disabled:bg-muted/40 disabled:text-muted-foreground"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium">Customer Contact Feedback</span>
          <textarea
            value={customerContactFeedback}
            onChange={(e) => onCustomerContactFeedbackChange(e.target.value)}
            rows={4}
            disabled={isClosed || busy}
            className="w-full rounded-xl border px-3 py-3 disabled:bg-muted/40 disabled:text-muted-foreground"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium">Lessons / Takeaways</span>
          <textarea
            value={lessonsTakeaways}
            onChange={(e) => onLessonsTakeawaysChange(e.target.value)}
            rows={4}
            disabled={isClosed || busy}
            className="w-full rounded-xl border px-3 py-3 disabled:bg-muted/40 disabled:text-muted-foreground"
          />
        </label>

        {isClosed ? (
          <label className="block space-y-2 rounded-xl border border-dashed p-3">
            <span className="text-sm font-medium">Append Case Update</span>
            <textarea
              value={appendNote}
              onChange={(e) => onAppendNoteChange(e.target.value)}
              rows={4}
              placeholder="Add new information, customer contact, correction, or follow-up detail. This will append to the saved case thread."
              disabled={busy}
              className="w-full rounded-xl border px-3 py-3 disabled:bg-muted/40 disabled:text-muted-foreground"
            />
          </label>
        ) : null}
      </div>

      <div className="mt-4 grid gap-2">
        {isClosed ? (
          <button
            type="button"
            disabled={busy || !appendNote.trim()}
            onClick={() => void onAppendNote()}
            className="rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Appending…" : "Append Update"}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void onCommitUpdate()}
            className="rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Committing…" : "Commit Update"}
          </button>
        )}

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
            {isClosed ? "Reopen" : "Close"}
          </button>
        </div>
      </div>
    </section>
  );
}

"use client";

function fmtBool(value: boolean | null | undefined) {
  if (value == null) return "—";
  return value ? "Yes" : "No";
}

function fmtText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "—";
}

export function FieldLogPostCallDetailCard(props: {
  visible: boolean;
  riskLevel: string | null;
  tnpsRiskFlag: boolean | null;
  followupRecommended: boolean | null;
  technicianComments?: string | null;
  customerContactFeedback?: string | null;
  lessonsTakeaways?: string | null;
  caseStatus?: string | null;
}) {
  const {
    visible,
    riskLevel,
    tnpsRiskFlag,
    followupRecommended,
    technicianComments,
    customerContactFeedback,
    lessonsTakeaways,
    caseStatus,
  } = props;

  if (!visible) return null;

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold">Service Follow Up Detail</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Case Status: {caseStatus ?? "open"}
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
        <div>Risk Level: {riskLevel ?? "—"}</div>
        <div>tNPS Risk: {fmtBool(tnpsRiskFlag)}</div>
        <div>Follow-up Recommended: {fmtBool(followupRecommended)}</div>
      </div>

      <div className="mt-4 space-y-3 text-sm">
        <div className="rounded-xl border bg-muted/20 p-3">
          <div className="font-medium">Technician Comments</div>
          <div className="mt-1 whitespace-pre-wrap text-muted-foreground">
            {fmtText(technicianComments)}
          </div>
        </div>

        <div className="rounded-xl border bg-muted/20 p-3">
          <div className="font-medium">Customer Contact Feedback</div>
          <div className="mt-1 whitespace-pre-wrap text-muted-foreground">
            {fmtText(customerContactFeedback)}
          </div>
        </div>

        <div className="rounded-xl border bg-muted/20 p-3">
          <div className="font-medium">Lessons / Takeaways</div>
          <div className="mt-1 whitespace-pre-wrap text-muted-foreground">
            {fmtText(lessonsTakeaways)}
          </div>
        </div>
      </div>
    </section>
  );
}

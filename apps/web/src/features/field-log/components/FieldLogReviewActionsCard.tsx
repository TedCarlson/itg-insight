"use client";

type ReviewAction = {
  review_action_id: string;
  action_at: string;
  action_by_user_id: string | null;
  action_by_person_id?: string | null;
  actor_full_name?: string | null;
  action_type: string;
  note: string | null;
};

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function niceAction(actionType: string) {
  return actionType.replaceAll("_", " ");
}

export function FieldLogReviewActionsCard(props: {
  actions: ReviewAction[];
}) {
  const { actions } = props;

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="text-base font-semibold">Review Actions</div>

      {actions?.length ? (
        <div className="mt-3 space-y-3">
          {actions.map((action) => (
            <div key={action.review_action_id} className="rounded-xl border p-3 text-sm">
              <div className="font-medium">{niceAction(action.action_type)}</div>
              <div className="mt-1 text-muted-foreground">{fmtDate(action.action_at)}</div>

              {action.actor_full_name ? (
                <div className="mt-2 text-muted-foreground">
                  By {action.actor_full_name}
                </div>
              ) : null}

              {action.note ? (
                <div className="mt-2 text-muted-foreground">{action.note}</div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 text-sm text-muted-foreground">
          No review actions recorded.
        </div>
      )}
    </section>
  );
}
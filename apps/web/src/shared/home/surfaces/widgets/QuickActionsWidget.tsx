import Link from "next/link";
import type { HomeWidgetPayload } from "../../contracts/widget.types";

export function QuickActionsWidget(props: {
  payload: HomeWidgetPayload["quick_actions"];
}) {
  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold">{props.payload.title}</div>
      <div className="grid gap-2">
        {props.payload.actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="rounded-xl border border-[var(--to-border)] bg-[var(--to-surface)] p-3 transition hover:bg-[var(--to-row-hover)]"
          >
            <div className="text-sm font-medium">{action.label}</div>
            {action.description ? (
              <div className="mt-1 text-xs text-[var(--to-muted)]">{action.description}</div>
            ) : null}
          </Link>
        ))}
      </div>
    </div>
  );
}

import Link from "next/link";
import { CalendarDays, BarChart3, ClipboardList } from "lucide-react";

function ActionTile(props: {
  href: string;
  label: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const Icon = props.icon;

  return (
    <Link
      href={props.href}
      className="relative flex items-center gap-3 overflow-hidden rounded-2xl border bg-card px-4 py-4 transition hover:bg-muted/40 active:scale-[0.99]"
    >
      <div className="pl-1">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>

      <div className="min-w-0">
        <div className="text-sm font-medium">{props.label}</div>
        <div className="mt-1 text-xs text-muted-foreground">{props.detail}</div>
      </div>
    </Link>
  );
}

export default function TechHomePage() {
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border bg-card p-4">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Team Message
        </div>
        <div className="mt-3 text-lg font-semibold">No active broadcast right now.</div>
        <p className="mt-2 text-sm text-muted-foreground">
          Leadership updates will land here.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-3">
        <ActionTile
          href="/tech/schedule"
          label="Schedule"
          detail="View your current schedule."
          icon={CalendarDays}
        />

        <ActionTile
          href="/tech/metrics"
          label="Metrics"
          detail="Open your metrics view."
          icon={BarChart3}
        />

        <ActionTile
          href="/tech/field-log"
          label="Field Log"
          detail="Start a log or review your submissions."
          icon={ClipboardList}
        />
      </section>
    </div>
  );
}

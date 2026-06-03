import Link from "next/link";
import { FieldLogActivityTable } from "@/features/field-log/components/FieldLogActivityTable";

export const runtime = "nodejs";

export default function FieldLogHomePage() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card p-5">
        <div className="text-sm text-muted-foreground">Operations</div>
        <h1 className="mt-1 text-2xl font-semibold">Field Log</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Mobile-first field reporting for QC, Not Done, U-Code Applied, and Post Call
          workflows.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <Link
          href="/field-log/new"
          className="rounded-2xl border bg-card p-5 transition hover:bg-muted/40"
        >
          <div className="text-base font-semibold">New Field Log</div>
          <div className="mt-2 text-sm text-muted-foreground">
            Start a new field submission.
          </div>
        </Link>

        <Link
          href="/field-log/mine"
          className="rounded-2xl border bg-card p-5 transition hover:bg-muted/40"
        >
          <div className="text-base font-semibold">My Logs</div>
          <div className="mt-2 text-sm text-muted-foreground">
            View your drafts, pending logs, follow-ups, and approvals.
          </div>
        </Link>

        <Link
          href="/field-log/review"
          className="rounded-2xl border bg-card p-5 transition hover:bg-muted/40"
        >
          <div className="text-base font-semibold">Review Queue</div>
          <div className="mt-2 text-sm text-muted-foreground">
            Supervisor review bucket for pending approvals and follow-ups.
          </div>
        </Link>

        <Link
          href="/field-log/audit"
          className="rounded-2xl border bg-card p-5 transition hover:bg-muted/40"
        >
          <div className="text-base font-semibold">Audit Queue</div>
          <div className="mt-2 text-sm text-muted-foreground">
            Review finalized logs and clean up aging unresolved follow-ups.
          </div>
        </Link>
      </section>

      <FieldLogActivityTable />
    </div>
  );
}
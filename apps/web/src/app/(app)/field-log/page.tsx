import { FieldLogActivityTable } from "@/features/field-log/components/FieldLogActivityTable";
import { FieldLogHeaderActions } from "@/features/field-log/components/FieldLogHeaderActions";
import { FieldLogHomeClient } from "@/features/field-log/pages/FieldLogHomeClient";

export const runtime = "nodejs";

export default function FieldLogHomePage() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-sm text-muted-foreground">Operations</div>
            <h1 className="mt-1 text-2xl font-semibold">Field Log</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Mobile-first field reporting for QC, Not Done, U-Code Applied, and Post Call
              workflows.
            </p>
          </div>

          <FieldLogHeaderActions />
        </div>
      </section>

      <FieldLogHomeClient />

      <FieldLogActivityTable />
    </div>
  );
}
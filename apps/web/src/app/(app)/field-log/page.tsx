import { FieldLogActivityTable } from "@/features/field-log/components/FieldLogActivityTable";
import { FieldLogHeaderActions } from "@/features/field-log/components/FieldLogHeaderActions";
import { FieldLogHomeClient } from "@/features/field-log/pages/FieldLogHomeClient";

export const runtime = "nodejs";

export default function FieldLogHomePage() {
  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Field Log</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Field reporting, review workflows, evidence packets, and case management.
          </p>
        </div>

        <FieldLogHeaderActions />
      </section>

      <FieldLogHomeClient />

      <FieldLogActivityTable />
    </div>
  );
}
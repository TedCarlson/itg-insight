// apps/web/src/app/route-lock/shift-validation/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";

import { PageShell } from "@/components/ui/PageShell";
import { Card } from "@/components/ui/Card";
import { Toolbar } from "@/components/ui/Toolbar";

import { requireSelectedPcOrgServer } from "@/lib/auth/requireSelectedPcOrg.server";
import { supabaseServer } from "@/shared/data/supabase/server";

import { UploadShiftValidationCard } from "./UploadShiftValidationCard";
import { ImportedRowsCardClient, type ImportRow } from "@/features/route-lock/shift-validation/ImportedRowsCardClient";
import { RollupsCardClient } from "@/features/route-lock/shift-validation/RollupsCardClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function todayInNY(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function ShiftValidationPage() {
  const scope = await requireSelectedPcOrgServer();
  if (!scope.ok) redirect("/home");

  const sb = await supabaseServer();
  const pc_org_id = scope.selected_pc_org_id;

  const today = todayInNY();
  const windowEnd = addDaysISO(today, 14); // exclusive
  const maxDay = addDaysISO(today, 13); // inclusive

  // Org upload guardrail source of truth
  const { data: org } = await sb
    .from("pc_org")
    .select("fulfillment_center_id, fulfillment_center_name")
    .eq("pc_org_id", pc_org_id)
    .maybeSingle();

  const expectedFulfillmentCenterId = (org?.fulfillment_center_id as number | null) ?? null;
  const expectedFulfillmentCenterName = (org?.fulfillment_center_name as string | null) ?? null;
  const uploadEnabled = Boolean(expectedFulfillmentCenterId);

  // Latest batch summary
  const { data: latestBatch } = await sb
    .from("shift_validation_batch")
    .select("fulfillment_center_id, row_count_loaded, row_count_total, uploaded_at")
    .eq("pc_org_id", pc_org_id)
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Single pull: 14-day snapshot (today onward)
  const { data: rows } = await sb
    .from("shift_validation_import_v")
    .select("shift_date, tech_id, shift_duration, work_units, target_unit, route_criteria, route_areas, office")
    .eq("pc_org_id", pc_org_id)
    .gte("shift_date", today)
    .lt("shift_date", windowEnd)
    .order("shift_date", { ascending: true })
    .order("tech_id", { ascending: true });

  const typedRows: ImportRow[] = (rows ?? []) as any;

  return (
    <PageShell>
      <Card variant="subtle">
        <Toolbar
          left={
            <div className="min-w-0 flex items-center gap-2">
              <Link href="/route-lock" className="to-btn to-btn--secondary h-8 px-3 text-xs inline-flex items-center">
                Back
              </Link>

              <span className="px-2 text-[var(--to-ink-muted)]">•</span>

              <div className="min-w-0">
                <div className="text-sm font-semibold leading-5">Shift Validation</div>
                <div className="text-[11px] text-[var(--to-ink-muted)] leading-4">
                  Route Lock • Customer snapshot ingestion + review
                </div>
              </div>
            </div>
          }
          right={null}
        />
      </Card>

      {/* Upload */}
      <UploadShiftValidationCard
        uploadEnabled={uploadEnabled}
        expectedFulfillmentCenterId={expectedFulfillmentCenterId}
        expectedFulfillmentCenterName={expectedFulfillmentCenterName}
      />

      {/* Context */}
      <Card>
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium">Selected org:</span>{" "}
            <span className="text-[var(--to-ink-muted)]">{pc_org_id}</span>
          </div>

          <div>
            <span className="font-medium">Org fulfillment center:</span>{" "}
            {uploadEnabled ? (
              <span className="text-[var(--to-ink-muted)]">
                {expectedFulfillmentCenterId}
                {expectedFulfillmentCenterName ? ` · ${expectedFulfillmentCenterName}` : ""}
              </span>
            ) : (
              <span className="text-[var(--to-ink-muted)]">
                Not set (uploads disabled until <span className="font-mono">pc_org.fulfillment_center_id</span> is populated)
              </span>
            )}
          </div>

          <div>
            <span className="font-medium">Latest batch:</span>{" "}
            {latestBatch ? (
              <span className="text-[var(--to-ink-muted)]">
                FC {latestBatch.fulfillment_center_id} · {latestBatch.row_count_loaded}/{latestBatch.row_count_total} rows ·{" "}
                {new Date(latestBatch.uploaded_at).toLocaleString()}
              </span>
            ) : (
              <span className="text-[var(--to-ink-muted)]">No uploads yet</span>
            )}
          </div>

          <div>
            <span className="font-medium">Window:</span>{" "}
            <span className="text-[var(--to-ink-muted)]">
              {today} → {windowEnd} (14 days, starting today)
            </span>
          </div>
        </div>
      </Card>

      {/* Two-column split */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ImportedRowsCardClient rows={typedRows} today={today} maxDay={maxDay} pageSize={50} />
        <RollupsCardClient rows={typedRows} today={today} maxDay={maxDay} />
      </div>
    </PageShell>
  );
}
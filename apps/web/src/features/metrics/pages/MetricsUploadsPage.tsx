// path: apps/web/src/features/metrics/pages/MetricsUploadsPage.tsx

import Link from "next/link";
import { redirect } from "next/navigation";

import { PageShell } from "@/components/ui/PageShell";
import { Card } from "@/components/ui/Card";
import { Toolbar } from "@/components/ui/Toolbar";

import { requireSelectedPcOrgServer } from "@/lib/auth/requireSelectedPcOrg.server";
import { supabaseServer } from "@/shared/data/supabase/server";

import { UploadMetricsCard } from "../components/UploadMetricsCard";
import {
  ImportedMetricsRowsCardClient,
  type MetricsRawRow,
} from "../components/ImportedMetricsRowsCardClient";
import {
  MetricsBatchHistoryClient,
  type MetricsBatchHistoryRow,
} from "../components/MetricsBatchHistoryClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MetricsUploadsPage() {
  const scope = await requireSelectedPcOrgServer();
  if (!scope.ok) redirect("/home");

  const sb = await supabaseServer();
  const pc_org_id = scope.selected_pc_org_id;
  let orgLabel = String(pc_org_id);

  const { data: orgRow } = await sb
    .from("pc_org")
    .select("pc_id, pc_org_name")
    .eq("pc_org_id", pc_org_id)
    .maybeSingle();

  if (orgRow?.pc_org_name) {
    orgLabel = String(orgRow.pc_org_name);
  } else if (orgRow?.pc_id) {
    const { data: pcRow } = await sb
      .from("pc")
      .select("pc_number")
      .eq("pc_id", orgRow.pc_id)
      .maybeSingle();

    if (pcRow?.pc_number != null) orgLabel = String(pcRow.pc_number);
  }

  const { data: batches } = await sb
    .from("metric_raw_batches_compat_v")
    .select("batch_id, fiscal_end_date, row_count, uploaded_at, status")
    .eq("pc_org_id", pc_org_id)
    .order("uploaded_at", { ascending: false })
    .limit(25);

  const typedBatches: MetricsBatchHistoryRow[] = (batches ?? []) as MetricsBatchHistoryRow[];
  const latestBatch = typedBatches[0] ?? null;

  const { data: rows } = await sb
    .from("metric_raw_rows_compat_v")
    .select("fiscal_end_date, tech_id, unique_row_key")
    .eq("pc_org_id", pc_org_id)
    .order("inserted_at", { ascending: false })
    .limit(500);

  const typedRows: MetricsRawRow[] = (rows ?? []) as MetricsRawRow[];

  return (
    <PageShell>
      <Card variant="subtle">
        <Toolbar
          left={
            <div className="min-w-0 flex items-center gap-2">
              <Link
                href="/home"
                className="to-btn to-btn--secondary h-8 px-3 text-xs inline-flex items-center"
              >
                Back
              </Link>

              <span className="px-2 text-[var(--to-ink-muted)]">•</span>

              <div className="min-w-0">
                <div className="text-sm font-semibold leading-5">Uploads</div>
                <div className="text-[11px] text-[var(--to-ink-muted)] leading-4">
                  Metrics • Raw report ingestion + verification
                </div>
              </div>
            </div>
          }
          right={null}
        />
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(420px,0.9fr)]">
        <UploadMetricsCard orgId={pc_org_id} orgSelectable />
        <MetricsBatchHistoryClient batches={typedBatches} />
      </div>

      <Card>
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium">Selected org:</span>{" "}
            <span className="text-[var(--to-ink-muted)]">{orgLabel}</span>
          </div>

          <div>
            <span className="font-medium">Latest batch:</span>{" "}
            {latestBatch ? (
              <span className="text-[var(--to-ink-muted)]">
                {latestBatch.status} · FM end {latestBatch.fiscal_end_date} ·{" "}
                {latestBatch.row_count} rows ·{" "}
                {latestBatch.uploaded_at ? new Date(latestBatch.uploaded_at).toLocaleString() : "—"}
              </span>
            ) : (
              <span className="text-[var(--to-ink-muted)]">No uploads yet</span>
            )}
          </div>

          <div>
            <span className="font-medium">Rows loaded (preview):</span>{" "}
            <span className="text-[var(--to-ink-muted)]">
              {typedRows.length} (latest 500)
            </span>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ImportedMetricsRowsCardClient rows={typedRows} pageSize={50} />

        <Card>
          <div className="space-y-2 text-sm">
            <div className="text-sm font-medium">Next step</div>
            <div className="text-sm text-[var(--to-ink-muted)]">
              Process the staged bulk TPR upload into downstream metric classes and
              reporting surfaces.
            </div>
          </div>
        </Card>
      </div>
    </PageShell>
  );
}
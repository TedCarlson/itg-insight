// apps/web/src/features/metrics/pages/MetricsUploadsPage.tsx

import Link from "next/link";
import { redirect } from "next/navigation";

import { PageShell } from "@/components/ui/PageShell";
import { Card } from "@/components/ui/Card";
import { Toolbar } from "@/components/ui/Toolbar";

import { requireSelectedPcOrgServer } from "@/lib/auth/requireSelectedPcOrg.server";
import { supabaseServer } from "@/shared/data/supabase/server";

import { UploadMetricsCard } from "../components/UploadMetricsCard";
import MetricsBatchActionsClient from "../components/MetricsBatchActionsClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type MetricsRawBatchRow = {
  batch_id: string | null;
  fiscal_end_date: string | null;
  metric_date: string | null;
  row_count: number | null;
  uploaded_at: string | null;
  status: string | null;
  source_filename: string | null;
  source_title: string | null;
  source_generated_at: string | null;
  warning_flags: any[] | null;
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function formatDate(value: string | null | undefined) {
  return value ? String(value) : "—";
}

function getWarningCount(value: any[] | null | undefined) {
  return Array.isArray(value) ? value.length : 0;
}

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

  const { data: latestBatch } = await sb
    .from("metrics_raw_batch")
    .select(
      "batch_id, fiscal_end_date, metric_date, row_count, uploaded_at, status, source_filename, source_title, source_generated_at, warning_flags"
    )
    .eq("pc_org_id", pc_org_id)
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: batches } = await sb
    .from("metrics_raw_batch")
    .select(
      "batch_id, fiscal_end_date, metric_date, row_count, uploaded_at, status, source_filename, source_title, source_generated_at, warning_flags"
    )
    .eq("pc_org_id", pc_org_id)
    .order("uploaded_at", { ascending: false })
    .limit(25);

  const typedBatches: MetricsRawBatchRow[] = (batches ??
    []) as MetricsRawBatchRow[];

  const totalRows = typedBatches.reduce(
    (sum, row) => sum + (Number(row.row_count ?? 0) || 0),
    0
  );

  return (
    <PageShell>
      <Card variant="subtle">
        <Toolbar
          left={
            <div className="min-w-0 flex items-center gap-2">
              <Link
                href="/metrics"
                className="to-btn to-btn--secondary h-8 px-3 text-xs inline-flex items-center"
              >
                Back
              </Link>

              <span className="px-2 text-[var(--to-ink-muted)]">•</span>

              <div className="min-w-0">
                <div className="text-sm font-semibold leading-5">Uploads</div>
                <div className="text-[11px] text-[var(--to-ink-muted)] leading-4">
                  Metrics • Batch ingestion ledger
                </div>
              </div>
            </div>
          }
          right={null}
        />
      </Card>

      <UploadMetricsCard orgId={pc_org_id} orgSelectable />

      <Card>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3 text-sm">
          <div>
            <span className="font-medium">Selected org:</span>{" "}
            <span className="text-[var(--to-ink-muted)]">{orgLabel}</span>
          </div>

          <div>
            <span className="font-medium">Latest batch:</span>{" "}
            {latestBatch ? (
              <span className="text-[var(--to-ink-muted)]">
                {latestBatch.status ?? "—"} · FM end{" "}
                {formatDate(latestBatch.fiscal_end_date)} ·{" "}
                {Number(latestBatch.row_count ?? 0)} rows
              </span>
            ) : (
              <span className="text-[var(--to-ink-muted)]">No uploads yet</span>
            )}
          </div>

          <div>
            <span className="font-medium">Recent batch rows:</span>{" "}
            <span className="text-[var(--to-ink-muted)]">{totalRows}</span>
          </div>
        </div>
      </Card>

      <Card>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Recent upload batches</div>
              <div className="text-sm text-[var(--to-ink-muted)]">
                One row per batch. Raw row detail is no longer the primary surface.
              </div>
            </div>
          </div>

          {typedBatches.length === 0 ? (
            <div className="text-sm text-[var(--to-ink-muted)]">
              No upload batches found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--to-border)] text-left">
                    <th className="py-2 pr-4 font-medium">Batch ID</th>
                    <th className="py-2 pr-4 font-medium">Uploaded</th>
                    <th className="py-2 pr-4 font-medium">Metric Date</th>
                    <th className="py-2 pr-4 font-medium">Fiscal End</th>
                    <th className="py-2 pr-4 font-medium">Rows</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Warnings</th>
                    <th className="py-2 pr-4 font-medium">Source File</th>
                    <th className="py-2 pr-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {typedBatches.map((row, index) => (
                    <tr
                      key={row.batch_id ?? `batch-row-${index}`}
                      className="border-b border-[var(--to-border)] align-top"
                    >
                      <td className="py-2 pr-4 font-mono text-xs">
                        {row.batch_id ?? "—"}
                      </td>
                      <td className="py-2 pr-4 text-[var(--to-ink-muted)]">
                        {formatDateTime(row.uploaded_at)}
                      </td>
                      <td className="py-2 pr-4 text-[var(--to-ink-muted)]">
                        {formatDate(row.metric_date)}
                      </td>
                      <td className="py-2 pr-4 text-[var(--to-ink-muted)]">
                        {formatDate(row.fiscal_end_date)}
                      </td>
                      <td className="py-2 pr-4 text-[var(--to-ink-muted)]">
                        {Number(row.row_count ?? 0)}
                      </td>
                      <td className="py-2 pr-4">
                        <span className="text-[var(--to-ink-muted)]">
                          {row.status ?? "—"}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-[var(--to-ink-muted)]">
                        {getWarningCount(row.warning_flags)}
                      </td>
                      <td className="py-2 pr-4 text-[var(--to-ink-muted)]">
                        {row.source_filename ?? "—"}
                      </td>
                      <td className="py-2 pr-4">
                        {row.batch_id ? (
                          <MetricsBatchActionsClient
                            batchId={row.batch_id}
                            status={row.status}
                          />
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <div className="space-y-2 text-sm">
          <div className="text-sm font-medium">Next phase</div>
          <div className="text-sm text-[var(--to-ink-muted)]">
            This surface now tracks raw upload batches. Class processing and
            warehouse review will be handled separately from upload.
          </div>
        </div>
      </Card>
    </PageShell>
  );
}
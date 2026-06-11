"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { createClient } from "@/shared/data/supabase/client";
import { useOrg } from "@/state/org";
import type {
  FieldLogAttachment,
  FieldLogDetailPayload,
} from "../lib/fieldLogDetail.types";

type ReportResponse = {
  ok: boolean;
  data?: FieldLogDetailPayload[];
  error?: string;
};

const REQUIRED_EVIDENCE = [
  { key: "tap_photo", label: "Tap Photo" },
  { key: "ground_block_photo", label: "Ground Block Photo" },
  { key: "bond_point_photo", label: "Bond Point Photo" },
  { key: "workorder_snapshot", label: "Workorder Snapshot" },
] as const;

function toObjectPath(filePath: string) {
  return filePath.startsWith("field-log/") ? filePath.slice("field-log/".length) : filePath;
}

function ymd(value: Date) {
  return value.toISOString().slice(0, 10);
}

function startOfCurrentSundayWeek() {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return ymd(d);
}

function endFromStart(start: string) {
  const d = new Date(`${start}T00:00:00`);
  d.setDate(d.getDate() + 6);
  return ymd(d);
}

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

type ResolvedEvidence = {
  attachment: FieldLogAttachment | null;
  signedUrl: string | null;
};

export function FieldLogNewDropReportClient() {
  const { selectedOrgId } = useOrg();
  const supabase = useMemo(() => createClient(), []);
  const [start, setStart] = useState(startOfCurrentSundayWeek());
  const [end, setEnd] = useState(endFromStart(startOfCurrentSundayWeek()));
  const [rows, setRows] = useState<FieldLogDetailPayload[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadReport() {
    if (!selectedOrgId) {
      setError("Select an org first.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        pc_org_id: selectedOrgId,
        start,
        end,
      });

      const res = await fetch(`/api/field-log/new-drop/report?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      const json = (await res.json()) as ReportResponse;
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to load New Drop report.");
      }

      const nextRows = json.data ?? [];
      setRows(nextRows);

      const nextUrls: Record<string, string> = {};
      const attachments = nextRows.flatMap((row) =>
        (row.attachments ?? []).filter((item) => !item.deleted_at && item.file_path),
      );

      await Promise.all(
        attachments.map(async (item) => {
          const { data } = await supabase.storage
            .from("field-log")
            .createSignedUrl(toObjectPath(item.file_path), 60 * 60);

          if (data?.signedUrl) {
            nextUrls[item.attachment_id] = data.signedUrl;
          }
        }),
      );

      setUrls(nextUrls);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load New Drop report.");
    } finally {
      setLoading(false);
    }
  }

  function evidenceFor(row: FieldLogDetailPayload, key: string): ResolvedEvidence {
    const attachment =
      row.attachments?.find((item) => item.photo_label_key === key && !item.deleted_at) ?? null;

    return {
      attachment,
      signedUrl: attachment ? urls[attachment.attachment_id] ?? null : null,
    };
  }

  return (
    <div className="space-y-4">
      <section className="no-print rounded-2xl border bg-card p-4">
        <div className="text-lg font-semibold">New Drop Weekly Report</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Approved New Drop submissions only. Use browser print to save as PDF.
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[180px_180px_auto_auto]">
          <label className="text-sm">
            <div className="mb-1 font-medium">Week Start</div>
            <input
              type="date"
              value={start}
              onChange={(e) => {
                const next = e.target.value;
                setStart(next);
                setEnd(endFromStart(next));
              }}
              className="w-full rounded-xl border px-3 py-3"
            />
          </label>

          <label className="text-sm">
            <div className="mb-1 font-medium">Week End</div>
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="w-full rounded-xl border px-3 py-3"
            />
          </label>

          <button
            type="button"
            onClick={() => void loadReport()}
            disabled={loading}
            className="self-end rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Loading…" : "Load Report"}
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="self-end rounded-xl border px-4 py-3 text-sm font-semibold"
          >
            Print / Save PDF
          </button>
        </div>

        {error ? <div className="mt-3 text-sm text-red-600">{error}</div> : null}
      </section>

      <section className="rounded-2xl border bg-card p-4">
        <div className="text-sm text-muted-foreground">
          Range: {start} through {end}
        </div>
        <div className="text-xl font-semibold">{rows.length} approved New Drop submission(s)</div>
      </section>

      <div className="grid gap-4 print:block">
        {rows.map((row) => (
          <section
            key={row.report_id}
            className="break-inside-avoid rounded-2xl border bg-card p-4 print:mb-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xl font-semibold">Job {row.job_number}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Submitted: {fmtDate(row.submitted_at)} • Approved: {fmtDate(row.approved_at)}
                </div>
              </div>
              <div className="rounded-full border px-3 py-1 text-xs font-semibold">
                APPROVED
              </div>
            </div>

            <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
              <div>Category: {row.category_label ?? "New Drop"}</div>
              <div>Job Type: {row.job_type?.toUpperCase() ?? "—"}</div>
              <div>Status: {row.status}</div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {REQUIRED_EVIDENCE.map((item) => {
                const evidence = evidenceFor(row, item.key);
                const isImage = evidence.attachment?.mime_type?.startsWith("image/");

                return (
                  <div key={item.key} className="rounded-xl border p-3">
                    <div className="mb-2 text-sm font-semibold">{item.label}</div>

                    {evidence.signedUrl && isImage ? (
                      <div className="relative h-64 w-full overflow-hidden rounded-lg border">
                        <Image
                          src={evidence.signedUrl}
                          alt={item.label}
                          fill
                          unoptimized
                          className="object-contain"
                        />
                      </div>
                    ) : evidence.signedUrl ? (
                      <a
                        href={evidence.signedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-blue-700 underline"
                      >
                        Open attachment
                      </a>
                    ) : (
                      <div className="rounded-lg bg-muted/40 p-6 text-sm text-muted-foreground">
                        Missing preview
                      </div>
                    )}

                    <div className="mt-2 truncate text-xs text-muted-foreground">
                      {evidence.attachment?.file_name ?? "No file recorded"}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }

          body {
            background: white !important;
          }
        }
      `}</style>
    </div>
  );
}

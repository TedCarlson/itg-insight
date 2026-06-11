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

function addDaysISO(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return ymd(d);
}

function sundayForISO(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() - d.getDay());
  return ymd(d);
}

function previousCompletedSunday(todayIso: string) {
  return addDaysISO(sundayForISO(todayIso), -7);
}

function todayISO() {
  return ymd(new Date());
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
  const today = useMemo(() => todayISO(), []);
  const [start, setStart] = useState(() => previousCompletedSunday(today));
  const end = addDaysISO(start, 6);
  const currentWeekStart = sundayForISO(today);
  const [rows, setRows] = useState<FieldLogDetailPayload[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [shipping, setShipping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function shipPacket() {
    if (!selectedOrgId) {
      setError("Select an org first.");
      return;
    }

    setShipping(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        pc_org_id: selectedOrgId,
        start,
        end,
      });

      const res = await fetch(`/api/field-log/new-drop/packet?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      if (!res.ok) {
        let message = "Failed to ship New Drop packet.";
        try {
          const json = await res.json();
          message = json?.error || message;
        } catch {}
        throw new Error(message);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `NewDropPacket_${start}_to_${end}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to ship New Drop packet.");
    } finally {
      setShipping(false);
    }
  }

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
        <div className="text-lg font-semibold">New Drop Billing Packet</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Review approved New Drop submissions before shipping the billing packet.
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-xl border px-3 py-2 text-xs font-semibold"
            onClick={() => setStart(addDaysISO(start, -7))}
          >
            Previous Week
          </button>

          <button
            type="button"
            className="rounded-xl border px-3 py-2 text-xs font-semibold"
            onClick={() => setStart(previousCompletedSunday(today))}
          >
            Previous Completed
          </button>

          <button
            type="button"
            className="rounded-xl border px-3 py-2 text-xs font-semibold"
            onClick={() => setStart(currentWeekStart)}
          >
            Current Week
          </button>

          <button
            type="button"
            className="rounded-xl border px-3 py-2 text-xs font-semibold"
            onClick={() => setStart(addDaysISO(start, 7))}
          >
            Next Week
          </button>

          <button
            type="button"
            onClick={() => void loadReport()}
            disabled={loading}
            className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Loading…" : "Preview Packet"}
          </button>

          <button
            type="button"
            onClick={() => void shipPacket()}
            disabled={shipping}
            className="rounded-xl border px-4 py-2 text-xs font-semibold disabled:opacity-60"
          >
            {shipping ? "Shipping…" : "Ship New Drop Packet"}
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

      <div className="grid gap-3 print:block">
        {rows.map((row) => (
          <section
            key={row.report_id}
            className="billing-packet-row break-inside-avoid rounded-2xl border bg-card p-4 print:mb-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-3">
              <div className="min-w-0">
                <div className="text-2xl font-bold tracking-tight">
                  JOB {row.job_number}
                </div>
                <div className="mt-1 text-sm font-medium">
                  Tech: {(row as any).subject_tech_id ?? (row as any).tech_id ?? "—"} • {(row as any).subject_full_name ?? (row as any).full_name ?? (row as any).created_by_display_name ?? "Unknown Technician"}
                </div>
              </div>

              <div className="text-right text-sm">
                <div className="font-semibold uppercase text-green-700">
                  {row.status === "approved" ? "Approved" : row.status}
                </div>
                <div className="mt-1 text-muted-foreground">
                  {fmtDate(row.approved_at)}
                </div>
              </div>
            </div>

            <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-4">
              <div>
                <span className="font-semibold text-foreground">Type:</span>{" "}
                {row.category_label ?? "New Drop"} • {row.job_type?.toUpperCase() ?? "—"}
              </div>
              <div>
                <span className="font-semibold text-foreground">Submitted:</span>{" "}
                {fmtDate(row.submitted_at)}
              </div>
              <div>
                <span className="font-semibold text-foreground">Evidence:</span>{" "}
                {row.photo_count ?? row.attachments?.length ?? 0}/4
              </div>
              <div>
                <span className="font-semibold text-foreground">Packet:</span>{" "}
                Billing Ready
              </div>
            </div>

            <div className="mt-3 grid grid-cols-4 gap-2">
              {REQUIRED_EVIDENCE.map((item) => {
                const evidence = evidenceFor(row, item.key);
                const isImage = evidence.attachment?.mime_type?.startsWith("image/");

                return (
                  <div key={item.key} className="min-w-0">
                    <div className="mb-1 truncate text-xs font-semibold">{item.label}</div>

                    {evidence.signedUrl && isImage ? (
                      <div className="relative h-36 w-full overflow-hidden rounded-lg border bg-white print:h-[1.5in]">
                        <Image
                          src={evidence.signedUrl}
                          alt={item.label}
                          fill
                          unoptimized
                          className="object-contain"
                        />
                      </div>
                    ) : evidence.signedUrl ? (
                      <div className="flex h-36 items-center justify-center rounded-lg border bg-white p-2 text-center text-xs print:h-[1.5in]">
                        <a
                          href={evidence.signedUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-blue-700 underline"
                        >
                          Open attachment
                        </a>
                      </div>
                    ) : (
                      <div className="flex h-36 items-center justify-center rounded-lg border bg-muted/40 p-2 text-center text-xs text-muted-foreground print:h-[1.5in]">
                        Missing preview
                      </div>
                    )}
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

          .billing-packet-row {
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import type { DragEvent } from "react";

type UploadFamily =
  | "metrics"
  | "check_in"
  | "shift_validation"
  | "unknown";

type InspectionResult = {
  ok: boolean;
  family?: UploadFamily;
  status?: "ready" | "error";
  fileName?: string;
  notes?: string[];
  error?: string;
  detected_title?: string;
  detected_generated_at?: string | null;
  anchor_date?: string | null;
  row_count_total?: number;
  fiscal_end_date?: string | null;
  warning_flags?: {
    code: string;
    message: string;
  }[];
};

type UploadResult = {
  ok?: boolean;
  loaded?: boolean;
  batch_id?: string | null;
  shift_validation_batch_id?: string | null;
  check_in_batch_id?: string | null;
  row_count_loaded?: number | null;
  row_count_total?: number | null;
  error?: string;
  message?: string;
};

function familyLabel(value?: UploadFamily) {
  if (value === "metrics") return "Metrics";
  if (value === "check_in") return "Check-In";
  if (value === "shift_validation") return "Shift Validation";
  if (value === "unknown") return "Unknown";
  return "Awaiting file";
}

function toDateInputValue(value?: string | null) {
  const s = String(value ?? "").trim();

  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  }

  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }

  return "";
}

function displayDateTime(value?: string | null) {
  if (!value) return "N/A";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

function ReviewField(props: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-background/70 px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {props.label}
      </div>
      <div className={`mt-1 text-sm ${props.muted ? "text-muted-foreground" : ""}`}>
        {props.value}
      </div>
    </div>
  );
}

export function SmartUploadWidget() {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<InspectionResult | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [anchorDate, setAnchorDate] = useState("");

  function reset() {
    setFile(null);
    setInspection(null);
    setUploadResult(null);
    setAnchorDate("");
    setOverlayOpen(false);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  async function inspectFile(nextFile: File) {
    setBusy(true);
    setFile(nextFile);
    setInspection(null);
    setUploadResult(null);

    try {
      const fd = new FormData();
      fd.append("file", nextFile);

      const res = await fetch("/api/uploads/inspect", {
        method: "POST",
        body: fd,
      });

      const json = (await res.json()) as InspectionResult;

      setInspection(json);

      const nextAnchor =
        toDateInputValue(json.anchor_date) ||
        toDateInputValue(json.fiscal_end_date);

      setAnchorDate(nextAnchor);
      setOverlayOpen(true);
    } catch (error) {
      setInspection({
        ok: false,
        status: "error",
        error: error instanceof Error ? error.message : "Inspection failed",
      });
      setOverlayOpen(true);
    } finally {
      setBusy(false);
    }
  }

  async function approveUpload() {
    if (!file || !inspection?.family || inspection.family === "unknown") {
      return;
    }

    let endpoint: string | null = null;

    if (inspection.family === "metrics") {
      endpoint = "/api/metrics/upload";
    }

    if (inspection.family === "shift_validation") {
      endpoint = "/api/route-lock/shift-validation/upload";
    }

    if (inspection.family === "check_in") {
      endpoint = "/api/route-lock/check-in/upload";
    }

    if (!endpoint) return;

    setBusy(true);
    setUploadResult(null);

    try {
      const fd = new FormData();
      fd.append("file", file);

      if (anchorDate) {
        fd.append("anchor_date", anchorDate);
        fd.append("metric_date", anchorDate);
      }

      const res = await fetch(endpoint, {
        method: "POST",
        body: fd,
      });

      const json = (await res.json()) as UploadResult;

      setUploadResult(json);
    } catch (error) {
      setUploadResult({
        ok: false,
        error: error instanceof Error ? error.message : "Upload failed",
      });
    } finally {
      setBusy(false);
    }
  }

  function handleFiles(files: FileList | null) {
    const nextFile = files?.[0];

    if (!nextFile) return;

    void inspectFile(nextFile);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    handleFiles(event.dataTransfer.files);
  }

  const canApprove =
    Boolean(file) &&
    inspection?.status === "ready" &&
    inspection?.family !== "unknown";

  return (
    <div className="flex h-full flex-col">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(event) => handleFiles(event.target.files)}
      />

      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--to-muted)]">
        Smart Upload Center
      </div>

      <div className="mt-2 text-sm text-[var(--to-muted)]">
        Drop a file here or pick from device.
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`mt-4 rounded-xl border border-dashed p-4 transition ${
          dragging ? "bg-muted/40" : "bg-background/60"
        }`}
      >
        <div className="text-sm font-medium">Drop operational file here</div>

        <div className="mt-1 text-xs text-[var(--to-muted)]">
          Metrics, shift validation, check-in, and future upload families.
        </div>

        <button
          type="button"
          className="mt-4 rounded-md border px-3 py-2 text-sm hover:bg-muted"
          onClick={(event) => {
            event.stopPropagation();
            inputRef.current?.click();
          }}
        >
          Pick File
        </button>
      </div>

      <div className="mt-4 rounded-xl border p-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--to-muted)]">
          Detection Status
        </div>

        <div className="mt-1 text-sm text-[var(--to-muted)]">
          {busy
            ? "Inspecting file…"
            : inspection
              ? `${familyLabel(inspection.family)} · ${inspection.status ?? "ready"}`
              : "Awaiting file drop. Signature detection and upload routing will appear here."}
        </div>
      </div>

      {overlayOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border bg-background p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold">Stage Review</div>
                <div className="mt-1 text-sm text-[var(--to-muted)]">
                  Review detected family, anchor date, parser notes, and approve the upload.
                </div>
              </div>

              <button
                type="button"
                className="rounded-md border px-3 py-1.5 text-sm"
                onClick={reset}
              >
                Close
              </button>
            </div>

            {busy ? (
              <div className="mt-4 rounded-xl border bg-muted/20 px-4 py-3 text-sm">
                Working…
              </div>
            ) : null}

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <ReviewField
                label="Detected Family"
                value={familyLabel(inspection?.family)}
                muted={!inspection}
              />

              <ReviewField
                label="File Name"
                value={file?.name ?? "No file staged"}
                muted={!file}
              />

              <ReviewField
                label="Status"
                value={inspection?.status ?? "Idle"}
                muted={!inspection}
              />

              <ReviewField
                label="Rows"
                value={
                  inspection?.row_count_total != null
                    ? String(inspection.row_count_total)
                    : "N/A"
                }
                muted={!inspection}
              />

              <div className="rounded-lg border bg-background/70 px-3 py-2.5">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Anchor Date
                </div>
                <input
                  type="date"
                  value={anchorDate}
                  onChange={(event) => setAnchorDate(event.target.value)}
                  className="mt-1 w-full rounded-md border bg-background px-2 py-1 text-sm"
                />
              </div>

              <ReviewField
                label="Generated"
                value={displayDateTime(inspection?.detected_generated_at)}
                muted={!inspection?.detected_generated_at}
              />
            </div>

            <div className="mt-4 rounded-xl border bg-muted/10 px-3 py-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Review Notes
              </div>

              <div className="mt-2 text-sm">
                {inspection?.notes?.length ? (
                  <ul className="space-y-1">
                    {inspection.notes.map((note, idx) => (
                      <li key={idx}>• {note}</li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-muted-foreground">No review data yet.</span>
                )}
              </div>
            </div>

            {uploadResult ? (
              <div className="mt-4 rounded-xl border bg-muted/10 px-3 py-3 text-sm">
                {uploadResult.ok === false ? (
                  <span className="text-red-700">
                    {uploadResult.error ?? uploadResult.message ?? "Upload failed"}
                  </span>
                ) : (
                  <span>
                    Loaded{" "}
                    {uploadResult.row_count_loaded ??
                      uploadResult.row_count_total ??
                      "upload"}{" "}
                    rows
                    {uploadResult.batch_id
                      ? ` · Batch ${uploadResult.batch_id}`
                      : ""}
                    {uploadResult.shift_validation_batch_id
                      ? ` · Batch ${uploadResult.shift_validation_batch_id}`
                      : ""}
                    {uploadResult.check_in_batch_id
                      ? ` · Batch ${uploadResult.check_in_batch_id}`
                      : ""}
                  </span>
                )}
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={!canApprove || busy}
                onClick={() => void approveUpload()}
                className={
                  canApprove && !busy
                    ? "rounded-md border px-4 py-2 text-sm hover:bg-muted"
                    : "rounded-md border px-4 py-2 text-sm opacity-50"
                }
              >
                {busy
                  ? "Uploading..."
                  : inspection?.family === "metrics"
                    ? "Approve Metrics Upload"
                    : inspection?.family === "shift_validation"
                      ? "Approve Shift Validation Upload"
                      : inspection?.family === "check_in"
                        ? "Approve Check-In Upload"
                        : "Approve Upload"}
              </button>

              <button
                type="button"
                className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
                onClick={reset}
              >
                Remove Staged File
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

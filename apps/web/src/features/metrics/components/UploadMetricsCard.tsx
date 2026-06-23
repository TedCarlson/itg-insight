// path: apps/web/src/features/metrics/components/UploadMetricsCard.tsx

"use client";

import { useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import { useRouter } from "next/navigation";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type StageOk = {
  ok: true;
  staged: true;
  mode: "today" | "date";
  fiscal_end_date: string;
  detected_generated_at?: string | null;
  detected_title?: string | null;
  row_count_total: number;
  warning_flags: any[];
};

type LoadOk = {
  ok: true;
  loaded: true;
  row_count_loaded: number;
  batch_id: string;
  fiscal_end_date: string;
  warning_flags: any[];
};

type ApiErr = { ok: false; error: string; hint?: string; detail?: any };

type Result = StageOk | LoadOk | ApiErr;

function isoTodayNY(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function UploadMetricsCard({
  orgId,
  orgSelectable = true,
}: {
  orgId: string;
  orgSelectable?: boolean;
}) {
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [pickedDate, setPickedDate] = useState<string>(isoTodayNY());

  const inputRef = useRef<HTMLInputElement | null>(null);

  const staged =
    Boolean(result && (result as any).ok && (result as any).staged && !(result as any).loaded);

  const canStage = useMemo(() => Boolean(file && !busy), [file, busy]);
  const canLoad = useMemo(
    () => Boolean(staged && file && !busy),
    [staged, file, busy]
  );

  function pickFile(f: File | null) {
    setFile(f);
    setResult(null);
  }

  function openFileDialog() {
    if (busy) return;
    inputRef.current?.click();
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (!busy) setDragActive(true);
  }

  function onDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (busy) return;
    const dropped = e.dataTransfer?.files?.[0] ?? null;
    if (dropped) pickFile(dropped);
  }

  const fileLabel = file
    ? `${file.name}${typeof file.size === "number" ? ` (${Math.round(file.size / 1024)} KB)` : ""}`
    : "No file selected";

  async function post(form: FormData) {
    const res = await fetch("/api/metrics/upload", { method: "POST", body: form });
    const json = (await res.json().catch(() => null)) as Result | null;
    return { res, json: json ?? { ok: false, error: "invalid response" } };
  }

  async function onStageVerify() {
    if (!file) return;
    setBusy(true);
    setResult(null);

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mode", "date");
      fd.append("picked_date", pickedDate);

      const { res, json } = await post(fd);
      setResult(json);
      if (res.ok) router.refresh();
    } catch (e: any) {
      setResult({ ok: false, error: String(e?.message ?? e) });
    } finally {
      setBusy(false);
    }
  }

  async function onConfirmLoad() {
    if (!file || !staged) return;
    setBusy(true);

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mode", "date");
      fd.append("picked_date", pickedDate);
      fd.append("confirm", "1");

      const { res, json } = await post(fd);
      setResult(json);
      if (res.ok) router.refresh();
    } catch (e: any) {
      setResult({ ok: false, error: String(e?.message ?? e) });
    } finally {
      setBusy(false);
    }
  }

  const stageOk =
    result && (result as any).ok && !(result as any).loaded ? (result as StageOk) : null;
  const loadOk =
    result && (result as any).ok && (result as any).loaded ? (result as LoadOk) : null;
  const err = result && !(result as any).ok ? (result as ApiErr) : null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 items-stretch">
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        disabled={busy}
        onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
      />

      <Card className="h-full">
        <div className="space-y-3">
          <div>
            <div className="text-sm font-medium">Upload Metrics (bulk TPR)</div>
            <div className="text-sm text-[var(--to-ink-muted)]">
              Pick the anchor date that belongs to the target metric fiscal month. Stage first, review the fiscal end date, then confirm load.
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-[var(--to-ink-muted)]">Anchor date</label>
            <input
              type="date"
              value={pickedDate}
              onChange={(e) => setPickedDate(e.target.value)}
              className="h-10 w-full rounded-xl border px-3 text-sm"
              disabled={busy}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              className="h-10 px-4 text-sm"
              onClick={openFileDialog}
              disabled={busy}
            >
              Choose file
            </Button>

            <div className="flex min-w-[220px] items-center text-xs text-[var(--to-ink-muted)]">
              {fileLabel}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              className="h-10 px-4 text-sm flex-1 min-w-[180px]"
              disabled={!canStage}
              onClick={onStageVerify}
            >
              {busy ? "Working…" : "Stage & verify"}
            </Button>

            <Button
              variant="primary"
              className="h-10 px-4 text-sm flex-1 min-w-[180px]"
              disabled={!canLoad}
              onClick={onConfirmLoad}
            >
              {busy ? "Working…" : "Confirm & load"}
            </Button>
          </div>

          {stageOk ? (
            <div className="text-sm space-y-1">
              <div>
                ✅ Staged <span className="font-medium">{stageOk.row_count_total}</span> rows
                · Fiscal end date: <span className="font-mono">{stageOk.fiscal_end_date}</span>
              </div>
              {stageOk.detected_title ? (
                <div className="text-[var(--to-ink-muted)] text-xs truncate">
                  File: {stageOk.detected_title}
                </div>
              ) : null}
              <div className="text-[var(--to-ink-muted)] text-xs">
                Warnings:{" "}
                <span className="font-medium">
                  {Array.isArray(stageOk.warning_flags) ? stageOk.warning_flags.length : 0}
                </span>
              </div>
            </div>
          ) : null}

          {loadOk ? (
            <div className="text-sm space-y-1">
              <div>
                ✅ Loaded <span className="font-medium">{loadOk.row_count_loaded}</span> rows
                · Fiscal end date: <span className="font-mono">{loadOk.fiscal_end_date}</span>
              </div>
            </div>
          ) : null}

          {err ? (
            <div className="text-sm space-y-1">
              <div className="text-red-600">❌ {err.error}</div>
              {err.hint ? (
                <div className="text-[var(--to-ink-muted)] text-xs">{err.hint}</div>
              ) : null}
            </div>
          ) : null}
        </div>
      </Card>

      <Card className="h-full">
        <div className="flex h-full flex-col gap-3">
          <div>
            <div className="text-sm font-medium">Drop zone</div>
            <div className="text-sm text-[var(--to-ink-muted)]">
              Drop the bulk TPR workbook here, or click anywhere in the box to browse.
            </div>
          </div>

          <div
            onClick={openFileDialog}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && !busy) openFileDialog();
            }}
            className={[
              "rounded-xl border border-dashed select-none transition-colors",
              "flex flex-1 w-full flex-col items-center justify-center text-center",
              busy ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
              dragActive
                ? "border-[color:var(--to-border-strong)] bg-black/5"
                : "border-[color:var(--to-border)]",
            ].join(" ")}
          >
            <div className="text-sm font-medium">
              {dragActive ? "Drop to select file" : "Click or drop file"}
            </div>
            <div className="mt-1 max-w-[90%] truncate text-xs text-[var(--to-ink-muted)]">
              {fileLabel}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
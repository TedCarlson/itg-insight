"use client";

import { useState } from "react";
import OverlayPanel from "@/components/ui/OverlayPanel";

export function FuseOnboardingLauncher() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<Record<string, unknown> | null>(null);

  async function importReport() {
    if (!file) return;

    setImporting(true);
    setImportResult(null);

    const form = new FormData();
    form.append("file", file);

    const res = await fetch("/api/reports/fuse/onboarding/import", {
      method: "POST",
      body: form,
    });

    const json = await res.json();

    setImportResult({
      ...json,
      ok: res.ok && json?.ok === true,
      status: res.status,
    });
    setImporting(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border px-4 py-2 text-sm"
      >
        FUSE Upload
      </button>

      {open ? (
        <OverlayPanel
          title="FUSE Onboarding Upload"
          onClose={() => setOpen(false)}
        >
          <div className="space-y-5">
            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="text-sm font-medium">Upload FUSE report</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Select the exported FUSE onboarding workbook. Insight will import all rows from the first worksheet.
              </div>

              <input
                type="file"
                accept=".xlsx,.xls"
                className="mt-4"
                onChange={(e) => {
                  setImportResult(null);
                  setFile(e.target.files?.[0] ?? null);
                }}
              />
            </div>

            {importResult ? (
              <div className="rounded-xl border bg-muted/30 p-3 text-sm">
                Import result: {String(importResult.ok ?? false)} • Status:{" "}
                {String(importResult.status ?? "—")} • Batch:{" "}
                {String(importResult.batch_id ?? "—")} • Rows:{" "}
                {String(importResult.row_count ?? "—")}
                {importResult.error ? (
                  <div className="mt-2 text-xs text-[var(--to-danger)]">
                    {String(importResult.error)}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex justify-end gap-2 border-t pt-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border px-4 py-2 text-sm"
              >
                Close
              </button>

              <button
                type="button"
                disabled={!file || importing}
                onClick={importReport}
                className="rounded-xl border px-4 py-2 text-sm disabled:opacity-40"
              >
                {importing ? "Importing..." : "Import"}
              </button>
            </div>
          </div>
        </OverlayPanel>
      ) : null}
    </>
  );
}

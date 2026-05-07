// path: apps/web/src/shared/surfaces/reports/WorkforceReportLauncher.tsx

"use client";

import { useState } from "react";
import { WorkforceReportModal } from "./WorkforceReportModal";
import type { WorkforceRow } from "@/shared/types/workforce/workforce.types";

type Props = {
  rows: WorkforceRow[];
  regionLabel: string;
  reportMonthLabel: string;
};

export function WorkforceReportLauncher({
  rows,
  regionLabel,
  reportMonthLabel,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border px-4 py-2 text-sm"
      >
        Workforce
      </button>

      <WorkforceReportModal
        open={open}
        rows={rows}
        onClose={() => setOpen(false)}
        regionLabel={regionLabel}
        reportMonthLabel={reportMonthLabel}
      />
    </>
  );
}
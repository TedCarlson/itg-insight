"use client";

import { Card } from "@/components/ui/Card";
import BpViewRosterSurface from "@/features/bp-view/components/BpViewRosterSurface";

import type { BpViewRosterRow } from "@/features/bp-view/lib/bpView.types";
import type { CompanySupervisorRosterRow } from "../lib/companySupervisorView.types";
import type { CompanySupervisorPrimarySegment } from "./CompanySupervisorParityTable";

export default function CompanySupervisorRosterSection(props: {
  rows: CompanySupervisorRosterRow[];
  columns: Array<{ kpi_key: string; label: string }>;
  primarySegment: CompanySupervisorPrimarySegment;
  bpContractor: string;
  title?: string;
  subtitle?: string;
  onSelectRow: (row: CompanySupervisorRosterRow) => void;
}) {
  const {
    rows,
    columns,
    primarySegment,
    bpContractor,
    title,
    subtitle,
    onSelectRow,
  } = props;

  /**
   * IMPORTANT:
   * We only FILTER here.
   * We do NOT sort here.
   * Order must remain exactly as built upstream by the payload layer.
   */
  const filteredRows =
    primarySegment === "ITG"
      ? rows.filter((row) => row.team_class === "ITG")
      : primarySegment === "BP"
        ? rows.filter(
            (row) =>
              row.team_class === "BP" &&
              (bpContractor === "ALL" || row.contractor_name === bpContractor)
          )
        : rows;

  const summaryLabel =
    primarySegment === "ITG"
      ? `ITG workforce • ${filteredRows.length} tech${filteredRows.length === 1 ? "" : "s"}`
      : primarySegment === "BP"
        ? bpContractor !== "ALL"
          ? `${bpContractor} workforce • ${filteredRows.length} tech${filteredRows.length === 1 ? "" : "s"}`
          : `BP workforce • ${filteredRows.length} tech${filteredRows.length === 1 ? "" : "s"}`
        : `All workforce • ${filteredRows.length} tech${filteredRows.length === 1 ? "" : "s"}`;

  return (
    <Card className="p-4">
      <div className="mb-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          {title ?? "Team Performance"}
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          {subtitle ?? summaryLabel}
        </div>
      </div>

      <BpViewRosterSurface
        columns={columns}
        rows={filteredRows as BpViewRosterRow[]}
        onSelectRow={(row) => onSelectRow(row as CompanySupervisorRosterRow)}
      />
    </Card>
  );
}
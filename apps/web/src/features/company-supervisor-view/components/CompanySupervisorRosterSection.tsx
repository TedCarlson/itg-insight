"use client";

import { Card } from "@/components/ui/Card";
import BpViewRosterSurface from "@/features/bp-view/components/BpViewRosterSurface";

import type { CompanySupervisorRosterRow } from "../lib/companySupervisorView.types";
import type { CompanySupervisorPrimarySegment } from "./CompanySupervisorParityTable";

function SegmentChip(props: {
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={[
        "rounded-xl border px-3 py-2 text-xs font-medium transition active:scale-[0.98]",
        props.active
          ? "border-[var(--to-accent)] bg-[color-mix(in_oklab,var(--to-accent)_10%,white)] text-foreground"
          : "bg-background text-muted-foreground hover:bg-muted/30",
      ].join(" ")}
    >
      {props.label}
    </button>
  );
}

export default function CompanySupervisorRosterSection(props: {
  rows: CompanySupervisorRosterRow[];
  columns: Array<{ kpi_key: string; label: string }>;
  primarySegment: CompanySupervisorPrimarySegment;
  bpContractor: string;
  onChangePrimarySegment: (next: CompanySupervisorPrimarySegment) => void;
  onChangeBpContractor: (next: string) => void;
}) {
  const {
    rows,
    columns,
    primarySegment,
    bpContractor,
    onChangePrimarySegment,
    onChangeBpContractor,
  } = props;

  const bpContractors = Array.from(
    new Set(
      rows
        .filter((row) => row.team_class === "BP")
        .map((row) => row.contractor_name?.trim() ?? "")
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

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

  function handlePrimarySegmentChange(next: CompanySupervisorPrimarySegment) {
    onChangePrimarySegment(next);
    if (next !== "BP") {
      onChangeBpContractor("ALL");
    }
  }

  return (
    <Card className="p-4">
      <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Workforce KPI Table
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {summaryLabel}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <SegmentChip
              label="ALL"
              active={primarySegment === "ALL"}
              onClick={() => handlePrimarySegmentChange("ALL")}
            />
            <SegmentChip
              label="ITG"
              active={primarySegment === "ITG"}
              onClick={() => handlePrimarySegmentChange("ITG")}
            />
            <SegmentChip
              label="BP"
              active={primarySegment === "BP"}
              onClick={() => handlePrimarySegmentChange("BP")}
            />
          </div>

          {primarySegment === "BP" && bpContractors.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <SegmentChip
                label="All BP"
                active={bpContractor === "ALL"}
                onClick={() => onChangeBpContractor("ALL")}
              />
              {bpContractors.map((contractor) => (
                <SegmentChip
                  key={contractor}
                  label={contractor}
                  active={bpContractor === contractor}
                  onClick={() => onChangeBpContractor(contractor)}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <BpViewRosterSurface
        columns={columns}
        rows={filteredRows as any}
        onSelectRow={() => {}}
      />
    </Card>
  );
}
"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { PageShell } from "@/components/ui/PageShell";
import { Card } from "@/components/ui/Card";

import BpViewKpiStrip from "@/features/bp-view/components/BpViewKpiStrip";
import BpViewRiskStrip from "@/features/bp-view/components/BpViewRiskStrip";
import BpWorkMixCard from "@/features/bp-view/components/BpWorkMixCard";
import BpTechDrillDrawer from "@/features/bp-view/components/BpTechDrillDrawer";

import CompanySupervisorParityTable, {
  type CompanySupervisorPrimarySegment,
} from "../components/CompanySupervisorParityTable";
import CompanySupervisorRosterSection from "../components/CompanySupervisorRosterSection";

import type {
  CompanySupervisorPayload,
  CompanySupervisorRosterRow,
} from "../lib/companySupervisorView.types";

type RangeKey = "FM" | "PREVIOUS" | "3FM" | "12FM";

function normalizeRange(value: string | null | undefined): RangeKey {
  const upper = String(value ?? "FM").toUpperCase();
  if (upper === "PREVIOUS") return "PREVIOUS";
  if (upper === "3FM") return "3FM";
  if (upper === "12FM") return "12FM";
  return "FM";
}

function mapRangeForDrawer(range: RangeKey): RangeKey {
  return range;
}

function InlineSpinner() {
  return (
    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
  );
}

function RangeChip(props: {
  label: string;
  active?: boolean;
  pending?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.pending}
      className={[
        "flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition active:scale-[0.98]",
        props.active
          ? "border-[var(--to-accent)] bg-[color-mix(in_oklab,var(--to-accent)_10%,white)] text-foreground"
          : "bg-background text-muted-foreground hover:bg-muted/30",
        props.pending ? "opacity-90" : "",
      ].join(" ")}
    >
      {props.pending ? <InlineSpinner /> : null}
      <span>{props.label}</span>
    </button>
  );
}

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

function ScopeChip(props: {
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={[
        "rounded-xl border px-3 py-2 text-xs font-medium transition",
        props.active
          ? "border-[var(--to-primary)] bg-[color-mix(in_oklab,var(--to-primary)_10%,white)] text-foreground"
          : "bg-background text-muted-foreground hover:bg-muted/30",
      ].join(" ")}
    >
      {props.label}
    </button>
  );
}

function InfoPill(props: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border bg-muted/10 px-3 py-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {props.label}
      </div>
      <div className="mt-1 text-sm font-semibold">{props.value}</div>
    </div>
  );
}

function formatRangeLabel(range: RangeKey) {
  if (range === "FM") return "Current";
  if (range === "PREVIOUS") return "Previous";
  if (range === "3FM") return "3 FM";
  return "12 FM";
}

export default function CompanySupervisorPage(props: {
  payload: CompanySupervisorPayload;
}) {
  const { payload } = props;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [selectedRow, setSelectedRow] =
    useState<CompanySupervisorRosterRow | null>(null);

  const [primarySegment, setPrimarySegment] =
    useState<CompanySupervisorPrimarySegment>("ALL");
  const [bpContractor, setBpContractor] = useState<string>("ALL");

  const activeRangeFromUrl = normalizeRange(searchParams.get("range"));
  const [pendingRange, setPendingRange] = useState<RangeKey | null>(null);

  const optimisticRange =
    isPending && pendingRange ? pendingRange : activeRangeFromUrl;

  function setRange(next: RangeKey) {
    if (next === activeRangeFromUrl) return;

    setPendingRange(next);

    startTransition(() => {
      const qs = new URLSearchParams(searchParams.toString());

      if (next === "FM") {
        qs.delete("range");
      } else {
        qs.set("range", next);
      }

      const href = qs.toString() ? `${pathname}?${qs.toString()}` : pathname;
      router.push(href);
      router.refresh();
    });
  }

  function handlePrimarySegmentChange(next: CompanySupervisorPrimarySegment) {
    setPrimarySegment(next);
    if (next !== "BP") {
      setBpContractor("ALL");
    }
  }

  const bpContractors = Array.from(
    new Set(
      payload.roster_rows
        .filter((row) => row.team_class === "BP")
        .map((row) => row.contractor_name?.trim() ?? "")
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

  const subtitleParts = [
    payload.header.role_label,
    payload.header.rep_full_name,
  ].filter(Boolean);

  const parityRows =
    primarySegment === "ITG"
      ? payload.parityRows.filter((row) => row.label === "ITG")
      : primarySegment === "BP"
        ? bpContractor === "ALL"
          ? payload.parityRows.filter((row) => row.label === "BP")
          : payload.parityRows.filter((row) => row.label === bpContractor)
        : payload.parityRows;

  return (
    <PageShell>
      <div className="space-y-6">
        <section
          className={[
            "rounded-2xl border bg-card p-4 transition",
            isPending ? "opacity-90" : "",
          ].join(" ")}
        >
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-1">
              <div className="text-xl font-semibold">Company Supervisor</div>
              <div className="text-sm text-muted-foreground">
                {subtitleParts.join(" • ")}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-3">
              <InfoPill
                label="Scope"
                value={payload.header.scope_label ?? "—"}
              />
              <InfoPill
                label="Headcount"
                value={String(payload.header.headcount)}
              />
              <InfoPill label="As Of" value={payload.header.as_of_date} />
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="space-y-2">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Org Scope
              </div>
              <div className="flex flex-wrap gap-2">
                <ScopeChip label={payload.header.org_label} active />
                <ScopeChip label={`Org Count: ${payload.header.org_count}`} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Range
              </div>
              <div className="flex flex-wrap gap-2">
                <RangeChip
                  label="Current"
                  active={optimisticRange === "FM"}
                  pending={isPending && pendingRange === "FM"}
                  onClick={() => setRange("FM")}
                />
                <RangeChip
                  label="Previous"
                  active={optimisticRange === "PREVIOUS"}
                  pending={isPending && pendingRange === "PREVIOUS"}
                  onClick={() => setRange("PREVIOUS")}
                />
                <RangeChip
                  label="3 FM"
                  active={optimisticRange === "3FM"}
                  pending={isPending && pendingRange === "3FM"}
                  onClick={() => setRange("3FM")}
                />
                <RangeChip
                  label="12 FM"
                  active={optimisticRange === "12FM"}
                  pending={isPending && pendingRange === "12FM"}
                  onClick={() => setRange("12FM")}
                />
              </div>
            </div>
          </div>
        </section>

        <BpViewKpiStrip items={payload.kpi_strip as any} />

        <BpViewRiskStrip items={payload.risk_strip as any} />

        <Card className="p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <BpWorkMixCard workMix={payload.work_mix as any} />
            </div>

            <div className="space-y-2 lg:pl-4">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Workforce Slice
              </div>

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
                    onClick={() => setBpContractor("ALL")}
                  />
                  {bpContractors.map((contractor) => (
                    <SegmentChip
                      key={contractor}
                      label={contractor}
                      active={bpContractor === contractor}
                      onClick={() => setBpContractor(contractor)}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </Card>

        <CompanySupervisorParityTable
          rows={parityRows}
          rosterColumns={payload.roster_columns}
          primarySegment={primarySegment}
          bpContractor={bpContractor}
        />

        <CompanySupervisorRosterSection
          rows={payload.roster_rows}
          columns={payload.roster_columns}
          primarySegment={primarySegment}
          bpContractor={bpContractor}
          title={`All workforce • ${payload.header.headcount} techs`}
          subtitle={`Range: ${formatRangeLabel(payload.header.range_label)}`}
          onSelectRow={setSelectedRow}
        />
      </div>

      <BpTechDrillDrawer
        open={!!selectedRow}
        row={selectedRow as any}
        range={mapRangeForDrawer(payload.header.range_label)}
        onClose={() => setSelectedRow(null)}
      />
    </PageShell>
  );
}
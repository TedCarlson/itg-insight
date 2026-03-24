"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { PageShell } from "@/components/ui/PageShell";
import { Card } from "@/components/ui/Card";

import BpViewKpiStrip from "@/features/bp-view/components/BpViewKpiStrip";
import BpViewRiskStrip from "@/features/bp-view/components/BpViewRiskStrip";

import CompanySupervisorParityTable, {
  type CompanySupervisorPrimarySegment,
} from "../components/CompanySupervisorParityTable";
import CompanySupervisorRosterSection from "../components/CompanySupervisorRosterSection";

import type { CompanySupervisorPayload } from "../lib/companySupervisorView.types";

type RangeKey = "FM" | "3FM" | "12FM";

function normalizeRange(value: string | null | undefined): RangeKey {
  const upper = String(value ?? "FM").toUpperCase();
  if (upper === "3FM") return "3FM";
  if (upper === "12FM") return "12FM";
  return "FM";
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
        "rounded-xl border px-3 py-2 text-xs font-medium transition active:scale-[0.98]",
        props.active
          ? "border-[var(--to-accent)] bg-[color-mix(in_oklab,var(--to-accent)_10%,white)] text-foreground"
          : "bg-background text-muted-foreground hover:bg-muted/30",
        props.pending ? "opacity-80" : "",
      ].join(" ")}
    >
      {props.label}
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

export default function CompanySupervisorPage(props: {
  payload: CompanySupervisorPayload;
}) {
  const { payload } = props;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [primarySegment, setPrimarySegment] =
    useState<CompanySupervisorPrimarySegment>("ALL");
  const [bpContractor, setBpContractor] = useState<string>("ALL");

  const activeRange = normalizeRange(searchParams.get("range"));

  function setRange(next: RangeKey) {
    if (next === activeRange) return;

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

  return (
    <PageShell>
      <Card className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs uppercase text-muted-foreground">
              {payload.header.role_label}
            </div>

            <div className="text-lg font-semibold">
              {payload.header.scope_label}
            </div>

            <div className="text-sm text-muted-foreground">
              Headcount: {payload.header.headcount} • Range:{" "}
              {payload.header.range_label}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Range
            </div>

            <div className="flex flex-wrap gap-2">
              <RangeChip
                label="Current"
                active={activeRange === "FM"}
                pending={isPending && activeRange !== "FM"}
                onClick={() => setRange("FM")}
              />
              <RangeChip
                label="3 FM"
                active={activeRange === "3FM"}
                pending={isPending && activeRange !== "3FM"}
                onClick={() => setRange("3FM")}
              />
              <RangeChip
                label="12 FM"
                active={activeRange === "12FM"}
                pending={isPending && activeRange !== "12FM"}
                onClick={() => setRange("12FM")}
              />
            </div>
          </div>
        </div>
      </Card>

      <BpViewKpiStrip items={payload.kpi_strip as any} />

      <BpViewRiskStrip items={payload.risk_strip as any} />

      <Card className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs uppercase text-muted-foreground">Work Mix</div>
            <div className="mt-2 flex flex-wrap gap-6 text-sm">
              <div>Jobs: {payload.work_mix.total}</div>
              <div>Installs: {payload.work_mix.installs}</div>
              <div>TCs: {payload.work_mix.tcs}</div>
              <div>SROs: {payload.work_mix.sros}</div>
            </div>
          </div>

          <div className="space-y-2">
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
        rows={payload.roster_rows}
        rosterColumns={payload.roster_columns}
        primarySegment={primarySegment}
        bpContractor={bpContractor}
      />

      <CompanySupervisorRosterSection
        rows={payload.roster_rows}
        columns={payload.roster_columns}
        primarySegment={primarySegment}
        bpContractor={bpContractor}
        onChangePrimarySegment={handlePrimarySegmentChange}
        onChangeBpContractor={setBpContractor}
      />
    </PageShell>
  );
}
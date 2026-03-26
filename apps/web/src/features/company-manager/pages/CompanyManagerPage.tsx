"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { PageShell } from "@/components/ui/PageShell";
import { Card } from "@/components/ui/Card";

import BpViewKpiStrip from "@/features/bp-view/components/BpViewKpiStrip";
import BpViewRiskStrip from "@/features/bp-view/components/BpViewRiskStrip";
import BpWorkMixCard from "@/features/bp-view/components/BpWorkMixCard";
import BpTechDrillDrawer from "@/features/bp-view/components/BpTechDrillDrawer";
import BpViewRosterSurface from "@/features/bp-view/components/BpViewRosterSurface";

import CompanyManagerControlBar, {
  type CompanyManagerSegment,
  type CompanyManagerViewMode,
} from "../components/CompanyManagerControlBar";
import CompanyManagerOfficeTable from "../components/CompanyManagerOfficeTable";
import CompanyManagerLeadershipTable from "../components/CompanyManagerLeadershipTable";

import type {
  CompanyManagerPayload,
  CompanyManagerRosterRow,
} from "../lib/companyManagerView.types";

type RangeKey = "FM" | "PREVIOUS" | "3FM" | "12FM";

function normalizeRange(value: string | null | undefined): RangeKey {
  const upper = String(value ?? "FM").toUpperCase();
  if (upper === "PREVIOUS") return "PREVIOUS";
  if (upper === "3FM") return "3FM";
  if (upper === "12FM") return "12FM";
  return "FM";
}

function mapRangeForDrawer(range: RangeKey): "FM" | "3FM" | "12FM" {
  if (range === "PREVIOUS") return "FM";
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

function filterRows(args: {
  rows: CompanyManagerRosterRow[];
  segment: CompanyManagerSegment;
  contractor: string;
  office: string | null;
  leader: string | null;
}) {
  const { rows, segment, contractor, office, leader } = args;

  let out = rows;

  if (office) {
    out = out.filter((row) => row.context === office);
  }

  if (leader) {
    out = out.filter((row) => {
      const leaderName = String((row as any).leader_name ?? "").trim() || "Unassigned";
      const leaderTitle = String((row as any).leader_title ?? "").trim();
      const leaderKey = `${leaderName}::${leaderTitle}`;
      return leaderKey === leader;
    });
  }

  if (segment === "ITG") {
    out = out.filter((row) => row.team_class === "ITG");
  }

  if (segment === "BP") {
    out = out.filter(
      (row) =>
        row.team_class === "BP" &&
        (contractor === "ALL" || row.contractor_name === contractor)
    );
  }

  return out;
}

export default function CompanyManagerPage(props: {
  payload: CompanyManagerPayload;
}) {
  const { payload } = props;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [selectedRow, setSelectedRow] =
    useState<CompanyManagerRosterRow | null>(null);

  const [viewMode, setViewMode] =
    useState<CompanyManagerViewMode>("OFFICE");
  const [segment, setSegment] =
    useState<CompanyManagerSegment>("ALL");
  const [contractor, setContractor] = useState<string>("ALL");
  const [activeOffice, setActiveOffice] = useState<string | null>(null);
  const [activeLeader, setActiveLeader] = useState<string | null>(null);

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

  function handleSegmentChange(next: CompanyManagerSegment) {
    setSegment(next);
    if (next !== "BP") {
      setContractor("ALL");
    }
  }

  const subtitleParts = [
    payload.header.role_label,
    payload.header.rep_full_name,
  ].filter(Boolean);

  const contractorOptions = useMemo(
    () =>
      Array.from(
        new Set(
          payload.roster_rows
            .filter((row) => row.team_class === "BP")
            .map((row) => row.contractor_name?.trim() ?? "")
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b)),
    [payload.roster_rows]
  );

  const officeRows = useMemo(() => {
    if (segment === "ITG") return payload.office_rollups.ITG;
    if (segment === "BP") {
      return contractor === "ALL"
        ? payload.office_rollups.BP
        : payload.office_rollups.BP_BY_CONTRACTOR[contractor] ?? [];
    }
    return payload.office_rollups.ALL;
  }, [payload.office_rollups, segment, contractor]);

  const leadershipRows = useMemo(() => {
    if (segment === "ITG") return payload.leadership_rollups.ITG;
    if (segment === "BP") {
      return contractor === "ALL"
        ? payload.leadership_rollups.BP
        : payload.leadership_rollups.BP_BY_CONTRACTOR[contractor] ?? [];
    }
    return payload.leadership_rollups.ALL;
  }, [payload.leadership_rollups, segment, contractor]);

  const filteredRows = useMemo(
    () =>
      filterRows({
        rows: payload.roster_rows,
        segment,
        contractor,
        office: activeOffice,
        leader: activeLeader,
      }),
    [payload.roster_rows, segment, contractor, activeOffice, activeLeader]
  );

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
              <div className="text-xl font-semibold">Company Manager</div>
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
          <BpWorkMixCard workMix={payload.work_mix as any} />
        </Card>

        <CompanyManagerControlBar
          viewMode={viewMode}
          onViewModeChange={(next) => {
            setViewMode(next);
            if (next !== "OFFICE") setActiveOffice(null);
            if (next !== "LEADERSHIP") setActiveLeader(null);
          }}
          segment={segment}
          onSegmentChange={handleSegmentChange}
          contractorOptions={contractorOptions}
          contractor={contractor}
          onContractorChange={setContractor}
        />

        {viewMode === "OFFICE" ? (
          <Card className="p-4">
            <div className="mb-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Office Performance
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {`${officeRows.length} offices • ${segment} segment • Range: ${formatRangeLabel(
                  payload.header.range_label
                )}`}
              </div>
            </div>

            <CompanyManagerOfficeTable
              rows={officeRows}
              activeOffice={activeOffice}
              onSelectOffice={(next) => {
                setActiveOffice(next);
                if (next) setActiveLeader(null);
              }}
            />
          </Card>
        ) : null}

        {viewMode === "LEADERSHIP" ? (
          <Card className="p-4">
            <div className="mb-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Leadership Performance
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {`${leadershipRows.length} leaders • ${segment} segment • Range: ${formatRangeLabel(
                  payload.header.range_label
                )}`}
              </div>
            </div>

            <CompanyManagerLeadershipTable
              rows={leadershipRows}
              activeLeader={activeLeader}
              onSelectLeader={(next) => {
                setActiveLeader(next);
                if (next) setActiveOffice(null);
              }}
            />
          </Card>
        ) : null}

        <Card className="p-4">
          <div className="mb-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Workforce Performance
            </div>

            {activeOffice ? (
              <div className="mb-2 text-xs text-muted-foreground">
                Viewing office:{" "}
                <span className="font-medium">{activeOffice}</span>
                <button
                  type="button"
                  className="ml-2 underline"
                  onClick={() => setActiveOffice(null)}
                >
                  Clear
                </button>
              </div>
            ) : null}

            {activeLeader ? (
              <div className="mb-2 text-xs text-muted-foreground">
                Viewing leader:{" "}
                <span className="font-medium">
                  {activeLeader.split("::")[0]}
                </span>
                <button
                  type="button"
                  className="ml-2 underline"
                  onClick={() => setActiveLeader(null)}
                >
                  Clear
                </button>
              </div>
            ) : null}

            <div className="mt-1 text-sm text-muted-foreground">
              {`${viewMode} view • ${filteredRows.length} techs • Range: ${formatRangeLabel(
                payload.header.range_label
              )}`}
            </div>
          </div>

          <BpViewRosterSurface
            columns={payload.roster_columns}
            rows={filteredRows as any}
            onSelectRow={(row) => setSelectedRow(row as CompanyManagerRosterRow)}
          />
        </Card>
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
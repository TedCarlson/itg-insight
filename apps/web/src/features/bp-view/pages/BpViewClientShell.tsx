"use client";

import { useMemo, useState } from "react";

import type {
  BpRangeKey,
  BpRollupDrillPayload,
  BpViewKpiItem,
  BpViewPayload,
  BpViewRosterRow,
} from "../lib/bpView.types";

import BpViewHeader from "../components/BpViewHeader";
import BpViewKpiStrip from "../components/BpViewKpiStrip";
import BpViewRiskStrip from "../components/BpViewRiskStrip";
import BpWorkMixCard from "../components/BpWorkMixCard";
import BpViewRosterSurface from "../components/BpViewRosterSurface";
import BpTechDrillDrawer from "../components/BpTechDrillDrawer";
import BpRollupDrillDrawer from "../components/BpRollupDrillDrawer";

type TnpsDensityMode = "all_checkpoints" | "monthly_finals";

function fmtPct(value: number | null | undefined, decimals = 1) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(decimals)}%`;
}

function computePct(part: number, total: number) {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return null;
  return (100 * part) / total;
}

function computeDelta(current: number | null | undefined, prior: number | null | undefined) {
  if (current == null || prior == null) return null;
  return current - prior;
}

function buildTnpsInspectionPayload(args: {
  payload: BpViewPayload;
  initialRange: BpRangeKey;
  selectedKpi: BpViewKpiItem;
  densityMode: TnpsDensityMode;
}): BpRollupDrillPayload {
  const { payload, initialRange, selectedKpi, densityMode } = args;

  const workByTech = new Map(
    payload.roster_rows.map((row) => [row.tech_id, row.work_mix.total])
  );

  const tnps = payload.rollup_tnps;

  const waypointRows =
    densityMode === "monthly_finals"
      ? (tnps?.monthly_finals ?? [])
      : (tnps?.all_checkpoints ?? []);

  const priorPeriodRow =
    waypointRows.length >= 2 ? waypointRows[waypointRows.length - 2] : null;

  const priorValue = priorPeriodRow?.tnps_value ?? null;
  const deltaValue = computeDelta(selectedKpi.value, priorValue);

  const contributors =
    tnps?.contributors.map((row) => ({
      tech_id: row.tech_id,
      full_name: row.full_name,
      contractor_name: row.contractor_name ?? null,
      work_total: workByTech.get(row.tech_id) ?? row.work_total ?? 0,
      metric_value: row.tnps_value,
      metric_value_display: row.tnps_display,
    })) ?? [];

  const jobsTotal = payload.work_mix.total;
  const surveys = tnps?.summary.surveys ?? 0;
  const promoters = tnps?.summary.promoters ?? 0;
  const passives = tnps?.summary.passives ?? 0;
  const detractors = tnps?.summary.detractors ?? 0;

  return {
    scope: {
      scope_type: "bp_supervisor",
      scope_key: payload.header.org_label,
      label: payload.header.scope_label || "BP Supervisor",
      subtitle: payload.header.rep_full_name ?? payload.header.org_label,
      range_label: initialRange,
    },
    headcount: payload.header.headcount,
    work_mix: payload.work_mix,
    selected_kpi: {
      kpi_key: selectedKpi.kpi_key,
      label: selectedKpi.label,
      value: selectedKpi.value,
      value_display: selectedKpi.value_display,
      band_key: selectedKpi.band_key,
      band_label: selectedKpi.band_label,

      prior_value: priorValue,
      prior_value_display: priorPeriodRow?.tnps_display ?? null,
      delta_value: deltaValue,
      delta_display:
        deltaValue == null
          ? null
          : `${deltaValue >= 0 ? "+" : ""}${deltaValue.toFixed(1)}`,

      fact_rows: [
        {
          label: "Surveys",
          value: String(surveys),
        },
        {
          label: "Promoters",
          value: String(promoters),
        },
        {
          label: "Passives",
          value: String(passives),
        },
        {
          label: "Detractors",
          value: String(detractors),
        },
        {
          label: "Density Mode",
          value:
            densityMode === "monthly_finals"
              ? "Fiscal Month Finals"
              : "All Checkpoints",
        },
      ],
      sentiment_mix: tnps?.summary
        ? {
            surveys,
            promoters,
            passives,
            detractors,
          }
        : null,
      period_detail: waypointRows,
      trend: waypointRows.map((row) => ({
        label: row.metric_date,
        value: row.tnps_value,
        is_final: row.is_month_final === true,
      })),
      tnps_contributors: tnps?.contributors.map((row) => ({
        ...row,
        work_total: workByTech.get(row.tech_id) ?? row.work_total ?? 0,
      })) ?? [],
      scope_context_rates: [
        {
          label: "Survey / Jobs",
          value: computePct(surveys, jobsTotal),
          value_display: fmtPct(computePct(surveys, jobsTotal)),
        },
        {
          label: "Promoters / Jobs",
          value: computePct(promoters, jobsTotal),
          value_display: fmtPct(computePct(promoters, jobsTotal)),
        },
        {
          label: "Passives / Jobs",
          value: computePct(passives, jobsTotal),
          value_display: fmtPct(computePct(passives, jobsTotal)),
        },
        {
          label: "Detractors / Jobs",
          value: computePct(detractors, jobsTotal),
          value_display: fmtPct(computePct(detractors, jobsTotal)),
        },
      ],
    },
    contributors,
  };
}

function buildGenericInspectionPayload(args: {
  payload: BpViewPayload;
  initialRange: BpRangeKey;
  selectedKpi: BpViewKpiItem;
}): BpRollupDrillPayload {
  const { payload, initialRange, selectedKpi } = args;

  const contributors = payload.roster_rows
    .map((row) => {
      const metric = row.metrics.find((m) => m.kpi_key === selectedKpi.kpi_key);

      return {
        tech_id: row.tech_id,
        full_name: row.full_name,
        contractor_name: row.contractor_name ?? null,
        work_total: row.work_mix.total,
        metric_value: metric?.value ?? null,
        metric_value_display: metric?.value_display ?? null,
      };
    })
    .sort(
      (a, b) =>
        b.work_total - a.work_total || a.full_name.localeCompare(b.full_name)
    );

  return {
    scope: {
      scope_type: "bp_supervisor",
      scope_key: payload.header.org_label,
      label: payload.header.scope_label || "BP Supervisor",
      subtitle: payload.header.rep_full_name ?? payload.header.org_label,
      range_label: initialRange,
    },
    headcount: payload.header.headcount,
    work_mix: payload.work_mix,
    selected_kpi: {
      kpi_key: selectedKpi.kpi_key,
      label: selectedKpi.label,
      value: selectedKpi.value,
      value_display: selectedKpi.value_display,
      band_key: selectedKpi.band_key,
      band_label: selectedKpi.band_label,
      fact_rows: [
        {
          label: "Support",
          value: selectedKpi.support ?? "—",
        },
      ],
      sentiment_mix: null,
      period_detail: [],
      trend: [],
      tnps_contributors: [],
      scope_context_rates: [],
    },
    contributors,
  };
}

function buildRollupPayload(args: {
  payload: BpViewPayload;
  initialRange: BpRangeKey;
  selectedKpi: BpViewKpiItem | null;
  tnpsDensityMode: TnpsDensityMode;
}): BpRollupDrillPayload | null {
  const { payload, initialRange, selectedKpi, tnpsDensityMode } = args;
  if (!selectedKpi) return null;

  const key = selectedKpi.kpi_key.toLowerCase();

  if (key.includes("tnps")) {
    return buildTnpsInspectionPayload({
      payload,
      initialRange,
      selectedKpi,
      densityMode: tnpsDensityMode,
    });
  }

  return buildGenericInspectionPayload({
    payload,
    initialRange,
    selectedKpi,
  });
}

export default function BpViewClientShell(props: {
  payload: BpViewPayload;
  initialRange: BpRangeKey;
}) {
  const { payload, initialRange } = props;

  const [selectedRow, setSelectedRow] = useState<BpViewRosterRow | null>(null);
  const [selectedRollupKpi, setSelectedRollupKpi] =
    useState<BpViewKpiItem | null>(null);
  const [tnpsDensityMode, setTnpsDensityMode] = useState<TnpsDensityMode>(
    initialRange === "12FM" ? "monthly_finals" : "all_checkpoints"
  );

  const rollupPayload = useMemo(
    () =>
      buildRollupPayload({
        payload,
        initialRange,
        selectedKpi: selectedRollupKpi,
        tnpsDensityMode,
      }),
    [payload, initialRange, selectedRollupKpi, tnpsDensityMode]
  );

  return (
    <div className="space-y-6">
      <BpViewHeader header={payload.header} />

      <div className="space-y-6">
        <BpViewKpiStrip
          items={payload.kpi_strip}
          selectedKpiKey={selectedRollupKpi?.kpi_key ?? null}
          onSelectItem={(item) => {
            setSelectedRollupKpi(item);

            if (item.kpi_key.toLowerCase().includes("tnps")) {
              setTnpsDensityMode(
                initialRange === "12FM" ? "monthly_finals" : "all_checkpoints"
              );
            }
          }}
        />
        <BpWorkMixCard workMix={payload.work_mix} />
        <BpViewRiskStrip items={payload.risk_strip} />
        <BpViewRosterSurface
          columns={payload.roster_columns}
          rows={payload.roster_rows}
          onSelectRow={setSelectedRow}
        />
      </div>

      <BpTechDrillDrawer
        open={!!selectedRow}
        row={selectedRow}
        range={initialRange}
        onClose={() => setSelectedRow(null)}
      />

      <BpRollupDrillDrawer
        open={!!selectedRollupKpi}
        payload={rollupPayload}
        kpis={payload.kpi_strip}
        activeKpi={selectedRollupKpi}
        onSelectKpi={(item) => {
          setSelectedRollupKpi(item);

          if (item.kpi_key.toLowerCase().includes("tnps")) {
            setTnpsDensityMode(
              initialRange === "12FM" ? "monthly_finals" : "all_checkpoints"
            );
          }
        }}
        onClose={() => setSelectedRollupKpi(null)}
        tnpsDensityMode={tnpsDensityMode}
        onTnpsDensityModeChange={setTnpsDensityMode}
      />
    </div>
  );
}
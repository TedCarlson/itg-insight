// path: apps/web/src/features/role-director/components/executive/DirectorExecutiveWorkforceCard.tsx

import { ExhibitLauncher } from "@/shared/surfaces/reports/ExhibitLauncher";
import { OnboardingReportLauncher } from "@/shared/surfaces/reports/OnboardingReportLauncher";
import { RosterExportLauncher } from "@/shared/surfaces/reports/RosterExportLauncher";
import { WorkforceReportLauncher } from "@/shared/surfaces/reports/WorkforceReportLauncher";
import type {
  ExecutiveArtifactCard,
  ExecutiveDimensionArtifact,
} from "@/shared/types/executive/executiveSuite";

import {
  ArtifactHeader,
  DimensionCard,
  StandardArtifact,
} from "./DirectorExecutiveArtifactChrome";
import type { ExecutiveWorkforceCardProps } from "./executiveSurfaceTypes";

type StaffingTotals = {
  hc: number;
  local: number;
  travel: number;
  onboarding: number;
  training: number;
};

function metricNumber(value: unknown) {
  const next = Number(value ?? 0);
  return Number.isFinite(next) ? next : 0;
}

function sectionCards(
  artifact: ExecutiveDimensionArtifact,
  section: string
): ExecutiveArtifactCard[] {
  return artifact.cards.filter((card) => card.meta?.section === section);
}

function sumStaffing(cards: ExecutiveArtifactCard[]): StaffingTotals {
  return cards.reduce(
    (total, card) => ({
      hc: total.hc + metricNumber(card.meta?.hc ?? card.value),
      local: total.local + metricNumber(card.meta?.local),
      travel: total.travel + metricNumber(card.meta?.travel),
      onboarding: total.onboarding + metricNumber(card.meta?.onboarding),
      training: total.training + metricNumber(card.meta?.training),
    }),
    {
      hc: 0,
      local: 0,
      travel: 0,
      onboarding: 0,
      training: 0,
    }
  );
}

function TotalStrip({ cards }: { cards: ExecutiveArtifactCard[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--to-border)]">
      {cards.map((card) => {
        const local = card.meta?.local;
        const travel = card.meta?.travel;

        const helper =
          local !== undefined || travel !== undefined
            ? `${String(local ?? 0)} local • ${String(travel ?? 0)} travel${card.helper ? ` | ${card.helper}` : ""
            }`
            : card.helper ?? "";

        return (
          <div
            key={card.key}
            className="grid grid-cols-[1fr_72px_1.5fr] border-t border-[var(--to-border)] px-3 py-2 text-xs first:border-t-0"
          >
            <div className="font-medium uppercase tracking-wide text-[var(--to-ink-muted)]">
              {card.label}
            </div>

            <div className="text-center text-base font-semibold tabular-nums">
              {card.value}
            </div>

            <div className="text-right text-[11px] text-[var(--to-ink-muted)]">
              {helper}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WorkforceRowGrid({ cards }: { cards: ExecutiveArtifactCard[] }) {
  if (!cards.length) {
    return (
      <div className="rounded-xl bg-[var(--to-surface-soft)] p-3 text-xs text-[var(--to-ink-muted)]">
        No rows returned yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--to-border)]">
      <table className="w-full table-fixed border-collapse text-xs">
        <colgroup>
          <col style={{ width: "48%" }} />
          <col style={{ width: "14%" }} />
          <col style={{ width: "19%" }} />
          <col style={{ width: "19%" }} />
        </colgroup>

        <thead>
          <tr className="border-b border-[var(--to-border)] bg-[var(--to-surface-soft)]">
            <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-[var(--to-ink-muted)]">
              Office
            </th>
            <th className="px-2 py-2 text-center text-[11px] font-medium uppercase tracking-wide text-[var(--to-ink-muted)]">
              HC
            </th>
            <th className="bg-[color-mix(in_oklab,var(--to-accent)_6%,var(--to-surface-soft))] px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-[var(--to-ink-muted)]">
              Local
            </th>
            <th className="px-2 py-2 text-center text-[11px] font-medium uppercase tracking-wide text-[var(--to-ink-muted)]">
              Travel
            </th>
          </tr>
        </thead>

        <tbody>
          {cards.map((card) => (
            <tr key={card.key} className="border-b border-[var(--to-border)]">
              <td className="px-3 py-2 font-medium">{card.label}</td>
              <td className="px-2 py-2 text-center tabular-nums">
                {String(card.meta?.hc ?? card.value)}
              </td>
              <td className="bg-[color-mix(in_oklab,var(--to-accent)_4%,transparent)] px-2 py-2 text-center tabular-nums">
                {String(card.meta?.local ?? 0)}
              </td>
              <td className="px-2 py-2 text-center tabular-nums">
                {String(card.meta?.travel ?? 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WorkforceCompositionArtifact({
  artifact,
}: {
  artifact: ExecutiveDimensionArtifact;
}) {
  const totalCards = sectionCards(artifact, "total_strip").filter(
    (card) => card.key !== "all_in_hc"
  );

  const staffingCards = sectionCards(artifact, "staffing_summary");
  const bpCards = sectionCards(artifact, "bp_breakout");
  const officeCards = sectionCards(artifact, "office_grid");

  const staffingRows = [...staffingCards, ...bpCards];
  const totals = sumStaffing(staffingRows);

  return (
    <div className="rounded-2xl border border-[var(--to-border)] p-3">
      <ArtifactHeader artifact={artifact} />

      <div className="mt-4 space-y-4">
        <section className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--to-ink-muted)]">
            Headcount Mix
          </div>

          <TotalStrip cards={totalCards} />
        </section>

        <section className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--to-ink-muted)]">
            Staffing Pipeline
          </div>

          <div className="overflow-hidden rounded-xl border border-[var(--to-border)]">
            <table className="w-full table-fixed border-collapse text-xs">
              <colgroup>
                <col style={{ width: "40%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "15%" }} />
                <col style={{ width: "12%" }} />
              </colgroup>

              <thead>
                <tr className="border-b border-[var(--to-border)] bg-[var(--to-surface-soft)]">
                  <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-[var(--to-ink-muted)]">
                    Group
                  </th>
                  <th className="px-2 py-2 text-center text-[11px] font-medium uppercase tracking-wide text-[var(--to-ink-muted)]">
                    HC
                  </th>
                  <th className="bg-[color-mix(in_oklab,var(--to-accent)_6%,var(--to-surface-soft))] px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-[var(--to-ink-muted)]">
                    Local
                  </th>
                  <th className="px-2 py-2 text-center text-[11px] font-medium uppercase tracking-wide text-[var(--to-ink-muted)]">
                    Travel
                  </th>
                  <th className="px-2 py-2 text-center text-[11px] font-medium uppercase tracking-wide text-[var(--to-ink-muted)]">
                    Onboarding
                  </th>
                  <th className="px-2 py-2 text-center text-[11px] font-medium uppercase tracking-wide text-[var(--to-ink-muted)]">
                    Training
                  </th>
                </tr>
              </thead>

              <tbody>
                {staffingRows.map((card) => (
                  <tr
                    key={card.key}
                    className="border-b border-[var(--to-border)]"
                  >
                    <td className="px-3 py-2 font-medium">{card.label}</td>
                    <td className="px-2 py-2 text-center tabular-nums">
                      {String(card.meta?.hc ?? card.value)}
                    </td>
                    <td className="bg-[color-mix(in_oklab,var(--to-accent)_4%,transparent)] px-2 py-2 text-center tabular-nums">
                      {String(card.meta?.local ?? 0)}
                    </td>
                    <td className="px-2 py-2 text-center tabular-nums">
                      {String(card.meta?.travel ?? 0)}
                    </td>
                    <td className="px-2 py-2 text-center tabular-nums">
                      {String(card.meta?.onboarding ?? 0)}
                    </td>
                    <td className="px-2 py-2 text-center tabular-nums">
                      {String(card.meta?.training ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot>
                <tr className="bg-[var(--to-surface-soft)] font-semibold">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-2 py-2 text-center tabular-nums">
                    {totals.hc}
                  </td>
                  <td className="bg-[color-mix(in_oklab,var(--to-accent)_8%,var(--to-surface-soft))] px-2 py-2 text-center tabular-nums">
                    {totals.local}
                  </td>
                  <td className="bg-[var(--to-surface-soft)] px-2 py-2 text-center tabular-nums">
                    {totals.travel}
                  </td>
                  <td className="px-2 py-2 text-center tabular-nums">
                    {totals.onboarding}
                  </td>
                  <td className="px-2 py-2 text-center tabular-nums">
                    {totals.training}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <section className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--to-ink-muted)]">
            Office Mix
          </div>

          <WorkforceRowGrid cards={officeCards} />
        </section>
      </div>
    </div>
  );
}

function WorkforceReportsArtifact({
  artifact,
  workforceReports,
}: {
  artifact: ExecutiveDimensionArtifact;
  workforceReports?: ExecutiveWorkforceCardProps["workforceReports"];
}) {
  return (
    <div className="rounded-2xl border border-[var(--to-border)] p-3">
      <ArtifactHeader artifact={artifact} />

      {workforceReports ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <ExhibitLauncher
            rows={workforceReports.rows}
            affiliations={workforceReports.affiliations}
            regionLabel={workforceReports.regionLabel}
            reportMonthLabel={workforceReports.reportMonthLabel}
          />

          <WorkforceReportLauncher
            rows={workforceReports.rows}
            regionLabel={workforceReports.regionLabel}
            reportMonthLabel={workforceReports.reportMonthLabel}
          />

          <OnboardingReportLauncher
            regionLabel={workforceReports.regionLabel}
            reportMonthLabel={workforceReports.reportMonthLabel}
            scopedAffiliations={workforceReports.scopedAffiliations}
          />

          <RosterExportLauncher
            rows={workforceReports.rows}
            regionLabel={workforceReports.regionLabel}
            reportMonthLabel={workforceReports.reportMonthLabel}
          />
        </div>
      ) : null}
    </div>
  );
}

function WorkforceArtifactRenderer({
  artifact,
  workforceReports,
}: {
  artifact: ExecutiveDimensionArtifact;
  workforceReports?: ExecutiveWorkforceCardProps["workforceReports"];
}) {
  if (artifact.key === "workforce_composition") {
    return <WorkforceCompositionArtifact artifact={artifact} />;
  }

  if (artifact.key === "workforce_reports") {
    return (
      <WorkforceReportsArtifact
        artifact={artifact}
        workforceReports={workforceReports}
      />
    );
  }

  return <StandardArtifact artifact={artifact} />;
}

export function DirectorExecutiveWorkforceCard({
  dimension,
  workforceReports,
}: ExecutiveWorkforceCardProps) {
  return (
    <DimensionCard dimension={dimension}>
      {dimension.artifacts.map((artifact) => (
        <WorkforceArtifactRenderer
          key={artifact.key}
          artifact={artifact}
          workforceReports={workforceReports}
        />
      ))}
    </DimensionCard>
  );
}
// path: apps/web/src/features/role-director/components/DirectorExecutiveSuiteClient.tsx

import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ExhibitLauncher } from "@/shared/surfaces/reports/ExhibitLauncher";
import { OnboardingReportLauncher } from "@/shared/surfaces/reports/OnboardingReportLauncher";
import { WorkforceReportLauncher } from "@/shared/surfaces/reports/WorkforceReportLauncher";
import type {
  ExecutiveArtifactCard,
  ExecutiveArtifactStatus,
  ExecutiveDimensionArtifact,
  ExecutiveSuitePayload,
} from "@/shared/types/executive/executiveSuite";
import type { WorkforceAffiliationOption } from "@/shared/types/workforce/surfacePayload";
import type { WorkforceRow } from "@/shared/types/workforce/workforce.types";

type DirectorDimensionKey = "overview" | "workforce" | "metrics" | "route-lock";

type WorkforceReportsPayload = {
  rows: WorkforceRow[];
  affiliations: WorkforceAffiliationOption[];
  scopedAffiliations: string[];
  regionLabel: string;
  reportMonthLabel: string;
};

function statusVariant(
  status: ExecutiveArtifactStatus
): "neutral" | "success" | "warning" | "danger" | "info" {
  if (status === "ready") return "success";
  if (status === "degraded") return "warning";
  if (status === "empty") return "neutral";

  return "info";
}

function statusLabel(status: ExecutiveArtifactStatus) {
  if (status === "not_wired") return "not wired";

  return status;
}

function dimensionMatchesActive(dimension: string, active: DirectorDimensionKey) {
  if (active === "overview") return true;
  if (active === "workforce") return dimension === "workforce";
  if (active === "metrics") return dimension === "metrics";

  if (active === "route-lock") {
    return (
      dimension === "routeLock" ||
      dimension === "route-lock" ||
      dimension === "route_lock"
    );
  }

  return true;
}

function sectionCards(
  artifact: ExecutiveDimensionArtifact,
  section: string
): ExecutiveArtifactCard[] {
  return artifact.cards.filter((card) => card.meta?.section === section);
}

function ArtifactHeader({ artifact }: { artifact: ExecutiveDimensionArtifact }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div>
        <div className="text-sm font-medium">{artifact.title}</div>
        <div className="mt-1 text-xs text-[var(--to-ink-muted)]">
          {artifact.description}
        </div>
      </div>
      <Badge variant={statusVariant(artifact.status)}>
        {statusLabel(artifact.status)}
      </Badge>
    </div>
  );
}

function TotalStrip({ cards }: { cards: ExecutiveArtifactCard[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--to-border)]">
      <div className="grid grid-cols-3 bg-[var(--to-surface-soft)] px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-[var(--to-ink-muted)]">
        {cards.map((card) => (
          <div key={card.key}>{card.label}</div>
        ))}
      </div>

      <div className="grid grid-cols-3 border-t border-[var(--to-border)] px-3 py-3 text-xs">
        {cards.map((card) => (
          <div key={card.key}>
            <div className="text-lg font-semibold tabular-nums">
              {card.value}
            </div>
            {card.helper ? (
              <div className="mt-0.5 text-[11px] text-[var(--to-ink-muted)]">
                {card.helper}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function WorkforceRowGrid({
  cards,
  showOnboarding,
}: {
  cards: ExecutiveArtifactCard[];
  showOnboarding?: boolean;
}) {
  if (!cards.length) {
    return (
      <div className="rounded-xl bg-[var(--to-surface-soft)] p-3 text-xs text-[var(--to-ink-muted)]">
        No rows returned yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--to-border)]">
      <div
        className={
          showOnboarding
            ? "grid grid-cols-[1fr_64px_96px_80px] bg-[var(--to-surface-soft)] px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-[var(--to-ink-muted)]"
            : "grid grid-cols-[1fr_72px] bg-[var(--to-surface-soft)] px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-[var(--to-ink-muted)]"
        }
      >
        <div>{showOnboarding ? "BP Name" : "Office"}</div>
        <div className="text-right">HC</div>
        {showOnboarding ? <div className="text-right">Onboarding</div> : null}
        {showOnboarding ? <div className="text-right">Training</div> : null}
      </div>

      {cards.map((card) => (
        <div
          key={card.key}
          className={
            showOnboarding
              ? "grid grid-cols-[1fr_64px_96px_80px] border-t border-[var(--to-border)] px-3 py-2 text-xs"
              : "grid grid-cols-[1fr_72px] border-t border-[var(--to-border)] px-3 py-2 text-xs"
          }
        >
          <div className="font-medium">{card.label}</div>
          <div className="text-right tabular-nums">
            {String(card.meta?.hc ?? card.value)}
          </div>
          {showOnboarding ? (
            <div className="text-right tabular-nums">
              {String(card.meta?.onboarding ?? 0)}
            </div>
          ) : null}
          {showOnboarding ? (
            <div className="text-right tabular-nums">
              {String(card.meta?.training ?? 0)}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function StaffingRow({ card }: { card: ExecutiveArtifactCard }) {
  return (
    <div className="grid grid-cols-[1fr_72px_96px_80px] border-t border-[var(--to-border)] px-3 py-2 text-xs">
      <div className="font-medium">{card.label}</div>
      <div className="text-right tabular-nums">
        {String(card.meta?.hc ?? card.value)}
      </div>
      <div className="text-right tabular-nums">
        {String(card.meta?.onboarding ?? 0)}
      </div>
      <div className="text-right tabular-nums">
        {String(card.meta?.training ?? 0)}
      </div>
    </div>
  );
}

function WorkforceCompositionArtifact({
  artifact,
}: {
  artifact: ExecutiveDimensionArtifact;
}) {
  const totalCards = sectionCards(artifact, "total_strip");
  const staffingCards = sectionCards(artifact, "staffing_summary");
  const bpCards = sectionCards(artifact, "bp_breakout");
  const officeCards = sectionCards(artifact, "office_grid");

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
            <div className="grid grid-cols-[1fr_72px_96px_80px] bg-[var(--to-surface-soft)] px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-[var(--to-ink-muted)]">
              <div>Group</div>
              <div className="text-right">HC</div>
              <div className="text-right">Onboarding</div>
              <div className="text-right">Training</div>
            </div>

            {staffingCards.map((card) => (
              <StaffingRow key={card.key} card={card} />
            ))}

            {bpCards.map((card, index) => (
              <div
                key={card.key}
                className={[
                  "border-t",
                  index === 0
                    ? "border-t-2 border-[var(--to-border)]"
                    : "border-[var(--to-border)]",
                ].join(" ")}
              >
                <StaffingRow card={card} />
              </div>
            ))}
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
  workforceReports?: WorkforceReportsPayload;
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

          <button
            type="button"
            disabled
            className="rounded-xl bg-[var(--to-surface-soft)] p-3 text-left text-sm font-semibold opacity-80"
          >
            Org Chart
          </button>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {artifact.cards.map((card) => (
            <Link
              key={card.key}
              href="/director/executive?dimension=workforce"
              className="rounded-xl bg-[var(--to-surface-soft)] p-3 text-sm font-semibold hover:bg-muted/20"
            >
              {card.value}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function RouteLockSevenDayArtifact(props: {
  artifact: ExecutiveDimensionArtifact;
}) {
  const { artifact } = props;

  function lockTone(lockStatus: string) {
    if (lockStatus === "MET" || lockStatus === "MEETS") {
      return "text-[rgba(16,185,129,0.95)]";
    }

    if (lockStatus === "MISSED" || lockStatus === "MISSES") {
      return "text-[rgba(239,68,68,0.95)]";
    }

    return "text-[var(--to-ink-muted)]";
  }

  function eligibleTone(meta: ExecutiveArtifactCard["meta"]) {
    const eligible = Number(meta?.eligible ?? NaN);
    const quota = Number(meta?.quota ?? NaN);

    if (!Number.isFinite(eligible) || !Number.isFinite(quota)) {
      return "text-[var(--to-ink-muted)]";
    }

    if (eligible >= quota) return "text-[rgba(16,185,129,0.95)]";
    if (quota > 0 && eligible >= quota * 0.9) return "text-[rgba(245,158,11,0.95)]";

    return "text-[rgba(239,68,68,0.95)]";
  }

  return (
    <div className="rounded-2xl border border-[var(--to-border)] p-3">
      <ArtifactHeader artifact={artifact} />

      {artifact.cards.length ? (
        <div className="mt-3 overflow-hidden rounded-xl border border-[var(--to-border)]">
          <div className="grid grid-cols-[1.1fr_0.75fr_0.8fr_0.8fr_0.8fr] bg-[var(--to-surface-soft)] px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-[var(--to-ink-muted)]">
            <div>Date</div>
            <div>Phase</div>
            <div className="text-right">Quota</div>
            <div className="text-right">Eligible</div>
            <div className="text-right">Lock</div>
          </div>

          {artifact.cards.map((card) => {
            const lockStatus = String(card.meta?.lock_status ?? "—");
            const quota =
              card.meta?.quota === null || card.meta?.quota === undefined
                ? "—"
                : String(card.meta.quota);
            const eligible =
              card.meta?.eligible === null || card.meta?.eligible === undefined
                ? "—"
                : String(card.meta.eligible);
            const phase = String(card.meta?.phase ?? "—");
            const isToday = card.meta?.is_today === true;

            return (
              <div
                key={card.key}
                className={[
                  "grid grid-cols-[1.1fr_0.75fr_0.8fr_0.8fr_0.8fr] border-t border-[var(--to-border)] px-3 py-2 text-xs tabular-nums",
                  isToday ? "bg-[rgba(37,99,235,0.06)]" : "",
                ].join(" ")}
              >
                <div className="font-medium">
                  {card.label}
                  {isToday ? (
                    <span className="ml-2 rounded-full border px-1.5 py-0.5 text-[10px] text-[var(--to-ink-muted)]">
                      Today
                    </span>
                  ) : null}
                </div>
                <div className="text-[var(--to-ink-muted)]">{phase}</div>
                <div className="text-right">{quota}</div>
                <div className={`text-right font-semibold ${eligibleTone(card.meta)}`}>
                  {eligible}
                </div>
                <div className={`text-right font-semibold ${lockTone(lockStatus)}`}>
                  {lockStatus}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-3 text-xs text-[var(--to-ink-muted)]">
          No cards returned yet.
        </div>
      )}
    </div>
  );
}

function StandardArtifact(props: {
  artifact: ExecutiveDimensionArtifact;
  dimension: string;
}) {
  const { artifact } = props;

  return (
    <div className="rounded-2xl border border-[var(--to-border)] p-3">
      <ArtifactHeader artifact={artifact} />

      {artifact.cards.length ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {artifact.cards.map((card) => (
            <div
              key={card.key}
              className="rounded-xl bg-[var(--to-surface-soft)] p-2"
            >
              <div className="text-[11px] uppercase tracking-wide text-[var(--to-ink-muted)]">
                {card.label}
              </div>
              <div className="mt-1 text-lg font-semibold">{card.value}</div>
              {card.helper ? (
                <div className="text-[11px] text-[var(--to-ink-muted)]">
                  {card.helper}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 text-xs text-[var(--to-ink-muted)]">
          No cards returned yet.
        </div>
      )}
    </div>
  );
}

function ExecutiveArtifactRenderer({
  artifact,
  dimension,
  workforceReports,
}: {
  artifact: ExecutiveDimensionArtifact;
  dimension: string;
  workforceReports?: WorkforceReportsPayload;
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

  if (artifact.key === "route_lock_7_day") {
    return <RouteLockSevenDayArtifact artifact={artifact} />;
  }

  return <StandardArtifact artifact={artifact} dimension={dimension} />;
}

export default function DirectorExecutiveSuiteClient({
  payload,
  activeDimension,
  workforceReports,
}: {
  payload: ExecutiveSuitePayload;
  activeDimension: DirectorDimensionKey;
  workforceReports?: WorkforceReportsPayload;
}) {
  const visibleDimensions = payload.dimensions.filter((dimension) =>
    dimensionMatchesActive(dimension.dimension, activeDimension)
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        {visibleDimensions.map((dimension) => (
          <Card key={dimension.dimension} className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">{dimension.title}</h2>
                <p className="text-xs text-[var(--to-ink-muted)]">
                  {dimension.artifacts.length} artifact pipeline
                  {dimension.artifacts.length === 1 ? "" : "s"}
                </p>
              </div>
              <Badge variant={statusVariant(dimension.status)}>
                {statusLabel(dimension.status)}
              </Badge>
            </div>

            <div className="space-y-3">
              {dimension.artifacts.map((artifact) => (
                <ExecutiveArtifactRenderer
                  key={artifact.key}
                  artifact={artifact}
                  dimension={dimension.dimension}
                  workforceReports={workforceReports}
                />
              ))}
            </div>

            {dimension.notes?.length ? (
              <div className="rounded-xl bg-[var(--to-surface-soft)] p-2 text-xs text-[var(--to-ink-muted)]">
                {dimension.notes.join(" • ")}
              </div>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
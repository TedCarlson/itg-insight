// path: apps/web/src/features/role-director/components/DirectorExecutiveSuiteClient.tsx

import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type {
  ExecutiveArtifactCard,
  ExecutiveArtifactStatus,
  ExecutiveDimensionArtifact,
  ExecutiveSuitePayload,
} from "@/shared/types/executive/executiveSuite";

type DirectorDimensionKey = "overview" | "workforce" | "metrics" | "route-lock";

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

function dimensionHref(dimension: string) {
  if (dimension === "workforce") return "/director/executive?dimension=workforce";
  if (dimension === "metrics") return "/director/executive?dimension=metrics";
  if (dimension === "routeLock" || dimension === "route-lock" || dimension === "route_lock") {
    return "/director/executive?dimension=route-lock";
  }

  return "/director/executive";
}

function dimensionMatchesActive(dimension: string, active: DirectorDimensionKey) {
  if (active === "overview") return true;
  if (active === "workforce") return dimension === "workforce";
  if (active === "metrics") return dimension === "metrics";
  if (active === "route-lock") {
    return dimension === "routeLock" || dimension === "route-lock" || dimension === "route_lock";
  }

  return true;
}

function activeTitle(active: DirectorDimensionKey) {
  if (active === "workforce") return "Workforce Source Surface";
  if (active === "metrics") return "Metrics Source Surface";
  if (active === "route-lock") return "Route-Lock Source Surface";
  return "Executive Snapshot";
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
    <div className="grid gap-2 md:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.key}
          className="rounded-xl bg-[var(--to-surface-soft)] p-3"
        >
          <div className="text-[11px] uppercase tracking-wide text-[var(--to-ink-muted)]">
            {card.label}
          </div>
          <div className="mt-1 text-xl font-semibold">{card.value}</div>
          {card.helper ? (
            <div className="text-[11px] text-[var(--to-ink-muted)]">
              {card.helper}
            </div>
          ) : null}
        </div>
      ))}
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
            Section 1 · Headcount Mix
          </div>
          <TotalStrip cards={totalCards} />
        </section>

        <section className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--to-ink-muted)]">
            Section 2 · Staffing Pipeline
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            {staffingCards.map((card) => (
              <div
                key={card.key}
                className="rounded-xl bg-[var(--to-surface-soft)] p-3"
              >
                <div className="text-[11px] uppercase tracking-wide text-[var(--to-ink-muted)]">
                  {card.label}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <div className="text-[var(--to-ink-muted)]">HC</div>
                    <div className="text-lg font-semibold">{card.value}</div>
                  </div>
                  <div>
                    <div className="text-[var(--to-ink-muted)]">Onboarding</div>
                    <div className="text-lg font-semibold">
                      {String(card.meta?.onboarding ?? 0)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[var(--to-ink-muted)]">Training</div>
                    <div className="text-lg font-semibold">
                      {String(card.meta?.training ?? 0)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <WorkforceRowGrid cards={bpCards} showOnboarding />
        </section>

        <section className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--to-ink-muted)]">
            Section 3 · Office Mix
          </div>
          <WorkforceRowGrid cards={officeCards} />
        </section>
      </div>

      <Link
        href="/director/executive?dimension=workforce"
        className="mt-3 inline-flex text-xs font-medium text-[var(--to-accent)]"
      >
        Open source surface →
      </Link>
    </div>
  );
}

function WorkforceReportsArtifact({
  artifact,
}: {
  artifact: ExecutiveDimensionArtifact;
}) {
  return (
    <div className="rounded-2xl border border-[var(--to-border)] p-3">
      <ArtifactHeader artifact={artifact} />

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
    </div>
  );
}

function RouteLockSevenDayArtifact(props: {
  artifact: ExecutiveDimensionArtifact;
}) {
  const { artifact } = props;

  return (
    <div className="rounded-2xl border border-[var(--to-border)] p-3">
      <ArtifactHeader artifact={artifact} />

      {artifact.cards.length ? (
        <div className="mt-3 overflow-hidden rounded-xl border border-[var(--to-border)]">
          <div className="grid grid-cols-[1.2fr_0.8fr_0.9fr_0.8fr] bg-[var(--to-surface-soft)] px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-[var(--to-ink-muted)]">
            <div>Date</div>
            <div className="text-right">Quota</div>
            <div className="text-right">Run Rate</div>
            <div className="text-right">Lock</div>
          </div>

          {artifact.cards.map((card) => {
            const lockStatus = String(card.meta?.lock_status ?? "—");
            const runRate = String(card.meta?.run_rate_display ?? "—");
            const quota =
              card.meta?.quota === null || card.meta?.quota === undefined
                ? "—"
                : String(card.meta.quota);

            return (
              <div
                key={card.key}
                className="grid grid-cols-[1.2fr_0.8fr_0.9fr_0.8fr] border-t border-[var(--to-border)] px-3 py-2 text-xs tabular-nums"
              >
                <div className="font-medium">{card.label}</div>
                <div className="text-right">{quota}</div>
                <div className="text-right">{runRate}</div>
                <div className="text-right font-semibold">{lockStatus}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-3 text-xs text-[var(--to-ink-muted)]">
          No cards returned yet.
        </div>
      )}

      <Link
        href="/director/executive?dimension=route-lock"
        className="mt-3 inline-flex text-xs font-medium text-[var(--to-accent)]"
      >
        Open source surface →
      </Link>
    </div>
  );
}

function StandardArtifact(props: {
  artifact: ExecutiveDimensionArtifact;
  dimension: string;
}) {
  const { artifact, dimension } = props;

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

      <Link
        href={dimensionHref(dimension)}
        className="mt-3 inline-flex text-xs font-medium text-[var(--to-accent)]"
      >
        Open source surface →
      </Link>
    </div>
  );
}

function ExecutiveArtifactRenderer({
  artifact,
  dimension,
}: {
  artifact: ExecutiveDimensionArtifact;
  dimension: string;
}) {
  if (artifact.key === "workforce_composition") {
    return <WorkforceCompositionArtifact artifact={artifact} />;
  }

  if (artifact.key === "workforce_reports") {
    return <WorkforceReportsArtifact artifact={artifact} />;
  }

  if (artifact.key === "route_lock_7_day") {
    return <RouteLockSevenDayArtifact artifact={artifact} />;
  }

  return <StandardArtifact artifact={artifact} dimension={dimension} />;
}

export default function DirectorExecutiveSuiteClient({
  payload,
  activeDimension,
}: {
  payload: ExecutiveSuitePayload;
  activeDimension: DirectorDimensionKey;
}) {
  const visibleDimensions = payload.dimensions.filter((dimension) =>
    dimensionMatchesActive(dimension.dimension, activeDimension)
  );

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{activeTitle(activeDimension)}</h2>
            <p className="text-xs text-[var(--to-ink-muted)]">
              Director-owned landing surface. Source links stay inside the Executive Suite.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/director/executive"
              className="rounded-full border px-3 py-1 text-xs font-medium hover:bg-muted/20"
            >
              Overview
            </Link>
            <Link
              href="/director/executive?dimension=workforce"
              className="rounded-full border px-3 py-1 text-xs font-medium hover:bg-muted/20"
            >
              Workforce
            </Link>
            <Link
              href="/director/executive?dimension=metrics"
              className="rounded-full border px-3 py-1 text-xs font-medium hover:bg-muted/20"
            >
              Metrics
            </Link>
            <Link
              href="/director/executive?dimension=route-lock"
              className="rounded-full border px-3 py-1 text-xs font-medium hover:bg-muted/20"
            >
              Route-Lock
            </Link>
          </div>
        </div>
      </Card>

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
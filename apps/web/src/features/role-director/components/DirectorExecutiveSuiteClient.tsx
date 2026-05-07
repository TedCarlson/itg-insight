import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type {
  ExecutiveArtifactStatus,
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
  if (dimension === "routeLock" || dimension === "route-lock") {
    return "/director/executive?dimension=route-lock";
  }

  return "/director/executive";
}

function dimensionMatchesActive(dimension: string, active: DirectorDimensionKey) {
  if (active === "overview") return true;
  if (active === "workforce") return dimension === "workforce";
  if (active === "metrics") return dimension === "metrics";
  if (active === "route-lock") {
    return dimension === "routeLock" || dimension === "route-lock";
  }

  return true;
}

function activeTitle(active: DirectorDimensionKey) {
  if (active === "workforce") return "Workforce Source Surface";
  if (active === "metrics") return "Metrics Source Surface";
  if (active === "route-lock") return "Route-Lock Source Surface";
  return "Executive Snapshot";
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
                <div
                  key={artifact.key}
                  className="rounded-2xl border border-[var(--to-border)] p-3"
                >
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
                    href={dimensionHref(dimension.dimension)}
                    className="mt-3 inline-flex text-xs font-medium text-[var(--to-accent)]"
                  >
                    Open source surface →
                  </Link>
                </div>
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
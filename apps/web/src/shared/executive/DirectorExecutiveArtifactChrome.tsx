// path: apps/web/src/features/role-director/components/executive/DirectorExecutiveArtifactChrome.tsx

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type {
  ExecutiveArtifactStatus,
  ExecutiveDimensionArtifact,
  ExecutiveDimensionPayload,
} from "@/shared/types/executive/executiveSuite";

export function statusVariant(
  status: ExecutiveArtifactStatus
): "neutral" | "success" | "warning" | "danger" | "info" {
  if (status === "ready") return "success";
  if (status === "degraded") return "warning";
  if (status === "empty") return "neutral";

  return "info";
}

export function statusLabel(status: ExecutiveArtifactStatus) {
  if (status === "not_wired") return "not wired";

  return status;
}

export function DimensionCard({
  dimension,
  children,
}: {
  dimension: ExecutiveDimensionPayload;
  children: React.ReactNode;
}) {
  return (
    <Card className="space-y-3 p-4">
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

      <div className="space-y-3">{children}</div>

      {dimension.notes?.length ? (
        <div className="rounded-xl bg-[var(--to-surface-soft)] p-2 text-xs text-[var(--to-ink-muted)]">
          {dimension.notes.join(" • ")}
        </div>
      ) : null}
    </Card>
  );
}

export function ArtifactHeader({
  artifact,
}: {
  artifact: ExecutiveDimensionArtifact;
}) {
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

export function StandardArtifact({
  artifact,
}: {
  artifact: ExecutiveDimensionArtifact;
}) {
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
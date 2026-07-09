// path: apps/web/src/features/role-director/components/DirectorWorkspaceClient.tsx

import type {
  ExecutiveDimensionPayload,
  ExecutiveSuitePayload,
} from "@/shared/types/executive/executiveSuite";

import {
  DimensionCard,
  StandardArtifact,
} from "@/shared/executive/DirectorExecutiveArtifactChrome";
import { DirectorExecutiveMetricsCard } from "@/shared/executive/DirectorExecutiveMetricsCard";
import { DirectorExecutiveRouteLockCard } from "@/shared/executive/DirectorExecutiveRouteLockCard";
import { DirectorExecutiveWorkforceCard } from "@/shared/executive/DirectorExecutiveWorkforceCard";
import type {
  DirectorDimensionKey,
  WorkforceReportsPayload,
} from "@/shared/executive/executiveSurfaceTypes";

function dimensionMatchesActive(
  dimension: string,
  active: DirectorDimensionKey
) {
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

function isRouteLockDimension(dimension: string) {
  return (
    dimension === "routeLock" ||
    dimension === "route-lock" ||
    dimension === "route_lock"
  );
}

function FallbackDimensionCard({
  dimension,
}: {
  dimension: ExecutiveDimensionPayload;
}) {
  return (
    <DimensionCard dimension={dimension}>
      {dimension.artifacts.map((artifact) => (
        <StandardArtifact key={artifact.key} artifact={artifact} />
      ))}
    </DimensionCard>
  );
}

function DirectorDimensionRenderer({
  dimension,
  workforceReports,
}: {
  dimension: ExecutiveDimensionPayload;
  workforceReports?: WorkforceReportsPayload;
}) {
  if (dimension.dimension === "workforce") {
    return (
      <DirectorExecutiveWorkforceCard
        dimension={dimension}
        workforceReports={workforceReports}
      />
    );
  }

  if (dimension.dimension === "metrics") {
    return <DirectorExecutiveMetricsCard dimension={dimension} />;
  }

  if (isRouteLockDimension(dimension.dimension)) {
    return <DirectorExecutiveRouteLockCard dimension={dimension} />;
  }

  return <FallbackDimensionCard dimension={dimension} />;
}

export default function DirectorWorkspaceClient({
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
          <DirectorDimensionRenderer
            key={dimension.dimension}
            dimension={dimension}
            workforceReports={workforceReports}
          />
        ))}
      </div>
    </div>
  );
}
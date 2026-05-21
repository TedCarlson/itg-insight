// path: apps/web/src/shared/executive/DirectorExecutiveMetricsCard.tsx

import { DimensionCard, StandardArtifact } from "./DirectorExecutiveArtifactChrome";
import type { ExecutiveDimensionCardProps } from "./executiveSurfaceTypes";

export function DirectorExecutiveMetricsCard({
  dimension,
}: ExecutiveDimensionCardProps) {
  return (
    <DimensionCard dimension={dimension}>
      {dimension.artifacts.map((artifact) => (
        <StandardArtifact key={artifact.key} artifact={artifact} />
      ))}
    </DimensionCard>
  );
}
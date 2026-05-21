// path: apps/web/src/shared/executive/DirectorExecutiveRouteLockCard.tsx

import { DimensionCard, StandardArtifact } from "./DirectorExecutiveArtifactChrome";
import type { ExecutiveDimensionCardProps } from "./executiveSurfaceTypes";

export function DirectorExecutiveRouteLockCard({
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
// path: src/shared/hooks/metrics/useMetricsKpiSelection.ts

"use client";

import { useState } from "react";

type KpiSelection = {
  kpiKey: string | null;
  setKpiKey: (key: string) => void;
};

export function useMetricsKpiSelection(): KpiSelection {
  const [kpiKey, setKpiKey] = useState<string | null>(null);
  return { kpiKey, setKpiKey };
}
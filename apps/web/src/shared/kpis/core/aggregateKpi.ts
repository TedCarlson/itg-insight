export function aggregateKpiAcrossTechs(values: (number | null)[]) {
  let sum = 0;
  let count = 0;

  for (const v of values) {
    if (v == null || !Number.isFinite(v)) continue;
    sum += v;
    count += 1;
  }

  return count > 0 ? sum / count : null;
}
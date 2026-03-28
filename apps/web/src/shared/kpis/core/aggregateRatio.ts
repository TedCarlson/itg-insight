type Args<TRow> = {
  rows: TRow[];
  getNumerator: (row: TRow) => number | null | undefined;
  getDenominator: (row: TRow) => number | null | undefined;
};

export function aggregateRatio<TRow>(args: Args<TRow>) {
  let numerator = 0;
  let denominator = 0;

  for (const row of args.rows) {
    numerator += args.getNumerator(row) ?? 0;
    denominator += args.getDenominator(row) ?? 0;
  }

  const value = denominator > 0 ? (100 * numerator) / denominator : null;

  return {
    value,
    numerator,
    denominator,
  };
}
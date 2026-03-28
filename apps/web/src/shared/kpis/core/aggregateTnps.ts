type TnpsRow = {
  tnps_surveys: number | null;
  tnps_promoters: number | null;
  tnps_detractors: number | null;
};

export function aggregateTnps(rows: TnpsRow[]) {
  let tnps_surveys = 0;
  let tnps_promoters = 0;
  let tnps_detractors = 0;

  for (const row of rows) {
    tnps_surveys += row.tnps_surveys ?? 0;
    tnps_promoters += row.tnps_promoters ?? 0;
    tnps_detractors += row.tnps_detractors ?? 0;
  }

  const tnps_score =
    tnps_surveys > 0
      ? (100 * (tnps_promoters - tnps_detractors)) / tnps_surveys
      : null;

  return {
    tnps_score,
    tnps_surveys,
    tnps_promoters,
    tnps_detractors,
  };
}
import type { WorkforceRow } from "./workforceTypes";

export type WorkMixSummary = {
  total: number;
  installs: number;
  tcs: number;
  sros: number;
  install_pct: number | null;
  tc_pct: number | null;
  sro_pct: number | null;
};

function pct(part: number, total: number): number | null {
  return total > 0 ? (100 * part) / total : null;
}

export function buildWorkMixSummary(rows: WorkforceRow[]): WorkMixSummary {
  let installs = 0;
  let tcs = 0;
  let sros = 0;

  for (const row of rows) {
    installs += row.work_mix.installs ?? 0;
    tcs += row.work_mix.tcs ?? 0;
    sros += row.work_mix.sros ?? 0;
  }

  const total = installs + tcs + sros;

  return {
    total,
    installs,
    tcs,
    sros,
    install_pct: pct(installs, total),
    tc_pct: pct(tcs, total),
    sro_pct: pct(sros, total),
  };
}
// RUN THIS
// Replace the entire file:
// apps/web/src/features/metrics-admin/components/MetricsConsoleGrid.tsx

"use client";

import React, { useEffect, useMemo, useState } from "react";
import MetricsColorsDrawer from "@/features/metrics-admin/components/MetricsColorsDrawer";

type AnyRow = Record<string, any>;
type ClassType = "P4P" | "SMART" | "TECH";

type InitialPayload = {
  kpiDefs: AnyRow[];
  classConfig: AnyRow[];
  rubricRows: AnyRow[]; // ✅ GLOBAL by KPI: (kpi_key, band_key, min/max/score, ...)
};

const CLASS_TABS: ClassType[] = ["P4P", "SMART", "TECH"];

// Update if your DB uses different band keys.
const BAND_KEYS = ["EXCEEDS", "MEETS", "NEEDS_IMPROVEMENT", "MISSES", "NO_DATA"] as const;
type BandKey = (typeof BAND_KEYS)[number];

function asText(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function asBool(v: unknown): boolean {
  return v === true || v === "true" || v === 1 || v === "1";
}

function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v));
  return Number.isFinite(n) ? n : null;
}

function firstExistingKey(row: AnyRow | null | undefined, keys: string[]): string | null {
  if (!row) return null;
  for (const k of keys) if (k in row) return k;
  return null;
}

function kpiKeyFromDef(d: AnyRow): string {
  return asText(d?.kpi_key || d?.kpiKey || d?.key).trim();
}

function kpiGlobalLabel(def: AnyRow | null | undefined, kpiKey: string): string {
  const label =
    asText(def?.customer_label) ||
    asText(def?.label) ||
    asText(def?.kpi_label) ||
    asText(def?.display_label) ||
    asText(def?.name) ||
    "";
  return label || kpiKey;
}

function rubricIssueSummary(rows: AnyRow[]): { level: "ok" | "warn"; text: string } {
  if (!rows || rows.length === 0) return { level: "warn", text: "No rubric" };

  const byBand = new Map<string, AnyRow>();
  for (const r of rows) byBand.set(asText(r.band_key).toUpperCase(), r);

  const missing: string[] = [];
  for (const b of BAND_KEYS) if (!byBand.has(b)) missing.push(b);

  let emptyBands = 0;
  for (const b of BAND_KEYS) {
    const r = byBand.get(b);
    if (!r) continue;

    const min = toNumberOrNull(r.min_value);
    const max = toNumberOrNull(r.max_value);
    const score = toNumberOrNull(r.score_value);
    const isNoData = b === "NO_DATA";

    const empty = isNoData ? score === null : min === null && max === null && score === null;
    if (empty) emptyBands += 1;
  }

  if (missing.length === 0 && emptyBands === 0) return { level: "ok", text: "Complete" };

  const parts: string[] = [];
  if (missing.length) parts.push(`Missing: ${missing.length}`);
  if (emptyBands) parts.push(`Empty: ${emptyBands}`);
  return { level: "warn", text: parts.join(" • ") };
}

/**
 * ✅ GLOBAL (KPI-anchored) rubric normalization:
 * Ensure each KPI has all band rows present (kpi_key + band_key).
 */
function ensureGlobalRubricBands(allRubrics: AnyRow[], kpiKeys: string[]): AnyRow[] {
  const idx = new Map<string, AnyRow>();
  for (const r of allRubrics ?? []) {
    const kk = asText(r.kpi_key);
    const bk = asText(r.band_key).toUpperCase();
    if (!kk || !bk) continue;
    idx.set(`${kk}::${bk}`, r);
  }

  const out: AnyRow[] = [];

  for (const kpiKey of kpiKeys) {
    for (const band of BAND_KEYS) {
      const existing = idx.get(`${kpiKey}::${band}`) ?? null;
      if (existing) out.push(existing);
      else {
        out.push({
          kpi_key: kpiKey,
          band_key: band,
          min_value: null,
          max_value: null,
          score_value: null,
        });
      }
    }
  }

  // Keep any rubric rows for KPIs NOT in kpiKeys untouched
  for (const r of allRubrics ?? []) {
    const kk = asText(r.kpi_key);
    if (!kk) continue;
    if (kpiKeys.includes(kk)) continue;
    out.push(r);
  }

  return out;
}

export default function MetricsConsoleGrid({ initial }: { initial: InitialPayload }) {
  const [kpiDefs, setKpiDefs] = useState<AnyRow[]>(initial.kpiDefs ?? []);
  const [classConfig, setClassConfig] = useState<AnyRow[]>(initial.classConfig ?? []);
  const [rubricRows, setRubricRows] = useState<AnyRow[]>(initial.rubricRows ?? []);

  const [activeClass, setActiveClass] = useState<ClassType>("P4P");
  const [openRubricKey, setOpenRubricKey] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const [colorsDrawerOpen, setColorsDrawerOpen] = useState(false);

  useEffect(() => {
    setKpiDefs(initial.kpiDefs ?? []);
    setClassConfig(initial.classConfig ?? []);
    setRubricRows(initial.rubricRows ?? []);
  }, [initial.kpiDefs, initial.classConfig, initial.rubricRows]);

  const kpiDefsByKey = useMemo(() => {
    const m: Record<string, AnyRow> = {};
    for (const d of kpiDefs ?? []) {
      const key = kpiKeyFromDef(d);
      if (key) m[key] = d;
    }
    return m;
  }, [kpiDefs]);

  const allKpiKeys = useMemo(() => {
    return (kpiDefs ?? [])
      .map(kpiKeyFromDef)
      .filter((k) => !!k)
      .sort((a, b) => a.localeCompare(b));
  }, [kpiDefs]);

  // Detect config column names (we only edit columns that exist in DB rows)
  const cfgKeyHints = useMemo(() => {
    const sample = (classConfig ?? [])[0] ?? null;

    const showKey =
      firstExistingKey(sample, ["in_report", "show_in_report", "is_in_report"]) ??
      firstExistingKey(sample, ["is_enabled", "enabled", "is_active", "active"]);

    const weightKey = firstExistingKey(sample, ["weight", "weight_value", "weight_points", "weight_pct", "weight_percent"]);
    const orderKey = firstExistingKey(sample, ["display_order", "sort_order", "order_index", "ui_order"]);
    const thresholdKey = firstExistingKey(sample, [
      "threshold",
      "threshold_value",
      "target_threshold",
      "stretch_threshold",
    ]);
    const tieKey = firstExistingKey(sample, ["is_tiebreaker", "tie_breaker", "is_tie_breaker"]);

    // IMPORTANT: label is GLOBAL only; do NOT discover label override key.
    return { showKey, weightKey, orderKey, thresholdKey, tieKey };
  }, [classConfig]);

  const cfgByClassAndKpi = useMemo(() => {
    const map: Record<string, AnyRow> = {};
    for (const r of classConfig ?? []) {
      const ct = asText(r.class_type).toUpperCase();
      const kk = asText(r.kpi_key);
      if (!ct || !kk) continue;
      map[`${ct}::${kk}`] = r;
    }
    return map;
  }, [classConfig]);

  /**
   * ✅ GLOBAL rubric index: kpi_key -> band rows
   */
  const rubricByKpi = useMemo(() => {
    const map: Record<string, AnyRow[]> = {};
    for (const r of rubricRows ?? []) {
      const kk = asText(r.kpi_key);
      if (!kk) continue;
      if (!map[kk]) map[kk] = [];
      map[kk].push(r);
    }

    for (const k of Object.keys(map)) {
      map[k] = map[k].sort((a, b) => asText(a.band_key).localeCompare(asText(b.band_key)));
    }

    return map;
  }, [rubricRows]);

  const rowsForActive = useMemo(() => {
    const out = allKpiKeys.map((kpiKey) => {
      const cfg = cfgByClassAndKpi[`${activeClass}::${kpiKey}`] ?? null;
      return { kpiKey, cfg };
    });

    const { orderKey, weightKey } = cfgKeyHints;

    out.sort((a, b) => {
      const ac = a.cfg;
      const bc = b.cfg;

      if (orderKey) {
        const ao = ac ? (toNumberOrNull(ac[orderKey]) ?? 999999) : 999999;
        const bo = bc ? (toNumberOrNull(bc[orderKey]) ?? 999999) : 999999;
        if (ao !== bo) return ao - bo;
      }

      if (weightKey) {
        const aw = ac ? (toNumberOrNull(ac[weightKey]) ?? -999999) : -999999;
        const bw = bc ? (toNumberOrNull(bc[weightKey]) ?? -999999) : -999999;
        if (aw !== bw) return bw - aw;
      }

      return a.kpiKey.localeCompare(b.kpiKey);
    });

    return out;
  }, [allKpiKeys, cfgByClassAndKpi, activeClass, cfgKeyHints]);

  const dirtyCount = useMemo(() => {
    const a = initial.kpiDefs?.length ?? 0;
    const b = initial.classConfig?.length ?? 0;
    const c = initial.rubricRows?.length ?? 0;
    return Number(a !== kpiDefs.length) + Number(b !== classConfig.length) + Number(c !== rubricRows.length);
  }, [initial, kpiDefs.length, classConfig.length, rubricRows.length]);

  function upsertKpiDef(kpiKey: string, patch: Partial<AnyRow>) {
    setKpiDefs((prev) => {
      const idx = prev.findIndex((d) => kpiKeyFromDef(d) === kpiKey);
      if (idx < 0) return prev;

      const cur = prev[idx];
      const next = { ...cur, ...patch };
      const copy = [...prev];
      copy[idx] = next;
      return copy;
    });
  }

  function upsertClassCfg(kpiKey: string, patch: Partial<AnyRow>) {
    setClassConfig((prev) => {
      const idx = prev.findIndex(
        (r) => asText(r.class_type).toUpperCase() === activeClass && asText(r.kpi_key) === kpiKey
      );

      if (idx >= 0) {
        const cur = prev[idx];
        const next = { ...cur, ...patch };
        const copy = [...prev];
        copy[idx] = next;
        return copy;
      }

      const base: AnyRow = { class_type: activeClass, kpi_key: kpiKey };
      for (const k of Object.keys(patch)) base[k] = (patch as any)[k];
      return [...prev, base];
    });
  }

  function setTieBreakerForClass(kpiKey: string) {
    const tieKey = cfgKeyHints.tieKey;
    if (!tieKey) return;

    setClassConfig((prev) => {
      const next = prev.map((r) => {
        if (asText(r.class_type).toUpperCase() !== activeClass) return r;

        const rk = asText(r.kpi_key);
        if (!rk) return r;

        if (!(tieKey in r)) return r;

        return { ...r, [tieKey]: rk === kpiKey };
      });

      const hasSelected = next.some(
        (r) => asText(r.class_type).toUpperCase() === activeClass && asText(r.kpi_key) === kpiKey
      );

      if (!hasSelected) {
        next.push({ class_type: activeClass, kpi_key: kpiKey, [tieKey]: true });
      } else {
        for (let i = 0; i < next.length; i++) {
          const r = next[i];
          if (asText(r.class_type).toUpperCase() !== activeClass) continue;
          if (asText(r.kpi_key) !== kpiKey) continue;
          if (tieKey in r) break;
          next[i] = { ...r, [tieKey]: true };
          break;
        }
      }

      return next;
    });
  }

  function ensureRubricBandRowsForKpi(kpiKey: string) {
    setRubricRows((prev) => {
      const existing = new Set(
        (prev ?? []).map((r) => `${asText(r.kpi_key)}::${asText(r.band_key).toUpperCase()}`)
      );

      const additions: AnyRow[] = [];
      for (const band of BAND_KEYS) {
        const k = `${kpiKey}::${band}`;
        if (existing.has(k)) continue;
        additions.push({
          kpi_key: kpiKey,
          band_key: band,
          min_value: null,
          max_value: null,
          score_value: null,
        });
      }

      return additions.length ? [...prev, ...additions] : prev;
    });
  }

  function updateRubricCell(
    kpiKey: string,
    bandKey: BandKey,
    field: "min_value" | "max_value" | "score_value",
    value: number | null
  ) {
    setRubricRows((prev) =>
      prev.map((r) => {
        if (asText(r.kpi_key) !== kpiKey) return r;
        if (asText(r.band_key).toUpperCase() !== bandKey) return r;
        if (!(field in r)) return { ...r, [field]: value };
        return { ...r, [field]: value };
      })
    );
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
    setSavedAt(null);

    try {
      const normalizedRubrics = ensureGlobalRubricBands(rubricRows, allKpiKeys);

      const res = await fetch("/api/admin/metrics-config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kpiDefs, classConfig, rubricRows: normalizedRubrics }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error?.message || j?.error || `Save failed (${res.status})`);
      }

      const j = await res.json();
      setKpiDefs(j.kpiDefs ?? []);
      setClassConfig(j.classConfig ?? []);
      setRubricRows(j.rubricRows ?? normalizedRubrics);
      setSavedAt(new Date().toLocaleString());
    } catch (e: any) {
      setSaveError(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border bg-background p-1">
            {CLASS_TABS.map((ct) => (
              <button
                key={ct}
                className={[
                  "h-8 rounded px-3 text-sm font-medium",
                  activeClass === ct ? "bg-muted" : "hover:bg-muted/50",
                ].join(" ")}
                onClick={() => {
                  setActiveClass(ct);
                  setOpenRubricKey(null);
                }}
                type="button"
              >
                {ct}
              </button>
            ))}
          </div>

          <div className="text-sm text-muted-foreground">
            {dirtyCount > 0 ? "Edits pending (length change detected)" : "Ready"}
            {savedAt ? <span className="ml-2">• Saved {savedAt}</span> : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium hover:bg-muted"
            onClick={() => setColorsDrawerOpen(true)}
          >
            Band Presets
          </button>

          <button
            className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
            onClick={save}
            disabled={saving}
            type="button"
          >
            {saving ? "Saving…" : "Commit / Save"}
          </button>
        </div>
      </div>

      {saveError ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {saveError}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border">
        <div className="overflow-x-auto">
          <table className="min-w-[1160px] w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 text-left">KPI</th>
                <th className="px-3 py-2 text-left">Label (Global)</th>
                <th className="px-3 py-2 text-center">Show</th>
                <th className="px-3 py-2 text-right">Weight</th>
                <th className="px-3 py-2 text-right">Order</th>
                <th className="px-3 py-2 text-right">Threshold</th>
                <th className="px-3 py-2 text-center">Tie</th>
                <th className="px-3 py-2 text-left">Rubric</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {rowsForActive.map(({ kpiKey, cfg }) => {
                const def = kpiDefsByKey[kpiKey] ?? null;
                const label = kpiGlobalLabel(def, kpiKey);
                const { showKey, weightKey, orderKey, thresholdKey, tieKey } = cfgKeyHints;

                const show = showKey ? (cfg ? asBool(cfg[showKey]) : false) : false;
                const weight = weightKey ? (cfg ? toNumberOrNull(cfg[weightKey]) : null) : null;
                const orderVal = orderKey ? (cfg ? toNumberOrNull(cfg[orderKey]) : null) : null;
                const thresholdVal = thresholdKey ? (cfg ? toNumberOrNull(cfg[thresholdKey]) : null) : null;

                const isTie = tieKey ? (cfg ? asBool(cfg[tieKey]) : false) : false;

                const rubricSet = rubricByKpi[kpiKey] ?? [];
                const issue = rubricIssueSummary(rubricSet);

                const isOpen = openRubricKey === kpiKey;

                return (
                  <React.Fragment key={`${activeClass}::${kpiKey}`}>
                    <tr className="border-t align-top">
                      <td className="px-3 py-2 font-mono text-xs">{kpiKey}</td>

                      <td className="px-3 py-2">
                        <input
                          className="h-8 w-full rounded-md border bg-background px-2 text-sm"
                          value={asText(def?.customer_label ?? "") || label}
                          onChange={(e) => upsertKpiDef(kpiKey, { customer_label: e.target.value })}
                          placeholder={asText(def?.label ?? "") || kpiKey}
                          title="Global label (stored on metrics_kpi_def.customer_label)"
                        />
                      </td>

                      <td className="px-3 py-2 text-center">
                        {showKey ? (
                          <input
                            type="checkbox"
                            checked={show}
                            onChange={(e) => upsertClassCfg(kpiKey, { [showKey]: e.target.checked })}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>

                      <td className="px-3 py-2 text-right">
                        {weightKey ? (
                          <input
                            className="h-8 w-24 rounded-md border bg-background px-2 text-right tabular-nums"
                            inputMode="decimal"
                            value={weight ?? ""}
                            onChange={(e) => upsertClassCfg(kpiKey, { [weightKey]: toNumberOrNull(e.target.value) })}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>

                      <td className="px-3 py-2 text-right">
                        {orderKey ? (
                          <input
                            className="h-8 w-20 rounded-md border bg-background px-2 text-right tabular-nums"
                            inputMode="numeric"
                            value={orderVal ?? ""}
                            onChange={(e) => upsertClassCfg(kpiKey, { [orderKey]: toNumberOrNull(e.target.value) })}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>

                      <td className="px-3 py-2 text-right">
                        {thresholdKey ? (
                          <input
                            className="h-8 w-24 rounded-md border bg-background px-2 text-right tabular-nums"
                            inputMode="decimal"
                            value={thresholdVal ?? ""}
                            onChange={(e) => upsertClassCfg(kpiKey, { [thresholdKey]: toNumberOrNull(e.target.value) })}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>

                      <td className="px-3 py-2 text-center">
                        {tieKey ? (
                          <input
                            type="radio"
                            name={`tiebreak-${activeClass}`}
                            checked={isTie}
                            onChange={() => setTieBreakerForClass(kpiKey)}
                            title="Tie-breaker KPI for this class"
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>

                      <td className="px-3 py-2">
                        <span
                          className={[
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-xs",
                            issue.level === "ok"
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700"
                              : "bg-amber-500/10 border-amber-500/20 text-amber-700",
                          ].join(" ")}
                        >
                          {issue.text}
                        </span>
                      </td>

                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          className="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted"
                          onClick={() => {
                            ensureRubricBandRowsForKpi(kpiKey);
                            setOpenRubricKey((cur) => (cur === kpiKey ? null : kpiKey));
                          }}
                        >
                          {isOpen ? "Hide rubric" : "Edit rubric"}
                        </button>
                      </td>
                    </tr>

                    {isOpen ? (
                      <tr className="border-t">
                        <td colSpan={9} className="px-3 pb-3">
                          <div className="mt-2 rounded-lg border bg-muted/10 p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <div className="text-sm font-semibold">
                                Rubric • <span className="font-mono text-xs">{kpiKey}</span>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Global rubric by KPI. Decimals supported.
                              </div>
                            </div>

                            <div className="overflow-x-auto">
                              <table className="min-w-[760px] w-full text-sm">
                                <thead className="bg-muted/40">
                                  <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                                    <th className="px-2 py-2 text-left">Band</th>
                                    <th className="px-2 py-2 text-right">Min</th>
                                    <th className="px-2 py-2 text-right">Max</th>
                                    <th className="px-2 py-2 text-right">Score</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {BAND_KEYS.map((band) => {
                                    const rr =
                                      (rubricByKpi[kpiKey] ?? []).find(
                                        (r) => asText(r.band_key).toUpperCase() === band
                                      ) ?? null;

                                    const min = rr ? toNumberOrNull(rr.min_value) : null;
                                    const max = rr ? toNumberOrNull(rr.max_value) : null;
                                    const score = rr ? toNumberOrNull(rr.score_value) : null;

                                    return (
                                      <tr key={band} className="border-t">
                                        <td className="px-2 py-2 font-mono text-xs">{band}</td>

                                        <td className="px-2 py-2 text-right">
                                          <input
                                            className="h-8 w-28 rounded-md border bg-background px-2 text-right tabular-nums"
                                            inputMode="decimal"
                                            value={min ?? ""}
                                            onChange={(e) =>
                                              updateRubricCell(kpiKey, band, "min_value", toNumberOrNull(e.target.value))
                                            }
                                          />
                                        </td>

                                        <td className="px-2 py-2 text-right">
                                          <input
                                            className="h-8 w-28 rounded-md border bg-background px-2 text-right tabular-nums"
                                            inputMode="decimal"
                                            value={max ?? ""}
                                            onChange={(e) =>
                                              updateRubricCell(kpiKey, band, "max_value", toNumberOrNull(e.target.value))
                                            }
                                          />
                                        </td>

                                        <td className="px-2 py-2 text-right">
                                          <input
                                            className="h-8 w-28 rounded-md border bg-background px-2 text-right tabular-nums"
                                            inputMode="decimal"
                                            value={score ?? ""}
                                            onChange={(e) =>
                                              updateRubricCell(kpiKey, band, "score_value", toNumberOrNull(e.target.value))
                                            }
                                          />
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>

                            <div className="mt-3 text-xs text-muted-foreground">
                              Tip: For NO_DATA, leave min/max blank and set score_value as your rubric dictates.
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })}

              {rowsForActive.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-sm text-muted-foreground">
                    No KPI definitions found. (Check metrics_kpi_def)
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <MetricsColorsDrawer open={colorsDrawerOpen} onOpenChange={setColorsDrawerOpen} />

      <div className="text-xs text-muted-foreground">
        Note: Label is GLOBAL (metrics_kpi_def). “Show” controls inclusion per class. Rubrics are global by KPI (not
        class-anchored). Tie-breaker is single-select per class (if the DB column exists).
      </div>
    </div>
  );
}
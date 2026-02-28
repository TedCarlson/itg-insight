// RUN THIS
// Replace the entire file:
// apps/web/src/app/api/admin/metrics-config/route.ts

import { NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";

export const runtime = "nodejs";

type UpsertKpiDef = {
  kpi_key: string;
  customer_label?: string | null;
  raw_label_identifier?: string | null;
  direction?: "HIGHER_BETTER" | "LOWER_BETTER" | string | null;
  // optional fields that may exist in your table
  label?: string | null;
  unit?: string | null;
};

type UpsertClassCfg = {
  class_type: string;
  kpi_key: string;

  // your grid drives this with whatever column exists; server just persists what it receives
  enabled?: boolean | null;
  weight?: number | null;
  grade_value?: number | null;

  report_order?: number | null;
  is_tiebreaker?: boolean | null;

  // allow pass-through for other optional columns you already have (threshold, in_report, etc.)
  [key: string]: any;
};

type UpsertRubricRow = {
  class_type: string;
  kpi_key: string;
  band_key: string;
  min_value?: number | null;
  max_value?: number | null;
  score_value?: number | null;
};

function asNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

async function ownerGate() {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) {
    return {
      ok: false as const,
      sb,
      res: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }

  const { data: isOwner, error } = await sb.rpc("is_owner");
  if (error || !isOwner) {
    return {
      ok: false as const,
      sb,
      res: NextResponse.json({ error: "forbidden" }, { status: 403 }),
    };
  }

  return { ok: true as const, sb };
}

export async function GET() {
  const gate = await ownerGate();
  if (!gate.ok) return gate.res;

  const sb = gate.sb;

  const [{ data: kpiDefs }, { data: classConfig }, { data: rubricRows }] = await Promise.all([
    sb.from("metrics_kpi_def").select("*").order("kpi_key"),
    sb.from("metrics_class_kpi_config").select("*").order("class_type").order("kpi_key"),
    sb.from("metrics_class_kpi_rubric").select("*").order("class_type").order("kpi_key").order("band_key"),
  ]);

  return NextResponse.json({
    kpiDefs: kpiDefs ?? [],
    classConfig: classConfig ?? [],
    rubricRows: rubricRows ?? [],
  });
}

export async function POST(req: Request) {
  const gate = await ownerGate();
  if (!gate.ok) return gate.res;

  const sb = gate.sb;

  const body = (await req.json().catch(() => null)) as
    | { kpiDefs?: UpsertKpiDef[]; classConfig?: UpsertClassCfg[]; rubricRows?: UpsertRubricRow[] }
    | null;

  if (!body) return NextResponse.json({ error: "invalid_json" }, { status: 400 });

  const kpiDefs = Array.isArray(body.kpiDefs) ? body.kpiDefs : [];
  const classConfig = Array.isArray(body.classConfig) ? body.classConfig : [];
  const rubricRows = Array.isArray(body.rubricRows) ? body.rubricRows : [];

  // ---------------------------
  // KPI defs
  // ---------------------------
  if (kpiDefs.length > 0) {
    const upserts = kpiDefs
      .filter((d) => typeof d.kpi_key === "string" && d.kpi_key.trim())
      .map((d) => ({
        kpi_key: d.kpi_key.trim(),
        customer_label: d.customer_label ?? null,
        raw_label_identifier: d.raw_label_identifier ?? null,
        direction: d.direction ?? null,
        // if these exist and are NOT NULL in your schema, the UI/server must provide them.
        // (Leaving as optional passthrough; if your table enforces NOT NULL, send defaults from UI.)
        label: d.label ?? undefined,
        unit: d.unit ?? undefined,
      }));

    const { error } = await sb.from("metrics_kpi_def").upsert(upserts as any[], { onConflict: "kpi_key" });
    if (error) return NextResponse.json({ error }, { status: 400 });
  }

  // ---------------------------
  // Class config
  // ---------------------------
  if (classConfig.length > 0) {
    const cleaned = classConfig
      .filter(
        (c) =>
          typeof c.class_type === "string" &&
          c.class_type.trim() &&
          typeof c.kpi_key === "string" &&
          c.kpi_key.trim()
      )
      .map((c) => {
        // Pass through all fields, but normalize known numeric/boolean fields safely.
        // NOTE: we do NOT invent columns. If the payload includes a key that doesn't exist in DB,
        // PostgREST will reject it — that's desired safety.
        const row: Record<string, any> = { ...c };

        row.class_type = c.class_type.trim();
        row.kpi_key = c.kpi_key.trim();

        if ("enabled" in c) row.enabled = c.enabled ?? false;
        if ("weight" in c) row.weight = asNum(c.weight) ?? 0;
        if ("grade_value" in c) row.grade_value = asNum(c.grade_value) ?? 0;
        if ("report_order" in c) row.report_order = asNum(c.report_order);
        if ("is_tiebreaker" in c) row.is_tiebreaker = !!c.is_tiebreaker;

        // If your grid is using threshold-like fields and they exist in DB, normalize them too:
        if ("threshold" in c) row.threshold = asNum(c.threshold);
        if ("threshold_value" in c) row.threshold_value = asNum(c.threshold_value);

        return row;
      });

    const { error } = await sb
      .from("metrics_class_kpi_config")
      .upsert(cleaned as any[], { onConflict: "class_type,kpi_key" });

    if (error) return NextResponse.json({ error }, { status: 400 });

    // ------------------------------------------------------------
    // SINGLE TIE BREAKER ENFORCEMENT (server-side, per class_type)
    // ------------------------------------------------------------
    // Why: upsert merges rows and will NOT automatically clear older tie-breakers.
    // Rule: for each class_type touched in this payload, keep ONLY ONE row true.
    // Winner: last "true" in the payload (most recent intent). If none true -> clear all.
    const classesTouched = Array.from(new Set(cleaned.map((r) => String(r.class_type).toUpperCase())));

    for (const ct of classesTouched) {
      const classRows = cleaned.filter((r) => String(r.class_type).toUpperCase() === ct);

      // Find winner (last true)
      let winnerKpiKey: string | null = null;
      for (const r of classRows) {
        if (r.is_tiebreaker === true) winnerKpiKey = String(r.kpi_key);
      }

      if (winnerKpiKey) {
        // Clear all other true rows for this class
        const { error: clearErr } = await sb
          .from("metrics_class_kpi_config")
          .update({ is_tiebreaker: false })
          .eq("class_type", ct)
          .neq("kpi_key", winnerKpiKey)
          .eq("is_tiebreaker", true);

        if (clearErr) return NextResponse.json({ error: clearErr }, { status: 400 });
      } else {
        // No winner in payload -> clear all tie breakers for this class
        const { error: clearAllErr } = await sb
          .from("metrics_class_kpi_config")
          .update({ is_tiebreaker: false })
          .eq("class_type", ct)
          .eq("is_tiebreaker", true);

        if (clearAllErr) return NextResponse.json({ error: clearAllErr }, { status: 400 });
      }
    }
  }

  // ---------------------------
  // Rubric rows
  // ---------------------------
  if (rubricRows.length > 0) {
    const upserts = rubricRows
      .filter(
        (r) =>
          typeof r.class_type === "string" &&
          r.class_type.trim() &&
          typeof r.kpi_key === "string" &&
          r.kpi_key.trim() &&
          typeof r.band_key === "string" &&
          r.band_key.trim()
      )
      .map((r) => ({
        class_type: r.class_type.trim(),
        kpi_key: r.kpi_key.trim(),
        band_key: r.band_key.trim(),
        min_value: asNum(r.min_value),
        max_value: asNum(r.max_value),
        score_value: asNum(r.score_value),
      }));

    const { error } = await sb
      .from("metrics_class_kpi_rubric")
      .upsert(upserts as any[], { onConflict: "class_type,kpi_key,band_key" });

    if (error) return NextResponse.json({ error }, { status: 400 });
  }

  // Return fresh snapshot (so client rehydrates from DB truth)
  const [{ data: kpiDefsOut }, { data: classConfigOut }, { data: rubricRowsOut }] = await Promise.all([
    sb.from("metrics_kpi_def").select("*").order("kpi_key"),
    sb.from("metrics_class_kpi_config").select("*").order("class_type").order("kpi_key"),
    sb.from("metrics_class_kpi_rubric").select("*").order("class_type").order("kpi_key").order("band_key"),
  ]);

  return NextResponse.json({
    kpiDefs: kpiDefsOut ?? [],
    classConfig: classConfigOut ?? [],
    rubricRows: rubricRowsOut ?? [],
  });
}
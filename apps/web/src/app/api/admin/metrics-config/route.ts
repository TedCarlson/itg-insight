import { NextResponse } from "next/server";
import { supabaseServer } from "@/shared/data/supabase/server";
import { supabaseAdmin } from "@/shared/data/supabase/admin";

export const runtime = "nodejs";

type UpsertKpiDef = {
  kpi_key: string;
  customer_label?: string | null;
  raw_label_identifier?: string | null;
  direction?: "HIGHER_BETTER" | "LOWER_BETTER" | string | null;

  label?: string | null;
  unit?: string | null;
};

type UpsertClassCfg = {
  class_type: string;
  kpi_key: string;

  enabled?: boolean | null;
  weight?: number | null;
  weight_percent?: number | null;
  grade_value?: number | null;

  report_order?: number | null;
  display_order?: number | null;
  sort_order?: number | null;
  ui_order?: number | null;

  threshold?: number | null;
  threshold_value?: number | null;

  is_tiebreaker?: boolean | null;

  [key: string]: any;
};

type UpsertRubricRow = {
  kpi_key: string;
  band_key: string;
  min_value?: number | null;
  max_value?: number | null;
  score_value?: number | null;
  is_active?: boolean | null;
  [key: string]: any;
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

function classCfgWeight(c: UpsertClassCfg): number {
  const directWeight = asNum(c.weight);
  if (directWeight !== null) return directWeight;

  const aliases = [
    asNum((c as any).weight_value),
    asNum((c as any).weight_points),
    asNum((c as any).weight_pct),
    asNum((c as any).weight_percent),
  ];

  for (const v of aliases) {
    if (v !== null) return v;
  }

  return 0;
}

async function isOwner(sb: any) {
  try {
    const { data, error } = await sb.rpc("is_owner");
    if (error) return false;
    return !!data;
  } catch {
    return false;
  }
}

async function hasAnyRole(admin: any, auth_user_id: string, roleKeys: string[]) {
  const { data, error } = await admin.from("user_roles").select("role_key").eq("auth_user_id", auth_user_id);
  if (error) return false;
  const roles = (data ?? []).map((r: any) => String(r?.role_key ?? "")).filter(Boolean);
  return roles.some((rk: string) => roleKeys.includes(rk));
}

async function elevatedGate() {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }

  const admin = supabaseAdmin();
  const uid = user.id;

  const owner = await isOwner(sb);
  const elevated = owner || (await hasAnyRole(admin, uid, ["admin", "dev", "director", "vp"]));

  if (!elevated) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "forbidden" }, { status: 403 }),
    };
  }

  return { ok: true as const, sb, admin, owner, elevated };
}

function stripClassScopedLabelFields(row: Record<string, any>) {
  const badKeys = [
    "label",
    "kpi_label",
    "display_label",
    "label_override",
    "customer_label",
    "raw_label_identifier",
    "raw_label_id",
  ];
  for (const k of badKeys) {
    if (k in row) delete row[k];
  }
}

function rubricActiveOrNullQuery(q: any) {
  return q.or("is_active.is.null,is_active.eq.true");
}

export async function GET() {
  const gate = await elevatedGate();
  if (!gate.ok) return gate.res;

  const admin = gate.admin;

  const rubQ = rubricActiveOrNullQuery(
    admin.from("metrics_kpi_rubric").select("*").order("kpi_key").order("band_key")
  );

  const [{ data: kpiDefs }, { data: classConfig }, { data: rubricRows }] = await Promise.all([
    admin.from("metrics_kpi_def").select("*").order("kpi_key"),
    admin.from("metrics_class_kpi_config").select("*").order("class_type").order("kpi_key"),
    rubQ,
  ]);

  return NextResponse.json({
    kpiDefs: kpiDefs ?? [],
    classConfig: classConfig ?? [],
    rubricRows: rubricRows ?? [],
  });
}

export async function POST(req: Request) {
  const gate = await elevatedGate();
  if (!gate.ok) return gate.res;

  const admin = gate.admin;

  const body = (await req.json().catch(() => null)) as
    | { kpiDefs?: UpsertKpiDef[]; classConfig?: UpsertClassCfg[]; rubricRows?: UpsertRubricRow[] }
    | null;

  if (!body) return NextResponse.json({ error: "invalid_json" }, { status: 400 });

  const kpiDefs = Array.isArray(body.kpiDefs) ? body.kpiDefs : [];
  const classConfig = Array.isArray(body.classConfig) ? body.classConfig : [];
  const rubricRows = Array.isArray(body.rubricRows) ? body.rubricRows : [];

  if (kpiDefs.length > 0) {
    const upserts = kpiDefs
      .filter((d) => typeof d.kpi_key === "string" && d.kpi_key.trim())
      .map((d) => ({
        kpi_key: d.kpi_key.trim(),
        customer_label: d.customer_label ?? null,
        raw_label_identifier: d.raw_label_identifier ?? null,
        direction: d.direction ?? null,
        label: d.label ?? undefined,
        unit: d.unit ?? undefined,
      }));

    const { error } = await admin.from("metrics_kpi_def").upsert(upserts as any[], { onConflict: "kpi_key" });
    if (error) return NextResponse.json({ error }, { status: 400 });
  }

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
        const row: Record<string, any> = { ...c };

        row.class_type = c.class_type.trim();
        row.kpi_key = c.kpi_key.trim();

        row.enabled = c.enabled ?? false;

        const canonicalWeight = classCfgWeight(c);

        row.weight = canonicalWeight;

        if ("weight_percent" in row) row.weight_percent = asNum(c.weight_percent) ?? canonicalWeight;
        if ("weight_pct" in row) row.weight_pct = asNum((c as any).weight_pct) ?? canonicalWeight;
        if ("weight_value" in row) row.weight_value = asNum((c as any).weight_value) ?? canonicalWeight;
        if ("weight_points" in row) row.weight_points = asNum((c as any).weight_points) ?? canonicalWeight;

        row.grade_value = asNum(c.grade_value) ?? 0;

        if ("report_order" in row) row.report_order = asNum(c.report_order);
        if ("display_order" in row) row.display_order = asNum(c.display_order);
        if ("sort_order" in row) row.sort_order = asNum(c.sort_order);
        if ("ui_order" in row) row.ui_order = asNum(c.ui_order);

        if ("threshold" in row) row.threshold = asNum(c.threshold);
        if ("threshold_value" in row) row.threshold_value = asNum(c.threshold_value);

        row.is_tiebreaker = !!c.is_tiebreaker;

        stripClassScopedLabelFields(row);

        return row;
      });

    const { error } = await admin
      .from("metrics_class_kpi_config")
      .upsert(cleaned as any[], { onConflict: "class_type,kpi_key" });

    if (error) return NextResponse.json({ error }, { status: 400 });

    const classesTouched = Array.from(new Set(cleaned.map((r) => String(r.class_type).toUpperCase())));

    for (const ct of classesTouched) {
      const classRows = cleaned.filter((r) => String(r.class_type).toUpperCase() === ct);

      let winnerKpiKey: string | null = null;
      for (const r of classRows) {
        if (r.is_tiebreaker === true) winnerKpiKey = String(r.kpi_key);
      }

      if (winnerKpiKey) {
        const { error: clearErr } = await admin
          .from("metrics_class_kpi_config")
          .update({ is_tiebreaker: false })
          .eq("class_type", ct)
          .neq("kpi_key", winnerKpiKey)
          .eq("is_tiebreaker", true);

        if (clearErr) return NextResponse.json({ error: clearErr }, { status: 400 });
      } else {
        const { error: clearAllErr } = await admin
          .from("metrics_class_kpi_config")
          .update({ is_tiebreaker: false })
          .eq("class_type", ct)
          .eq("is_tiebreaker", true);

        if (clearAllErr) return NextResponse.json({ error: clearAllErr }, { status: 400 });
      }
    }
  }

  if (rubricRows.length > 0) {
    const upserts = rubricRows
      .filter(
        (r) =>
          typeof r.kpi_key === "string" &&
          r.kpi_key.trim() &&
          typeof r.band_key === "string" &&
          r.band_key.trim()
      )
      .map((r) => ({
        pc_org_id: null,
        kpi_key: r.kpi_key.trim(),
        band_key: r.band_key.trim(),
        min_value: asNum(r.min_value),
        max_value: asNum(r.max_value),
        score_value: asNum(r.score_value),
        ...(Object.prototype.hasOwnProperty.call(r, "is_active") ? { is_active: (r as any).is_active ?? null } : {}),
        updated_at: new Date().toISOString(),
      }));

    const { error } = await admin
      .from("metrics_kpi_rubric")
      .upsert(upserts as any[], { onConflict: "kpi_key,band_key" });

    if (error) return NextResponse.json({ error }, { status: 400 });
  }

  const rubQ = rubricActiveOrNullQuery(
    admin.from("metrics_kpi_rubric").select("*").order("kpi_key").order("band_key")
  );

  const [{ data: kpiDefsOut }, { data: classConfigOut }, { data: rubricRowsOut }] = await Promise.all([
    admin.from("metrics_kpi_def").select("*").order("kpi_key"),
    admin.from("metrics_class_kpi_config").select("*").order("class_type").order("kpi_key"),
    rubQ,
  ]);

  return NextResponse.json({
    kpiDefs: kpiDefsOut ?? [],
    classConfig: classConfigOut ?? [],
    rubricRows: rubricRowsOut ?? [],
  });
}
// path: apps/web/src/features/admin/home-editor/lib/homeEditorTypes.ts

export type Lob = "FULFILLMENT" | "LOCATE";

export type DraftBlock = {
  _key: string;
  pc_org_home_block_id?: string;
  area: string;
  block_type: "kpi_row" | "narrative" | "link_list";
  title: string;
  config: any;
  is_enabled: boolean;
};

export const AREAS = ["header", "kpis", "left", "right", "footer"] as const;

export const AREA_LABEL: Record<(typeof AREAS)[number], string> = {
  header: "Header",
  kpis: "KPI Row",
  left: "Left Column",
  right: "Right Column",
  footer: "Footer",
};

export function uid() {
  try {
    return crypto.randomUUID();
  } catch {
    return `k_${Math.random().toString(16).slice(2)}_${Date.now()}`;
  }
}
// path: apps/web/src/shared/server/executive/pipelines/workforceExecutivePipeline.server.ts

import {
  getActivePeopleOnboardingRows,
  loadPeopleOnboardingRows,
} from "@/shared/server/people/loadPeopleOnboardingRows.server";
import { supabaseServer } from "@/shared/data/supabase/server";
import { loadWorkforceSourceRows } from "@/shared/server/workforce/loadWorkforceSourceRows.server";
import type {
  ExecutiveArtifactCard,
  ExecutiveDimensionPayload,
} from "@/shared/types/executive/executiveSuite";
import type { WorkforceAffiliationOption } from "@/shared/types/workforce/surfacePayload";
import type { WorkforceSourceRow } from "@/shared/server/workforce/buildWorkforceSurfacePayload.server";

const DIRECTOR_WORKFORCE_HREF = "/director/workspace";
const CONTRIBUTING_LEADERSHIP_TECH_IDS = new Set(["7109"]);

type AffiliationLikeRow = {
  affiliation_id?: string | null;
  affiliation?: string | null;
};

function normalize(value: unknown): string {
  return String(value ?? "").trim();
}

async function loadAffiliationOptions(): Promise<WorkforceAffiliationOption[]> {
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc("workforce_affiliation_options");
  if (error) throw new Error(error.message);
  return (data ?? []) as WorkforceAffiliationOption[];
}

function affiliationLabel(
  row: AffiliationLikeRow,
  affiliations: WorkforceAffiliationOption[]
): string {
  const byId = affiliations.find(
    (option) => option.affiliation_id === row.affiliation_id
  );

  if (byId?.affiliation_label) return byId.affiliation_label;
  return normalize(row.affiliation) || "Unknown";
}

function officeLabel(row: {
  office?: string | null;
  office_name?: string | null;
}): string {
  return normalize(row.office) || normalize(row.office_name) || "Unknown";
}

function isW2Affiliation(label: string): boolean {
  const value = label.toUpperCase();

  return (
    value === "ITG" ||
    value === "W2" ||
    value === "EMPLOYEE" ||
    value === "IN HOUSE" ||
    value.includes("INTEGRATED TECH") ||
    value.includes("INTERNAL")
  );
}

function isBpAffiliation(label: string): boolean {
  const value = label.toUpperCase();
  return !isW2Affiliation(value) && value !== "UNKNOWN";
}

function roleType(row: { role_type?: string | null }) {
  return normalize(row.role_type).toUpperCase();
}

function isTrainingSeat(row: { role_type?: string | null }): boolean {
  return roleType(row) === "TRAINING";
}

function isProductionSeat(row: { role_type?: string | null }): boolean {
  const value = roleType(row);
  return value === "FIELD" || value === "TRAVEL";
}

function isLocalProductionSeat(row: { role_type?: string | null }): boolean {
  return roleType(row) === "FIELD";
}

function isTravelProductionSeat(row: { role_type?: string | null }): boolean {
  return roleType(row) === "TRAVEL";
}

function hasDerivedFieldContribution(row: WorkforceSourceRow): boolean {
  const techId = normalize(row.tech_id);
  return techId ? CONTRIBUTING_LEADERSHIP_TECH_IDS.has(techId) : false;
}

function isExhibitEligibleWorker(row: WorkforceSourceRow): boolean {
  const value = roleType(row);
  const title = normalize(row.position_title).toLowerCase();

  if (!row.is_active) return false;
  if (value === "SUPPORT" || value === "FMLA") return false;

  if (hasDerivedFieldContribution(row)) return true;

  if (
    value === "LEADERSHIP" ||
    title.includes("supervisor") ||
    title.includes("manager") ||
    title.includes("owner") ||
    title.includes("lead") ||
    title.includes("director")
  ) {
    return false;
  }

  return (
    value === "FIELD" ||
    value === "TRAVEL" ||
    title.includes("technician") ||
    title.includes("field")
  );
}

function dedupeWorkers(rows: WorkforceSourceRow[]): WorkforceSourceRow[] {
  const byKey = new Map<string, WorkforceSourceRow>();

  for (const row of rows) {
    const key =
      normalize(row.tech_id) ||
      normalize(row.person_id) ||
      normalize(row.assignment_id);

    if (!key || byKey.has(key)) continue;
    byKey.set(key, row);
  }

  return Array.from(byKey.values());
}

function percent(part: number, total: number): string {
  if (!total) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function countCards(
  map: Map<string, number>,
  args: {
    section: string;
    valueLabel?: string;
    onboardingCounts?: Map<string, number>;
    trainingCounts?: Map<string, number>;
    localCounts?: Map<string, number>;
    travelCounts?: Map<string, number>;
    limit?: number;
  }
): ExecutiveArtifactCard[] {
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(0, args.limit)
    .map(([label, count]) => {
      const onboarding = args.onboardingCounts?.get(label) ?? 0;
      const training = args.trainingCounts?.get(label) ?? 0;
      const local = args.localCounts?.get(label) ?? 0;
      const travel = args.travelCounts?.get(label) ?? 0;

      return {
        key: `${args.section}_${label
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")}`,
        label,
        value: String(count),
        helper: args.valueLabel,
        meta: {
          section: args.section,
          hc: count,
          local,
          travel,
          onboarding,
          training,
        },
      };
    });
}

export async function buildWorkforceExecutiveDimension(args: {
  pc_org_id: string;
  as_of_date: string;
}): Promise<ExecutiveDimensionPayload> {
  const [rows, onboardingRows, affiliations] = await Promise.all([
    loadWorkforceSourceRows({
      pc_org_id: args.pc_org_id,
      as_of_date: args.as_of_date,
    }),
    loadPeopleOnboardingRows({
      pc_org_id: args.pc_org_id,
      limit: 500,
    }),
    loadAffiliationOptions(),
  ]);

  const activeRows = rows.filter((row) => {
    if (!row.is_active) return false;
    if (row.end_date && row.end_date <= args.as_of_date) return false;
    return true;
  });

  const techRows = dedupeWorkers(
    activeRows.filter((row) => isExhibitEligibleWorker(row))
  );

  const productionRows = techRows.filter(isProductionSeat);
  const trainingRows = dedupeWorkers(activeRows.filter(isTrainingSeat));

  const productionW2Rows = productionRows.filter((row) =>
    isW2Affiliation(affiliationLabel(row, affiliations))
  );

  const productionBpRows = productionRows.filter((row) =>
    isBpAffiliation(affiliationLabel(row, affiliations))
  );

  const activeOnboardingRows = getActivePeopleOnboardingRows(onboardingRows);

  const bpCounts = new Map<string, number>();
  const bpLocalCounts = new Map<string, number>();
  const bpTravelCounts = new Map<string, number>();
  const bpOnboardingCounts = new Map<string, number>();
  const bpTrainingCounts = new Map<string, number>();

  const officeCounts = new Map<string, number>();
  const officeLocalCounts = new Map<string, number>();
  const officeTravelCounts = new Map<string, number>();

  let w2OnboardingCount = 0;
  let w2TrainingCount = 0;

  for (const row of productionBpRows) {
    const label = affiliationLabel(row, affiliations);
    increment(bpCounts, label);

    if (isLocalProductionSeat(row)) increment(bpLocalCounts, label);
    if (isTravelProductionSeat(row)) increment(bpTravelCounts, label);
  }

  for (const row of activeOnboardingRows) {
    const label = affiliationLabel(row, affiliations);

    if (isW2Affiliation(label)) {
      w2OnboardingCount += 1;
    } else if (isBpAffiliation(label)) {
      increment(bpOnboardingCounts, label);
    }
  }

  for (const row of trainingRows) {
    const label = affiliationLabel(row, affiliations);

    if (isW2Affiliation(label)) {
      w2TrainingCount += 1;
    } else if (isBpAffiliation(label)) {
      increment(bpTrainingCounts, label);
    }
  }

  for (const row of productionRows) {
    const office = officeLabel(row);

    increment(officeCounts, office);

    if (isLocalProductionSeat(row)) increment(officeLocalCounts, office);
    if (isTravelProductionSeat(row)) increment(officeTravelCounts, office);
  }

  const allInHc = techRows.length;
  const productionHc = productionRows.length;
  const localProductionHc = productionRows.filter(isLocalProductionSeat).length;
  const travelProductionHc = productionRows.filter(isTravelProductionSeat).length;

  const w2ProductionHc = productionW2Rows.length;
  const w2LocalHc = productionW2Rows.filter(isLocalProductionSeat).length;
  const w2TravelHc = productionW2Rows.filter(isTravelProductionSeat).length;

  const bpProductionHc = productionBpRows.length;
  const bpLocalHc = productionBpRows.filter(isLocalProductionSeat).length;
  const bpTravelHc = productionBpRows.filter(isTravelProductionSeat).length;

  return {
    dimension: "workforce",
    title: "Workforce",
    status: "ready",
    artifacts: [
      {
        key: "workforce_composition",
        title: "Workforce Composition",
        description:
          "Executive staffing composition across headcount, labor mix, affiliates, onboarding, training, and office distribution.",
        status: "ready",
        href: DIRECTOR_WORKFORCE_HREF,
        cards: [
          {
            key: "all_in_hc",
            label: "All-In HC",
            value: String(allInHc),
            helper: "Full active tech footprint",
            meta: { section: "total_strip", hc: allInHc },
          },
          {
            key: "production_hc",
            label: "Production HC",
            value: String(productionHc),
            helper: "Field + travel seats",
            meta: {
              section: "total_strip",
              hc: productionHc,
              local: localProductionHc,
              travel: travelProductionHc,
            },
          },
          {
            key: "w2_production_hc",
            label: "W2 Prod",
            value: String(w2ProductionHc),
            helper: `${percent(w2ProductionHc, productionHc)} of production`,
            meta: {
              section: "total_strip",
              hc: w2ProductionHc,
              local: w2LocalHc,
              travel: w2TravelHc,
              percent: percent(w2ProductionHc, productionHc),
            },
          },
          {
            key: "bp_production_hc",
            label: "BP Prod",
            value: String(bpProductionHc),
            helper: `${percent(bpProductionHc, productionHc)} of production`,
            meta: {
              section: "total_strip",
              hc: bpProductionHc,
              local: bpLocalHc,
              travel: bpTravelHc,
              percent: percent(bpProductionHc, productionHc),
            },
          },
          {
            key: "w2_staffing",
            label: "In House",
            value: String(w2ProductionHc),
            helper: "Production HC",
            meta: {
              section: "staffing_summary",
              hc: w2ProductionHc,
              local: w2LocalHc,
              travel: w2TravelHc,
              onboarding: w2OnboardingCount,
              training: w2TrainingCount,
            },
          },
          ...countCards(bpCounts, {
            section: "bp_breakout",
            valueLabel: "Production HC",
            localCounts: bpLocalCounts,
            travelCounts: bpTravelCounts,
            onboardingCounts: bpOnboardingCounts,
            trainingCounts: bpTrainingCounts,
          }),
          ...countCards(officeCounts, {
            section: "office_grid",
            valueLabel: "Production HC",
            localCounts: officeLocalCounts,
            travelCounts: officeTravelCounts,
          }),
        ],
      },
      {
        key: "workforce_reports",
        title: "Workforce Reports",
        description: "Launch Director workforce reporting surfaces.",
        status: "ready",
        href: DIRECTOR_WORKFORCE_HREF,
        cards: [
          {
            key: "report_exhibit",
            label: "Exhibit",
            value: "Exhibit",
            meta: { section: "report_button" },
          },
          {
            key: "report_workforce",
            label: "Workforce",
            value: "Workforce",
            meta: { section: "report_button" },
          },
          {
            key: "report_onboarding",
            label: "Onboarding",
            value: "Onboarding",
            meta: { section: "report_button" },
          },
          {
            key: "report_roster_export",
            label: "Roster Export",
            value: "Roster Export",
            meta: { section: "report_button" },
          },
        ],
      },
    ],
  };
}
// path: apps/web/src/shared/server/executive/pipelines/workforceExecutivePipeline.server.ts

import {
  getActivePeopleOnboardingRows,
  loadPeopleOnboardingRows,
} from "@/shared/server/people/loadPeopleOnboardingRows.server";
import { loadWorkforceSourceRows } from "@/shared/server/workforce/loadWorkforceSourceRows.server";
import type {
  ExecutiveArtifactCard,
  ExecutiveDimensionPayload,
} from "@/shared/types/executive/executiveSuite";

const DIRECTOR_WORKFORCE_HREF = "/director/executive?dimension=workforce";

function normalize(value: unknown): string {
  return String(value ?? "").trim();
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function affiliationLabel(row: { affiliation?: string | null }): string {
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
    value.includes("INTEGRATED TECH") ||
    value.includes("INTERNAL")
  );
}

function isBpAffiliation(label: string): boolean {
  const value = label.toUpperCase();

  return !isW2Affiliation(value) && value !== "UNKNOWN";
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
    limit?: number;
  }
): ExecutiveArtifactCard[] {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, args.limit)
    .map(([label, count]) => {
      const onboarding = args.onboardingCounts?.get(label) ?? 0;

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
          onboarding,
        },
      };
    });
}

export async function buildWorkforceExecutiveDimension(args: {
  pc_org_id: string;
  as_of_date: string;
}): Promise<ExecutiveDimensionPayload> {
  const [rows, onboardingRows] = await Promise.all([
    loadWorkforceSourceRows({
      pc_org_id: args.pc_org_id,
      as_of_date: args.as_of_date,
    }),
    loadPeopleOnboardingRows({
      pc_org_id: args.pc_org_id,
      limit: 500,
    }),
  ]);

  const activeRows = rows.filter((row) => row.is_active);
  const techRows = activeRows.filter(
    (row) => row.is_field || row.is_travel_tech
  );

  const w2Rows = techRows.filter((row) =>
    isW2Affiliation(affiliationLabel(row))
  );

  const bpRows = techRows.filter((row) =>
    isBpAffiliation(affiliationLabel(row))
  );

  const activeOnboardingRows = getActivePeopleOnboardingRows(onboardingRows);

  const bpCounts = new Map<string, number>();
  const bpOnboardingCounts = new Map<string, number>();
  const officeCounts = new Map<string, number>();

  let w2OnboardingCount = 0;

  for (const row of bpRows) {
    increment(bpCounts, titleCase(affiliationLabel(row)));
  }

  for (const row of activeOnboardingRows) {
    const label = titleCase(affiliationLabel(row));

    if (isW2Affiliation(label)) {
      w2OnboardingCount += 1;
    } else if (isBpAffiliation(label)) {
      increment(bpOnboardingCounts, label);
    }
  }

  for (const row of techRows) {
    increment(officeCounts, titleCase(officeLabel(row)));
  }

  const totalHc = techRows.length;
  const w2Count = w2Rows.length;
  const bpCount = bpRows.length;

  return {
    dimension: "workforce",
    title: "Workforce",
    status: "ready",
    artifacts: [
      {
        key: "workforce_composition",
        title: "Workforce Composition",
        description:
          "Executive staffing composition across headcount, labor mix, affiliates, onboarding, and office distribution.",
        status: "ready",
        href: DIRECTOR_WORKFORCE_HREF,
        cards: [
          {
            key: "total_hc",
            label: "Total HC",
            value: String(totalHc),
            helper: "active field + travel technicians",
            meta: {
              section: "total_strip",
              hc: totalHc,
            },
          },
          {
            key: "w2_hc",
            label: "W2 HC",
            value: String(w2Count),
            helper: `${percent(w2Count, totalHc)} of total`,
            meta: {
              section: "total_strip",
              hc: w2Count,
              percent: percent(w2Count, totalHc),
            },
          },
          {
            key: "bp_hc",
            label: "BP HC",
            value: String(bpCount),
            helper: `${percent(bpCount, totalHc)} of total`,
            meta: {
              section: "total_strip",
              hc: bpCount,
              percent: percent(bpCount, totalHc),
            },
          },
          {
            key: "w2_staffing",
            label: "In House",
            value: String(w2Count),
            helper: "HC",
            meta: {
              section: "staffing_summary",
              hc: w2Count,
              onboarding: w2OnboardingCount,
            },
          },
          ...countCards(bpCounts, {
            section: "bp_breakout",
            valueLabel: "HC",
            onboardingCounts: bpOnboardingCounts,
          }),
          ...countCards(officeCounts, {
            section: "office_grid",
            valueLabel: "HC",
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
            key: "report_org_chart",
            label: "Org Chart",
            value: "Org Chart",
            meta: { section: "report_button" },
          },
        ],
      },
    ],
  };
}
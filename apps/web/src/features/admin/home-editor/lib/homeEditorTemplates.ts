// path: apps/web/src/features/admin/home-editor/lib/homeEditorTemplates.ts

import type { DraftBlock, Lob } from "./homeEditorTypes";
import { uid } from "./homeEditorTypes";

export function defaultTemplate(lob: Lob): DraftBlock[] {
  if (lob === "LOCATE") {
    return [
      {
        _key: uid(),
        area: "kpis",
        block_type: "kpi_row",
        title: "Locate Snapshot",
        is_enabled: true,
        config: {
          subtitle: "Start simple; wire data sources later",
          items: [
            { label: "Tickets Open", value: "—", sub: "Current backlog" },
            { label: "Past Due", value: "—", sub: "Aging volume" },
            { label: "Emergency", value: "—", sub: "Rolling avg" },
            { label: "Daily Log", value: "—", sub: "Entries today" },
          ],
        },
      },
      {
        _key: uid(),
        area: "left",
        block_type: "narrative",
        title: "Trend Narrative",
        is_enabled: true,
        config: { subtitle: "What changed and why", text: "" },
      },
      {
        _key: uid(),
        area: "right",
        block_type: "link_list",
        title: "Quick Links",
        is_enabled: true,
        config: {
          items: [
            { label: "Daily Log", href: "/locate/daily-log", sub: "Log + review" },
            { label: "Workforce", href: "/company-manager/workforce", sub: "Staffing + assignment" },
          ],
        },
      },
    ];
  }

  return [
    {
      _key: uid(),
      area: "kpis",
      block_type: "kpi_row",
      title: "PC Snapshot",
      is_enabled: true,
      config: {
        subtitle: "Replace placeholders with real rollups next",
        items: [
          { label: "Headcount", value: "—", sub: "Roster active" },
          { label: "Quota Coverage", value: "—", sub: "Days meeting quota" },
          { label: "Shift Validation", value: "—", sub: "Next 14-day window" },
          { label: "Route Lock Health", value: "—", sub: "Exceptions + readiness" },
        ],
      },
    },
    {
      _key: uid(),
      area: "left",
      block_type: "narrative",
      title: "Today’s Focus",
      is_enabled: true,
      config: { subtitle: "Supervisor narrative", text: "" },
    },
    {
      _key: uid(),
      area: "right",
      block_type: "link_list",
      title: "Quick Links",
      is_enabled: true,
      config: {
        items: [
          { label: "Route Lock Calendar", href: "/route-lock/calendar", sub: "Current & next fiscal month" },
          { label: "Shift Validation", href: "/route-lock/shift-validation", sub: "14-day forward window" },
          { label: "Workforce", href: "/company-manager/workforce", sub: "Staffing + assignment" },
        ],
      },
    },
  ];
}
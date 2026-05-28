export type AdminTableDef = {
  key: string;
  label: string;
  group: string;
};

export const ADMIN_TABLES: AdminTableDef[] = [
  { key: "person", label: "Person", group: "Identity" },
  { key: "user_profile", label: "User Profile", group: "Identity" },

  { key: "pc_org", label: "PC-Org", group: "Organization" },
  { key: "pc", label: "PC", group: "Organization" },
  { key: "pc_org_office", label: "PC-Org Office", group: "Organization" },
  { key: "pc_org_state_coverage", label: "PC-Org State Coverage", group: "Organization" },
  { key: "division", label: "Division", group: "Organization" },
  { key: "region", label: "Region", group: "Organization" },
  { key: "office", label: "Office", group: "Organization" },
  { key: "mso", label: "MSO", group: "Organization" },

  { key: "assignment", label: "Assignment", group: "Assignments" },

  { key: "route", label: "Route", group: "Operations" },
  { key: "schedule", label: "Schedule", group: "Operations" },
  { key: "quota", label: "Quota", group: "Operations" },

  { key: "position_title", label: "Position Title", group: "Reference" },
  { key: "fiscal_month_dim", label: "Fiscal Month", group: "Reference" },
  { key: "locate_state_resource", label: "Locate States", group: "Reference" },
];
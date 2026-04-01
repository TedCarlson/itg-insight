export type CompanyManagerViewMode = "OFFICE" | "LEADERSHIP" | "WORKFORCE";
export type CompanyManagerSegment = "ALL" | "ITG" | "BP";

export type CompanyManagerOfficeRow = {
  office_name: string;
  tech_count: number;
  total_jobs: number;
  installs: number;
  tcs: number;
  sros: number;
  risk_count: number;
};

export type CompanyManagerLeadershipRow = {
  leader_name: string;
  team_count: number;
  tech_count: number;
  total_jobs: number;
  risk_count: number;
};
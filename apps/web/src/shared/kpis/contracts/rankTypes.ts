// path: src/shared/kpis/contracts/rankTypes.ts

export type RankScope = "team" | "region" | "division";

export type RankDirection = "HIGHER_BETTER" | "LOWER_BETTER";

export type RankSeat = {
  rank: number;
  population: number;
};

export type RankContext = {
  team: RankSeat | null;
  region: RankSeat | null;
  division: RankSeat | null;
};

export type RankInputRow = {
  person_id: string;
  tech_id: string;

  // 1️⃣ PRIMARY
  composite_score: number | null;

  // scope keys
  team_key: string | null;
  region_key: string | null;
  division_key: string | null;

  // 2️⃣ ADMIN TIEBREAKER
  tiebreak_value: number | null;
  tiebreak_direction: RankDirection | null;

  // 3️⃣ JOBS
  total_jobs: number | null;

  // 4️⃣ RISK
  risk_flags: number | null;

  // 5️⃣ RESOLUTION STATUS
  row_resolution_status:
    | "ACTIVE_ASSIGNMENT_MATCH"
    | "RANGE_MATCH_NO_ACTIVE_ASSIGNMENT"
    | "REPORTED_TECH_NO_ASSIGNMENT"
    | "COMPOSITE_WITHOUT_KPI_PAYLOAD"
    | "KPI_PAYLOAD_PRESENT"
    | "NO_REPORTED_METRICS_IN_RANGE";
};

export type RankResolverConfig = {
  scopes?: RankScope[];
};

export type RankContextByPerson = Map<string, RankContext>;
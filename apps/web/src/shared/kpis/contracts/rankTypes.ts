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

  /**
   * Primary ordering value.
   * This is the authoritative weighted/composite score
   * for the active range context.
   */
  composite_score: number | null;

  /**
   * Scope keys used to partition populations.
   */
  team_key: string | null;
  region_key: string | null;
  division_key: string | null;

  /**
   * Admin-configured tiebreaker KPI value.
   * This comes from metrics admin configuration.
   */
  tiebreak_value: number | null;

  /**
   * Direction for the configured tiebreaker KPI.
   * HIGHER_BETTER means larger value wins.
   * LOWER_BETTER means smaller value wins.
   */
  tiebreak_direction: RankDirection | null;

  /**
   * Default fallback tiebreaker if the configured
   * tiebreak value is still tied or unavailable.
   */
  fallback_value: number | null;
};

export type RankResolverConfig = {
  scopes?: RankScope[];
};

export type RankContextByPerson = Map<string, RankContext>;
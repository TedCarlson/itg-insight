import type {
  RankContext,
  RankContextByPerson,
  RankDirection,
  RankInputRow,
  RankResolverConfig,
  RankScope,
  RankSeat,
} from "@/shared/kpis/contracts/rankTypes";

function compareNullableNumbersDesc(a: number | null, b: number | null) {
  const av = a == null || !Number.isFinite(a) ? -Infinity : a;
  const bv = b == null || !Number.isFinite(b) ? -Infinity : b;
  return bv - av;
}

function compareNullableNumbersAsc(a: number | null, b: number | null) {
  const av = a == null || !Number.isFinite(a) ? Infinity : a;
  const bv = b == null || !Number.isFinite(b) ? Infinity : b;
  return av - bv;
}

function compareTiebreakValue(
  a: RankInputRow,
  b: RankInputRow,
  direction: RankDirection | null
) {
  if (direction === "LOWER_BETTER") {
    return compareNullableNumbersAsc(a.tiebreak_value, b.tiebreak_value);
  }

  return compareNullableNumbersDesc(a.tiebreak_value, b.tiebreak_value);
}

function compareFallbackValue(a: RankInputRow, b: RankInputRow) {
  return compareNullableNumbersDesc(a.fallback_value, b.fallback_value);
}

function compareStableKey(a: RankInputRow, b: RankInputRow) {
  return a.person_id.localeCompare(b.person_id);
}

function sortBucket(rows: RankInputRow[]) {
  return [...rows].sort((a, b) => {
    const compositeCompare = compareNullableNumbersDesc(
      a.composite_score,
      b.composite_score
    );
    if (compositeCompare !== 0) return compositeCompare;

    const tiebreakDirection: RankDirection | null =
      a.tiebreak_direction ?? b.tiebreak_direction ?? "HIGHER_BETTER";

    const tiebreakCompare = compareTiebreakValue(a, b, tiebreakDirection);
    if (tiebreakCompare !== 0) return tiebreakCompare;

    const fallbackCompare = compareFallbackValue(a, b);
    if (fallbackCompare !== 0) return fallbackCompare;

    return compareStableKey(a, b);
  });
}

function rankBucket(rows: RankInputRow[]) {
  const ranked = new Map<string, RankSeat>();
  const sorted = sortBucket(rows);
  const population = sorted.length;

  sorted.forEach((row, index) => {
    ranked.set(row.person_id, {
      rank: index + 1,
      population,
    });
  });

  return ranked;
}

function getScopeKey(row: RankInputRow, scope: RankScope) {
  if (scope === "team") return row.team_key;
  if (scope === "region") return row.region_key;
  return row.division_key;
}

function buildScopeBuckets(rows: RankInputRow[], scope: RankScope) {
  const buckets = new Map<string, RankInputRow[]>();

  for (const row of rows) {
    if (row.composite_score == null || !Number.isFinite(row.composite_score)) {
      continue;
    }

    const scopeKey = getScopeKey(row, scope);
    if (!scopeKey) continue;

    const bucket = buckets.get(scopeKey) ?? [];
    bucket.push(row);
    buckets.set(scopeKey, bucket);
  }

  return buckets;
}

function resolveScopeRanks(rows: RankInputRow[], scope: RankScope) {
  const result = new Map<string, RankSeat>();
  const buckets = buildScopeBuckets(rows, scope);

  for (const bucket of buckets.values()) {
    const ranked = rankBucket(bucket);
    for (const [personId, seat] of ranked.entries()) {
      result.set(personId, seat);
    }
  }

  return result;
}

export function resolveRankContextByTech(
  rows: RankInputRow[],
  config: RankResolverConfig = {}
): RankContextByPerson {
  const scopes: RankScope[] = config.scopes ?? ["team", "region", "division"];

  const teamRanks = scopes.includes("team")
    ? resolveScopeRanks(rows, "team")
    : new Map<string, RankSeat>();

  const regionRanks = scopes.includes("region")
    ? resolveScopeRanks(rows, "region")
    : new Map<string, RankSeat>();

  const divisionRanks = scopes.includes("division")
    ? resolveScopeRanks(rows, "division")
    : new Map<string, RankSeat>();

  const out: RankContextByPerson = new Map<string, RankContext>();

  for (const row of rows) {
    out.set(row.person_id, {
      team: teamRanks.get(row.person_id) ?? null,
      region: regionRanks.get(row.person_id) ?? null,
      division: divisionRanks.get(row.person_id) ?? null,
    });
  }

  return out;
}
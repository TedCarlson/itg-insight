export type LookupOption = {
  id: string;
  label: string;
  sublabel?: string;
};

export type PcOrgLookups = {
  pc: LookupOption[];
  mso: LookupOption[];
  division: LookupOption[];
  region: LookupOption[];
  state: LookupOption[];
};

export type AssignmentLookups = {
  person: LookupOption[];
  pc_org: LookupOption[];
  office: LookupOption[]; // active-only
  position_title: LookupOption[];
};

/**
 * Catalogue lookups are explicit per domain/view family.
 *
 * Rule:
 * - Add a typed shape per domain
 * - Register it in CatalogueLookupsByKey
 * - Wire an endpoint mapping in fetchLookups.ts
 *
 * Avoid "catch-all" Record<string, LookupOption[]> responses — we want autocomplete
 * and compile-time guarantees per view.
 */
export type CatalogueLookupsByKey = {
  pc_org: PcOrgLookups;
  assignment: AssignmentLookups;
};
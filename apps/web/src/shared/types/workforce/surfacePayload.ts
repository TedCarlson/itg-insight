// path: apps/web/src/shared/types/workforce/surfacePayload.ts

import type {
  WorkforceRow,
  WorkforceSeatType,
  WorkforceTabKey,
} from "./workforce.types";

export type WorkforceTab = {
  key: WorkforceTabKey;
  label: string;
  count: number;
};

export type WorkforceSliceOption = {
  value: string;
  label: string;
  count: number;
};

export type WorkforceSliceModel = {
  offices: WorkforceSliceOption[];
  reportsTo: WorkforceSliceOption[];
  positions: WorkforceSliceOption[];
  affiliations: WorkforceSliceOption[];
  seatTypes: WorkforceSliceOption[];
};

export type WorkforceSelectedPerson = {
  person_id: string;
  display_name: string;
  active_seat_count: number;
  has_field_seat: boolean;
  has_leadership_seat: boolean;
  has_travel_seat: boolean;
};

export type WorkforceSeatHistoryRow = {
  assignment_id: string;
  person_id: string;
  tech_id: string | null;
  position_title: string | null;
  reports_to_assignment_id: string | null;
  reports_to_person_id: string | null;
  reports_to_name: string | null;
  office_id: string | null;
  office: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  seat_type: WorkforceSeatType;
  is_travel_tech: boolean;
};

export type WorkforceSurfacePayload = {
  rows: WorkforceRow[];

  tabs: WorkforceTab[];

  summary: {
    total: number;
    field: number;
    leadership: number;
    support: number;
    incomplete: number;
    travel: number;
  };

  slices: WorkforceSliceModel;

  selected?: {
    row: WorkforceRow;
    person: WorkforceSelectedPerson;
    history: WorkforceSeatHistoryRow[];
  };
};
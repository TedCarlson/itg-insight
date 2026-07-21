create table if not exists public.locate_massachusetts_sla_exposure_row (
  locate_massachusetts_sla_exposure_row_id uuid primary key default gen_random_uuid(),
  locate_reporting_record_id uuid not null references public.locate_reporting_record(locate_reporting_record_id) on delete cascade,
  ticket_id text not null,
  received_at_local timestamp without time zone,
  due_at_local timestamp without time zone,
  ticket_type text,
  work_type text,
  excavator_name text,
  state_code text,
  place_name text,
  ticket_status text,
  last_response text,
  last_response_at_local timestamp without time zone,
  assigned_to text,
  division_name text,
  region_name text,
  risk_status text not null check (risk_status in ('OVERDUE','DUE_WITHIN_4_HOURS','DUE_WITHIN_24_HOURS','FUTURE','UNKNOWN')),
  hours_until_due numeric,
  has_response_evidence boolean not null default false,
  duplicate_occurrence_count integer not null default 1,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists locate_ma_sla_record_idx on public.locate_massachusetts_sla_exposure_row(locate_reporting_record_id);
create index if not exists locate_ma_sla_risk_idx on public.locate_massachusetts_sla_exposure_row(risk_status, due_at_local);
create index if not exists locate_ma_sla_assignee_idx on public.locate_massachusetts_sla_exposure_row(assigned_to, risk_status);
create index if not exists locate_ma_sla_ticket_idx on public.locate_massachusetts_sla_exposure_row(ticket_id);

alter table public.locate_massachusetts_sla_exposure_row enable row level security;

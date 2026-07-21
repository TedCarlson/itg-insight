create table if not exists public.locate_massachusetts_sla_late_ticket (
  ticket_id text primary key,
  first_reported_record_id uuid not null references public.locate_reporting_record(locate_reporting_record_id) on delete restrict,
  first_reported_at timestamptz not null default now(),
  first_source_as_of_at timestamptz,
  first_due_at_local timestamp without time zone,
  first_assigned_to text,
  first_place_name text,
  first_division_name text,
  first_region_name text,
  first_payload jsonb not null default '{}'::jsonb
);

create index if not exists locate_ma_sla_late_first_reported_idx
  on public.locate_massachusetts_sla_late_ticket(first_reported_at desc);

alter table public.locate_massachusetts_sla_late_ticket enable row level security;

-- Backfill any overdue tickets saved before the ledger existed. DISTINCT ON ensures
-- one permanent first-late identity per ticket even when older snapshots repeated it.
insert into public.locate_massachusetts_sla_late_ticket (
  ticket_id,
  first_reported_record_id,
  first_reported_at,
  first_source_as_of_at,
  first_due_at_local,
  first_assigned_to,
  first_place_name,
  first_division_name,
  first_region_name,
  first_payload
)
select distinct on (row.ticket_id)
  row.ticket_id,
  row.locate_reporting_record_id,
  row.created_at,
  record.source_as_of_at,
  row.due_at_local,
  row.assigned_to,
  row.place_name,
  row.division_name,
  row.region_name,
  row.raw_payload
from public.locate_massachusetts_sla_exposure_row row
join public.locate_reporting_record record
  on record.locate_reporting_record_id = row.locate_reporting_record_id
where row.risk_status = 'OVERDUE'
order by row.ticket_id, row.created_at asc
on conflict (ticket_id) do nothing;

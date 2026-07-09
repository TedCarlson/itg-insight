create table if not exists public.fuse_onboarding_import_batch (
  batch_id uuid primary key default gen_random_uuid(),
  uploaded_by_auth_user_id uuid null references public.user_profile(auth_user_id),
  filename text not null,
  sheet_name text null,
  worksheet_count integer not null default 0,
  row_count integer not null default 0,
  status text not null default 'INSPECTED',
  created_at timestamptz not null default now()
);

create table if not exists public.fuse_onboarding_import_row (
  row_id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.fuse_onboarding_import_batch(batch_id) on delete cascade,
  row_number integer not null,
  office_text text null,
  company_name text null,
  last_name text null,
  first_name text null,
  tech_id text null,
  personnel_id text null,
  row_date date null,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (batch_id, row_number)
);

create index if not exists fuse_onboarding_import_row_batch_idx
  on public.fuse_onboarding_import_row(batch_id);

create index if not exists fuse_onboarding_import_row_office_text_idx
  on public.fuse_onboarding_import_row(office_text);

create index if not exists fuse_onboarding_import_row_company_name_idx
  on public.fuse_onboarding_import_row(company_name);

create or replace view public.fuse_onboarding_latest_batch_v as
select distinct on (uploaded_by_auth_user_id)
  batch_id,
  uploaded_by_auth_user_id,
  filename,
  sheet_name,
  worksheet_count,
  row_count,
  status,
  created_at
from public.fuse_onboarding_import_batch
order by uploaded_by_auth_user_id, created_at desc;

create or replace view public.fuse_onboarding_import_row_v as
select
  b.batch_id,
  b.filename,
  b.uploaded_by_auth_user_id,
  b.created_at as uploaded_at,
  r.row_id,
  r.row_number,
  r.row_date,
  r.office_text,
  r.company_name,
  r.last_name,
  r.first_name,
  r.tech_id,
  r.personnel_id,
  r.raw
from public.fuse_onboarding_import_batch b
join public.fuse_onboarding_import_row r
  on r.batch_id = b.batch_id;

create or replace function public.fuse_onboarding_import_create_batch(
  p_uploaded_by_auth_user_id uuid,
  p_filename text,
  p_sheet_name text,
  p_worksheet_count integer,
  p_row_count integer,
  p_rows jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_id uuid;
  v_row jsonb;
  v_row_number integer := 0;
begin
  insert into public.fuse_onboarding_import_batch (
    uploaded_by_auth_user_id,
    filename,
    sheet_name,
    worksheet_count,
    row_count,
    status
  )
  values (
    p_uploaded_by_auth_user_id,
    p_filename,
    p_sheet_name,
    p_worksheet_count,
    p_row_count,
    'IMPORTED'
  )
  returning batch_id into v_batch_id;

  for v_row in
    select value from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
  loop
    v_row_number := v_row_number + 1;

    insert into public.fuse_onboarding_import_row (
      batch_id,
      row_number,
      office_text,
      company_name,
      last_name,
      first_name,
      tech_id,
      personnel_id,
      row_date,
      raw
    )
    values (
      v_batch_id,
      v_row_number,
      nullif(v_row->>'Office', ''),
      nullif(v_row->>'Company Name', ''),
      nullif(v_row->>'Last Name', ''),
      nullif(v_row->>'First Name', ''),
      nullif(v_row->>'Tech ID', ''),
      nullif(v_row->>'Personnel ID', ''),
      nullif(v_row->>'Date', '')::date,
      v_row
    );
  end loop;

  update public.fuse_onboarding_import_batch
  set row_count = v_row_number
  where batch_id = v_batch_id;

  return v_batch_id;
end;
$$;

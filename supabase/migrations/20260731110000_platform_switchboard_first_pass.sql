begin;

create schema if not exists platform;

create table if not exists platform.switchboard (
  id uuid primary key default gen_random_uuid(),

  library_key text not null unique,
  display_name text not null,

  current_schema text not null,
  current_object text not null,
  object_type text not null,

  status text not null default 'DISCOVERED',
  source text not null default 'LEGACY',

  notes text,

  discovered_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint platform_switchboard_library_key_check
    check (library_key ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),

  constraint platform_switchboard_status_check
    check (
      status in (
        'DISCOVERED',
        'DEFINED',
        'IMPLEMENTED',
        'ACTIVE',
        'RETIRED'
      )
    ),

  constraint platform_switchboard_source_check
    check (source in ('LEGACY', 'PLATFORM'))
);

comment on table platform.switchboard is
  'Governed registry of reusable concepts discovered in the existing database architecture. Nothing is added to Platform without a Switchboard record.';

comment on column platform.switchboard.library_key is
  'Permanent canonical identity reserved for the reusable Platform concept.';

comment on column platform.switchboard.current_schema is
  'Schema currently responsible for the discovered database object.';

comment on column platform.switchboard.current_object is
  'Current table, view, materialized view, function, or enum implementing the concept.';

comment on column platform.switchboard.source is
  'Current authoritative implementation. First-pass records remain LEGACY.';

create index if not exists platform_switchboard_status_idx
  on platform.switchboard (status);

create index if not exists platform_switchboard_source_idx
  on platform.switchboard (source);

create index if not exists platform_switchboard_current_object_idx
  on platform.switchboard (current_schema, current_object);

create or replace function platform.set_switchboard_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_platform_switchboard_updated_at
  on platform.switchboard;

create trigger set_platform_switchboard_updated_at
before update on platform.switchboard
for each row
execute function platform.set_switchboard_updated_at();

alter table platform.switchboard enable row level security;

revoke all on schema platform from public;
revoke all on platform.switchboard from public;
revoke all on platform.switchboard from anon;
revoke all on platform.switchboard from authenticated;

grant usage on schema platform to service_role;
grant all on platform.switchboard to service_role;

insert into platform.switchboard (
  library_key,
  display_name,
  current_schema,
  current_object,
  object_type,
  status,
  source,
  notes
)
select
  case
    when n.nspname = 'core' then
      'core.' || regexp_replace(c.relname, '[^a-z0-9]+', '_', 'g')
    when n.nspname = 'operations' then
      'operations.' || regexp_replace(c.relname, '[^a-z0-9]+', '_', 'g')
    when n.nspname = 'fleet' then
      'fleet.' || regexp_replace(c.relname, '[^a-z0-9]+', '_', 'g')
    when n.nspname = 'compliance' then
      'compliance.' || regexp_replace(c.relname, '[^a-z0-9]+', '_', 'g')
    when n.nspname = 'intelligence' then
      'intelligence.' || regexp_replace(c.relname, '[^a-z0-9]+', '_', 'g')
    when n.nspname = 'artifacts' then
      'artifacts.' || regexp_replace(c.relname, '[^a-z0-9]+', '_', 'g')
    when n.nspname = 'ref' then
      'reference.' || regexp_replace(c.relname, '[^a-z0-9]+', '_', 'g')
    else
      regexp_replace(n.nspname, '[^a-z0-9]+', '_', 'g')
      || '.'
      || regexp_replace(c.relname, '[^a-z0-9]+', '_', 'g')
  end as library_key,

  initcap(replace(c.relname, '_', ' ')) as display_name,
  n.nspname as current_schema,
  c.relname as current_object,

  case c.relkind
    when 'r' then 'TABLE'
    when 'p' then 'PARTITIONED_TABLE'
    when 'v' then 'VIEW'
    when 'm' then 'MATERIALIZED_VIEW'
    when 'f' then 'FOREIGN_TABLE'
    else 'RELATION'
  end as object_type,

  'DISCOVERED' as status,
  'LEGACY' as source,

  'Discovered from the active database schema during the initial Platform Switchboard inventory.'
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n
  on n.oid = c.relnamespace
where n.nspname in (
  'core',
  'operations',
  'fleet',
  'compliance',
  'intelligence',
  'artifacts',
  'ref'
)
and c.relkind in ('r', 'p', 'v', 'm', 'f')
and c.relname not like 'pg_%'
and c.relname not like '%_old'
and c.relname not like '%_backup'
on conflict (library_key) do nothing;

create or replace function public.get_platform_switchboard()
returns table (
  id uuid,
  library_key text,
  display_name text,
  current_schema text,
  current_object text,
  object_type text,
  status text,
  source text,
  notes text,
  discovered_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not coalesce(core.is_platform_owner(), false) then
    raise exception 'Platform owner access required';
  end if;

  return query
  select
    s.id,
    s.library_key,
    s.display_name,
    s.current_schema,
    s.current_object,
    s.object_type,
    s.status,
    s.source,
    s.notes,
    s.discovered_at,
    s.updated_at
  from platform.switchboard s
  order by
    s.current_schema,
    s.current_object;
end;
$$;

revoke all on function public.get_platform_switchboard() from public;
revoke all on function public.get_platform_switchboard() from anon;
grant execute on function public.get_platform_switchboard() to authenticated;
grant execute on function public.get_platform_switchboard() to service_role;

commit;

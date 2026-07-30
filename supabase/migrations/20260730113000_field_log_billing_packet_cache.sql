insert into storage.buckets (id, name, public, allowed_mime_types)
values (
  'field-log-billing-packets',
  'field-log-billing-packets',
  false,
  array['application/pdf']::text[]
)
on conflict (id) do update
set
  public = false,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.field_log_billing_packet_cache (
  report_id uuid primary key references public.field_log_report(report_id) on delete cascade,
  category_key text not null,
  source_updated_at timestamptz not null,
  storage_bucket text not null default 'field-log-billing-packets',
  storage_path text not null,
  packet_filename text not null,
  packet_sha256 text not null,
  packet_size_bytes bigint not null check (packet_size_bytes > 0),
  generated_at timestamptz not null default now(),
  generated_by_user_id uuid,
  generation_count integer not null default 1 check (generation_count > 0)
);

create unique index if not exists field_log_billing_packet_cache_storage_object_idx
  on public.field_log_billing_packet_cache(storage_bucket, storage_path);

alter table public.field_log_billing_packet_cache enable row level security;

revoke all on table public.field_log_billing_packet_cache from public, anon, authenticated;
grant all on table public.field_log_billing_packet_cache to service_role;

alter table public.field_log_billing_email_log
  add column if not exists packet_size_bytes bigint,
  add column if not exists packet_cache_hit boolean;

comment on table public.field_log_billing_packet_cache is
  'Private immutable billing PDF metadata. A cache entry is valid only when source_updated_at matches field_log_report.updated_at.';

comment on column public.field_log_billing_packet_cache.packet_size_bytes is
  'Exact cached PDF size used to measure attachment-related storage egress.';

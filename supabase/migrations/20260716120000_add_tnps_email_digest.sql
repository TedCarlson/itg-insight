create table if not exists public.field_log_tnps_email_digest (
  digest_id uuid primary key default gen_random_uuid(),
  pc_org_id uuid not null references public.pc_org(pc_org_id) on delete cascade,
  send_mode text not null check (send_mode in ('manual', 'scheduled')),
  status text not null default 'draft' check (status in ('draft', 'pending', 'sent', 'failed')),
  window_start timestamptz,
  window_end timestamptz not null default now(),
  subject text not null,
  to_emails text[] not null default '{}',
  html_body text not null,
  text_body text not null,
  requested_by_user_id uuid references auth.users(id) on delete set null,
  requested_by_email text,
  requested_at timestamptz not null default now(),
  sent_at timestamptz,
  provider_message_id text,
  error_message text
);

create table if not exists public.field_log_tnps_email_digest_item (
  digest_item_id uuid primary key default gen_random_uuid(),
  digest_id uuid not null references public.field_log_tnps_email_digest(digest_id) on delete cascade,
  report_id uuid not null references public.field_log_report(report_id) on delete restrict,
  report_updated_at timestamptz not null,
  record_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  unique (digest_id, report_id)
);

create table if not exists public.field_log_tnps_email_recipient (
  recipient_id uuid primary key default gen_random_uuid(),
  pc_org_id uuid not null references public.pc_org(pc_org_id) on delete cascade,
  email text not null,
  enabled boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  created_by_user_id uuid references auth.users(id) on delete set null,
  unique (pc_org_id, email)
);

create index if not exists field_log_tnps_digest_org_sent_idx
  on public.field_log_tnps_email_digest (pc_org_id, sent_at desc)
  where status = 'sent';

create index if not exists field_log_tnps_digest_item_report_idx
  on public.field_log_tnps_email_digest_item (report_id, created_at desc);

alter table public.field_log_tnps_email_digest enable row level security;
alter table public.field_log_tnps_email_digest_item enable row level security;
alter table public.field_log_tnps_email_recipient enable row level security;

comment on table public.field_log_tnps_email_digest is
  'Immutable rendered tNPS email attempts for manual review and scheduled delivery.';
comment on column public.field_log_tnps_email_digest_item.report_updated_at is
  'Case watermark captured in the email; a newer report updated_at means Updated since email.';

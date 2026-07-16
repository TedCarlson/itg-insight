alter table public.field_log_tnps_email_digest
  drop constraint if exists field_log_tnps_email_digest_send_mode_check;

alter table public.field_log_tnps_email_digest
  add constraint field_log_tnps_email_digest_send_mode_check
  check (send_mode in ('test', 'manual', 'scheduled'));

-- Security step 2: password_setup_code is server-only.
--
-- The code request and confirm routes (apps/web/src/app/api/auth/code/*) are the only
-- readers and writers, and both use the service role, which bypasses RLS. Signed-in
-- users had no reason to read this table.
--
-- Function preserved: service_role keeps ALL; no view, function or policy references
-- the table. Rollback: supabase/security/step2_rollback.sql.

alter table public.password_setup_code enable row level security;
revoke all on table public.password_setup_code from anon, authenticated;

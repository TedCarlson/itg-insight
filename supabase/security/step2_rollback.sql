-- Rolls back security step 2 to the prior state: RLS off, SELECT granted to authenticated.
-- Run only on Ted's call: this re-exposes password setup codes to every signed-in user.
begin;
alter table public.password_setup_code disable row level security;
grant select on table public.password_setup_code to authenticated;
commit;

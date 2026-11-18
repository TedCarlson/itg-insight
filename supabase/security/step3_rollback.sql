-- Rolls back security step 3 to the prior state: RLS off; signed-in users get
-- SELECT/INSERT/UPDATE/DELETE on all three tables (as before).
-- Run only on Ted's call: this re-opens writes to every signed-in user.
begin;

drop policy if exists shift_validation_batch_select_accessible_org on public.shift_validation_batch;
drop policy if exists shift_validation_row_select_accessible_org on public.shift_validation_row;

alter table public.schedule disable row level security;
alter table public.shift_validation_batch disable row level security;
alter table public.shift_validation_row disable row level security;

grant select, insert, update, delete on table public.schedule to authenticated;
grant select, insert, update, delete on table public.shift_validation_batch to authenticated;
grant select, insert, update, delete on table public.shift_validation_row to authenticated;

drop function if exists api.current_user_pc_org_ids();

commit;

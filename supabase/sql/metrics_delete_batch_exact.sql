create or replace function public.metrics_delete_batch_exact(
  p_metric_batch_id uuid,
  p_pc_org_id uuid
)
returns table (
  metric_batch_id uuid,
  deleted_score_rows integer,
  deleted_work_mix_rows integer,
  deleted_ownership_rows integer,
  deleted_metric_rows integer,
  deleted_batches integer
)
language plpgsql
security definer
set search_path = public, core
as $$
declare
  v_batch_exists boolean;
  v_score_count integer := 0;
  v_work_mix_count integer := 0;
  v_ownership_count integer := 0;
  v_metric_rows_count integer := 0;
  v_batch_count integer := 0;
begin
  select exists (
    select 1
    from core.metric_batches mb
    where mb.metric_batch_id = p_metric_batch_id
      and mb.pc_org_id = p_pc_org_id
  ) into v_batch_exists;

  if not v_batch_exists then
    raise exception 'metrics batch not found for selected org'
      using errcode = 'P0002';
  end if;

  delete from core.metric_scores_fact
  where metric_scores_fact.metric_batch_id = p_metric_batch_id;
  get diagnostics v_score_count = row_count;

  delete from core.metric_work_mix_fact
  where metric_work_mix_fact.metric_batch_id = p_metric_batch_id;
  get diagnostics v_work_mix_count = row_count;

  delete from core.metric_ownership_fact
  where metric_ownership_fact.metric_batch_id = p_metric_batch_id;
  get diagnostics v_ownership_count = row_count;

  delete from core.metric_rows
  where metric_rows.metric_batch_id = p_metric_batch_id;
  get diagnostics v_metric_rows_count = row_count;

  delete from core.metric_batches
  where metric_batches.metric_batch_id = p_metric_batch_id
    and metric_batches.pc_org_id = p_pc_org_id;
  get diagnostics v_batch_count = row_count;

  return query select
    p_metric_batch_id,
    v_score_count,
    v_work_mix_count,
    v_ownership_count,
    v_metric_rows_count,
    v_batch_count;
end;
$$;

grant execute on function public.metrics_delete_batch_exact(uuid, uuid) to authenticated;

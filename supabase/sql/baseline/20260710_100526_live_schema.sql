--
-- PostgreSQL database dump
--

\restrict ns63T16wJF3ZDB5QDXkgfkNoEXEFiLzt0ljCWyHEA1foxU4EvYestWYQ6Kq3jk9

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: core; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA core;


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: assignment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assignment (
    assignment_id uuid DEFAULT gen_random_uuid() NOT NULL,
    person_id uuid NOT NULL,
    pc_org_id uuid NOT NULL,
    tech_id text,
    start_date date NOT NULL,
    end_date date,
    position_title text,
    active boolean,
    office_id uuid
);


--
-- Name: person_pc_org; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.person_pc_org (
    person_pc_org_id uuid DEFAULT gen_random_uuid() NOT NULL,
    person_id uuid NOT NULL,
    pc_org_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    start_date date,
    end_date date,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT person_pc_org_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'inactive'::text])))
);


--
-- Name: person; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.person (
    person_id uuid DEFAULT gen_random_uuid() NOT NULL,
    full_name text NOT NULL,
    emails text,
    mobile text,
    fuse_emp_id text,
    person_notes text,
    person_nt_login text,
    person_csg_id text,
    active boolean DEFAULT true NOT NULL,
    role text,
    co_ref_id uuid,
    co_code text,
    tech_id text,
    CONSTRAINT person_role_check CHECK (((role = ANY (ARRAY['Hires'::text, 'Contractors'::text])) OR (role = ANY ('{Director,Leadership}'::text[]))))
);


--
-- Name: COLUMN person.co_ref_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.person.co_ref_id IS 'UI-governed reference token to company or contractor. No FK by design. Used for dropdown selection only.';


--
-- Name: COLUMN person.co_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.person.co_code IS 'System-generated code/label derived from selected company or contractor via UI. Read-only. No FK by design.';


--
-- Name: ensure_app_user_person(); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.ensure_app_user_person() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  v_person_id uuid;
begin
  if new.person_id is not null then
    return new;
  end if;

  insert into core.people (
    full_name
  )
  values (
    coalesce(nullif(trim(new.display_name), ''), nullif(trim(new.primary_email), ''), 'New Person')
  )
  returning person_id into v_person_id;

  new.person_id := v_person_id;
  return new;
end;
$$;


--
-- Name: log_activity(uuid, uuid, text, uuid, text, jsonb, jsonb, jsonb); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.log_activity(p_workspace_id uuid, p_actor_app_user_id uuid, p_entity_type text, p_entity_id uuid, p_action text, p_old jsonb, p_new jsonb, p_context jsonb DEFAULT NULL::jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
begin
  insert into core.activity_logs (
    workspace_id,
    actor_app_user_id,
    entity_type,
    entity_id,
    action,
    old_values,
    new_values,
    context
  )
  values (
    p_workspace_id,
    p_actor_app_user_id,
    p_entity_type,
    p_entity_id,
    p_action,
    p_old,
    p_new,
    p_context
  );
end;
$$;


--
-- Name: log_metric_batch_event(uuid, uuid, text, jsonb); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.log_metric_batch_event(p_metric_batch_id uuid, p_actor_app_user_id uuid, p_event_type text, p_details jsonb DEFAULT NULL::jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
declare
  v_core_batch_id uuid;
begin
  -- Try direct core batch id first
  select mb.metric_batch_id
  into v_core_batch_id
  from core.metric_batches mb
  where mb.metric_batch_id = p_metric_batch_id
  limit 1;

  -- If not found, try legacy batch id bridge
  if v_core_batch_id is null then
    select mb.metric_batch_id
    into v_core_batch_id
    from core.metric_batches mb
    where mb.legacy_batch_id = p_metric_batch_id
    limit 1;
  end if;

  insert into core.metric_batch_events (
    metric_batch_id,
    legacy_batch_id,
    actor_app_user_id,
    event_type,
    details
  )
  values (
    v_core_batch_id,
    case when v_core_batch_id is null then p_metric_batch_id else null end,
    p_actor_app_user_id,
    p_event_type,
    p_details
  );
end;
$$;


--
-- Name: metric_prepare_batch_for_ui(uuid); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.metric_prepare_batch_for_ui(p_metric_batch_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
begin
  perform core.sync_metrics_class_config_to_profiles();
  perform core.metric_rebuild_facts_for_batch(p_metric_batch_id);
  perform core.rebuild_metric_scores_fact(p_metric_batch_id);
  perform core.metric_write_pc_org_total_row(p_metric_batch_id);
end;
$$;


--
-- Name: metric_rebuild_composites_for_batch(uuid); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.metric_rebuild_composites_for_batch(p_batch_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
begin
  perform core.metric_prepare_batch_for_ui(p_batch_id);
end;
$$;


--
-- Name: metric_rebuild_facts_for_batch(uuid); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.metric_rebuild_facts_for_batch(p_metric_batch_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
declare
begin
  -- start event
  insert into core.metric_batch_events (
    metric_batch_id,
    event_type,
    details
  )
  values (
    p_metric_batch_id,
    'facts_started',
    jsonb_build_object(
      'source', 'core.metric_rebuild_facts_for_batch'
    )
  );

  -- delete existing facts for batch
  delete from core.metric_facts
  where metric_batch_id = p_metric_batch_id;

  -- rebuild facts
  insert into core.metric_facts (
    metric_batch_id,
    workspace_id,
    tech_id,
    metric_key,
    numerator,
    denominator,
    metric_value,
    metric_date,
    fiscal_end_date
  )
  select
    v.metric_batch_id,
    v.workspace_id,
    v.tech_id,
    k.metric_key,

    -- numerator
    case k.metric_key
      when 'tnps_score' then (v.promoters - v.detractors)
      when 'ftr_rate' then (v.total_ftr_contact_jobs - v.ftr_fail_jobs)
      when 'tool_usage_rate' then v.tu_result
      when 'contact_48hr_rate' then v.contact_48hr_orders
      when 'pht_pure_pass_rate' then v.pht_pure_pass
      when 'met_rate' then v.total_met_appts
      when 'repeat_rate' then v.repeat_count
      when 'rework_rate' then v.rework_count
      when 'soi_rate' then v.soi_count
    end as numerator,

    -- denominator
    case k.metric_key
      when 'tnps_score' then v.tnps_surveys
      when 'ftr_rate' then v.total_ftr_contact_jobs
      when 'tool_usage_rate' then v.tu_eligible_jobs
      when 'contact_48hr_rate' then (v.installs + v.tcs)
      when 'pht_pure_pass_rate' then v.pht_jobs
      when 'met_rate' then v.total_appts
      when 'repeat_rate' then v.tcs
      when 'rework_rate' then (v.installs + v.tcs)
      when 'soi_rate' then v.installs
    end as denominator,

    -- metric_value
    case
      when
        case k.metric_key
          when 'tnps_score' then v.tnps_surveys
          when 'ftr_rate' then v.total_ftr_contact_jobs
          when 'tool_usage_rate' then v.tu_eligible_jobs
          when 'contact_48hr_rate' then (v.installs + v.tcs)
          when 'pht_pure_pass_rate' then v.pht_jobs
          when 'met_rate' then v.total_appts
          when 'repeat_rate' then v.tcs
          when 'rework_rate' then (v.installs + v.tcs)
          when 'soi_rate' then v.installs
        end = 0
      then 0
      else
        (
          case k.metric_key
            when 'tnps_score' then (v.promoters - v.detractors)
            when 'ftr_rate' then (v.total_ftr_contact_jobs - v.ftr_fail_jobs)
            when 'tool_usage_rate' then v.tu_result
            when 'contact_48hr_rate' then v.contact_48hr_orders
            when 'pht_pure_pass_rate' then v.pht_pure_pass
            when 'met_rate' then v.total_met_appts
            when 'repeat_rate' then v.repeat_count
            when 'rework_rate' then v.rework_count
            when 'soi_rate' then v.soi_count
          end
          /
          nullif(
            case k.metric_key
              when 'tnps_score' then v.tnps_surveys
              when 'ftr_rate' then v.total_ftr_contact_jobs
              when 'tool_usage_rate' then v.tu_eligible_jobs
              when 'contact_48hr_rate' then (v.installs + v.tcs)
              when 'pht_pure_pass_rate' then v.pht_jobs
              when 'met_rate' then v.total_appts
              when 'repeat_rate' then v.tcs
              when 'rework_rate' then (v.installs + v.tcs)
              when 'soi_rate' then v.installs
            end,
            0
          )
        ) * 100
    end as metric_value,

    v.metric_date,
    v.fiscal_end_date

  from (
    select
      r.metric_batch_id,
      b.workspace_id,
      r.reported_tech_id as tech_id,
      b.metric_date,
      b.fiscal_end_date,

      coalesce((r.raw_payload ->> 'Promoters')::numeric, 0) as promoters,
      coalesce((r.raw_payload ->> 'Detractors')::numeric, 0) as detractors,
      coalesce((r.raw_payload ->> 'tNPS Surveys')::numeric, 0) as tnps_surveys,

      coalesce((r.raw_payload ->> 'FTRFailJobs')::numeric, 0) as ftr_fail_jobs,
      coalesce((r.raw_payload ->> 'Total FTR/Contact Jobs')::numeric, 0) as total_ftr_contact_jobs,

      coalesce((r.raw_payload ->> 'TUResult')::numeric, 0) as tu_result,
      coalesce((r.raw_payload ->> 'TUEligibleJobs')::numeric, 0) as tu_eligible_jobs,

      coalesce((r.raw_payload ->> '48Hr Contact Orders')::numeric, 0) as contact_48hr_orders,

      coalesce((r.raw_payload ->> 'PHT Jobs')::numeric, 0) as pht_jobs,
      coalesce((r.raw_payload ->> 'PHT Pure Pass')::numeric, 0) as pht_pure_pass,

      coalesce((r.raw_payload ->> 'TotalAppts')::numeric, 0) as total_appts,
      coalesce((r.raw_payload ->> 'TotalMetAppts')::numeric, 0) as total_met_appts,

      coalesce((r.raw_payload ->> 'Repeat Count')::numeric, 0) as repeat_count,
      coalesce((r.raw_payload ->> 'Rework Count')::numeric, 0) as rework_count,
      coalesce((r.raw_payload ->> 'SOI Count')::numeric, 0) as soi_count,

      coalesce((r.raw_payload ->> 'Installs')::numeric, 0) as installs,
      coalesce((r.raw_payload ->> 'TCs')::numeric, 0) as tcs

    from core.metric_rows r
    join core.metric_batches b
      on b.metric_batch_id = r.metric_batch_id
    where r.metric_batch_id = p_metric_batch_id
      and r.reported_tech_id not ilike '%total%'
  ) v
  cross join (
    values
      ('tnps_score'),
      ('ftr_rate'),
      ('tool_usage_rate'),
      ('contact_48hr_rate'),
      ('pht_pure_pass_rate'),
      ('met_rate'),
      ('repeat_rate'),
      ('rework_rate'),
      ('soi_rate')
  ) as k(metric_key);

  -- completion event
  insert into core.metric_batch_events (
    metric_batch_id,
    event_type,
    details
  )
  values (
    p_metric_batch_id,
    'facts_completed',
    jsonb_build_object(
      'metric_count', 9
    )
  );

exception
  when others then
    insert into core.metric_batch_events (
      metric_batch_id,
      event_type,
      details
    )
    values (
      p_metric_batch_id,
      'facts_failed',
      jsonb_build_object(
        'error', sqlerrm
      )
    );
    raise;
end;
$$;


--
-- Name: metric_write_pc_org_total_row(uuid); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.metric_write_pc_org_total_row(p_metric_batch_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
declare
  v_batch record;
begin
  select
    b.metric_batch_id,
    b.workspace_id,
    w.legacy_pc_org_id as pc_org_id,
    b.metric_date,
    b.fiscal_end_date
  into v_batch
  from core.metric_batches b
  join core.workspaces w
    on w.workspace_id = b.workspace_id
  where b.metric_batch_id = p_metric_batch_id;

  if v_batch.metric_batch_id is null then
    raise exception 'Metric batch not found: %', p_metric_batch_id;
  end if;

  if v_batch.pc_org_id is null then
    raise exception 'Workspace has no legacy_pc_org_id for metric batch: %', p_metric_batch_id;
  end if;

  delete from public.metrics_raw_total_row
  where batch_id = p_metric_batch_id
    and summary_type = 'pc_org_total';

  insert into public.metrics_raw_total_row (
    batch_id,
    pc_org_id,
    metric_date,
    fiscal_end_date,
    summary_type,
    summary_key,
    summary_label,
    unique_row_key,
    raw
  )
  select
    p_metric_batch_id,
    v_batch.pc_org_id,
    v_batch.metric_date,
    v_batch.fiscal_end_date,
    'pc_org_total',
    v_batch.pc_org_id::text,
    'Org Total',
    concat(p_metric_batch_id::text, ':pc_org_total:', v_batch.pc_org_id::text),
    jsonb_build_object(
      'TechId', 'Keystone Totals',

      'Promoters', coalesce(sum(promoters), 0),
      'Detractors', coalesce(sum(detractors), 0),
      'tNPS Surveys', coalesce(sum(tnps_surveys), 0),
      'tNPS Rate',
        case when coalesce(sum(tnps_surveys), 0) = 0 then 0
        else ((coalesce(sum(promoters), 0) - coalesce(sum(detractors), 0)) / nullif(sum(tnps_surveys), 0)) * 100 end,

      'Total FTR/Contact Jobs', coalesce(sum(total_ftr_contact_jobs), 0),
      'FTRFailJobs', coalesce(sum(ftr_fail_jobs), 0),
      'FTR%',
        case when coalesce(sum(total_ftr_contact_jobs), 0) = 0 then 0
        else ((coalesce(sum(total_ftr_contact_jobs), 0) - coalesce(sum(ftr_fail_jobs), 0)) / nullif(sum(total_ftr_contact_jobs), 0)) * 100 end,

      'TUEligibleJobs', coalesce(sum(tu_eligible_jobs), 0),
      'TUResult', coalesce(sum(tu_result), 0),
      'ToolUsage',
        case when coalesce(sum(tu_eligible_jobs), 0) = 0 then 0
        else (coalesce(sum(tu_result), 0) / nullif(sum(tu_eligible_jobs), 0)) * 100 end,

      '48Hr Contact Orders', coalesce(sum(contact_48hr_orders), 0),
      '48Hr Contact Rate%',
        case when (coalesce(sum(installs), 0) + coalesce(sum(tcs), 0)) = 0 then 0
        else (coalesce(sum(contact_48hr_orders), 0) / nullif(coalesce(sum(installs), 0) + coalesce(sum(tcs), 0), 0)) * 100 end,

      'PHT Jobs', coalesce(sum(pht_jobs), 0),
      'PHT Pure Pass', coalesce(sum(pht_pure_pass), 0),
      'PHT Pure Pass%',
        case when coalesce(sum(pht_jobs), 0) = 0 then 0
        else (coalesce(sum(pht_pure_pass), 0) / nullif(sum(pht_jobs), 0)) * 100 end,

      'TotalAppts', coalesce(sum(total_appts), 0),
      'TotalMetAppts', coalesce(sum(total_met_appts), 0),
      'MetRate',
        case when coalesce(sum(total_appts), 0) = 0 then 0
        else (coalesce(sum(total_met_appts), 0) / nullif(sum(total_appts), 0)) * 100 end,

      'Repeat Count', coalesce(sum(repeat_count), 0),
      'TCs', coalesce(sum(tcs), 0),
      'Repeat Rate%',
        case when coalesce(sum(tcs), 0) = 0 then 0
        else (coalesce(sum(repeat_count), 0) / nullif(sum(tcs), 0)) * 100 end,

      'Rework Count', coalesce(sum(rework_count), 0),
      'Rework Rate%',
        case when (coalesce(sum(installs), 0) + coalesce(sum(tcs), 0)) = 0 then 0
        else (coalesce(sum(rework_count), 0) / nullif(coalesce(sum(installs), 0) + coalesce(sum(tcs), 0), 0)) * 100 end,

      'SOI Count', coalesce(sum(soi_count), 0),
      'Installs', coalesce(sum(installs), 0),
      'SOI Rate%',
        case when coalesce(sum(installs), 0) = 0 then 0
        else (coalesce(sum(soi_count), 0) / nullif(sum(installs), 0)) * 100 end,

      'SROs', coalesce(sum(sros), 0),
      'Total Jobs', coalesce(sum(total_jobs), 0)
    )
  from core.metric_payload_flat_v
  where metric_batch_id = p_metric_batch_id;
end;
$$;


--
-- Name: normalize_person_identifier_type(); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.normalize_person_identifier_type() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.identifier_type :=
    case upper(trim(new.identifier_type))
      when 'TECH #' then 'TECH_ID'
      when 'TECH' then 'TECH_ID'
      when 'TECH_ID' then 'TECH_ID'

      when 'BPID' then 'FUSE_EMP_ID'
      when 'FUSE_EMP_ID' then 'FUSE_EMP_ID'

      when 'CSG USER NAME' then 'NT_LOGIN'
      when 'CSG USERNAME' then 'NT_LOGIN'
      when 'NT_LOGIN' then 'NT_LOGIN'

      when 'CSG' then 'CSG_ID'
      when 'CSG OPID' then 'CSG_ID'
      when 'CSG_ID' then 'CSG_ID'

      else upper(trim(new.identifier_type))
    end;

  return new;
end;
$$;


--
-- Name: rebuild_metric_scores_fact(uuid); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.rebuild_metric_scores_fact(p_metric_batch_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
begin

  -- clear existing batch
  delete from core.metric_scores_fact
  where metric_batch_id = p_metric_batch_id;

  insert into core.metric_scores_fact (
    metric_batch_id,
    workspace_id,
    metric_date,
    fiscal_end_date,
    tech_id,

    profile_key,
    profile_label,
    metric_profile_id,
    metric_profile_rule_id,

    metric_key,
    display_label,
    weight,
    sort_order,
    report_order,
    is_tiebreaker,
    is_visible,
    no_data_behavior,
    direction,
    unit,

    numerator,
    denominator,
    metric_value,

    band_key,
    normalized_value,
    weighted_points,

    is_rank_eligible,
    eligibility_reason
  )
  with payload as (
    select *
    from core.metric_payload_flat_v
    where metric_batch_id = p_metric_batch_id
  ),
  eligible as (
    select *
    from core.metric_rank_eligibility_v
    where metric_batch_id = p_metric_batch_id
      and row_kind = 'TECH'
  ),
  profile_kpis as (
    select *
    from core.metric_profile_kpis_v
    where profile_is_active = true
      and metric_is_active = true
      and is_enabled = true
  ),
  joined as (
    select
      p.metric_batch_id,
      p.workspace_id,
      p.metric_date,
      p.fiscal_end_date,
      p.tech_id,

      pk.profile_key,
      pk.profile_label,
      pk.metric_profile_id,
      pk.metric_profile_rule_id,

      pk.metric_key,
      pk.display_label,
      pk.weight,
      pk.sort_order,
      pk.report_order,
      pk.is_tiebreaker,
      pk.is_visible,
      pk.no_data_behavior,
      pk.direction,
      pk.unit,
      pk.rubric_json,

      e.is_rank_eligible,
      e.eligibility_reason,

      -- numerator
      case pk.metric_key
        when 'tnps_score' then p.promoters
        when 'ftr_rate' then p.total_ftr_contact_jobs - p.ftr_fail_jobs
        when 'tool_usage_rate' then p.tu_result
        when 'contact_48hr_rate' then p.contact_48hr_orders
        when 'pht_pure_pass_rate' then p.pht_pure_pass
        when 'met_rate' then p.total_met_appts
        when 'repeat_rate' then p.repeat_count
        when 'rework_rate' then p.rework_count
        when 'soi_rate' then p.soi_count
        else null
      end as numerator,

      -- denominator
      case pk.metric_key
        when 'tnps_score' then p.tnps_surveys
        when 'ftr_rate' then p.total_ftr_contact_jobs
        when 'tool_usage_rate' then p.tu_eligible_jobs
        when 'contact_48hr_rate' then p.installs + p.tcs
        when 'pht_pure_pass_rate' then p.pht_jobs
        when 'met_rate' then p.total_appts
        when 'repeat_rate' then p.tcs
        when 'rework_rate' then p.installs + p.tcs
        when 'soi_rate' then p.installs
        else null
      end as denominator,

      -- VALUE FROM TPR (NO RECOMPUTE)
      case pk.metric_key
        when 'tnps_score' then p.tnps_score
        when 'ftr_rate' then p.ftr_rate
        when 'tool_usage_rate' then p.tool_usage_rate
        when 'contact_48hr_rate' then p.contact_48hr_rate
        when 'pht_pure_pass_rate' then p.pht_pure_pass_rate
        when 'met_rate' then p.met_rate
        when 'repeat_rate' then p.repeat_rate
        when 'rework_rate' then p.rework_rate
        when 'soi_rate' then p.soi_rate
        else null
      end as metric_value

    from payload p
    join eligible e
      on e.metric_batch_id = p.metric_batch_id
     and e.tech_id = p.tech_id
    join profile_kpis pk
      on true
  ),
  banded as (
    select
      j.*,
      rb.band_key
    from joined j
    left join lateral (
      select x.band_key
      from jsonb_to_recordset(j.rubric_json) as x(
        band_key text,
        min numeric,
        max numeric,
        score numeric
      )
      where (
        coalesce(j.denominator,0)=0 and x.band_key='NO_DATA'
      )
      or (
        coalesce(j.denominator,0)<>0
        and x.band_key<>'NO_DATA'
        and j.metric_value >= coalesce(x.min,j.metric_value)
        and j.metric_value <= coalesce(x.max,j.metric_value)
      )
      limit 1
    ) rb on true
  )
  select
    metric_batch_id,
    workspace_id,
    metric_date,
    fiscal_end_date,
    tech_id,

    profile_key,
    profile_label,
    metric_profile_id,
    metric_profile_rule_id,

    metric_key,
    display_label,
    weight,
    sort_order,
    report_order,
    is_tiebreaker,
    is_visible,
    no_data_behavior,
    direction,
    unit,

    numerator,
    denominator,
    metric_value,

    band_key,

    -- normalized
    case
      when coalesce(denominator,0)=0 then 0
      when metric_key='tnps_score' then greatest(0,least(1,(metric_value+100)/200))
      when direction='LOWER_BETTER' then greatest(0,least(1,(100-metric_value)/100))
      else greatest(0,least(1,metric_value/100))
    end,

    -- weighted
    case
      when coalesce(denominator,0)=0 then 0
      when metric_key='tnps_score' then greatest(0,least(1,(metric_value+100)/200))*weight
      when direction='LOWER_BETTER' then greatest(0,least(1,(100-metric_value)/100))*weight
      else greatest(0,least(1,metric_value/100))*weight
    end,

    is_rank_eligible,
    eligibility_reason

  from banded;

end;
$$;


--
-- Name: safe_metric_numeric(text); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.safe_metric_numeric(p_text text) RETURNS numeric
    LANGUAGE sql IMMUTABLE
    AS $_$
  select
    case
      when p_text is null then null
      when btrim(p_text) = '' then null
      when btrim(p_text) in ('∞', '+∞', '-∞', 'Infinity', '+Infinity', '-Infinity', 'NaN') then null
      when btrim(p_text) ~ '^-?[0-9]+(\.[0-9]+)?$' then btrim(p_text)::numeric
      else null
    end
$_$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


--
-- Name: sync_assignment_identity(); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.sync_assignment_identity() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  -- update assignments when identity changes
  update core.assignments a
  set tech_id = (
    select max(pi.identifier_value)
    from core.person_identifiers pi
    where pi.person_id = new.person_id
      and pi.identifier_type = 'TECH_ID'
  )
  where a.person_id = new.person_id;

  return new;
end;
$$;


--
-- Name: sync_metrics_class_config_to_profiles(); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.sync_metrics_class_config_to_profiles() RETURNS void
    LANGUAGE plpgsql
    AS $$
begin
  delete from core.metric_profile_rules;

  insert into core.metric_profile_rules (
    metric_profile_id,
    metric_key,
    weight,
    sort_order,
    report_order,
    is_enabled,
    is_visible,
    is_tiebreaker,
    display_label
  )
  select
    mp.metric_profile_id,
    m.kpi_key as metric_key,
    coalesce(m.weight, 0),
    coalesce(m.sort_order, 999),
    coalesce(m.sort_order, 999),
    coalesce(m.enabled, false),
    coalesce(m.report_visible, true),
    coalesce(m.is_tiebreaker, false),
    coalesce(m.display_label, m.kpi_key)
  from public.metrics_class_kpi_config m
  join core.metric_profiles mp
    on mp.profile_key = case
      when m.class_type = 'P4P' then 'NSR'
      when m.class_type = 'SMART' then 'SMART'
      else null
    end
  where m.class_type in ('P4P', 'SMART');
end;
$$;


--
-- Name: _schema_touch(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._schema_touch() RETURNS void
    LANGUAGE sql
    AS $$
  select;
$$;


--
-- Name: _touch_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: add_to_roster(uuid, uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_to_roster(pc_org_id uuid, person_id uuid, start_date date) RETURNS uuid
    LANGUAGE sql
    AS $$
  select r.o_pc_org_id
  from api.add_to_roster(pc_org_id, person_id, start_date) as r
  limit 1;
$$;


--
-- Name: admin_set_person_prospecting_affiliation(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_set_person_prospecting_affiliation(p_person_id uuid, p_affiliation_id uuid, p_actor_auth_user_id uuid) RETURNS TABLE(person_id uuid, prospecting_affiliation_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'core'
    AS $$
declare
  v_actor_app_user_id uuid;
begin
  select au.app_user_id
    into v_actor_app_user_id
  from core.app_users au
  where au.auth_user_id = p_actor_auth_user_id
  limit 1;

  update core.people p
     set prospecting_affiliation_id = p_affiliation_id,
         updated_at = now(),
         updated_by_app_user_id = v_actor_app_user_id
   where p.person_id = p_person_id;

  return query
  select p.person_id, p.prospecting_affiliation_id
  from core.people p
  where p.person_id = p_person_id;
end;
$$;


--
-- Name: assignment_end_previous_active(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assignment_end_previous_active() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'api'
    AS $$
declare
  v_end_date date;
begin
  -- Only run for "active" inserts (active true/null) with no end_date
  if new.person_id is null or new.pc_org_id is null then
    return new;
  end if;

  if coalesce(new.active, true) = false then
    return new;
  end if;

  if new.end_date is not null then
    return new;
  end if;

  -- End previous assignment the day before the new start_date (unless start_date is in the future)
  v_end_date := case
    when new.start_date > current_date then current_date
    else (new.start_date - 1)
  end;

  update public.assignment
  set end_date = v_end_date,
      active = false
  where person_id = new.person_id
    and pc_org_id = new.pc_org_id
    and assignment_id <> new.assignment_id
    and end_date is null
    and coalesce(active, true) = true;

  return new;
end;
$$;


--
-- Name: assignment_patch(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assignment_patch(p_assignment_id uuid, p_patch jsonb) RETURNS public.assignment
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'api'
    AS $$
declare
  v_assignment public.assignment;
  v_pc_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  if p_assignment_id is null then
    raise exception 'assignment_id is required';
  end if;

  -- Lock and fetch current assignment
  select *
    into v_assignment
  from public.assignment a
  where a.assignment_id = p_assignment_id
  for update;

  if v_assignment.assignment_id is null then
    raise exception 'Assignment not found';
  end if;

  v_pc_org_id := v_assignment.pc_org_id;

  -- Permission gate: app owner OR roster_manage on this org edge
  if not (api.is_app_owner() or api.has_pc_org_permission(v_pc_org_id, 'roster_manage')) then
    raise exception 'Forbidden';
  end if;

  -- Non-destructive patch: only provided keys are applied
  update public.assignment
  set
      -- tech_id is TEXT (do not cast to uuid)
      tech_id = case
        when p_patch ? 'tech_id' then nullif(p_patch->>'tech_id','')
        else tech_id
      end,

      start_date = coalesce((p_patch->>'start_date')::date, start_date),

      end_date = case
        when p_patch ? 'end_date' then nullif(p_patch->>'end_date','')::date
        else end_date
      end,

      position_title = case
        when p_patch ? 'position_title' then nullif(p_patch->>'position_title','')
        else position_title
      end,

      active = case
        when p_patch ? 'active' then (p_patch->>'active')::boolean
        else active
      end,

      -- NEW: office_id FK (uuid) — allow explicit nulling
      office_id = case
        when p_patch ? 'office_id' then nullif(p_patch->>'office_id','')::uuid
        else office_id
      end

  where assignment_id = p_assignment_id
  returning * into v_assignment;

  return v_assignment;
end;
$$;


--
-- Name: assignment_reporting_parent_candidates(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assignment_reporting_parent_candidates(p_child_assignment_id uuid) RETURNS TABLE(parent_assignment_id uuid, parent_person_id uuid, parent_full_name text, parent_position_title text, parent_pc_org_id uuid, parent_pc_org_name text, parent_level text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'api'
    AS $$
declare
  v_child public.assignment;
  v_child_level text;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  if p_child_assignment_id is null then
    raise exception 'child_assignment_id is required';
  end if;

  select * into v_child
  from public.assignment a
  where a.assignment_id = p_child_assignment_id;

  if v_child.assignment_id is null then
    raise exception 'Child assignment not found';
  end if;

  -- Permission gate: same as roster_manage writes
  if not (api.is_app_owner() or api.has_pc_org_permission(v_child.pc_org_id, 'roster_manage')) then
    raise exception 'Forbidden';
  end if;

  v_child_level :=
    case
      when coalesce(v_child.position_title,'') ilike '%vp%' or coalesce(v_child.position_title,'') ilike '%vice president%' then 'vp'
      when coalesce(v_child.position_title,'') ilike '%director%' then 'director'
      when coalesce(v_child.position_title,'') ilike '%manager%' then 'manager'
      else 'tech'
    end;

  -- Tech -> Manager (same org)
  if v_child_level = 'tech' then
    return query
    select
      a.assignment_id as parent_assignment_id,
      p.person_id as parent_person_id,
      p.full_name as parent_full_name,
      a.position_title as parent_position_title,
      a.pc_org_id as parent_pc_org_id,
      o.pc_org_name as parent_pc_org_name,
      'manager'::text as parent_level
    from public.assignment a
    join public.person p on p.person_id = a.person_id
    join public.pc_org o on o.pc_org_id = a.pc_org_id
    where a.pc_org_id = v_child.pc_org_id
      and coalesce(a.position_title,'') ilike '%manager%'
      and coalesce(a.active,true) = true
      and a.start_date <= current_date
      and (a.end_date is null or a.end_date >= current_date)
      and a.assignment_id <> v_child.assignment_id
    order by p.full_name asc, a.start_date desc;

  -- Manager -> Director (global)
  elsif v_child_level = 'manager' then
    return query
    select
      a.assignment_id as parent_assignment_id,
      p.person_id as parent_person_id,
      p.full_name as parent_full_name,
      a.position_title as parent_position_title,
      a.pc_org_id as parent_pc_org_id,
      o.pc_org_name as parent_pc_org_name,
      'director'::text as parent_level
    from public.assignment a
    join public.person p on p.person_id = a.person_id
    join public.pc_org o on o.pc_org_id = a.pc_org_id
    where coalesce(a.position_title,'') ilike '%director%'
      and coalesce(a.active,true) = true
      and a.start_date <= current_date
      and (a.end_date is null or a.end_date >= current_date)
      and a.assignment_id <> v_child.assignment_id
    order by p.full_name asc, a.start_date desc;

  -- Director -> VP (global)
  elsif v_child_level = 'director' then
    return query
    select
      a.assignment_id as parent_assignment_id,
      p.person_id as parent_person_id,
      p.full_name as parent_full_name,
      a.position_title as parent_position_title,
      a.pc_org_id as parent_pc_org_id,
      o.pc_org_name as parent_pc_org_name,
      'vp'::text as parent_level
    from public.assignment a
    join public.person p on p.person_id = a.person_id
    join public.pc_org o on o.pc_org_id = a.pc_org_id
    where (
        coalesce(a.position_title,'') ilike '%vp%'
        or coalesce(a.position_title,'') ilike '%vice president%'
      )
      and coalesce(a.active,true) = true
      and a.start_date <= current_date
      and (a.end_date is null or a.end_date >= current_date)
      and a.assignment_id <> v_child.assignment_id
    order by p.full_name asc, a.start_date desc;

  else
    -- VP has no parent in this app
    return;
  end if;
end;
$$;


--
-- Name: assignment_reporting; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assignment_reporting (
    assignment_reporting_id uuid DEFAULT gen_random_uuid() NOT NULL,
    child_assignment_id uuid NOT NULL,
    parent_assignment_id uuid NOT NULL,
    start_date date NOT NULL,
    end_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone,
    updated_by uuid,
    CONSTRAINT chk_assignment_reporting_dates CHECK (((end_date IS NULL) OR (end_date >= start_date))),
    CONSTRAINT chk_assignment_reporting_not_self CHECK ((child_assignment_id <> parent_assignment_id))
);


--
-- Name: assignment_reporting_upsert_safe(uuid, uuid, date, uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assignment_reporting_upsert_safe(p_child_assignment_id uuid, p_parent_assignment_id uuid, p_start_date date, p_assignment_reporting_id uuid DEFAULT NULL::uuid, p_end_date date DEFAULT NULL::date) RETURNS public.assignment_reporting
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'api'
    AS $$
declare
  v_child public.assignment;
  v_row public.assignment_reporting;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  if p_child_assignment_id is null then
    raise exception 'child_assignment_id is required';
  end if;

  if p_parent_assignment_id is null then
    raise exception 'parent_assignment_id is required';
  end if;

  if p_start_date is null then
    raise exception 'start_date is required';
  end if;

  -- Lock and load child assignment to determine org scope
  select *
    into v_child
  from public.assignment a
  where a.assignment_id = p_child_assignment_id
  for update;

  if v_child.assignment_id is null then
    raise exception 'Child assignment not found';
  end if;

  if not (api.is_app_owner() or api.has_pc_org_permission(v_child.pc_org_id, 'roster_manage')) then
    raise exception 'Forbidden';
  end if;

  if p_assignment_reporting_id is not null then
    update public.assignment_reporting
    set child_assignment_id = p_child_assignment_id,
        parent_assignment_id = p_parent_assignment_id,
        start_date = p_start_date,
        end_date = p_end_date
    where assignment_reporting_id = p_assignment_reporting_id
    returning * into v_row;

    if v_row.assignment_reporting_id is null then
      raise exception 'assignment_reporting row not found';
    end if;

    return v_row;
  end if;


  -- Auto-end any prior active edge for this child assignment.
  -- This enforces "one active reports-to" edge at a time.
  update public.assignment_reporting ar
     set end_date = (p_start_date - 1)
   where ar.child_assignment_id = p_child_assignment_id
     and ar.end_date is null
     and ar.start_date < p_start_date;

  -- Guardrail: prevent overlaps with existing rows that start on/after the new start_date
  if exists (
    select 1
      from public.assignment_reporting ar2
     where ar2.child_assignment_id = p_child_assignment_id
       and ar2.start_date >= p_start_date
  ) then
    raise exception 'Cannot insert reporting edge: overlaps an existing row for this assignment';
  end if;

  insert into public.assignment_reporting (
    child_assignment_id,
    parent_assignment_id,
    start_date,
    end_date
  )
  values (
    p_child_assignment_id,
    p_parent_assignment_id,
    p_start_date,
    p_end_date
  )
  returning * into v_row;

  return v_row;
end;
$$;


--
-- Name: assignment_set_active_from_dates(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assignment_set_active_from_dates() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  -- Your rule: end_date set => inactive
  new.active := (new.end_date is null);
  return new;
end;
$$;


--
-- Name: assignment_start(uuid, uuid, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assignment_start(pc_org_id uuid, person_id uuid, start_date date, position_title text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  new_id uuid;
begin
  insert into assignment (
    pc_org_id,
    person_id,
    start_date,
    position_title,
    active
  )
  values (
    pc_org_id,
    person_id,
    start_date,
    position_title,
    true
  )
  returning assignment_id into new_id;

  return new_id;
end;
$$;


--
-- Name: can_mutate(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_mutate() RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select public.current_role_level() >= 30;  -- MANAGER+
$$;


--
-- Name: can_upload_metrics_rows(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_upload_metrics_rows(p_pc_org_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'api'
    AS $$
  select
    coalesce(public.is_owner(), false)
    or coalesce(api.has_pc_org_permission(p_pc_org_id, 'metrics_manage'), false)
    or coalesce(api.has_pc_org_permission(p_pc_org_id, 'metrics_upload'), false);
$$;


--
-- Name: check_in_build_day_fact_for_batch(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_in_build_day_fact_for_batch(p_check_in_batch_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  v_pc_org_id uuid;
  v_min_date date;
  v_max_date date;
  v_rows_upserted int := 0;
begin
  -- resolve batch
  select pc_org_id, min_cp_date, max_cp_date
    into v_pc_org_id, v_min_date, v_max_date
  from public.check_in_batch
  where check_in_batch_id = p_check_in_batch_id;

  if v_pc_org_id is null then
    return jsonb_build_object('ok', false, 'error', 'batch not found');
  end if;

  -- aggregate job rows from this batch
  with agg as (
    select
      r.pc_org_id,
      r.cp_date as shift_date,
      r.tech_id,
      r.fulfillment_center_id,

      count(*) as actual_jobs,
      coalesce(sum(r.job_units),0) as actual_units,
      coalesce(sum(r.job_duration),0) as actual_hours,

      min(r.start_time) as first_start_time,
      max(r.cp_time) as last_cp_time
    from public.check_in_job_row r
    where r.check_in_batch_id = p_check_in_batch_id
    group by r.pc_org_id, r.cp_date, r.tech_id, r.fulfillment_center_id
  ),
  fm_map as (
    select fiscal_month_id, end_date
    from public.fiscal_month_dim
    where v_min_date between start_date and end_date
  ),
  upserted as (
    insert into public.check_in_day_fact (
      pc_org_id,
      shift_date,
      tech_id,
      fiscal_month_id,
      fiscal_end_date,
      fulfillment_center_id,
      actual_jobs,
      actual_units,
      actual_hours,
      first_start_time,
      last_cp_time,
      updated_at
    )
    select
      a.pc_org_id,
      a.shift_date,
      a.tech_id,
      fm.fiscal_month_id,
      fm.end_date,
      a.fulfillment_center_id,
      a.actual_jobs,
      a.actual_units,
      a.actual_hours,
      a.first_start_time,
      a.last_cp_time,
      now()
    from agg a
    cross join fm_map fm
    on conflict (pc_org_id, shift_date, tech_id)
    do update set
      actual_jobs = excluded.actual_jobs,
      actual_units = excluded.actual_units,
      actual_hours = excluded.actual_hours,
      first_start_time = excluded.first_start_time,
      last_cp_time = excluded.last_cp_time,
      updated_at = now()
    returning 1
  )
  select count(*) into v_rows_upserted from upserted;

  return jsonb_build_object(
    'ok', true,
    'rows_upserted', v_rows_upserted
  );
end;
$$;


--
-- Name: company_profile_fact_upsert(uuid, uuid, text, uuid, text, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.company_profile_fact_upsert(p_person_id uuid, p_pc_org_id uuid, p_position_title text, p_office_id uuid, p_tech_id text, p_start_date date) RETURNS void
    LANGUAGE plpgsql
    AS $$
declare
  v_existing record;
  v_today date := coalesce(p_start_date, current_date);
begin
  -- find active row
  select *
  into v_existing
  from public.company_profile_fact
  where person_id = p_person_id
    and pc_org_id = p_pc_org_id
    and effective_end_date is null
  limit 1;

  -- no existing → insert fresh
  if v_existing is null then
    insert into public.company_profile_fact (
      person_id,
      pc_org_id,
      tech_id,
      position_title,
      office_id,
      active_flag,
      effective_start_date
    )
    values (
      p_person_id,
      p_pc_org_id,
      p_tech_id,
      p_position_title,
      p_office_id,
      true,
      v_today
    );

    return;
  end if;

  -- detect change (core fields only)
  if coalesce(v_existing.tech_id, '') <> coalesce(p_tech_id, '')
     or coalesce(v_existing.position_title, '') <> coalesce(p_position_title, '')
     or coalesce(v_existing.office_id::text, '') <> coalesce(p_office_id::text, '') then

    -- close existing
    update public.company_profile_fact
    set effective_end_date = v_today,
        active_flag = false
    where company_profile_id = v_existing.company_profile_id;

    -- insert new version
    insert into public.company_profile_fact (
      person_id,
      pc_org_id,
      tech_id,
      position_title,
      office_id,
      active_flag,
      effective_start_date
    )
    values (
      p_person_id,
      p_pc_org_id,
      p_tech_id,
      p_position_title,
      p_office_id,
      true,
      v_today
    );
  end if;

end;
$$;


--
-- Name: compute_archive_for_batch(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.compute_archive_for_batch(p_batch_id uuid, p_class_type text) RETURNS void
    LANGUAGE plpgsql
    AS $$
begin
  perform public.compute_archive_snapshot_identity(p_batch_id, p_class_type);
  perform public.compute_archive_metrics_for_batch(p_batch_id, p_class_type);
  perform public.compute_archive_scores_and_rank(p_batch_id, p_class_type);
end;
$$;


--
-- Name: compute_archive_metrics_for_batch(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.compute_archive_metrics_for_batch(p_batch_id uuid, p_class_type text) RETURNS void
    LANGUAGE plpgsql
    AS $$
declare
  v_pc_org_id uuid;
  v_metric_date date;
begin
  select pc_org_id, metric_date
  into v_pc_org_id, v_metric_date
  from public.metrics_raw_batch
  where batch_id = p_batch_id;

  -- Rerun safety
  delete from public.master_kpi_archive_metric
  where batch_id = p_batch_id
    and class_type = p_class_type;

  insert into public.master_kpi_archive_metric (
    batch_id,
    class_type,
    pc_org_id,
    metric_date,
    tech_id,

    -- legacy NOT NULL column
    metric_key,

    -- new helpful columns
    metric_key_raw,
    metric_key_canonical,

    raw_value,
    computed_value
  )
  select
    p_batch_id,
    p_class_type,
    v_pc_org_id,
    v_metric_date,
    s.tech_id,

    -- satisfy NOT NULL: canonical becomes the stored metric_key
    canon as metric_key,

    k.key as metric_key_raw,
    canon as metric_key_canonical,

    nullif((r.raw ->> k.key), '')::numeric as raw_value,

    case
      when s.ownership_mode = 'ACTIVE'
        and canon in ('ftr_rate','contact_48hr_rate')
        and coalesce(nullif((r.raw ->> 'Total FTR/Contact Jobs'), '')::numeric, 0) <= 0
        then null
      else nullif((r.raw ->> k.key), '')::numeric
    end as computed_value

  from public.master_kpi_archive_snapshot s
  join public.metrics_raw_row r
    on r.batch_id = s.batch_id
   and r.tech_id = s.tech_id
  cross join lateral jsonb_object_keys(r.raw) as k(key)
  cross join lateral (select public.kpi_key_canonical(k.key) as canon) c

  where s.batch_id = p_batch_id
    and s.class_type = p_class_type
    and s.is_totals = false
    and canon is not null; -- skip raw keys that don't participate in rubric/scoring

end;
$$;


--
-- Name: compute_archive_scores_and_rank(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.compute_archive_scores_and_rank(p_batch_id uuid, p_class_type text) RETURNS void
    LANGUAGE plpgsql
    AS $$
declare
  v_class text := upper(p_class_type);
begin
  -- 0) wipe ranks for this batch/class (idempotent)
  delete from public.metrics_rank_partition
   where batch_id = p_batch_id
     and upper(class_type) = v_class;

  -- 1) Build eligible set (Total FTR/Contact Jobs > 0) and rank only those
  with base as (
    select
      s.batch_id,
      s.pc_org_id,
      s.metric_date,
      s.fiscal_end_date,
      upper(s.class_type) as class_type,
      s.tech_id,
      s.is_totals,
      -- eligibility gate: Total FTR/Contact Jobs > 0
      coalesce(
        nullif(regexp_replace(s.raw_metrics_json->>'Total FTR/Contact Jobs', '[^0-9\.-]', '', 'g'), '')::numeric,
        0
      ) as ftr_contact_jobs
    from public.master_kpi_archive_snapshot s
    where s.batch_id = p_batch_id
      and upper(s.class_type) = v_class
  ),
  eligible as (
    select
      b.*,
      t.total_weighted_points
    from base b
    join public.metrics_tech_rollup t
      on t.batch_id = b.batch_id
     and upper(t.class_type) = b.class_type
     and t.pc_org_id = b.pc_org_id
     and t.metric_date = b.metric_date
     and t.fiscal_end_date = b.fiscal_end_date
     and t.tech_id = b.tech_id
    where b.is_totals = false
      and b.ftr_contact_jobs > 0
  ),
  ranked as (
    select
      e.batch_id,
      e.pc_org_id,
      e.metric_date,
      e.fiscal_end_date,
      e.class_type,
      e.tech_id,
      rank() over (
        partition by e.batch_id, e.pc_org_id, e.metric_date, e.fiscal_end_date, e.class_type
        -- ✅ LOWER IS BETTER: ASC
        order by e.total_weighted_points asc nulls last, e.tech_id
      ) as rnk,
      count(*) over (
        partition by e.batch_id, e.pc_org_id, e.metric_date, e.fiscal_end_date, e.class_type
      ) as n,
      e.total_weighted_points
    from eligible e
  )
  insert into public.metrics_rank_partition (
    id,
    batch_id,
    pc_org_id,
    metric_date,
    fiscal_end_date,
    mso_id,
    class_type,
    tech_id,
    rank,
    n,
    percentile,
    total_weighted_points,
    computed_at
  )
  select
    gen_random_uuid(),
    r.batch_id,
    r.pc_org_id,
    r.metric_date,
    r.fiscal_end_date,
    null::uuid as mso_id,
    r.class_type,
    r.tech_id,
    r.rnk,
    r.n,
    case
      when r.n <= 1 then 0::numeric
      else ((r.rnk - 1)::numeric / (r.n - 1)::numeric)
    end as percentile,
    coalesce(r.total_weighted_points, 0)::numeric,
    now()
  from ranked r;

  -- 2) Reset snapshot rank fields (tech rows only)
  update public.master_kpi_archive_snapshot s
  set
    rank_org = null,
    percentile = null,
    population_size = null
  where s.batch_id = p_batch_id
    and upper(s.class_type) = v_class
    and s.is_totals = false;

  -- 3) Apply population_size to ALL tech rows (eligible population only),
  --    but rank/percentile only to eligible rows.
  with pop as (
    select
      rp.batch_id,
      rp.pc_org_id,
      rp.metric_date,
      rp.fiscal_end_date,
      upper(rp.class_type) as class_type,
      max(rp.n) as n
    from public.metrics_rank_partition rp
    where rp.batch_id = p_batch_id
      and upper(rp.class_type) = v_class
    group by 1,2,3,4,5
  )
  update public.master_kpi_archive_snapshot s
  set population_size = pop.n
  from pop
  where s.batch_id = pop.batch_id
    and s.pc_org_id = pop.pc_org_id
    and s.metric_date = pop.metric_date
    and s.fiscal_end_date = pop.fiscal_end_date
    and upper(s.class_type) = pop.class_type
    and s.is_totals = false;

  update public.master_kpi_archive_snapshot s
  set
    rank_org = rp.rank,
    percentile = rp.percentile,
    population_size = rp.n
  from public.metrics_rank_partition rp
  where s.batch_id = p_batch_id
    and upper(s.class_type) = v_class
    and s.is_totals = false
    and rp.batch_id = s.batch_id
    and upper(rp.class_type) = upper(s.class_type)
    and rp.pc_org_id = s.pc_org_id
    and rp.metric_date = s.metric_date
    and rp.fiscal_end_date = s.fiscal_end_date
    and rp.tech_id = s.tech_id;

  -- 4) Totals row: keep population_size (eligible pop) but never rank it
  with pop as (
    select
      rp.batch_id,
      rp.pc_org_id,
      rp.metric_date,
      rp.fiscal_end_date,
      upper(rp.class_type) as class_type,
      max(rp.n) as n
    from public.metrics_rank_partition rp
    where rp.batch_id = p_batch_id
      and upper(rp.class_type) = v_class
    group by 1,2,3,4,5
  )
  update public.master_kpi_archive_snapshot s
  set
    population_size = pop.n,
    rank_org = null,
    percentile = null
  from pop
  where s.batch_id = pop.batch_id
    and s.pc_org_id = pop.pc_org_id
    and s.metric_date = pop.metric_date
    and s.fiscal_end_date = pop.fiscal_end_date
    and upper(s.class_type) = pop.class_type
    and s.is_totals = true;

end;
$$;


--
-- Name: compute_archive_snapshot_identity(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.compute_archive_snapshot_identity(p_batch_id uuid, p_class_type text) RETURNS void
    LANGUAGE plpgsql
    AS $$
declare
  v_pc_org_id uuid;
  v_metric_date date;
  v_fiscal_end_date date;
  v_unknown_person_id uuid := 'ee7cfffe-c9ba-46af-bb76-c2f3ea4361f1'::uuid;
  v_pc_manager_person_id uuid;
begin
  -- Batch metadata
  select
    pc_org_id,
    metric_date,
    fiscal_end_date
  into
    v_pc_org_id,
    v_metric_date,
    v_fiscal_end_date
  from public.metrics_raw_batch
  where batch_id = p_batch_id;

  -- Exact PC manager
  select leader_person_id
  into v_pc_manager_person_id
  from public.pc_org_leadership
  where pc_org_id = v_pc_org_id
    and role_key = 'pc_manager'
  order by is_primary desc
  limit 1;

  -- Rerun safety
  delete from public.master_kpi_archive_snapshot
  where batch_id = p_batch_id
    and class_type = p_class_type;

  with recursive
  raw_rows as (
    select r.batch_id, r.tech_id
    from public.metrics_raw_row r
    where r.batch_id = p_batch_id
  ),

  eff as (
    select
      rr.tech_id,
      (rr.tech_id ilike '%total%') as is_totals,

      a.assignment_id as active_assignment_id,
      a.person_id as active_person_id,
      a.office_id as active_office_id,
      a.position_title as active_position_title,

      a_last.assignment_id as tail_assignment_id,
      a_last.person_id as tail_person_id,
      a_last.office_id as tail_office_id,
      a_last.position_title as tail_position_title,
      a_last.end_date as tail_end_date,

      coalesce(a.assignment_id, a_last.assignment_id) as eff_assignment_id,
      coalesce(a.person_id, a_last.person_id) as eff_person_id,
      coalesce(a.office_id, a_last.office_id) as eff_office_id,
      coalesce(a.position_title, a_last.position_title) as eff_position_title,

      case
        when a.assignment_id is not null then 'ACTIVE'
        when a_last.assignment_id is not null then 'TAIL_30D'
        else 'ORPHAN_OUT_OF_WINDOW'
      end as ownership_mode,

      case
        when a.assignment_id is not null then v_metric_date
        when a_last.assignment_id is not null then a_last.end_date
        else v_metric_date
      end as eff_asof_date

    from raw_rows rr

    left join lateral (
      select *
      from public.assignment a1
      where a1.pc_org_id = v_pc_org_id
        and a1.tech_id = rr.tech_id
        and a1.start_date <= v_metric_date
        and (a1.end_date is null or a1.end_date >= v_metric_date)
      order by a1.start_date desc
      limit 1
    ) a on true

    left join lateral (
      select *
      from public.assignment a2
      where a2.pc_org_id = v_pc_org_id
        and a2.tech_id = rr.tech_id
        and a2.end_date is not null
        and a2.end_date < v_metric_date
        and a2.end_date >= (v_metric_date - interval '30 days')
      order by a2.end_date desc
      limit 1
    ) a_last on a.assignment_id is null
  ),

  title_dim as (
    select position_title, sort_order
    from public.position_title
  ),

  direct_parent as (
    select
      e.tech_id,
      e.eff_assignment_id,
      e.eff_asof_date,
      parent_assign.person_id as direct_reports_to_person_id
    from eff e
    left join public.assignment_reporting ar
      on ar.child_assignment_id = e.eff_assignment_id
     and ar.start_date <= e.eff_asof_date
     and (ar.end_date is null or ar.end_date >= e.eff_asof_date)
    left join public.assignment parent_assign
      on parent_assign.assignment_id = ar.parent_assignment_id
  ),

  chain as (
    select
      e.tech_id,
      e.eff_asof_date,
      ar.parent_assignment_id as ancestor_assignment_id,
      1 as depth
    from eff e
    join public.assignment_reporting ar
      on ar.child_assignment_id = e.eff_assignment_id
     and ar.start_date <= e.eff_asof_date
     and (ar.end_date is null or ar.end_date >= e.eff_asof_date)
    where e.eff_assignment_id is not null

    union all

    select
      c.tech_id,
      c.eff_asof_date,
      ar2.parent_assignment_id as ancestor_assignment_id,
      c.depth + 1
    from chain c
    join public.assignment_reporting ar2
      on ar2.child_assignment_id = c.ancestor_assignment_id
     and ar2.start_date <= c.eff_asof_date
     and (ar2.end_date is null or ar2.end_date >= c.eff_asof_date)
    where ar2.parent_assignment_id is not null
      and c.depth < 10
  ),

  ancestors as (
    select
      c.tech_id,
      c.depth,
      a.person_id as ancestor_person_id,
      td.sort_order,
      td.position_title
    from chain c
    join public.assignment a
      on a.assignment_id = c.ancestor_assignment_id
    left join title_dim td
      on td.position_title = a.position_title
  ),

  itg_pick_30 as (
    select
      tech_id,
      ancestor_person_id,
      sort_order,
      position_title,
      depth,
      row_number() over (partition by tech_id order by depth asc) as rn
    from ancestors
    where sort_order = 30
  ),

  itg_pick_gt30 as (
    select
      tech_id,
      ancestor_person_id,
      sort_order,
      position_title,
      depth,
      row_number() over (partition by tech_id order by depth asc) as rn
    from ancestors
    where sort_order > 30
  ),

  itg_rollup as (
    select
      e.tech_id,
      coalesce(
        (select p30.ancestor_person_id from itg_pick_30 p30 where p30.tech_id = e.tech_id and p30.rn = 1),
        (select pgt.ancestor_person_id from itg_pick_gt30 pgt where pgt.tech_id = e.tech_id and pgt.rn = 1),
        dp.direct_reports_to_person_id
      ) as itg_rollup_person_id,
      dp.direct_reports_to_person_id
    from eff e
    left join direct_parent dp
      on dp.tech_id = e.tech_id
  )

  insert into public.master_kpi_archive_snapshot (
    batch_id,
    class_type,
    pc_org_id,
    metric_date,
    fiscal_end_date,
    tech_id,
    person_id,
    ownership_mode,
    ownership_effective_date,
    direct_reports_to_person_id,
    itg_rollup_person_id,
    office_id,
    position_title,
    co_ref,
    co_code,
    affiliation_role,
    is_totals,
    totals_owner_person_id
  )
  select
    p_batch_id,
    p_class_type,
    v_pc_org_id,
    v_metric_date,
    v_fiscal_end_date,
    e.tech_id,

    case
      when e.is_totals then v_unknown_person_id
      else coalesce(e.eff_person_id, v_unknown_person_id)
    end as person_id,

    case
      when e.is_totals then 'TOTALS'
      else e.ownership_mode
    end as ownership_mode,

    e.eff_asof_date as ownership_effective_date,

    case
      when e.is_totals then null
      when e.tech_id = '4899' and e.eff_assignment_id is null then v_pc_manager_person_id
      else ir.direct_reports_to_person_id
    end as direct_reports_to_person_id,

    case
      when e.is_totals then null
      when e.tech_id = '4899' and e.eff_assignment_id is null then v_pc_manager_person_id
      else ir.itg_rollup_person_id
    end as itg_rollup_person_id,

    case when e.is_totals then null else e.eff_office_id end as office_id,
    case when e.is_totals then null else e.eff_position_title end as position_title,

    case when e.is_totals then null else p.co_ref_id end as co_ref,
    case when e.is_totals then null else p.co_code end as co_code,
    case when e.is_totals then null else p.role end as affiliation_role,

    e.is_totals as is_totals,

    case when e.is_totals then v_pc_manager_person_id else null end as totals_owner_person_id

  from eff e
  left join public.person p
    on p.person_id = e.eff_person_id
  left join itg_rollup ir
    on ir.tech_id = e.tech_id;

end;
$$;


--
-- Name: compute_check_in_actual_hours_v2(date, time without time zone, time without time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.compute_check_in_actual_hours_v2(p_shift_date date, p_first_start time without time zone, p_last_cp time without time zone) RETURNS TABLE(actual_hours numeric, is_outlier boolean, note text)
    LANGUAGE sql STABLE
    AS $$
  with calc as (
    select
      case
        when p_shift_date is null or p_first_start is null or p_last_cp is null then null::numeric
        else
          extract(
            epoch from (
              case
                when p_last_cp >= p_first_start
                  then (p_shift_date + p_last_cp) - (p_shift_date + p_first_start)
                else
                  (p_shift_date + p_last_cp + interval '1 day') - (p_shift_date + p_first_start)
              end
            )
          ) / 3600.0
      end as raw_hours
  ),
  cls as (
    select
      raw_hours,
      (raw_hours is null) as missing_times,
      (raw_hours is not null and raw_hours <= 0) as non_positive,
      (raw_hours is not null and raw_hours > 16) as massive_outlier
    from calc
  )
  select
    case
      when missing_times or non_positive or massive_outlier then 8::numeric
      else greatest(0::numeric, least(24::numeric, raw_hours::numeric))
    end as actual_hours,
    (missing_times or non_positive or massive_outlier) as is_outlier,
    case
      when missing_times then 'defaulted_to_8_missing_times'
      when non_positive then 'defaulted_to_8_non_positive_elapsed'
      when massive_outlier then 'defaulted_to_8_massive_outlier_gt_16h'
      else null
    end as note
  from cls;
$$;


--
-- Name: compute_check_in_actual_hours_v5(date, time without time zone, time without time zone, numeric, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.compute_check_in_actual_hours_v5(p_shift_date date, p_first_start time without time zone, p_last_cp time without time zone, p_actual_units numeric, p_actual_jobs integer) RETURNS TABLE(actual_hours numeric, is_outlier boolean, note text)
    LANGUAGE sql STABLE
    AS $$
  with e as (
    select
      coalesce(p_actual_units, 0)::numeric as units,
      coalesce(p_actual_jobs, 0)::int as jobs,
      (p_shift_date is not null and p_first_start is not null and p_last_cp is not null) as has_times
  ),
  calc as (
    select
      case
        when not e.has_times then null::numeric
        else
          extract(
            epoch from (
              case
                when p_last_cp >= p_first_start
                  then (p_shift_date + p_last_cp) - (p_shift_date + p_first_start)
                else
                  (p_shift_date + p_last_cp + interval '1 day') - (p_shift_date + p_first_start)
              end
            )
          ) / 3600.0
      end as raw_elapsed_hours
    from e
  ),
  cls as (
    select
      e.units,
      e.jobs,
      e.has_times,
      c.raw_elapsed_hours,
      (e.units = 0 and e.jobs = 0) as no_activity,
      (e.units > 0 or e.jobs > 0) as has_activity,
      (c.raw_elapsed_hours is not null and c.raw_elapsed_hours > 16) as massive_outlier
    from e cross join calc c
  )
  select
    case
      when cls.no_activity then 0::numeric
      when cls.has_activity and not cls.has_times then 0::numeric
      when cls.has_times and cls.massive_outlier then 8::numeric
      when cls.has_times then greatest(0::numeric, least(24::numeric, cls.raw_elapsed_hours::numeric))
      else 0::numeric
    end as actual_hours,

    -- ONLY treat "massive elapsed" as outlier
    case
      when cls.has_times and cls.massive_outlier then true
      else false
    end as is_outlier,

    case
      when cls.no_activity then 'no_activity_defaulted_to_0'
      when cls.has_activity and not cls.has_times then 'activity_missing_times_defaulted_to_0'
      when cls.has_times and cls.massive_outlier then 'elapsed_gt_16h_defaulted_to_8'
      else null
    end as note
  from cls;
$$;


--
-- Name: current_app_user_id(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_app_user_id(p_auth_user_id uuid) RETURNS uuid
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'core'
    AS $$
  select au.app_user_id
  from core.app_users au
  where au.auth_user_id = p_auth_user_id
    and au.status = 'active'
  limit 1;
$$;


--
-- Name: current_core_app_user_id(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_core_app_user_id(p_auth_user_id uuid) RETURNS uuid
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'core'
    AS $$
  select au.app_user_id
  from core.app_users au
  where au.auth_user_id = p_auth_user_id
  limit 1;
$$;


--
-- Name: current_role_key(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_role_key() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select coalesce((
    select r.role_key
    from public.user_role r
    where r.user_id = auth.uid()
      and r.is_active = true
    limit 1
  ), 'NONE');
$$;


--
-- Name: current_role_level(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_role_level() RETURNS integer
    LANGUAGE sql STABLE
    AS $$
  select coalesce((
    select d.role_level
    from public.user_role r
    join public.role_dim d on d.role_key = r.role_key
    where r.user_id = auth.uid()
      and r.is_active = true
    limit 1
  ), 0);
$$;


--
-- Name: dispatch_console_log_audit_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.dispatch_console_log_audit_update() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  v_changed_by_user_id uuid;
begin
  -- block changes to any fields other than: event_type, message, updated_at, updated_by_user_id
  if (new.pc_org_id is distinct from old.pc_org_id) then raise exception 'immutable_column: pc_org_id'; end if;
  if (new.shift_date is distinct from old.shift_date) then raise exception 'immutable_column: shift_date'; end if;
  if (new.assignment_id is distinct from old.assignment_id) then raise exception 'immutable_column: assignment_id'; end if;
  if (new.person_id is distinct from old.person_id) then raise exception 'immutable_column: person_id'; end if;
  if (new.tech_id is distinct from old.tech_id) then raise exception 'immutable_column: tech_id'; end if;
  if (new.affiliation_id is distinct from old.affiliation_id) then raise exception 'immutable_column: affiliation_id'; end if;
  if (new.capacity_delta_routes is distinct from old.capacity_delta_routes) then raise exception 'immutable_column: capacity_delta_routes'; end if;
  if (new.created_at is distinct from old.created_at) then raise exception 'immutable_column: created_at'; end if;
  if (new.created_by_user_id is distinct from old.created_by_user_id) then raise exception 'immutable_column: created_by_user_id'; end if;
  if (new.tags is distinct from old.tags) then raise exception 'immutable_column: tags'; end if;
  if (new.meta is distinct from old.meta) then raise exception 'immutable_column: meta'; end if;

  v_changed_by_user_id := coalesce(
    new.updated_by_user_id,
    old.updated_by_user_id,
    new.created_by_user_id,
    old.created_by_user_id,
    auth.uid()
  );

  -- normalize edit metadata
  new.updated_at := now();
  new.updated_by_user_id := v_changed_by_user_id;

  -- write audit
  insert into public.dispatch_console_log_audit (
    dispatch_console_log_id,
    action,
    changed_by_user_id,
    old_event_type,
    new_event_type,
    old_message,
    new_message
  ) values (
    old.dispatch_console_log_id,
    'UPDATE',
    v_changed_by_user_id,
    old.event_type::text,
    new.event_type::text,
    old.message,
    new.message
  );

  return new;
end;
$$;


--
-- Name: dispatch_console_log_before_ins_trg(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.dispatch_console_log_before_ins_trg() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  v_norm text;
  v_gid uuid;
begin
  -- Normalize message -> dedupe_key when not provided
  if new.dedupe_key is null then
    v_norm := lower(regexp_replace(trim(coalesce(new.message, '')), '\s+', ' ', 'g'));
    if v_norm <> '' then
      new.dedupe_key := v_norm;
    end if;
  end if;

  -- Only group these types (NOTE remains multi-entry; singletons handled by unique index)
  if new.event_type in ('INCIDENT', 'TECH_MOVE') and new.event_group_id is null then
    -- If we have a dedupe_key, try to attach to a recent matching thread for same tech/day/type.
    if new.dedupe_key is not null then
      select coalesce(dcl.event_group_id, dcl.dispatch_console_log_id)
        into v_gid
      from public.dispatch_console_log dcl
      where dcl.pc_org_id = new.pc_org_id
        and dcl.shift_date = new.shift_date
        and dcl.assignment_id = new.assignment_id
        and dcl.event_type = new.event_type
        and dcl.dedupe_key = new.dedupe_key
        and dcl.created_at >= (now() - interval '30 minutes')
      order by dcl.created_at desc
      limit 1;

      if v_gid is not null then
        new.event_group_id := v_gid;
      end if;
    end if;

    -- If still null, seed a new thread id
    if new.event_group_id is null then
      new.event_group_id := gen_random_uuid();
    end if;
  end if;

  return new;
end;
$$;


--
-- Name: dispatch_day_seed_from_schedule(uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.dispatch_day_seed_from_schedule(p_pc_org_id uuid, p_shift_date date) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  v_upserted int;
begin
  with src as (
    select
      s.pc_org_id,
      s.shift_date,
      s.assignment_id,

      -- prefer match by assignment_id, otherwise fallback to tech_id match
      coalesce(rA.person_id, rT.person_id) as person_id,
      coalesce(rA.tech_id::text, rT.tech_id::text, s.tech_id::text) as tech_id,
      null::uuid as affiliation_id,
      coalesce(rA.full_name, rT.full_name, s.tech_id::text) as full_name,
      coalesce(rA.co_name, rT.co_name) as co_name,

      s.planned_route_id,
      null::text as planned_route_name,
      null::time as planned_start_time,
      null::time as planned_end_time,
      s.planned_hours::numeric as planned_hours,
      s.planned_units::numeric as planned_units,
      now() as schedule_as_of

    from public.schedule_day_fact s
    left join public.route_lock_roster_tech_v rA
      on rA.pc_org_id = s.pc_org_id
     and rA.assignment_id = s.assignment_id
    left join public.route_lock_roster_tech_v rT
      on rT.pc_org_id = s.pc_org_id
     and rT.tech_id::text = s.tech_id::text

    where s.pc_org_id = p_pc_org_id
      and s.shift_date = p_shift_date
      and coalesce(rA.person_id, rT.person_id) is not null  -- enforce person_id required
  ),
  ins as (
    insert into public.dispatch_day_tech (
      pc_org_id, shift_date, assignment_id,
      person_id, tech_id, affiliation_id,
      full_name, co_name,
      planned_route_id, planned_route_name,
      planned_start_time, planned_end_time,
      planned_hours, planned_units,
      schedule_as_of
    )
    select
      pc_org_id, shift_date, assignment_id,
      person_id, tech_id, affiliation_id,
      full_name, co_name,
      planned_route_id, planned_route_name,
      planned_start_time, planned_end_time,
      planned_hours, planned_units,
      schedule_as_of
    from src
    on conflict (pc_org_id, shift_date, assignment_id)
    do update set
      person_id = excluded.person_id,
      tech_id = excluded.tech_id,
      affiliation_id = excluded.affiliation_id,
      full_name = excluded.full_name,
      co_name = excluded.co_name,
      planned_route_id = excluded.planned_route_id,
      planned_route_name = excluded.planned_route_name,
      planned_start_time = excluded.planned_start_time,
      planned_end_time = excluded.planned_end_time,
      planned_hours = excluded.planned_hours,
      planned_units = excluded.planned_units,
      schedule_as_of = excluded.schedule_as_of
    returning 1
  )
  select count(*)::int into v_upserted from ins;

  return v_upserted;
end;
$$;


--
-- Name: dispatch_day_tech_set_route_name(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.dispatch_day_tech_set_route_name() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.planned_route_id is null then
    new.planned_route_name := null;
    return new;
  end if;

  select r.route_name
    into new.planned_route_name
  from public.route r
  where r.route_id = new.planned_route_id;

  return new;
end;
$$;


--
-- Name: dispatch_has_supervisor_plus(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.dispatch_has_supervisor_plus(p_pc_org_id uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select exists (
    select 1
    from public.pc_org_permission_grant g
    where g.pc_org_id = p_pc_org_id
      and g.auth_user_id = auth.uid()
      and g.revoked_at is null
      and (g.expires_at is null or g.expires_at > now())
      and g.permission_key in ('leadership_manage', 'roster_manage')
  );
$$;


--
-- Name: ensure_core_app_user_for_auth(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ensure_core_app_user_for_auth(p_auth_user_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'core'
    AS $$
declare
  v_app_user_id uuid;
  v_profile record;
begin
  select
    up.auth_user_id,
    up.core_person_id,
    up.person_id,
    au.email
  into v_profile
  from public.user_profile up
  left join auth.users au
    on au.id = up.auth_user_id
  where up.auth_user_id = p_auth_user_id
  limit 1;

  if v_profile.auth_user_id is null then
    return null;
  end if;

  select au.app_user_id
    into v_app_user_id
  from core.app_users au
  where au.auth_user_id = p_auth_user_id
     or au.person_id = coalesce(v_profile.core_person_id, v_profile.person_id)
  order by
    case when au.auth_user_id = p_auth_user_id then 0 else 1 end,
    au.created_at asc
  limit 1;

  if v_app_user_id is not null then
    update core.app_users au
    set
      auth_user_id = p_auth_user_id,
      person_id = coalesce(v_profile.core_person_id, v_profile.person_id, au.person_id),
      primary_email = coalesce(v_profile.email, au.primary_email),
      status = 'active',
      updated_at = now()
    where au.app_user_id = v_app_user_id;

    return v_app_user_id;
  end if;

  insert into core.app_users (
    auth_user_id,
    person_id,
    display_name,
    primary_email,
    status
  )
  values (
    p_auth_user_id,
    coalesce(v_profile.core_person_id, v_profile.person_id),
    split_part(coalesce(v_profile.email, 'App User'), '@', 1),
    v_profile.email,
    'active'
  )
  returning app_user_id into v_app_user_id;

  return v_app_user_id;
end;
$$;


--
-- Name: workspaces; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.workspaces (
    workspace_id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_key text NOT NULL,
    workspace_name text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    legacy_pc_org_id uuid,
    CONSTRAINT core_workspaces_status_ck CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'archived'::text])))
);


--
-- Name: ensure_core_workspace_for_pc_org(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ensure_core_workspace_for_pc_org(p_pc_org_id uuid) RETURNS core.workspaces
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'core'
    AS $$
declare
  v_pc_org public.pc_org%rowtype;
  v_workspace core.workspaces%rowtype;
  v_workspace_key text;
  v_workspace_name text;
begin
  select *
    into v_pc_org
  from public.pc_org
  where pc_org_id = p_pc_org_id;

  if v_pc_org.pc_org_id is null then
    raise exception 'pc_org not found: %', p_pc_org_id;
  end if;

  v_workspace_key := 'FULFILLMENT_' || regexp_replace(coalesce(v_pc_org.pc_org_name, p_pc_org_id::text), '[^a-zA-Z0-9]+', '_', 'g');
  v_workspace_name := coalesce(v_pc_org.fulfillment_center_name, v_pc_org.pc_org_name, p_pc_org_id::text);

  update core.workspaces
     set workspace_key = v_workspace_key,
         workspace_name = v_workspace_name,
         status = 'active',
         updated_at = now()
   where legacy_pc_org_id = p_pc_org_id
   returning * into v_workspace;

  if v_workspace.workspace_id is null then
    insert into core.workspaces (
      workspace_key,
      workspace_name,
      status,
      legacy_pc_org_id
    )
    values (
      v_workspace_key,
      v_workspace_name,
      'active',
      p_pc_org_id
    )
    returning * into v_workspace;
  end if;

  return v_workspace;
end;
$$;


--
-- Name: ensure_user_pc_org_eligibility(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ensure_user_pc_org_eligibility() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'api'
    AS $$
begin
  if new.selected_pc_org_id is not null then
    insert into public.user_pc_org_eligibility (auth_user_id, pc_org_id)
    values (new.auth_user_id, new.selected_pc_org_id)
    on conflict do nothing;
  end if;

  return new;
end;
$$;


--
-- Name: field_log_attachment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.field_log_attachment (
    attachment_id uuid DEFAULT gen_random_uuid() NOT NULL,
    report_id uuid NOT NULL,
    photo_label_key text,
    file_path text NOT NULL,
    file_name text,
    mime_type text,
    file_size_bytes bigint,
    uploaded_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: field_log_add_attachment(uuid, text, text, text, text, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.field_log_add_attachment(p_report_id uuid, p_photo_label_key text, p_file_path text, p_file_name text DEFAULT NULL::text, p_mime_type text DEFAULT NULL::text, p_file_size_bytes bigint DEFAULT NULL::bigint) RETURNS public.field_log_attachment
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_report public.field_log_report%rowtype;
  v_attachment public.field_log_attachment%rowtype;
begin
  select *
    into v_report
  from public.field_log_report
  where report_id = p_report_id;

  if v_report.report_id is null then
    raise exception 'Report not found: %', p_report_id;
  end if;

  if not (
    v_report.status = 'draft'
    or (v_report.status = 'tech_followup_required' and v_report.edit_unlocked = true)
    or v_report.status = 'sup_followup_required'
    or v_report.status = 'pending_review'
  ) then
    raise exception 'Attachments cannot be added in current state for report: %', p_report_id;
  end if;

  insert into public.field_log_attachment (
    report_id,
    photo_label_key,
    file_path,
    file_name,
    mime_type,
    file_size_bytes
  )
  values (
    p_report_id,
    p_photo_label_key,
    p_file_path,
    p_file_name,
    p_mime_type,
    p_file_size_bytes
  )
  returning * into v_attachment;

  return v_attachment;
end;
$$;


--
-- Name: field_log_report; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.field_log_report (
    report_id uuid DEFAULT gen_random_uuid() NOT NULL,
    config_version_id uuid NOT NULL,
    rule_id uuid NOT NULL,
    category_key text NOT NULL,
    subcategory_key text,
    status text DEFAULT 'draft'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by_user_id uuid,
    submitted_at timestamp with time zone,
    job_number text NOT NULL,
    job_type text,
    comment text,
    evidence_declared text DEFAULT 'none'::text NOT NULL,
    xm_declared boolean DEFAULT false NOT NULL,
    xm_link text,
    xm_link_valid boolean DEFAULT false NOT NULL,
    xm_verified_by_user_id uuid,
    xm_verified_at timestamp with time zone,
    photo_count integer DEFAULT 0 NOT NULL,
    photo_deleted_at timestamp with time zone,
    gps_lat numeric,
    gps_lng numeric,
    gps_accuracy_m numeric,
    location_captured_at timestamp with time zone,
    approval_owner_user_id uuid,
    approved_at timestamp with time zone,
    followup_requested_by_user_id uuid,
    followup_note text,
    edit_unlocked boolean DEFAULT false NOT NULL,
    locked boolean DEFAULT false NOT NULL,
    pc_org_id uuid,
    subject_person_id uuid,
    subject_full_name text,
    subject_tech_id text,
    u_code text,
    followup_owner_person_id uuid,
    followup_assigned_at timestamp with time zone,
    followup_assigned_by_user_id uuid,
    followup_assignment_note text,
    billing_prepared_at timestamp with time zone,
    billing_prepared_by_user_id uuid,
    billing_email_sent_at timestamp with time zone,
    billing_email_sent_by_user_id uuid,
    billing_email_last_error text,
    CONSTRAINT field_log_report_evidence_declared_check CHECK ((evidence_declared = ANY (ARRAY['field_upload'::text, 'xm_platform'::text, 'none'::text]))),
    CONSTRAINT field_log_report_photo_count_check CHECK ((photo_count >= 0)),
    CONSTRAINT field_log_report_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'pending_review'::text, 'tech_followup_required'::text, 'sup_followup_required'::text, 'approved'::text, 'rejected'::text, 'closed'::text])))
);


--
-- Name: field_log_append_xm_link(uuid, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.field_log_append_xm_link(p_report_id uuid, p_action_by_user_id uuid, p_xm_link text, p_note text DEFAULT NULL::text) RETURNS public.field_log_report
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_valid boolean;
  v_report public.field_log_report%rowtype;
begin
  v_valid := public.field_log_validate_xm_link(p_xm_link);

  update public.field_log_report
     set xm_link = p_xm_link,
         xm_link_valid = v_valid,
         xm_verified_by_user_id = case when v_valid then p_action_by_user_id else null end,
         xm_verified_at = case when v_valid then now() else null end
   where report_id = p_report_id
     and status in ('pending_review','sup_followup_required')
     and locked = false
  returning * into v_report;

  if v_report.report_id is null then
    raise exception 'Report not found, locked, or not reviewable: %', p_report_id;
  end if;

  insert into public.field_log_review_action (
    report_id, action_type, action_by_user_id, note
  )
  values (
    p_report_id,
    case when v_valid then 'xm_verify' else 'xm_link_append' end,
    p_action_by_user_id,
    coalesce(p_note, p_xm_link)
  );

  return v_report;
end;
$$;


--
-- Name: field_log_approve_report(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.field_log_approve_report(p_report_id uuid, p_action_by_user_id uuid, p_note text DEFAULT NULL::text) RETURNS public.field_log_report
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_ok boolean;
  v_report public.field_log_report%rowtype;
begin
  select public.field_log_is_approvable(p_report_id) into v_ok;

  if coalesce(v_ok, false) = false then
    raise exception 'Report is not approvable: %', p_report_id;
  end if;

  update public.field_log_report
     set status = 'approved',
         approval_owner_user_id = p_action_by_user_id,
         approved_at = now(),
         locked = true,
         edit_unlocked = false
   where report_id = p_report_id
     and locked = false
  returning * into v_report;

  if v_report.report_id is null then
    raise exception 'Approval failed for report: %', p_report_id;
  end if;

  if v_report.category_key = 'qc' then
    update public.field_log_report_qc
       set supervisor_review_decision = 'approved',
           approval_note = p_note
     where report_id = p_report_id;
  end if;

  insert into public.field_log_review_action (
    report_id, action_type, action_by_user_id, note
  )
  values (
    p_report_id, 'approve', p_action_by_user_id, p_note
  );

  return v_report;
end;
$$;


--
-- Name: field_log_approve_report(uuid, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.field_log_approve_report(p_report_id uuid, p_action_by_user_id uuid, p_note text, p_xm_link text) RETURNS public.field_log_report
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_report public.field_log_report%rowtype;
begin
  if nullif(trim(coalesce(p_xm_link, '')), '') is not null then
    perform public.field_log_append_xm_link(
      p_report_id,
      p_action_by_user_id,
      p_xm_link,
      p_note
    );
  end if;

  select *
    into v_report
  from public.field_log_approve_report(
    p_report_id,
    p_action_by_user_id,
    p_note
  );

  return v_report;
end;
$$;


--
-- Name: field_log_create_draft(uuid, uuid, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.field_log_create_draft(p_created_by_user_id uuid, p_pc_org_id uuid, p_category_key text, p_subcategory_key text, p_job_number text, p_job_type text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_rule public.field_log_rules_v%rowtype;
  v_report_id uuid;
  v_existing_report_id uuid;
  v_local_today date;
begin
  if p_pc_org_id is null then
    raise exception 'pc_org_id is required';
  end if;

  v_local_today := timezone('America/New_York', now())::date;

  -- dedup: same tech + org + local date + job number + draft
  select r.report_id
    into v_existing_report_id
  from public.field_log_report r
  where r.created_by_user_id = p_created_by_user_id
    and r.pc_org_id = p_pc_org_id
    and coalesce(r.job_number, '') = coalesce(p_job_number, '')
    and timezone('America/New_York', r.created_at)::date = v_local_today
    and r.status = 'draft'
  order by r.created_at desc
  limit 1;

  if v_existing_report_id is not null then
    return v_existing_report_id;
  end if;

  select *
    into v_rule
  from public.field_log_rules_v
  where category_key = p_category_key
    and subcategory_key is not distinct from p_subcategory_key
  limit 1;

  if v_rule.rule_id is null then
    raise exception 'No active published field log rule found for category=% subcategory=%',
      p_category_key, p_subcategory_key;
  end if;

  insert into public.field_log_report (
    config_version_id,
    rule_id,
    category_key,
    subcategory_key,
    status,
    created_by_user_id,
    job_number,
    job_type,
    pc_org_id
  )
  values (
    v_rule.config_version_id,
    v_rule.rule_id,
    p_category_key,
    p_subcategory_key,
    'draft',
    p_created_by_user_id,
    p_job_number,
    p_job_type,
    p_pc_org_id
  )
  returning report_id into v_report_id;

  if p_category_key = 'qc' then
    insert into public.field_log_report_qc (report_id, qc_mode)
    values (v_report_id, 'self_qc');
  elsif p_category_key = 'not_done' or p_category_key = 'u_code_applied' then
    insert into public.field_log_report_not_done (report_id)
    values (v_report_id);
  elsif p_category_key = 'post_call' then
    insert into public.field_log_report_post_call (report_id)
    values (v_report_id);
  end if;

  return v_report_id;
end;
$$;


--
-- Name: field_log_create_draft(uuid, uuid, text, text, text, text, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.field_log_create_draft(p_created_by_user_id uuid, p_pc_org_id uuid, p_category_key text, p_subcategory_key text, p_job_number text, p_job_type text DEFAULT NULL::text, p_subject_person_id uuid DEFAULT NULL::uuid, p_subject_full_name text DEFAULT NULL::text, p_subject_tech_id text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_rule public.field_log_rules_v%rowtype;
  v_report_id uuid;
  v_existing_report_id uuid;
  v_local_today date;

  v_subject_person_id uuid;
  v_subject_full_name text;
  v_subject_tech_id text;
begin
  if p_pc_org_id is null then
    raise exception 'pc_org_id is required';
  end if;

  v_local_today := timezone('America/New_York', now())::date;

  select r.report_id
    into v_existing_report_id
  from public.field_log_report r
  where r.created_by_user_id = p_created_by_user_id
    and r.pc_org_id = p_pc_org_id
    and coalesce(r.job_number, '') = coalesce(p_job_number, '')
    and timezone('America/New_York', r.created_at)::date = v_local_today
    and r.status = 'draft'
  order by r.created_at desc
  limit 1;

  if v_existing_report_id is not null then
    return v_existing_report_id;
  end if;

  select *
    into v_rule
  from public.field_log_rules_v
  where category_key = p_category_key
    and subcategory_key is not distinct from p_subcategory_key
  limit 1;

  if v_rule.rule_id is null then
    raise exception 'No active published field log rule found for category=% subcategory=%',
      p_category_key, p_subcategory_key;
  end if;

  v_subject_person_id := p_subject_person_id;
  v_subject_full_name := nullif(trim(coalesce(p_subject_full_name, '')), '');
  v_subject_tech_id := nullif(trim(coalesce(p_subject_tech_id, '')), '');

  if v_subject_person_id is null then
    select up.person_id
      into v_subject_person_id
    from public.user_profile up
    where up.auth_user_id = p_created_by_user_id
    limit 1;
  end if;

  if v_subject_full_name is null and v_subject_person_id is not null then
    select p.full_name
      into v_subject_full_name
    from public.person p
    where p.person_id = v_subject_person_id
    limit 1;
  end if;

  if v_subject_tech_id is null and v_subject_person_id is not null then
    select a.tech_id
      into v_subject_tech_id
    from public.assignment a
    where a.person_id = v_subject_person_id
      and a.pc_org_id = p_pc_org_id
      and (a.active = true or a.active is null)
    order by coalesce(a.start_date, '1900-01-01'::date) desc
    limit 1;
  end if;

  insert into public.field_log_report (
    config_version_id,
    rule_id,
    category_key,
    subcategory_key,
    status,
    created_by_user_id,
    job_number,
    job_type,
    pc_org_id,
    subject_person_id,
    subject_full_name,
    subject_tech_id
  )
  values (
    v_rule.config_version_id,
    v_rule.rule_id,
    p_category_key,
    p_subcategory_key,
    'draft',
    p_created_by_user_id,
    p_job_number,
    p_job_type,
    p_pc_org_id,
    v_subject_person_id,
    v_subject_full_name,
    v_subject_tech_id
  )
  returning report_id into v_report_id;

  if p_category_key = 'qc' then
    insert into public.field_log_report_qc (report_id, qc_mode)
    values (v_report_id, 'self_qc');
  elsif p_category_key = 'not_done' or p_category_key = 'u_code_applied' then
    insert into public.field_log_report_not_done (report_id)
    values (v_report_id);
  elsif p_category_key = 'post_call' then
    insert into public.field_log_report_post_call (report_id)
    values (v_report_id);
  end if;

  return v_report_id;
end;
$$;


--
-- Name: field_log_create_draft_from_published(text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.field_log_create_draft_from_published(p_label text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_created_by uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
declare
  v_published uuid;
  v_new uuid;
begin
  select config_version_id
    into v_published
  from public.field_log_config_version
  where status = 'published'
  limit 1;

  insert into public.field_log_config_version (status, label, notes, created_by)
  values (
    'draft',
    coalesce(p_label, 'Field Log Draft'),
    p_notes,
    p_created_by
  )
  returning config_version_id into v_new;

  if v_published is null then
    return v_new;
  end if;

  insert into public.field_log_category (
    category_key, label, description, sort_order, is_active, config_version_id
  )
  select category_key, label, description, sort_order, is_active, v_new
  from public.field_log_category
  where config_version_id = v_published;

  insert into public.field_log_subcategory (
    category_key, subcategory_key, label, description, sort_order, is_active, config_version_id
  )
  select category_key, subcategory_key, label, description, sort_order, is_active, v_new
  from public.field_log_subcategory
  where config_version_id = v_published;

  insert into public.field_log_ucode (
    ucode, label, description, sort_order, is_active, config_version_id
  )
  select ucode, label, description, sort_order, is_active, v_new
  from public.field_log_ucode
  where config_version_id = v_published;

  insert into public.field_log_ucode_group (
    ucode_group_key, label, description, sort_order, is_active, config_version_id
  )
  select ucode_group_key, label, description, sort_order, is_active, v_new
  from public.field_log_ucode_group
  where config_version_id = v_published;

  insert into public.field_log_ucode_group_item (
    ucode_group_key, ucode, sort_order, is_active, config_version_id
  )
  select ucode_group_key, ucode, sort_order, is_active, v_new
  from public.field_log_ucode_group_item
  where config_version_id = v_published;

  insert into public.field_log_photo_label (
    photo_label_key, label, description, sort_order, is_active, config_version_id
  )
  select photo_label_key, label, description, sort_order, is_active, v_new
  from public.field_log_photo_label
  where config_version_id = v_published;

  insert into public.field_log_rule (
    category_key,
    subcategory_key,
    show_subcategory,
    require_subcategory,
    show_ucode,
    require_ucode,
    ucode_group_key,
    xm_allowed,
    comment_required,
    min_photo_count,
    location_required,
    location_compare_required,
    location_tolerance_m,
    allow_technician_submit,
    allow_supervisor_submit,
    active_text_instruction,
    sort_order,
    is_active,
    config_version_id
  )
  select
    category_key,
    subcategory_key,
    show_subcategory,
    require_subcategory,
    show_ucode,
    require_ucode,
    ucode_group_key,
    xm_allowed,
    comment_required,
    min_photo_count,
    location_required,
    location_compare_required,
    location_tolerance_m,
    allow_technician_submit,
    allow_supervisor_submit,
    active_text_instruction,
    sort_order,
    is_active,
    v_new
  from public.field_log_rule
  where config_version_id = v_published;

  insert into public.field_log_rule_context (
    config_version_id,
    submission_type_key,
    job_type,
    situation_key,
    situation_label,
    category_key,
    subcategory_key,
    rule_id,
    sort_order,
    is_active
  )
  select
    v_new,
    oldrc.submission_type_key,
    oldrc.job_type,
    oldrc.situation_key,
    oldrc.situation_label,
    oldrc.category_key,
    oldrc.subcategory_key,
    nr.rule_id,
    oldrc.sort_order,
    oldrc.is_active
  from public.field_log_rule_context oldrc
  join public.field_log_rule oldr
    on oldr.rule_id = oldrc.rule_id
  join public.field_log_rule nr
    on nr.config_version_id = v_new
   and nr.category_key = oldr.category_key
   and nr.subcategory_key is not distinct from oldr.subcategory_key
  where oldrc.config_version_id = v_published;

  insert into public.field_log_rule_photo_requirement (
    rule_id,
    photo_label_key,
    required,
    sort_order,
    is_active
  )
  select
    nr.rule_id,
    oldpr.photo_label_key,
    oldpr.required,
    oldpr.sort_order,
    oldpr.is_active
  from public.field_log_rule oldr
  join public.field_log_rule_photo_requirement oldpr
    on oldpr.rule_id = oldr.rule_id
  join public.field_log_rule nr
    on nr.config_version_id = v_new
   and nr.category_key = oldr.category_key
   and nr.subcategory_key is not distinct from oldr.subcategory_key
  where oldr.config_version_id = v_published;

  return v_new;
end;
$$;


--
-- Name: field_log_deny_report(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.field_log_deny_report(p_report_id uuid, p_action_by_user_id uuid, p_note text) RETURNS public.field_log_report
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_report public.field_log_report%rowtype;
begin
  if nullif(trim(p_note), '') is null then
    raise exception 'Denial note is required.';
  end if;

  update public.field_log_report
     set status = 'rejected',
         followup_note = p_note,
         edit_unlocked = false,
         approved_at = null
   where report_id = p_report_id
     and status in ('pending_review', 'sup_followup_required')
  returning * into v_report;

  if v_report.report_id is null then
    raise exception 'Field Log is not in a denial-ready state.';
  end if;

  insert into public.field_log_review_action (
    report_id,
    action_by_user_id,
    action_type,
    note
  )
  values (
    p_report_id,
    p_action_by_user_id,
    'reject',
    p_note
  );

  return v_report;
end;
$$;


--
-- Name: field_log_finalize_verdict(uuid, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.field_log_finalize_verdict(p_report_id uuid, p_action_by_user_id uuid, p_verdict text, p_note text DEFAULT NULL::text) RETURNS public.field_log_report
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_report public.field_log_report%rowtype;
  v_action_type text;
  v_qc_decision text;
  v_event_type text;
begin
  if p_verdict not in (
    'pass',
    'fail_supervisor_corrected',
    'fail_tech_followup',
    'no_action',
    'closed_by_leadership'
  ) then
    raise exception 'Invalid Field Log verdict: %', p_verdict;
  end if;

  if p_verdict in ('fail_tech_followup', 'closed_by_leadership')
     and nullif(trim(coalesce(p_note, '')), '') is null then
    raise exception '% verdict requires a note.', p_verdict;
  end if;

  if p_verdict = 'fail_tech_followup' then
    update public.field_log_report
       set status = 'tech_followup_required',
           submitted_at = coalesce(submitted_at, now()),
           followup_requested_by_user_id = p_action_by_user_id,
           followup_note = p_note,
           edit_unlocked = true,
           locked = false,
           updated_at = now()
     where report_id = p_report_id
       and locked = false
     returning * into v_report;

    v_action_type := 'tech_followup';
    v_qc_decision := 'tech_followup';
    v_event_type := 'tech_followup_opened';

  elsif p_verdict = 'closed_by_leadership' then
    update public.field_log_report
       set status = 'closed',
           submitted_at = coalesce(submitted_at, now()),
           approval_owner_user_id = p_action_by_user_id,
           approved_at = now(),
           followup_requested_by_user_id = null,
           followup_note = p_note,
           edit_unlocked = false,
           locked = true,
           updated_at = now()
     where report_id = p_report_id
       and locked = false
     returning * into v_report;

    v_action_type := 'close';
    v_qc_decision := 'closed';
    v_event_type := 'closed_by_leadership';

  else
    if exists (
      select 1
      from public.field_log_report r
      where r.report_id = p_report_id
        and coalesce(r.xm_declared, false) = true
        and coalesce(r.xm_link_valid, false) = false
    ) then
      raise exception 'XM evidence cannot be finalized without a validated XM link.';
    end if;

    update public.field_log_report
       set status = 'approved',
           submitted_at = coalesce(submitted_at, now()),
           approval_owner_user_id = p_action_by_user_id,
           approved_at = now(),
           followup_requested_by_user_id = null,
           followup_note = p_note,
           edit_unlocked = false,
           locked = true,
           updated_at = now()
     where report_id = p_report_id
       and locked = false
     returning * into v_report;

    v_action_type := case when p_verdict = 'no_action' then 'reject' else 'approve' end;
    v_qc_decision := case when p_verdict = 'no_action' then 'rejected' else 'approved' end;
    v_event_type := 'approved';
  end if;

  if v_report.report_id is null then
    raise exception 'Verdict finalize failed for report: %', p_report_id;
  end if;

  if v_report.category_key = 'qc' then
    update public.field_log_report_qc
       set supervisor_review_decision = v_qc_decision,
           approval_note = p_note
     where report_id = p_report_id;
  end if;

  insert into public.field_log_review_action (
    report_id,
    action_type,
    action_by_user_id,
    note
  )
  values (
    p_report_id,
    v_action_type,
    p_action_by_user_id,
    p_note
  );

  insert into public.field_log_event (
    report_id,
    event_type,
    from_status,
    to_status,
    actor_user_id,
    note,
    meta
  )
  values (
    p_report_id,
    v_event_type,
    null,
    v_report.status,
    p_action_by_user_id,
    p_note,
    jsonb_build_object(
      'verdict', p_verdict,
      'review_action_type', v_action_type
    )
  );

  return v_report;
end;
$$;


--
-- Name: field_log_get_my_submissions(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.field_log_get_my_submissions(p_created_by_user_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
select coalesce(
  jsonb_agg(
    jsonb_build_object(
      'report_id', m.report_id,
      'created_by_user_id', m.created_by_user_id,
      'status', m.status,
      'category_key', m.category_key,
      'category_label', m.category_label,
      'subcategory_key', m.subcategory_key,
      'subcategory_label', m.subcategory_label,
      'job_number', m.job_number,
      'job_type', m.job_type,
      'submitted_at', m.submitted_at,
      'photo_count', m.photo_count,
      'edit_unlocked', m.edit_unlocked,
      'locked', m.locked,
      'followup_note', m.followup_note,

      'tech_person_id', m.tech_person_id,
      'tech_full_name', m.tech_full_name,
      'tech_id', m.tech_id,
      'approved_by_full_name', m.approved_by_full_name,
      'evidence_declared', m.evidence_declared,
      'xm_declared', m.xm_declared,
      'xm_link_valid', m.xm_link_valid,
      'min_photo_count', m.min_photo_count,
      'evidence_badge', m.evidence_badge
    )
    order by m.submitted_at desc nulls last, m.report_id desc
  ),
  '[]'::jsonb
)
from public.field_log_my_submissions_v m
where m.created_by_user_id = p_created_by_user_id;
$$;


--
-- Name: field_log_get_report_detail(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.field_log_get_report_detail(p_report_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
select jsonb_build_object(
  'report_id', d.report_id,
  'config_version_id', d.config_version_id,
  'rule_id', d.rule_id,

  'category_key', d.category_key,
  'category_label', d.category_label,
  'subcategory_key', d.subcategory_key,
  'subcategory_label', d.subcategory_label,

  'status', d.status,

  'entry_source_role',
  case
    when d.created_by_user_id is null then null
    when d.tech_person_id is not null
      and exists (
        select 1
        from public.user_profile up
        where up.auth_user_id = d.created_by_user_id
          and (
            up.person_id = d.tech_person_id
            or up.core_person_id = d.tech_person_id
          )
      )
      then 'TECH'
    else 'ITG_SUPERVISOR'
  end,

'workflow_mode',
  case
    when d.created_by_user_id is null then null
    when d.tech_person_id is not null
      and exists (
        select 1
        from public.user_profile up
        where up.auth_user_id = d.created_by_user_id
          and (
            up.person_id = d.tech_person_id
            or up.core_person_id = d.tech_person_id
          )
      )
      then 'tech_submission'
    else 'supervisor_verdict'
  end,

'requires_approval_to_close',
  (
    d.tech_person_id is not null
    and exists (
      select 1
      from public.user_profile up
      where up.auth_user_id = d.created_by_user_id
        and (
          up.person_id = d.tech_person_id
          or up.core_person_id = d.tech_person_id
        )
    )
  ),

'can_close_on_entry',
  (
    d.created_by_user_id is not null
    and not (
      d.tech_person_id is not null
      and exists (
        select 1
        from public.user_profile up
        where up.auth_user_id = d.created_by_user_id
          and (
            up.person_id = d.tech_person_id
            or up.core_person_id = d.tech_person_id
          )
      )
    )
  ),

  'created_at', d.created_at,
  'updated_at', d.updated_at,
  'created_by_user_id', d.created_by_user_id,
  'submitted_at', d.submitted_at,

  'job_number', d.job_number,
  'job_type', d.job_type,
  'comment', d.comment,

  'evidence_declared', d.evidence_declared,
  'xm_declared', d.xm_declared,
  'xm_link', d.xm_link,
  'xm_link_valid', d.xm_link_valid,
  'xm_verified_by_user_id', d.xm_verified_by_user_id,
  'xm_verified_at', d.xm_verified_at,

  'photo_count', d.photo_count,
  'photo_deleted_at', d.photo_deleted_at,

  'gps_lat', d.gps_lat,
  'gps_lng', d.gps_lng,
  'gps_accuracy_m', d.gps_accuracy_m,
  'location_captured_at', d.location_captured_at,

  'approval_owner_user_id', d.approval_owner_user_id,
  'approved_at', d.approved_at,
  'followup_requested_by_user_id', d.followup_requested_by_user_id,
  'followup_note', d.followup_note,

  'edit_unlocked', d.edit_unlocked,
  'locked', d.locked,

  'rule', jsonb_build_object(
    'show_subcategory', d.show_subcategory,
    'require_subcategory', d.require_subcategory,
    'show_ucode', d.show_ucode,
    'require_ucode', d.require_ucode,
    'ucode_group_key', d.ucode_group_key,
    'ucodes', d.ucodes_json,
    'xm_allowed', d.xm_allowed,
    'comment_required', d.comment_required,
    'min_photo_count', d.min_photo_count,
    'location_required', d.location_required,
    'location_compare_required', d.location_compare_required,
    'location_tolerance_m', d.location_tolerance_m,
    'allow_technician_submit', d.allow_technician_submit,
    'allow_supervisor_submit', d.allow_supervisor_submit,
    'active_text_instruction', d.active_text_instruction,
    'photo_requirements', d.photo_requirements_json
  ),

  'qc', jsonb_build_object(
    'qc_mode', d.qc_mode,
    'supervisor_review_decision', d.supervisor_review_decision,
    'approval_note', d.qc_approval_note
  ),

  'not_done', jsonb_build_object(
    'selected_ucode', d.selected_ucode,
    'customer_contact_attempted', d.customer_contact_attempted,
    'access_issue', d.access_issue,
    'safety_issue', d.safety_issue,
    'escalation_required', d.escalation_required,
    'escalation_type', d.escalation_type
  ),

  'post_call', jsonb_build_object(
    'risk_level', d.risk_level,
    'tnps_risk_flag', d.tnps_risk_flag,
    'followup_recommended', d.followup_recommended
  ),

  'attachments', d.attachments_json,
  'actions', d.actions_json,

  'created_by_full_name', d.created_by_full_name,
  'tech_person_id', d.tech_person_id,
  'tech_full_name', d.tech_full_name,
  'tech_id', d.tech_id,
  'xm_verified_by_full_name', d.xm_verified_by_full_name,
  'approved_by_full_name', d.approved_by_full_name,
  'followup_requested_by_full_name', d.followup_requested_by_full_name
)
from public.field_log_report_detail_v d
where d.report_id = p_report_id;
$$;


--
-- Name: field_log_get_review_queue(uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.field_log_get_review_queue(p_pc_org_id uuid, p_status text DEFAULT NULL::text, p_category_key text DEFAULT NULL::text, p_job_number text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
select coalesce(
  jsonb_agg(
    jsonb_build_object(
      'report_id', q.report_id,
      'status', q.status,
      'category_key', q.category_key,
      'category_label', q.category_label,
      'subcategory_key', q.subcategory_key,
      'subcategory_label', q.subcategory_label,
      'job_number', q.job_number,
      'job_type', q.job_type,
      'created_by_user_id', q.created_by_user_id,
      'submitted_at', q.submitted_at,
      'photo_count', q.photo_count,
      'min_photo_count', q.min_photo_count,
      'evidence_declared', q.evidence_declared,
      'xm_declared', q.xm_declared,
      'xm_link', q.xm_link,
      'xm_link_valid', q.xm_link_valid,
      'approval_owner_user_id', q.approval_owner_user_id,
      'followup_requested_by_user_id', q.followup_requested_by_user_id,
      'locked', q.locked,
      'comment', q.comment,
      'evidence_badge', q.evidence_badge,
      'last_action_type', q.last_action_type,
      'last_action_at', q.last_action_at,
      'last_action_by_user_id', q.last_action_by_user_id,
      'last_action_note', q.last_action_note,
      'pc_org_id', q.pc_org_id,
      'tech_person_id', q.tech_person_id,
      'tech_full_name', q.tech_full_name,
      'tech_id', q.tech_id,
      'tech_office', wf.office_name,
      'office', wf.office_name,
      'approved_by_full_name', q.approved_by_full_name,
      'last_action_by_person_id', q.last_action_by_person_id,
      'last_action_by_full_name', q.last_action_by_full_name
    )
    order by
      case
        when q.status = 'pending_review' then 1
        when q.status = 'sup_followup_required' then 2
        when q.status = 'tech_followup_required' then 3
        when q.status = 'approved' then 4
        else 9
      end,
      q.submitted_at desc nulls last,
      q.report_id
  ),
  '[]'::jsonb
)
from public.field_log_review_queue_detail_v q
left join lateral (
  select w.office_name
  from public.workforce_current_v w
  where w.pc_org_id = q.pc_org_id
    and w.person_id = q.tech_person_id
  order by
    w.is_primary desc nulls last,
    w.is_active desc nulls last,
    w.updated_at desc nulls last
  limit 1
) wf on true
where q.pc_org_id = p_pc_org_id
  and (p_status is null or q.status = p_status)
  and (p_category_key is null or q.category_key = p_category_key)
  and (p_job_number is null or q.job_number = p_job_number);
$$;


--
-- Name: field_log_get_timeline(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.field_log_get_timeline(p_report_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
select coalesce(
  jsonb_agg(
    jsonb_build_object(
      'event_id', e.field_log_event_id,
      'event_at', e.event_at,
      'event_type', e.event_type,
      'from_status', e.from_status,
      'to_status', e.to_status,
      'actor_user_id', e.actor_user_id,
      'actor_person_id', e.actor_person_id,
      'actor_full_name', e.actor_full_name,
      'note', e.note,
      'meta', e.meta
    )
    order by e.event_at
  ),
  '[]'::jsonb
)
from public.field_log_timeline_v e
where e.report_id = p_report_id;
$$;


--
-- Name: field_log_is_approvable(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.field_log_is_approvable(p_report_id uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select case
    when r.report_id is null then false
    when r.locked = true then false
    when r.status not in ('pending_review','sup_followup_required') then false
    when r.photo_count >= fr.min_photo_count then true
    when coalesce(r.xm_link_valid, false) = true then true
    else false
  end
  from public.field_log_report r
  join public.field_log_rules_v fr
    on fr.rule_id = r.rule_id
  where r.report_id = p_report_id
$$;


--
-- Name: field_log_report_post_call; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.field_log_report_post_call (
    report_id uuid NOT NULL,
    risk_level text,
    tnps_risk_flag boolean DEFAULT true NOT NULL,
    followup_recommended boolean DEFAULT false NOT NULL,
    technician_comments text,
    customer_contact_feedback text,
    lessons_takeaways text,
    case_status text DEFAULT 'open'::text NOT NULL,
    closed_at timestamp with time zone,
    reopened_at timestamp with time zone,
    CONSTRAINT field_log_report_post_call_case_status_check CHECK ((case_status = ANY (ARRAY['open'::text, 'in_progress'::text, 'pending_customer'::text, 'resolved'::text, 'closed'::text, 'reopened'::text]))),
    CONSTRAINT field_log_report_post_call_risk_level_check CHECK ((risk_level = ANY (ARRAY['fyi'::text, 'watch'::text, 'action_needed'::text])))
);


--
-- Name: field_log_manage_post_call_case(uuid, text, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.field_log_manage_post_call_case(p_report_id uuid, p_case_status text DEFAULT NULL::text, p_note text DEFAULT NULL::text, p_comment_type text DEFAULT 'case_update'::text, p_technician_comments text DEFAULT NULL::text, p_customer_contact_feedback text DEFAULT NULL::text, p_lessons_takeaways text DEFAULT NULL::text) RETURNS public.field_log_report_post_call
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_report public.field_log_report%rowtype;
  v_before public.field_log_report_post_call%rowtype;
  v_after public.field_log_report_post_call%rowtype;
  v_actor uuid := auth.uid();
begin
  select *
    into v_report
  from public.field_log_report
  where report_id = p_report_id;

  if v_report.report_id is null then
    raise exception 'Report not found: %', p_report_id;
  end if;

  if v_report.category_key <> 'post_call' then
    raise exception 'Only Service Follow Up cases can be managed here.';
  end if;

  select *
    into v_before
  from public.field_log_report_post_call
  where report_id = p_report_id;

  if v_before.report_id is null then
    raise exception 'Service Follow Up detail not found: %', p_report_id;
  end if;

  if p_case_status is not null
     and p_case_status not in ('open','in_progress','pending_customer','resolved','closed','reopened') then
    raise exception 'Invalid case_status: %', p_case_status;
  end if;

  update public.field_log_report_post_call pc
     set technician_comments = coalesce(p_technician_comments, pc.technician_comments),
         customer_contact_feedback = coalesce(p_customer_contact_feedback, pc.customer_contact_feedback),
         lessons_takeaways = coalesce(p_lessons_takeaways, pc.lessons_takeaways),
         case_status = coalesce(p_case_status, pc.case_status),
         closed_at = case
           when p_case_status = 'closed' and pc.closed_at is null then now()
           when p_case_status in ('open','in_progress','pending_customer','resolved','reopened') then null
           else pc.closed_at
         end,
         reopened_at = case
           when p_case_status = 'reopened' then now()
           else pc.reopened_at
         end
   where pc.report_id = p_report_id
  returning pc.* into v_after;

  if p_note is not null and btrim(p_note) <> '' then
    insert into public.field_log_comment (
      report_id,
      author_user_id,
      comment_type,
      message
    )
    values (
      p_report_id,
      v_actor,
      coalesce(nullif(btrim(p_comment_type), ''), 'case_update'),
      btrim(p_note)
    );
  end if;

  if p_note is not null and btrim(p_note) <> '' then
    insert into public.field_log_event (
      report_id,
      event_type,
      from_status,
      to_status,
      actor_user_id,
      note,
      meta
    )
    values (
      p_report_id,
      coalesce(nullif(btrim(p_comment_type), ''), 'case_update'),
      v_before.case_status,
      v_after.case_status,
      v_actor,
      btrim(p_note),
      jsonb_build_object('bucket', 'internal_note', 'case_status', v_after.case_status)
    );
  end if;

  if p_case_status is not null and p_case_status is distinct from v_before.case_status then
    insert into public.field_log_event (
      report_id,
      event_type,
      from_status,
      to_status,
      actor_user_id,
      note,
      meta
    )
    values (
      p_report_id,
      'case_status_changed',
      v_before.case_status,
      v_after.case_status,
      v_actor,
      null,
      jsonb_build_object('bucket', 'workflow')
    );
  end if;

  return v_after;
end;
$$;


--
-- Name: field_log_reassign_followup(uuid, uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.field_log_reassign_followup(p_report_id uuid, p_action_by_user_id uuid, p_followup_owner_person_id uuid, p_note text DEFAULT NULL::text) RETURNS public.field_log_report
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_report public.field_log_report%rowtype;
  v_from_owner_person_id uuid;
begin
  if p_report_id is null then
    raise exception 'report_id is required.';
  end if;

  if p_action_by_user_id is null then
    raise exception 'action_by_user_id is required.';
  end if;

  if p_followup_owner_person_id is null then
    raise exception 'followup_owner_person_id is required.';
  end if;

  select r.followup_owner_person_id
    into v_from_owner_person_id
  from public.field_log_report r
  where r.report_id = p_report_id;

  update public.field_log_report
     set followup_owner_person_id = p_followup_owner_person_id,
         followup_assigned_at = now(),
         followup_assigned_by_user_id = p_action_by_user_id,
         followup_assignment_note = p_note,
         updated_at = now()
   where report_id = p_report_id
     and status in ('tech_followup_required', 'sup_followup_required')
     and locked = false
   returning * into v_report;

  if v_report.report_id is null then
    raise exception 'Follow-up reassignment failed for report: %', p_report_id;
  end if;

  insert into public.field_log_review_action (
    report_id,
    action_type,
    action_by_user_id,
    note
  )
  values (
    p_report_id,
    'reassign_followup',
    p_action_by_user_id,
    p_note
  );

  insert into public.field_log_event (
    report_id,
    event_type,
    from_status,
    to_status,
    actor_user_id,
    note,
    meta
  )
  values (
    p_report_id,
    'followup_reassigned',
    v_report.status,
    v_report.status,
    p_action_by_user_id,
    p_note,
    jsonb_build_object(
      'from_followup_owner_person_id', v_from_owner_person_id,
      'to_followup_owner_person_id', p_followup_owner_person_id,
      'review_action_type', 'reassign_followup'
    )
  );

  return v_report;
end;
$$;


--
-- Name: field_log_refresh_photo_count(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.field_log_refresh_photo_count(p_report_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
begin
  update public.field_log_report r
     set photo_count = coalesce((
       select count(*)
       from public.field_log_attachment a
       where a.report_id = p_report_id
         and a.deleted_at is null
     ), 0)
   where r.report_id = p_report_id;
end;
$$;


--
-- Name: field_log_request_sup_followup(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.field_log_request_sup_followup(p_report_id uuid, p_action_by_user_id uuid, p_note text DEFAULT NULL::text) RETURNS public.field_log_report
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_report public.field_log_report%rowtype;
begin
  update public.field_log_report
     set status = 'sup_followup_required',
         approval_owner_user_id = p_action_by_user_id,
         followup_requested_by_user_id = p_action_by_user_id,
         followup_note = p_note,
         edit_unlocked = false
   where report_id = p_report_id
     and status = 'pending_review'
     and locked = false
  returning * into v_report;

  if v_report.report_id is null then
    raise exception 'Supervisor follow-up failed for report: %', p_report_id;
  end if;

  if v_report.category_key = 'qc' then
    update public.field_log_report_qc
       set supervisor_review_decision = 'sup_followup',
           approval_note = p_note
     where report_id = p_report_id;
  end if;

  insert into public.field_log_review_action (
    report_id, action_type, action_by_user_id, note
  )
  values (
    p_report_id, 'sup_followup', p_action_by_user_id, p_note
  );

  return v_report;
end;
$$;


--
-- Name: field_log_request_tech_followup(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.field_log_request_tech_followup(p_report_id uuid, p_action_by_user_id uuid, p_note text DEFAULT NULL::text) RETURNS public.field_log_report
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_report public.field_log_report%rowtype;
begin
  update public.field_log_report
     set status = 'tech_followup_required',
         followup_requested_by_user_id = p_action_by_user_id,
         followup_note = p_note,
         edit_unlocked = true,
         xm_declared = false,
         xm_link = null,
         xm_link_valid = false,
         xm_verified_by_user_id = null,
         xm_verified_at = null
   where report_id = p_report_id
     and status in ('pending_review','sup_followup_required')
     and locked = false
  returning * into v_report;

  if v_report.report_id is null then
    raise exception 'Tech follow-up failed for report: %', p_report_id;
  end if;

  if v_report.category_key = 'qc' then
    update public.field_log_report_qc
       set supervisor_review_decision = 'tech_followup',
           approval_note = p_note
     where report_id = p_report_id;
  end if;

  insert into public.field_log_review_action (
    report_id, action_type, action_by_user_id, note
  )
  values (
    p_report_id, 'tech_followup', p_action_by_user_id, p_note
  );

  return v_report;
end;
$$;


--
-- Name: field_log_resubmit_after_tech_followup(uuid, text, numeric, numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.field_log_resubmit_after_tech_followup(p_report_id uuid, p_comment text DEFAULT NULL::text, p_gps_lat numeric DEFAULT NULL::numeric, p_gps_lng numeric DEFAULT NULL::numeric, p_gps_accuracy_m numeric DEFAULT NULL::numeric) RETURNS public.field_log_report
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_report public.field_log_report%rowtype;
begin
  update public.field_log_report
     set status = 'pending_review',
         comment = coalesce(p_comment, comment),
         evidence_declared = 'field_upload',
         xm_declared = false,
         xm_link = null,
         xm_link_valid = false,
         xm_verified_by_user_id = null,
         xm_verified_at = null,
         gps_lat = p_gps_lat,
         gps_lng = p_gps_lng,
         gps_accuracy_m = p_gps_accuracy_m,
         location_captured_at = case
           when p_gps_lat is not null and p_gps_lng is not null then now()
           else location_captured_at
         end,
         edit_unlocked = false
   where report_id = p_report_id
     and status = 'tech_followup_required'
     and locked = false
  returning * into v_report;

  if v_report.report_id is null then
    raise exception 'Resubmit failed for report: %', p_report_id;
  end if;

  insert into public.field_log_review_action (
    report_id, action_type, action_by_user_id, note
  )
  values (
    p_report_id, 'resubmit', v_report.created_by_user_id, p_comment
  );

  return v_report;
end;
$$;


--
-- Name: field_log_runtime_bootstrap(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.field_log_runtime_bootstrap() RETURNS jsonb
    LANGUAGE plpgsql STABLE
    AS $$
declare
  v_config_id uuid;
begin
  -- ADMIN DECIDES: use latest draft first, otherwise fall back to published
  select config_version_id
    into v_config_id
  from public.field_log_config_version
  where status = 'draft'
  order by version_no desc, created_at desc
  limit 1;

  if v_config_id is null then
    select config_version_id
      into v_config_id
    from public.field_log_config_version
    where status = 'published'
    order by version_no desc, published_at desc nulls last, created_at desc
    limit 1;
  end if;

  if v_config_id is null then
    return jsonb_build_object(
      'config', null,
      'categories', '[]'::jsonb,
      'subcategories', '[]'::jsonb,
      'rules', '[]'::jsonb,
      'ucodes', '[]'::jsonb
    );
  end if;

  return jsonb_build_object(
    'config', (
      select jsonb_build_object(
        'config_version_id', c.config_version_id,
        'version_no', c.version_no,
        'label', c.label,
        'notes', c.notes,
        'published_at', c.published_at
      )
      from public.field_log_config_version c
      where c.config_version_id = v_config_id
    ),

    'categories', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'category_key', x.category_key,
            'label', x.label,
            'description', x.description,
            'sort_order', x.sort_order
          )
          order by x.sort_order, x.label
        ),
        '[]'::jsonb
      )
      from public.field_log_category x
      where x.config_version_id = v_config_id
        and x.is_active = true
    ),

    'subcategories', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'category_key', x.category_key,
            'subcategory_key', x.subcategory_key,
            'label', x.label,
            'description', x.description,
            'sort_order', x.sort_order
          )
          order by x.category_key, x.sort_order, x.label
        ),
        '[]'::jsonb
      )
      from public.field_log_subcategory x
      where x.config_version_id = v_config_id
        and x.is_active = true
    ),

    'rules', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'rule_id', r.rule_id,
            'category_key', r.category_key,
            'category_label', c.label,
            'subcategory_key', r.subcategory_key,
            'subcategory_label', s.label,
            'show_subcategory', r.show_subcategory,
            'require_subcategory', r.require_subcategory,
            'show_ucode', r.show_ucode,
            'require_ucode', r.require_ucode,
            'ucode_group_key', r.ucode_group_key,
            'ucodes', coalesce((
              select jsonb_agg(
                jsonb_build_object(
                  'ucode', u.ucode,
                  'label', u.label,
                  'sort_order', gi.sort_order
                )
                order by gi.sort_order, u.ucode
              )
              from public.field_log_ucode_group_item gi
              join public.field_log_ucode u
                on u.config_version_id = gi.config_version_id
               and u.ucode = gi.ucode
               and u.is_active = true
              where gi.config_version_id = v_config_id
                and gi.ucode_group_key = r.ucode_group_key
                and gi.is_active = true
            ), '[]'::jsonb),
            'xm_allowed', r.xm_allowed,
            'comment_required', r.comment_required,
            'min_photo_count', r.min_photo_count,
            'location_required', r.location_required,
            'location_compare_required', r.location_compare_required,
            'location_tolerance_m', r.location_tolerance_m,
            'allow_technician_submit', r.allow_technician_submit,
            'allow_supervisor_submit', r.allow_supervisor_submit,
            'active_text_instruction', r.active_text_instruction,
            'photo_requirements', coalesce((
              select jsonb_agg(
                jsonb_build_object(
                  'photo_label_key', pr.photo_label_key,
                  'label', pl.label,
                  'required', pr.required,
                  'sort_order', pr.sort_order
                )
                order by pr.sort_order, pr.photo_label_key
              )
              from public.field_log_rule_photo_requirement pr
              left join public.field_log_photo_label pl
                on pl.config_version_id = v_config_id
               and pl.photo_label_key = pr.photo_label_key
               and pl.is_active = true
              where pr.rule_id = r.rule_id
                and pr.is_active = true
            ), '[]'::jsonb),
            'sort_order', r.sort_order
          )
          order by r.category_key, coalesce(r.subcategory_key, ''), r.sort_order, r.rule_id
        ),
        '[]'::jsonb
      )
      from public.field_log_rule r
      left join public.field_log_category c
        on c.config_version_id = r.config_version_id
       and c.category_key = r.category_key
      left join public.field_log_subcategory s
        on s.config_version_id = r.config_version_id
       and s.category_key = r.category_key
       and s.subcategory_key is not distinct from r.subcategory_key
      where r.config_version_id = v_config_id
        and r.is_active = true
    ),

    'ucodes', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'ucode', u.ucode,
            'label', u.label,
            'sort_order', u.sort_order
          )
          order by u.sort_order, u.ucode
        ),
        '[]'::jsonb
      )
      from public.field_log_ucode u
      where u.config_version_id = v_config_id
        and u.is_active = true
    )
  );
end;
$$;


--
-- Name: field_log_set_base_fields(uuid, text, text, text, text, boolean, numeric, numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.field_log_set_base_fields(p_report_id uuid, p_job_number text DEFAULT NULL::text, p_job_type text DEFAULT NULL::text, p_comment text DEFAULT NULL::text, p_evidence_declared text DEFAULT NULL::text, p_xm_declared boolean DEFAULT NULL::boolean, p_gps_lat numeric DEFAULT NULL::numeric, p_gps_lng numeric DEFAULT NULL::numeric, p_gps_accuracy_m numeric DEFAULT NULL::numeric) RETURNS public.field_log_report
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_report public.field_log_report%rowtype;
begin
  if p_evidence_declared is not null
     and p_evidence_declared not in ('field_upload','xm_platform','none') then
    raise exception 'Invalid evidence_declared value: %', p_evidence_declared;
  end if;

  update public.field_log_report
     set job_number = coalesce(p_job_number, job_number),
         job_type = coalesce(p_job_type, job_type),
         comment = coalesce(p_comment, comment),
         evidence_declared = coalesce(p_evidence_declared, evidence_declared),
         xm_declared = case
           when p_xm_declared is null then xm_declared
           else p_xm_declared
         end,
         gps_lat = coalesce(p_gps_lat, gps_lat),
         gps_lng = coalesce(p_gps_lng, gps_lng),
         gps_accuracy_m = coalesce(p_gps_accuracy_m, gps_accuracy_m),
         location_captured_at = case
           when p_gps_lat is not null and p_gps_lng is not null then now()
           else location_captured_at
         end
   where report_id = p_report_id
     and (
       status = 'draft'
       or (status = 'tech_followup_required' and edit_unlocked = true)
     )
  returning * into v_report;

  if v_report.report_id is null then
    raise exception 'Base field update failed for report: %', p_report_id;
  end if;

  -- if tech follow-up is active, XM path is permanently closed
  if v_report.status = 'tech_followup_required' then
    update public.field_log_report
       set evidence_declared = case
             when evidence_declared = 'xm_platform' then 'field_upload'
             else evidence_declared
           end,
           xm_declared = false,
           xm_link = null,
           xm_link_valid = false,
           xm_verified_by_user_id = null,
           xm_verified_at = null
     where report_id = p_report_id
    returning * into v_report;
  end if;

  return v_report;
end;
$$;


--
-- Name: field_log_report_not_done; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.field_log_report_not_done (
    report_id uuid NOT NULL,
    selected_ucode text,
    customer_contact_attempted boolean,
    access_issue boolean,
    safety_issue boolean,
    escalation_required boolean,
    escalation_type text
);


--
-- Name: field_log_set_not_done_detail(uuid, text, boolean, boolean, boolean, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.field_log_set_not_done_detail(p_report_id uuid, p_selected_ucode text DEFAULT NULL::text, p_customer_contact_attempted boolean DEFAULT NULL::boolean, p_access_issue boolean DEFAULT NULL::boolean, p_safety_issue boolean DEFAULT NULL::boolean, p_escalation_required boolean DEFAULT NULL::boolean, p_escalation_type text DEFAULT NULL::text) RETURNS public.field_log_report_not_done
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_report public.field_log_report%rowtype;
  v_row public.field_log_report_not_done%rowtype;
  v_ucode_allowed boolean;
begin
  select *
    into v_report
  from public.field_log_report
  where report_id = p_report_id;

  if v_report.report_id is null then
    raise exception 'Report not found: %', p_report_id;
  end if;

  if not (
    v_report.status = 'draft'
    or (v_report.status = 'tech_followup_required' and v_report.edit_unlocked = true)
  ) then
    raise exception 'Report not editable for not_done detail: %', p_report_id;
  end if;

  if p_selected_ucode is not null then
    select exists (
      select 1
      from public.field_log_rules_v r
      cross join lateral jsonb_array_elements(coalesce(r.ucodes_json, '[]'::jsonb)) x
      where r.rule_id = v_report.rule_id
        and x ->> 'ucode' = p_selected_ucode
    )
    into v_ucode_allowed;

    if coalesce(v_ucode_allowed, false) = false then
      raise exception 'Selected U-Code % is not allowed by current rule for report %',
        p_selected_ucode, p_report_id;
    end if;
  end if;

  update public.field_log_report_not_done nd
     set selected_ucode = coalesce(p_selected_ucode, selected_ucode),
         customer_contact_attempted = coalesce(p_customer_contact_attempted, customer_contact_attempted),
         access_issue = coalesce(p_access_issue, access_issue),
         safety_issue = coalesce(p_safety_issue, safety_issue),
         escalation_required = coalesce(p_escalation_required, escalation_required),
         escalation_type = coalesce(p_escalation_type, escalation_type)
   where nd.report_id = p_report_id
  returning * into v_row;

  if v_row.report_id is null then
    raise exception 'Not Done detail update failed for report: %', p_report_id;
  end if;

  return v_row;
end;
$$;


--
-- Name: field_log_set_post_call_detail(uuid, text, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.field_log_set_post_call_detail(p_report_id uuid, p_risk_level text DEFAULT NULL::text, p_tnps_risk_flag boolean DEFAULT NULL::boolean, p_followup_recommended boolean DEFAULT NULL::boolean) RETURNS public.field_log_report_post_call
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_row public.field_log_report_post_call%rowtype;
begin
  if p_risk_level is not null
     and p_risk_level not in ('fyi','watch','action_needed') then
    raise exception 'Invalid risk_level: %', p_risk_level;
  end if;

  update public.field_log_report_post_call pc
     set risk_level = coalesce(p_risk_level, risk_level),
         tnps_risk_flag = coalesce(p_tnps_risk_flag, tnps_risk_flag),
         followup_recommended = coalesce(p_followup_recommended, followup_recommended)
    from public.field_log_report r
   where pc.report_id = r.report_id
     and pc.report_id = p_report_id
     and (
       r.status = 'draft'
       or (r.status = 'tech_followup_required' and r.edit_unlocked = true)
     )
  returning pc.* into v_row;

  if v_row.report_id is null then
    raise exception 'Post Call detail update failed for report: %', p_report_id;
  end if;

  return v_row;
end;
$$;


--
-- Name: field_log_set_post_call_detail(uuid, text, boolean, boolean, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.field_log_set_post_call_detail(p_report_id uuid, p_risk_level text DEFAULT NULL::text, p_tnps_risk_flag boolean DEFAULT NULL::boolean, p_followup_recommended boolean DEFAULT NULL::boolean, p_technician_comments text DEFAULT NULL::text, p_customer_contact_feedback text DEFAULT NULL::text, p_lessons_takeaways text DEFAULT NULL::text, p_case_status text DEFAULT NULL::text) RETURNS public.field_log_report_post_call
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  v_row public.field_log_report_post_call%rowtype;
begin
  if p_risk_level is not null
     and p_risk_level not in ('fyi','watch','action_needed') then
    raise exception 'Invalid risk_level: %', p_risk_level;
  end if;

  if p_case_status is not null
     and p_case_status not in ('open','in_progress','pending_customer','resolved','closed','reopened') then
    raise exception 'Invalid case_status: %', p_case_status;
  end if;

  update public.field_log_report_post_call pc
     set risk_level = coalesce(p_risk_level, risk_level),
         tnps_risk_flag = coalesce(p_tnps_risk_flag, tnps_risk_flag),
         followup_recommended = coalesce(p_followup_recommended, followup_recommended),
         technician_comments = coalesce(p_technician_comments, technician_comments),
         customer_contact_feedback = coalesce(p_customer_contact_feedback, customer_contact_feedback),
         lessons_takeaways = coalesce(p_lessons_takeaways, lessons_takeaways),
         case_status = coalesce(p_case_status, case_status),
         closed_at = case
           when p_case_status = 'closed' and closed_at is null then now()
           when p_case_status in ('open','in_progress','pending_customer','resolved','reopened') then null
           else closed_at
         end,
         reopened_at = case
           when p_case_status = 'reopened' then now()
           else reopened_at
         end
    from public.field_log_report r
   where pc.report_id = r.report_id
     and pc.report_id = p_report_id
     and (
       r.status = 'draft'
       or (r.status = 'tech_followup_required' and r.edit_unlocked = true)
       or r.category_key = 'post_call'
     )
  returning pc.* into v_row;

  if v_row.report_id is null then
    raise exception 'Service Follow Up detail update failed for report: %', p_report_id;
  end if;

  return v_row;
end;
$$;


--
-- Name: field_log_report_qc; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.field_log_report_qc (
    report_id uuid NOT NULL,
    qc_mode text NOT NULL,
    supervisor_review_decision text,
    approval_note text,
    CONSTRAINT field_log_report_qc_qc_mode_check CHECK ((qc_mode = ANY (ARRAY['self_qc'::text, 'supervisor_qc'::text]))),
    CONSTRAINT field_log_report_qc_supervisor_review_decision_check CHECK ((supervisor_review_decision = ANY (ARRAY['approved'::text, 'tech_followup'::text, 'sup_followup'::text, 'rejected'::text, 'closed'::text])))
);


--
-- Name: field_log_set_qc_detail(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.field_log_set_qc_detail(p_report_id uuid, p_qc_mode text) RETURNS public.field_log_report_qc
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_row public.field_log_report_qc%rowtype;
begin
  if p_qc_mode not in ('self_qc','supervisor_qc') then
    raise exception 'Invalid qc_mode: %', p_qc_mode;
  end if;

  update public.field_log_report_qc q
     set qc_mode = p_qc_mode
    from public.field_log_report r
   where q.report_id = r.report_id
     and q.report_id = p_report_id
     and (
       r.status = 'draft'
       or (r.status = 'tech_followup_required' and r.edit_unlocked = true)
     )
  returning q.* into v_row;

  if v_row.report_id is null then
    raise exception 'QC detail update failed for report: %', p_report_id;
  end if;

  return v_row;
end;
$$;


--
-- Name: field_log_soft_delete_attachment(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.field_log_soft_delete_attachment(p_attachment_id uuid) RETURNS public.field_log_attachment
    LANGUAGE plpgsql
    AS $$
declare
  v_attachment public.field_log_attachment%rowtype;
begin
  update public.field_log_attachment
     set deleted_at = now()
   where attachment_id = p_attachment_id
     and deleted_at is null
  returning * into v_attachment;

  if v_attachment.attachment_id is null then
    raise exception 'Attachment not found or already deleted: %', p_attachment_id;
  end if;

  return v_attachment;
end;
$$;


--
-- Name: field_log_submit_report(uuid, text, text, boolean, numeric, numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.field_log_submit_report(p_report_id uuid, p_comment text DEFAULT NULL::text, p_evidence_declared text DEFAULT 'none'::text, p_xm_declared boolean DEFAULT false, p_gps_lat numeric DEFAULT NULL::numeric, p_gps_lng numeric DEFAULT NULL::numeric, p_gps_accuracy_m numeric DEFAULT NULL::numeric) RETURNS public.field_log_report
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_report public.field_log_report%rowtype;
begin
  if p_evidence_declared not in ('field_upload','xm_platform','none') then
    raise exception 'Invalid evidence_declared value: %', p_evidence_declared;
  end if;

  update public.field_log_report
     set comment = coalesce(p_comment, comment),
         evidence_declared = p_evidence_declared,
         xm_declared = coalesce(p_xm_declared, false),
         gps_lat = p_gps_lat,
         gps_lng = p_gps_lng,
         gps_accuracy_m = p_gps_accuracy_m,
         location_captured_at = case
           when p_gps_lat is not null and p_gps_lng is not null then now()
           else location_captured_at
         end,
         status = 'pending_review',
         submitted_at = now(),
         edit_unlocked = false
   where report_id = p_report_id
     and status = 'draft'
  returning * into v_report;

  if v_report.report_id is null then
    raise exception 'Draft not found or not in draft state: %', p_report_id;
  end if;

  insert into public.field_log_review_action (
    report_id, action_type, action_by_user_id, note
  )
  values (
    p_report_id, 'submit', v_report.created_by_user_id, p_comment
  );

  return v_report;
end;
$$;


--
-- Name: field_log_validate_submit(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.field_log_validate_submit(p_report_id uuid) RETURNS TABLE(ok boolean, errors jsonb)
    LANGUAGE plpgsql
    AS $$
declare
  v_detail public.field_log_report_detail_v%rowtype;
  v_errors jsonb := '[]'::jsonb;
  v_missing_new_drop jsonb;
begin
  select *
    into v_detail
  from public.field_log_report_detail_v
  where report_id = p_report_id;

  if v_detail.report_id is null then
    return query select false, jsonb_build_array('Report not found');
    return;
  end if;

  if coalesce(v_detail.job_number, '') = '' then
    v_errors := v_errors || jsonb_build_array('Job number is required');
  end if;

  if coalesce(v_detail.require_subcategory, false) and v_detail.subcategory_key is null then
    v_errors := v_errors || jsonb_build_array('Subcategory is required');
  end if;

  if coalesce(v_detail.comment_required, false) and coalesce(v_detail.comment, '') = '' then
    v_errors := v_errors || jsonb_build_array('Comment is required');
  end if;

  if coalesce(v_detail.require_ucode, false)
     and coalesce(v_detail.selected_ucode, '') = '' then
    v_errors := v_errors || jsonb_build_array('U-Code is required');
  end if;

  if coalesce(v_detail.location_required, false)
     and (v_detail.gps_lat is null or v_detail.gps_lng is null) then
    v_errors := v_errors || jsonb_build_array('Location capture is required');
  end if;

  if v_detail.category_key = 'new_drop' then
    select coalesce(
      jsonb_agg(coalesce(pl.label, pr.photo_label_key) order by pr.sort_order),
      '[]'::jsonb
    )
      into v_missing_new_drop
    from public.field_log_rule_photo_requirement pr
    left join public.field_log_photo_label pl
      on pl.config_version_id = v_detail.config_version_id
     and pl.photo_label_key = pr.photo_label_key
     and pl.is_active = true
    where pr.rule_id = v_detail.rule_id
      and pr.required = true
      and pr.is_active = true
      and not exists (
        select 1
        from public.field_log_attachment a
        where a.report_id = p_report_id
          and a.deleted_at is null
          and a.photo_label_key = pr.photo_label_key
      );

    if jsonb_array_length(v_missing_new_drop) > 0 then
      v_errors := v_errors || jsonb_build_array(
        'Missing New Drop evidence: ' || (
          select string_agg(value #>> '{}', ', ')
          from jsonb_array_elements(v_missing_new_drop) value
        )
      );
    end if;
  elsif coalesce(v_detail.min_photo_count, 0) > 0 then
    if v_detail.status = 'tech_followup_required' then
      if coalesce(v_detail.photo_count, 0) < v_detail.min_photo_count then
        v_errors := v_errors || jsonb_build_array(
          format('At least %s photo(s) required', v_detail.min_photo_count)
        );
      end if;
    end if;
  end if;

  return query
  select
    jsonb_array_length(v_errors) = 0,
    v_errors;
end;
$$;


--
-- Name: field_log_validate_xm_link(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.field_log_validate_xm_link(p_xm_link text) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $$
  select coalesce(p_xm_link like 'https://xm.optek.comcast.net%', false)
$$;


--
-- Name: fiscal_month_dim_set_derived(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fiscal_month_dim_set_derived() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  s_year int;
  s_month int;
  e_year int;
  e_month int;
begin
  if new.start_date is null then
    raise exception 'start_date cannot be null';
  end if;

  if extract(day from new.start_date) <> 22 then
    raise exception 'start_date must be the 22nd (got %)', new.start_date;
  end if;

  s_year  := extract(year  from new.start_date)::int;
  s_month := extract(month from new.start_date)::int;

  -- End month is start month + 1 (with year rollover)
  if s_month = 12 then
    e_month := 1;
    e_year  := s_year + 1;
  else
    e_month := s_month + 1;
    e_year  := s_year;
  end if;

  -- End date is always the 21st of the end month
  new.end_date := make_date(e_year, e_month, 21);

  -- month_key = YYYY-MM of end month
  new.month_key := e_year::text || '-' || lpad(e_month::text, 2, '0');

  -- label = "FY2026 January"
  new.label := 'FY' || e_year::text || ' ' || public.fiscal_month_month_name(e_month);

  return new;
end;
$$;


--
-- Name: fiscal_month_ensure_for_date(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fiscal_month_ensure_for_date(p_date date) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
declare
  v_start date;
  v_id uuid;
begin
  v_start := public.fiscal_month_start_for_date(p_date);

  insert into public.fiscal_month_dim (start_date)
  values (v_start)
  on conflict (start_date) do nothing;

  select fiscal_month_id
    into v_id
  from public.fiscal_month_dim
  where start_date = v_start;

  return v_id;
end;
$$;


--
-- Name: FUNCTION fiscal_month_ensure_for_date(p_date date); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.fiscal_month_ensure_for_date(p_date date) IS 'Returns fiscal_month_id for a date. Inserts into fiscal_month_dim if missing.';


--
-- Name: fiscal_month_id_for_date(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fiscal_month_id_for_date(p_date date) RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select d.fiscal_month_id
  from public.fiscal_month_dim d
  where d.start_date = public.fiscal_month_start_for_date(p_date);
$$;


--
-- Name: FUNCTION fiscal_month_id_for_date(p_date date); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.fiscal_month_id_for_date(p_date date) IS 'Returns fiscal_month_id for a date if present in fiscal_month_dim; does not insert.';


--
-- Name: fiscal_month_month_name(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fiscal_month_month_name(p_month integer) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  select case p_month
    when 1  then 'January'
    when 2  then 'February'
    when 3  then 'March'
    when 4  then 'April'
    when 5  then 'May'
    when 6  then 'June'
    when 7  then 'July'
    when 8  then 'August'
    when 9  then 'September'
    when 10 then 'October'
    when 11 then 'November'
    when 12 then 'December'
    else null
  end;
$$;


--
-- Name: fiscal_month_start_for_date(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fiscal_month_start_for_date(p_date date) RETURNS date
    LANGUAGE plpgsql STABLE
    AS $$
declare
  y int;
  m int;
  d int;
  prev_y int;
  prev_m int;
begin
  if p_date is null then
    return null;
  end if;

  y := extract(year from p_date)::int;
  m := extract(month from p_date)::int;
  d := extract(day from p_date)::int;

  -- If day >= 22 => anchor is 22nd of current month
  if d >= 22 then
    return make_date(y, m, 22);
  end if;

  -- Else anchor is 22nd of previous month
  if m = 1 then
    prev_m := 12;
    prev_y := y - 1;
  else
    prev_m := m - 1;
    prev_y := y;
  end if;

  return make_date(prev_y, prev_m, 22);
end;
$$;


--
-- Name: FUNCTION fiscal_month_start_for_date(p_date date); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.fiscal_month_start_for_date(p_date date) IS 'Returns canonical fiscal month start_date (22nd anchor) for a given calendar date.';


--
-- Name: fuse_onboarding_import_create_batch(uuid, text, text, integer, integer, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fuse_onboarding_import_create_batch(p_uploaded_by_auth_user_id uuid, p_filename text, p_sheet_name text, p_worksheet_count integer, p_row_count integer, p_rows jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_batch_id uuid;
  v_row jsonb;
  v_row_number integer := 0;
  v_row_date date;
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
    select value
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
  loop
    v_row_number := v_row_number + 1;
    v_row_date := nullif(v_row->>'Date', '')::date;

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
      row_signature,
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
      v_row_date,
      md5(
        concat_ws(
          '|',
          coalesce(v_row_date::text, ''),
          lower(trim(coalesce(v_row->>'Office', ''))),
          lower(trim(coalesce(v_row->>'Company Name', ''))),
          lower(trim(coalesce(v_row->>'Last Name', ''))),
          lower(trim(coalesce(v_row->>'First Name', ''))),
          lower(trim(coalesce(v_row->>'Tech ID', ''))),
          lower(trim(coalesce(v_row->>'Personnel ID', '')))
        )
      ),
      v_row
    );
  end loop;

  update public.fuse_onboarding_import_batch
  set row_count = v_row_number
  where batch_id = v_batch_id;

  return v_batch_id;
end;
$$;


--
-- Name: get_access_context(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_access_context() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  with me as (
    select
      up.auth_user_id,
      up.person_id,
      up.status
    from public.user_profile up
    where up.auth_user_id = auth.uid()
  ),
  role_keys as (
    select coalesce(jsonb_agg(ur.role_key order by ur.role_key), '[]'::jsonb) as roles
    from public.user_roles ur
    where ur.auth_user_id = auth.uid()
  )
  select jsonb_build_object(
    'auth_user_id', (select auth_user_id from me),
    'person_id', (select person_id from me),
    'status', (select status from me),
    'is_owner', public.is_owner(),
    'roles', (select roles from role_keys)
  );
$$;


--
-- Name: get_access_context_for(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_access_context_for(p_auth_user_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  with me as (
    select up.auth_user_id, up.person_id, up.status
    from public.user_profile up
    where up.auth_user_id = p_auth_user_id
  ),
  role_keys as (
    select coalesce(jsonb_agg(ur.role_key order by ur.role_key), '[]'::jsonb) as roles
    from public.user_roles ur
    where ur.auth_user_id = p_auth_user_id
  )
  select jsonb_build_object(
    'auth_user_id', (select auth_user_id from me),
    'person_id', (select person_id from me),
    'status', (select status from me),
    'is_owner', exists(select 1 from public.app_owners o where o.auth_user_id = p_auth_user_id),
    'roles', (select roles from role_keys)
  );
$$;


--
-- Name: get_access_pass(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_access_pass(p_pc_org_id uuid) RETURNS jsonb
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'api'
    SET row_security TO 'off'
    AS $$
  select api.get_access_pass(p_pc_org_id);
$$;


--
-- Name: get_table_columns(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_table_columns(p_table_name text) RETURNS TABLE(column_name text, data_type text, is_nullable text, column_default text)
    LANGUAGE sql STABLE
    AS $$
  select
    column_name,
    data_type,
    is_nullable,
    column_default
  from
    information_schema.columns
  where
    table_schema = 'public'
    and table_name = p_table_name
  order by ordinal_position;
$$;


--
-- Name: handle_auth_user_created(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_auth_user_created() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'api'
    AS $$
begin
  insert into public.user_profile (auth_user_id, status)
  values (new.id, 'pending')
  on conflict (auth_user_id) do nothing;
  return new;
end;
$$;


--
-- Name: handle_new_auth_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_auth_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
begin
  insert into public.user_profile (auth_user_id, status, is_admin)
  values (new.id, 'pending', false)
  on conflict (auth_user_id) do nothing;

  return new;
end;
$$;


--
-- Name: has_dispatch_console_access(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_dispatch_console_access(p_pc_org_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'api'
    SET row_security TO 'off'
    AS $$
  select
    auth.uid() is not null
    and p_pc_org_id is not null
    and (
      -- 1) Absolute override (works even when user_profile.person_id is null)
      api.is_app_owner()

      -- 2) Optional admin override
      or exists (
        select 1
        from public.user_profile up
        where up.auth_user_id = auth.uid()
          and lower(up.status) = 'active'
          and up.is_admin = true
      )

      -- 3) Optional explicit permission (future-proof)
      or api.has_pc_org_permission(p_pc_org_id, 'dispatch_manage')

      -- 4) Supervisor+ via roster assignment position_title (ONLY works once user_profile.person_id is linked)
      or exists (
        select 1
        from public.user_profile up
        join public.route_lock_roster_v r
          on r.pc_org_id = p_pc_org_id
         and r.person_id = up.person_id
        where up.auth_user_id = auth.uid()
          and up.person_id is not null
          and r.assignment_active = true
          and r.position_title in (
            'ITG Supervisor',
            'BP Supervisor',
            'Project Manager',
            'Regional Manager',
            'Director',
            'VP',
            'BP Owner',
            'Admin'
          )
      )
    );
$$;


--
-- Name: has_pc_scope(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_pc_scope(p_pc_org_id uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select exists (
    select 1
    from public.user_pc_scope s
    where s.user_id = auth.uid()
      and s.pc_org_id = p_pc_org_id
  );
$$;


--
-- Name: has_role(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(p_role text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'api'
    SET row_security TO 'off'
    AS $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.auth_user_id = auth.uid()
      and ur.role_key = p_role
  );
$$;


--
-- Name: is_active_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_active_user() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'api'
    SET row_security TO 'off'
    AS $$
  select exists (
    select 1
    from public.user_profile up
    where up.auth_user_id = auth.uid()
      and up.status = 'active'
  );
$$;


--
-- Name: is_admin_or_higher(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin_or_higher() RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select public.current_role_level() >= 60;  -- ADMIN+
$$;


--
-- Name: is_owner(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_owner() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'api'
    SET row_security TO 'off'
    AS $$
  select exists (
    select 1
    from public.app_owners ao
    where ao.auth_user_id = auth.uid()
  );
$$;


--
-- Name: is_self_person(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_self_person(p_person_id uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select exists (
    select 1
    from public.user_person_link l
    where l.user_id = auth.uid()
      and l.person_id = p_person_id
  );
$$;


--
-- Name: is_system_role(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_system_role(p_role text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'api'
    SET row_security TO 'off'
    AS $$
  select coalesce(
    (select r.is_system from public.roles r where r.role_key = p_role),
    false
  );
$$;


--
-- Name: json_int(jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.json_int(j jsonb, k text) RETURNS integer
    LANGUAGE sql IMMUTABLE
    AS $$
  select
    case
      when j ? k is false then null
      when nullif(trim(j->>k), '') is null then null
      when lower(trim(j->>k)) = 'nan' then null
      else (j->>k)::numeric::int
    end;
$$;


--
-- Name: json_num(jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.json_num(j jsonb, k text) RETURNS numeric
    LANGUAGE sql IMMUTABLE
    AS $$
  select
    case
      when j ? k is false then null
      when nullif(trim(j->>k), '') is null then null
      when lower(trim(j->>k)) = 'nan' then null
      else (j->>k)::numeric
    end;
$$;


--
-- Name: kpi_key_canonical(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.kpi_key_canonical(p_raw_key text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  select case trim(p_raw_key)
    when 'FTR%' then 'ftr_rate'
    when '48Hr Contact Rate%' then 'contact_48hr_rate'
    when 'MetRate' then 'met_rate'
    when 'Repeat Rate%' then 'repeat_rate'
    when 'Rework Rate%' then 'rework_rate'
    when 'SOI Rate%' then 'soi_rate'
    when 'tNPS Rate' then 'tnps_score'
    when 'ToolUsage' then 'tool_usage_rate'
    when 'PHT Pure Pass%' then 'pht_pure_pass_rate'

    -- optional extras present in rubric
    when 'Total Jobs' then 'completion_rate'          -- if your completion_rate is actually derived differently, we adjust later
    when 'TCs' then 'tsc_contact_rate'                -- placeholder mapping; adjust if TSC is defined differently

    else null
  end;
$$;


--
-- Name: mark_batch_computed(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_batch_computed(p_batch_id uuid) RETURNS void
    LANGUAGE sql
    AS $$
  update public.metrics_raw_batch
  set computed_at = now()
  where batch_id = p_batch_id;
$$;


--
-- Name: metrics_after_batch_loaded_v3(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.metrics_after_batch_loaded_v3() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.status = 'loaded' then
    if tg_op = 'INSERT'
       or (tg_op = 'UPDATE' and old.status is distinct from new.status) then

      insert into public.metrics_pipeline_queue (batch_id)
      values (new.batch_id);

    end if;
  end if;

  return new;
end;
$$;


--
-- Name: metrics_class_kpi_config_default_no_data_behavior(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.metrics_class_kpi_config_default_no_data_behavior() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.no_data_behavior is null then
    new.no_data_behavior := 'EXCLUDE_FROM_TOTAL';
  end if;
  return new;
end;
$$;


--
-- Name: metrics_class_kpi_config_guard_defaults(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.metrics_class_kpi_config_guard_defaults() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.no_data_behavior is null then
    new.no_data_behavior := 'EXCLUDE_FROM_TOTAL';
  end if;

  if new.created_at is null then
    new.created_at := now();
  end if;

  if new.updated_at is null then
    new.updated_at := now();
  end if;

  if new.report_visible is null then
    new.report_visible := true;
  end if;

  return new;
end;
$$;


--
-- Name: metrics_compute_for_batch(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.metrics_compute_for_batch(p_batch_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
declare
  v_pc_org uuid;
  v_metric_date date;
  v_fiscal_end date;
begin
  select b.pc_org_id, b.metric_date, b.fiscal_end_date
    into v_pc_org, v_metric_date, v_fiscal_end
  from public.metrics_raw_batch b
  where b.batch_id = p_batch_id
  limit 1;

  if v_pc_org is null then
    raise exception 'Batch not found: %', p_batch_id;
  end if;

  perform public.metrics_compute_slice(p_batch_id, v_pc_org, v_metric_date, v_fiscal_end, 'P4P');
  perform public.metrics_compute_slice(p_batch_id, v_pc_org, v_metric_date, v_fiscal_end, 'SMART');
  perform public.metrics_compute_slice(p_batch_id, v_pc_org, v_metric_date, v_fiscal_end, 'TECH');
end
$$;


--
-- Name: metrics_compute_for_batch_v2(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.metrics_compute_for_batch_v2(p_batch_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
declare
  v_pc_org uuid;
  v_metric_date date;
  v_fiscal_end date;
begin
  select b.pc_org_id, b.metric_date, b.fiscal_end_date
    into v_pc_org, v_metric_date, v_fiscal_end
  from public.metrics_raw_batch b
  where b.batch_id = p_batch_id
  limit 1;

  if v_pc_org is null then
    raise exception 'Batch not found: %', p_batch_id;
  end if;

  perform public.metrics_compute_slice_v2(p_batch_id, v_pc_org, v_metric_date, v_fiscal_end, 'P4P');
  perform public.metrics_compute_slice_v2(p_batch_id, v_pc_org, v_metric_date, v_fiscal_end, 'SMART');
  perform public.metrics_compute_slice_v2(p_batch_id, v_pc_org, v_metric_date, v_fiscal_end, 'TECH');
end
$$;


--
-- Name: metrics_compute_slice(uuid, uuid, date, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.metrics_compute_slice(p_batch_id uuid, p_pc_org_id uuid, p_metric_date date, p_fiscal_end_date date, p_class_type text) RETURNS void
    LANGUAGE plpgsql
    AS $$
declare
  v_class text := upper(p_class_type);
begin
  -- Idempotent: wipe existing computed rows for same batch/class
  delete from public.metrics_kpi_compute
   where batch_id = p_batch_id
     and pc_org_id = p_pc_org_id
     and metric_date = p_metric_date
     and fiscal_end_date = p_fiscal_end_date
     and class_type = v_class;

  delete from public.metrics_tech_rollup
   where batch_id = p_batch_id
     and pc_org_id = p_pc_org_id
     and metric_date = p_metric_date
     and fiscal_end_date = p_fiscal_end_date
     and class_type = v_class;

  delete from public.metrics_rank_partition
   where batch_id = p_batch_id
     and pc_org_id = p_pc_org_id
     and metric_date = p_metric_date
     and fiscal_end_date = p_fiscal_end_date
     and class_type = v_class;

  with
  scope as (
    select
      r.batch_id,
      r.pc_org_id,
      r.metric_date,
      r.fiscal_end_date,
      r.tech_id,
      r.raw
    from public.metrics_raw_row r
    where r.batch_id = p_batch_id
      and r.pc_org_id = p_pc_org_id
      and r.metric_date = p_metric_date
      and r.fiscal_end_date = p_fiscal_end_date
  ),

  defs as (
    select
      d.kpi_key,
      d.raw_label_identifier,
      coalesce(d.direction, 'HIGHER_BETTER') as direction
    from public.metrics_kpi_def d
    where d.raw_label_identifier is not null
  ),

  cfg as (
    select
      upper(c.class_type) as class_type,
      c.kpi_key,
      coalesce(c.enabled,false) as enabled,
      coalesce(c.weight,0)::numeric as weight_percent,
      coalesce(c.grade_value,0)::numeric as grade_value
    from public.metrics_class_kpi_config c
    where upper(c.class_type) = v_class
  ),

  vals as (
    select
      s.batch_id,
      s.pc_org_id,
      s.metric_date,
      s.fiscal_end_date,
      v_class as class_type,
      s.tech_id,
      d.kpi_key,
      d.raw_label_identifier,
      d.direction,
      v.metric_value
    from scope s
    join defs d
      on (s.raw ? d.raw_label_identifier)
    left join lateral (
      select
        case
          when jsonb_typeof(s.raw -> d.raw_label_identifier) = 'number' then
            (s.raw ->> d.raw_label_identifier)::numeric
          when jsonb_typeof(s.raw -> d.raw_label_identifier) = 'string' then
            case
              when trim(s.raw ->> d.raw_label_identifier) in ('', '∞', '-∞', 'inf', '-inf', 'Infinity', '-Infinity', 'NaN', 'nan')
                then null
              else
                nullif(
                  regexp_replace(
                    regexp_replace(
                      regexp_replace(trim(s.raw ->> d.raw_label_identifier), '%', '', 'g'),
                      ',',
                      '',
                      'g'
                    ),
                    '[^0-9\.\-]',
                    '',
                    'g'
                  ),
                  ''
                )::numeric
            end
          else null
        end as metric_value
    ) v on true
  ),

  joined as (
    select
      v.*,
      c.enabled,
      c.weight_percent,
      c.grade_value
    from vals v
    join cfg c
      on c.class_type = v.class_type
     and c.kpi_key = v.kpi_key
  ),

  ranked as (
    select
      j.*,
      count(j.metric_value) over (partition by j.kpi_key) as n_with_value,
      case
        when j.metric_value is null then null
        when j.direction = 'LOWER_BETTER'
          then dense_rank() over (partition by j.kpi_key order by j.metric_value asc)
        else dense_rank() over (partition by j.kpi_key order by j.metric_value desc)
      end as inside_rank
    from joined j
  ),

  scored as (
    select
      r.*,
      case
        when r.metric_value is null then null
        when r.n_with_value <= 1 then 0::numeric
        else ((r.inside_rank - 1)::numeric / (r.n_with_value - 1)::numeric)
      end as rank_score,
      case
        when not r.enabled then 0::numeric
        when r.metric_value is null then 0::numeric
        else (
          (case
             when r.n_with_value <= 1 then 0::numeric
             else ((r.inside_rank - 1)::numeric / (r.n_with_value - 1)::numeric)
           end)
          * (r.weight_percent / 100.0)
        )
      end as weighted_points
    from ranked r
  ),

  rub as (
    select
      rr.kpi_key,
      upper(rr.band_key) as band_key,
      rr.min_value::numeric as min_value,
      rr.max_value::numeric as max_value
    from public.metrics_class_kpi_rubric rr
    where upper(rr.class_type) = v_class
  ),

  banded as (
    select
      s.*,
      case
        when s.metric_value is null then 'NO_DATA'
        else coalesce(
          (
            select r2.band_key
            from rub r2
            where r2.kpi_key = s.kpi_key
              and r2.band_key <> 'NO_DATA'
              and (r2.min_value is null or s.metric_value >= r2.min_value)
              and (r2.max_value is null or s.metric_value <= r2.max_value)
            order by case r2.band_key
              when 'EXCEEDS' then 1
              when 'MEETS' then 2
              when 'NEEDS_IMPROVEMENT' then 3
              when 'MISSES' then 4
              else 99 end
            limit 1
          ),
          'NO_DATA'
        )
      end as band_key
    from scored s
  )

  insert into public.metrics_kpi_compute (
    batch_id, pc_org_id, metric_date, fiscal_end_date, class_type,
    tech_id, kpi_key, raw_label_identifier, direction, metric_value,
    inside_rank, n_with_value, rank_score,
    weight_percent, grade_value, weighted_points,
    band_key, computed_at
  )
  select
    b.batch_id, b.pc_org_id, b.metric_date, b.fiscal_end_date, b.class_type,
    b.tech_id, b.kpi_key, b.raw_label_identifier, b.direction, b.metric_value,
    b.inside_rank, b.n_with_value, b.rank_score,
    b.weight_percent, b.grade_value, coalesce(b.weighted_points,0),
    b.band_key, now()
  from banded b;

  insert into public.metrics_tech_rollup (
    batch_id, pc_org_id, metric_date, fiscal_end_date, class_type, tech_id,
    total_weighted_points, computed_at
  )
  select
    p_batch_id,
    p_pc_org_id,
    p_metric_date,
    p_fiscal_end_date,
    v_class,
    tech_id,
    sum(weighted_points)::numeric as total_weighted_points,
    now()
  from public.metrics_kpi_compute
  where batch_id = p_batch_id
    and pc_org_id = p_pc_org_id
    and metric_date = p_metric_date
    and fiscal_end_date = p_fiscal_end_date
    and class_type = v_class
  group by tech_id;
end
$$;


--
-- Name: metrics_compute_slice_v2(uuid, uuid, date, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.metrics_compute_slice_v2(p_batch_id uuid, p_pc_org_id uuid, p_metric_date date, p_fiscal_end_date date, p_class_type text) RETURNS void
    LANGUAGE plpgsql
    AS $$
declare
  v_class text := upper(p_class_type);
begin
  -- 1) Compute KPI rows + rollups (this populates metrics_kpi_compute + metrics_tech_rollup)
  perform public.metrics_compute_slice(
    p_batch_id,
    p_pc_org_id,
    p_metric_date,
    p_fiscal_end_date,
    v_class
  );

  -- 2) Rank using the hardened archive rank engine (depends on metrics_tech_rollup)
  perform public.compute_archive_scores_and_rank(
    p_batch_id,
    v_class
  );
end;
$$;


--
-- Name: metrics_delete_batch_exact(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.metrics_delete_batch_exact(p_metric_batch_id uuid, p_pc_org_id uuid) RETURNS TABLE(metric_batch_id uuid, deleted_score_rows integer, deleted_work_mix_rows integer, deleted_ownership_rows integer, deleted_metric_rows integer, deleted_batches integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'core'
    AS $$
declare
  v_target_fiscal_end date;
  v_target_uploaded_at timestamptz;
  v_count integer := 0;

  v_score_count integer := 0;
  v_work_mix_count integer := 0;
  v_ownership_count integer := 0;
  v_metric_rows_count integer := 0;
  v_batch_count integer := 0;

  r record;
begin
  select
    b.fiscal_end_date::date,
    b.uploaded_at::timestamptz
  into
    v_target_fiscal_end,
    v_target_uploaded_at
  from public.metric_raw_batches_compat_v b
  where b.batch_id = p_metric_batch_id
    and b.pc_org_id = p_pc_org_id;

  if v_target_fiscal_end is null then
    raise exception 'metrics batch not found for selected org'
      using errcode = 'P0002';
  end if;

  drop table if exists tmp_metric_batches_to_delete;

  create temporary table tmp_metric_batches_to_delete(
    metric_batch_id uuid primary key
  ) on commit drop;

  insert into tmp_metric_batches_to_delete(metric_batch_id)
  select b.batch_id
  from public.metric_raw_batches_compat_v b
  where b.pc_org_id = p_pc_org_id
    and (
      b.batch_id = p_metric_batch_id
      or (
        b.fiscal_end_date::date = v_target_fiscal_end
        and coalesce(b.row_count, 0) = 0
        and lower(coalesce(b.status, '')) = 'staged'
        and b.uploaded_at is not null
        and abs(extract(epoch from (b.uploaded_at::timestamptz - v_target_uploaded_at))) <= 120
      )
    );

  -- Delete dependent metric tables that actually exist and have metric_batch_id.
  for r in
    select
      c.table_schema,
      c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema
     and t.table_name = c.table_name
    where c.column_name = 'metric_batch_id'
      and c.table_schema = 'core'
      and t.table_type = 'BASE TABLE'
      and c.table_name <> 'metric_batches'
    order by
      case when c.table_name = 'metric_rows' then 2 else 1 end,
      c.table_name
  loop
    execute format(
      'delete from %I.%I x using tmp_metric_batches_to_delete d where x.metric_batch_id = d.metric_batch_id',
      r.table_schema,
      r.table_name
    );

    get diagnostics v_count = row_count;

    if r.table_name = 'metric_scores_fact' then
      v_score_count := v_score_count + v_count;
    elsif r.table_name = 'metric_work_mix_fact' then
      v_work_mix_count := v_work_mix_count + v_count;
    elsif r.table_name = 'metric_ownership_fact' then
      v_ownership_count := v_ownership_count + v_count;
    elsif r.table_name = 'metric_rows' then
      v_metric_rows_count := v_metric_rows_count + v_count;
    end if;
  end loop;

  delete from core.metric_batches mb
  using tmp_metric_batches_to_delete d
  where mb.metric_batch_id = d.metric_batch_id;
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


--
-- Name: metrics_raw_batch_auto_compute_v2(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.metrics_raw_batch_auto_compute_v2() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if (new.status = 'loaded')
     and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    perform public.metrics_compute_for_batch_v2(new.batch_id);
  end if;

  return new;
end $$;


--
-- Name: metrics_run_nsr_for_batch(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.metrics_run_nsr_for_batch(p_batch_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'api', 'core'
    AS $$
declare
  v_batch record;
  v_deleted_count integer := 0;
  v_inserted_count integer := 0;
begin
  if p_batch_id is null then
    raise exception 'p_batch_id is required';
  end if;

  select
    b.batch_id,
    b.pc_org_id,
    b.metric_date,
    b.fiscal_end_date,
    b.status
  into v_batch
  from public.metrics_raw_batch b
  where b.batch_id = p_batch_id
  limit 1;

  if v_batch.batch_id is null then
    raise exception 'Batch not found: %', p_batch_id;
  end if;

  perform core.log_metric_batch_event(
    p_batch_id,
    null,
    'nsr_started',
    jsonb_build_object(
      'source', 'public.metrics_run_nsr_for_batch',
      'prior_status', v_batch.status
    )
  );

  update public.metrics_raw_batch
  set
    status = 'nsr_running',
    error = null
  where batch_id = p_batch_id;

  delete from public.metrics_pipeline_run_log
  where batch_id = p_batch_id
    and upper(class_type) = 'P4P';

  get diagnostics v_deleted_count = row_count;

  perform public.metrics_compute_for_batch(p_batch_id);
  perform public.metrics_ship_archive_for_batch(p_batch_id, 'P4P');

  select count(*)
  into v_inserted_count
  from public.master_kpi_archive_snapshot s
  where s.batch_id = p_batch_id
    and upper(s.class_type) = 'P4P';

  update public.metrics_raw_batch
  set
    status = 'nsr_complete',
    error = null
  where batch_id = p_batch_id;

  perform core.log_metric_batch_event(
    p_batch_id,
    null,
    'nsr_completed',
    jsonb_build_object(
      'db_class_type', 'P4P',
      'deleted_run_log_rows', v_deleted_count,
      'archive_snapshot_rows', v_inserted_count
    )
  );

  return jsonb_build_object(
    'ok', true,
    'batch_id', p_batch_id,
    'lane', 'NSR',
    'db_class_type', 'P4P',
    'pc_org_id', v_batch.pc_org_id,
    'metric_date', v_batch.metric_date,
    'fiscal_end_date', v_batch.fiscal_end_date,
    'deleted_run_log_rows', v_deleted_count,
    'archive_snapshot_rows', v_inserted_count,
    'status', 'nsr_complete'
  );

exception
  when others then
    update public.metrics_raw_batch
    set
      status = 'nsr_failed',
      error = sqlerrm
    where batch_id = p_batch_id;

    perform core.log_metric_batch_event(
      p_batch_id,
      null,
      'nsr_failed',
      jsonb_build_object(
        'error', sqlerrm
      )
    );

    raise;
end;
$$;


--
-- Name: metrics_run_smart_for_batch(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.metrics_run_smart_for_batch(p_batch_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'api', 'core'
    AS $$
declare
  v_batch record;
  v_deleted_count integer := 0;
  v_inserted_count integer := 0;
begin
  if p_batch_id is null then
    raise exception 'p_batch_id is required';
  end if;

  select
    b.batch_id,
    b.pc_org_id,
    b.metric_date,
    b.fiscal_end_date,
    b.status
  into v_batch
  from public.metrics_raw_batch b
  where b.batch_id = p_batch_id
  limit 1;

  if v_batch.batch_id is null then
    raise exception 'Batch not found: %', p_batch_id;
  end if;

  perform core.log_metric_batch_event(
    p_batch_id,
    null,
    'smart_started',
    jsonb_build_object(
      'source', 'public.metrics_run_smart_for_batch',
      'prior_status', v_batch.status
    )
  );

  update public.metrics_raw_batch
  set
    status = 'smart_running',
    error = null
  where batch_id = p_batch_id;

  delete from public.metrics_pipeline_run_log
  where batch_id = p_batch_id
    and upper(class_type) = 'SMART';

  get diagnostics v_deleted_count = row_count;

  perform public.metrics_compute_for_batch(p_batch_id);
  perform public.metrics_ship_archive_for_batch(p_batch_id, 'SMART');

  select count(*)
  into v_inserted_count
  from public.master_kpi_archive_snapshot s
  where s.batch_id = p_batch_id
    and upper(s.class_type) = 'SMART';

  update public.metrics_raw_batch
  set
    status = 'complete',
    error = null
  where batch_id = p_batch_id;

  perform core.log_metric_batch_event(
    p_batch_id,
    null,
    'smart_completed',
    jsonb_build_object(
      'db_class_type', 'SMART',
      'deleted_run_log_rows', v_deleted_count,
      'archive_snapshot_rows', v_inserted_count
    )
  );

  perform core.log_metric_batch_event(
    p_batch_id,
    null,
    'batch_completed',
    jsonb_build_object(
      'final_status', 'complete'
    )
  );

  return jsonb_build_object(
    'ok', true,
    'batch_id', p_batch_id,
    'lane', 'SMART',
    'db_class_type', 'SMART',
    'pc_org_id', v_batch.pc_org_id,
    'metric_date', v_batch.metric_date,
    'fiscal_end_date', v_batch.fiscal_end_date,
    'deleted_run_log_rows', v_deleted_count,
    'archive_snapshot_rows', v_inserted_count,
    'status', 'complete'
  );

exception
  when others then
    update public.metrics_raw_batch
    set
      status = 'failed',
      error = sqlerrm
    where batch_id = p_batch_id;

    perform core.log_metric_batch_event(
      p_batch_id,
      null,
      'smart_failed',
      jsonb_build_object(
        'error', sqlerrm
      )
    );

    raise;
end;
$$;


--
-- Name: metrics_ship_archive_for_batch(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.metrics_ship_archive_for_batch(p_batch_id uuid, p_class_type text) RETURNS void
    LANGUAGE plpgsql
    AS $$
declare
  v_class text := upper(p_class_type);
begin
  -- 0) Ensure snapshot identity rows exist (tech roster linkage / reports_to / etc)
  perform public.compute_archive_snapshot_identity(p_batch_id, v_class);

  -- 1) Wipe existing archive metrics for this batch/class (idempotent)
  delete from public.master_kpi_archive_metric
   where batch_id = p_batch_id
     and class_type = v_class;

  -- 2) Insert LONG metrics from computed table (no discards)
  insert into public.master_kpi_archive_metric (
    archive_metric_id,
    batch_id,
    class_type,
    pc_org_id,
    metric_date,
    tech_id,
    metric_key,
    raw_value,
    numerator,
    denominator,
    computed_value,
    created_at,
    metric_key_raw,
    metric_key_canonical
  )
  select
    gen_random_uuid(),
    k.batch_id,
    v_class,
    k.pc_org_id,
    k.metric_date,
    k.tech_id,
    k.kpi_key,
    k.metric_value,
    null::numeric,
    null::numeric,
    k.metric_value,
    now(),
    k.raw_label_identifier,
    k.kpi_key
  from public.metrics_kpi_compute k
  where k.batch_id = p_batch_id
    and k.class_type = v_class;

  -- 3) Populate raw_metrics_json = exact imported JSON row (nothing discarded)
  update public.master_kpi_archive_snapshot s
  set raw_metrics_json = r.raw::jsonb
  from public.metrics_raw_row r
  where s.batch_id = p_batch_id
    and s.class_type = v_class
    and s.is_totals = false
    and r.batch_id = s.batch_id
    and r.pc_org_id = s.pc_org_id
    and r.metric_date = s.metric_date
    and r.fiscal_end_date = s.fiscal_end_date
    and r.tech_id::text = s.tech_id;

  -- 4) computed_metrics_json (your “B” approach already handled elsewhere; keep as-is)
  with per_tech as (
    select
      k.tech_id,
      jsonb_object_agg(
        k.kpi_key,
        jsonb_build_object(
          'value', k.metric_value,
          'band_key', k.band_key,
          'rank_score', k.rank_score,
          'weighted_points', k.weighted_points,
          'inside_rank', k.inside_rank,
          'n_with_value', k.n_with_value
        )
      ) as j
    from public.metrics_kpi_compute k
    where k.batch_id = p_batch_id
      and k.class_type = v_class
    group by k.tech_id
  )
  update public.master_kpi_archive_snapshot s
  set computed_metrics_json = p.j
  from per_tech p
  where s.batch_id = p_batch_id
    and s.class_type = v_class
    and s.is_totals = false
    and s.tech_id = p.tech_id;

  -- 5) Fill composite_score from rollups
  update public.master_kpi_archive_snapshot s
  set composite_score = t.total_weighted_points
  from public.metrics_tech_rollup t
  where s.batch_id = p_batch_id
    and s.class_type = v_class
    and s.is_totals = false
    and t.batch_id = s.batch_id
    and t.class_type = v_class
    and t.pc_org_id = s.pc_org_id
    and t.metric_date = s.metric_date
    and t.fiscal_end_date = s.fiscal_end_date
    and t.tech_id = s.tech_id;

  -- 6) REBUILD rank partition with eligibility rule: Total FTR/Contact Jobs > 0, exclude totals
  perform public.rebuild_metrics_rank_partition_for_batch(p_batch_id, v_class);

  -- 7) Set population_size = eligible_n for ALL snapshot rows (tech + totals), rank only for eligible techs
  with eligible_counts as (
    select
      rp.batch_id,
      rp.pc_org_id,
      rp.metric_date,
      rp.fiscal_end_date,
      upper(rp.class_type) as class_type,
      max(rp.n) as eligible_n
    from public.metrics_rank_partition rp
    where rp.batch_id = p_batch_id
      and upper(rp.class_type) = v_class
    group by 1,2,3,4,5
  )
  update public.master_kpi_archive_snapshot s
  set population_size = ec.eligible_n
  from eligible_counts ec
  where s.batch_id = p_batch_id
    and upper(s.class_type) = v_class
    and s.pc_org_id = ec.pc_org_id
    and s.metric_date = ec.metric_date
    and s.fiscal_end_date = ec.fiscal_end_date;

  update public.master_kpi_archive_snapshot s
  set
    rank_org = rp.rank,
    percentile = rp.percentile
  from public.metrics_rank_partition rp
  where s.batch_id = p_batch_id
    and upper(s.class_type) = v_class
    and s.is_totals = false
    and rp.batch_id = s.batch_id
    and upper(rp.class_type) = v_class
    and rp.pc_org_id = s.pc_org_id
    and rp.metric_date = s.metric_date
    and rp.fiscal_end_date = s.fiscal_end_date
    and rp.tech_id = s.tech_id;

  -- ineligible techs (not present in rp) keep rank_org/percentile null by design

  -- 8) Status badge (unchanged)
  update public.master_kpi_archive_snapshot s
  set status_badge = case
    when s.is_totals then 'TOTALS'
    when s.ownership_mode = 'ACTIVE' and s.composite_score is not null then 'OK'
    else 'UNLINKED'
  end
  where s.batch_id = p_batch_id
    and s.class_type = v_class;

end;
$$;


--
-- Name: metrics_ship_archive_metrics_from_raw(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.metrics_ship_archive_metrics_from_raw(p_batch_id uuid, p_class_type text) RETURNS void
    LANGUAGE plpgsql
    AS $_$
declare
  v_class text := upper(coalesce(p_class_type,''));
begin
  -- wipe prior ship for this batch/class (idempotent reruns)
  delete from public.master_kpi_archive_metric
   where batch_id = p_batch_id
     and upper(class_type) = v_class;

  insert into public.master_kpi_archive_metric (
    archive_metric_id,
    batch_id,
    class_type,
    pc_org_id,
    metric_date,
    tech_id,
    metric_key,
    raw_value,
    numerator,
    denominator,
    computed_value,
    created_at,
    metric_key_raw,
    metric_key_canonical
  )
  select
    gen_random_uuid() as archive_metric_id,
    m.batch_id,
    v_class as class_type,
    m.pc_org_id,
    m.metric_date,
    m.tech_id::text as tech_id,

    -- canonical key becomes the primary consumption key for the metric archive
    canon_key as metric_key,

    -- store the parsed numeric value (best-effort)
    num_val as raw_value,
    null::numeric as numerator,
    null::numeric as denominator,
    num_val as computed_value,

    now() as created_at,
    raw_key as metric_key_raw,
    canon_key as metric_key_canonical
  from public.metrics_master_class_v m
  cross join lateral jsonb_each(m.raw) as e(raw_key, raw_json_val)
  cross join lateral (
    select
      -- canonicalize: lowercase, %->pct, non-alnum->_, collapse _, trim _
      regexp_replace(
        regexp_replace(
          regexp_replace(
            lower(replace(e.raw_key, '%', 'pct')),
            '[^a-z0-9]+', '_', 'g'
          ),
          '_+', '_', 'g'
        ),
        '^_|_$', '', 'g'
      ) as canon_key,

      -- numeric parse (uses your helper from Step 1)
      public.metrics_to_num(trim(both '"' from e.raw_json_val::text)) as num_val
  ) c
  where m.batch_id = p_batch_id
    and m.raw is not null
    and e.raw_key is not null

    -- keep TECH + TOTALS rows (both should ship metrics)
    and m.row_kind in ('tech','totals')

    -- drop identity/text fields (these belong in snapshot, not metric facts)
    and lower(e.raw_key) not in (
      'techid','tech_id',
      'techname','tech_name',
      'supervisor',
      'company','c_code','itg supervisor','itg_supervisor'
    )

    -- only ship numeric facts
    and c.num_val is not null;
end;
$_$;


--
-- Name: metrics_ship_archive_metrics_p4p_from_raw(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.metrics_ship_archive_metrics_p4p_from_raw(p_batch_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $_$
begin
  -- Clear existing P4P metric facts for this batch (facts only; snapshot can remain separate)
  delete from public.master_kpi_archive_metric
  where batch_id = p_batch_id
    and upper(class_type) = 'P4P';

  insert into public.master_kpi_archive_metric
  (
    archive_metric_id,
    batch_id,
    class_type,
    pc_org_id,
    metric_date,
    tech_id,
    metric_key,
    raw_value,
    numerator,
    denominator,
    computed_value,
    created_at,
    metric_key_raw,
    metric_key_canonical
  )
  select
    gen_random_uuid(),
    v.batch_id,
    'P4P',
    v.pc_org_id,
    v.metric_date,
    v.tech_id::text,

    -- keep a stable metric_key = canonical
    canon.metric_key_canonical as metric_key,

    -- raw_value: numeric if possible
    case
      when canon.value_text ~ '^\s*-?\d+(\.\d+)?\s*$' then canon.value_text::numeric
      else null::numeric
    end as raw_value,

    null::numeric as numerator,
    null::numeric as denominator,

    -- computed_value: same numeric (UI can treat % as rate if it wants)
    case
      when canon.value_text ~ '^\s*-?\d+(\.\d+)?\s*$' then canon.value_text::numeric
      else null::numeric
    end as computed_value,

    now(),
    canon.metric_key_raw,
    canon.metric_key_canonical
  from public.metrics_class_p4p_v v
  cross join lateral (
    select
      e.key as metric_key_raw,
      e.value as value_text,

      -- canonicalize: lower, replace non-alnum with _, collapse __, trim _
      trim(both '_' from regexp_replace(
        regexp_replace(lower(e.key), '[^a-z0-9]+', '_', 'g'),
        '_+', '_', 'g'
      )) as metric_key_canonical
    from jsonb_each_text(coalesce(v.raw, '{}'::jsonb)) e
  ) canon
  where v.batch_id = p_batch_id
    and v.row_kind = 'TECH'
    and v.tech_id is not null

    -- don't double-store tech id fields (we already have tech_id column)
    and canon.metric_key_canonical not in ('techid','tech_id');
end;
$_$;


--
-- Name: metrics_stage_batch(uuid, date, date, text, text, timestamp with time zone, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.metrics_stage_batch(p_pc_org_id uuid, p_metric_date date, p_fiscal_end_date date, p_source_filename text, p_source_title text, p_source_generated_at timestamp with time zone, p_warning_flags jsonb) RETURNS TABLE(metric_batch_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'core'
    AS $$
declare
  v_workspace_id uuid;
  v_metric_batch_id uuid;
begin
  select w.workspace_id
    into v_workspace_id
  from core.workspaces w
  where w.legacy_pc_org_id = p_pc_org_id
  limit 1;

  if v_workspace_id is null then
    raise exception 'No workspace found for pc_org_id %', p_pc_org_id;
  end if;

  insert into core.metric_batches (
    workspace_id,
    source_filename,
    source_title,
    source_generated_at,
    metric_date,
    fiscal_end_date,
    status,
    row_count,
    warning_flags
  )
  values (
    v_workspace_id,
    p_source_filename,
    p_source_title,
    p_source_generated_at,
    p_metric_date,
    p_fiscal_end_date,
    'staged',
    0,
    coalesce(p_warning_flags, '[]'::jsonb)
  )
  returning core.metric_batches.metric_batch_id
    into v_metric_batch_id;

  return query
  select v_metric_batch_id;
end;
$$;


--
-- Name: metrics_to_num(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.metrics_to_num(v text) RETURNS numeric
    LANGUAGE sql IMMUTABLE
    AS $$
  select nullif(regexp_replace(coalesce(v,''), '[^0-9\.\-]+', '', 'g'), '')::numeric
$$;


--
-- Name: metrics_upload_tpr_batch(uuid, date, date, text, text, timestamp with time zone, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.metrics_upload_tpr_batch(p_pc_org_id uuid, p_metric_date date, p_fiscal_end_date date, p_source_filename text, p_source_title text, p_source_generated_at timestamp with time zone, p_warning_flags jsonb, p_rows jsonb) RETURNS TABLE(metric_batch_id uuid, metric_date date, fiscal_end_date date, row_count integer, status text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'core'
    AS $$
declare
  v_workspace_id uuid;
  v_metric_batch_id uuid;
  v_row_count integer := 0;
begin
  select w.workspace_id
    into v_workspace_id
  from core.workspaces w
  where w.legacy_pc_org_id = p_pc_org_id
  limit 1;

  if v_workspace_id is null then
    raise exception 'No workspace mapped for pc_org_id %', p_pc_org_id;
  end if;

  insert into core.metric_batches (
    workspace_id,
    source_filename,
    source_title,
    source_generated_at,
    metric_date,
    fiscal_end_date,
    status,
    row_count,
    warning_flags,
    created_by_app_user_id,
    updated_by_app_user_id
  )
  values (
    v_workspace_id,
    p_source_filename,
    p_source_title,
    p_source_generated_at,
    p_metric_date,
    p_fiscal_end_date,
    'staged',
    0,
    coalesce(p_warning_flags, '[]'::jsonb),
    null,
    null
  )
  returning core.metric_batches.metric_batch_id
    into v_metric_batch_id;

  insert into core.metric_rows (
    metric_batch_id,
    workspace_id,
    reported_tech_id,
    metric_date,
    fiscal_end_date,
    raw_payload,
    legacy_metric_row_id,
    legacy_unique_row_key
  )
  select
    v_metric_batch_id,
    v_workspace_id,
    x.reported_tech_id,
    p_metric_date,
    p_fiscal_end_date,
    x.raw_payload,
    null,
    concat(
      trim(x.reported_tech_id),
      '::',
      lower(p_pc_org_id::text),
      '::',
      p_fiscal_end_date::text,
      '::',
      v_metric_batch_id::text
    )
  from jsonb_to_recordset(p_rows) as x(
    reported_tech_id text,
    raw_payload jsonb
  );

  get diagnostics v_row_count = row_count;

  update core.metric_batches
     set status = 'loaded',
         row_count = v_row_count,
         warning_flags = coalesce(p_warning_flags, '[]'::jsonb)
   where core.metric_batches.metric_batch_id = v_metric_batch_id;

  perform core.rebuild_metric_scores_fact(v_metric_batch_id);

  update core.metric_batches
     set status = 'complete',
         row_count = v_row_count,
         warning_flags = coalesce(p_warning_flags, '[]'::jsonb)
   where core.metric_batches.metric_batch_id = v_metric_batch_id;

  return query
  select
    v_metric_batch_id,
    p_metric_date,
    p_fiscal_end_date,
    v_row_count,
    'complete'::text;
exception
  when others then
    if v_metric_batch_id is not null then
      update core.metric_batches
         set status = 'failed',
             warning_flags = coalesce(p_warning_flags, '[]'::jsonb) || jsonb_build_array(
               jsonb_build_object(
                 'code', 'PROCESSING_ERROR',
                 'message', sqlerrm
               )
             )
       where core.metric_batches.metric_batch_id = v_metric_batch_id;
    end if;
    raise;
end;
$$;


--
-- Name: onboard_roster_scoped(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.onboard_roster_scoped(p_pc_org_id uuid) RETURNS TABLE(entity_type text, entity_id uuid, display_name text, person_active boolean, person_role text, co_code text, co_ref_id uuid, membership_status text, membership_pc_org_id uuid, contractor_code text)
    LANGUAGE sql STABLE
    AS $$
  -- A) people with NO active membership anywhere (includes person.active true/false)
  select
    'person'::text as entity_type,
    p.person_id as entity_id,
    p.full_name as display_name,
    p.active as person_active,
    p.role as person_role,
    p.co_code,
    p.co_ref_id,
    null::text as membership_status,
    null::uuid as membership_pc_org_id,
    null::text as contractor_code
  from public.person p
  where not exists (
    select 1
    from public.person_pc_org ppo
    where ppo.person_id = p.person_id
      and ppo.status = 'active'
      and ppo.active = true
      and (ppo.start_date is null or ppo.start_date <= current_date)
      and (ppo.end_date is null or ppo.end_date >= current_date)
  )

  union all

  -- B) BP supervisors/owners (contractors) active in this scoped org
  select
    'contractor'::text as entity_type,
    c.contractor_id as entity_id,
    c.contractor_name as display_name,
    null::boolean as person_active,
    null::text as person_role,
    null::text as co_code,
    null::uuid as co_ref_id,
    'active'::text as membership_status,
    ca.pc_org_id as membership_pc_org_id,
    c.contractor_code as contractor_code
  from public.contractor_assignment ca
  join public.contractor c on c.contractor_id = ca.contractor_id
  where ca.pc_org_id = p_pc_org_id
    and ca.start_date <= current_date
    and (ca.end_date is null or ca.end_date >= current_date);
$$;


--
-- Name: org_assign_person(uuid, uuid, text, date, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.org_assign_person(p_pc_org_id uuid, p_person_id uuid, p_position_title text, p_start_date date, p_reason_code text DEFAULT NULL::text, p_notes text DEFAULT NULL::text) RETURNS public.assignment
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'api'
    AS $$
declare
  v_actor uuid;
  v_existing_active int;
  v_assignment public.assignment;
begin
  -- Actor (requires authenticated context)
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'Unauthorized: auth.uid() is null';
  end if;

  -- Validate inputs
  if p_pc_org_id is null or p_person_id is null then
    raise exception 'pc_org_id and person_id are required';
  end if;

  if p_position_title is null or length(trim(p_position_title)) = 0 then
    raise exception 'position_title is required';
  end if;

  if p_start_date is null then
    raise exception 'start_date is required';
  end if;

  -- Enforce "globally unassigned": no active assignment anywhere
  select count(*)
    into v_existing_active
  from public.assignment a
  where a.person_id = p_person_id
    and a.end_date is null
    and coalesce(a.active, true) = true;

  if v_existing_active > 0 then
    raise exception 'Person already has an active assignment';
  end if;

  -- Insert assignment (FK on assignment.position_title -> position_title.position_title will enforce standardization)
  insert into public.assignment (
    pc_org_id,
    person_id,
    position_title,
    start_date,
    end_date,
    active
  )
  values (
    p_pc_org_id,
    p_person_id,
    trim(p_position_title),
    p_start_date,
    null,
    true
  )
  returning * into v_assignment;

  -- Insert wire event
  insert into public.org_event (
    pc_org_id,
    event_type,
    actor_user_id,
    person_id,
    assignment_id,
    payload
  )
  values (
    p_pc_org_id,
    'assignment_created',
    v_actor,
    p_person_id,
    v_assignment.assignment_id,
    jsonb_strip_nulls(
      jsonb_build_object(
        'position_title', v_assignment.position_title,
        'start_date', v_assignment.start_date,
        'reason_code', p_reason_code,
        'notes', p_notes
      )
    )
  );

  return v_assignment;
end;
$$;


--
-- Name: org_assign_person(uuid, uuid, text, date, text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.org_assign_person(p_pc_org_id uuid, p_person_id uuid, p_position_title text, p_start_date date, p_reason_code text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_actor_user_id uuid DEFAULT NULL::uuid) RETURNS public.assignment
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'api'
    AS $$
declare
  v_actor uuid;
  v_existing_active int;
  v_assignment public.assignment;
begin
  v_actor := coalesce(p_actor_user_id, auth.uid());
  if v_actor is null then
    raise exception 'Unauthorized: actor_user_id is null';
  end if;

  perform api.assert_pc_org_access(p_pc_org_id);

  if p_pc_org_id is null or p_person_id is null then
    raise exception 'pc_org_id and person_id are required';
  end if;

  if p_position_title is null or length(trim(p_position_title)) = 0 then
    raise exception 'position_title is required';
  end if;

  if p_start_date is null then
    raise exception 'start_date is required';
  end if;

  -- Enforce "globally unassigned": no active assignment anywhere
  select count(*)
    into v_existing_active
  from public.assignment a
  where a.person_id = p_person_id
    and a.end_date is null
    and coalesce(a.active, true) = true;

  if v_existing_active > 0 then
    raise exception 'Person already has an active assignment';
  end if;

  insert into public.assignment(
    pc_org_id,
    person_id,
    position_title,
    start_date,
    end_date,
    active
  )
  values (
    p_pc_org_id,
    p_person_id,
    trim(p_position_title),
    p_start_date,
    null,
    true
  )
  returning * into v_assignment;

  insert into public.org_event(
    pc_org_id,
    event_type,
    actor_user_id,
    person_id,
    assignment_id,
    payload
  )
  values (
    p_pc_org_id,
    'person_assigned',
    v_actor,
    p_person_id,
    v_assignment.assignment_id,
    jsonb_build_object(
      'reason_code', p_reason_code,
      'notes', p_notes,
      'position_title', trim(p_position_title),
      'start_date', p_start_date
    )
  );

  return v_assignment;
end;
$$;


--
-- Name: org_end_assignment(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.org_end_assignment(p_assignment_id uuid, p_actor_user_id uuid, p_notes text DEFAULT NULL::text) RETURNS public.assignment
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'api'
    AS $$
declare
  v_actor uuid;
  v_assignment public.assignment;
begin
  v_actor := coalesce(p_actor_user_id, auth.uid());
  if v_actor is null then
    raise exception 'Unauthorized: actor_user_id is null';
  end if;

  if p_assignment_id is null then
    raise exception 'assignment_id is required';
  end if;

  select *
    into v_assignment
  from public.assignment a
  where a.assignment_id = p_assignment_id
  for update;

  if v_assignment.assignment_id is null then
    raise exception 'Assignment not found';
  end if;

  perform api.assert_pc_org_access(v_assignment.pc_org_id);

  if v_assignment.end_date is not null then
    raise exception 'Assignment already ended';
  end if;

  update public.assignment
  set end_date = current_date,
      active = false
  where assignment_id = p_assignment_id
  returning * into v_assignment;

  insert into public.org_event(
    pc_org_id,
    event_type,
    actor_user_id,
    person_id,
    assignment_id,
    payload
  )
  values (
    v_assignment.pc_org_id,
    'assignment_ended',
    v_actor,
    v_assignment.person_id,
    v_assignment.assignment_id,
    jsonb_build_object(
      'notes', p_notes,
      'ended_on', current_date
    )
  );

  return v_assignment;
end;
$$;


--
-- Name: org_transfer_person(uuid, uuid, text, date, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.org_transfer_person(p_from_assignment_id uuid, p_to_pc_org_id uuid, p_position_title text, p_start_date date, p_actor_user_id uuid, p_notes text DEFAULT NULL::text) RETURNS public.assignment
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'api'
    AS $$
declare
  v_actor uuid;
  v_from public.assignment;
  v_to public.assignment;
begin
  v_actor := coalesce(p_actor_user_id, auth.uid());
  if v_actor is null then
    raise exception 'Unauthorized: actor_user_id is null';
  end if;

  if p_from_assignment_id is null then
    raise exception 'from_assignment_id is required';
  end if;

  if p_to_pc_org_id is null then
    raise exception 'to_pc_org_id is required';
  end if;

  if p_position_title is null or length(trim(p_position_title)) = 0 then
    raise exception 'position_title is required';
  end if;

  if p_start_date is null then
    raise exception 'start_date is required';
  end if;

  select *
    into v_from
  from public.assignment a
  where a.assignment_id = p_from_assignment_id
  for update;

  if v_from.assignment_id is null then
    raise exception 'From assignment not found';
  end if;

  -- Must be allowed in BOTH orgs
  perform api.assert_pc_org_access(v_from.pc_org_id);
  perform api.assert_pc_org_access(p_to_pc_org_id);

  if v_from.end_date is not null then
    raise exception 'From assignment already ended';
  end if;

  update public.assignment
  set end_date = current_date,
      active = false
  where assignment_id = v_from.assignment_id
  returning * into v_from;

  insert into public.assignment(
    pc_org_id,
    person_id,
    position_title,
    start_date,
    end_date,
    active
  )
  values (
    p_to_pc_org_id,
    v_from.person_id,
    trim(p_position_title),
    p_start_date,
    null,
    true
  )
  returning * into v_to;

  insert into public.org_event(
    pc_org_id,
    event_type,
    actor_user_id,
    person_id,
    assignment_id,
    payload
  )
  values (
    p_to_pc_org_id,
    'person_transferred',
    v_actor,
    v_from.person_id,
    v_to.assignment_id,
    jsonb_build_object(
      'notes', p_notes,
      'from_pc_org_id', v_from.pc_org_id,
      'from_assignment_id', v_from.assignment_id,
      'to_pc_org_id', p_to_pc_org_id,
      'to_assignment_id', v_to.assignment_id,
      'position_title', trim(p_position_title),
      'start_date', p_start_date,
      'ended_on', current_date
    )
  );

  return v_to;
end;
$$;


--
-- Name: orgs_for_user_lob(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.orgs_for_user_lob(p_lob text) RETURNS TABLE(pc_org_id uuid, pc_org_name text, mso_id uuid, mso_lob text)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'api'
    AS $$
  select
    po.pc_org_id,
    po.pc_org_name,
    po.mso_id,
    m.mso_lob
  from public.pc_org po
  join public.mso m on m.mso_id = po.mso_id
  where upper(coalesce(m.mso_lob,'')) = upper(coalesce(p_lob,''))
    and (
      api._baseline_access_for_user(auth.uid(), po.pc_org_id) = true
      or api.user_has_global_org_visibility(auth.uid(), p_lob) = true
    )
  order by po.pc_org_name asc;
$$;


--
-- Name: pc_org_roster_drilldown_for_pc_org(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pc_org_roster_drilldown_for_pc_org(p_pc_org_id uuid) RETURNS TABLE(pc_org_id uuid, pc_org_name text, assignment_id uuid, person_id uuid, full_name text, position_title text, tech_id text, start_date date, end_date date, active boolean)
    LANGUAGE sql STABLE
    AS $$
  select
    a.pc_org_id,
    po.pc_org_name,
    a.assignment_id,
    a.person_id,
    p.full_name,
    a.position_title,
    a.tech_id,
    a.start_date,
    a.end_date,
    a.active
  from public.assignment a
  join public.person p on p.person_id = a.person_id
  join public.pc_org po on po.pc_org_id = a.pc_org_id
  where a.pc_org_id = p_pc_org_id
  order by
    a.active desc nulls last,
    p.full_name asc,
    a.start_date desc;
$$;


--
-- Name: pc_org_set_name_from_pc(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pc_org_set_name_from_pc() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  select p.pc_number::text
    into new.pc_org_name
  from pc p
  where p.pc_id = new.pc_id;

  if new.pc_org_name is null then
    raise exception 'pc_org_name could not be derived: pc_id % not found in pc', new.pc_id;
  end if;

  return new;
end;
$$;


--
-- Name: pc_org_state_coverage_touch_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pc_org_state_coverage_touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: pc_propagate_number_to_pc_org(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pc_propagate_number_to_pc_org() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.pc_number is distinct from old.pc_number then
    update pc_org
    set pc_org_name = new.pc_number::text
    where pc_id = new.pc_id;
  end if;

  return new;
end;
$$;


--
-- Name: people_create(text, uuid, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.people_create(p_full_name text, p_created_by_app_user_id uuid, p_tech_id text DEFAULT NULL::text, p_nt_login text DEFAULT NULL::text, p_csg text DEFAULT NULL::text, p_mobile text DEFAULT NULL::text, p_email text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  v_person_id uuid;
  v_onboarding_pc_org_id uuid;
begin
  select up.selected_pc_org_id
    into v_onboarding_pc_org_id
  from public.user_profile up
  where up.auth_user_id = p_created_by_app_user_id
  limit 1;

  insert into core.people (
    full_name,
    status,
    onboarding_pc_org_id,
    created_by_app_user_id,
    updated_by_app_user_id
  )
  values (
    p_full_name,
    'onboarding',
    v_onboarding_pc_org_id,
    p_created_by_app_user_id,
    p_created_by_app_user_id
  )
  returning person_id into v_person_id;

  if nullif(trim(coalesce(p_tech_id, '')), '') is not null then
    insert into core.person_identifiers (person_id, identifier_type, identifier_value, is_primary)
    values (v_person_id, 'TECH_ID', trim(p_tech_id), true);
  end if;

  if nullif(trim(coalesce(p_nt_login, '')), '') is not null then
    insert into core.person_identifiers (person_id, identifier_type, identifier_value, is_primary)
    values (v_person_id, 'NT_LOGIN', trim(p_nt_login), true);
  end if;

  if nullif(trim(coalesce(p_csg, '')), '') is not null then
    insert into core.person_identifiers (person_id, identifier_type, identifier_value, is_primary)
    values (v_person_id, 'CSG_ID', trim(p_csg), true);
  end if;

  if nullif(trim(coalesce(p_mobile, '')), '') is not null then
    insert into core.person_contacts (person_id, contact_type, contact_value, is_primary)
    values (v_person_id, 'phone', trim(p_mobile), true);
  end if;

  if nullif(trim(coalesce(p_email, '')), '') is not null then
    insert into core.person_contacts (person_id, contact_type, contact_value, is_primary)
    values (v_person_id, 'email', trim(p_email), true);
  end if;

  return jsonb_build_object(
    'ok', true,
    'person_id', v_person_id,
    'onboarding_pc_org_id', v_onboarding_pc_org_id
  );
end;
$$;


--
-- Name: people_create(text, uuid, text, text, text, text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.people_create(p_full_name text, p_created_by_app_user_id uuid, p_tech_id text DEFAULT NULL::text, p_nt_login text DEFAULT NULL::text, p_csg text DEFAULT NULL::text, p_mobile text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_prospecting_affiliation_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  v_person_id uuid;
begin
  insert into core.people (
    full_name,
    status,
    prospecting_affiliation_id,
    created_by_app_user_id,
    updated_by_app_user_id
  )
  values (
    p_full_name,
    'onboarding',
    p_prospecting_affiliation_id,
    p_created_by_app_user_id,
    p_created_by_app_user_id
  )
  returning person_id into v_person_id;

  if nullif(trim(coalesce(p_tech_id, '')), '') is not null then
    insert into core.person_identifiers (person_id, identifier_type, identifier_value, is_primary)
    values (v_person_id, 'TECH_ID', trim(p_tech_id), true);
  end if;

  if nullif(trim(coalesce(p_nt_login, '')), '') is not null then
    insert into core.person_identifiers (person_id, identifier_type, identifier_value, is_primary)
    values (v_person_id, 'NT_LOGIN', trim(p_nt_login), true);
  end if;

  if nullif(trim(coalesce(p_csg, '')), '') is not null then
    insert into core.person_identifiers (person_id, identifier_type, identifier_value, is_primary)
    values (v_person_id, 'CSG_ID', trim(p_csg), true);
  end if;

  if nullif(trim(coalesce(p_mobile, '')), '') is not null then
    insert into core.person_contacts (person_id, contact_type, contact_value, is_primary)
    values (v_person_id, 'phone', trim(p_mobile), true);
  end if;

  if nullif(trim(coalesce(p_email, '')), '') is not null then
    insert into core.person_contacts (person_id, contact_type, contact_value, is_primary)
    values (v_person_id, 'email', trim(p_email), true);
  end if;

  return jsonb_build_object(
    'ok', true,
    'person_id', v_person_id
  );
end;
$$;


--
-- Name: people_create_for_current_user(uuid, text, text, text, text, text, text, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.people_create_for_current_user(p_auth_user_id uuid, p_full_name text, p_tech_id text DEFAULT NULL::text, p_nt_login text DEFAULT NULL::text, p_csg text DEFAULT NULL::text, p_mobile text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_prospecting_affiliation_id uuid DEFAULT NULL::uuid, p_onboarding_pc_org_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'core'
    AS $$
declare
  v_app_user_id uuid;
  v_person_id uuid;
  v_profile record;
  v_onboarding_pc_org_id uuid;
  v_onboarding_pc_org_name text;
begin
  select
    up.auth_user_id,
    up.core_person_id,
    up.person_id,
    up.selected_pc_org_id,
    coalesce(up.is_admin, false) as is_admin,
    au.email
  into v_profile
  from public.user_profile up
  left join auth.users au
    on au.id = up.auth_user_id
  where up.auth_user_id = p_auth_user_id
  limit 1;

  if v_profile.auth_user_id is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'User profile not found'
    );
  end if;

  v_onboarding_pc_org_id :=
    coalesce(p_onboarding_pc_org_id, v_profile.selected_pc_org_id);

  if v_onboarding_pc_org_id is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'Selected PC org not found'
    );
  end if;

  select au.app_user_id
  into v_app_user_id
  from core.app_users au
  where au.auth_user_id = p_auth_user_id
  limit 1;

  if v_app_user_id is null then
    insert into core.app_users (
      auth_user_id,
      person_id,
      display_name,
      primary_email,
      status
    )
    values (
      p_auth_user_id,
      coalesce(v_profile.core_person_id, v_profile.person_id),
      split_part(coalesce(v_profile.email, 'App User'), '@', 1),
      v_profile.email,
      'active'
    )
    returning app_user_id into v_app_user_id;
  else
    update core.app_users
    set
      person_id = coalesce(
        v_profile.core_person_id,
        v_profile.person_id,
        core.app_users.person_id
      ),
      primary_email = coalesce(
        v_profile.email,
        core.app_users.primary_email
      ),
      status = 'active',
      updated_at = now()
    where app_user_id = v_app_user_id;
  end if;

  if v_profile.is_admin then
    if not exists (
      select 1
      from core.workspaces w
      join public.pc_org po
        on po.pc_org_id = w.legacy_pc_org_id
       and po.fulfillment_center_id is not null
      where w.status = 'active'
        and w.legacy_pc_org_id = v_onboarding_pc_org_id
    ) then
      return jsonb_build_object(
        'ok', false,
        'error', 'Selected onboarding org is not available to this user'
      );
    end if;
  else
    if not exists (
      select 1
      from core.memberships m
      join core.workspaces w
        on w.workspace_id = m.workspace_id
      join public.pc_org po
        on po.pc_org_id = w.legacy_pc_org_id
       and po.fulfillment_center_id is not null
      where m.app_user_id = v_app_user_id
        and m.status = 'active'
        and w.status = 'active'
        and w.legacy_pc_org_id = v_onboarding_pc_org_id
    ) then
      return jsonb_build_object(
        'ok', false,
        'error', 'Selected onboarding org is not available to this user'
      );
    end if;
  end if;

  insert into core.people (
    full_name,
    status,
    prospecting_affiliation_id,
    onboarding_pc_org_id,
    created_by_app_user_id,
    updated_by_app_user_id
  )
  values (
    p_full_name,
    'onboarding',
    p_prospecting_affiliation_id,
    v_onboarding_pc_org_id,
    v_app_user_id,
    v_app_user_id
  )
  returning person_id into v_person_id;

  if p_tech_id is not null and trim(p_tech_id) <> '' then
    insert into core.person_identifiers (
      person_id,
      identifier_type,
      identifier_value,
      is_primary
    )
    values (
      v_person_id,
      'TECH_ID',
      trim(p_tech_id),
      true
    );
  end if;

  if p_nt_login is not null and trim(p_nt_login) <> '' then
    insert into core.person_identifiers (
      person_id,
      identifier_type,
      identifier_value,
      is_primary
    )
    values (
      v_person_id,
      'NT_LOGIN',
      trim(p_nt_login),
      true
    );
  end if;

  if p_csg is not null and trim(p_csg) <> '' then
    insert into core.person_identifiers (
      person_id,
      identifier_type,
      identifier_value,
      is_primary
    )
    values (
      v_person_id,
      'CSG',
      trim(p_csg),
      true
    );
  end if;

  if p_mobile is not null and trim(p_mobile) <> '' then
    insert into core.person_contacts (
      person_id,
      contact_type,
      contact_value,
      is_primary
    )
    values (
      v_person_id,
      'phone',
      trim(p_mobile),
      true
    );
  end if;

  if p_email is not null and trim(p_email) <> '' then
    insert into core.person_contacts (
      person_id,
      contact_type,
      contact_value,
      is_primary
    )
    values (
      v_person_id,
      'email',
      trim(p_email),
      true
    );
  end if;

  select coalesce(
    po.pc_org_name,
    po.fulfillment_center_name
  )
  into v_onboarding_pc_org_name
  from public.pc_org po
  where po.pc_org_id = v_onboarding_pc_org_id
  limit 1;

  return jsonb_build_object(
    'ok', true,
    'person_id', v_person_id,
    'onboarding_pc_org_id', v_onboarding_pc_org_id,
    'onboarding_pc_org_name', v_onboarding_pc_org_name
  );
end;
$$;


--
-- Name: people_global_unassigned_search(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.people_global_unassigned_search(p_query text DEFAULT ''::text, p_limit integer DEFAULT 25) RETURNS TABLE(person_id uuid, full_name text, emails text)
    LANGUAGE sql STABLE
    AS $$
  with term as (
    select nullif(trim(p_query), '') as q,
           greatest(1, least(coalesce(p_limit, 25), 100)) as lim
  ),
  active_people as (
    select distinct a.person_id
    from public.assignment a
    where (a.end_date is null) and coalesce(a.active, true) = true
  ),
  active_membership as (
    select distinct m.person_id
    from public.person_pc_org m
    where coalesce(m.active, true) = true
      and (m.end_date is null or m.end_date >= current_date)
  )
  select p.person_id, p.full_name, p.emails
  from public.person p
  left join active_people ap on ap.person_id = p.person_id
  left join active_membership am on am.person_id = p.person_id
  cross join term t
  where ap.person_id is null and am.person_id is null
    and coalesce(p.active, true) = true
    and (
      t.q is null
      or p.full_name ilike '%' || t.q || '%'
      or coalesce(p.emails, '') ilike '%' || t.q || '%'
    )
  order by p.full_name
  limit (select lim from term);
$$;


--
-- Name: people_global_unassigned_search_any(text, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.people_global_unassigned_search_any(p_query text DEFAULT ''::text, p_limit integer DEFAULT 25, p_active_filter text DEFAULT 'active'::text) RETURNS TABLE(person_id uuid, full_name text, emails text)
    LANGUAGE sql STABLE
    AS $$
  with term as (
    select
      nullif(trim(p_query), '') as q,
      greatest(1, least(coalesce(p_limit, 25), 100)) as lim,
      lower(nullif(trim(coalesce(p_active_filter, 'active')), '')) as f
  ),
  active_people as (
    select distinct a.person_id
    from public.assignment a
    where (a.end_date is null) and coalesce(a.active, true) = true
  )
  select p.person_id, p.full_name, p.emails
  from public.person p
  left join active_people ap on ap.person_id = p.person_id
  cross join term t
  where ap.person_id is null
    and (
      -- status filter
      (t.f is null or t.f = 'active')  and coalesce(p.active, true) = true
      or (t.f = 'inactive')           and coalesce(p.active, true) = false
      or (t.f = 'all')
    )
    and (
      t.q is null
      or p.full_name ilike '%' || t.q || '%'
      or coalesce(p.emails, '') ilike '%' || t.q || '%'
    )
  order by p.full_name
  limit (select lim from term);
$$;


--
-- Name: people_onboard_eligible_search(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.people_onboard_eligible_search(q text, lim integer DEFAULT 100) RETURNS TABLE(person_id uuid, full_name text, mobile text, emails text, is_bp_role boolean, contractor_allowed_in_scope boolean, has_current_assignment_anywhere boolean)
    LANGUAGE sql STABLE
    AS $$
  select *
  from public.person_onboard_eligible_scoped_v
  where coalesce(trim(q), '') = ''
     or full_name ilike '%' || q || '%'
     or mobile ilike '%' || q || '%'
     or emails ilike '%' || q || '%'
  order by full_name
  limit greatest(1, least(lim, 200));
$$;


--
-- Name: people_onboarding_list(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.people_onboarding_list(p_limit integer DEFAULT 100) RETURNS TABLE(person_id uuid, full_name text, status text)
    LANGUAGE sql
    AS $$
  select
    p.person_id,
    p.full_name,
    p.status
  from core.people p
  where p.status = 'onboarding'
  order by p.created_at desc
  limit p_limit;
$$;


--
-- Name: people_onboarding_list(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.people_onboarding_list(p_pc_org_id uuid, p_limit integer DEFAULT 100) RETURNS TABLE(person_id uuid, full_name text, status text)
    LANGUAGE sql
    AS $$
  select
    p.person_id,
    p.full_name,
    p.status
  from core.people p
  where p.status = 'onboarding'
  order by p.created_at desc
  limit p_limit;
$$;


--
-- Name: people_onboarding_list_v2(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.people_onboarding_list_v2(p_pc_org_id uuid, p_limit integer DEFAULT 100) RETURNS TABLE(person_id uuid, full_name text, status text, tech_id text, prospecting_affiliation_id uuid, affiliation_code text, affiliation text, onboarding_date date)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'core'
    AS $$
  with identifier_pivot as (
    select
      pi.person_id,
      max(pi.identifier_value)
        filter (where pi.identifier_type = 'TECH_ID') as tech_id
    from core.person_identifiers pi
    group by pi.person_id
  )
  select
    p.person_id,
    p.full_name,
    p.status,
    ids.tech_id,
    p.prospecting_affiliation_id,
    a.affiliation_code,
    a.affiliation_label as affiliation,
    p.created_at::date as onboarding_date
  from core.people p
  left join identifier_pivot ids
    on ids.person_id = p.person_id
  left join (
    select
      affiliation_id,
      affiliation_code,
      affiliation_label
    from public.workforce_affiliation_options()
  ) a
    on a.affiliation_id = p.prospecting_affiliation_id
  where p.status = 'onboarding'
    and p.onboarding_pc_org_id = p_pc_org_id
  order by p.created_at desc
  limit p_limit;
$$;


--
-- Name: people_onboarding_org_options(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.people_onboarding_org_options(p_auth_user_id uuid) RETURNS TABLE(pc_org_id uuid, pc_org_name text, fulfillment_center_name text, is_selected boolean)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'core'
    AS $$
  with selected_profile as (
    select
      up.selected_pc_org_id,
      coalesce(up.is_admin, false) as is_admin
    from public.user_profile up
    where up.auth_user_id = p_auth_user_id
    limit 1
  ),
  app_user as (
    select au.app_user_id
    from core.app_users au
    where au.auth_user_id = p_auth_user_id
    limit 1
  ),
  scoped_orgs as (
    select distinct
      po.pc_org_id,
      po.pc_org_name,
      po.fulfillment_center_name,
      po.pc_org_id = sp.selected_pc_org_id as is_selected
    from selected_profile sp
    join core.workspaces w
      on w.status = 'active'
     and w.legacy_pc_org_id is not null
    join public.pc_org po
      on po.pc_org_id = w.legacy_pc_org_id
     and po.fulfillment_center_id is not null
    where sp.is_admin = true

    union

    select distinct
      po.pc_org_id,
      po.pc_org_name,
      po.fulfillment_center_name,
      po.pc_org_id = sp.selected_pc_org_id as is_selected
    from selected_profile sp
    join app_user au
      on true
    join core.memberships m
      on m.app_user_id = au.app_user_id
     and m.status = 'active'
    join core.workspaces w
      on w.workspace_id = m.workspace_id
     and w.status = 'active'
    join public.pc_org po
      on po.pc_org_id = w.legacy_pc_org_id
     and po.fulfillment_center_id is not null
    where sp.is_admin = false
  )
  select
    scoped_orgs.pc_org_id,
    scoped_orgs.pc_org_name,
    scoped_orgs.fulfillment_center_name,
    scoped_orgs.is_selected
  from scoped_orgs
  order by scoped_orgs.pc_org_name, scoped_orgs.fulfillment_center_name;
$$;


--
-- Name: people_record_get(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.people_record_get(p_person_id uuid) RETURNS TABLE(person_id uuid, full_name text, legal_name text, preferred_name text, status text, tech_id text, fuse_emp_id text, mobile text, email text, nt_login text, csg text, affiliation_code text, affiliation text, active_assignment_count integer, active_orgs text)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'core'
    AS $$
  with contact_pivot as (
    select
      pc.person_id,
      max(pc.contact_value) filter (where pc.contact_type = 'phone') as mobile,
      max(pc.contact_value) filter (where pc.contact_type = 'email') as email,
      max(replace(pc.contact_value, 'NT_LOGIN:', '')) filter (
        where pc.contact_type = 'other'
          and pc.contact_value like 'NT_LOGIN:%'
      ) as nt_login,
      max(replace(pc.contact_value, 'CSG:', '')) filter (
        where pc.contact_type = 'other'
          and pc.contact_value like 'CSG:%'
      ) as csg
    from core.person_contacts pc
    group by pc.person_id
  ),
  identifier_pivot as (
    select
      pi.person_id,
      max(pi.identifier_value) filter (where pi.identifier_type = 'TECH_ID') as tech_id,
      max(pi.identifier_value) filter (where pi.identifier_type = 'FUSE_EMP_ID') as fuse_emp_id
    from core.person_identifiers pi
    group by pi.person_id
  ),
  active_assignments as (
    select
      a.person_id,
      count(*)::integer as active_assignment_count,
      string_agg(
        distinct coalesce(po.pc_org_name, po.fulfillment_center_name, w.legacy_pc_org_id::text),
        ', '
      ) as active_orgs
    from core.assignments a
    join core.workspaces w
      on w.workspace_id = a.workspace_id
    left join public.pc_org po
      on po.pc_org_id = w.legacy_pc_org_id
    where a.assignment_status = 'active'
      and a.start_date <= current_date
      and (a.end_date is null or a.end_date >= current_date)
    group by a.person_id
  )
  select
    p.person_id,
    p.full_name,
    p.legal_name,
    p.preferred_name,
    p.status,
    ids.tech_id,
    ids.fuse_emp_id,
    cp.mobile,
    cp.email,
    cp.nt_login,
    cp.csg,
    legacy.co_code as affiliation_code,
    case
      when co.company_name is not null then co.company_name
      when ct.contractor_name is not null then ct.contractor_name
      else legacy.co_code
    end as affiliation,
    coalesce(aa.active_assignment_count, 0),
    aa.active_orgs
  from core.people p
  left join public.person legacy
    on legacy.person_id = p.person_id
  left join public.company co
    on co.company_code = legacy.co_code
  left join public.contractor ct
    on ct.contractor_code = legacy.co_code
  left join contact_pivot cp
    on cp.person_id = p.person_id
  left join identifier_pivot ids
    on ids.person_id = p.person_id
  left join active_assignments aa
    on aa.person_id = p.person_id
  where p.person_id = p_person_id;
$$;


--
-- Name: people_staging_search(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.people_staging_search(p_query text DEFAULT NULL::text, p_limit integer DEFAULT 50) RETURNS TABLE(person_id uuid, full_name text, legal_name text, preferred_name text, status text, tech_id text, fuse_emp_id text, mobile text, email text, nt_login text, csg text, prospecting_affiliation_id uuid, onboarding_pc_org_id uuid, onboarding_pc_org_name text, affiliation_code text, affiliation text, active_assignment_count integer, active_orgs text)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'core'
    AS $$
  with contact_pivot as (
    select
      pc.person_id,
      max(pc.contact_value) filter (where pc.contact_type = 'phone') as mobile,
      max(pc.contact_value) filter (where pc.contact_type = 'email') as email
    from core.person_contacts pc
    group by pc.person_id
  ),
  identifier_pivot as (
    select
      pi.person_id,
      max(pi.identifier_value) filter (where pi.identifier_type = 'TECH_ID') as tech_id,
      max(pi.identifier_value) filter (where pi.identifier_type = 'FUSE_EMP_ID') as fuse_emp_id,
      max(pi.identifier_value) filter (where pi.identifier_type = 'NT_LOGIN') as nt_login,
      max(pi.identifier_value) filter (where pi.identifier_type in ('CSG', 'CSG_ID')) as csg
    from core.person_identifiers pi
    group by pi.person_id
  ),
  active_assignments as (
    select
      a.person_id,
      count(*)::integer as active_assignment_count,
      string_agg(
        distinct coalesce(po.pc_org_name, po.fulfillment_center_name, w.legacy_pc_org_id::text),
        ', '
      ) as active_orgs
    from core.assignments a
    join core.workspaces w
      on w.workspace_id = a.workspace_id
    left join public.pc_org po
      on po.pc_org_id = w.legacy_pc_org_id
    join core.people ap
      on ap.person_id = a.person_id
    where a.assignment_status = 'active'
      and coalesce(ap.status, 'active') = 'active'
      and a.start_date <= current_date
      and (a.end_date is null or a.end_date > current_date)
    group by a.person_id
  ),
  affiliation_lookup as (
    select
      a.affiliation_id,
      a.affiliation_code,
      a.affiliation_label
    from public.workforce_affiliation_options() a
  )
  select
    p.person_id,
    p.full_name,
    p.legal_name,
    p.preferred_name,
    p.status,
    ids.tech_id,
    ids.fuse_emp_id,
    cp.mobile,
    cp.email,
    ids.nt_login,
    ids.csg,
    p.prospecting_affiliation_id,
    p.onboarding_pc_org_id,
    coalesce(onb.pc_org_name, onb.fulfillment_center_name) as onboarding_pc_org_name,
    coalesce(al.affiliation_code, legacy.co_code) as affiliation_code,
    coalesce(
      al.affiliation_label,
      co.company_name,
      ct.contractor_name,
      legacy.co_code
    ) as affiliation,
    coalesce(aa.active_assignment_count, 0),
    aa.active_orgs
  from core.people p
  left join public.pc_org onb
    on onb.pc_org_id = p.onboarding_pc_org_id
  left join affiliation_lookup al
    on al.affiliation_id = p.prospecting_affiliation_id
  left join public.person legacy
    on legacy.person_id = p.person_id
  left join public.company co
    on co.company_code = legacy.co_code
  left join public.contractor ct
    on ct.contractor_code = legacy.co_code
  left join contact_pivot cp
    on cp.person_id = p.person_id
  left join identifier_pivot ids
    on ids.person_id = p.person_id
  left join active_assignments aa
    on aa.person_id = p.person_id
  where
    nullif(trim(coalesce(p_query, '')), '') is null
    or lower(coalesce(p.full_name, '')) like '%' || lower(p_query) || '%'
    or lower(coalesce(p.legal_name, '')) like '%' || lower(p_query) || '%'
    or lower(coalesce(p.preferred_name, '')) like '%' || lower(p_query) || '%'
    or lower(coalesce(p.status, '')) like '%' || lower(p_query) || '%'
    or lower(coalesce(ids.tech_id, '')) like '%' || lower(p_query) || '%'
    or lower(coalesce(ids.fuse_emp_id, '')) like '%' || lower(p_query) || '%'
    or lower(coalesce(cp.mobile, '')) like '%' || lower(p_query) || '%'
    or lower(coalesce(cp.email, '')) like '%' || lower(p_query) || '%'
    or lower(coalesce(ids.nt_login, '')) like '%' || lower(p_query) || '%'
    or lower(coalesce(ids.csg, '')) like '%' || lower(p_query) || '%'
    or lower(coalesce(al.affiliation_code, legacy.co_code, '')) like '%' || lower(p_query) || '%'
    or lower(coalesce(al.affiliation_label, co.company_name, ct.contractor_name, '')) like '%' || lower(p_query) || '%'
    or lower(coalesce(onb.pc_org_name, onb.fulfillment_center_name, '')) like '%' || lower(p_query) || '%'
  order by p.full_name
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;


--
-- Name: people_update_identity(uuid, text, text, text, text, text, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.people_update_identity(p_person_id uuid, p_full_name text, p_legal_name text DEFAULT NULL::text, p_preferred_name text DEFAULT NULL::text, p_status text DEFAULT 'active'::text, p_tech_id text DEFAULT NULL::text, p_fuse_emp_id text DEFAULT NULL::text, p_nt_login text DEFAULT NULL::text, p_csg_id text DEFAULT NULL::text, p_mobile text DEFAULT NULL::text, p_email text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'core'
    AS $$
begin
  update core.people
  set
    full_name = p_full_name,
    legal_name = nullif(trim(coalesce(p_legal_name, '')), ''),
    preferred_name = nullif(trim(coalesce(p_preferred_name, '')), ''),
    status = p_status,
    updated_at = now()
  where person_id = p_person_id;

  delete from core.person_identifiers
  where person_id = p_person_id
    and identifier_type in ('TECH_ID', 'FUSE_EMP_ID', 'NT_LOGIN', 'CSG');

  if p_tech_id is not null and trim(p_tech_id) <> '' then
    insert into core.person_identifiers (person_id, identifier_type, identifier_value, is_primary)
    values (p_person_id, 'TECH_ID', trim(p_tech_id), true);
  end if;

  if p_fuse_emp_id is not null and trim(p_fuse_emp_id) <> '' then
    insert into core.person_identifiers (person_id, identifier_type, identifier_value, is_primary)
    values (p_person_id, 'FUSE_EMP_ID', trim(p_fuse_emp_id), true);
  end if;

  if p_nt_login is not null and trim(p_nt_login) <> '' then
    insert into core.person_identifiers (person_id, identifier_type, identifier_value, is_primary)
    values (p_person_id, 'NT_LOGIN', trim(p_nt_login), true);
  end if;

  if p_csg_id is not null and trim(p_csg_id) <> '' then
    insert into core.person_identifiers (person_id, identifier_type, identifier_value, is_primary)
    values (p_person_id, 'CSG', trim(p_csg_id), true);
  end if;

  delete from core.person_contacts
  where person_id = p_person_id
    and contact_type in ('phone', 'email');

  if p_mobile is not null and trim(p_mobile) <> '' then
    insert into core.person_contacts (person_id, contact_type, contact_value, is_primary)
    values (p_person_id, 'phone', trim(p_mobile), true);
  end if;

  if p_email is not null and trim(p_email) <> '' then
    insert into core.person_contacts (person_id, contact_type, contact_value, is_primary)
    values (p_person_id, 'email', trim(p_email), true);
  end if;

  return jsonb_build_object('ok', true);
end;
$$;


--
-- Name: people_update_identity(uuid, text, text, text, text, text, text, text, text, text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.people_update_identity(p_person_id uuid, p_full_name text, p_legal_name text DEFAULT NULL::text, p_preferred_name text DEFAULT NULL::text, p_status text DEFAULT 'active'::text, p_tech_id text DEFAULT NULL::text, p_fuse_emp_id text DEFAULT NULL::text, p_nt_login text DEFAULT NULL::text, p_csg_id text DEFAULT NULL::text, p_mobile text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_prospecting_affiliation_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'core'
    AS $$
begin
  update core.people
  set
    full_name = p_full_name,
    legal_name = nullif(trim(coalesce(p_legal_name, '')), ''),
    preferred_name = nullif(trim(coalesce(p_preferred_name, '')), ''),
    status = p_status,
    prospecting_affiliation_id = p_prospecting_affiliation_id,
    updated_at = now()
  where person_id = p_person_id;

  delete from core.person_identifiers
  where person_id = p_person_id
    and identifier_type in ('TECH_ID', 'FUSE_EMP_ID', 'NT_LOGIN', 'CSG_ID');

  if p_tech_id is not null and trim(p_tech_id) <> '' then
    insert into core.person_identifiers (
      person_id,
      identifier_type,
      identifier_value,
      is_primary
    )
    values (
      p_person_id,
      'TECH_ID',
      trim(p_tech_id),
      true
    );
  end if;

  if p_fuse_emp_id is not null and trim(p_fuse_emp_id) <> '' then
    insert into core.person_identifiers (
      person_id,
      identifier_type,
      identifier_value,
      is_primary
    )
    values (
      p_person_id,
      'FUSE_EMP_ID',
      trim(p_fuse_emp_id),
      true
    );
  end if;

  if p_nt_login is not null and trim(p_nt_login) <> '' then
    insert into core.person_identifiers (
      person_id,
      identifier_type,
      identifier_value,
      is_primary
    )
    values (
      p_person_id,
      'NT_LOGIN',
      trim(p_nt_login),
      true
    );
  end if;

  if p_csg_id is not null and trim(p_csg_id) <> '' then
    insert into core.person_identifiers (
      person_id,
      identifier_type,
      identifier_value,
      is_primary
    )
    values (
      p_person_id,
      'CSG_ID',
      trim(p_csg_id),
      true
    );
  end if;

  delete from core.person_contacts
  where person_id = p_person_id
    and contact_type in ('phone', 'email');

  if p_mobile is not null and trim(p_mobile) <> '' then
    insert into core.person_contacts (
      person_id,
      contact_type,
      contact_value,
      is_primary
    )
    values (
      p_person_id,
      'phone',
      trim(p_mobile),
      true
    );
  end if;

  if p_email is not null and trim(p_email) <> '' then
    insert into core.person_contacts (
      person_id,
      contact_type,
      contact_value,
      is_primary
    )
    values (
      p_person_id,
      'email',
      trim(p_email),
      true
    );
  end if;

  -- Sync identity fields into active workforce assignment spine.
  if p_tech_id is not null and trim(p_tech_id) <> '' then
    update core.assignments
    set
      tech_id = trim(p_tech_id),
      updated_at = now()
    where person_id = p_person_id
      and assignment_status = 'active'
      and (end_date is null or end_date > current_date)
      and tech_id is distinct from trim(p_tech_id);

    update public.company_profile_fact
    set tech_id = trim(p_tech_id)
    where person_id = p_person_id
      and active_flag = true
      and effective_end_date is null
      and tech_id is distinct from trim(p_tech_id);
  end if;

  -- Sync affiliation intent into the active workforce bridge.
  if p_prospecting_affiliation_id is not null then
    update public.company_profile_fact
    set affiliation_id = p_prospecting_affiliation_id
    where person_id = p_person_id
      and active_flag = true
      and effective_end_date is null
      and affiliation_id is distinct from p_prospecting_affiliation_id;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;


--
-- Name: people_update_identity(uuid, text, text, text, text, text, text, text, text, text, text, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.people_update_identity(p_person_id uuid, p_full_name text, p_legal_name text DEFAULT NULL::text, p_preferred_name text DEFAULT NULL::text, p_status text DEFAULT 'active'::text, p_tech_id text DEFAULT NULL::text, p_fuse_emp_id text DEFAULT NULL::text, p_nt_login text DEFAULT NULL::text, p_csg_id text DEFAULT NULL::text, p_mobile text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_prospecting_affiliation_id uuid DEFAULT NULL::uuid, p_onboarding_pc_org_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'core'
    AS $$
begin
  update core.people
  set
    full_name = p_full_name,
    legal_name = nullif(trim(coalesce(p_legal_name, '')), ''),
    preferred_name = nullif(trim(coalesce(p_preferred_name, '')), ''),
    status = p_status,
    prospecting_affiliation_id = p_prospecting_affiliation_id,
    onboarding_pc_org_id = p_onboarding_pc_org_id,
    updated_at = now()
  where person_id = p_person_id;

  delete from core.person_identifiers
  where person_id = p_person_id
    and identifier_type in ('TECH_ID', 'FUSE_EMP_ID', 'NT_LOGIN', 'CSG_ID');

  if p_tech_id is not null and trim(p_tech_id) <> '' then
    insert into core.person_identifiers (person_id, identifier_type, identifier_value, is_primary)
    values (p_person_id, 'TECH_ID', trim(p_tech_id), true);
  end if;

  if p_fuse_emp_id is not null and trim(p_fuse_emp_id) <> '' then
    insert into core.person_identifiers (person_id, identifier_type, identifier_value, is_primary)
    values (p_person_id, 'FUSE_EMP_ID', trim(p_fuse_emp_id), true);
  end if;

  if p_nt_login is not null and trim(p_nt_login) <> '' then
    insert into core.person_identifiers (person_id, identifier_type, identifier_value, is_primary)
    values (p_person_id, 'NT_LOGIN', trim(p_nt_login), true);
  end if;

  if p_csg_id is not null and trim(p_csg_id) <> '' then
    insert into core.person_identifiers (person_id, identifier_type, identifier_value, is_primary)
    values (p_person_id, 'CSG_ID', trim(p_csg_id), true);
  end if;

  delete from core.person_contacts
  where person_id = p_person_id
    and contact_type in ('phone', 'email');

  if p_mobile is not null and trim(p_mobile) <> '' then
    insert into core.person_contacts (person_id, contact_type, contact_value, is_primary)
    values (p_person_id, 'phone', trim(p_mobile), true);
  end if;

  if p_email is not null and trim(p_email) <> '' then
    insert into core.person_contacts (person_id, contact_type, contact_value, is_primary)
    values (p_person_id, 'email', trim(p_email), true);
  end if;

  if p_tech_id is not null and trim(p_tech_id) <> '' then
    update core.assignments
    set
      tech_id = trim(p_tech_id),
      updated_at = now()
    where person_id = p_person_id
      and assignment_status = 'active'
      and (end_date is null or end_date > current_date)
      and tech_id is distinct from trim(p_tech_id);

    update public.company_profile_fact
    set tech_id = trim(p_tech_id)
    where person_id = p_person_id
      and active_flag = true
      and effective_end_date is null
      and tech_id is distinct from trim(p_tech_id);
  end if;

  if p_prospecting_affiliation_id is not null then
    update public.company_profile_fact
    set affiliation_id = p_prospecting_affiliation_id
    where person_id = p_person_id
      and active_flag = true
      and effective_end_date is null
      and affiliation_id is distinct from p_prospecting_affiliation_id;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;


--
-- Name: person_pc_org_end_association(uuid, uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.person_pc_org_end_association(p_person_id uuid, p_pc_org_id uuid, p_end_date date DEFAULT CURRENT_DATE) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'api'
    AS $$
begin
  if p_person_id is null or p_pc_org_id is null then
    raise exception 'missing person_id or pc_org_id';
  end if;

  -- baseline scope
  if not api.can_access_pc_org(p_pc_org_id) then
    raise exception 'forbidden';
  end if;

  -- write authority: roster_manage (legacy helper)
  -- NOTE: this matches your existing "hard forbidden" style.
  if not api.has_any_active_org_grant(p_pc_org_id) then
    raise exception 'forbidden';
  end if;

  update public.person_pc_org
  set
    end_date = coalesce(p_end_date, current_date),
    active = false,
    status = 'inactive',
    updated_at = now()
  where person_id = p_person_id
    and pc_org_id = p_pc_org_id;

  -- If no row was updated, surface it (helps UI debugging)
  if not found then
    raise exception 'not_found';
  end if;
end;
$$;


--
-- Name: person_picker_for_pc_org(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.person_picker_for_pc_org(p_pc_org_id uuid) RETURNS TABLE(person_id uuid, full_name text, is_unassigned boolean, is_assigned_in_selected_pc_org boolean)
    LANGUAGE sql STABLE
    AS $$
  with active_anywhere as (
    select distinct person_id
    from public.assignment
    where active = true
  ),
  active_in_scope as (
    select distinct person_id
    from public.assignment
    where active = true
      and pc_org_id = p_pc_org_id
  )
  select
    p.person_id,
    p.full_name,
    (aa.person_id is null) as is_unassigned,
    (ascope.person_id is not null) as is_assigned_in_selected_pc_org
  from public.person p
  left join active_anywhere aa on aa.person_id = p.person_id
  left join active_in_scope ascope on ascope.person_id = p.person_id
  where
    aa.person_id is null
    or ascope.person_id is not null
  order by
    (aa.person_id is not null) asc,
    p.full_name asc;
$$;


--
-- Name: person_upsert(uuid, text, text, text, text, text, text, text, boolean, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.person_upsert(p_person_id uuid, p_full_name text DEFAULT NULL::text, p_emails text DEFAULT NULL::text, p_mobile text DEFAULT NULL::text, p_fuse_emp_id text DEFAULT NULL::text, p_person_notes text DEFAULT NULL::text, p_person_nt_login text DEFAULT NULL::text, p_person_csg_id text DEFAULT NULL::text, p_active boolean DEFAULT NULL::boolean, p_co_ref_id uuid DEFAULT NULL::uuid) RETURNS public.person
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'api'
    AS $$
declare
  v_exists boolean;
  v_full_name text;
  v_role text := null;
  v_code text := null;
  v_person public.person;
begin
  if p_person_id is null then
    raise exception 'person_id is required';
  end if;

  select exists(select 1 from public.person p where p.person_id = p_person_id)
    into v_exists;

  if not v_exists and p_full_name is null then
    raise exception 'full_name is required when creating a new person';
  end if;

  -- Preserve existing full_name when caller omits it.
  if p_full_name is null then
    select p.full_name into v_full_name
    from public.person p
    where p.person_id = p_person_id;

    v_full_name := coalesce(v_full_name, p_full_name);
  else
    v_full_name := p_full_name;
  end if;

  -- If affiliation is being set/changed, derive role + co_code for roster logic.
  if p_co_ref_id is not null then
    select c.company_code
      into v_code
    from public.company c
    where c.company_id = p_co_ref_id;

    if found then
      v_role := 'Hires';
    else
      select k.contractor_code
        into v_code
      from public.contractor k
      where k.contractor_id = p_co_ref_id;

      if found then
        v_role := 'Contractors';
      else
        raise exception 'Invalid co_ref_id: no matching company or contractor';
      end if;
    end if;
  end if;

  insert into public.person (
    person_id,
    full_name,
    emails,
    mobile,
    fuse_emp_id,
    person_notes,
    person_nt_login,
    person_csg_id,
    active,
    role,
    co_ref_id,
    co_code
  )
  values (
    p_person_id,
    v_full_name,
    p_emails,
    p_mobile,
    p_fuse_emp_id,
    p_person_notes,
    p_person_nt_login,
    p_person_csg_id,
    coalesce(p_active, true),
    v_role,
    p_co_ref_id,
    v_code
  )
  on conflict (person_id) do update
  set
    full_name       = coalesce(excluded.full_name, public.person.full_name),
    emails          = coalesce(excluded.emails, public.person.emails),
    mobile          = coalesce(excluded.mobile, public.person.mobile),
    fuse_emp_id     = coalesce(excluded.fuse_emp_id, public.person.fuse_emp_id),
    person_notes    = coalesce(excluded.person_notes, public.person.person_notes),
    person_nt_login = coalesce(excluded.person_nt_login, public.person.person_nt_login),
    person_csg_id   = coalesce(excluded.person_csg_id, public.person.person_csg_id),
    active          = coalesce(excluded.active, public.person.active),
    co_ref_id       = coalesce(excluded.co_ref_id, public.person.co_ref_id),
    -- Override role/co_code only when we derived them (i.e. affiliation was provided).
    role            = coalesce(excluded.role, public.person.role),
    co_code         = coalesce(excluded.co_code, public.person.co_code)
  returning * into v_person;

  return v_person;
end;
$$;


--
-- Name: person_upsert(boolean, text, uuid, text, text, text, text, text, uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.person_upsert(p_active boolean DEFAULT NULL::boolean, p_co_code text DEFAULT NULL::text, p_co_ref_id uuid DEFAULT NULL::uuid, p_emails text DEFAULT NULL::text, p_full_name text DEFAULT NULL::text, p_fuse_emp_id text DEFAULT NULL::text, p_mobile text DEFAULT NULL::text, p_person_csg_id text DEFAULT NULL::text, p_person_id uuid DEFAULT NULL::uuid, p_person_notes text DEFAULT NULL::text, p_person_nt_login text DEFAULT NULL::text, p_role text DEFAULT NULL::text) RETURNS public.person
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'api'
    AS $$
declare
  v_row public.person;
  v_exists boolean;
begin
  -- 1) never allow "create new person" by omitting person_id
  if p_person_id is null then
    raise exception 'p_person_id is required (refusing implicit insert)'
      using errcode = '22004';
  end if;

  select exists(select 1 from public.person where person_id = p_person_id) into v_exists;

  -- 2) if row doesn't exist, require full_name to satisfy NOT NULL
  if not v_exists and (p_full_name is null or btrim(p_full_name) = '') then
    raise exception 'p_full_name is required when inserting new person (%)', p_person_id
      using errcode = '23502';
  end if;

  insert into public.person (
    person_id,
    full_name,
    emails,
    mobile,
    fuse_emp_id,
    person_notes,
    person_nt_login,
    person_csg_id,
    active,
    role,
    co_ref_id,
    co_code
  )
  values (
    p_person_id,
    p_full_name,
    p_emails,
    p_mobile,
    p_fuse_emp_id,
    p_person_notes,
    p_person_nt_login,
    p_person_csg_id,
    coalesce(p_active, true),
    p_role,
    p_co_ref_id,
    p_co_code
  )
  on conflict (person_id) do update
  set
    full_name       = coalesce(excluded.full_name, public.person.full_name),
    emails          = coalesce(excluded.emails, public.person.emails),
    mobile          = coalesce(excluded.mobile, public.person.mobile),
    fuse_emp_id     = coalesce(excluded.fuse_emp_id, public.person.fuse_emp_id),
    person_notes    = coalesce(excluded.person_notes, public.person.person_notes),
    person_nt_login = coalesce(excluded.person_nt_login, public.person.person_nt_login),
    person_csg_id   = coalesce(excluded.person_csg_id, public.person.person_csg_id),
    active          = coalesce(excluded.active, public.person.active),
    role            = coalesce(excluded.role, public.person.role),
    co_ref_id       = coalesce(excluded.co_ref_id, public.person.co_ref_id),
    co_code         = coalesce(excluded.co_code, public.person.co_code)
  returning * into v_row;

  return v_row;
end;
$$;


--
-- Name: process_next_metrics_job(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_next_metrics_job() RETURNS void
    LANGUAGE plpgsql
    AS $$
declare
  v_job record;
begin
  -- =========================================
  -- LOCK NEXT JOB
  -- =========================================
  select *
  into v_job
  from public.metrics_pipeline_queue
  where status = 'pending'
  order by created_at
  limit 1
  for update skip locked;

  if not found then
    return;
  end if;

  -- =========================================
  -- MARK RUNNING
  -- =========================================
  update public.metrics_pipeline_queue
  set status = 'running',
      started_at = now()
  where job_id = v_job.job_id;

  -- =========================================
  -- LOG START
  -- =========================================
  perform core.log_metric_batch_event(
    v_job.batch_id,
    null,
    'job_started',
    jsonb_build_object(
      'job_id', v_job.job_id,
      'lane', v_job.lane
    )
  );

  begin

    -- =========================================
    -- NSR
    -- =========================================
    perform core.log_metric_batch_event(v_job.batch_id, null, 'nsr_started', null);

    perform api.metrics_pipeline_run_for_batch_secure(v_job.batch_id, 'P4P');

    perform core.log_metric_batch_event(v_job.batch_id, null, 'nsr_completed', null);


    -- =========================================
    -- SMART
    -- =========================================
    perform core.log_metric_batch_event(v_job.batch_id, null, 'smart_started', null);

    perform api.metrics_pipeline_run_for_batch_secure(v_job.batch_id, 'SMART');

    perform core.log_metric_batch_event(v_job.batch_id, null, 'smart_completed', null);


    -- =========================================
    -- TECH
    -- =========================================
    perform core.log_metric_batch_event(v_job.batch_id, null, 'tech_started', null);

    perform api.metrics_pipeline_run_for_batch_secure(v_job.batch_id, 'TECH');

    perform core.log_metric_batch_event(v_job.batch_id, null, 'tech_completed', null);


    -- =========================================
    -- DONE
    -- =========================================
    update public.metrics_pipeline_queue
    set status = 'done',
        finished_at = now()
    where job_id = v_job.job_id;

    perform core.log_metric_batch_event(
      v_job.batch_id,
      null,
      'job_completed',
      jsonb_build_object('job_id', v_job.job_id)
    );

  exception when others then

    -- =========================================
    -- FAIL
    -- =========================================
    update public.metrics_pipeline_queue
    set status = 'failed',
        attempts = attempts + 1,
        error = sqlerrm,
        finished_at = now()
    where job_id = v_job.job_id;

    perform core.log_metric_batch_event(
      v_job.batch_id,
      null,
      'job_failed',
      jsonb_build_object(
        'job_id', v_job.job_id,
        'error', sqlerrm
      )
    );

  end;

end;
$$;


--
-- Name: quota_rollup_build(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.quota_rollup_build(p_pc_org_id uuid, p_fiscal_month_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  -- minimal compatibility shim:
  -- (a) validates inputs exist
  -- (b) returns ok without mutating anything
  if p_pc_org_id is null or p_fiscal_month_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing pc_org_id or fiscal_month_id');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;


--
-- Name: quota_set_pc_org_id_from_route(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.quota_set_pc_org_id_from_route() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  v_pc_org_id uuid;
begin
  if new.route_id is null then
    return new;
  end if;

  select r.pc_org_id
    into v_pc_org_id
  from public.route r
  where r.route_id = new.route_id;

  if v_pc_org_id is not null then
    new.pc_org_id := v_pc_org_id;
  end if;

  return new;
end;
$$;


--
-- Name: quota_sweep_month(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.quota_sweep_month(p_pc_org_id uuid, p_fiscal_month_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  v_today date := (timezone('America/New_York', now()))::date;
  v_start date;
  v_end date;
  v_rows_upserted int := 0;
  v_rows_deleted int := 0;
begin
  select fm.start_date, fm.end_date
    into v_start, v_end
  from public.fiscal_month_dim fm
  where fm.fiscal_month_id = p_fiscal_month_id;

  if v_start is null or v_end is null then
    return jsonb_build_object('ok', false, 'error', 'fiscal_month_dim not found');
  end if;

  if v_end < v_today then
    return jsonb_build_object('ok', true, 'note', 'month entirely past');
  end if;

  if v_start < v_today then
    v_start := v_today;
  end if;

  create temp table if not exists tmp_quota_desired_keys (
    pc_org_id uuid not null,
    shift_date date not null,
    route_id uuid not null,
    primary key (pc_org_id, shift_date, route_id)
  ) on commit drop;

  truncate table tmp_quota_desired_keys;

  with days as (
    select d::date as shift_date
    from generate_series(v_start::timestamp, v_end::timestamp, interval '1 day') gs(d)
  ),
  q as (
    -- baseline quota rows for this org+month
    select
      quota_id,
      pc_org_id,
      fiscal_month_id,
      route_id,
      qh_sun, qh_mon, qh_tue, qh_wed, qh_thu, qh_fri, qh_sat
    from public.quota
    where pc_org_id = p_pc_org_id
      and fiscal_month_id = p_fiscal_month_id
  ),
  final_rows as (
    select
      q.pc_org_id,
      d.shift_date,
      q.route_id,
      q.fiscal_month_id,
      v_end as fiscal_end_date,

      -- hours painted by weekday
      case extract(dow from d.shift_date)
        when 0 then q.qh_sun
        when 1 then q.qh_mon
        when 2 then q.qh_tue
        when 3 then q.qh_wed
        when 4 then q.qh_thu
        when 5 then q.qh_fri
        else q.qh_sat
      end::numeric as quota_hours,

      -- units derived (keep consistent with your 12x convention)
      (
        case extract(dow from d.shift_date)
          when 0 then q.qh_sun
          when 1 then q.qh_mon
          when 2 then q.qh_tue
          when 3 then q.qh_wed
          when 4 then q.qh_thu
          when 5 then q.qh_fri
          else q.qh_sat
        end * 12
      )::numeric as quota_units

    from q
    cross join days d
  ),
  key_ins as (
    insert into tmp_quota_desired_keys (pc_org_id, shift_date, route_id)
    select pc_org_id, shift_date, route_id
    from final_rows
    on conflict do nothing
    returning 1
  ),
  upserted as (
    insert into public.quota_day_fact (
      pc_org_id,
      shift_date,
      route_id,
      fiscal_month_id,
      fiscal_end_date,
      quota_hours,
      quota_units,
      quota_source,
      updated_at
    )
    select
      pc_org_id,
      shift_date,
      route_id,
      fiscal_month_id,
      fiscal_end_date,
      quota_hours,
      quota_units,
      'BASELINE',
      now()
    from final_rows
    on conflict (pc_org_id, shift_date, route_id)
    do update set
      fiscal_month_id = excluded.fiscal_month_id,
      fiscal_end_date = excluded.fiscal_end_date,
      quota_hours = excluded.quota_hours,
      quota_units = excluded.quota_units,
      quota_source = excluded.quota_source,
      updated_at = now()
    returning 1
  )
  select count(*) into v_rows_upserted from upserted;

  delete from public.quota_day_fact f
  where f.pc_org_id = p_pc_org_id
    and f.fiscal_month_id = p_fiscal_month_id
    and f.shift_date between v_start and v_end
    and not exists (
      select 1
      from tmp_quota_desired_keys k
      where k.pc_org_id = f.pc_org_id
        and k.shift_date = f.shift_date
        and k.route_id = f.route_id
    );

  GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;

  return jsonb_build_object(
    'ok', true,
    'window_start', v_start,
    'window_end', v_end,
    'rows_upserted', v_rows_upserted,
    'rows_deleted', v_rows_deleted
  );
end;
$$;


--
-- Name: rebuild_archive_snapshot_computed_json(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rebuild_archive_snapshot_computed_json(p_batch_id uuid, p_class_type text) RETURNS void
    LANGUAGE plpgsql
    AS $$
declare
  v_class text := upper(p_class_type);
begin
  with
  tgt as (
    select
      s.archive_snapshot_id,
      s.tech_id,
      s.raw_metrics_json,
      s.composite_score,
      s.rank_org,
      s.population_size,
      s.percentile
    from public.master_kpi_archive_snapshot s
    where s.batch_id = p_batch_id
      and upper(s.class_type) = v_class
      and s.is_totals = false
  ),

  raw_canon as (
    select
      t.archive_snapshot_id,
      t.tech_id,
      jsonb_object_agg(d.kpi_key::text, to_jsonb(v.num))
        filter (where v.num is not null) as raw_canon_json
    from tgt t
    join public.metrics_kpi_def d
      on d.raw_label_identifier is not null
     and (t.raw_metrics_json ? d.raw_label_identifier)
    left join lateral (
      select
        case
          when jsonb_typeof(t.raw_metrics_json -> d.raw_label_identifier) = 'number' then
            (t.raw_metrics_json ->> d.raw_label_identifier)::numeric

          when jsonb_typeof(t.raw_metrics_json -> d.raw_label_identifier) = 'string' then
            case
              when trim(t.raw_metrics_json ->> d.raw_label_identifier)
                   in ('', '∞', '-∞', 'inf', '-inf', 'Infinity', '-Infinity', 'NaN', 'nan')
                then null
              else
                nullif(
                  regexp_replace(
                    regexp_replace(
                      regexp_replace(
                        trim(t.raw_metrics_json ->> d.raw_label_identifier),
                        '%',
                        '',
                        'g'
                      ),
                      ',',
                      '',
                      'g'
                    ),
                    '[^0-9\.\-]',
                    '',
                    'g'
                  ),
                  ''
                )::numeric
            end
          else null
        end as num
    ) v on true
    group by t.archive_snapshot_id, t.tech_id
  ),

  kpi_detail as (
    select
      kv.tech_id,
      jsonb_object_agg(kv.k, kv.v) as kpi_detail_json
    from (
      select c.tech_id::text, c.kpi_key::text, to_jsonb(c.metric_value)
      from public.metrics_kpi_compute c
      where c.batch_id = p_batch_id and upper(c.class_type) = v_class

      union all
      select c.tech_id::text, (c.kpi_key || '__band'), to_jsonb(c.band_key)
      from public.metrics_kpi_compute c
      where c.batch_id = p_batch_id and upper(c.class_type) = v_class

      union all
      select c.tech_id::text, (c.kpi_key || '__inside_rank'), to_jsonb(c.inside_rank)
      from public.metrics_kpi_compute c
      where c.batch_id = p_batch_id and upper(c.class_type) = v_class

      union all
      select c.tech_id::text, (c.kpi_key || '__n_with_value'), to_jsonb(c.n_with_value)
      from public.metrics_kpi_compute c
      where c.batch_id = p_batch_id and upper(c.class_type) = v_class

      union all
      select c.tech_id::text, (c.kpi_key || '__rank_score'), to_jsonb(c.rank_score)
      from public.metrics_kpi_compute c
      where c.batch_id = p_batch_id and upper(c.class_type) = v_class

      union all
      select c.tech_id::text, (c.kpi_key || '__weighted_points'), to_jsonb(c.weighted_points)
      from public.metrics_kpi_compute c
      where c.batch_id = p_batch_id and upper(c.class_type) = v_class
    ) kv(tech_id, k, v)
    group by kv.tech_id
  ),

  patch as (
    select
      rc.archive_snapshot_id,
      coalesce(t.raw_metrics_json, '{}'::jsonb)
        || coalesce(rc.raw_canon_json, '{}'::jsonb)
        || coalesce(kd.kpi_detail_json, '{}'::jsonb)
        || jsonb_strip_nulls(
             jsonb_build_object(
               'composite_score', t.composite_score,
               'rank_org', t.rank_org,
               'population_size', t.population_size,
               'percentile', t.percentile
             )
           ) as new_json
    from raw_canon rc
    join tgt t on t.archive_snapshot_id = rc.archive_snapshot_id
    left join kpi_detail kd on kd.tech_id = rc.tech_id
  )

  update public.master_kpi_archive_snapshot s
  set computed_metrics_json = p.new_json
  from patch p
  where s.archive_snapshot_id = p.archive_snapshot_id;

end;
$$;


--
-- Name: rebuild_metrics_rank_partition_for_batch(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rebuild_metrics_rank_partition_for_batch(p_batch_id uuid, p_class_type text) RETURNS void
    LANGUAGE plpgsql
    AS $$
declare
  v_class text := upper(p_class_type);
begin
  delete from public.metrics_rank_partition
  where batch_id = p_batch_id
    and upper(class_type) = v_class;

  with base as (
    select
      s.batch_id,
      s.pc_org_id,
      s.metric_date,
      s.fiscal_end_date,
      upper(s.class_type) as class_type,
      s.tech_id,
      s.is_totals,
      coalesce(cs.composite_score, s.composite_score) as composite_score,
      cs.tiebreaker_metric_value,
      cs.tiebreaker_direction,
      coalesce(
        nullif(
          regexp_replace(coalesce(s.raw_metrics_json ->> 'Total Jobs', ''), ',', '', 'g'),
          ''
        ),
        '0'
      )::numeric as total_jobs_num,
      (
        case when coalesce(s.status_badge, '') ilike '%miss%' then 1 else 0 end +
        case when coalesce(s.status_badge, '') ilike '%risk%' then 1 else 0 end +
        case when coalesce(s.status_badge, '') ilike '%warning%' then 1 else 0 end
      )::int as risk_flags
    from public.master_kpi_archive_snapshot s
    left join public.metrics_composite_score_fact_v cs
      on cs.batch_id = s.batch_id
     and cs.pc_org_id = s.pc_org_id
     and cs.metric_date = s.metric_date
     and cs.fiscal_end_date = s.fiscal_end_date
     and upper(cs.class_type) = upper(s.class_type)
     and cs.tech_id = s.tech_id
    where s.batch_id = p_batch_id
      and upper(s.class_type) = v_class
  ),
  eligible as (
    select *
    from base
    where is_totals = false
      and total_jobs_num > 0
      and composite_score is not null
  ),
  eligible_n as (
    select
      pc_org_id,
      metric_date,
      fiscal_end_date,
      count(*)::int as n
    from eligible
    group by 1,2,3
  ),
  ranked as (
    select
      e.batch_id,
      e.pc_org_id,
      e.metric_date,
      e.fiscal_end_date,
      e.class_type,
      e.tech_id,
      dense_rank() over (
        partition by e.batch_id, e.pc_org_id, e.metric_date, e.fiscal_end_date, e.class_type
        order by
          e.composite_score desc nulls last,
          case
            when upper(coalesce(e.tiebreaker_direction, 'HIGHER_BETTER')) = 'LOWER_BETTER'
              then e.tiebreaker_metric_value
            else null
          end asc nulls last,
          case
            when upper(coalesce(e.tiebreaker_direction, 'HIGHER_BETTER')) = 'LOWER_BETTER'
              then null
            else e.tiebreaker_metric_value
          end desc nulls last,
          e.total_jobs_num desc nulls last,
          e.risk_flags asc nulls last,
          e.tech_id
      )::int as rnk,
      coalesce(en.n, 0)::int as n,
      e.composite_score::numeric as total_weighted_points
    from eligible e
    join eligible_n en
      on en.pc_org_id = e.pc_org_id
     and en.metric_date = e.metric_date
     and en.fiscal_end_date = e.fiscal_end_date
  )
  insert into public.metrics_rank_partition (
    id,
    batch_id,
    pc_org_id,
    metric_date,
    fiscal_end_date,
    mso_id,
    class_type,
    tech_id,
    rank,
    n,
    percentile,
    total_weighted_points,
    computed_at
  )
  select
    gen_random_uuid(),
    r.batch_id,
    r.pc_org_id,
    r.metric_date,
    r.fiscal_end_date,
    null::uuid,
    r.class_type,
    r.tech_id,
    r.rnk,
    r.n,
    case
      when r.n <= 1 then 0::numeric
      else (r.rnk::numeric - 1) / (r.n::numeric - 1)
    end,
    r.total_weighted_points,
    now()
  from ranked r;

  with pop as (
    select
      pc_org_id,
      metric_date,
      fiscal_end_date,
      max(n)::int as n
    from public.metrics_rank_partition
    where batch_id = p_batch_id
      and upper(class_type) = v_class
    group by 1,2,3
  )
  update public.master_kpi_archive_snapshot s
  set
    population_size = coalesce(p.n, 0),
    rank_org = rp.rank,
    percentile = rp.percentile
  from pop p,
       public.metrics_rank_partition rp
  where s.batch_id = p_batch_id
    and upper(s.class_type) = v_class
    and s.pc_org_id = p.pc_org_id
    and s.metric_date = p.metric_date
    and s.fiscal_end_date = p.fiscal_end_date
    and rp.batch_id = p_batch_id
    and upper(rp.class_type) = v_class
    and rp.pc_org_id = s.pc_org_id
    and rp.metric_date = s.metric_date
    and rp.fiscal_end_date = s.fiscal_end_date
    and rp.tech_id = s.tech_id;

  update public.master_kpi_archive_snapshot s
  set rank_org = null,
      percentile = null
  where s.batch_id = p_batch_id
    and upper(s.class_type) = v_class
    and s.is_totals = false
    and coalesce(
          nullif(regexp_replace(coalesce(s.raw_metrics_json ->> 'Total Jobs', ''), ',', '', 'g'), ''),
          '0'
        )::numeric <= 0;

end;
$$;


--
-- Name: record_app_session_evidence(uuid, uuid, uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_app_session_evidence(p_auth_user_id uuid, p_person_id uuid, p_pc_org_id uuid, p_assignment_id uuid DEFAULT NULL::uuid, p_email text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.app_access_session_fact (
    auth_user_id,
    person_id,
    pc_org_id,
    assignment_id,
    email,
    first_seen_in_app_at,
    last_seen_in_app_at,
    first_access_pass_issued_at,
    last_access_pass_issued_at,
    evidence_source
  )
  values (
    p_auth_user_id,
    p_person_id,
    p_pc_org_id,
    p_assignment_id,
    lower(trim(p_email)),
    now(),
    now(),
    now(),
    now(),
    'bootstrap'
  )
  on conflict (auth_user_id, person_id, pc_org_id)
  do update
  set
    assignment_id = coalesce(excluded.assignment_id, public.app_access_session_fact.assignment_id),
    email = coalesce(excluded.email, public.app_access_session_fact.email),
    last_seen_in_app_at = now(),
    first_access_pass_issued_at = coalesce(
      public.app_access_session_fact.first_access_pass_issued_at,
      now()
    ),
    last_access_pass_issued_at = now(),
    updated_at = now();
end;
$$;


--
-- Name: refresh_exec_pc_org_access_derived(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_exec_pc_org_access_derived() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'api'
    AS $$
begin
  truncate table public.exec_pc_org_access_derived;

  insert into public.exec_pc_org_access_derived (leader_person_id, pc_org_id, derived_from, derived_at)
  select distinct
    parent_a.person_id as leader_person_id,
    child_a.pc_org_id  as pc_org_id,
    'assignment_reporting'::text as derived_from,
    now() as derived_at
  from public.assignment_reporting ar
  join public.assignment child_a
    on child_a.assignment_id = ar.child_assignment_id
  join public.assignment parent_a
    on parent_a.assignment_id = ar.parent_assignment_id
  where
    ar.start_date <= current_date
    and (ar.end_date is null or ar.end_date >= current_date)
    and child_a.start_date <= current_date
    and (child_a.end_date is null or child_a.end_date >= current_date)
    and parent_a.start_date <= current_date
    and (parent_a.end_date is null or parent_a.end_date >= current_date)
    and coalesce(child_a.active, true) = true
    and coalesce(parent_a.active, true) = true;
end;
$$;


--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


--
-- Name: roster_current_full(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.roster_current_full(p_pc_org_id uuid, p_position_title text DEFAULT NULL::text) RETURNS TABLE(assignment_id uuid, pc_org_id uuid, person_id uuid, full_name text, emails text, mobile text, fuse_emp_id text, person_notes text, person_nt_login text, person_csg_id text, person_active boolean, co_type text, co_code text, co_ref_id uuid, co_name text, tech_id text, start_date date, end_date date, position_title text, assignment_record_active boolean, assignment_active boolean, pc_org_name text, pc_id uuid, pc_number text, mso_id uuid, mso_name text, division_id uuid, division_name text, division_code text, region_id uuid, region_name text, region_code text, reports_to_assignment_id uuid, reports_to_person_id uuid, reports_to_full_name text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'api'
    AS $$
  select
    r.assignment_id,
    r.pc_org_id,

    r.person_id,
    r.full_name,
    r.emails,
    r.mobile,
    r.fuse_emp_id,
    r.person_notes,
    r.person_nt_login,
    r.person_csg_id,
    r.person_active,

    r.co_type,
    r.co_code,
    r.co_ref_id,
    r.co_name,

    r.tech_id,
    r.start_date,
    r.end_date,
    r.position_title,

    r.assignment_record_active,
    r.assignment_active,

    r.pc_org_name,
    r.pc_id,
    r.pc_number,
    r.mso_id,
    r.mso_name,
    r.division_id,
    r.division_name,
    r.division_code,
    r.region_id,
    r.region_name,
    r.region_code,

    r.reports_to_assignment_id,
    r.reports_to_person_id,
    r.reports_to_full_name
  from public.roster_row_module_membership_current_v r
  where r.pc_org_id = p_pc_org_id
    and (p_position_title is null or r.position_title = p_position_title)
  order by r.full_name nulls last;
$$;


--
-- Name: roster_master(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.roster_master(p_pc_org_id uuid) RETURNS TABLE(assignment_id uuid, pc_org_id uuid, pc_org_name text, person_id uuid, full_name text, emails text, mobile text, fuse_emp_id text, person_notes text, person_nt_login text, person_csg_id text, person_active boolean, tech_id text, position_title text, start_date date, end_date date, assignment_active boolean, reports_to_full_name text, co_name text, co_type text, co_code text, co_ref_id uuid)
    LANGUAGE sql STABLE
    AS $$
  select *
  from api.roster_current_full_v2(p_pc_org_id, null);
$$;


--
-- Name: route_lock_ota_first_jobs(uuid, date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.route_lock_ota_first_jobs(p_pc_org_id uuid, p_from date, p_to date) RETURNS TABLE(cp_date text, tech_id text, job_num text, work_order_number text, job_type text, start_time text, cp_time text, time_slot_start_time text, time_slot_end_time text, source_tech_last_name text)
    LANGUAGE sql STABLE
    AS $$

with ranked as (
  select
    j.cp_date::text as cp_date,
    j.tech_id::text as tech_id,
    j.job_num::text as job_num,
    j.work_order_number::text as work_order_number,
    j.job_type::text as job_type,
    j.start_time::text as start_time,
    j.cp_time::text as cp_time,
    j.time_slot_start_time::text as time_slot_start_time,
    j.time_slot_end_time::text as time_slot_end_time,
    j.source_tech_last_name::text as source_tech_last_name,
    row_number() over (
      partition by j.cp_date, j.tech_id
      order by j.start_time asc nulls last, j.cp_time asc nulls last
    ) as rn
  from check_in_job_row j
  where j.pc_org_id = p_pc_org_id
    and j.cp_date >= p_from
    and j.cp_date <= p_to
)

select
  cp_date,
  tech_id,
  job_num,
  work_order_number,
  job_type,
  start_time,
  cp_time,
  time_slot_start_time,
  time_slot_end_time,
  source_tech_last_name
from ranked
where rn = 1
order by cp_date asc, tech_id asc;

$$;


--
-- Name: route_lock_schedule_read_secure(uuid, date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.route_lock_schedule_read_secure(p_pc_org_id uuid, p_month_start date, p_month_end_exclusive date) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_ok boolean;
  v_routes jsonb;
  v_baseline jsonb;
  v_exceptions jsonb;
begin
  -- 1) enforce access using your catalogue
  select exists (
    select 1
    from public.pc_org_permission_grant g
    where g.pc_org_id = p_pc_org_id
      and g.auth_user_id = auth.uid()
      and g.revoked_at is null
      and (g.expires_at is null or g.expires_at > now())
      and g.permission_key in (
        'route_lock_manage',
        'leadership_manage'
        -- add whatever key you use for supervisors/planners
      )
  )
  into v_ok;

  if not v_ok then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- 2) hydrate routes (dropdown)
  select coalesce(jsonb_agg(to_jsonb(r) order by r.route_name), '[]'::jsonb)
  into v_routes
  from public.route r
  where r.pc_org_id = p_pc_org_id
    and (r.active is true or r.active is null);

  -- 3) hydrate baseline rows for the month
  select coalesce(jsonb_agg(to_jsonb(b) order by b.tech_id), '[]'::jsonb)
  into v_baseline
  from public.schedule_baseline_month b
  where b.pc_org_id = p_pc_org_id
    and b.month_start = p_month_start;

  -- 4) optional: hydrate exceptions across the visible window
  select coalesce(jsonb_agg(to_jsonb(e) order by e.shift_date, e.tech_id), '[]'::jsonb)
  into v_exceptions
  from public.schedule_exception_day e
  where e.pc_org_id = p_pc_org_id
    and e.shift_date >= p_month_start
    and e.shift_date < p_month_end_exclusive;

  return jsonb_build_object(
    'routes', v_routes,
    'baseline', v_baseline,
    'exceptions', v_exceptions
  );
end;
$$;


--
-- Name: route_lock_sweep_month(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.route_lock_sweep_month(p_pc_org_id uuid, p_fiscal_month_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  v_schedule jsonb;
  v_quota jsonb;
  v_shift_validation jsonb;
begin
  -- Schedule (today → end of fiscal month)
  v_schedule := public.schedule_sweep_month(p_pc_org_id, p_fiscal_month_id);

  -- Quota (today → end of fiscal month)
  v_quota := public.quota_sweep_month(p_pc_org_id, p_fiscal_month_id);

  -- Shift Validation (today → today+13, enforced internally)
  v_shift_validation := public.shift_validation_sweep_14d(p_pc_org_id, p_fiscal_month_id);

  return jsonb_build_object(
    'ok', true,
    'pc_org_id', p_pc_org_id,
    'fiscal_month_id', p_fiscal_month_id,
    'schedule', v_schedule,
    'quota', v_quota,
    'shift_validation', v_shift_validation
  );
exception
  when others then
    return jsonb_build_object(
      'ok', false,
      'pc_org_id', p_pc_org_id,
      'fiscal_month_id', p_fiscal_month_id,
      'error', sqlerrm
    );
end;
$$;


--
-- Name: rpc_policy_touch_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rpc_policy_touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end $$;


--
-- Name: safe_numeric(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.safe_numeric(v text) RETURNS numeric
    LANGUAGE sql IMMUTABLE
    AS $$
  select
    case
      when v is null then null
      when btrim(v) = '' then null
      when btrim(v) in ('∞','Infinity','-Infinity','NaN') then null
      else nullif(btrim(v), '')::numeric
    end;
$$;


--
-- Name: schedule_seed_next_from_current(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.schedule_seed_next_from_current(p_pc_org_id uuid, p_current_fiscal_month_id uuid, p_next_fiscal_month_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  v_rows_inserted int := 0;
begin

  -- Insert only missing techs into next month
  with source_rows as (
    select *
    from public.schedule_baseline_month b
    where b.pc_org_id = p_pc_org_id
      and b.fiscal_month_id = p_current_fiscal_month_id
      and b.is_active = true
  ),
  missing as (
    select s.*
    from source_rows s
    left join public.schedule_baseline_month tgt
      on tgt.pc_org_id = s.pc_org_id
     and tgt.fiscal_month_id = p_next_fiscal_month_id
     and tgt.tech_id = s.tech_id
    where tgt.tech_id is null
  ),
  inserted as (
    insert into public.schedule_baseline_month (
      pc_org_id,
      fiscal_month_id,
      tech_id,
      assignment_id,
      default_route_id,

      sun, mon, tue, wed, thu, fri, sat,
      sch_hours_sun, sch_hours_mon, sch_hours_tue,
      sch_hours_wed, sch_hours_thu, sch_hours_fri, sch_hours_sat,
      sch_units_sun, sch_units_mon, sch_units_tue,
      sch_units_wed, sch_units_thu, sch_units_fri, sch_units_sat,

      is_active,
      seeded_from_fiscal_month_id,
      seeded_at,
      created_at,
      updated_at
    )
    select
      pc_org_id,
      p_next_fiscal_month_id,
      tech_id,
      assignment_id,
      default_route_id,

      sun, mon, tue, wed, thu, fri, sat,
      sch_hours_sun, sch_hours_mon, sch_hours_tue,
      sch_hours_wed, sch_hours_thu, sch_hours_fri, sch_hours_sat,
      sch_units_sun, sch_units_mon, sch_units_tue,
      sch_units_wed, sch_units_thu, sch_units_fri, sch_units_sat,

      true, -- active by default
      p_current_fiscal_month_id,
      now(),
      now(),
      now()
    from missing
    returning 1
  )
  select count(*) into v_rows_inserted from inserted;

  return jsonb_build_object(
    'ok', true,
    'pc_org_id', p_pc_org_id,
    'from_fiscal_month_id', p_current_fiscal_month_id,
    'to_fiscal_month_id', p_next_fiscal_month_id,
    'rows_inserted', v_rows_inserted
  );
end;
$$;


--
-- Name: schedule_sweep_month(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.schedule_sweep_month(p_pc_org_id uuid, p_fiscal_month_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  v_today date := (timezone('America/New_York', now()))::date;
  v_start date;
  v_end date;
  v_rows_upserted int := 0;
  v_rows_deleted int := 0;
begin
  select fm.start_date, fm.end_date
    into v_start, v_end
  from public.fiscal_month_dim fm
  where fm.fiscal_month_id = p_fiscal_month_id;

  if v_start is null or v_end is null then
    return jsonb_build_object('ok', false, 'error', 'fiscal_month_dim not found');
  end if;

  -- If month is entirely past, no-op
  if v_end < v_today then
    return jsonb_build_object(
      'ok', true,
      'today', v_today,
      'window_start', v_start,
      'window_end', v_end,
      'rows_upserted', 0,
      'rows_deleted', 0,
      'note', 'month entirely past'
    );
  end if;

  -- If month underway, sweep is forward-only (today → end of fiscal month)
  if v_start < v_today then
    v_start := v_today;
  end if;

  -- Temp table to persist desired keys across statements
  create temp table if not exists tmp_schedule_desired_keys (
    pc_org_id uuid not null,
    shift_date date not null,
    tech_id text not null,
    primary key (pc_org_id, shift_date, tech_id)
  ) on commit drop;

  truncate table tmp_schedule_desired_keys;

  -- Populate desired keys + upsert payload via one deterministic query
  with days as (
    select d::date as shift_date
    from generate_series(v_start::timestamp, v_end::timestamp, interval '1 day') gs(d)
  ),
  base as (
    select *
    from public.schedule_baseline_month b
    where b.pc_org_id = p_pc_org_id
      and b.fiscal_month_id = p_fiscal_month_id
      and b.is_active = true
  ),
  ex as (
    select *
    from public.schedule_exception_day e
    where e.pc_org_id = p_pc_org_id
      and e.shift_date between v_start and v_end
      and e.approved = true
  ),
  desired as (
    select
      b.pc_org_id,
      d.shift_date,
      b.tech_id,
      b.fiscal_month_id,
      v_end as fiscal_end_date,
      b.assignment_id,
      b.default_route_id,

      e.schedule_exception_day_id,
      e.force_off,
      e.override_route_id,
      e.override_hours,
      e.override_units,

      case extract(dow from d.shift_date)
        when 0 then b.sun
        when 1 then b.mon
        when 2 then b.tue
        when 3 then b.wed
        when 4 then b.thu
        when 5 then b.fri
        else b.sat
      end as base_on,

      case extract(dow from d.shift_date)
        when 0 then b.sch_hours_sun
        when 1 then b.sch_hours_mon
        when 2 then b.sch_hours_tue
        when 3 then b.sch_hours_wed
        when 4 then b.sch_hours_thu
        when 5 then b.sch_hours_fri
        else b.sch_hours_sat
      end as base_hours,

      case extract(dow from d.shift_date)
        when 0 then b.sch_units_sun
        when 1 then b.sch_units_mon
        when 2 then b.sch_units_tue
        when 3 then b.sch_units_wed
        when 4 then b.sch_units_thu
        when 5 then b.sch_units_fri
        else b.sch_units_sat
      end as base_units
    from base b
    cross join days d
    left join ex e
      on e.pc_org_id = b.pc_org_id
     and e.shift_date = d.shift_date
     and e.tech_id = b.tech_id
  ),
  final_rows as (
    select
      pc_org_id,
      shift_date,
      tech_id,
      fiscal_month_id,
      fiscal_end_date,
      assignment_id,

      case
        when schedule_exception_day_id is not null and force_off = true then false
        when schedule_exception_day_id is not null and force_off = false then true
        else coalesce(base_on,false)
      end as should_emit,

      coalesce(override_route_id, default_route_id) as planned_route_id,
      coalesce(override_hours, base_hours, 0) as planned_hours,
      coalesce(override_units, base_units, 0) as planned_units,

      case
        when schedule_exception_day_id is not null then 'EXCEPTION'
        else 'BASELINE'
      end as plan_source,

      schedule_exception_day_id
    from desired
  ),
  key_ins as (
    insert into tmp_schedule_desired_keys (pc_org_id, shift_date, tech_id)
    select pc_org_id, shift_date, tech_id
    from final_rows
    where should_emit = true
    on conflict do nothing
    returning 1
  ),
  upserted as (
    insert into public.schedule_day_fact (
      pc_org_id,
      shift_date,
      tech_id,
      fiscal_month_id,
      fiscal_end_date,
      assignment_id,
      planned_route_id,
      planned_hours,
      planned_units,
      plan_source,
      schedule_exception_day_id,
      updated_at
    )
    select
      pc_org_id,
      shift_date,
      tech_id,
      fiscal_month_id,
      fiscal_end_date,
      assignment_id,
      planned_route_id,
      planned_hours,
      planned_units,
      plan_source,
      schedule_exception_day_id,
      now()
    from final_rows
    where should_emit = true
    on conflict (pc_org_id, shift_date, tech_id)
    do update set
      fiscal_month_id = excluded.fiscal_month_id,
      fiscal_end_date = excluded.fiscal_end_date,
      assignment_id = excluded.assignment_id,
      planned_route_id = excluded.planned_route_id,
      planned_hours = excluded.planned_hours,
      planned_units = excluded.planned_units,
      plan_source = excluded.plan_source,
      schedule_exception_day_id = excluded.schedule_exception_day_id,
      updated_at = now()
    returning 1
  )
  select count(*) into v_rows_upserted from upserted;

  delete from public.schedule_day_fact f
  where f.pc_org_id = p_pc_org_id
    and f.fiscal_month_id = p_fiscal_month_id
    and f.shift_date between v_start and v_end
    and not exists (
      select 1
      from tmp_schedule_desired_keys k
      where k.pc_org_id = f.pc_org_id
        and k.shift_date = f.shift_date
        and k.tech_id = f.tech_id
    );

  get diagnostics v_rows_deleted = row_count;

  return jsonb_build_object(
    'ok', true,
    'today', v_today,
    'window_start', v_start,
    'window_end', v_end,
    'rows_upserted', v_rows_upserted,
    'rows_deleted', v_rows_deleted
  );
end;
$$;


--
-- Name: set_calendar_blackout_rule_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_calendar_blackout_rule_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: shift_validation_sweep_14d(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shift_validation_sweep_14d(p_pc_org_id uuid, p_fiscal_month_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  v_today date := (timezone('America/New_York', now()))::date;
  v_start date;
  v_end_fm date;
  v_end date;
  v_rows_upserted int := 0;
  v_rows_deleted int := 0;
begin
  select fm.start_date, fm.end_date
    into v_start, v_end_fm
  from public.fiscal_month_dim fm
  where fm.fiscal_month_id = p_fiscal_month_id;

  if v_start is null or v_end_fm is null then
    return jsonb_build_object('ok', false, 'error', 'fiscal_month_dim not found');
  end if;

  if v_start < v_today then
    v_start := v_today;
  end if;

  v_end := least(v_end_fm, v_today + 13);

  if v_end < v_start then
    return jsonb_build_object('ok', true, 'note', 'no-op (window empty)');
  end if;

  create temp table if not exists tmp_sv_desired_keys (
    pc_org_id uuid not null,
    shift_date date not null,
    tech_id text not null,
    primary key (pc_org_id, shift_date, tech_id)
  ) on commit drop;

  truncate table tmp_sv_desired_keys;

  with src as (
    select distinct on (r.pc_org_id, r.shift_date, r.tech_num)
      r.*
    from public.shift_validation_row r
    where r.pc_org_id = p_pc_org_id
      and r.shift_date between v_start and v_end
    order by r.pc_org_id, r.shift_date, r.tech_num, r.ingested_at desc
  ),
  final_rows as (
    select
      s.pc_org_id,
      s.shift_date,
      s.tech_num as tech_id,
      p_fiscal_month_id as fiscal_month_id,
      v_end_fm as fiscal_end_date,
      s.fulfillment_center_id,
      s.fulfillment_center,
      s.company,
      s.fsup_num,
      s.fsup_last_name,
      s.fsup_first_name,
      s.tech_last_name,
      s.tech_first_name,
      s.tech_middle_initial,
      s.title,
      s.shift_start_time,
      s.shift_end_time,
      s.shift_duration,
      s.break_start_time,
      s.break_end_time,
      s.break_duration,
      s.work_duration,
      s.skill_groups,
      s.route_criteria,
      s.shift_type,
      s.productivity_indicator,
      s.start_location,
      s.route_area,
      s.capacity_model,
      s.will_not_generate_capacity,
      s.office,
      s.work_units,
      s.target_unit,
      s.is_work,
      s.is_bplow,
      s.is_prjt,
      s.is_trvl,
      s.is_bptrl,
      s.shift_validation_row_id,
      s.shift_validation_batch_id,
      s.ingested_at
    from src s
  ),
  key_ins as (
    insert into tmp_sv_desired_keys (pc_org_id, shift_date, tech_id)
    select pc_org_id, shift_date, tech_id
    from final_rows
    on conflict do nothing
  ),
  upserted as (
    insert into public.shift_validation_day_fact (
      pc_org_id, shift_date, tech_id,
      fiscal_month_id, fiscal_end_date,
      fulfillment_center_id, fulfillment_center,
      company, fsup_num, fsup_last_name, fsup_first_name,
      tech_last_name, tech_first_name, tech_middle_initial, title,
      shift_start_time, shift_end_time, shift_duration,
      break_start_time, break_end_time, break_duration,
      work_duration, skill_groups, route_criteria, shift_type, productivity_indicator,
      start_location, route_area, capacity_model, will_not_generate_capacity, office,
      work_units, target_unit,
      is_work, is_bplow, is_prjt, is_trvl, is_bptrl,
      shift_validation_row_id, shift_validation_batch_id, ingested_at,
      updated_at
    )
    select
      pc_org_id, shift_date, tech_id,
      fiscal_month_id, fiscal_end_date,
      fulfillment_center_id, fulfillment_center,
      company, fsup_num, fsup_last_name, fsup_first_name,
      tech_last_name, tech_first_name, tech_middle_initial, title,
      shift_start_time, shift_end_time, shift_duration,
      break_start_time, break_end_time, break_duration,
      work_duration, skill_groups, route_criteria, shift_type, productivity_indicator,
      start_location, route_area, capacity_model, will_not_generate_capacity, office,
      work_units, target_unit,
      is_work, is_bplow, is_prjt, is_trvl, is_bptrl,
      shift_validation_row_id, shift_validation_batch_id, ingested_at,
      now()
    from final_rows
    on conflict (pc_org_id, shift_date, tech_id)
    do update set
      fiscal_month_id = excluded.fiscal_month_id,
      fiscal_end_date = excluded.fiscal_end_date,
      fulfillment_center_id = excluded.fulfillment_center_id,
      fulfillment_center = excluded.fulfillment_center,
      company = excluded.company,
      fsup_num = excluded.fsup_num,
      fsup_last_name = excluded.fsup_last_name,
      fsup_first_name = excluded.fsup_first_name,
      tech_last_name = excluded.tech_last_name,
      tech_first_name = excluded.tech_first_name,
      tech_middle_initial = excluded.tech_middle_initial,
      title = excluded.title,
      shift_start_time = excluded.shift_start_time,
      shift_end_time = excluded.shift_end_time,
      shift_duration = excluded.shift_duration,
      break_start_time = excluded.break_start_time,
      break_end_time = excluded.break_end_time,
      break_duration = excluded.break_duration,
      work_duration = excluded.work_duration,
      skill_groups = excluded.skill_groups,
      route_criteria = excluded.route_criteria,
      shift_type = excluded.shift_type,
      productivity_indicator = excluded.productivity_indicator,
      start_location = excluded.start_location,
      route_area = excluded.route_area,
      capacity_model = excluded.capacity_model,
      will_not_generate_capacity = excluded.will_not_generate_capacity,
      office = excluded.office,
      work_units = excluded.work_units,
      target_unit = excluded.target_unit,
      is_work = excluded.is_work,
      is_bplow = excluded.is_bplow,
      is_prjt = excluded.is_prjt,
      is_trvl = excluded.is_trvl,
      is_bptrl = excluded.is_bptrl,
      shift_validation_row_id = excluded.shift_validation_row_id,
      shift_validation_batch_id = excluded.shift_validation_batch_id,
      ingested_at = excluded.ingested_at,
      updated_at = now()
    returning 1
  )
  select count(*) into v_rows_upserted from upserted;

  delete from public.shift_validation_day_fact f
  where f.pc_org_id = p_pc_org_id
    and f.fiscal_month_id = p_fiscal_month_id
    and f.shift_date between v_start and v_end
    and not exists (
      select 1
      from tmp_sv_desired_keys k
      where k.pc_org_id = f.pc_org_id
        and k.shift_date = f.shift_date
        and k.tech_id = f.tech_id
    );

  GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;

  return jsonb_build_object(
    'ok', true,
    'window_start', v_start,
    'window_end', v_end,
    'rows_upserted', v_rows_upserted,
    'rows_deleted', v_rows_deleted
  );
end;
$$;


--
-- Name: sync_person_tech_id_history_from_assignment(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_person_tech_id_history_from_assignment() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  v_is_tech boolean;
  v_new_tech text;
  v_new_start date;
  v_close_date date;
  v_has_active boolean;
begin
  -- Only track technician assignments
  v_is_tech := (lower(btrim(coalesce(new.position_title, ''))) = 'technician');

  -- Normalize tech_id (treat blank as null)
  v_new_tech := nullif(btrim(coalesce(new.tech_id, '')), '');

  -- Normalize start_date
  v_new_start := coalesce(new.start_date, current_date);

  -- "Active" meaning for history purposes:
  v_has_active := (new.end_date is null) and (coalesce(new.active, true) = true);

  -- If not technician: do nothing
  if not v_is_tech then
    return new;
  end if;

  -- If assignment is NOT active anymore, close any open matching history row
  if not v_has_active then
    update public.person_tech_id_history h
       set end_date = coalesce(new.end_date, current_date),
           assignment_id = coalesce(h.assignment_id, new.assignment_id)
     where h.pc_org_id = new.pc_org_id
       and h.person_id = new.person_id
       and h.end_date is null
       and (h.tech_id = coalesce(v_new_tech, h.tech_id)); -- close even if cleared
    return new;
  end if;

  -- From here on: assignment is active (end_date null + active true)

  -- If tech_id is null/blank: close any open history row (can't keep an open tech_id)
  if v_new_tech is null then
    update public.person_tech_id_history h
       set end_date = v_new_start,
           assignment_id = coalesce(h.assignment_id, new.assignment_id)
     where h.pc_org_id = new.pc_org_id
       and h.person_id = new.person_id
       and h.end_date is null;
    return new;
  end if;

  -- Close any existing open history row for this person+org if it's different tech_id
  -- End it the day BEFORE the new start when possible, else same-day close.
  v_close_date := greatest(v_new_start - 1, v_new_start);

  update public.person_tech_id_history h
     set end_date = v_close_date,
         assignment_id = coalesce(h.assignment_id, new.assignment_id)
   where h.pc_org_id = new.pc_org_id
     and h.person_id = new.person_id
     and h.end_date is null
     and h.tech_id <> v_new_tech;

  -- Ensure an open row exists for the new tech_id (idempotent)
  -- If an open row already exists (same tech_id), do nothing.
  if not exists (
    select 1
      from public.person_tech_id_history h
     where h.pc_org_id = new.pc_org_id
       and h.person_id = new.person_id
       and h.end_date is null
       and h.tech_id = v_new_tech
  ) then
    insert into public.person_tech_id_history (
      pc_org_id,
      person_id,
      tech_id,
      start_date,
      end_date,
      source,
      assignment_id
    )
    values (
      new.pc_org_id,
      new.person_id,
      v_new_tech,
      v_new_start,
      null,
      'assignment',
      new.assignment_id
    );
  end if;

  return new;
end;
$$;


--
-- Name: sync_profile_from_user_person_link(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_profile_from_user_person_link() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  -- avoid recursion
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  -- ensure the profile row exists; keep status stable
  insert into public.user_profile (auth_user_id, person_id, status)
  values (new.user_id, new.person_id, 'active')
  on conflict (auth_user_id) do update
    set person_id = excluded.person_id;

  return new;
end;
$$;


--
-- Name: sync_user_person_link_from_profile(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_user_person_link_from_profile() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  -- avoid recursion
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  -- if person_id cleared, delete legacy link
  if new.person_id is null then
    delete from public.user_person_link upl
    where upl.user_id = new.auth_user_id;
    return new;
  end if;

  -- otherwise upsert legacy link
  insert into public.user_person_link (user_id, person_id)
  values (new.auth_user_id, new.person_id)
  on conflict (user_id) do update
    set person_id = excluded.person_id;

  return new;
end;
$$;


--
-- Name: sync_user_profile_to_user_person_link(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_user_profile_to_user_person_link() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  -- If person_id is set, upsert mirror row.
  if new.person_id is not null then
    insert into public.user_person_link (user_id, person_id)
    values (new.auth_user_id, new.person_id)
    on conflict (user_id) do update
      set person_id = excluded.person_id;
  else
    -- If person_id cleared, remove mirror row.
    delete from public.user_person_link upl
    where upl.user_id = new.auth_user_id;
  end if;

  return new;
end;
$$;


--
-- Name: tg_check_in_actual_hours_v2(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_check_in_actual_hours_v2() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  r record;
begin
  select * into r
  from public.compute_check_in_actual_hours_v2(new.shift_date, new.first_start_time, new.last_cp_time);

  new.actual_hours := r.actual_hours;
  new.actual_hours_is_outlier := r.is_outlier;
  new.actual_hours_note := r.note;

  return new;
end;
$$;


--
-- Name: tg_check_in_actual_hours_v5(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_check_in_actual_hours_v5() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  r record;
begin
  select * into r
  from public.compute_check_in_actual_hours_v5(
    new.shift_date,
    new.first_start_time,
    new.last_cp_time,
    new.actual_units,
    new.actual_jobs
  );

  new.actual_hours := r.actual_hours;
  new.actual_hours_is_outlier := r.is_outlier;
  new.actual_hours_note := r.note;

  return new;
end;
$$;


--
-- Name: tg_set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


--
-- Name: touch_locate_metric_observation_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_locate_metric_observation_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: trg_field_log_attachment_refresh_photo_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_field_log_attachment_refresh_photo_count() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  v_report_id uuid;
begin
  v_report_id := coalesce(new.report_id, old.report_id);
  perform public.field_log_refresh_photo_count(v_report_id);
  return coalesce(new, old);
end;
$$;


--
-- Name: trg_field_log_report_event_stream(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_field_log_report_event_stream() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  -- initial create
  if tg_op = 'INSERT' then
    insert into public.field_log_event (
      report_id,
      event_type,
      to_status,
      actor_user_id,
      meta
    )
    values (
      new.report_id,
      'created',
      new.status,
      new.created_by_user_id,
      jsonb_build_object(
        'category_key', new.category_key,
        'subcategory_key', new.subcategory_key,
        'job_number', new.job_number,
        'job_type', new.job_type,
        'config_version_id', new.config_version_id,
        'rule_id', new.rule_id
      )
    );

    if coalesce(new.xm_declared, false) = true then
      insert into public.field_log_event (
        report_id,
        event_type,
        to_status,
        actor_user_id,
        meta
      )
      values (
        new.report_id,
        'xm_declared',
        new.status,
        new.created_by_user_id,
        jsonb_build_object(
          'evidence_declared', new.evidence_declared
        )
      );
    end if;

    return new;
  end if;

  -- state change
  if old.status is distinct from new.status then
    insert into public.field_log_event (
      report_id,
      event_type,
      from_status,
      to_status,
      actor_user_id,
      note,
      meta
    )
    values (
      new.report_id,
      case
        when new.status = 'approved' then 'approved'
        when new.status = 'tech_followup_required' then 'tech_followup_opened'
        when new.status = 'sup_followup_required' then 'sup_followup_opened'
        when old.status = 'tech_followup_required' and new.status = 'pending_review' then 'resubmitted'
        else 'status_changed'
      end,
      old.status,
      new.status,
      coalesce(
        new.approval_owner_user_id,
        new.followup_requested_by_user_id,
        new.created_by_user_id
      ),
      new.followup_note,
      jsonb_build_object(
        'job_number', new.job_number,
        'category_key', new.category_key,
        'subcategory_key', new.subcategory_key
      )
    );
  end if;

  -- xm declared turned on
  if coalesce(old.xm_declared, false) = false
     and coalesce(new.xm_declared, false) = true then
    insert into public.field_log_event (
      report_id,
      event_type,
      from_status,
      to_status,
      actor_user_id,
      meta
    )
    values (
      new.report_id,
      'xm_declared',
      old.status,
      new.status,
      new.created_by_user_id,
      jsonb_build_object(
        'evidence_declared', new.evidence_declared
      )
    );
  end if;

  -- xm verified
  if old.xm_verified_at is null
     and new.xm_verified_at is not null then
    insert into public.field_log_event (
      report_id,
      event_type,
      from_status,
      to_status,
      actor_user_id,
      meta
    )
    values (
      new.report_id,
      'xm_verified',
      old.status,
      new.status,
      new.xm_verified_by_user_id,
      jsonb_build_object(
        'xm_link', new.xm_link,
        'xm_link_valid', new.xm_link_valid
      )
    );
  end if;

  -- locked
  if coalesce(old.locked, false) = false
     and coalesce(new.locked, false) = true then
    insert into public.field_log_event (
      report_id,
      event_type,
      from_status,
      to_status,
      actor_user_id,
      meta
    )
    values (
      new.report_id,
      'locked',
      old.status,
      new.status,
      new.approval_owner_user_id,
      jsonb_build_object(
        'approved_at', new.approved_at
      )
    );
  end if;

  return new;
end;
$$;


--
-- Name: trg_grant_ensures_eligibility(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_grant_ensures_eligibility() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  insert into public.user_pc_org_eligibility (auth_user_id, pc_org_id)
  values (new.auth_user_id, new.pc_org_id)
  on conflict (auth_user_id, pc_org_id) do nothing;

  return new;
end;
$$;


--
-- Name: trg_person_pc_org_activate_person(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_person_pc_org_activate_person() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.active = true AND NEW.status = 'active' THEN
    UPDATE public.person
    SET active = true
    WHERE person_id = NEW.person_id;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: trg_refresh_console_eligibility_derived_del(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_refresh_console_eligibility_derived_del() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'api'
    SET row_security TO 'off'
    AS $$
declare
  org_id uuid;
begin
  for org_id in
    select distinct pc_org_id
    from old_rows
    where pc_org_id is not null
  loop
    perform api.refresh_pc_org_console_eligibility_derived(org_id);
  end loop;

  return null;
end;
$$;


--
-- Name: trg_refresh_console_eligibility_derived_ins(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_refresh_console_eligibility_derived_ins() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'api'
    SET row_security TO 'off'
    AS $$
declare
  org_id uuid;
begin
  for org_id in
    select distinct pc_org_id
    from new_rows
    where pc_org_id is not null
  loop
    perform api.refresh_pc_org_console_eligibility_derived(org_id);
  end loop;

  return null;
end;
$$;


--
-- Name: trg_refresh_console_eligibility_derived_upd(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_refresh_console_eligibility_derived_upd() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'api'
    SET row_security TO 'off'
    AS $$
declare
  org_id uuid;
begin
  for org_id in
    with changed as (
      select pc_org_id from new_rows
      union
      select pc_org_id from old_rows
    )
    select distinct pc_org_id from changed where pc_org_id is not null
  loop
    perform api.refresh_pc_org_console_eligibility_derived(org_id);
  end loop;

  return null;
end;
$$;


--
-- Name: try_numeric(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.try_numeric(p_text text) RETURNS numeric
    LANGUAGE plpgsql IMMUTABLE
    AS $$
declare
  v text;
begin
  v := nullif(btrim(p_text), '');

  if v is null then
    return null;
  end if;

  if v in ('∞', 'Infinity', '-Infinity', 'NaN') then
    return null;
  end if;

  v := replace(v, ',', '');
  v := replace(v, '%', '');

  begin
    return v::numeric;
  exception
    when others then
      return null;
  end;
end;
$$;


--
-- Name: workforce_affiliation_options(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.workforce_affiliation_options() RETURNS TABLE(affiliation_id uuid, affiliation_type text, affiliation_code text, affiliation_label text)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select
    c.company_id as affiliation_id,
    'COMPANY'::text as affiliation_type,
    c.company_code as affiliation_code,
    c.company_name as affiliation_label
  from public.company c
  where c.company_id is not null

  union all

  select
    ct.contractor_id as affiliation_id,
    'CONTRACTOR'::text as affiliation_type,
    ct.contractor_code as affiliation_code,
    ct.contractor_name as affiliation_label
  from public.contractor ct
  where ct.contractor_id is not null

  order by affiliation_label;
$$;


--
-- Name: workforce_assignment_history(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.workforce_assignment_history(p_assignment_id uuid) RETURNS TABLE(assignment_event_id uuid, event_type text, changed_by_app_user_id uuid, old_values jsonb, new_values jsonb, created_at timestamp with time zone)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'core'
    AS $$
  select
    ae.assignment_event_id,
    ae.event_type,
    ae.changed_by_app_user_id,
    ae.old_values,
    ae.new_values,
    ae.created_at
  from core.assignment_events ae
  where ae.assignment_id = p_assignment_id
  order by ae.created_at desc
  limit 25;
$$;


--
-- Name: workforce_person_search(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.workforce_person_search(p_pc_org_id uuid, p_query text DEFAULT NULL::text) RETURNS TABLE(person_id uuid, person_status text, full_name text, tech_id text, position_title text, is_in_workforce boolean, assignment_id uuid, active_assignment_count integer, active_here_label text, active_elsewhere_label text)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'core'
    AS $$
  with identifier_pivot as (
    select
      pi.person_id,
      max(pi.identifier_value) filter (where pi.identifier_type = 'TECH_ID') as tech_id
    from core.person_identifiers pi
    group by pi.person_id
  ),
  active_assignments as (
    select
      a.person_id,
      a.assignment_id,
      a.position_title,
      w.legacy_pc_org_id as pc_org_id,
      coalesce(po.pc_org_name, po.fulfillment_center_name, w.legacy_pc_org_id::text) as pc_org_label
    from core.assignments a
    join core.workspaces w
      on w.workspace_id = a.workspace_id
    left join public.pc_org po
      on po.pc_org_id = w.legacy_pc_org_id
    where a.assignment_status = 'active'
      and a.start_date <= current_date
      and (a.end_date is null or a.end_date >= current_date)
  ),
  selected_org_assignment as (
    select distinct on (aa.person_id)
      aa.person_id,
      aa.assignment_id,
      aa.position_title,
      aa.pc_org_label
    from active_assignments aa
    where aa.pc_org_id = p_pc_org_id
    order by aa.person_id, aa.pc_org_label
  ),
  assignment_summary as (
    select
      aa.person_id,
      count(*)::integer as active_assignment_count,
      string_agg(
        distinct aa.pc_org_label,
        ', '
        order by aa.pc_org_label
      ) filter (where aa.pc_org_id <> p_pc_org_id) as active_elsewhere_label
    from active_assignments aa
    group by aa.person_id
  )
  select
    p.person_id,
    p.status as person_status,
    p.full_name,
    ids.tech_id,
    soa.position_title,
    (soa.assignment_id is not null)::boolean as is_in_workforce,
    soa.assignment_id,
    coalesce(asm.active_assignment_count, 0)::integer as active_assignment_count,
    soa.pc_org_label as active_here_label,
    asm.active_elsewhere_label
  from core.people p
  left join identifier_pivot ids
    on ids.person_id = p.person_id
  left join selected_org_assignment soa
    on soa.person_id = p.person_id
  left join assignment_summary asm
    on asm.person_id = p.person_id
  where
    p_query is null
    or trim(p_query) = ''
    or lower(coalesce(p.full_name, '')) like '%' || lower(p_query) || '%'
    or lower(coalesce(ids.tech_id, '')) like '%' || lower(p_query) || '%'
  order by p.full_name
  limit 50;
$$;


--
-- Name: workforce_person_search(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.workforce_person_search(p_pc_org_id uuid, p_query text DEFAULT NULL::text, p_mode text DEFAULT NULL::text) RETURNS TABLE(person_id uuid, person_status text, full_name text, tech_id text, position_title text, is_in_workforce boolean, assignment_id uuid, active_assignment_count integer, active_here_label text, active_elsewhere_label text)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'core'
    AS $$
  with identifier_pivot as (
    select
      pi.person_id,
      max(pi.identifier_value) filter (where pi.identifier_type = 'TECH_ID') as tech_id
    from core.person_identifiers pi
    group by pi.person_id
  ),
  active_assignments as (
    select
      a.person_id,
      a.assignment_id,
      a.position_title,
      w.legacy_pc_org_id as pc_org_id,
      coalesce(po.pc_org_name, po.fulfillment_center_name, w.legacy_pc_org_id::text) as pc_org_label
    from core.assignments a
    join core.workspaces w
      on w.workspace_id = a.workspace_id
    left join public.pc_org po
      on po.pc_org_id = w.legacy_pc_org_id
    where a.assignment_status = 'active'
      and a.start_date <= current_date
      and (a.end_date is null or a.end_date >= current_date)
  ),
  selected_org_assignment as (
    select distinct on (aa.person_id)
      aa.person_id,
      aa.assignment_id,
      aa.position_title,
      aa.pc_org_label
    from active_assignments aa
    where aa.pc_org_id = p_pc_org_id
    order by aa.person_id, aa.pc_org_label
  ),
  assignment_summary as (
    select
      aa.person_id,
      count(*)::integer as active_assignment_count,
      string_agg(
        distinct aa.pc_org_label,
        ', '
        order by aa.pc_org_label
      ) filter (where aa.pc_org_id <> p_pc_org_id) as active_elsewhere_label
    from active_assignments aa
    group by aa.person_id
  )
  select
    p.person_id,
    p.status as person_status,
    p.full_name,
    ids.tech_id,
    soa.position_title,
    (soa.assignment_id is not null)::boolean as is_in_workforce,
    soa.assignment_id,
    coalesce(asm.active_assignment_count, 0)::integer as active_assignment_count,
    soa.pc_org_label as active_here_label,
    asm.active_elsewhere_label
  from core.people p
  left join identifier_pivot ids
    on ids.person_id = p.person_id
  left join selected_org_assignment soa
    on soa.person_id = p.person_id
  left join assignment_summary asm
    on asm.person_id = p.person_id
  where
    (
      p_query is null
      or trim(p_query) = ''
      or lower(coalesce(p.full_name, '')) like '%' || lower(p_query) || '%'
      or lower(coalesce(ids.tech_id, '')) like '%' || lower(p_query) || '%'
    )
    and (
      p_mode is null
      or p_mode <> 'processing'
      or (
        p.status = 'active'
        and coalesce(asm.active_assignment_count, 0) = 0
        and ids.tech_id is not null
      )
    )
  order by p.full_name
  limit 50;
$$;


--
-- Name: workforce_reporting_validation(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.workforce_reporting_validation(p_pc_org_id uuid) RETURNS TABLE(supervisor_name text, full_name text, tech_id text, position_title text, seat_type text)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'core'
    AS $$
with active_assignments as (
  select
    a.assignment_id,
    a.person_id,
    a.tech_id,
    a.position_title,
    a.reports_to_assignment_id
  from core.assignments a
  join core.workspaces w
    on w.workspace_id = a.workspace_id
  where a.assignment_status = 'active'
    and w.legacy_pc_org_id = p_pc_org_id
    and a.start_date <= current_date
    and (a.end_date is null or a.end_date >= current_date)
),

classified as (
  select
    a.*,
    p.full_name,
    case
      when lower(coalesce(a.position_title, '')) like '%technician%' then 'FIELD'
      when lower(coalesce(a.position_title, '')) like '%travel%' then 'TRAVEL'
      when lower(coalesce(a.position_title, '')) like '%drop%bury%' then 'DROP_BURY'
      when lower(coalesce(a.position_title, '')) like '%owner%' then 'LEADERSHIP'
      when lower(coalesce(a.position_title, '')) like '%supervisor%' then 'LEADERSHIP'
      when lower(coalesce(a.position_title, '')) like '%manager%' then 'LEADERSHIP'
      when lower(coalesce(a.position_title, '')) like '%lead%' then 'LEADERSHIP'
      else 'SUPPORT'
    end as seat_type,
    case
      when lower(coalesce(a.position_title, '')) like '%regional manager%' then 'COMPANY_MANAGER'
      when lower(coalesce(a.position_title, '')) like '%company manager%' then 'COMPANY_MANAGER'
      when lower(coalesce(a.position_title, '')) like '%itg supervisor%' then 'COMPANY_SUPERVISOR'
      when lower(coalesce(a.position_title, '')) like '%company supervisor%' then 'COMPANY_SUPERVISOR'
      when lower(coalesce(a.position_title, '')) like '%bp supervisor%' then 'BP_SUPERVISOR'
      when lower(coalesce(a.position_title, '')) like '%bp owner%' then 'BP_SUPERVISOR'
      when lower(coalesce(a.position_title, '')) like '%bp lead%' then 'BP_SUPERVISOR'
      when lower(coalesce(a.position_title, '')) like '%technician%' then 'TECH'
      when lower(coalesce(a.position_title, '')) like '%travel%' then 'TECH'
      else 'OTHER'
    end as role_scope
  from active_assignments a
  left join core.people p
    on p.person_id = a.person_id
),

edges as (
  select
    child.assignment_id as child_assignment_id,
    parent.assignment_id as parent_assignment_id,
    parent.full_name as supervisor_name,
    parent.role_scope as supervisor_role_scope,
    child.full_name,
    child.tech_id,
    child.position_title,
    child.seat_type,
    child.role_scope
  from classified child
  left join classified parent
    on parent.assignment_id = child.reports_to_assignment_id
),

manager_direct_techs as (
  select
    supervisor_name,
    full_name,
    tech_id,
    position_title,
    seat_type
  from edges
  where supervisor_role_scope = 'COMPANY_MANAGER'
    and seat_type in ('FIELD', 'TRAVEL')
),

manager_bp_supervisor_techs as (
  select
    bp.supervisor_name,
    tech.full_name,
    tech.tech_id,
    tech.position_title,
    tech.seat_type
  from edges bp
  join edges tech
    on tech.parent_assignment_id = bp.child_assignment_id
  where bp.supervisor_role_scope = 'COMPANY_MANAGER'
    and bp.role_scope = 'BP_SUPERVISOR'
    and tech.seat_type in ('FIELD', 'TRAVEL')
),

non_manager_direct_chain as (
  select
    supervisor_name,
    full_name,
    tech_id,
    position_title,
    seat_type
  from edges
  where supervisor_role_scope is distinct from 'COMPANY_MANAGER'
    and supervisor_name is not null
),

report_rows as (
  select * from manager_direct_techs
  union all
  select * from manager_bp_supervisor_techs
  union all
  select * from non_manager_direct_chain
)

select
  supervisor_name,
  full_name,
  case
    when tech_id like 'UNASSIGNED-%' then null
    else tech_id
  end as tech_id,
  position_title,
  seat_type
from report_rows
where supervisor_name is not null
order by supervisor_name, full_name;
$$;


--
-- Name: workforce_update_assignment(uuid, uuid, uuid, text, text, uuid, uuid, uuid, date, text, uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.workforce_update_assignment(p_assignment_id uuid DEFAULT NULL::uuid, p_person_id uuid DEFAULT NULL::uuid, p_pc_org_id uuid DEFAULT NULL::uuid, p_tech_id text DEFAULT NULL::text, p_position_title text DEFAULT NULL::text, p_office_id uuid DEFAULT NULL::uuid, p_affiliation_id uuid DEFAULT NULL::uuid, p_reports_to_assignment_id uuid DEFAULT NULL::uuid, p_start_date date DEFAULT NULL::date, p_role_type text DEFAULT NULL::text, p_auth_user_id uuid DEFAULT NULL::uuid, p_end_date date DEFAULT NULL::date) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'core'
    AS $$
declare
  v_current core.assignments%rowtype;
  v_workspace_id uuid;
  v_pc_org_id uuid;
  v_old_role_type text;
  v_old_affiliation_id uuid;
  v_changed_by_app_user_id uuid;
  v_old_values jsonb;
  v_new_values jsonb := '{}'::jsonb;
  v_role_type text;
begin
  v_role_type :=
    coalesce(
      nullif(trim(p_role_type), ''),
      'TRAINING'
    );

  select au.app_user_id
  into v_changed_by_app_user_id
  from core.app_users au
  where au.auth_user_id = p_auth_user_id
    and au.status = 'active'
  limit 1;

  -- =========================================
  -- INSERT MODE
  -- =========================================

  if p_assignment_id is null then

    if p_person_id is null then
      return jsonb_build_object(
        'ok', false,
        'error', 'Missing person_id for insert'
      );
    end if;

    if p_pc_org_id is null then
      return jsonb_build_object(
        'ok', false,
        'error', 'Missing pc_org_id for insert'
      );
    end if;

    -- =========================================
    -- TECH ID REQUIRED ONLY FOR
    -- FIELD / TRAVEL / DROP_BURY
    -- =========================================

    if (
      v_role_type in ('FIELD', 'TRAVEL', 'DROP_BURY')
      and nullif(trim(coalesce(p_tech_id, '')), '') is null
    ) then
      return jsonb_build_object(
        'ok', false,
        'error', 'Missing tech_id for insert'
      );
    end if;

    select w.workspace_id
    into v_workspace_id
    from core.workspaces w
    where w.legacy_pc_org_id = p_pc_org_id
    limit 1;

    if v_workspace_id is null then
      return jsonb_build_object(
        'ok', false,
        'error', 'Unable to resolve workspace for pc_org_id'
      );
    end if;

    insert into core.assignments (
      person_id,
      workspace_id,
      tech_id,
      position_title,
      office_id,
      reports_to_assignment_id,
      assignment_status,
      start_date,
      end_date,
      is_primary,
      created_by_app_user_id,
      updated_by_app_user_id
    )
    values (
      p_person_id,
      v_workspace_id,
      nullif(trim(coalesce(p_tech_id, '')), ''),
      coalesce(p_position_title, 'Technician'),
      p_office_id,
      p_reports_to_assignment_id,
      'active',
      coalesce(p_start_date, current_date),
      p_end_date,
      true,
      v_changed_by_app_user_id,
      v_changed_by_app_user_id
    )
    returning assignment_id into p_assignment_id;

    insert into public.company_profile_fact (
      person_id,
      pc_org_id,
      tech_id,
      position_title,
      office_id,
      reports_to_person_id,
      affiliation_id,
      role_type,
      active_flag,
      effective_start_date,
      effective_end_date,
      created_by
    )
    values (
      p_person_id,
      p_pc_org_id,
      nullif(trim(coalesce(p_tech_id, '')), ''),
      coalesce(p_position_title, 'Technician'),
      p_office_id,
      null,
      p_affiliation_id,
      v_role_type,
      p_end_date is null,
      coalesce(p_start_date, current_date),
      p_end_date,
      v_changed_by_app_user_id
    );

    insert into core.assignment_events (
      assignment_id,
      event_type,
      changed_by_app_user_id,
      old_values,
      new_values
    )
    values (
      p_assignment_id,
      'CREATE',
      v_changed_by_app_user_id,
      null,
      jsonb_build_object(
        'person_id', p_person_id,
        'pc_org_id', p_pc_org_id,
        'tech_id', nullif(trim(coalesce(p_tech_id, '')), ''),
        'position_title', coalesce(p_position_title, 'Technician'),
        'office_id', p_office_id,
        'affiliation_id', p_affiliation_id,
        'reports_to_assignment_id', p_reports_to_assignment_id,
        'start_date', coalesce(p_start_date, current_date),
        'end_date', p_end_date,
        'role_type', v_role_type
      )
    );

    return jsonb_build_object(
      'ok', true,
      'assignment_id', p_assignment_id
    );
  end if;

  -- =========================================
  -- UPDATE MODE
  -- =========================================

  select *
  into v_current
  from core.assignments
  where assignment_id = p_assignment_id;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'error', 'Assignment not found'
    );
  end if;

  select w.legacy_pc_org_id
  into v_pc_org_id
  from core.workspaces w
  where w.workspace_id = v_current.workspace_id;

  if v_pc_org_id is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'Unable to resolve pc_org_id'
    );
  end if;

  select cpf.role_type, cpf.affiliation_id
  into v_old_role_type, v_old_affiliation_id
  from public.company_profile_fact cpf
  where cpf.person_id = v_current.person_id
    and cpf.pc_org_id = v_pc_org_id
    and cpf.active_flag = true
    and cpf.effective_end_date is null
  order by cpf.effective_start_date desc, cpf.created_at desc
  limit 1;

  v_old_values :=
    to_jsonb(v_current) ||
    jsonb_build_object(
      'role_type', v_old_role_type,
      'affiliation_id', v_old_affiliation_id
    );

  if p_position_title is not null then
    v_new_values :=
      v_new_values ||
      jsonb_build_object('position_title', p_position_title);
  end if;

  if p_office_id is not null then
    v_new_values :=
      v_new_values ||
      jsonb_build_object('office_id', p_office_id);
  end if;

  if p_affiliation_id is not null then
    v_new_values :=
      v_new_values ||
      jsonb_build_object('affiliation_id', p_affiliation_id);
  end if;

  if p_reports_to_assignment_id is not null then
    v_new_values :=
      v_new_values ||
      jsonb_build_object(
        'reports_to_assignment_id',
        p_reports_to_assignment_id
      );
  end if;

  if p_start_date is not null then
    v_new_values :=
      v_new_values ||
      jsonb_build_object('start_date', p_start_date);
  end if;

  if p_end_date is not null then
    v_new_values :=
      v_new_values ||
      jsonb_build_object('end_date', p_end_date);
  end if;

  if p_role_type is not null then
    v_new_values :=
      v_new_values ||
      jsonb_build_object('role_type', p_role_type);
  end if;

  update core.assignments
  set
    position_title = coalesce(p_position_title, position_title),
    office_id = coalesce(p_office_id, office_id),
    reports_to_assignment_id =
      coalesce(
        p_reports_to_assignment_id,
        reports_to_assignment_id
      ),
    start_date = coalesce(p_start_date, start_date),
    end_date = coalesce(p_end_date, end_date),
    updated_at = now(),
    updated_by_app_user_id = v_changed_by_app_user_id
  where assignment_id = p_assignment_id;

  update public.company_profile_fact
  set
    position_title = coalesce(p_position_title, position_title),
    office_id = coalesce(p_office_id, office_id),
    affiliation_id = coalesce(p_affiliation_id, affiliation_id),
    role_type = coalesce(p_role_type, role_type),
    active_flag = case
      when p_end_date is not null then false
      else active_flag
    end,
    effective_end_date =
      coalesce(p_end_date, effective_end_date)
  where person_id = v_current.person_id
    and pc_org_id = v_pc_org_id
    and active_flag = true
    and effective_end_date is null;

  insert into core.assignment_events (
    assignment_id,
    event_type,
    changed_by_app_user_id,
    old_values,
    new_values
  )
  values (
    p_assignment_id,
    case
      when p_end_date is not null then 'END'
      else 'UPDATE'
    end,
    v_changed_by_app_user_id,
    v_old_values,
    v_new_values
  );

  return jsonb_build_object(
    'ok', true,
    'assignment_id', p_assignment_id
  );
end;
$$;


--
-- Name: company; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company (
    company_id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_name text NOT NULL,
    company_code text
);


--
-- Name: contractor; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contractor (
    contractor_id uuid DEFAULT gen_random_uuid() NOT NULL,
    contractor_name text NOT NULL,
    contractor_code text,
    owner_name text,
    owner_email text,
    owner_mobile text
);


--
-- Name: assignments; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.assignments (
    assignment_id uuid DEFAULT gen_random_uuid() NOT NULL,
    person_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    tech_id text,
    position_title text,
    reports_to_assignment_id uuid,
    assignment_status text DEFAULT 'active'::text NOT NULL,
    start_date date NOT NULL,
    end_date date,
    is_primary boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by_app_user_id uuid,
    updated_by_app_user_id uuid,
    office_id uuid,
    CONSTRAINT core_assignments_date_ck CHECK (((end_date IS NULL) OR (end_date >= start_date))),
    CONSTRAINT core_assignments_status_ck CHECK ((assignment_status = ANY (ARRAY['active'::text, 'inactive'::text, 'pending'::text, 'archived'::text])))
);


--
-- Name: people; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.people (
    person_id uuid DEFAULT gen_random_uuid() NOT NULL,
    full_name text NOT NULL,
    legal_name text,
    preferred_name text,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by_app_user_id uuid,
    updated_by_app_user_id uuid,
    prospecting_affiliation_id uuid,
    onboarding_pc_org_id uuid,
    CONSTRAINT core_people_status_ck CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'onboarding'::text, 'onboarding_closed'::text])))
);


--
-- Name: company_profile_fact; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_profile_fact (
    company_profile_id uuid DEFAULT gen_random_uuid() NOT NULL,
    person_id uuid NOT NULL,
    pc_org_id uuid NOT NULL,
    tech_id text,
    position_title text,
    office_id uuid,
    active_flag boolean DEFAULT true NOT NULL,
    effective_start_date date NOT NULL,
    effective_end_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    reports_to_person_id uuid,
    affiliation_id uuid,
    role_type text,
    CONSTRAINT company_profile_fact_role_type_check CHECK ((role_type = ANY (ARRAY['FIELD'::text, 'LEADERSHIP'::text, 'SUPPORT'::text, 'TRAVEL'::text, 'DROP_BURY'::text, 'TRAINING'::text, 'FMLA'::text])))
);


--
-- Name: route_lock_roster_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.route_lock_roster_v AS
 WITH base AS (
         SELECT a.assignment_id,
            w.legacy_pc_org_id AS pc_org_id,
            a.person_id,
            p.full_name,
            a.tech_id,
            COALESCE(cpf.position_title, a.position_title) AS position_title,
            a.start_date,
            a.end_date,
                CASE
                    WHEN (COALESCE(a.assignment_status, 'active'::text) <> 'active'::text) THEN false
                    WHEN (COALESCE(p.status, 'active'::text) <> 'active'::text) THEN false
                    WHEN (a.end_date IS NULL) THEN true
                    WHEN (a.end_date >= CURRENT_DATE) THEN true
                    ELSE false
                END AS assignment_active,
            a.reports_to_assignment_id,
            cpf.role_type,
            cpf.affiliation_id
           FROM (((core.assignments a
             JOIN core.workspaces w ON ((w.workspace_id = a.workspace_id)))
             LEFT JOIN core.people p ON ((p.person_id = a.person_id)))
             LEFT JOIN LATERAL ( SELECT cpf_1.position_title,
                    cpf_1.role_type,
                    cpf_1.affiliation_id
                   FROM public.company_profile_fact cpf_1
                  WHERE ((cpf_1.person_id = a.person_id) AND (cpf_1.pc_org_id = w.legacy_pc_org_id))
                  ORDER BY cpf_1.active_flag DESC, cpf_1.effective_start_date DESC NULLS LAST, cpf_1.created_at DESC NULLS LAST
                 LIMIT 1) cpf ON (true))
          WHERE ((a.person_id IS NOT NULL) AND (upper(COALESCE(cpf.role_type, ''::text)) = ANY (ARRAY['FIELD'::text, 'TRAVEL'::text])))
        ), parent_asg AS (
         SELECT a.assignment_id AS parent_assignment_id,
            a.person_id AS parent_person_id
           FROM core.assignments a
          WHERE (a.person_id IS NOT NULL)
        ), enriched AS (
         SELECT b.assignment_id,
            b.pc_org_id,
            b.person_id,
            b.full_name,
            b.tech_id,
            b.position_title,
            b.start_date,
            b.end_date,
            b.assignment_active,
            b.reports_to_assignment_id,
            pa.parent_person_id AS reports_to_person_id,
            pp.full_name AS reports_to_full_name,
            wao.affiliation_label AS co_name
           FROM (((base b
             LEFT JOIN parent_asg pa ON ((pa.parent_assignment_id = b.reports_to_assignment_id)))
             LEFT JOIN core.people pp ON ((pp.person_id = pa.parent_person_id)))
             LEFT JOIN LATERAL ( SELECT x.affiliation_label
                   FROM public.workforce_affiliation_options() x(affiliation_id, affiliation_type, affiliation_code, affiliation_label)
                  WHERE (x.affiliation_id = b.affiliation_id)
                 LIMIT 1) wao ON (true))
        ), dedup AS (
         SELECT DISTINCT ON (enriched.pc_org_id, enriched.person_id) enriched.assignment_id,
            enriched.pc_org_id,
            enriched.person_id,
            enriched.full_name,
            enriched.tech_id,
            enriched.position_title,
            enriched.start_date,
            enriched.end_date,
            enriched.assignment_active,
            enriched.reports_to_assignment_id,
            enriched.reports_to_person_id,
            enriched.reports_to_full_name,
            enriched.co_name
           FROM enriched
          ORDER BY enriched.pc_org_id, enriched.person_id, enriched.assignment_active DESC, enriched.start_date DESC NULLS LAST, enriched.assignment_id DESC
        )
 SELECT assignment_id,
    pc_org_id,
    person_id,
    full_name,
    tech_id,
    position_title,
    start_date,
    end_date,
    assignment_active,
    reports_to_assignment_id,
    reports_to_person_id,
    reports_to_full_name,
    co_name
   FROM dedup;


--
-- Name: schedule_baseline_month; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schedule_baseline_month (
    schedule_baseline_month_id uuid DEFAULT gen_random_uuid() NOT NULL,
    pc_org_id uuid NOT NULL,
    fiscal_month_id uuid NOT NULL,
    tech_id text NOT NULL,
    assignment_id uuid,
    default_route_id uuid,
    sun boolean DEFAULT false NOT NULL,
    mon boolean DEFAULT false NOT NULL,
    tue boolean DEFAULT false NOT NULL,
    wed boolean DEFAULT false NOT NULL,
    thu boolean DEFAULT false NOT NULL,
    fri boolean DEFAULT false NOT NULL,
    sat boolean DEFAULT false NOT NULL,
    sch_hours_sun numeric DEFAULT 0 NOT NULL,
    sch_hours_mon numeric DEFAULT 0 NOT NULL,
    sch_hours_tue numeric DEFAULT 0 NOT NULL,
    sch_hours_wed numeric DEFAULT 0 NOT NULL,
    sch_hours_thu numeric DEFAULT 0 NOT NULL,
    sch_hours_fri numeric DEFAULT 0 NOT NULL,
    sch_hours_sat numeric DEFAULT 0 NOT NULL,
    sch_units_sun numeric DEFAULT 0 NOT NULL,
    sch_units_mon numeric DEFAULT 0 NOT NULL,
    sch_units_tue numeric DEFAULT 0 NOT NULL,
    sch_units_wed numeric DEFAULT 0 NOT NULL,
    sch_units_thu numeric DEFAULT 0 NOT NULL,
    sch_units_fri numeric DEFAULT 0 NOT NULL,
    sch_units_sat numeric DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    seeded_from_fiscal_month_id uuid,
    seeded_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid
);


--
-- Name: activity_logs; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.activity_logs (
    activity_log_id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid,
    actor_app_user_id uuid,
    entity_type text NOT NULL,
    entity_id uuid,
    action text NOT NULL,
    old_values jsonb,
    new_values jsonb,
    context jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: app_users; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.app_users (
    app_user_id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_user_id uuid NOT NULL,
    person_id uuid,
    display_name text,
    primary_email text,
    primary_phone text,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by_app_user_id uuid,
    updated_by_app_user_id uuid,
    CONSTRAINT core_app_users_status_ck CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'invited'::text, 'archived'::text])))
);


--
-- Name: assignment_events; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.assignment_events (
    assignment_event_id uuid DEFAULT gen_random_uuid() NOT NULL,
    assignment_id uuid NOT NULL,
    event_type text NOT NULL,
    changed_by_app_user_id uuid,
    old_values jsonb,
    new_values jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: company_profile_fact; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.company_profile_fact (
    profile_fact_id uuid DEFAULT gen_random_uuid() NOT NULL,
    person_id uuid NOT NULL,
    pc_org_id uuid NOT NULL,
    position_title text,
    tech_id text,
    reports_to_person_id uuid,
    effective_start_date date NOT NULL,
    effective_end_date date,
    active_flag boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: home_workspace_preference; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.home_workspace_preference (
    workspace_id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_user_id uuid NOT NULL,
    role text NOT NULL,
    pc_org_id text,
    workspace_name text NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    runtime_config jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: membership_roles; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.membership_roles (
    membership_role_id uuid DEFAULT gen_random_uuid() NOT NULL,
    membership_id uuid NOT NULL,
    role_id uuid NOT NULL,
    effective_start date DEFAULT CURRENT_DATE NOT NULL,
    effective_end date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by_app_user_id uuid,
    updated_by_app_user_id uuid,
    CONSTRAINT core_membership_roles_date_ck CHECK (((effective_end IS NULL) OR (effective_end >= effective_start)))
);


--
-- Name: memberships; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.memberships (
    membership_id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    app_user_id uuid NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by_app_user_id uuid,
    updated_by_app_user_id uuid,
    CONSTRAINT core_memberships_status_ck CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'invited'::text, 'archived'::text])))
);


--
-- Name: metric_batch_events; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.metric_batch_events (
    metric_batch_event_id uuid DEFAULT gen_random_uuid() NOT NULL,
    metric_batch_id uuid,
    actor_app_user_id uuid,
    event_type text NOT NULL,
    details jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    legacy_batch_id uuid
);


--
-- Name: metric_batches; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.metric_batches (
    metric_batch_id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    source_filename text,
    source_title text,
    source_generated_at timestamp with time zone,
    metric_date date NOT NULL,
    fiscal_end_date date NOT NULL,
    status text DEFAULT 'loaded'::text NOT NULL,
    row_count integer DEFAULT 0 NOT NULL,
    warning_flags jsonb,
    created_by_app_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by_app_user_id uuid,
    legacy_batch_id uuid,
    CONSTRAINT core_metric_batches_status_ck CHECK ((status = ANY (ARRAY['staged'::text, 'loaded'::text, 'nsr_pending'::text, 'nsr_running'::text, 'smart_pending'::text, 'smart_running'::text, 'complete'::text, 'failed'::text, 'archived'::text])))
);


--
-- Name: metric_definitions; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.metric_definitions (
    metric_key text NOT NULL,
    metric_label text NOT NULL,
    customer_label text,
    raw_label_identifier text,
    raw_inputs jsonb,
    direction text NOT NULL,
    unit text NOT NULL,
    min_value numeric,
    max_value numeric,
    rubric_json jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT metric_definitions_direction_check CHECK ((direction = ANY (ARRAY['HIGHER_BETTER'::text, 'LOWER_BETTER'::text])))
);


--
-- Name: metric_facts; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.metric_facts (
    metric_fact_id uuid DEFAULT gen_random_uuid() NOT NULL,
    metric_batch_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    person_id uuid,
    assignment_id uuid,
    tech_id text NOT NULL,
    metric_key text NOT NULL,
    metric_value numeric,
    numerator numeric,
    denominator numeric,
    metric_date date NOT NULL,
    fiscal_end_date date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: metric_rows; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.metric_rows (
    metric_row_id uuid DEFAULT gen_random_uuid() NOT NULL,
    metric_batch_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    reported_tech_id text NOT NULL,
    metric_date date NOT NULL,
    fiscal_end_date date NOT NULL,
    raw_payload jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    legacy_metric_row_id uuid,
    legacy_unique_row_key text
);


--
-- Name: metric_payload_flat_v; Type: VIEW; Schema: core; Owner: -
--

CREATE VIEW core.metric_payload_flat_v AS
 SELECT metric_row_id,
    metric_batch_id,
    workspace_id,
    reported_tech_id AS tech_id,
    metric_date,
    fiscal_end_date,
    core.safe_metric_numeric((raw_payload ->> 'Promoters'::text)) AS promoters,
    core.safe_metric_numeric((raw_payload ->> 'Detractors'::text)) AS detractors,
    core.safe_metric_numeric((raw_payload ->> 'tNPS Surveys'::text)) AS tnps_surveys,
    core.safe_metric_numeric((raw_payload ->> 'Total FTR/Contact Jobs'::text)) AS total_ftr_contact_jobs,
    core.safe_metric_numeric((raw_payload ->> 'FTRFailJobs'::text)) AS ftr_fail_jobs,
    core.safe_metric_numeric((raw_payload ->> 'TUEligibleJobs'::text)) AS tu_eligible_jobs,
    core.safe_metric_numeric((raw_payload ->> 'TUResult'::text)) AS tu_result,
    core.safe_metric_numeric((raw_payload ->> '48Hr Contact Orders'::text)) AS contact_48hr_orders,
    core.safe_metric_numeric((raw_payload ->> 'PHT Jobs'::text)) AS pht_jobs,
    core.safe_metric_numeric((raw_payload ->> 'PHT Pure Pass'::text)) AS pht_pure_pass,
    core.safe_metric_numeric((raw_payload ->> 'TotalAppts'::text)) AS total_appts,
    core.safe_metric_numeric((raw_payload ->> 'TotalMetAppts'::text)) AS total_met_appts,
    core.safe_metric_numeric((raw_payload ->> 'Repeat Count'::text)) AS repeat_count,
    core.safe_metric_numeric((raw_payload ->> 'Rework Count'::text)) AS rework_count,
    core.safe_metric_numeric((raw_payload ->> 'SOI Count'::text)) AS soi_count,
    core.safe_metric_numeric((raw_payload ->> 'Installs'::text)) AS installs,
    core.safe_metric_numeric((raw_payload ->> 'TCs'::text)) AS tcs,
    core.safe_metric_numeric((raw_payload ->> 'SROs'::text)) AS sros,
    core.safe_metric_numeric((raw_payload ->> 'Total Jobs'::text)) AS total_jobs,
    core.safe_metric_numeric((raw_payload ->> 'tNPS Rate'::text)) AS tnps_score,
    core.safe_metric_numeric((raw_payload ->> 'FTR%'::text)) AS ftr_rate,
    core.safe_metric_numeric((raw_payload ->> 'ToolUsage'::text)) AS tool_usage_rate,
    core.safe_metric_numeric((raw_payload ->> '48Hr Contact Rate%'::text)) AS contact_48hr_rate,
    core.safe_metric_numeric((raw_payload ->> 'PHT Pure Pass%'::text)) AS pht_pure_pass_rate,
    core.safe_metric_numeric((raw_payload ->> 'MetRate'::text)) AS met_rate,
    core.safe_metric_numeric((raw_payload ->> 'Repeat Rate%'::text)) AS repeat_rate,
    core.safe_metric_numeric((raw_payload ->> 'Rework Rate%'::text)) AS rework_rate,
    core.safe_metric_numeric((raw_payload ->> 'SOI Rate%'::text)) AS soi_rate
   FROM core.metric_rows mr;


--
-- Name: metric_scores_fact; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.metric_scores_fact (
    metric_batch_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    metric_date date NOT NULL,
    fiscal_end_date date NOT NULL,
    tech_id text NOT NULL,
    profile_key text NOT NULL,
    profile_label text NOT NULL,
    metric_profile_id uuid NOT NULL,
    metric_profile_rule_id uuid NOT NULL,
    metric_key text NOT NULL,
    display_label text,
    weight numeric,
    sort_order integer,
    report_order integer,
    is_tiebreaker boolean,
    is_visible boolean,
    no_data_behavior text,
    direction text,
    unit text,
    numerator numeric,
    denominator numeric,
    metric_value numeric,
    band_key text,
    normalized_value numeric,
    weighted_points numeric,
    is_rank_eligible boolean,
    eligibility_reason text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: metric_scores_v; Type: VIEW; Schema: core; Owner: -
--

CREATE VIEW core.metric_scores_v AS
 SELECT metric_batch_id,
    workspace_id,
    metric_date,
    fiscal_end_date,
    tech_id,
    profile_key,
    profile_label,
    metric_profile_id,
    metric_profile_rule_id,
    metric_key,
    display_label,
    weight,
    sort_order,
    report_order,
    is_tiebreaker,
    is_visible,
    no_data_behavior,
    direction,
    unit,
    numerator,
    denominator,
    metric_value,
    band_key,
    normalized_value,
    weighted_points,
    is_rank_eligible,
    eligibility_reason,
    created_at
   FROM core.metric_scores_fact;


--
-- Name: metric_profile_composites_v; Type: VIEW; Schema: core; Owner: -
--

CREATE VIEW core.metric_profile_composites_v AS
 SELECT metric_batch_id,
    workspace_id,
    metric_date,
    fiscal_end_date,
    tech_id,
    profile_key,
    profile_label,
    sum(weighted_points) AS composite_score,
    count(*) FILTER (WHERE (COALESCE(denominator, (0)::numeric) > (0)::numeric)) AS contributing_kpi_count,
    max(
        CASE
            WHEN is_tiebreaker THEN metric_value
            ELSE NULL::numeric
        END) AS tiebreak_value,
    bool_and(is_rank_eligible) AS is_rank_eligible,
    max(eligibility_reason) AS eligibility_reason
   FROM core.metric_scores_v s
  GROUP BY metric_batch_id, workspace_id, metric_date, fiscal_end_date, tech_id, profile_key, profile_label;


--
-- Name: metric_profile_rules; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.metric_profile_rules (
    metric_profile_rule_id uuid DEFAULT gen_random_uuid() NOT NULL,
    metric_profile_id uuid NOT NULL,
    metric_key text NOT NULL,
    weight numeric DEFAULT 0 NOT NULL,
    sort_order integer,
    is_visible boolean DEFAULT true NOT NULL,
    direction text,
    rubric_json jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by_app_user_id uuid,
    updated_by_app_user_id uuid,
    report_order integer,
    is_tiebreaker boolean DEFAULT false NOT NULL,
    display_label text,
    is_enabled boolean DEFAULT true NOT NULL,
    no_data_behavior text,
    CONSTRAINT core_metric_profile_rules_direction_ck CHECK (((direction IS NULL) OR (direction = ANY (ARRAY['HIGHER_BETTER'::text, 'LOWER_BETTER'::text]))))
);


--
-- Name: metric_profiles; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.metric_profiles (
    metric_profile_id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_key text NOT NULL,
    profile_label text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: metric_profile_kpis_v; Type: VIEW; Schema: core; Owner: -
--

CREATE VIEW core.metric_profile_kpis_v AS
 SELECT p.profile_key,
    p.profile_label,
    r.metric_profile_rule_id,
    r.metric_profile_id,
    r.metric_key,
    d.metric_label,
    d.customer_label,
    COALESCE(r.display_label, d.customer_label, d.metric_label) AS display_label,
    d.raw_label_identifier,
    d.raw_inputs,
    COALESCE(r.direction, d.direction) AS direction,
    d.unit,
    d.min_value,
    d.max_value,
    d.rubric_json,
    r.weight,
    r.sort_order,
    r.report_order,
    r.is_visible,
    r.is_enabled,
    r.is_tiebreaker,
    r.no_data_behavior,
    d.is_active AS metric_is_active,
    p.is_active AS profile_is_active
   FROM ((core.metric_profile_rules r
     JOIN core.metric_profiles p ON ((p.metric_profile_id = r.metric_profile_id)))
     JOIN core.metric_definitions d ON ((d.metric_key = r.metric_key)));


--
-- Name: metric_profile_ranks_v; Type: VIEW; Schema: core; Owner: -
--

CREATE VIEW core.metric_profile_ranks_v AS
 SELECT metric_batch_id,
    workspace_id,
    metric_date,
    fiscal_end_date,
    tech_id,
    profile_key,
    profile_label,
    composite_score,
    contributing_kpi_count,
    tiebreak_value,
    is_rank_eligible,
    eligibility_reason,
    rank() OVER (PARTITION BY metric_batch_id, profile_key ORDER BY composite_score DESC, tiebreak_value, tech_id) AS rank_in_profile
   FROM core.metric_profile_composites_v c
  WHERE (is_rank_eligible = true);


--
-- Name: metric_rank_eligibility_v; Type: VIEW; Schema: core; Owner: -
--

CREATE VIEW core.metric_rank_eligibility_v AS
 WITH base AS (
         SELECT mb.metric_batch_id,
            mb.legacy_batch_id,
            mb.workspace_id,
            mb.metric_date,
            mb.fiscal_end_date,
            mr.metric_row_id,
            mr.reported_tech_id AS tech_id,
                CASE
                    WHEN ((mr.reported_tech_id ~~* '%total%'::text) OR (mr.reported_tech_id ~~* '%totals%'::text)) THEN 'TOTAL'::text
                    ELSE 'TECH'::text
                END AS row_kind,
            COALESCE(((mr.raw_payload ->> 'Total FTR/Contact Jobs'::text))::numeric, (0)::numeric) AS total_ftr_contact_jobs,
            COALESCE(((mr.raw_payload ->> 'Total Jobs'::text))::numeric, (0)::numeric) AS total_jobs,
            COALESCE(((mr.raw_payload ->> 'Installs'::text))::numeric, (0)::numeric) AS installs,
            COALESCE(((mr.raw_payload ->> 'TCs'::text))::numeric, (0)::numeric) AS tcs
           FROM (core.metric_rows mr
             JOIN core.metric_batches mb ON ((mb.metric_batch_id = mr.metric_batch_id)))
        ), assignment_scope AS (
         SELECT b_1.metric_batch_id,
            b_1.metric_row_id,
            b_1.workspace_id,
            b_1.metric_date,
            b_1.tech_id,
            a.assignment_id,
            a.assignment_status,
            a.start_date,
            a.end_date,
                CASE
                    WHEN ((a.start_date <= b_1.metric_date) AND ((a.end_date IS NULL) OR (a.end_date >= b_1.metric_date))) THEN true
                    ELSE false
                END AS is_open_on_metric_date,
                CASE
                    WHEN ((a.end_date IS NOT NULL) AND (a.end_date < b_1.metric_date) AND (a.end_date >= ((b_1.metric_date - '30 days'::interval))::date)) THEN true
                    ELSE false
                END AS ended_within_30_days
           FROM (base b_1
             LEFT JOIN core.assignments a ON (((a.workspace_id = b_1.workspace_id) AND (a.tech_id = b_1.tech_id))))
          WHERE (b_1.row_kind = 'TECH'::text)
        ), assignment_rollup AS (
         SELECT assignment_scope.metric_batch_id,
            assignment_scope.metric_row_id,
            bool_or(COALESCE(assignment_scope.is_open_on_metric_date, false)) AS has_open_assignment,
            bool_or(COALESCE(assignment_scope.ended_within_30_days, false)) AS has_recently_closed_assignment
           FROM assignment_scope
          GROUP BY assignment_scope.metric_batch_id, assignment_scope.metric_row_id
        )
 SELECT b.metric_batch_id,
    b.legacy_batch_id,
    b.workspace_id,
    b.metric_date,
    b.fiscal_end_date,
    b.metric_row_id,
    b.tech_id,
    b.row_kind,
    (b.row_kind = 'TOTAL'::text) AS is_totals_row,
    b.total_ftr_contact_jobs,
    b.total_jobs,
    b.installs,
    b.tcs,
        CASE
            WHEN (b.row_kind = 'TOTAL'::text) THEN false
            ELSE COALESCE(ar.has_open_assignment, false)
        END AS has_open_assignment,
        CASE
            WHEN (b.row_kind = 'TOTAL'::text) THEN false
            ELSE COALESCE(ar.has_recently_closed_assignment, false)
        END AS has_recently_closed_assignment,
        CASE
            WHEN (b.row_kind = 'TOTAL'::text) THEN false
            WHEN (b.total_ftr_contact_jobs > (0)::numeric) THEN true
            WHEN ((b.total_ftr_contact_jobs = (0)::numeric) AND (COALESCE(ar.has_open_assignment, false) = false) AND (COALESCE(ar.has_recently_closed_assignment, false) = true)) THEN true
            ELSE false
        END AS is_rank_eligible,
        CASE
            WHEN (b.row_kind = 'TOTAL'::text) THEN 'TOTAL_ROW'::text
            WHEN (b.total_ftr_contact_jobs > (0)::numeric) THEN 'ACTIVE'::text
            WHEN ((b.total_ftr_contact_jobs = (0)::numeric) AND (COALESCE(ar.has_open_assignment, false) = false) AND (COALESCE(ar.has_recently_closed_assignment, false) = true)) THEN 'RECENTLY_ACTIVE'::text
            WHEN ((b.total_ftr_contact_jobs = (0)::numeric) AND ((b.total_jobs > (0)::numeric) OR (b.installs > (0)::numeric) OR (b.tcs > (0)::numeric))) THEN 'OUT_OF_SCOPE_LOB'::text
            ELSE 'NO_ACTIVITY'::text
        END AS eligibility_reason
   FROM (base b
     LEFT JOIN assignment_rollup ar ON (((ar.metric_batch_id = b.metric_batch_id) AND (ar.metric_row_id = b.metric_row_id))));


--
-- Name: person_contacts; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.person_contacts (
    person_contact_id uuid DEFAULT gen_random_uuid() NOT NULL,
    person_id uuid NOT NULL,
    contact_type text NOT NULL,
    contact_value text NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by_app_user_id uuid,
    updated_by_app_user_id uuid,
    CONSTRAINT core_person_contacts_type_ck CHECK ((contact_type = ANY (ARRAY['email'::text, 'phone'::text, 'other'::text])))
);


--
-- Name: assignment_admin_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.assignment_admin_v AS
 SELECT company_profile_id AS assignment_id,
    person_id,
    pc_org_id,
    tech_id,
    effective_start_date AS start_date,
    effective_end_date AS end_date,
    position_title,
    active_flag AS active,
    office_id,
    affiliation_id AS co_ref_id
   FROM public.company_profile_fact cpf;


--
-- Name: assignment_leadership_admin_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.assignment_leadership_admin_v AS
 SELECT assignment_reporting_id,
    child_assignment_id,
    parent_assignment_id,
    start_date,
    end_date,
    ((end_date IS NULL) OR (end_date >= CURRENT_DATE)) AS active,
    created_at,
    updated_at
   FROM public.assignment_reporting ar;


--
-- Name: office; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.office (
    office_id uuid DEFAULT gen_random_uuid() NOT NULL,
    office_name text NOT NULL,
    address text,
    sub_region text,
    active boolean DEFAULT true NOT NULL
);


--
-- Name: v_roster_active; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_roster_active AS
 SELECT person_pc_org_id,
    person_id,
    pc_org_id,
    status,
    start_date,
    end_date,
    active,
    created_at,
    updated_at
   FROM public.person_pc_org ppo
  WHERE ((active = true) AND (status = 'active'::text) AND ((start_date IS NULL) OR (start_date <= CURRENT_DATE)) AND ((end_date IS NULL) OR (end_date >= CURRENT_DATE)));


--
-- Name: v_roster_current; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_roster_current AS
 SELECT pc_org_id,
    person_id
   FROM public.v_roster_active;


--
-- Name: workforce_current_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.workforce_current_v AS
 WITH contact_pivot AS (
         SELECT pc_1.person_id,
            max(pc_1.contact_value) FILTER (WHERE (pc_1.contact_type = 'phone'::text)) AS mobile,
            max(pc_1.contact_value) FILTER (WHERE (pc_1.contact_type = 'email'::text)) AS email,
            max(replace(pc_1.contact_value, 'NT_LOGIN:'::text, ''::text)) FILTER (WHERE ((pc_1.contact_type = 'other'::text) AND (pc_1.contact_value ~~ 'NT_LOGIN:%'::text))) AS nt_login,
            max(replace(pc_1.contact_value, 'CSG:'::text, ''::text)) FILTER (WHERE ((pc_1.contact_type = 'other'::text) AND (pc_1.contact_value ~~ 'CSG:%'::text))) AS csg
           FROM core.person_contacts pc_1
          GROUP BY pc_1.person_id
        ), profile_current AS (
         SELECT DISTINCT ON (cpf.person_id, cpf.pc_org_id) cpf.person_id,
            cpf.pc_org_id,
            cpf.affiliation_id,
            cpf.role_type
           FROM public.company_profile_fact cpf
          WHERE ((cpf.active_flag = true) AND (cpf.effective_start_date <= CURRENT_DATE) AND ((cpf.effective_end_date IS NULL) OR (cpf.effective_end_date >= CURRENT_DATE)))
          ORDER BY cpf.person_id, cpf.pc_org_id, cpf.effective_start_date DESC, cpf.created_at DESC
        )
 SELECT a.assignment_id,
    a.person_id,
    a.workspace_id,
    w.legacy_pc_org_id AS pc_org_id,
    a.tech_id,
    p.full_name,
    p.legal_name,
    p.preferred_name,
    p.status AS person_status,
    cp.mobile,
    cp.email,
    cp.nt_login,
    cp.csg,
    pc.affiliation_id,
    COALESCE(co.company_code, ct.contractor_code, legacy_p.co_code) AS affiliation_code,
        CASE
            WHEN (co.company_name IS NOT NULL) THEN co.company_name
            WHEN (ct.contractor_name IS NOT NULL) THEN ct.contractor_name
            ELSE legacy_p.co_code
        END AS affiliation,
    a.position_title,
    pc.role_type,
    a.office_id,
    o.office_name,
    a.reports_to_assignment_id,
    mgr.assignment_id AS reports_to_resolved_assignment_id,
    mgr.person_id AS reports_to_person_id,
    mgr_p.full_name AS reports_to_full_name,
    a.assignment_status,
    a.start_date,
    a.end_date,
    a.is_primary,
        CASE
            WHEN ((a.assignment_status = 'active'::text) AND (a.start_date <= CURRENT_DATE) AND ((a.end_date IS NULL) OR (a.end_date >= CURRENT_DATE))) THEN true
            ELSE false
        END AS is_active,
        CASE
            WHEN (NOT ((a.assignment_status = 'active'::text) AND (a.start_date <= CURRENT_DATE) AND ((a.end_date IS NULL) OR (a.end_date >= CURRENT_DATE)))) THEN false
            WHEN ((a.office_id IS NULL) OR (NULLIF(TRIM(BOTH FROM COALESCE(a.position_title, ''::text)), ''::text) IS NULL) OR (NULLIF(TRIM(BOTH FROM COALESCE(a.tech_id, ''::text)), ''::text) IS NULL) OR ((lower(COALESCE(a.position_title, ''::text)) <> ALL (ARRAY['director'::text, 'regional manager'::text, 'bp owner'::text, 'bp lead'::text])) AND (a.reports_to_assignment_id IS NULL))) THEN true
            ELSE false
        END AS is_incomplete,
    a.created_at,
    a.updated_at,
    a.created_by_app_user_id,
    a.updated_by_app_user_id
   FROM ((((((((((core.assignments a
     JOIN core.people p ON ((p.person_id = a.person_id)))
     JOIN core.workspaces w ON ((w.workspace_id = a.workspace_id)))
     LEFT JOIN profile_current pc ON (((pc.person_id = a.person_id) AND (pc.pc_org_id = w.legacy_pc_org_id))))
     LEFT JOIN public.company co ON ((co.company_id = pc.affiliation_id)))
     LEFT JOIN public.contractor ct ON ((ct.contractor_id = pc.affiliation_id)))
     LEFT JOIN public.person legacy_p ON ((legacy_p.person_id = a.person_id)))
     LEFT JOIN contact_pivot cp ON ((cp.person_id = a.person_id)))
     LEFT JOIN public.office o ON ((o.office_id = a.office_id)))
     LEFT JOIN core.assignments mgr ON ((mgr.assignment_id = a.reports_to_assignment_id)))
     LEFT JOIN core.people mgr_p ON ((mgr_p.person_id = mgr.person_id)));


--
-- Name: metric_subjects_v; Type: VIEW; Schema: core; Owner: -
--

CREATE VIEW core.metric_subjects_v AS
 WITH batch_scope AS (
         SELECT mb.metric_batch_id,
            mb.legacy_batch_id,
            mb.workspace_id,
            mb.metric_date,
            mb.fiscal_end_date,
            w.legacy_pc_org_id AS pc_org_id
           FROM (core.metric_batches mb
             JOIN core.workspaces w ON ((w.workspace_id = mb.workspace_id)))
          WHERE (w.legacy_pc_org_id IS NOT NULL)
        ), roster_base AS (
         SELECT bs.metric_batch_id,
            bs.legacy_batch_id,
            bs.workspace_id,
            bs.metric_date,
            bs.fiscal_end_date,
            bs.pc_org_id,
            vr.person_id,
            p.full_name,
            p.active AS person_active,
            p.role AS person_role,
            p.co_ref_id,
            p.co_code,
                CASE
                    WHEN (p.role = 'Hires'::text) THEN 'COMPANY'::text
                    WHEN (p.role = 'Contractors'::text) THEN 'CONTRACTOR'::text
                    WHEN (p.role = ANY (ARRAY['Director'::text, 'Leadership'::text])) THEN 'LEADERSHIP'::text
                    ELSE 'UNKNOWN'::text
                END AS affiliation_type
           FROM ((batch_scope bs
             JOIN public.v_roster_current vr ON ((vr.pc_org_id = bs.pc_org_id)))
             LEFT JOIN public.person p ON ((p.person_id = vr.person_id)))
        ), roster_assignment_rollup AS (
         SELECT rb.metric_batch_id,
            rb.person_id,
            count(DISTINCT aa.assignment_id) AS assignment_match_count,
            (array_agg(DISTINCT aa.assignment_id))[1] AS single_assignment_id,
            count(DISTINCT aa.tech_id) AS tech_match_count,
            min(aa.tech_id) AS single_tech_id,
            min(aa.position_title) AS single_position_title,
            min(o.office_name) AS single_office_label
           FROM ((roster_base rb
             LEFT JOIN public.assignment_admin_v aa ON (((aa.pc_org_id = rb.pc_org_id) AND (aa.person_id = rb.person_id) AND (aa.start_date <= rb.metric_date) AND ((aa.end_date IS NULL) OR (aa.end_date >= rb.metric_date) OR (aa.end_date >= ((rb.metric_date - '30 days'::interval))::date)))))
             LEFT JOIN public.office o ON ((o.office_id = aa.office_id)))
          GROUP BY rb.metric_batch_id, rb.person_id
        ), roster_enriched AS (
         SELECT rb.metric_batch_id,
            rb.legacy_batch_id,
            rb.workspace_id,
            rb.metric_date,
            rb.fiscal_end_date,
            rb.pc_org_id,
            rb.person_id,
            rb.full_name,
            rb.person_active,
            rb.person_role,
            rb.co_ref_id,
            rb.co_code,
            rb.affiliation_type,
                CASE
                    WHEN (rar.assignment_match_count = 1) THEN rar.single_assignment_id
                    ELSE NULL::uuid
                END AS assignment_id,
                CASE
                    WHEN (rar.tech_match_count = 1) THEN rar.single_tech_id
                    ELSE NULL::text
                END AS tech_id,
                CASE
                    WHEN (rar.assignment_match_count = 1) THEN rar.single_position_title
                    ELSE NULL::text
                END AS position_title,
                CASE
                    WHEN (rar.assignment_match_count = 1) THEN rar.single_office_label
                    ELSE NULL::text
                END AS office_label,
            rar.assignment_match_count,
            rar.tech_match_count
           FROM (roster_base rb
             LEFT JOIN roster_assignment_rollup rar ON (((rar.metric_batch_id = rb.metric_batch_id) AND (rar.person_id = rb.person_id))))
        ), roster_leadership AS (
         SELECT re.metric_batch_id,
            re.person_id,
            (array_agg(DISTINCT parent_a.person_id))[1] AS reports_to_person_id
           FROM ((roster_enriched re
             LEFT JOIN public.assignment_leadership_admin_v al ON (((al.child_assignment_id = re.assignment_id) AND (al.start_date <= re.metric_date) AND ((al.end_date IS NULL) OR (al.end_date >= re.metric_date)))))
             LEFT JOIN public.assignment_admin_v parent_a ON ((parent_a.assignment_id = al.parent_assignment_id)))
          GROUP BY re.metric_batch_id, re.person_id
        ), payload_base AS (
         SELECT e.metric_batch_id,
            e.legacy_batch_id,
            e.workspace_id,
            e.metric_date,
            e.fiscal_end_date,
            bs.pc_org_id,
            e.metric_row_id,
            e.tech_id,
            e.row_kind,
            e.is_totals_row,
            e.is_rank_eligible,
            e.eligibility_reason
           FROM (core.metric_rank_eligibility_v e
             JOIN batch_scope bs ON ((bs.metric_batch_id = e.metric_batch_id)))
        ), payload_assignment_rollup AS (
         SELECT pb.metric_batch_id,
            pb.metric_row_id,
            count(DISTINCT aa.assignment_id) AS assignment_match_count,
            (array_agg(DISTINCT aa.assignment_id))[1] AS single_assignment_id,
            count(DISTINCT aa.person_id) AS person_match_count,
            (array_agg(DISTINCT aa.person_id))[1] AS single_person_id,
            min(aa.position_title) AS single_position_title,
            min(o.office_name) AS single_office_label
           FROM ((payload_base pb
             LEFT JOIN public.assignment_admin_v aa ON (((aa.pc_org_id = pb.pc_org_id) AND (aa.tech_id = pb.tech_id) AND (aa.start_date <= pb.metric_date) AND ((aa.end_date IS NULL) OR (aa.end_date >= pb.metric_date) OR (aa.end_date >= ((pb.metric_date - '30 days'::interval))::date)))))
             LEFT JOIN public.office o ON ((o.office_id = aa.office_id)))
          GROUP BY pb.metric_batch_id, pb.metric_row_id
        ), payload_enriched AS (
         SELECT pb.metric_batch_id,
            pb.legacy_batch_id,
            pb.workspace_id,
            pb.metric_date,
            pb.fiscal_end_date,
            pb.pc_org_id,
            pb.metric_row_id,
            pb.tech_id,
            pb.row_kind,
            pb.is_totals_row,
            pb.is_rank_eligible,
            pb.eligibility_reason,
                CASE
                    WHEN (par.assignment_match_count = 1) THEN par.single_assignment_id
                    ELSE NULL::uuid
                END AS assignment_id,
                CASE
                    WHEN (par.person_match_count = 1) THEN par.single_person_id
                    ELSE NULL::uuid
                END AS person_id,
                CASE
                    WHEN (par.assignment_match_count = 1) THEN par.single_position_title
                    ELSE NULL::text
                END AS position_title,
                CASE
                    WHEN (par.assignment_match_count = 1) THEN par.single_office_label
                    ELSE NULL::text
                END AS office_label,
            par.assignment_match_count,
            par.person_match_count
           FROM (payload_base pb
             LEFT JOIN payload_assignment_rollup par ON (((par.metric_batch_id = pb.metric_batch_id) AND (par.metric_row_id = pb.metric_row_id))))
        ), payload_person AS (
         SELECT pe.metric_batch_id,
            pe.metric_row_id,
            pe.tech_id,
            pe.row_kind,
            pe.is_totals_row,
            pe.is_rank_eligible,
            pe.eligibility_reason,
            COALESCE(pe.assignment_id, wf.assignment_id) AS assignment_id,
            COALESCE(pe.person_id, wf.person_id) AS person_id,
            COALESCE(pe.position_title, wf.position_title) AS position_title,
            COALESCE(pe.office_label, wf.office_name) AS office_label,
            pe.assignment_match_count,
            pe.person_match_count,
            COALESCE(p.full_name, wf.full_name) AS full_name,
            COALESCE(p.active, wf.is_active) AS person_active,
            p.role AS person_role,
            COALESCE(p.co_ref_id, wf.affiliation_id) AS co_ref_id,
            COALESCE(p.co_code, wf.affiliation_code) AS co_code,
                CASE
                    WHEN (p.role = 'Hires'::text) THEN 'COMPANY'::text
                    WHEN (p.role = 'Contractors'::text) THEN 'CONTRACTOR'::text
                    WHEN (p.role = ANY (ARRAY['Director'::text, 'Leadership'::text])) THEN 'LEADERSHIP'::text
                    WHEN (wf.role_type = 'LEADERSHIP'::text) THEN 'LEADERSHIP'::text
                    WHEN (wf.affiliation_code = 'ITG'::text) THEN 'COMPANY'::text
                    WHEN (wf.affiliation_id IS NOT NULL) THEN 'CONTRACTOR'::text
                    ELSE 'UNKNOWN'::text
                END AS affiliation_type
           FROM ((payload_enriched pe
             LEFT JOIN public.person p ON ((p.person_id = pe.person_id)))
             LEFT JOIN public.workforce_current_v wf ON (((wf.pc_org_id = pe.pc_org_id) AND (wf.tech_id = pe.tech_id) AND (wf.is_active = true) AND (wf.assignment_status = 'active'::text))))
        ), payload_leadership AS (
         SELECT pp.metric_batch_id,
            pp.metric_row_id,
            (array_agg(DISTINCT parent_a.person_id))[1] AS reports_to_person_id
           FROM ((payload_person pp
             LEFT JOIN public.assignment_leadership_admin_v al ON (((al.child_assignment_id = pp.assignment_id) AND (al.start_date <= ( SELECT DISTINCT bs.metric_date
                   FROM batch_scope bs
                  WHERE (bs.metric_batch_id = pp.metric_batch_id))) AND ((al.end_date IS NULL) OR (al.end_date >= ( SELECT DISTINCT bs.metric_date
                   FROM batch_scope bs
                  WHERE (bs.metric_batch_id = pp.metric_batch_id)))))))
             LEFT JOIN public.assignment_admin_v parent_a ON ((parent_a.assignment_id = al.parent_assignment_id)))
          GROUP BY pp.metric_batch_id, pp.metric_row_id
        ), payload_person_rollup AS (
         SELECT pp.metric_batch_id,
            pp.person_id,
            count(DISTINCT pp.tech_id) AS payload_tech_count,
            min(pp.tech_id) AS single_payload_tech_id,
            bool_or(pp.is_rank_eligible) AS is_rank_eligible,
            max(pp.eligibility_reason) AS eligibility_reason
           FROM payload_person pp
          WHERE ((pp.person_id IS NOT NULL) AND (pp.row_kind = 'TECH'::text))
          GROUP BY pp.metric_batch_id, pp.person_id
        ), matched_and_roster AS (
         SELECT re.metric_batch_id,
            re.legacy_batch_id,
            re.workspace_id,
            re.metric_date,
            re.fiscal_end_date,
            re.pc_org_id,
            re.person_id,
            re.full_name,
            re.person_active,
            re.person_role,
            re.co_ref_id,
            re.co_code,
            re.affiliation_type,
            re.assignment_id,
            COALESCE(re.tech_id, ppr.single_payload_tech_id) AS tech_id,
            rl.reports_to_person_id,
            'TECH'::text AS row_kind,
            false AS is_totals_row,
                CASE
                    WHEN (ppr.person_id IS NOT NULL) THEN 'BOTH'::text
                    ELSE 'ROSTER_ONLY'::text
                END AS row_presence,
                CASE
                    WHEN ((re.assignment_match_count > 1) OR (re.tech_match_count > 1)) THEN 'MULTI_TECH_MATCH'::text
                    WHEN ((ppr.person_id IS NOT NULL) AND (ppr.payload_tech_count > 1)) THEN 'MULTI_TECH_MATCH'::text
                    WHEN (ppr.person_id IS NOT NULL) THEN 'MATCHED'::text
                    ELSE 'NO_PAYLOAD'::text
                END AS match_status,
            COALESCE(ppr.is_rank_eligible, false) AS is_rank_eligible,
            COALESCE(ppr.eligibility_reason, 'NO_PAYLOAD'::text) AS eligibility_reason,
            re.position_title,
            re.office_label
           FROM ((roster_enriched re
             LEFT JOIN roster_leadership rl ON (((rl.metric_batch_id = re.metric_batch_id) AND (rl.person_id = re.person_id))))
             LEFT JOIN payload_person_rollup ppr ON (((ppr.metric_batch_id = re.metric_batch_id) AND (ppr.person_id = re.person_id))))
        ), payload_only AS (
         SELECT pp.metric_batch_id,
            ( SELECT bs.legacy_batch_id
                   FROM batch_scope bs
                  WHERE (bs.metric_batch_id = pp.metric_batch_id)
                 LIMIT 1) AS legacy_batch_id,
            ( SELECT bs.workspace_id
                   FROM batch_scope bs
                  WHERE (bs.metric_batch_id = pp.metric_batch_id)
                 LIMIT 1) AS workspace_id,
            ( SELECT bs.metric_date
                   FROM batch_scope bs
                  WHERE (bs.metric_batch_id = pp.metric_batch_id)
                 LIMIT 1) AS metric_date,
            ( SELECT bs.fiscal_end_date
                   FROM batch_scope bs
                  WHERE (bs.metric_batch_id = pp.metric_batch_id)
                 LIMIT 1) AS fiscal_end_date,
            ( SELECT bs.pc_org_id
                   FROM batch_scope bs
                  WHERE (bs.metric_batch_id = pp.metric_batch_id)
                 LIMIT 1) AS pc_org_id,
            pp.person_id,
            pp.full_name,
            pp.person_active,
            pp.person_role,
            pp.co_ref_id,
            pp.co_code,
            pp.affiliation_type,
            pp.assignment_id,
            pp.tech_id,
            pl.reports_to_person_id,
            pp.row_kind,
            pp.is_totals_row,
            'PAYLOAD_ONLY'::text AS row_presence,
                CASE
                    WHEN pp.is_totals_row THEN 'TOTAL_ROW'::text
                    WHEN ((pp.assignment_match_count > 1) OR (pp.person_match_count > 1)) THEN 'MULTI_ASSIGNMENT_MATCH'::text
                    WHEN (pp.person_id IS NULL) THEN 'NO_ROSTER'::text
                    WHEN (rc.person_id IS NULL) THEN 'NO_ROSTER'::text
                    ELSE 'MATCHED'::text
                END AS match_status,
            pp.is_rank_eligible,
            pp.eligibility_reason,
            pp.position_title,
            pp.office_label
           FROM ((payload_person pp
             LEFT JOIN payload_leadership pl ON (((pl.metric_batch_id = pp.metric_batch_id) AND (pl.metric_row_id = pp.metric_row_id))))
             LEFT JOIN public.v_roster_current rc ON (((rc.pc_org_id = ( SELECT bs.pc_org_id
                   FROM batch_scope bs
                  WHERE (bs.metric_batch_id = pp.metric_batch_id)
                 LIMIT 1)) AND (rc.person_id = pp.person_id))))
          WHERE ((pp.is_totals_row = true) OR (pp.person_id IS NULL) OR (rc.person_id IS NULL))
        )
 SELECT md5(((((((((COALESCE((matched_and_roster.metric_batch_id)::text, ''::text) || '|'::text) || COALESCE((matched_and_roster.person_id)::text, ''::text)) || '|'::text) || COALESCE(matched_and_roster.tech_id, ''::text)) || '|'::text) || COALESCE(matched_and_roster.row_presence, ''::text)) || '|'::text) || COALESCE(matched_and_roster.match_status, ''::text))) AS subject_key,
    matched_and_roster.metric_batch_id,
    matched_and_roster.legacy_batch_id,
    matched_and_roster.workspace_id,
    matched_and_roster.pc_org_id,
    matched_and_roster.metric_date,
    matched_and_roster.fiscal_end_date,
    matched_and_roster.person_id,
    matched_and_roster.full_name,
    matched_and_roster.person_active,
    matched_and_roster.person_role,
    matched_and_roster.co_ref_id,
    matched_and_roster.co_code,
    matched_and_roster.affiliation_type,
    matched_and_roster.assignment_id,
    matched_and_roster.tech_id,
    matched_and_roster.reports_to_person_id,
    matched_and_roster.row_kind,
    matched_and_roster.is_totals_row,
    matched_and_roster.row_presence,
    matched_and_roster.match_status,
    matched_and_roster.is_rank_eligible,
    matched_and_roster.eligibility_reason,
    matched_and_roster.position_title,
    matched_and_roster.office_label
   FROM matched_and_roster
UNION ALL
 SELECT md5(((((((((COALESCE((payload_only.metric_batch_id)::text, ''::text) || '|'::text) || COALESCE((payload_only.person_id)::text, ''::text)) || '|'::text) || COALESCE(payload_only.tech_id, ''::text)) || '|'::text) || COALESCE(payload_only.row_presence, ''::text)) || '|'::text) || COALESCE(payload_only.match_status, ''::text))) AS subject_key,
    payload_only.metric_batch_id,
    payload_only.legacy_batch_id,
    payload_only.workspace_id,
    payload_only.pc_org_id,
    payload_only.metric_date,
    payload_only.fiscal_end_date,
    payload_only.person_id,
    payload_only.full_name,
    payload_only.person_active,
    payload_only.person_role,
    payload_only.co_ref_id,
    payload_only.co_code,
    payload_only.affiliation_type,
    payload_only.assignment_id,
    payload_only.tech_id,
    payload_only.reports_to_person_id,
    payload_only.row_kind,
    payload_only.is_totals_row,
    payload_only.row_presence,
    payload_only.match_status,
    payload_only.is_rank_eligible,
    payload_only.eligibility_reason,
    payload_only.position_title,
    payload_only.office_label
   FROM payload_only;


--
-- Name: metric_subject_composites_v; Type: VIEW; Schema: core; Owner: -
--

CREATE VIEW core.metric_subject_composites_v AS
 WITH profiles AS (
         SELECT metric_profiles.profile_key,
            metric_profiles.profile_label
           FROM core.metric_profiles
          WHERE (metric_profiles.is_active = true)
        ), subject_profile_space AS (
         SELECT s.subject_key,
            s.metric_batch_id,
            s.legacy_batch_id,
            s.workspace_id,
            s.pc_org_id,
            s.metric_date,
            s.fiscal_end_date,
            s.person_id,
            s.full_name,
            s.person_active,
            s.person_role,
            s.co_ref_id,
            s.co_code,
            s.affiliation_type,
            s.assignment_id,
            s.tech_id,
            s.reports_to_person_id,
            s.row_kind,
            s.is_totals_row,
            s.row_presence,
            s.match_status,
            s.is_rank_eligible,
            s.eligibility_reason,
            s.position_title,
            s.office_label,
            p.profile_key,
            p.profile_label
           FROM (core.metric_subjects_v s
             CROSS JOIN profiles p)
          WHERE (s.row_kind <> 'TOTAL'::text)
        ), joined AS (
         SELECT sps.subject_key,
            sps.metric_batch_id,
            sps.legacy_batch_id,
            sps.workspace_id,
            sps.pc_org_id,
            sps.metric_date,
            sps.fiscal_end_date,
            sps.person_id,
            sps.full_name,
            sps.person_active,
            sps.person_role,
            sps.co_ref_id,
            sps.co_code,
            sps.affiliation_type,
            sps.assignment_id,
            sps.tech_id,
            sps.reports_to_person_id,
            sps.row_kind,
            sps.is_totals_row,
            sps.row_presence,
            sps.match_status,
            sps.is_rank_eligible AS subject_is_rank_eligible,
            sps.eligibility_reason AS subject_eligibility_reason,
            sps.position_title,
            sps.office_label,
            sps.profile_key,
            sps.profile_label,
            c.composite_score,
            c.contributing_kpi_count,
            c.tiebreak_value,
            c.is_rank_eligible AS composite_is_rank_eligible,
            c.eligibility_reason AS composite_eligibility_reason,
            r.rank_in_profile
           FROM ((subject_profile_space sps
             LEFT JOIN core.metric_profile_composites_v c ON (((c.metric_batch_id = sps.metric_batch_id) AND (c.profile_key = sps.profile_key) AND (c.tech_id = sps.tech_id))))
             LEFT JOIN core.metric_profile_ranks_v r ON (((r.metric_batch_id = sps.metric_batch_id) AND (r.profile_key = sps.profile_key) AND (r.tech_id = sps.tech_id))))
        )
 SELECT subject_key,
    metric_batch_id,
    legacy_batch_id,
    workspace_id,
    pc_org_id,
    metric_date,
    fiscal_end_date,
    person_id,
    full_name,
    person_active,
    person_role,
    co_ref_id,
    co_code,
    affiliation_type,
    assignment_id,
    tech_id,
    reports_to_person_id,
    position_title,
    row_kind,
    is_totals_row,
    row_presence,
    match_status,
    profile_key,
    profile_label,
    composite_score,
    contributing_kpi_count,
    tiebreak_value,
    rank_in_profile,
    COALESCE(composite_is_rank_eligible, subject_is_rank_eligible, false) AS is_rank_eligible,
    COALESCE(composite_eligibility_reason, subject_eligibility_reason, 'UNKNOWN'::text) AS eligibility_reason,
        CASE
            WHEN ((row_presence = 'BOTH'::text) AND (match_status = 'MATCHED'::text)) THEN 'READY'::text
            WHEN ((row_presence = 'ROSTER_ONLY'::text) AND (position_title = 'Technician'::text)) THEN 'MISSING_PAYLOAD_EXPECTED'::text
            WHEN (row_presence = 'ROSTER_ONLY'::text) THEN 'NO_PAYLOAD_NOT_EXPECTED'::text
            WHEN ((row_presence = 'PAYLOAD_ONLY'::text) AND (match_status = 'NO_ROSTER'::text)) THEN 'UNLINKED_PAYLOAD'::text
            WHEN ((row_presence = 'PAYLOAD_ONLY'::text) AND (match_status = 'TOTAL_ROW'::text)) THEN 'TOTAL_ROW'::text
            WHEN (match_status = ANY (ARRAY['MULTI_ASSIGNMENT_MATCH'::text, 'MULTI_TECH_MATCH'::text])) THEN 'AMBIGUOUS_MATCH'::text
            ELSE 'REVIEW'::text
        END AS subject_state,
    office_label
   FROM joined;


--
-- Name: metric_subject_scores_v; Type: VIEW; Schema: core; Owner: -
--

CREATE VIEW core.metric_subject_scores_v AS
 WITH subject_base AS (
         SELECT s.subject_key,
            s.metric_batch_id,
            s.legacy_batch_id,
            s.workspace_id,
            s.pc_org_id,
            s.metric_date,
            s.fiscal_end_date,
            s.person_id,
            s.full_name,
            s.person_active,
            s.person_role,
            s.co_ref_id,
            s.co_code,
            s.affiliation_type,
            s.assignment_id,
            s.tech_id,
            s.reports_to_person_id,
            s.position_title,
            s.row_kind,
            s.is_totals_row,
            s.row_presence,
            s.match_status,
            s.is_rank_eligible,
            s.eligibility_reason
           FROM core.metric_subjects_v s
          WHERE (s.is_totals_row = false)
        ), profiles AS (
         SELECT mp.profile_key,
            mp.profile_label
           FROM core.metric_profiles mp
          WHERE (mp.is_active = true)
        ), subject_profile_space AS (
         SELECT sb.subject_key,
            sb.metric_batch_id,
            sb.legacy_batch_id,
            sb.workspace_id,
            sb.pc_org_id,
            sb.metric_date,
            sb.fiscal_end_date,
            sb.person_id,
            sb.full_name,
            sb.person_active,
            sb.person_role,
            sb.co_ref_id,
            sb.co_code,
            sb.affiliation_type,
            sb.assignment_id,
            sb.tech_id,
            sb.reports_to_person_id,
            sb.position_title,
            sb.row_kind,
            sb.is_totals_row,
            sb.row_presence,
            sb.match_status,
            sb.is_rank_eligible,
            sb.eligibility_reason,
            p.profile_key,
            p.profile_label
           FROM (subject_base sb
             CROSS JOIN profiles p)
          WHERE (sb.row_kind = 'TECH'::text)
        ), profile_kpis AS (
         SELECT v.profile_key,
            v.profile_label,
            v.metric_profile_id,
            v.metric_profile_rule_id,
            v.metric_key,
            v.metric_label,
            v.display_label,
            v.weight,
            v.sort_order,
            v.report_order,
            v.is_tiebreaker,
            v.is_visible,
            v.is_enabled,
            v.no_data_behavior,
            v.direction,
            v.unit
           FROM core.metric_profile_kpis_v v
          WHERE ((v.profile_is_active = true) AND (v.metric_is_active = true) AND (v.is_enabled = true))
        ), subject_profile_kpis AS (
         SELECT sps.subject_key,
            sps.metric_batch_id,
            sps.legacy_batch_id,
            sps.workspace_id,
            sps.pc_org_id,
            sps.metric_date,
            sps.fiscal_end_date,
            sps.person_id,
            sps.full_name,
            sps.person_active,
            sps.person_role,
            sps.co_ref_id,
            sps.co_code,
            sps.affiliation_type,
            sps.assignment_id,
            sps.tech_id,
            sps.reports_to_person_id,
            sps.position_title,
            sps.row_kind,
            sps.is_totals_row,
            sps.row_presence,
            sps.match_status,
            sps.is_rank_eligible,
            sps.eligibility_reason,
            pk.profile_key,
            pk.profile_label,
            pk.metric_profile_id,
            pk.metric_profile_rule_id,
            pk.metric_key,
            pk.metric_label,
            pk.display_label,
            pk.weight,
            pk.sort_order,
            pk.report_order,
            pk.is_tiebreaker,
            pk.is_visible,
            pk.is_enabled,
            pk.no_data_behavior,
            pk.direction,
            pk.unit
           FROM (subject_profile_space sps
             JOIN profile_kpis pk ON ((pk.profile_key = sps.profile_key)))
        ), joined_scores AS (
         SELECT spk.subject_key,
            spk.metric_batch_id,
            spk.legacy_batch_id,
            spk.workspace_id,
            spk.pc_org_id,
            spk.metric_date,
            spk.fiscal_end_date,
            spk.person_id,
            spk.full_name,
            spk.person_active,
            spk.person_role,
            spk.co_ref_id,
            spk.co_code,
            spk.affiliation_type,
            spk.assignment_id,
            spk.tech_id,
            spk.reports_to_person_id,
            spk.position_title,
            spk.row_kind,
            spk.is_totals_row,
            spk.row_presence,
            spk.match_status,
            spk.is_rank_eligible AS subject_is_rank_eligible,
            spk.eligibility_reason AS subject_eligibility_reason,
            spk.profile_key,
            spk.profile_label,
            spk.metric_profile_id,
            spk.metric_profile_rule_id,
            spk.metric_key,
            spk.metric_label,
            spk.display_label,
            spk.weight,
            spk.sort_order,
            spk.report_order,
            spk.is_tiebreaker,
            spk.is_visible,
            spk.is_enabled,
            spk.no_data_behavior,
            spk.direction,
            spk.unit,
            sc.numerator,
            sc.denominator,
            sc.metric_value,
            sc.band_key,
            sc.normalized_value,
            sc.weighted_points,
            sc.is_rank_eligible AS score_is_rank_eligible,
            sc.eligibility_reason AS score_eligibility_reason
           FROM (subject_profile_kpis spk
             LEFT JOIN core.metric_scores_v sc ON (((sc.metric_batch_id = spk.metric_batch_id) AND (sc.profile_key = spk.profile_key) AND (sc.tech_id = spk.tech_id) AND (sc.metric_key = spk.metric_key))))
        )
 SELECT subject_key,
    metric_batch_id,
    legacy_batch_id,
    workspace_id,
    pc_org_id,
    metric_date,
    fiscal_end_date,
    person_id,
    full_name,
    person_active,
    person_role,
    co_ref_id,
    co_code,
    affiliation_type,
    assignment_id,
    tech_id,
    reports_to_person_id,
    position_title,
    row_kind,
    is_totals_row,
    row_presence,
    match_status,
    profile_key,
    profile_label,
    metric_profile_id,
    metric_profile_rule_id,
    metric_key,
    metric_label,
    display_label,
    weight,
    sort_order,
    report_order,
    is_tiebreaker,
    is_visible,
    is_enabled,
    no_data_behavior,
    direction,
    unit,
    numerator,
    denominator,
    metric_value,
    band_key,
    normalized_value,
    weighted_points,
    COALESCE(score_is_rank_eligible, subject_is_rank_eligible, false) AS is_rank_eligible,
    COALESCE(score_eligibility_reason, subject_eligibility_reason, 'UNKNOWN'::text) AS eligibility_reason,
        CASE
            WHEN (row_presence = 'ROSTER_ONLY'::text) THEN 'NO_DATA'::text
            ELSE COALESCE(band_key, 'NO_DATA'::text)
        END AS render_band_key
   FROM joined_scores;


--
-- Name: metric_total_rows; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.metric_total_rows (
    metric_total_row_id uuid DEFAULT gen_random_uuid() NOT NULL,
    metric_batch_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    metric_date date NOT NULL,
    fiscal_end_date date NOT NULL,
    summary_type text NOT NULL,
    summary_key text NOT NULL,
    summary_label text NOT NULL,
    unique_row_key text NOT NULL,
    raw jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: person_identifiers; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.person_identifiers (
    person_identifier_id uuid DEFAULT gen_random_uuid() NOT NULL,
    person_id uuid NOT NULL,
    identifier_type text NOT NULL,
    identifier_value text NOT NULL,
    is_primary boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by_app_user_id uuid,
    updated_by_app_user_id uuid,
    CONSTRAINT core_person_identifiers_type_ck CHECK ((identifier_type = ANY (ARRAY['TECH_ID'::text, 'FUSE_EMP_ID'::text, 'NT_LOGIN'::text, 'CSG_ID'::text])))
);


--
-- Name: reporting_lines; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.reporting_lines (
    reporting_line_id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    parent_assignment_id uuid NOT NULL,
    child_assignment_id uuid NOT NULL,
    effective_start date NOT NULL,
    effective_end date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by_app_user_id uuid,
    updated_by_app_user_id uuid,
    CONSTRAINT core_reporting_lines_date_ck CHECK (((effective_end IS NULL) OR (effective_end >= effective_start))),
    CONSTRAINT core_reporting_lines_no_self_ck CHECK ((parent_assignment_id <> child_assignment_id))
);


--
-- Name: roles; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.roles (
    role_id uuid DEFAULT gen_random_uuid() NOT NULL,
    role_key text NOT NULL,
    role_label text NOT NULL,
    role_scope text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: master_kpi_archive_metric; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.master_kpi_archive_metric (
    archive_metric_id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_id uuid NOT NULL,
    class_type text NOT NULL,
    pc_org_id uuid NOT NULL,
    metric_date date NOT NULL,
    tech_id text NOT NULL,
    metric_key text NOT NULL,
    raw_value numeric,
    numerator numeric,
    denominator numeric,
    computed_value numeric,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    metric_key_raw text,
    metric_key_canonical text
);


--
-- Name: master_kpi_archive_snapshot; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.master_kpi_archive_snapshot (
    archive_snapshot_id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_id uuid NOT NULL,
    class_type text NOT NULL,
    pc_org_id uuid NOT NULL,
    metric_date date NOT NULL,
    fiscal_end_date date NOT NULL,
    tech_id text NOT NULL,
    person_id uuid NOT NULL,
    ownership_mode text NOT NULL,
    ownership_effective_date date NOT NULL,
    direct_reports_to_person_id uuid,
    itg_rollup_person_id uuid,
    office_id uuid,
    position_title text,
    co_ref uuid,
    co_code text,
    affiliation_type text,
    affiliation_role text,
    composite_score numeric,
    rank_org integer,
    population_size integer,
    status_badge text,
    is_outlier boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_totals boolean DEFAULT false NOT NULL,
    totals_owner_person_id uuid,
    raw_metrics_json jsonb,
    computed_metrics_json jsonb,
    percentile numeric
);


--
-- Name: division; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.division (
    division_id uuid DEFAULT gen_random_uuid() NOT NULL,
    division_name text NOT NULL,
    division_code text NOT NULL
);


--
-- Name: mso; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mso (
    mso_id uuid DEFAULT gen_random_uuid() NOT NULL,
    mso_name text NOT NULL,
    mso_lob text NOT NULL,
    CONSTRAINT mso_lob_allowed CHECK ((mso_lob = ANY (ARRAY['FULFILLMENT'::text, 'LOCATE'::text])))
);


--
-- Name: pc_org; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pc_org (
    pc_org_id uuid DEFAULT gen_random_uuid() NOT NULL,
    pc_id uuid NOT NULL,
    mso_id uuid NOT NULL,
    division_id uuid,
    region_id uuid,
    pc_org_name text NOT NULL,
    fulfillment_center_id bigint,
    fulfillment_center_name text,
    state_code text
);


--
-- Name: COLUMN pc_org.fulfillment_center_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pc_org.fulfillment_center_id IS 'Third-party fulfillment center numeric identifier used to validate shift validation uploads.';


--
-- Name: COLUMN pc_org.fulfillment_center_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pc_org.fulfillment_center_name IS 'Human label parsed from third-party fulfillment center line (optional).';


--
-- Name: region; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.region (
    region_id uuid DEFAULT gen_random_uuid() NOT NULL,
    region_name text NOT NULL,
    region_code text NOT NULL
);


--
-- Name: route_lock_roster_tech_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.route_lock_roster_tech_v AS
 SELECT assignment_id,
    pc_org_id,
    person_id,
    full_name,
    tech_id,
    position_title,
    start_date,
    end_date,
    assignment_active,
    reports_to_assignment_id,
    reports_to_person_id,
    reports_to_full_name,
    co_name
   FROM public.route_lock_roster_v
  WHERE ((tech_id IS NOT NULL) AND (btrim(tech_id) <> ''::text));


--
-- Name: metrics_rank_partition; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.metrics_rank_partition (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_id uuid NOT NULL,
    pc_org_id uuid NOT NULL,
    metric_date date NOT NULL,
    fiscal_end_date date NOT NULL,
    mso_id uuid,
    class_type text NOT NULL,
    tech_id text NOT NULL,
    rank integer NOT NULL,
    n integer NOT NULL,
    percentile numeric DEFAULT 0 NOT NULL,
    total_weighted_points numeric DEFAULT 0 NOT NULL,
    computed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT metrics_rank_partition_class_type_check CHECK ((upper(class_type) = ANY (ARRAY['NSR'::text, 'SMART'::text, 'TECH'::text])))
);


--
-- Name: admin_permission_grant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_permission_grant (
    admin_permission_grant_id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_user_id uuid NOT NULL,
    permission_key text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    expires_at timestamp with time zone,
    notes text
);


--
-- Name: admin_permission_grant_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_permission_grant_audit (
    audit_id bigint NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    actor_user_id uuid NOT NULL,
    target_user_id uuid NOT NULL,
    permission_key text NOT NULL,
    action text NOT NULL,
    source text DEFAULT 'admin-console'::text NOT NULL,
    notes text,
    CONSTRAINT admin_permission_grant_audit_action_check CHECK ((action = ANY (ARRAY['GRANT'::text, 'REVOKE'::text])))
);


--
-- Name: admin_permission_grant_audit_audit_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.admin_permission_grant_audit_audit_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: admin_permission_grant_audit_audit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.admin_permission_grant_audit_audit_id_seq OWNED BY public.admin_permission_grant_audit.audit_id;


--
-- Name: app_access_session_fact; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_access_session_fact (
    session_fact_id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_user_id uuid NOT NULL,
    person_id uuid NOT NULL,
    pc_org_id uuid NOT NULL,
    assignment_id uuid,
    email text,
    first_seen_in_app_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_in_app_at timestamp with time zone DEFAULT now() NOT NULL,
    first_access_pass_issued_at timestamp with time zone,
    last_access_pass_issued_at timestamp with time zone,
    evidence_source text DEFAULT 'bootstrap'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: app_owners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_owners (
    auth_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: assignment_leadership_resolved_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.assignment_leadership_resolved_v AS
 SELECT ar.assignment_reporting_id,
    ar.child_assignment_id,
    ar.parent_assignment_id,
    child.person_id AS child_person_id,
    parent.person_id AS parent_person_id,
    ((ar.end_date IS NULL) OR (ar.end_date >= CURRENT_DATE)) AS active
   FROM ((public.assignment_reporting ar
     LEFT JOIN public.assignment_admin_v child ON ((child.assignment_id = ar.child_assignment_id)))
     LEFT JOIN public.assignment_admin_v parent ON ((parent.assignment_id = ar.parent_assignment_id)));


--
-- Name: calendar_blackout_rule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calendar_blackout_rule (
    blackout_rule_id uuid DEFAULT gen_random_uuid() NOT NULL,
    country_code text NOT NULL,
    label text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    source_holiday_id uuid,
    blackout_type text DEFAULT 'holiday_weekend'::text NOT NULL,
    severity text DEFAULT 'warning'::text NOT NULL,
    manager_attention_policy text DEFAULT 'normal'::text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    allows_manager_override boolean DEFAULT true NOT NULL,
    requires_override_reason boolean DEFAULT false NOT NULL,
    ui_badge_variant text DEFAULT 'warning'::text NOT NULL,
    manager_controlled_request_entry boolean DEFAULT false NOT NULL,
    CONSTRAINT calendar_blackout_rule_attention_policy_chk CHECK ((manager_attention_policy = ANY (ARRAY['normal'::text, 'suppress_escalated_attention'::text]))),
    CONSTRAINT calendar_blackout_rule_country_chk CHECK (((country_code = upper(country_code)) AND (length(country_code) = 2))),
    CONSTRAINT calendar_blackout_rule_dates_chk CHECK ((end_date >= start_date)),
    CONSTRAINT calendar_blackout_rule_severity_chk CHECK ((severity = ANY (ARRAY['info'::text, 'warning'::text, 'critical'::text]))),
    CONSTRAINT calendar_blackout_rule_ui_badge_variant_chk CHECK ((ui_badge_variant = ANY (ARRAY['info'::text, 'warning'::text, 'critical'::text, 'success'::text, 'muted'::text])))
);


--
-- Name: COLUMN calendar_blackout_rule.manager_controlled_request_entry; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.calendar_blackout_rule.manager_controlled_request_entry IS 'When true, non-manager users cannot create app-originated requests during the blackout window. Managers must directly intake and enter approved requests themselves.';


--
-- Name: calendar_holiday_baseline; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calendar_holiday_baseline (
    holiday_id uuid DEFAULT gen_random_uuid() NOT NULL,
    country_code text NOT NULL,
    holiday_date date NOT NULL,
    holiday_name text NOT NULL,
    source text DEFAULT 'manual'::text NOT NULL,
    source_key text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT calendar_holiday_baseline_country_chk CHECK (((country_code = upper(country_code)) AND (length(country_code) = 2)))
);


--
-- Name: check_in_batch; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.check_in_batch (
    check_in_batch_id uuid DEFAULT gen_random_uuid() NOT NULL,
    pc_org_id uuid NOT NULL,
    fulfillment_center_id bigint NOT NULL,
    uploaded_by_auth_user_id uuid NOT NULL,
    uploaded_at timestamp with time zone DEFAULT now() NOT NULL,
    row_count_total integer DEFAULT 0 NOT NULL,
    row_count_loaded integer DEFAULT 0 NOT NULL,
    min_cp_date date,
    max_cp_date date,
    source_file_name text,
    source_hash text
);


--
-- Name: check_in_day_fact; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.check_in_day_fact (
    pc_org_id uuid NOT NULL,
    shift_date date NOT NULL,
    tech_id text NOT NULL,
    fiscal_month_id uuid NOT NULL,
    fiscal_end_date date NOT NULL,
    fulfillment_center_id bigint NOT NULL,
    actual_jobs integer DEFAULT 0 NOT NULL,
    actual_units numeric DEFAULT 0 NOT NULL,
    actual_hours numeric DEFAULT 0 NOT NULL,
    first_start_time time without time zone,
    last_cp_time time without time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    actual_hours_is_outlier boolean DEFAULT false NOT NULL,
    actual_hours_note text,
    sla_bptrl_jobs integer DEFAULT 0,
    sla_bptrl_units numeric(10,2) DEFAULT 0,
    sla_bptrl_hours numeric(10,2) DEFAULT 0
);


--
-- Name: COLUMN check_in_day_fact.sla_bptrl_jobs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.check_in_day_fact.sla_bptrl_jobs IS 'Total jobs flagged as SLA/BPTRL for the day';


--
-- Name: COLUMN check_in_day_fact.sla_bptrl_units; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.check_in_day_fact.sla_bptrl_units IS 'Total units associated with SLA/BPTRL jobs for the day';


--
-- Name: COLUMN check_in_day_fact.sla_bptrl_hours; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.check_in_day_fact.sla_bptrl_hours IS 'Total production hours associated with SLA/BPTRL jobs for the day';


--
-- Name: check_in_job_row; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.check_in_job_row (
    check_in_job_row_id uuid DEFAULT gen_random_uuid() NOT NULL,
    pc_org_id uuid NOT NULL,
    check_in_batch_id uuid NOT NULL,
    fulfillment_center_id bigint NOT NULL,
    tech_id text NOT NULL,
    job_num text NOT NULL,
    work_order_number text,
    account text,
    job_type text,
    job_units numeric,
    time_slot_start_time time without time zone,
    time_slot_end_time time without time zone,
    start_time time without time zone,
    cp_date date NOT NULL,
    cp_time time without time zone,
    job_duration numeric,
    resolution_code text,
    job_comment text,
    ingested_at timestamp with time zone DEFAULT now() NOT NULL,
    source_tech_last_name text,
    is_sla_bptrl boolean DEFAULT false
);


--
-- Name: COLUMN check_in_job_row.source_tech_last_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.check_in_job_row.source_tech_last_name IS 'Raw Tech Last Name value from uploaded check-in source file';


--
-- Name: COLUMN check_in_job_row.is_sla_bptrl; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.check_in_job_row.is_sla_bptrl IS 'True when uploaded Tech Last Name contains BPTRL marker';


--
-- Name: company_admin_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.company_admin_v AS
 SELECT company_id,
    company_name,
    company_code
   FROM public.company c;


--
-- Name: contractor_admin_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.contractor_admin_v AS
 SELECT contractor_id,
    contractor_name,
    contractor_code
   FROM public.contractor k;


--
-- Name: contractor_assignment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contractor_assignment (
    contractor_assignment_id uuid DEFAULT gen_random_uuid() NOT NULL,
    contractor_id uuid NOT NULL,
    pc_org_id uuid NOT NULL,
    start_date date NOT NULL,
    end_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone,
    updated_by uuid,
    CONSTRAINT chk_contractor_assignment_dates CHECK (((end_date IS NULL) OR (end_date >= start_date)))
);


--
-- Name: contractor_assignment_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.contractor_assignment_v AS
 SELECT contractor_assignment_id,
    contractor_id,
    pc_org_id,
    start_date,
    end_date,
    created_at,
    created_by,
    updated_at,
    updated_by
   FROM public.contractor_assignment;


--
-- Name: dispatch_console_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dispatch_console_log (
    dispatch_console_log_id uuid DEFAULT gen_random_uuid() NOT NULL,
    pc_org_id uuid NOT NULL,
    shift_date date NOT NULL,
    assignment_id uuid,
    person_id uuid,
    tech_id text,
    affiliation_id uuid,
    event_type text NOT NULL,
    capacity_delta_routes integer DEFAULT 0 NOT NULL,
    message text NOT NULL,
    tags text[],
    meta jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by_user_id uuid DEFAULT auth.uid() NOT NULL,
    dedupe_key text,
    event_group_id uuid,
    updated_at timestamp with time zone,
    updated_by_user_id uuid,
    CONSTRAINT dispatch_console_log_delta_chk CHECK ((capacity_delta_routes = ANY (ARRAY['-1'::integer, 0, 1]))),
    CONSTRAINT dispatch_console_log_event_type_chk CHECK ((event_type = ANY (ARRAY['CALL_OUT'::text, 'ADD_IN'::text, 'BP_LOW'::text, 'INCIDENT'::text, 'NOTE'::text, 'TECH_MOVE'::text]))),
    CONSTRAINT dispatch_console_log_identity_chk CHECK ((((event_type = 'NOTE'::text) AND (((assignment_id IS NULL) AND (person_id IS NULL) AND (tech_id IS NULL)) OR ((assignment_id IS NOT NULL) AND (person_id IS NOT NULL) AND (tech_id IS NOT NULL)))) OR ((event_type <> 'NOTE'::text) AND (assignment_id IS NOT NULL) AND (person_id IS NOT NULL) AND (tech_id IS NOT NULL))))
);


--
-- Name: COLUMN dispatch_console_log.dedupe_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.dispatch_console_log.dedupe_key IS 'Normalized key used for dedupe/grouping. Typically derived from message/payload.';


--
-- Name: COLUMN dispatch_console_log.event_group_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.dispatch_console_log.event_group_id IS 'Groups multi-entry event threads (e.g., INCIDENT, TECH_MOVE). Null for singletons.';


--
-- Name: dispatch_console_log_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dispatch_console_log_audit (
    dispatch_console_log_audit_id uuid DEFAULT gen_random_uuid() NOT NULL,
    dispatch_console_log_id uuid NOT NULL,
    action text NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    changed_by_user_id uuid NOT NULL,
    old_event_type text,
    new_event_type text,
    old_message text,
    new_message text,
    CONSTRAINT dispatch_console_log_audit_action_check CHECK ((action = 'UPDATE'::text))
);


--
-- Name: dispatch_day_tech; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dispatch_day_tech (
    pc_org_id uuid NOT NULL,
    shift_date date NOT NULL,
    assignment_id uuid NOT NULL,
    person_id uuid NOT NULL,
    tech_id text NOT NULL,
    affiliation_id uuid,
    full_name text NOT NULL,
    co_name text,
    planned_route_id uuid,
    planned_route_name text,
    planned_start_time time without time zone,
    planned_end_time time without time zone,
    schedule_as_of timestamp with time zone,
    sv_built boolean,
    sv_route_id uuid,
    sv_route_name text,
    sv_as_of timestamp with time zone,
    checked_in_at timestamp with time zone,
    check_in_as_of timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    planned_hours numeric,
    planned_units numeric
);


--
-- Name: quota_day_fact; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quota_day_fact (
    pc_org_id uuid NOT NULL,
    shift_date date NOT NULL,
    route_id uuid NOT NULL,
    fiscal_month_id uuid NOT NULL,
    fiscal_end_date date NOT NULL,
    quota_hours numeric DEFAULT 0 NOT NULL,
    quota_units numeric DEFAULT 0 NOT NULL,
    quota_source text DEFAULT 'BASELINE'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: dispatch_day_summary_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.dispatch_day_summary_v AS
 WITH tech_day AS (
         SELECT ddt.pc_org_id,
            ddt.shift_date,
            (count(*))::integer AS tech_count,
            (count(*) FILTER (WHERE (ddt.sv_built IS TRUE)))::integer AS built_count,
            (count(*) FILTER (WHERE (ddt.checked_in_at IS NOT NULL)))::integer AS checked_in_count
           FROM public.dispatch_day_tech ddt
          GROUP BY ddt.pc_org_id, ddt.shift_date
        ), log_day AS (
         SELECT l_1.pc_org_id,
            l_1.shift_date,
            (count(*) FILTER (WHERE (l_1.event_type = 'CALL_OUT'::text)))::integer AS call_out_count,
            (count(*) FILTER (WHERE (l_1.event_type = 'ADD_IN'::text)))::integer AS add_in_count,
            (count(*) FILTER (WHERE (l_1.event_type = 'INCIDENT'::text)))::integer AS incident_count,
            (count(*) FILTER (WHERE (l_1.event_type = 'NOTE'::text)))::integer AS note_count,
            (COALESCE(sum(l_1.capacity_delta_routes), (0)::bigint))::integer AS net_capacity_delta_routes
           FROM public.dispatch_console_log l_1
          GROUP BY l_1.pc_org_id, l_1.shift_date
        ), quota_day AS (
         SELECT q_1.pc_org_id,
            q_1.shift_date,
            sum(q_1.quota_hours) AS quota_hours,
            sum(q_1.quota_units) AS quota_units,
            max(q_1.updated_at) AS quota_as_of
           FROM public.quota_day_fact q_1
          GROUP BY q_1.pc_org_id, q_1.shift_date
        ), days AS (
         SELECT tech_day.pc_org_id,
            tech_day.shift_date
           FROM tech_day
        UNION
         SELECT log_day.pc_org_id,
            log_day.shift_date
           FROM log_day
        UNION
         SELECT quota_day.pc_org_id,
            quota_day.shift_date
           FROM quota_day
        )
 SELECT d.pc_org_id,
    d.shift_date,
    COALESCE(t.tech_count, 0) AS tech_count,
    COALESCE(t.built_count, 0) AS built_count,
    COALESCE(t.checked_in_count, 0) AS checked_in_count,
    COALESCE(l.call_out_count, 0) AS call_out_count,
    COALESCE(l.add_in_count, 0) AS add_in_count,
    COALESCE(l.incident_count, 0) AS incident_count,
    COALESCE(l.note_count, 0) AS note_count,
    COALESCE(l.net_capacity_delta_routes, 0) AS net_capacity_delta_routes,
    COALESCE(q.quota_hours, (0)::numeric) AS quota_hours,
    COALESCE(q.quota_units, (0)::numeric) AS quota_units,
    (ceil(GREATEST((COALESCE(q.quota_hours, (0)::numeric) / 8.0), (COALESCE(q.quota_units, (0)::numeric) / 96.0))))::integer AS quota_routes_required,
    q.quota_as_of
   FROM (((days d
     LEFT JOIN tech_day t ON (((t.pc_org_id = d.pc_org_id) AND (t.shift_date = d.shift_date))))
     LEFT JOIN log_day l ON (((l.pc_org_id = d.pc_org_id) AND (l.shift_date = d.shift_date))))
     LEFT JOIN quota_day q ON (((q.pc_org_id = d.pc_org_id) AND (q.shift_date = d.shift_date))));


--
-- Name: dispatch_schedule_action_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dispatch_schedule_action_queue (
    dispatch_schedule_action_id uuid DEFAULT gen_random_uuid() NOT NULL,
    dispatch_console_log_id uuid NOT NULL,
    pc_org_id uuid NOT NULL,
    shift_date date NOT NULL,
    assignment_id uuid,
    person_id uuid,
    tech_id text,
    action_type text NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    from_route_id uuid,
    from_route_name text,
    to_route_id uuid,
    to_route_name text,
    requested_by_user_id uuid NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_by_user_id uuid,
    resolved_at timestamp with time zone,
    resolution_note text,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT dispatch_schedule_action_queue_action_type_chk CHECK ((action_type = 'TECH_MOVE_BASELINE_UPDATE'::text)),
    CONSTRAINT dispatch_schedule_action_queue_status_chk CHECK ((status = ANY (ARRAY['PENDING'::text, 'APPLIED'::text, 'REJECTED'::text, 'CANCELED'::text])))
);


--
-- Name: division_admin_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.division_admin_v AS
 SELECT division_id,
    division_name,
    division_code
   FROM public.division d;


--
-- Name: division_leadership; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.division_leadership (
    division_id uuid NOT NULL,
    role_key text NOT NULL,
    leader_user_id uuid,
    leader_person_id uuid,
    is_primary boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by_user_id uuid,
    CONSTRAINT division_leadership_one_target_chk CHECK ((((leader_user_id IS NOT NULL) AND (leader_person_id IS NULL)) OR ((leader_user_id IS NULL) AND (leader_person_id IS NOT NULL))))
);


--
-- Name: exec_pc_org_access_derived; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exec_pc_org_access_derived (
    leader_person_id uuid NOT NULL,
    pc_org_id uuid NOT NULL,
    derived_from text DEFAULT 'assignment_reporting'::text NOT NULL,
    derived_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_profile; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_profile (
    auth_user_id uuid NOT NULL,
    person_id uuid,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    selected_pc_org_id uuid,
    is_admin boolean DEFAULT false NOT NULL,
    core_person_id uuid,
    CONSTRAINT user_profile_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'inactive'::text, 'disabled'::text])))
);


--
-- Name: exec_pc_org_access; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.exec_pc_org_access AS
 SELECT DISTINCT up.auth_user_id,
    x.pc_org_id
   FROM (public.exec_pc_org_access_derived x
     JOIN public.user_profile up ON (((up.person_id = x.leader_person_id) OR (up.core_person_id = x.leader_person_id))))
  WHERE ((up.auth_user_id IS NOT NULL) AND (x.pc_org_id IS NOT NULL));


--
-- Name: field_input_map; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.field_input_map (
    table_name text NOT NULL,
    column_name text NOT NULL,
    input_type text NOT NULL,
    foreign_table text,
    foreign_key text,
    display_column text,
    is_nullable boolean DEFAULT true
);


--
-- Name: field_log_billing_email_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.field_log_billing_email_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    report_id uuid NOT NULL,
    category_key text NOT NULL,
    job_number text,
    packet_filename text,
    packet_sha256 text,
    send_mode text NOT NULL,
    status text NOT NULL,
    to_email text NOT NULL,
    backup_email text,
    requested_by_user_id uuid,
    requested_by_email text,
    provider_message_id text,
    error_message text,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    sent_at timestamp with time zone,
    CONSTRAINT field_log_billing_email_log_send_mode_check CHECK ((send_mode = ANY (ARRAY['auto'::text, 'manual_resend'::text]))),
    CONSTRAINT field_log_billing_email_log_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text, 'skipped_duplicate'::text])))
);


--
-- Name: field_log_billing_email_recipient; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.field_log_billing_email_recipient (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pc_org_id uuid NOT NULL,
    email text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by_user_id uuid
);


--
-- Name: field_log_category; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.field_log_category (
    category_id uuid DEFAULT gen_random_uuid() NOT NULL,
    category_key text NOT NULL,
    label text NOT NULL,
    description text,
    sort_order integer DEFAULT 100 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    config_version_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: field_log_config_version; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.field_log_config_version (
    config_version_id uuid DEFAULT gen_random_uuid() NOT NULL,
    version_no integer NOT NULL,
    status text NOT NULL,
    label text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    published_at timestamp with time zone,
    published_by uuid,
    CONSTRAINT field_log_config_version_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])))
);


--
-- Name: field_log_published_config_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.field_log_published_config_v AS
 SELECT config_version_id,
    version_no,
    label,
    notes,
    published_at,
    published_by
   FROM public.field_log_config_version
  WHERE (status = 'published'::text);


--
-- Name: field_log_categories_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.field_log_categories_v AS
 SELECT c.config_version_id,
    c.category_key,
    c.label,
    c.description,
    c.sort_order
   FROM (public.field_log_category c
     JOIN public.field_log_published_config_v p ON ((p.config_version_id = c.config_version_id)))
  WHERE (c.is_active = true)
  ORDER BY c.sort_order, c.label;


--
-- Name: field_log_comment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.field_log_comment (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    report_id uuid NOT NULL,
    author_user_id uuid NOT NULL,
    comment_type text NOT NULL,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: field_log_config_version_version_no_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.field_log_config_version ALTER COLUMN version_no ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.field_log_config_version_version_no_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: field_log_event; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.field_log_event (
    field_log_event_id uuid DEFAULT gen_random_uuid() NOT NULL,
    report_id uuid NOT NULL,
    event_at timestamp with time zone DEFAULT now() NOT NULL,
    event_type text NOT NULL,
    from_status text,
    to_status text,
    actor_user_id uuid,
    note text,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT field_log_event_event_type_check CHECK ((event_type = ANY (ARRAY['created'::text, 'status_changed'::text, 'approved'::text, 'locked'::text, 'xm_declared'::text, 'xm_verified'::text, 'tech_followup_opened'::text, 'sup_followup_opened'::text, 'resubmitted'::text, 'closed_by_leadership'::text, 'followup_reassigned'::text])))
);


--
-- Name: field_log_photo_label; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.field_log_photo_label (
    photo_label_id uuid DEFAULT gen_random_uuid() NOT NULL,
    photo_label_key text NOT NULL,
    label text NOT NULL,
    description text,
    sort_order integer DEFAULT 100 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    config_version_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: field_log_rule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.field_log_rule (
    rule_id uuid DEFAULT gen_random_uuid() NOT NULL,
    category_key text NOT NULL,
    subcategory_key text,
    show_subcategory boolean DEFAULT false NOT NULL,
    require_subcategory boolean DEFAULT false NOT NULL,
    show_ucode boolean DEFAULT false NOT NULL,
    require_ucode boolean DEFAULT false NOT NULL,
    ucode_group_key text,
    xm_allowed boolean DEFAULT false NOT NULL,
    comment_required boolean DEFAULT false NOT NULL,
    min_photo_count integer DEFAULT 0 NOT NULL,
    location_required boolean DEFAULT false NOT NULL,
    location_compare_required boolean DEFAULT false NOT NULL,
    location_tolerance_m integer,
    allow_technician_submit boolean DEFAULT true NOT NULL,
    allow_supervisor_submit boolean DEFAULT true NOT NULL,
    active_text_instruction text,
    sort_order integer DEFAULT 100 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    config_version_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT field_log_rule_location_tolerance_m_check CHECK (((location_tolerance_m IS NULL) OR (location_tolerance_m >= 0))),
    CONSTRAINT field_log_rule_min_photo_count_check CHECK ((min_photo_count >= 0))
);


--
-- Name: field_log_rule_photo_requirement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.field_log_rule_photo_requirement (
    rule_photo_requirement_id uuid DEFAULT gen_random_uuid() NOT NULL,
    rule_id uuid NOT NULL,
    photo_label_key text NOT NULL,
    required boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: field_log_subcategory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.field_log_subcategory (
    subcategory_id uuid DEFAULT gen_random_uuid() NOT NULL,
    category_key text NOT NULL,
    subcategory_key text NOT NULL,
    label text NOT NULL,
    description text,
    sort_order integer DEFAULT 100 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    config_version_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: field_log_ucode; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.field_log_ucode (
    ucode_id uuid DEFAULT gen_random_uuid() NOT NULL,
    ucode text NOT NULL,
    label text NOT NULL,
    description text,
    sort_order integer DEFAULT 100 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    config_version_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: field_log_ucode_group; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.field_log_ucode_group (
    ucode_group_id uuid DEFAULT gen_random_uuid() NOT NULL,
    ucode_group_key text NOT NULL,
    label text NOT NULL,
    description text,
    sort_order integer DEFAULT 100 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    config_version_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: field_log_ucode_group_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.field_log_ucode_group_item (
    ucode_group_item_id uuid DEFAULT gen_random_uuid() NOT NULL,
    ucode_group_key text NOT NULL,
    ucode text NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    config_version_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: field_log_ucode_groups_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.field_log_ucode_groups_v AS
 SELECT g.config_version_id,
    g.ucode_group_key,
    g.label,
    g.description,
    g.sort_order,
    COALESCE(jsonb_agg(jsonb_build_object('ucode', i.ucode, 'label', u.label, 'sort_order', i.sort_order) ORDER BY i.sort_order, i.ucode) FILTER (WHERE (i.ucode IS NOT NULL)), '[]'::jsonb) AS ucodes_json
   FROM (((public.field_log_ucode_group g
     JOIN public.field_log_published_config_v p ON ((p.config_version_id = g.config_version_id)))
     LEFT JOIN public.field_log_ucode_group_item i ON (((i.config_version_id = g.config_version_id) AND (i.ucode_group_key = g.ucode_group_key) AND (i.is_active = true))))
     LEFT JOIN public.field_log_ucode u ON (((u.config_version_id = g.config_version_id) AND (u.ucode = i.ucode) AND (u.is_active = true))))
  WHERE (g.is_active = true)
  GROUP BY g.config_version_id, g.ucode_group_key, g.label, g.description, g.sort_order
  ORDER BY g.sort_order, g.label;


--
-- Name: field_log_rules_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.field_log_rules_v AS
 SELECT r.rule_id,
    r.config_version_id,
    r.category_key,
    c.label AS category_label,
    r.subcategory_key,
    s.label AS subcategory_label,
    r.show_subcategory,
    r.require_subcategory,
    r.show_ucode,
    r.require_ucode,
    r.ucode_group_key,
    ug.ucodes_json,
    r.xm_allowed,
    r.comment_required,
    r.min_photo_count,
    r.location_required,
    r.location_compare_required,
    r.location_tolerance_m,
    r.allow_technician_submit,
    r.allow_supervisor_submit,
    r.active_text_instruction,
    COALESCE(pr.photo_requirements_json, '[]'::jsonb) AS photo_requirements_json,
    r.sort_order
   FROM (((((public.field_log_rule r
     JOIN public.field_log_published_config_v p ON ((p.config_version_id = r.config_version_id)))
     JOIN public.field_log_category c ON (((c.config_version_id = r.config_version_id) AND (c.category_key = r.category_key) AND (c.is_active = true))))
     LEFT JOIN public.field_log_subcategory s ON (((s.config_version_id = r.config_version_id) AND (s.category_key = r.category_key) AND (NOT (s.subcategory_key IS DISTINCT FROM r.subcategory_key)) AND (s.is_active = true))))
     LEFT JOIN public.field_log_ucode_groups_v ug ON (((ug.config_version_id = r.config_version_id) AND (ug.ucode_group_key = r.ucode_group_key))))
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('photo_label_key', x.photo_label_key, 'label', pl.label, 'required', x.required, 'sort_order', x.sort_order) ORDER BY x.sort_order, pl.label) AS photo_requirements_json
           FROM (public.field_log_rule_photo_requirement x
             LEFT JOIN public.field_log_photo_label pl ON (((pl.config_version_id = r.config_version_id) AND (pl.photo_label_key = x.photo_label_key) AND (pl.is_active = true))))
          WHERE ((x.rule_id = r.rule_id) AND (x.is_active = true))) pr ON (true))
  WHERE (r.is_active = true)
  ORDER BY c.sort_order, r.sort_order, s.label NULLS FIRST;


--
-- Name: field_log_subcategories_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.field_log_subcategories_v AS
 SELECT s.config_version_id,
    s.category_key,
    s.subcategory_key,
    s.label,
    s.description,
    s.sort_order
   FROM (public.field_log_subcategory s
     JOIN public.field_log_published_config_v p ON ((p.config_version_id = s.config_version_id)))
  WHERE (s.is_active = true)
  ORDER BY s.category_key, s.sort_order, s.label;


--
-- Name: field_log_my_submissions_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.field_log_my_submissions_v AS
 WITH report_identity AS (
         SELECT r_1.report_id,
            COALESCE(r_1.subject_person_id, up.person_id) AS tech_person_id,
            COALESCE(r_1.subject_full_name, p.full_name) AS tech_full_name,
            COALESCE(r_1.subject_tech_id, ta.tech_id) AS tech_id,
            ap.full_name AS approved_by_full_name
           FROM (((((public.field_log_report r_1
             LEFT JOIN public.user_profile up ON ((up.auth_user_id = r_1.created_by_user_id)))
             LEFT JOIN public.person p ON ((p.person_id = up.person_id)))
             LEFT JOIN LATERAL ( SELECT a.tech_id
                   FROM public.assignment a
                  WHERE ((a.person_id = COALESCE(r_1.subject_person_id, up.person_id)) AND (a.pc_org_id = r_1.pc_org_id) AND (a.tech_id IS NOT NULL))
                  ORDER BY
                        CASE
                            WHEN (a.active = true) THEN 0
                            ELSE 1
                        END, COALESCE(a.start_date, '1900-01-01'::date) DESC
                 LIMIT 1) ta ON (true))
             LEFT JOIN public.user_profile aup ON ((aup.auth_user_id = r_1.approval_owner_user_id)))
             LEFT JOIN public.person ap ON ((ap.person_id = aup.person_id)))
        )
 SELECT r.report_id,
    r.created_by_user_id,
    r.status,
    r.category_key,
    c.label AS category_label,
    r.subcategory_key,
    s.label AS subcategory_label,
    r.job_number,
    r.job_type,
    r.submitted_at,
    r.photo_count,
    r.edit_unlocked,
    r.locked,
    r.followup_note,
    i.tech_person_id,
    i.tech_full_name,
    i.tech_id,
    i.approved_by_full_name,
    r.evidence_declared,
    r.xm_declared,
    r.xm_link_valid,
    fr.min_photo_count,
        CASE
            WHEN (r.xm_declared AND (COALESCE(r.xm_link_valid, false) = true)) THEN 'XM Evidence Verified'::text
            WHEN r.xm_declared THEN 'XM Photo Evidence Declared'::text
            WHEN (r.photo_count > 0) THEN concat('Native Photos ', r.photo_count, '/', COALESCE(fr.min_photo_count, 0))
            WHEN (COALESCE(fr.min_photo_count, 0) > 0) THEN concat('No Evidence 0/', fr.min_photo_count)
            ELSE 'No Evidence'::text
        END AS evidence_badge
   FROM ((((public.field_log_report r
     LEFT JOIN public.field_log_categories_v c ON ((c.category_key = r.category_key)))
     LEFT JOIN public.field_log_subcategories_v s ON (((s.category_key = r.category_key) AND (NOT (s.subcategory_key IS DISTINCT FROM r.subcategory_key)))))
     LEFT JOIN public.field_log_rules_v fr ON ((fr.rule_id = r.rule_id)))
     LEFT JOIN report_identity i ON ((i.report_id = r.report_id)));


--
-- Name: field_log_review_action; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.field_log_review_action (
    review_action_id uuid DEFAULT gen_random_uuid() NOT NULL,
    report_id uuid NOT NULL,
    action_at timestamp with time zone DEFAULT now() NOT NULL,
    action_by_user_id uuid,
    action_type text NOT NULL,
    note text,
    CONSTRAINT field_log_review_action_action_type_check CHECK ((action_type = ANY (ARRAY['submit'::text, 'approve'::text, 'tech_followup'::text, 'sup_followup'::text, 'reject'::text, 'xm_link_append'::text, 'xm_verify'::text, 'resubmit'::text, 'close'::text, 'reassign_followup'::text])))
);


--
-- Name: field_log_rule_u_code_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.field_log_rule_u_code_config (
    rule_id uuid NOT NULL,
    allowed_u_codes text[] DEFAULT '{}'::text[] NOT NULL,
    requires_scan boolean DEFAULT false NOT NULL,
    disable_scan_entry boolean DEFAULT false NOT NULL,
    min_photo_count_override integer,
    require_comment boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: field_log_report_detail_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.field_log_report_detail_v AS
 WITH attachment_json AS (
         SELECT a.report_id,
            jsonb_agg(jsonb_build_object('attachment_id', a.attachment_id, 'photo_label_key', a.photo_label_key, 'file_path', a.file_path, 'file_name', a.file_name, 'mime_type', a.mime_type, 'file_size_bytes', a.file_size_bytes, 'uploaded_at', a.uploaded_at, 'deleted_at', a.deleted_at) ORDER BY a.uploaded_at, a.attachment_id) FILTER (WHERE (a.attachment_id IS NOT NULL)) AS attachments_json
           FROM public.field_log_attachment a
          GROUP BY a.report_id
        ), action_json AS (
         SELECT ra.report_id,
            jsonb_agg(jsonb_build_object('review_action_id', ra.review_action_id, 'action_at', ra.action_at, 'action_by_user_id', ra.action_by_user_id, 'action_type', ra.action_type, 'note', ra.note, 'action_by_person_id', up.person_id, 'actor_full_name', p.full_name) ORDER BY ra.action_at DESC, ra.review_action_id DESC) AS actions_json
           FROM ((public.field_log_review_action ra
             LEFT JOIN public.user_profile up ON ((up.auth_user_id = ra.action_by_user_id)))
             LEFT JOIN public.person p ON ((p.person_id = up.person_id)))
          GROUP BY ra.report_id
        ), report_identity AS (
         SELECT r_1.report_id,
            cp.full_name AS created_by_full_name,
            COALESCE(r_1.subject_person_id, up.person_id) AS tech_person_id,
            COALESCE(r_1.subject_full_name, p.full_name) AS tech_full_name,
            COALESCE(r_1.subject_tech_id, ta.tech_id) AS tech_id,
            xp.full_name AS xm_verified_by_full_name,
            ap.full_name AS approved_by_full_name,
            fp.full_name AS followup_requested_by_full_name
           FROM (((((((((((public.field_log_report r_1
             LEFT JOIN public.user_profile up ON ((up.auth_user_id = r_1.created_by_user_id)))
             LEFT JOIN public.person p ON ((p.person_id = up.person_id)))
             LEFT JOIN public.user_profile cup ON ((cup.auth_user_id = r_1.created_by_user_id)))
             LEFT JOIN public.person cp ON ((cp.person_id = cup.person_id)))
             LEFT JOIN LATERAL ( SELECT a.tech_id
                   FROM public.assignment a
                  WHERE ((a.person_id = COALESCE(r_1.subject_person_id, up.person_id)) AND (a.pc_org_id = r_1.pc_org_id) AND (a.tech_id IS NOT NULL))
                  ORDER BY
                        CASE
                            WHEN (a.active = true) THEN 0
                            ELSE 1
                        END, COALESCE(a.start_date, '1900-01-01'::date) DESC
                 LIMIT 1) ta ON (true))
             LEFT JOIN public.user_profile xup ON ((xup.auth_user_id = r_1.xm_verified_by_user_id)))
             LEFT JOIN public.person xp ON ((xp.person_id = xup.person_id)))
             LEFT JOIN public.user_profile aup ON ((aup.auth_user_id = r_1.approval_owner_user_id)))
             LEFT JOIN public.person ap ON ((ap.person_id = aup.person_id)))
             LEFT JOIN public.user_profile fup ON ((fup.auth_user_id = r_1.followup_requested_by_user_id)))
             LEFT JOIN public.person fp ON ((fp.person_id = fup.person_id)))
        )
 SELECT r.report_id,
    r.config_version_id,
    r.rule_id,
    r.category_key,
    c.label AS category_label,
    r.subcategory_key,
    s.label AS subcategory_label,
    r.status,
    r.created_at,
    r.updated_at,
    r.created_by_user_id,
    r.submitted_at,
    r.job_number,
    r.job_type,
    r.comment,
    r.evidence_declared,
    r.xm_declared,
    r.xm_link,
    r.xm_link_valid,
    r.xm_verified_by_user_id,
    r.xm_verified_at,
    r.photo_count,
    r.photo_deleted_at,
    r.gps_lat,
    r.gps_lng,
    r.gps_accuracy_m,
    r.location_captured_at,
    r.approval_owner_user_id,
    r.approved_at,
    r.followup_requested_by_user_id,
    r.followup_note,
    r.edit_unlocked,
    r.locked,
    fr.show_subcategory,
    fr.require_subcategory,
    fr.show_ucode,
    fr.require_ucode,
    fr.ucode_group_key,
        CASE
            WHEN ((uc.allowed_u_codes IS NOT NULL) AND (COALESCE(array_length(uc.allowed_u_codes, 1), 0) > 0)) THEN COALESCE(( SELECT jsonb_agg(u.u ORDER BY u.ord) AS jsonb_agg
               FROM ( SELECT t.elem AS u,
                        t.ord
                       FROM jsonb_array_elements(fr.ucodes_json) WITH ORDINALITY t(elem, ord)
                      WHERE ((t.elem ->> 'code'::text) = ANY (uc.allowed_u_codes))) u), '[]'::jsonb)
            ELSE COALESCE(fr.ucodes_json, '[]'::jsonb)
        END AS ucodes_json,
    fr.xm_allowed,
    COALESCE(uc.require_comment, fr.comment_required) AS comment_required,
    COALESCE(uc.min_photo_count_override, fr.min_photo_count) AS min_photo_count,
    fr.location_required,
    fr.location_compare_required,
    fr.location_tolerance_m,
    fr.allow_technician_submit,
    fr.allow_supervisor_submit,
    fr.active_text_instruction,
    COALESCE(fr.photo_requirements_json, '[]'::jsonb) AS photo_requirements_json,
    qc.qc_mode,
    qc.supervisor_review_decision,
    qc.approval_note AS qc_approval_note,
    nd.selected_ucode,
    nd.customer_contact_attempted,
    nd.access_issue,
    nd.safety_issue,
    nd.escalation_required,
    nd.escalation_type,
    pc.risk_level,
    pc.tnps_risk_flag,
    pc.followup_recommended,
    COALESCE(aj.attachments_json, '[]'::jsonb) AS attachments_json,
    COALESCE(ac.actions_json, '[]'::jsonb) AS actions_json,
    r.pc_org_id,
    i.created_by_full_name,
    i.tech_person_id,
    i.tech_full_name,
    i.tech_id,
    i.xm_verified_by_full_name,
    i.approved_by_full_name,
    i.followup_requested_by_full_name,
    uc.requires_scan,
    uc.disable_scan_entry,
    uc.allowed_u_codes
   FROM ((((((((((public.field_log_report r
     LEFT JOIN public.field_log_categories_v c ON ((c.category_key = r.category_key)))
     LEFT JOIN public.field_log_subcategories_v s ON (((s.category_key = r.category_key) AND (NOT (s.subcategory_key IS DISTINCT FROM r.subcategory_key)))))
     LEFT JOIN public.field_log_rules_v fr ON ((fr.rule_id = r.rule_id)))
     LEFT JOIN public.field_log_rule_u_code_config uc ON ((uc.rule_id = r.rule_id)))
     LEFT JOIN public.field_log_report_qc qc ON ((qc.report_id = r.report_id)))
     LEFT JOIN public.field_log_report_not_done nd ON ((nd.report_id = r.report_id)))
     LEFT JOIN public.field_log_report_post_call pc ON ((pc.report_id = r.report_id)))
     LEFT JOIN attachment_json aj ON ((aj.report_id = r.report_id)))
     LEFT JOIN action_json ac ON ((ac.report_id = r.report_id)))
     LEFT JOIN report_identity i ON ((i.report_id = r.report_id)));


--
-- Name: field_log_review_queue_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.field_log_review_queue_v AS
 SELECT r.report_id,
    r.status,
    r.category_key,
    c.label AS category_label,
    r.subcategory_key,
    s.label AS subcategory_label,
    r.job_number,
    r.job_type,
    r.created_by_user_id,
    r.submitted_at,
    r.photo_count,
    fr.min_photo_count,
    r.evidence_declared,
    r.xm_declared,
    r.xm_link,
    r.xm_link_valid,
    r.approval_owner_user_id,
    r.followup_requested_by_user_id,
    r.locked,
    r.comment,
    r.pc_org_id
   FROM (((public.field_log_report r
     JOIN public.field_log_rules_v fr ON ((fr.rule_id = r.rule_id)))
     LEFT JOIN public.field_log_categories_v c ON ((c.category_key = r.category_key)))
     LEFT JOIN public.field_log_subcategories_v s ON (((s.category_key = r.category_key) AND (NOT (s.subcategory_key IS DISTINCT FROM r.subcategory_key)))))
  WHERE (r.status = ANY (ARRAY['pending_review'::text, 'tech_followup_required'::text, 'sup_followup_required'::text, 'approved'::text]));


--
-- Name: field_log_review_queue_detail_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.field_log_review_queue_detail_v AS
 WITH last_action AS (
         SELECT DISTINCT ON (a.report_id) a.report_id,
            a.action_type AS last_action_type,
            a.action_at AS last_action_at,
            a.action_by_user_id AS last_action_by_user_id,
            a.note AS last_action_note,
            up.person_id AS last_action_by_person_id,
            p.full_name AS last_action_by_full_name
           FROM ((public.field_log_review_action a
             LEFT JOIN public.user_profile up ON ((up.auth_user_id = a.action_by_user_id)))
             LEFT JOIN public.person p ON ((p.person_id = up.person_id)))
          ORDER BY a.report_id, a.action_at DESC, a.review_action_id DESC
        ), report_identity AS (
         SELECT r_1.report_id,
            COALESCE(r_1.subject_person_id, up.person_id) AS tech_person_id,
            COALESCE(r_1.subject_full_name, p.full_name) AS tech_full_name,
            COALESCE(r_1.subject_tech_id, ta.tech_id) AS tech_id,
            ap.full_name AS approved_by_full_name
           FROM (((((public.field_log_report r_1
             LEFT JOIN public.user_profile up ON ((up.auth_user_id = r_1.created_by_user_id)))
             LEFT JOIN public.person p ON ((p.person_id = up.person_id)))
             LEFT JOIN LATERAL ( SELECT a.tech_id
                   FROM public.assignment a
                  WHERE ((a.person_id = COALESCE(r_1.subject_person_id, up.person_id)) AND (a.pc_org_id = r_1.pc_org_id) AND (a.tech_id IS NOT NULL))
                  ORDER BY
                        CASE
                            WHEN (a.active = true) THEN 0
                            ELSE 1
                        END, COALESCE(a.start_date, '1900-01-01'::date) DESC
                 LIMIT 1) ta ON (true))
             LEFT JOIN public.user_profile aup ON ((aup.auth_user_id = r_1.approval_owner_user_id)))
             LEFT JOIN public.person ap ON ((ap.person_id = aup.person_id)))
        )
 SELECT q.report_id,
    q.status,
    q.category_key,
    q.category_label,
    q.subcategory_key,
    q.subcategory_label,
    q.job_number,
    q.job_type,
    q.created_by_user_id,
    q.submitted_at,
    q.photo_count,
    q.min_photo_count,
    q.evidence_declared,
    q.xm_declared,
    q.xm_link,
    q.xm_link_valid,
    q.approval_owner_user_id,
    q.followup_requested_by_user_id,
    q.locked,
    q.comment,
        CASE
            WHEN (q.xm_declared AND (COALESCE(q.xm_link_valid, false) = true)) THEN 'XM Evidence Verified'::text
            WHEN q.xm_declared THEN 'XM Photo Evidence Declared'::text
            WHEN (q.photo_count > 0) THEN concat('Native Photos ', q.photo_count, '/', q.min_photo_count)
            WHEN ((q.photo_count = 0) AND (q.min_photo_count > 0)) THEN concat('No Evidence 0/', q.min_photo_count)
            ELSE 'No Evidence'::text
        END AS evidence_badge,
    la.last_action_type,
    la.last_action_at,
    la.last_action_by_user_id,
    la.last_action_note,
    q.pc_org_id,
    i.tech_person_id,
    i.tech_full_name,
    i.tech_id,
    i.approved_by_full_name,
    la.last_action_by_person_id,
    la.last_action_by_full_name
   FROM (((public.field_log_review_queue_v q
     LEFT JOIN public.field_log_report r ON ((r.report_id = q.report_id)))
     LEFT JOIN report_identity i ON ((i.report_id = q.report_id)))
     LEFT JOIN last_action la ON ((la.report_id = q.report_id)));


--
-- Name: field_log_rule_context; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.field_log_rule_context (
    rule_context_id uuid DEFAULT gen_random_uuid() NOT NULL,
    config_version_id uuid NOT NULL,
    submission_type_key text NOT NULL,
    job_type text NOT NULL,
    situation_key text NOT NULL,
    situation_label text NOT NULL,
    category_key text NOT NULL,
    subcategory_key text,
    rule_id uuid NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: field_log_rule_contexts_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.field_log_rule_contexts_v AS
 SELECT rc.rule_context_id,
    rc.config_version_id,
    rc.submission_type_key,
    rc.job_type,
    rc.situation_key,
    rc.situation_label,
    rc.category_key,
    c.label AS category_label,
    rc.subcategory_key,
    s.label AS subcategory_label,
    rc.rule_id,
    r.show_subcategory,
    r.require_subcategory,
    r.show_ucode,
    r.require_ucode,
    r.ucode_group_key,
    COALESCE(ug.ucodes_json, '[]'::jsonb) AS ucodes_json,
    r.xm_allowed,
    r.comment_required,
    r.min_photo_count,
    r.location_required,
    r.location_compare_required,
    r.location_tolerance_m,
    r.allow_technician_submit,
    r.allow_supervisor_submit,
    r.active_text_instruction,
    COALESCE(pr.photo_requirements_json, '[]'::jsonb) AS photo_requirements_json,
    rc.sort_order
   FROM ((((((public.field_log_rule_context rc
     JOIN public.field_log_published_config_v p ON ((p.config_version_id = rc.config_version_id)))
     JOIN public.field_log_rule r ON (((r.rule_id = rc.rule_id) AND (r.config_version_id = rc.config_version_id) AND (r.is_active = true))))
     JOIN public.field_log_category c ON (((c.config_version_id = rc.config_version_id) AND (c.category_key = rc.category_key) AND (c.is_active = true))))
     LEFT JOIN public.field_log_subcategory s ON (((s.config_version_id = rc.config_version_id) AND (s.category_key = rc.category_key) AND (NOT (s.subcategory_key IS DISTINCT FROM rc.subcategory_key)) AND (s.is_active = true))))
     LEFT JOIN public.field_log_ucode_groups_v ug ON (((ug.config_version_id = rc.config_version_id) AND (ug.ucode_group_key = r.ucode_group_key))))
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('photo_label_key', x.photo_label_key, 'label', pl.label, 'required', x.required, 'sort_order', x.sort_order) ORDER BY x.sort_order, pl.label) AS photo_requirements_json
           FROM (public.field_log_rule_photo_requirement x
             LEFT JOIN public.field_log_photo_label pl ON (((pl.config_version_id = rc.config_version_id) AND (pl.photo_label_key = x.photo_label_key) AND (pl.is_active = true))))
          WHERE ((x.rule_id = rc.rule_id) AND (x.is_active = true))) pr ON (true))
  WHERE (rc.is_active = true)
  ORDER BY rc.submission_type_key, rc.job_type, rc.sort_order, rc.situation_label;


--
-- Name: field_log_timeline_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.field_log_timeline_v AS
 SELECT e.field_log_event_id,
    e.report_id,
    e.event_at,
    e.event_type,
    e.from_status,
    e.to_status,
    e.actor_user_id,
    e.note,
    e.meta,
    r.job_number,
    r.category_key,
    r.subcategory_key,
    up.person_id AS actor_person_id,
    p.full_name AS actor_full_name
   FROM (((public.field_log_event e
     JOIN public.field_log_report r ON ((r.report_id = e.report_id)))
     LEFT JOIN public.user_profile up ON ((up.auth_user_id = e.actor_user_id)))
     LEFT JOIN public.person p ON ((p.person_id = up.person_id)));


--
-- Name: field_log_u_code; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.field_log_u_code (
    code text NOT NULL,
    label text NOT NULL,
    outcome_class text NOT NULL,
    allow_manual boolean DEFAULT true NOT NULL,
    requires_comment boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: fiscal_month_dim; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fiscal_month_dim (
    fiscal_month_id uuid DEFAULT gen_random_uuid() NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    month_key text NOT NULL,
    label text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT fiscal_month_dim_start_day_chk CHECK ((EXTRACT(day FROM start_date) = (22)::numeric))
);


--
-- Name: TABLE fiscal_month_dim; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.fiscal_month_dim IS 'Canonical fiscal month dimension. Starts on 22nd, ends on 21st. Naming uses end month (month containing the 21st).';


--
-- Name: COLUMN fiscal_month_dim.start_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fiscal_month_dim.start_date IS 'Canonical fiscal month anchor. Always the 22nd.';


--
-- Name: COLUMN fiscal_month_dim.month_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fiscal_month_dim.month_key IS 'Unique key derived from end month: YYYY-MM (Convention 1).';


--
-- Name: COLUMN fiscal_month_dim.label; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fiscal_month_dim.label IS 'Display label derived from end month: e.g., FY2026 January.';


--
-- Name: fuse_onboarding_import_batch; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fuse_onboarding_import_batch (
    batch_id uuid DEFAULT gen_random_uuid() NOT NULL,
    uploaded_by_auth_user_id uuid,
    filename text NOT NULL,
    sheet_name text,
    worksheet_count integer DEFAULT 0 NOT NULL,
    row_count integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'INSPECTED'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: fuse_onboarding_import_row; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fuse_onboarding_import_row (
    row_id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_id uuid NOT NULL,
    row_number integer NOT NULL,
    office_text text,
    company_name text,
    last_name text,
    first_name text,
    tech_id text,
    personnel_id text,
    row_date date,
    raw jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    row_signature text
);


--
-- Name: fuse_onboarding_current_row_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.fuse_onboarding_current_row_v AS
 SELECT DISTINCT ON (r.row_signature) b.batch_id,
    b.filename,
    b.uploaded_by_auth_user_id,
    b.created_at AS uploaded_at,
    r.row_id,
    r.row_number,
    r.row_signature,
    r.row_date,
    r.office_text,
    r.company_name,
    r.last_name,
    r.first_name,
    r.tech_id,
    r.personnel_id,
    r.raw
   FROM (public.fuse_onboarding_import_batch b
     JOIN public.fuse_onboarding_import_row r ON ((r.batch_id = b.batch_id)))
  WHERE (r.row_signature IS NOT NULL)
  ORDER BY r.row_signature, b.created_at DESC, r.row_number;


--
-- Name: fuse_onboarding_grid_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.fuse_onboarding_grid_v AS
 SELECT row_id,
    batch_id,
    filename,
    uploaded_at,
    row_number,
    row_signature,
    row_date,
    office_text,
    company_name,
    last_name,
    first_name,
    concat_ws(', '::text, last_name, first_name) AS display_name,
    tech_id,
    personnel_id,
        CASE
            WHEN ((NULLIF(TRIM(BOTH FROM tech_id), ''::text) IS NOT NULL) AND (upper(TRIM(BOTH FROM tech_id)) <> 'N/A'::text)) THEN 'TECH_ID'::text
            WHEN ((NULLIF(TRIM(BOTH FROM personnel_id), ''::text) IS NOT NULL) AND (upper(TRIM(BOTH FROM personnel_id)) <> 'N/A'::text)) THEN 'PERSONNEL_ID'::text
            ELSE 'NAME'::text
        END AS match_strategy,
        CASE
            WHEN ((NULLIF(TRIM(BOTH FROM tech_id), ''::text) IS NOT NULL) AND (upper(TRIM(BOTH FROM tech_id)) <> 'N/A'::text)) THEN TRIM(BOTH FROM tech_id)
            WHEN ((NULLIF(TRIM(BOTH FROM personnel_id), ''::text) IS NOT NULL) AND (upper(TRIM(BOTH FROM personnel_id)) <> 'N/A'::text)) THEN TRIM(BOTH FROM personnel_id)
            ELSE lower(((((TRIM(BOTH FROM last_name) || '|'::text) || TRIM(BOTH FROM first_name)) || '|'::text) || TRIM(BOTH FROM company_name)))
        END AS match_key,
    raw
   FROM public.fuse_onboarding_current_row_v;


--
-- Name: fuse_onboarding_candidate_current_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.fuse_onboarding_candidate_current_v AS
 SELECT current.row_id,
    current.batch_id,
    current.filename,
    current.uploaded_at,
    current.row_number,
    current.row_signature,
    current.row_date,
    current.office_text,
    current.company_name,
    current.last_name,
    current.first_name,
    current.display_name,
    current.tech_id,
    current.personnel_id,
    current.match_strategy,
    current.match_key,
    current.raw,
    history.snapshot_count,
    history.first_seen,
    history.last_seen
   FROM (( SELECT DISTINCT ON (fuse_onboarding_grid_v.match_key) fuse_onboarding_grid_v.row_id,
            fuse_onboarding_grid_v.batch_id,
            fuse_onboarding_grid_v.filename,
            fuse_onboarding_grid_v.uploaded_at,
            fuse_onboarding_grid_v.row_number,
            fuse_onboarding_grid_v.row_signature,
            fuse_onboarding_grid_v.row_date,
            fuse_onboarding_grid_v.office_text,
            fuse_onboarding_grid_v.company_name,
            fuse_onboarding_grid_v.last_name,
            fuse_onboarding_grid_v.first_name,
            fuse_onboarding_grid_v.display_name,
            fuse_onboarding_grid_v.tech_id,
            fuse_onboarding_grid_v.personnel_id,
            fuse_onboarding_grid_v.match_strategy,
            fuse_onboarding_grid_v.match_key,
            fuse_onboarding_grid_v.raw
           FROM public.fuse_onboarding_grid_v
          ORDER BY fuse_onboarding_grid_v.match_key, fuse_onboarding_grid_v.row_date DESC NULLS LAST, fuse_onboarding_grid_v.row_number DESC) current
     JOIN ( SELECT fuse_onboarding_grid_v.match_key,
            count(*) AS snapshot_count,
            min(fuse_onboarding_grid_v.row_date) AS first_seen,
            max(fuse_onboarding_grid_v.row_date) AS last_seen
           FROM public.fuse_onboarding_grid_v
          GROUP BY fuse_onboarding_grid_v.match_key) history USING (match_key));


--
-- Name: fuse_onboarding_import_row_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.fuse_onboarding_import_row_v AS
 SELECT b.batch_id,
    b.filename,
    b.uploaded_by_auth_user_id,
    b.created_at AS uploaded_at,
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
   FROM (public.fuse_onboarding_import_batch b
     JOIN public.fuse_onboarding_import_row r ON ((r.batch_id = b.batch_id)));


--
-- Name: fuse_onboarding_latest_batch_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.fuse_onboarding_latest_batch_v AS
 SELECT DISTINCT ON (uploaded_by_auth_user_id) batch_id,
    uploaded_by_auth_user_id,
    filename,
    sheet_name,
    worksheet_count,
    row_count,
    status,
    created_at
   FROM public.fuse_onboarding_import_batch
  ORDER BY uploaded_by_auth_user_id, created_at DESC;


--
-- Name: fuse_onboarding_office_rollup_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.fuse_onboarding_office_rollup_v AS
 SELECT office_text,
    count(*) AS candidates,
    count(*) FILTER (WHERE ((raw ->> 'Status'::text) = 'Started'::text)) AS started,
    count(*) FILTER (WHERE ((raw ->> 'Status'::text) = ANY (ARRAY['Badge/Creds Submitted'::text, 'Ready for Badge/Creds'::text]))) AS badge_creds,
    count(*) FILTER (WHERE ((raw ->> 'Status'::text) = ANY (ARRAY['DT Pass/Pending BG'::text, 'Pending D&B'::text, 'Pending DT/BG Pass'::text, 'Drug & Background Sent'::text]))) AS background_pending,
    count(*) FILTER (WHERE ((raw ->> 'Status'::text) = 'Consent Forms Pending Return'::text)) AS consent_pending,
    count(*) FILTER (WHERE ((raw ->> 'Status'::text) = ANY (ARRAY['Not Hiring'::text, 'Not Qualified'::text, 'Terminated'::text]))) AS stopped,
    count(*) FILTER (WHERE (snapshot_count > 1)) AS with_history
   FROM public.fuse_onboarding_candidate_current_v
  GROUP BY office_text;


--
-- Name: locate_cotp_report_row; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.locate_cotp_report_row (
    locate_cotp_report_row_id uuid DEFAULT gen_random_uuid() NOT NULL,
    locate_reporting_record_id uuid NOT NULL,
    state_code text NOT NULL,
    week_ending_value numeric NOT NULL,
    prior_week_value numeric NOT NULL,
    current_week_trend numeric,
    change_points numeric NOT NULL,
    status text NOT NULL,
    prior_week_range text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: locate_daily_call_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.locate_daily_call_log (
    locate_daily_call_log_id uuid DEFAULT gen_random_uuid() NOT NULL,
    log_date date NOT NULL,
    state_code text NOT NULL,
    manpower_count integer DEFAULT 0 NOT NULL,
    tickets_received_am integer DEFAULT 0 NOT NULL,
    tickets_closed_pm integer DEFAULT 0 NOT NULL,
    project_tickets integer DEFAULT 0 NOT NULL,
    emergency_tickets integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    project_received_am integer DEFAULT 0 NOT NULL,
    emergency_received_am integer DEFAULT 0 NOT NULL,
    project_closed_pm integer DEFAULT 0 NOT NULL,
    emergency_closed_pm integer DEFAULT 0 NOT NULL,
    ojc integer DEFAULT 0 NOT NULL,
    CONSTRAINT locate_daily_call_log_nonneg CHECK (((manpower_count >= 0) AND (tickets_received_am >= 0) AND (tickets_closed_pm >= 0) AND (project_received_am >= 0) AND (emergency_received_am >= 0) AND (project_closed_pm >= 0) AND (emergency_closed_pm >= 0)))
);


--
-- Name: locate_state_resource; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.locate_state_resource (
    state_code text NOT NULL,
    state_name text NOT NULL,
    default_manpower integer DEFAULT 0 NOT NULL,
    backlog_seed integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    CONSTRAINT locate_state_resource_backlog_seed_nonneg CHECK ((backlog_seed >= 0)),
    CONSTRAINT locate_state_resource_default_manpower_nonneg CHECK ((default_manpower >= 0))
);


--
-- Name: locate_daily_call_log_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.locate_daily_call_log_v AS
 SELECT t.locate_daily_call_log_id,
    t.log_date,
    t.state_code,
    t.manpower_count,
    t.tickets_received_am,
    t.tickets_closed_pm,
    t.project_tickets,
    t.emergency_tickets,
    t.project_received_am,
    t.emergency_received_am,
    t.project_closed_pm,
    t.emergency_closed_pm,
    t.ojc,
    t.created_at,
    t.updated_at,
    t.created_by,
    t.updated_by,
    s.state_name
   FROM (public.locate_daily_call_log t
     LEFT JOIN public.locate_state_resource s ON ((s.state_code = t.state_code)));


--
-- Name: locate_daily_call_log_v2; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.locate_daily_call_log_v2 AS
 SELECT l.log_date,
    l.state_code,
    sr.state_name,
    l.manpower_count,
    l.ojc,
    l.tickets_received_am,
    l.tickets_closed_pm,
    l.project_tickets,
    l.emergency_tickets,
    COALESCE(sr.backlog_seed, 0) AS backlog_start,
    (((COALESCE(sr.backlog_seed, 0) + COALESCE(l.tickets_received_am, 0)) + COALESCE(l.project_tickets, 0)) - COALESCE(l.tickets_closed_pm, 0)) AS backlog_end,
        CASE
            WHEN (COALESCE(l.manpower_count, 0) > 0) THEN round(((COALESCE(l.tickets_received_am, 0))::numeric / (l.manpower_count)::numeric), 2)
            ELSE (0)::numeric
        END AS avg_received_per_tech,
        CASE
            WHEN (COALESCE(l.manpower_count, 0) > 0) THEN round(((COALESCE(l.tickets_closed_pm, 0))::numeric / (l.manpower_count)::numeric), 2)
            ELSE (0)::numeric
        END AS avg_closed_per_tech,
    l.updated_at
   FROM (public.locate_daily_call_log l
     JOIN public.locate_state_resource sr ON ((sr.state_code = l.state_code)));


--
-- Name: locate_metric_observation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.locate_metric_observation (
    locate_metric_observation_id uuid DEFAULT gen_random_uuid() NOT NULL,
    metric_key text NOT NULL,
    state_code text NOT NULL,
    observation_date date NOT NULL,
    observation_status text NOT NULL,
    numeric_value numeric,
    text_value text,
    source_record_id uuid,
    source_family text DEFAULT 'COTP_HELPER'::text NOT NULL,
    source_as_of_at timestamp with time zone DEFAULT now() NOT NULL,
    raw_context jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT locate_metric_observation_observation_status_check CHECK ((observation_status = ANY (ARRAY['COMPLETED'::text, 'IN_PROGRESS'::text])))
);


--
-- Name: locate_reporting_record; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.locate_reporting_record (
    locate_reporting_record_id uuid DEFAULT gen_random_uuid() NOT NULL,
    report_type text NOT NULL,
    report_date date,
    week_ending_date date,
    inferred_year integer,
    source_text text NOT NULL,
    parsed_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    summary_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by_auth_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    source_as_of_at timestamp with time zone
);


--
-- Name: person_tech_id_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.person_tech_id_history (
    tech_id_history_id uuid DEFAULT gen_random_uuid() NOT NULL,
    pc_org_id uuid NOT NULL,
    person_id uuid NOT NULL,
    tech_id text NOT NULL,
    start_date date NOT NULL,
    end_date date,
    source text DEFAULT 'assignment'::text NOT NULL,
    assignment_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: master_roster_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.master_roster_v AS
 WITH hist AS (
         SELECT DISTINCT ON (h.tech_id) h.tech_id,
            h.person_id
           FROM public.person_tech_id_history h
          WHERE ((h.tech_id IS NOT NULL) AND (h.tech_id <> ''::text))
          ORDER BY h.tech_id, h.created_at DESC
        ), asg AS (
         SELECT DISTINCT ON (a.tech_id) a.tech_id,
            a.person_id,
            a.assignment_id,
            a.position_title,
            a.start_date,
            a.end_date
           FROM public.assignment a
          WHERE ((a.tech_id IS NOT NULL) AND (a.tech_id <> ''::text) AND (a.person_id IS NOT NULL))
          ORDER BY a.tech_id, a.assignment_id DESC
        ), map AS (
         SELECT hist.tech_id,
            hist.person_id,
            NULL::uuid AS assignment_id,
            NULL::text AS position_title,
            NULL::date AS start_date,
            NULL::date AS end_date
           FROM hist
        UNION ALL
         SELECT asg.tech_id,
            asg.person_id,
            asg.assignment_id,
            asg.position_title,
            asg.start_date,
            asg.end_date
           FROM asg
        ), dedup AS (
         SELECT DISTINCT ON (map.tech_id) map.tech_id,
            map.person_id,
            map.assignment_id,
            map.position_title,
            map.start_date,
            map.end_date
           FROM map
          ORDER BY map.tech_id, (map.assignment_id IS NOT NULL) DESC
        )
 SELECT d.tech_id,
    d.person_id,
    d.assignment_id,
    p.full_name,
    d.position_title,
    d.start_date,
    d.end_date,
        CASE
            WHEN (d.assignment_id IS NULL) THEN false
            WHEN (d.end_date IS NULL) THEN true
            WHEN (d.end_date >= CURRENT_DATE) THEN true
            ELSE false
        END AS assignment_active,
    NULL::uuid AS reports_to_assignment_id,
    NULL::uuid AS reports_to_person_id
   FROM (dedup d
     LEFT JOIN public.person p ON ((p.person_id = d.person_id)));


--
-- Name: master_roster_v_base; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.master_roster_v_base AS
 SELECT tech_id,
    person_id
   FROM public.master_roster_v;


--
-- Name: metric_batches_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.metric_batches_v AS
 SELECT metric_batch_id,
    workspace_id,
    metric_date,
    fiscal_end_date,
    row_count,
    status,
    source_filename,
    source_title,
    source_generated_at,
    warning_flags,
    created_at
   FROM core.metric_batches;


--
-- Name: v_contractor_workspace_assignment; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_contractor_workspace_assignment AS
 SELECT ca.contractor_assignment_id,
    ca.contractor_id,
    c.contractor_name,
    c.contractor_code,
    ca.pc_org_id,
    pc.pc_org_name,
    pc.region_id,
    cw.workspace_id,
    cw.workspace_key,
    cw.workspace_name,
    cw.status AS workspace_status,
    ca.start_date,
    ca.end_date,
    ((ca.start_date <= CURRENT_DATE) AND ((ca.end_date IS NULL) OR (ca.end_date >= CURRENT_DATE))) AS active
   FROM (((public.contractor_assignment ca
     LEFT JOIN public.contractor c ON ((c.contractor_id = ca.contractor_id)))
     LEFT JOIN public.pc_org pc ON ((pc.pc_org_id = ca.pc_org_id)))
     LEFT JOIN core.workspaces cw ON ((cw.legacy_pc_org_id = ca.pc_org_id)));


--
-- Name: metric_ownership_resolution_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.metric_ownership_resolution_v AS
 WITH metric_subjects AS (
         SELECT DISTINCT msf.metric_batch_id,
            msf.workspace_id,
            msf.profile_key,
            msf.metric_date,
            msf.fiscal_end_date,
            upper(TRIM(BOTH FROM msf.tech_id)) AS tech_id
           FROM core.metric_scores_fact msf
          WHERE (NULLIF(TRIM(BOTH FROM msf.tech_id), ''::text) IS NOT NULL)
        ), person_by_tech AS (
         SELECT DISTINCT ON ((upper(TRIM(BOTH FROM pi.identifier_value)))) upper(TRIM(BOTH FROM pi.identifier_value)) AS tech_id,
            pi.person_id
           FROM core.person_identifiers pi
          WHERE ((pi.identifier_type = 'TECH_ID'::text) AND (NULLIF(TRIM(BOTH FROM pi.identifier_value), ''::text) IS NOT NULL))
          ORDER BY (upper(TRIM(BOTH FROM pi.identifier_value))), pi.is_primary DESC, pi.updated_at DESC NULLS LAST, pi.created_at DESC NULLS LAST
        )
 SELECT ms.metric_batch_id,
    ms.workspace_id,
    ms.profile_key,
    ms.metric_date,
    ms.fiscal_end_date,
    ms.tech_id,
    p.person_id,
    p.full_name,
    p.status AS person_status,
    p.prospecting_affiliation_id,
    cwa.contractor_id,
    cwa.contractor_name,
    cwa.contractor_code,
    cwa.pc_org_id,
    cwa.pc_org_name,
        CASE
            WHEN (p.person_id IS NULL) THEN 'missing_person'::text
            WHEN (cwa.contractor_id IS NULL) THEN 'missing_workspace_owner'::text
            ELSE 'resolved'::text
        END AS resolution_status,
        CASE
            WHEN (p.person_id IS NULL) THEN true
            WHEN (cwa.contractor_id IS NULL) THEN true
            WHEN (p.prospecting_affiliation_id IS NULL) THEN true
            ELSE false
        END AS has_resolution_warning,
        CASE
            WHEN (p.person_id IS NULL) THEN 'missing_person'::text
            WHEN (cwa.contractor_id IS NULL) THEN 'missing_workspace_owner'::text
            WHEN (p.prospecting_affiliation_id IS NULL) THEN 'missing_person_affiliation'::text
            ELSE NULL::text
        END AS warning_reason
   FROM (((metric_subjects ms
     LEFT JOIN person_by_tech pbt ON ((pbt.tech_id = ms.tech_id)))
     LEFT JOIN core.people p ON ((p.person_id = pbt.person_id)))
     LEFT JOIN LATERAL ( SELECT v.contractor_id,
            v.contractor_name,
            v.contractor_code,
            v.pc_org_id,
            v.pc_org_name
           FROM public.v_contractor_workspace_assignment v
          WHERE ((v.workspace_id = ms.workspace_id) AND (ms.metric_date >= v.start_date) AND ((v.end_date IS NULL) OR (ms.metric_date <= v.end_date)))
          ORDER BY v.active DESC, v.start_date DESC
         LIMIT 1) cwa ON (true));


--
-- Name: metric_payload_flat_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.metric_payload_flat_v AS
 SELECT p.metric_row_id,
    p.metric_batch_id,
    p.workspace_id,
    p.tech_id,
    p.metric_date,
    p.fiscal_end_date,
    p.promoters,
    p.detractors,
    p.tnps_surveys,
    p.total_ftr_contact_jobs,
    p.ftr_fail_jobs,
    p.tu_eligible_jobs,
    p.tu_result,
    p.contact_48hr_orders,
    p.pht_jobs,
    p.pht_pure_pass,
    p.total_appts,
    p.total_met_appts,
    p.repeat_count,
    p.rework_count,
    p.soi_count,
    p.installs,
    p.tcs,
    p.sros,
    p.total_jobs,
    p.tnps_score,
    p.ftr_rate,
    p.tool_usage_rate,
    p.contact_48hr_rate,
    p.pht_pure_pass_rate,
    p.met_rate,
    p.repeat_rate,
    p.rework_rate,
    p.soi_rate,
    w.legacy_pc_org_id AS pc_org_id
   FROM (core.metric_payload_flat_v p
     JOIN core.workspaces w ON ((w.workspace_id = p.workspace_id)));


--
-- Name: metric_pc_org_total_rows_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.metric_pc_org_total_rows_v AS
 SELECT NULL::uuid AS id,
    b.metric_batch_id AS batch_id,
    w.legacy_pc_org_id AS pc_org_id,
    b.metric_date,
    b.fiscal_end_date,
    'pc_org_total'::text AS summary_type,
    (w.legacy_pc_org_id)::text AS summary_key,
    'Org Total'::text AS summary_label,
    concat((b.metric_batch_id)::text, ':pc_org_total:', (w.legacy_pc_org_id)::text) AS unique_row_key,
    jsonb_build_object('TechId', 'Org Total', 'Promoters', COALESCE(sum(p.promoters), (0)::numeric), 'Detractors', COALESCE(sum(p.detractors), (0)::numeric), 'tNPS Surveys', COALESCE(sum(p.tnps_surveys), (0)::numeric), 'tNPS Rate',
        CASE
            WHEN (COALESCE(sum(p.tnps_surveys), (0)::numeric) = (0)::numeric) THEN (0)::numeric
            ELSE (((COALESCE(sum(p.promoters), (0)::numeric) - COALESCE(sum(p.detractors), (0)::numeric)) / NULLIF(sum(p.tnps_surveys), (0)::numeric)) * (100)::numeric)
        END, 'Total FTR/Contact Jobs', COALESCE(sum(p.total_ftr_contact_jobs), (0)::numeric), 'FTRFailJobs', COALESCE(sum(p.ftr_fail_jobs), (0)::numeric), 'FTR%',
        CASE
            WHEN (COALESCE(sum(p.total_ftr_contact_jobs), (0)::numeric) = (0)::numeric) THEN (0)::numeric
            ELSE (((COALESCE(sum(p.total_ftr_contact_jobs), (0)::numeric) - COALESCE(sum(p.ftr_fail_jobs), (0)::numeric)) / NULLIF(sum(p.total_ftr_contact_jobs), (0)::numeric)) * (100)::numeric)
        END, 'TUEligibleJobs', COALESCE(sum(p.tu_eligible_jobs), (0)::numeric), 'TUResult', COALESCE(sum(p.tu_result), (0)::numeric), 'ToolUsage',
        CASE
            WHEN (COALESCE(sum(p.tu_eligible_jobs), (0)::numeric) = (0)::numeric) THEN (0)::numeric
            ELSE ((COALESCE(sum(p.tu_result), (0)::numeric) / NULLIF(sum(p.tu_eligible_jobs), (0)::numeric)) * (100)::numeric)
        END, '48Hr Contact Orders', COALESCE(sum(p.contact_48hr_orders), (0)::numeric), '48Hr Contact Rate%',
        CASE
            WHEN ((COALESCE(sum(p.installs), (0)::numeric) + COALESCE(sum(p.tcs), (0)::numeric)) = (0)::numeric) THEN (0)::numeric
            ELSE ((COALESCE(sum(p.contact_48hr_orders), (0)::numeric) / NULLIF((COALESCE(sum(p.installs), (0)::numeric) + COALESCE(sum(p.tcs), (0)::numeric)), (0)::numeric)) * (100)::numeric)
        END, 'PHT Jobs', COALESCE(sum(p.pht_jobs), (0)::numeric), 'PHT Pure Pass', COALESCE(sum(p.pht_pure_pass), (0)::numeric), 'PHT Pure Pass%',
        CASE
            WHEN (COALESCE(sum(p.pht_jobs), (0)::numeric) = (0)::numeric) THEN (0)::numeric
            ELSE ((COALESCE(sum(p.pht_pure_pass), (0)::numeric) / NULLIF(sum(p.pht_jobs), (0)::numeric)) * (100)::numeric)
        END, 'TotalAppts', COALESCE(sum(p.total_appts), (0)::numeric), 'TotalMetAppts', COALESCE(sum(p.total_met_appts), (0)::numeric), 'MetRate',
        CASE
            WHEN (COALESCE(sum(p.total_appts), (0)::numeric) = (0)::numeric) THEN (0)::numeric
            ELSE ((COALESCE(sum(p.total_met_appts), (0)::numeric) / NULLIF(sum(p.total_appts), (0)::numeric)) * (100)::numeric)
        END, 'Repeat Count', COALESCE(sum(p.repeat_count), (0)::numeric), 'Repeat Rate%',
        CASE
            WHEN (COALESCE(sum(p.tcs), (0)::numeric) = (0)::numeric) THEN (0)::numeric
            ELSE ((COALESCE(sum(p.repeat_count), (0)::numeric) / NULLIF(sum(p.tcs), (0)::numeric)) * (100)::numeric)
        END, 'Rework Count', COALESCE(sum(p.rework_count), (0)::numeric), 'Rework Rate%',
        CASE
            WHEN ((COALESCE(sum(p.installs), (0)::numeric) + COALESCE(sum(p.tcs), (0)::numeric)) = (0)::numeric) THEN (0)::numeric
            ELSE ((COALESCE(sum(p.rework_count), (0)::numeric) / NULLIF((COALESCE(sum(p.installs), (0)::numeric) + COALESCE(sum(p.tcs), (0)::numeric)), (0)::numeric)) * (100)::numeric)
        END, 'SOI Count', COALESCE(sum(p.soi_count), (0)::numeric), 'SOI Rate%',
        CASE
            WHEN (COALESCE(sum(p.installs), (0)::numeric) = (0)::numeric) THEN (0)::numeric
            ELSE ((COALESCE(sum(p.soi_count), (0)::numeric) / NULLIF(sum(p.installs), (0)::numeric)) * (100)::numeric)
        END, 'Installs', COALESCE(sum(p.installs), (0)::numeric), 'TCs', COALESCE(sum(p.tcs), (0)::numeric), 'SROs', COALESCE(sum(p.sros), (0)::numeric), 'Total Jobs', COALESCE(sum(p.total_jobs), (0)::numeric)) AS raw,
    NULL::timestamp with time zone AS inserted_at
   FROM ((core.metric_payload_flat_v p
     JOIN core.metric_batches b ON ((b.metric_batch_id = p.metric_batch_id)))
     JOIN core.workspaces w ON ((w.workspace_id = b.workspace_id)))
  WHERE (w.legacy_pc_org_id IS NOT NULL)
  GROUP BY b.metric_batch_id, w.legacy_pc_org_id, b.metric_date, b.fiscal_end_date;


--
-- Name: metric_profile_composites_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.metric_profile_composites_v AS
 SELECT metric_batch_id,
    workspace_id,
    metric_date,
    fiscal_end_date,
    tech_id,
    profile_key,
    profile_label,
    composite_score,
    contributing_kpi_count,
    tiebreak_value,
    is_rank_eligible,
    eligibility_reason
   FROM core.metric_profile_composites_v;


--
-- Name: metric_profile_kpis_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.metric_profile_kpis_v AS
 SELECT profile_key,
    profile_label,
    metric_profile_rule_id,
    metric_profile_id,
    metric_key,
    metric_label,
    customer_label,
    display_label,
    raw_label_identifier,
    raw_inputs,
    direction,
    unit,
    min_value,
    max_value,
    rubric_json,
    weight,
    sort_order,
    report_order,
    is_visible,
    is_enabled,
    is_tiebreaker,
    no_data_behavior,
    metric_is_active,
    profile_is_active
   FROM core.metric_profile_kpis_v;


--
-- Name: metric_profile_ranks_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.metric_profile_ranks_v AS
 SELECT metric_batch_id,
    workspace_id,
    metric_date,
    fiscal_end_date,
    tech_id,
    profile_key,
    profile_label,
    composite_score,
    contributing_kpi_count,
    tiebreak_value,
    is_rank_eligible,
    eligibility_reason,
    rank_in_profile
   FROM core.metric_profile_ranks_v;


--
-- Name: metric_raw_batches_compat_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.metric_raw_batches_compat_v AS
 SELECT mb.metric_batch_id AS batch_id,
    w.legacy_pc_org_id AS pc_org_id,
    mb.metric_date,
    mb.fiscal_end_date,
    mb.status,
    mb.row_count,
    mb.created_at AS uploaded_at,
    mb.created_at AS inserted_at,
    mb.source_filename,
    mb.source_title,
    mb.source_generated_at,
    mb.warning_flags,
    mb.metric_batch_id
   FROM (core.metric_batches mb
     JOIN core.workspaces w ON ((w.workspace_id = mb.workspace_id)))
  WHERE (w.legacy_pc_org_id IS NOT NULL);


--
-- Name: metric_raw_rows_compat_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.metric_raw_rows_compat_v AS
 SELECT mr.metric_row_id AS id,
    mr.metric_batch_id AS batch_id,
    w.legacy_pc_org_id AS pc_org_id,
    mr.metric_date,
    mr.fiscal_end_date,
    mr.reported_tech_id AS tech_id,
    concat((mr.metric_batch_id)::text, ':', mr.reported_tech_id) AS unique_row_key,
    jsonb_build_object('TechId', mr.reported_tech_id, 'Promoters', p.promoters, 'Detractors', p.detractors, 'tNPS Surveys', p.tnps_surveys, 'tNPS Rate', p.tnps_score, 'Total FTR/Contact Jobs', p.total_ftr_contact_jobs, 'FTRFailJobs', p.ftr_fail_jobs, 'FTR%', p.ftr_rate, 'TUEligibleJobs', p.tu_eligible_jobs, 'TUResult', p.tu_result, 'ToolUsage', p.tool_usage_rate, '48Hr Contact Orders', p.contact_48hr_orders, '48Hr Contact Rate%', p.contact_48hr_rate, 'PHT Jobs', p.pht_jobs, 'PHT Pure Pass', p.pht_pure_pass, 'PHT Pure Pass%', p.pht_pure_pass_rate, 'TotalAppts', p.total_appts, 'TotalMetAppts', p.total_met_appts, 'MetRate', p.met_rate, 'Repeat Count', p.repeat_count, 'Repeat Rate%', p.repeat_rate, 'Rework Count', p.rework_count, 'Rework Rate%', p.rework_rate, 'SOI Count', p.soi_count, 'SOI Rate%', p.soi_rate, 'Installs', p.installs, 'TCs', p.tcs, 'SROs', p.sros, 'Total Jobs', p.total_jobs) AS raw,
    mr.created_at AS inserted_at,
    mr.metric_batch_id
   FROM ((core.metric_rows mr
     JOIN core.metric_payload_flat_v p ON ((p.metric_row_id = mr.metric_row_id)))
     JOIN core.workspaces w ON ((w.workspace_id = mr.workspace_id)))
  WHERE (w.legacy_pc_org_id IS NOT NULL);


--
-- Name: metric_ready_batches_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.metric_ready_batches_v AS
 SELECT mb.metric_batch_id,
    mb.metric_date,
    mb.fiscal_end_date,
    mb.source_title,
    mb.source_filename,
    mb.source_generated_at,
    mb.status,
    mb.row_count,
    mb.created_at,
    mb.updated_at,
    w.legacy_pc_org_id AS pc_org_id,
    count(msf.*) AS fact_row_count
   FROM ((core.metric_batches mb
     JOIN core.workspaces w ON ((w.workspace_id = mb.workspace_id)))
     JOIN core.metric_scores_fact msf ON ((msf.metric_batch_id = mb.metric_batch_id)))
  WHERE ((w.legacy_pc_org_id IS NOT NULL) AND (mb.status = 'complete'::text) AND (mb.row_count > 0))
  GROUP BY mb.metric_batch_id, mb.metric_date, mb.fiscal_end_date, mb.source_title, mb.source_filename, mb.source_generated_at, mb.status, mb.row_count, mb.created_at, mb.updated_at, w.legacy_pc_org_id;


--
-- Name: metric_scores_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.metric_scores_v AS
 SELECT metric_batch_id,
    workspace_id,
    metric_date,
    fiscal_end_date,
    tech_id,
    profile_key,
    profile_label,
    metric_profile_id,
    metric_profile_rule_id,
    metric_key,
    display_label,
    weight,
    sort_order,
    report_order,
    is_tiebreaker,
    is_visible,
    no_data_behavior,
    direction,
    unit,
    numerator,
    denominator,
    metric_value,
    band_key,
    normalized_value,
    weighted_points,
    is_rank_eligible,
    eligibility_reason,
    created_at
   FROM core.metric_scores_fact;


--
-- Name: metric_subject_composites_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.metric_subject_composites_v AS
 SELECT subject_key,
    metric_batch_id,
    legacy_batch_id,
    workspace_id,
    pc_org_id,
    metric_date,
    fiscal_end_date,
    person_id,
    full_name,
    person_active,
    person_role,
    co_ref_id,
    co_code,
    affiliation_type,
    assignment_id,
    tech_id,
    reports_to_person_id,
    position_title,
    row_kind,
    is_totals_row,
    row_presence,
    match_status,
    profile_key,
    profile_label,
    composite_score,
    contributing_kpi_count,
    tiebreak_value,
    rank_in_profile,
    is_rank_eligible,
    eligibility_reason,
    subject_state,
    office_label
   FROM core.metric_subject_composites_v;


--
-- Name: metric_subject_scores_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.metric_subject_scores_v AS
 SELECT subject_key,
    metric_batch_id,
    legacy_batch_id,
    workspace_id,
    pc_org_id,
    metric_date,
    fiscal_end_date,
    person_id,
    full_name,
    person_active,
    person_role,
    co_ref_id,
    co_code,
    affiliation_type,
    assignment_id,
    tech_id,
    reports_to_person_id,
    position_title,
    row_kind,
    is_totals_row,
    row_presence,
    match_status,
    profile_key,
    profile_label,
    metric_profile_id,
    metric_profile_rule_id,
    metric_key,
    metric_label,
    display_label,
    weight,
    sort_order,
    report_order,
    is_tiebreaker,
    is_visible,
    is_enabled,
    no_data_behavior,
    direction,
    unit,
    numerator,
    denominator,
    metric_value,
    band_key,
    normalized_value,
    weighted_points,
    is_rank_eligible,
    eligibility_reason,
    render_band_key
   FROM core.metric_subject_scores_v;


--
-- Name: metric_total_rows_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.metric_total_rows_v AS
 SELECT mtr.metric_total_row_id AS id,
    mtr.metric_batch_id AS batch_id,
    w.legacy_pc_org_id AS pc_org_id,
    mtr.workspace_id,
    mtr.metric_date,
    mtr.fiscal_end_date,
    mtr.summary_type,
    mtr.summary_key,
    mtr.summary_label,
    mtr.unique_row_key,
    mtr.raw,
    mtr.created_at AS inserted_at,
    mb.source_title,
    mb.source_filename,
    mb.source_generated_at,
    mb.created_at AS batch_created_at,
    mb.status,
    mb.row_count
   FROM ((core.metric_total_rows mtr
     JOIN core.metric_batches mb ON ((mb.metric_batch_id = mtr.metric_batch_id)))
     JOIN core.workspaces w ON ((w.workspace_id = mtr.workspace_id)))
  WHERE (w.legacy_pc_org_id IS NOT NULL);


--
-- Name: metric_upload_batches_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.metric_upload_batches_v AS
 SELECT mb.metric_batch_id,
    mb.metric_date,
    mb.fiscal_end_date,
    mb.row_count,
    mb.created_at,
    mb.status,
    mb.source_filename,
    mb.source_title,
    mb.source_generated_at,
    mb.warning_flags,
    w.legacy_pc_org_id AS pc_org_id,
    COALESCE(r.fact_row_count, (0)::bigint) AS fact_row_count
   FROM ((core.metric_batches mb
     JOIN core.workspaces w ON ((w.workspace_id = mb.workspace_id)))
     LEFT JOIN ( SELECT metric_scores_fact.metric_batch_id,
            count(*) AS fact_row_count
           FROM core.metric_scores_fact
          GROUP BY metric_scores_fact.metric_batch_id) r ON ((r.metric_batch_id = mb.metric_batch_id)))
  WHERE (w.legacy_pc_org_id IS NOT NULL);


--
-- Name: metric_workspaces_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.metric_workspaces_v AS
 SELECT workspace_id,
    workspace_key,
    workspace_name,
    legacy_pc_org_id
   FROM core.workspaces;


--
-- Name: metrics_class_kpi_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.metrics_class_kpi_config (
    class_type text NOT NULL,
    kpi_key text NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    weight numeric DEFAULT 0 NOT NULL,
    threshold_value numeric,
    stretch_value numeric,
    exceeds_min numeric,
    exceeds_max numeric,
    meets_min numeric,
    meets_max numeric,
    needs_improvement_min numeric,
    needs_improvement_max numeric,
    misses_min numeric,
    misses_max numeric,
    no_data_behavior text DEFAULT 'EXCLUDE_FROM_TOTAL'::text NOT NULL,
    no_data_default_score numeric,
    exceeds_score numeric,
    meets_score numeric,
    needs_improvement_score numeric,
    misses_score numeric,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    grade_value numeric,
    sort_order integer,
    report_order integer,
    is_tiebreaker boolean DEFAULT false NOT NULL,
    display_label text,
    report_visible boolean DEFAULT true NOT NULL,
    CONSTRAINT metrics_class_kpi_config_no_data_behavior_chk CHECK ((no_data_behavior = ANY (ARRAY['EXCLUDE_FROM_TOTAL'::text, 'SCORE_AS_ZERO'::text, 'SCORE_AS_MISSES'::text, 'USE_DEFAULT'::text]))),
    CONSTRAINT metrics_class_kpi_config_sort_order_nonneg CHECK (((sort_order IS NULL) OR (sort_order >= 0)))
);


--
-- Name: metrics_kpi_def; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.metrics_kpi_def (
    kpi_key text NOT NULL,
    label text NOT NULL,
    customer_label text,
    raw_label_identifier text,
    raw_inputs jsonb,
    direction text NOT NULL,
    unit text NOT NULL,
    min_value numeric,
    max_value numeric,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT metrics_kpi_def_direction_chk CHECK ((direction = ANY (ARRAY['HIGHER_BETTER'::text, 'LOWER_BETTER'::text]))),
    CONSTRAINT metrics_kpi_def_unit_chk CHECK ((unit = ANY (ARRAY['pct'::text, 'count'::text, 'score'::text, 'number'::text])))
);


--
-- Name: metrics_kpi_rubric; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.metrics_kpi_rubric (
    pc_org_id uuid,
    kpi_key text NOT NULL,
    band_key text NOT NULL,
    min_value numeric,
    max_value numeric,
    score_value numeric,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    CONSTRAINT metrics_kpi_rubric_band_key_chk CHECK ((band_key = ANY (ARRAY['EXCEEDS'::text, 'MEETS'::text, 'NEEDS_IMPROVEMENT'::text, 'MISSES'::text, 'NO_DATA'::text]))),
    CONSTRAINT metrics_kpi_rubric_global_only_chk CHECK ((pc_org_id IS NULL))
);


--
-- Name: metrics_admin_kpi_surface_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.metrics_admin_kpi_surface_v AS
 WITH rub AS (
         SELECT r.kpi_key,
            max(r.min_value) FILTER (WHERE (r.band_key = 'EXCEEDS'::text)) AS exceeds_min,
            max(r.max_value) FILTER (WHERE (r.band_key = 'EXCEEDS'::text)) AS exceeds_max,
            max(r.score_value) FILTER (WHERE (r.band_key = 'EXCEEDS'::text)) AS exceeds_score,
            max(r.min_value) FILTER (WHERE (r.band_key = 'MEETS'::text)) AS meets_min,
            max(r.max_value) FILTER (WHERE (r.band_key = 'MEETS'::text)) AS meets_max,
            max(r.score_value) FILTER (WHERE (r.band_key = 'MEETS'::text)) AS meets_score,
            max(r.min_value) FILTER (WHERE (r.band_key = 'NEEDS_IMPROVEMENT'::text)) AS needs_improvement_min,
            max(r.max_value) FILTER (WHERE (r.band_key = 'NEEDS_IMPROVEMENT'::text)) AS needs_improvement_max,
            max(r.score_value) FILTER (WHERE (r.band_key = 'NEEDS_IMPROVEMENT'::text)) AS needs_improvement_score,
            max(r.min_value) FILTER (WHERE (r.band_key = 'MISSES'::text)) AS misses_min,
            max(r.max_value) FILTER (WHERE (r.band_key = 'MISSES'::text)) AS misses_max,
            max(r.score_value) FILTER (WHERE (r.band_key = 'MISSES'::text)) AS misses_score,
            max(r.score_value) FILTER (WHERE (r.band_key = 'NO_DATA'::text)) AS no_data_default_score
           FROM public.metrics_kpi_rubric r
          WHERE ((r.pc_org_id IS NULL) AND (r.is_active = true))
          GROUP BY r.kpi_key
        )
 SELECT cfg.class_type,
    cfg.kpi_key,
    def.customer_label,
    def.raw_label_identifier,
    def.direction,
    cfg.enabled,
    cfg.weight,
    cfg.grade_value,
    cfg.sort_order,
    cfg.report_order,
    cfg.report_visible,
    cfg.is_tiebreaker,
    cfg.no_data_behavior,
    COALESCE(rub.no_data_default_score, cfg.no_data_default_score) AS no_data_default_score,
    rub.exceeds_min,
    rub.exceeds_max,
    COALESCE(rub.exceeds_score, cfg.exceeds_score) AS exceeds_score,
    rub.meets_min,
    rub.meets_max,
    COALESCE(rub.meets_score, cfg.meets_score) AS meets_score,
    rub.needs_improvement_min,
    rub.needs_improvement_max,
    COALESCE(rub.needs_improvement_score, cfg.needs_improvement_score) AS needs_improvement_score,
    rub.misses_min,
    rub.misses_max,
    COALESCE(rub.misses_score, cfg.misses_score) AS misses_score
   FROM ((public.metrics_class_kpi_config cfg
     JOIN public.metrics_kpi_def def ON ((def.kpi_key = cfg.kpi_key)))
     LEFT JOIN rub ON ((rub.kpi_key = cfg.kpi_key)));


--
-- Name: metrics_band_style_selection; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.metrics_band_style_selection (
    preset_key text NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    selection_key text DEFAULT 'GLOBAL'::text NOT NULL
);


--
-- Name: metrics_class_kpi_rubric; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.metrics_class_kpi_rubric (
    class_type text NOT NULL,
    kpi_key text NOT NULL,
    band_key text NOT NULL,
    min_value numeric,
    max_value numeric,
    score_value numeric,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone
);


--
-- Name: metrics_class_kpi_scoring_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.metrics_class_kpi_scoring_v AS
 SELECT cfg.class_type,
    cfg.kpi_key,
    def.label,
    def.customer_label,
    def.raw_label_identifier,
    def.direction,
    def.unit,
    cfg.enabled,
    cfg.weight,
    cfg.no_data_behavior,
    cfg.no_data_default_score,
    cfg.grade_value,
    cfg.sort_order,
    cfg.report_order,
    cfg.report_visible,
    cfg.is_tiebreaker,
    cfg.display_label,
    rub.band_key,
    rub.min_value AS band_min_value,
    rub.max_value AS band_max_value,
    rub.score_value AS band_score_value
   FROM ((public.metrics_class_kpi_config cfg
     JOIN public.metrics_kpi_def def ON ((def.kpi_key = cfg.kpi_key)))
     LEFT JOIN public.metrics_class_kpi_rubric rub ON (((rub.class_type = cfg.class_type) AND (rub.kpi_key = cfg.kpi_key))));


--
-- Name: metrics_color_preset; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.metrics_color_preset (
    preset_key text NOT NULL,
    is_active boolean DEFAULT false
);


--
-- Name: metrics_kpi_compute; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.metrics_kpi_compute (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_id uuid NOT NULL,
    pc_org_id uuid NOT NULL,
    metric_date date NOT NULL,
    fiscal_end_date date NOT NULL,
    mso_id uuid,
    class_type text NOT NULL,
    tech_id text NOT NULL,
    kpi_key text NOT NULL,
    raw_label_identifier text NOT NULL,
    direction text DEFAULT 'HIGHER_BETTER'::text NOT NULL,
    metric_value numeric,
    inside_rank integer,
    n_with_value integer DEFAULT 0 NOT NULL,
    rank_score numeric,
    weight_percent numeric DEFAULT 0 NOT NULL,
    grade_value numeric DEFAULT 0 NOT NULL,
    weighted_points numeric DEFAULT 0 NOT NULL,
    band_key text DEFAULT 'NO_DATA'::text NOT NULL,
    computed_at timestamp with time zone DEFAULT now() NOT NULL,
    normalized_score numeric,
    included_in_total boolean DEFAULT true NOT NULL,
    score_source text DEFAULT 'VALUE_BASED'::text,
    CONSTRAINT metrics_kpi_compute_class_type_check CHECK ((upper(class_type) = ANY (ARRAY['NSR'::text, 'SMART'::text, 'TECH'::text]))),
    CONSTRAINT metrics_kpi_compute_direction_check CHECK ((direction = ANY (ARRAY['HIGHER_BETTER'::text, 'LOWER_BETTER'::text])))
);


--
-- Name: metrics_composite_score_current_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.metrics_composite_score_current_v AS
 WITH latest_metric_date AS (
         SELECT metrics_kpi_compute.pc_org_id,
            metrics_kpi_compute.fiscal_end_date,
            metrics_kpi_compute.class_type,
            max(metrics_kpi_compute.metric_date) AS metric_date
           FROM public.metrics_kpi_compute
          GROUP BY metrics_kpi_compute.pc_org_id, metrics_kpi_compute.fiscal_end_date, metrics_kpi_compute.class_type
        ), current_kpi AS (
         SELECT q.id,
            q.batch_id,
            q.pc_org_id,
            q.metric_date,
            q.fiscal_end_date,
            q.mso_id,
            q.class_type,
            q.tech_id,
            q.kpi_key,
            q.raw_label_identifier,
            q.direction,
            q.metric_value,
            q.inside_rank,
            q.n_with_value,
            q.rank_score,
            q.weight_percent,
            q.grade_value,
            q.weighted_points,
            q.band_key,
            q.computed_at,
            q.normalized_score,
            q.included_in_total,
            q.score_source,
            q.kpi_rn
           FROM ( SELECT c.id,
                    c.batch_id,
                    c.pc_org_id,
                    c.metric_date,
                    c.fiscal_end_date,
                    c.mso_id,
                    c.class_type,
                    c.tech_id,
                    c.kpi_key,
                    c.raw_label_identifier,
                    c.direction,
                    c.metric_value,
                    c.inside_rank,
                    c.n_with_value,
                    c.rank_score,
                    c.weight_percent,
                    c.grade_value,
                    c.weighted_points,
                    c.band_key,
                    c.computed_at,
                    c.normalized_score,
                    c.included_in_total,
                    c.score_source,
                    row_number() OVER (PARTITION BY c.pc_org_id, c.fiscal_end_date, c.metric_date, c.class_type, c.tech_id, c.kpi_key ORDER BY c.computed_at DESC, c.batch_id DESC) AS kpi_rn
                   FROM (public.metrics_kpi_compute c
                     JOIN latest_metric_date l ON (((l.pc_org_id = c.pc_org_id) AND (l.fiscal_end_date = c.fiscal_end_date) AND (l.class_type = c.class_type) AND (l.metric_date = c.metric_date))))) q
          WHERE (q.kpi_rn = 1)
        ), tech_latest AS (
         SELECT q.id,
            q.batch_id,
            q.pc_org_id,
            q.metric_date,
            q.fiscal_end_date,
            q.mso_id,
            q.class_type,
            q.tech_id,
            q.kpi_key,
            q.raw_label_identifier,
            q.direction,
            q.metric_value,
            q.inside_rank,
            q.n_with_value,
            q.rank_score,
            q.weight_percent,
            q.grade_value,
            q.weighted_points,
            q.band_key,
            q.computed_at,
            q.normalized_score,
            q.included_in_total,
            q.score_source,
            q.kpi_rn,
            q.tech_rn
           FROM ( SELECT c.id,
                    c.batch_id,
                    c.pc_org_id,
                    c.metric_date,
                    c.fiscal_end_date,
                    c.mso_id,
                    c.class_type,
                    c.tech_id,
                    c.kpi_key,
                    c.raw_label_identifier,
                    c.direction,
                    c.metric_value,
                    c.inside_rank,
                    c.n_with_value,
                    c.rank_score,
                    c.weight_percent,
                    c.grade_value,
                    c.weighted_points,
                    c.band_key,
                    c.computed_at,
                    c.normalized_score,
                    c.included_in_total,
                    c.score_source,
                    c.kpi_rn,
                    row_number() OVER (PARTITION BY c.pc_org_id, c.fiscal_end_date, c.metric_date, c.class_type, c.tech_id ORDER BY c.computed_at DESC, c.batch_id DESC) AS tech_rn
                   FROM current_kpi c) q
          WHERE (q.tech_rn = 1)
        ), tiebreak_cfg AS (
         SELECT metrics_class_kpi_config.class_type,
            metrics_class_kpi_config.kpi_key AS tiebreaker_kpi_key
           FROM public.metrics_class_kpi_config
          WHERE (metrics_class_kpi_config.is_tiebreaker = true)
        ), rollup AS (
         SELECT c.pc_org_id,
            c.fiscal_end_date,
            c.metric_date,
            c.class_type,
            c.tech_id,
            round(sum(
                CASE
                    WHEN c.included_in_total THEN c.weighted_points
                    ELSE (0)::numeric
                END), 6) AS composite_score,
            round(sum(
                CASE
                    WHEN c.included_in_total THEN c.weight_percent
                    ELSE (0)::numeric
                END), 6) AS included_weight_total
           FROM current_kpi c
          GROUP BY c.pc_org_id, c.fiscal_end_date, c.metric_date, c.class_type, c.tech_id
        )
 SELECT r.pc_org_id,
    r.fiscal_end_date,
    r.metric_date,
    r.class_type,
    r.tech_id,
    tl.batch_id,
    tl.computed_at,
    r.composite_score,
    r.included_weight_total,
    tb.tiebreaker_kpi_key,
    tk.metric_value AS tiebreaker_metric_value,
    tk.direction AS tiebreaker_direction
   FROM (((rollup r
     JOIN tech_latest tl ON (((tl.pc_org_id = r.pc_org_id) AND (tl.fiscal_end_date = r.fiscal_end_date) AND (tl.metric_date = r.metric_date) AND (tl.class_type = r.class_type) AND (tl.tech_id = r.tech_id))))
     LEFT JOIN tiebreak_cfg tb ON ((tb.class_type = r.class_type)))
     LEFT JOIN current_kpi tk ON (((tk.pc_org_id = r.pc_org_id) AND (tk.fiscal_end_date = r.fiscal_end_date) AND (tk.metric_date = r.metric_date) AND (tk.class_type = r.class_type) AND (tk.tech_id = r.tech_id) AND (tk.kpi_key = tb.tiebreaker_kpi_key))));


--
-- Name: metrics_composite_score_fact_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.metrics_composite_score_fact_v AS
 WITH current_kpi AS (
         SELECT q.id,
            q.batch_id,
            q.pc_org_id,
            q.metric_date,
            q.fiscal_end_date,
            q.mso_id,
            q.class_type,
            q.tech_id,
            q.kpi_key,
            q.raw_label_identifier,
            q.direction,
            q.metric_value,
            q.inside_rank,
            q.n_with_value,
            q.rank_score,
            q.weight_percent,
            q.grade_value,
            q.weighted_points,
            q.band_key,
            q.computed_at,
            q.normalized_score,
            q.included_in_total,
            q.score_source,
            q.kpi_rn
           FROM ( SELECT c.id,
                    c.batch_id,
                    c.pc_org_id,
                    c.metric_date,
                    c.fiscal_end_date,
                    c.mso_id,
                    c.class_type,
                    c.tech_id,
                    c.kpi_key,
                    c.raw_label_identifier,
                    c.direction,
                    c.metric_value,
                    c.inside_rank,
                    c.n_with_value,
                    c.rank_score,
                    c.weight_percent,
                    c.grade_value,
                    c.weighted_points,
                    c.band_key,
                    c.computed_at,
                    c.normalized_score,
                    c.included_in_total,
                    c.score_source,
                    row_number() OVER (PARTITION BY c.batch_id, c.pc_org_id, c.fiscal_end_date, c.metric_date, c.class_type, c.tech_id, c.kpi_key ORDER BY c.computed_at DESC) AS kpi_rn
                   FROM public.metrics_kpi_compute c) q
          WHERE (q.kpi_rn = 1)
        ), tiebreak_cfg AS (
         SELECT metrics_class_kpi_config.class_type,
            metrics_class_kpi_config.kpi_key AS tiebreaker_kpi_key
           FROM public.metrics_class_kpi_config
          WHERE (metrics_class_kpi_config.is_tiebreaker = true)
        ), rollup AS (
         SELECT c.batch_id,
            c.pc_org_id,
            c.fiscal_end_date,
            c.metric_date,
            c.class_type,
            c.tech_id,
            max(c.computed_at) AS computed_at,
            round(sum(
                CASE
                    WHEN c.included_in_total THEN c.weighted_points
                    ELSE (0)::numeric
                END), 6) AS composite_score,
            round(sum(
                CASE
                    WHEN c.included_in_total THEN c.weight_percent
                    ELSE (0)::numeric
                END), 6) AS included_weight_total
           FROM current_kpi c
          GROUP BY c.batch_id, c.pc_org_id, c.fiscal_end_date, c.metric_date, c.class_type, c.tech_id
        )
 SELECT r.batch_id,
    r.pc_org_id,
    r.fiscal_end_date,
    r.metric_date,
    r.class_type,
    r.tech_id,
    r.computed_at,
    r.composite_score,
    r.included_weight_total,
    tb.tiebreaker_kpi_key,
    tk.metric_value AS tiebreaker_metric_value,
    tk.direction AS tiebreaker_direction
   FROM ((rollup r
     LEFT JOIN tiebreak_cfg tb ON ((tb.class_type = r.class_type)))
     LEFT JOIN current_kpi tk ON (((tk.batch_id = r.batch_id) AND (tk.pc_org_id = r.pc_org_id) AND (tk.fiscal_end_date = r.fiscal_end_date) AND (tk.metric_date = r.metric_date) AND (tk.class_type = r.class_type) AND (tk.tech_id = r.tech_id) AND (tk.kpi_key = tb.tiebreaker_kpi_key))));


--
-- Name: metrics_kpi_rubric_effective; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.metrics_kpi_rubric_effective AS
 WITH ranked AS (
         SELECT r.pc_org_id,
            r.kpi_key,
            r.band_key,
            r.min_value,
            r.max_value,
            r.score_value,
            r.is_active,
            r.created_at,
            r.updated_at,
            row_number() OVER (PARTITION BY r.kpi_key, r.band_key, COALESCE((r.pc_org_id)::text, 'GLOBAL'::text) ORDER BY r.is_active DESC, r.updated_at DESC NULLS LAST, r.created_at DESC) AS rn
           FROM public.metrics_kpi_rubric r
        )
 SELECT pc_org_id,
    kpi_key,
    band_key,
    min_value,
    max_value,
    score_value,
    is_active,
    created_at,
    updated_at,
    rn
   FROM ranked
  WHERE (rn = 1);


--
-- Name: metrics_kpi_rubric_global; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.metrics_kpi_rubric_global AS
 SELECT kpi_key,
    band_key,
    min_value,
    max_value,
    score_value
   FROM public.metrics_kpi_rubric
  WHERE (is_active = true);


--
-- Name: ui_master_metric_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.ui_master_metric_v AS
 SELECT s.batch_id,
    s.class_type,
    s.pc_org_id,
    s.metric_date,
    s.fiscal_end_date,
    s.tech_id,
    s.person_id,
    s.ownership_mode,
    s.ownership_effective_date,
    s.direct_reports_to_person_id,
    s.itg_rollup_person_id,
    s.office_id,
    s.position_title,
    s.co_ref,
    s.co_code,
    s.affiliation_type,
    s.affiliation_role,
    COALESCE(rp.total_weighted_points, s.composite_score) AS composite_score,
    COALESCE(rp.rank, s.rank_org) AS rank_org,
    COALESCE(rp.n, s.population_size) AS population_size,
    s.status_badge,
    ((s.is_totals IS NOT TRUE) AND ((s.ownership_mode IS DISTINCT FROM 'ACTIVE'::text) OR (COALESCE(rp.total_weighted_points, s.composite_score) IS NULL))) AS is_outlier,
    s.is_totals,
    s.totals_owner_person_id,
    (((COALESCE(s.raw_metrics_json, '{}'::jsonb) || COALESCE(s.computed_metrics_json, '{}'::jsonb)) || COALESCE(ma.metrics_agg_json, '{}'::jsonb)) || jsonb_build_object('rank', rp.rank, 'n', rp.n, 'percentile', rp.percentile, 'total_weighted_points', rp.total_weighted_points)) AS metrics_json,
    max(s.created_at) AS created_at
   FROM ((public.master_kpi_archive_snapshot s
     LEFT JOIN public.metrics_rank_partition rp ON (((rp.batch_id = s.batch_id) AND (rp.class_type = s.class_type) AND (rp.tech_id = s.tech_id))))
     LEFT JOIN LATERAL ( SELECT jsonb_object_agg(COALESCE(m.metric_key_canonical, m.metric_key, m.metric_key_raw), COALESCE(m.computed_value, m.raw_value)) FILTER (WHERE ((m.tech_id IS NOT NULL) AND (COALESCE(m.metric_key_canonical, m.metric_key, m.metric_key_raw) IS NOT NULL))) AS metrics_agg_json
           FROM public.master_kpi_archive_metric m
          WHERE ((m.batch_id = s.batch_id) AND (m.class_type = s.class_type) AND (m.tech_id = s.tech_id))) ma ON (true))
  GROUP BY s.batch_id, s.class_type, s.pc_org_id, s.metric_date, s.fiscal_end_date, s.tech_id, s.person_id, s.ownership_mode, s.ownership_effective_date, s.direct_reports_to_person_id, s.itg_rollup_person_id, s.office_id, s.position_title, s.co_ref, s.co_code, s.affiliation_type, s.affiliation_role, s.composite_score, s.rank_org, s.population_size, s.status_badge, s.is_totals, s.totals_owner_person_id, s.raw_metrics_json, s.computed_metrics_json, rp.rank, rp.n, rp.percentile, rp.total_weighted_points, ma.metrics_agg_json;


--
-- Name: metrics_master_class_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.metrics_master_class_v AS
 SELECT v.batch_id,
    upper(v.class_type) AS class_type,
    v.pc_org_id,
    v.metric_date,
    v.fiscal_end_date,
    v.tech_id,
    j.key AS metric_key_raw,
    j.key AS metric_key_canonical,
    (j.value)::numeric AS computed_value,
    NULL::numeric AS raw_value,
    NULL::numeric AS numerator,
    NULL::numeric AS denominator
   FROM (public.ui_master_metric_v v
     CROSS JOIN LATERAL jsonb_each_text(v.metrics_json) j(key, value))
  WHERE (v.metrics_json IS NOT NULL);


--
-- Name: metrics_pipeline_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.metrics_pipeline_queue (
    job_id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    error text,
    lane text NOT NULL
);


--
-- Name: metrics_pipeline_run_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.metrics_pipeline_run_log (
    run_id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_id uuid NOT NULL,
    pc_org_id uuid NOT NULL,
    class_type text NOT NULL,
    stage text NOT NULL,
    ok boolean NOT NULL,
    error text,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone
);


--
-- Name: metrics_raw_batch; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.metrics_raw_batch (
    batch_id uuid DEFAULT gen_random_uuid() NOT NULL,
    pc_org_id uuid NOT NULL,
    fiscal_end_date date NOT NULL,
    source_title text,
    source_generated_at timestamp with time zone,
    source_filename text,
    file_sha256 text,
    uploaded_by uuid,
    uploaded_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'staged'::text NOT NULL,
    row_count integer DEFAULT 0 NOT NULL,
    warning_flags jsonb DEFAULT '[]'::jsonb NOT NULL,
    error text,
    metric_date date,
    computed_at timestamp with time zone
);


--
-- Name: metrics_raw_row; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.metrics_raw_row (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_id uuid NOT NULL,
    pc_org_id uuid NOT NULL,
    metric_date date NOT NULL,
    fiscal_end_date date NOT NULL,
    tech_id text NOT NULL,
    unique_row_key text NOT NULL,
    raw jsonb NOT NULL,
    inserted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: metrics_raw_total_row; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.metrics_raw_total_row (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_id uuid NOT NULL,
    pc_org_id uuid NOT NULL,
    metric_date date NOT NULL,
    fiscal_end_date date NOT NULL,
    summary_type text NOT NULL,
    summary_key text NOT NULL,
    summary_label text NOT NULL,
    unique_row_key text NOT NULL,
    raw jsonb NOT NULL,
    inserted_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT metrics_raw_total_row_summary_type_check CHECK ((summary_type = ANY (ARRAY['pc_org_total'::text, 'office_total'::text, 'contractor_total'::text, 'leadership_total'::text])))
);


--
-- Name: metrics_scoring_class; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.metrics_scoring_class (
    class_type text NOT NULL,
    label text NOT NULL,
    description text,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT metrics_scoring_class_class_type_chk CHECK ((class_type = ANY (ARRAY['NSR'::text, 'SMART'::text, 'TECH'::text])))
);


--
-- Name: metrics_tech_fact_day; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.metrics_tech_fact_day AS
 SELECT id,
    batch_id,
    pc_org_id,
    metric_date,
    fiscal_end_date,
    tech_id,
    unique_row_key,
    inserted_at,
    public.try_numeric((raw ->> 'tNPS Rate'::text)) AS tnps_score,
    public.try_numeric((raw ->> 'FTR%'::text)) AS ftr_rate,
    public.try_numeric((raw ->> 'ToolUsage'::text)) AS tool_usage_rate,
    public.try_numeric((raw ->> '48Hr Contact Rate%'::text)) AS contact_48hr_rate,
    public.try_numeric((raw ->> 'PHT Pure Pass%'::text)) AS pht_pure_pass_rate,
    public.try_numeric((raw ->> 'MetRate'::text)) AS met_rate,
    public.try_numeric((raw ->> 'SOI Rate%'::text)) AS soi_rate,
    public.try_numeric((raw ->> 'Repeat Rate%'::text)) AS repeat_rate,
    public.try_numeric((raw ->> 'Rework Rate%'::text)) AS rework_rate,
    public.try_numeric((raw ->> 'tNPS Surveys'::text)) AS tnps_surveys,
    public.try_numeric((raw ->> 'Promoters'::text)) AS tnps_promoters,
    public.try_numeric((raw ->> 'Detractors'::text)) AS tnps_detractors,
    public.try_numeric((raw ->> 'Total Jobs'::text)) AS total_jobs,
    public.try_numeric((raw ->> 'TotalAppts'::text)) AS total_appts,
    public.try_numeric((raw ->> 'TotalMetAppts'::text)) AS total_met_appts,
    public.try_numeric((raw ->> 'Total FTR/Contact Jobs'::text)) AS total_ftr_contact_jobs,
    public.try_numeric((raw ->> 'FTRFailJobs'::text)) AS ftr_fail_jobs,
    public.try_numeric((raw ->> 'TUEligibleJobs'::text)) AS tu_eligible_jobs,
    public.try_numeric((raw ->> 'TUResult'::text)) AS tu_compliant_jobs,
    public.try_numeric((raw ->> '48Hr Contact Orders'::text)) AS contact_48hr_orders,
    public.try_numeric((raw ->> 'Repeat Count'::text)) AS repeat_count,
    public.try_numeric((raw ->> 'Rework Count'::text)) AS rework_count
   FROM public.metrics_raw_row r;


--
-- Name: metrics_tech_fact_latest_fiscal; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.metrics_tech_fact_latest_fiscal AS
 SELECT DISTINCT ON (pc_org_id, fiscal_end_date, tech_id) pc_org_id,
    fiscal_end_date,
    tech_id,
    metric_date,
    batch_id,
    tnps_score,
    ftr_rate,
    tool_usage_rate,
    contact_48hr_rate,
    pht_pure_pass_rate,
    met_rate,
    soi_rate,
    repeat_rate,
    rework_rate,
    tnps_surveys,
    tnps_promoters,
    tnps_detractors,
    total_jobs,
    total_appts,
    total_met_appts,
    total_ftr_contact_jobs,
    ftr_fail_jobs,
    tu_eligible_jobs,
    tu_compliant_jobs,
    contact_48hr_orders,
    repeat_count,
    rework_count
   FROM public.metrics_tech_fact_day
  ORDER BY pc_org_id, fiscal_end_date, tech_id, metric_date DESC;


--
-- Name: metrics_tech_rollup; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.metrics_tech_rollup (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_id uuid NOT NULL,
    pc_org_id uuid NOT NULL,
    metric_date date NOT NULL,
    fiscal_end_date date NOT NULL,
    mso_id uuid,
    class_type text NOT NULL,
    tech_id text NOT NULL,
    total_weighted_points numeric DEFAULT 0 NOT NULL,
    computed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT metrics_tech_rollup_class_type_check CHECK ((upper(class_type) = ANY (ARRAY['NSR'::text, 'SMART'::text, 'TECH'::text])))
);


--
-- Name: metrics_tech_leaderboard_day; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.metrics_tech_leaderboard_day AS
 SELECT pc_org_id,
    metric_date,
    fiscal_end_date,
    class_type,
    tech_id,
    total_weighted_points,
    rank() OVER (PARTITION BY pc_org_id, metric_date, class_type ORDER BY total_weighted_points DESC NULLS LAST, tech_id) AS rank_org,
    percent_rank() OVER (PARTITION BY pc_org_id, metric_date, class_type ORDER BY total_weighted_points DESC NULLS LAST, tech_id) AS percent_rank
   FROM public.metrics_tech_rollup;


--
-- Name: mso_admin_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.mso_admin_v AS
 SELECT mso_id,
    mso_name,
    mso_lob
   FROM public.mso m;


--
-- Name: org_event; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_event (
    org_event_id uuid DEFAULT gen_random_uuid() NOT NULL,
    pc_org_id uuid NOT NULL,
    event_type text NOT NULL,
    actor_user_id uuid NOT NULL,
    person_id uuid NOT NULL,
    assignment_id uuid,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: org_event_feed_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.org_event_feed_v AS
 SELECT org_event_id,
    pc_org_id,
    event_type,
    actor_user_id,
    person_id,
    assignment_id,
    payload,
    created_at
   FROM public.org_event e;


--
-- Name: password_setup_code; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_setup_code (
    password_setup_code_id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    code_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    attempt_count integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 10 NOT NULL,
    purpose text DEFAULT 'reset'::text NOT NULL
);


--
-- Name: pc; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pc (
    pc_id uuid DEFAULT gen_random_uuid() NOT NULL,
    pc_number integer NOT NULL
);


--
-- Name: pc_org_admin_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.pc_org_admin_v AS
 SELECT pc_org_id,
    pc_id,
    mso_id,
    division_id,
    region_id,
    pc_org_name,
    fulfillment_center_id,
    fulfillment_center_name
   FROM public.pc_org o;


--
-- Name: pc_org_console_eligibility_derived; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pc_org_console_eligibility_derived (
    pc_org_id uuid NOT NULL,
    auth_user_id uuid NOT NULL,
    source text DEFAULT 'director_plus'::text NOT NULL,
    derived_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pc_org_home_block; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pc_org_home_block (
    pc_org_home_block_id uuid DEFAULT gen_random_uuid() NOT NULL,
    pc_org_id uuid NOT NULL,
    lob text NOT NULL,
    area text NOT NULL,
    sort integer DEFAULT 0 NOT NULL,
    block_type text NOT NULL,
    title text,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pc_org_home_block_lob_check CHECK ((lob = ANY (ARRAY['FULFILLMENT'::text, 'LOCATE'::text])))
);


--
-- Name: pc_org_leadership; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pc_org_leadership (
    pc_org_id uuid NOT NULL,
    role_key text NOT NULL,
    leader_user_id uuid,
    leader_person_id uuid,
    is_primary boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by_user_id uuid,
    CONSTRAINT pc_org_leadership_one_target_chk CHECK ((((leader_user_id IS NOT NULL) AND (leader_person_id IS NULL)) OR ((leader_user_id IS NULL) AND (leader_person_id IS NOT NULL))))
);


--
-- Name: pc_org_office; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pc_org_office (
    pc_org_office_id uuid DEFAULT gen_random_uuid() NOT NULL,
    pc_org_id uuid NOT NULL,
    office_id uuid NOT NULL,
    is_primary boolean DEFAULT false,
    office_notes text
);


--
-- Name: pc_org_permission_grant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pc_org_permission_grant (
    pc_org_permission_grant_id uuid DEFAULT gen_random_uuid() NOT NULL,
    pc_org_id uuid NOT NULL,
    auth_user_id uuid NOT NULL,
    permission_key text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    expires_at timestamp with time zone,
    notes text,
    revoked_at timestamp with time zone,
    revoked_by uuid
);


--
-- Name: permission_def; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permission_def (
    permission_key text NOT NULL,
    description text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    domain text,
    scope_level text,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: pc_org_permission_grant_admin_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.pc_org_permission_grant_admin_v AS
 SELECT g.pc_org_permission_grant_id,
    g.pc_org_id,
    g.auth_user_id,
    g.permission_key,
    d.domain,
    d.scope_level,
    d.description AS permission_description,
    g.created_at,
    g.created_by,
    g.expires_at,
    g.revoked_at,
    g.revoked_by,
    g.notes,
    ((g.revoked_at IS NULL) AND ((g.expires_at IS NULL) OR (g.expires_at > now())) AND (COALESCE(d.is_active, true) = true)) AS is_effective
   FROM (public.pc_org_permission_grant g
     JOIN public.permission_def d ON ((d.permission_key = g.permission_key)));


--
-- Name: pc_org_permission_grant_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pc_org_permission_grant_audit (
    audit_id bigint NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    actor_user_id uuid NOT NULL,
    target_user_id uuid NOT NULL,
    pc_org_id uuid NOT NULL,
    permission_key text NOT NULL,
    action text NOT NULL,
    source text DEFAULT 'admin-console'::text NOT NULL,
    request_id text,
    notes text,
    CONSTRAINT pc_org_permission_grant_audit_action_check CHECK ((action = ANY (ARRAY['GRANT'::text, 'REVOKE'::text])))
);


--
-- Name: pc_org_permission_grant_audit_audit_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pc_org_permission_grant_audit_audit_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pc_org_permission_grant_audit_audit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pc_org_permission_grant_audit_audit_id_seq OWNED BY public.pc_org_permission_grant_audit.audit_id;


--
-- Name: pc_org_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pc_org_permissions (
    auth_user_id uuid NOT NULL,
    pc_org_id uuid NOT NULL,
    can_write boolean DEFAULT false NOT NULL,
    can_roster_write boolean DEFAULT false NOT NULL,
    can_route_lock_write boolean DEFAULT false NOT NULL,
    can_metrics_write boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pc_org_state_coverage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pc_org_state_coverage (
    pc_org_state_coverage_id uuid DEFAULT gen_random_uuid() NOT NULL,
    pc_org_id uuid NOT NULL,
    state_code text NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    coverage_status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pc_org_state_coverage_status_chk CHECK ((coverage_status = ANY (ARRAY['active'::text, 'inactive'::text])))
);


--
-- Name: pc_org_state_coverage_admin_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.pc_org_state_coverage_admin_v AS
 SELECT c.pc_org_state_coverage_id,
    c.pc_org_id,
    po.pc_org_name,
    po.pc_id,
    pc.pc_number,
    po.mso_id,
    m.mso_name,
    c.state_code,
    s.state_name,
    c.is_primary,
    c.coverage_status,
    c.created_at,
    c.updated_at
   FROM ((((public.pc_org_state_coverage c
     JOIN public.pc_org po ON ((po.pc_org_id = c.pc_org_id)))
     LEFT JOIN public.pc pc ON ((pc.pc_id = po.pc_id)))
     LEFT JOIN public.mso m ON ((m.mso_id = po.mso_id)))
     LEFT JOIN public.locate_state_resource s ON ((s.state_code = c.state_code)));


--
-- Name: pc_org_user_role; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pc_org_user_role (
    pc_org_user_role_id uuid DEFAULT gen_random_uuid() NOT NULL,
    pc_org_id uuid NOT NULL,
    auth_user_id uuid NOT NULL,
    position_title_id uuid NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);


--
-- Name: position_title; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.position_title (
    position_title_id uuid DEFAULT gen_random_uuid() NOT NULL,
    position_title text NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    role_type text,
    is_field boolean DEFAULT false NOT NULL,
    is_leadership boolean DEFAULT false NOT NULL,
    allows_tech boolean DEFAULT false NOT NULL
);


--
-- Name: quota; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quota (
    quota_id uuid DEFAULT gen_random_uuid() NOT NULL,
    route_id uuid NOT NULL,
    fiscal_month_id uuid DEFAULT public.fiscal_month_ensure_for_date(CURRENT_DATE) NOT NULL,
    qh_sun integer DEFAULT 0 NOT NULL,
    qh_mon integer DEFAULT 0 NOT NULL,
    qh_tue integer DEFAULT 0 NOT NULL,
    qh_wed integer DEFAULT 0 NOT NULL,
    qh_thu integer DEFAULT 0 NOT NULL,
    qh_fri integer DEFAULT 0 NOT NULL,
    qh_sat integer DEFAULT 0 NOT NULL,
    qu_sun integer GENERATED ALWAYS AS ((qh_sun * 12)) STORED,
    qu_mon integer GENERATED ALWAYS AS ((qh_mon * 12)) STORED,
    qu_tue integer GENERATED ALWAYS AS ((qh_tue * 12)) STORED,
    qu_wed integer GENERATED ALWAYS AS ((qh_wed * 12)) STORED,
    qu_thu integer GENERATED ALWAYS AS ((qh_thu * 12)) STORED,
    qu_fri integer GENERATED ALWAYS AS ((qh_fri * 12)) STORED,
    qu_sat integer GENERATED ALWAYS AS ((qh_sat * 12)) STORED,
    qt_hours integer GENERATED ALWAYS AS (((((((qh_sun + qh_mon) + qh_tue) + qh_wed) + qh_thu) + qh_fri) + qh_sat)) STORED,
    qt_units integer GENERATED ALWAYS AS ((((((((qh_sun + qh_mon) + qh_tue) + qh_wed) + qh_thu) + qh_fri) + qh_sat) * 12)) STORED,
    pc_org_id uuid NOT NULL,
    CONSTRAINT quota_qh_nonneg_chk CHECK (((qh_sun >= 0) AND (qh_mon >= 0) AND (qh_tue >= 0) AND (qh_wed >= 0) AND (qh_thu >= 0) AND (qh_fri >= 0) AND (qh_sat >= 0)))
);


--
-- Name: route; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.route (
    route_id uuid DEFAULT gen_random_uuid() NOT NULL,
    route_name text NOT NULL,
    pc_org_id uuid NOT NULL
);


--
-- Name: quota_admin_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.quota_admin_v AS
 SELECT q.quota_id,
    q.pc_org_id,
    q.route_id,
    r.route_name,
    q.fiscal_month_id,
    fm.label AS fiscal_month_label,
    q.qh_sun,
    q.qh_mon,
    q.qh_tue,
    q.qh_wed,
    q.qh_thu,
    q.qh_fri,
    q.qh_sat,
    q.qu_sun,
    q.qu_mon,
    q.qu_tue,
    q.qu_wed,
    q.qu_thu,
    q.qu_fri,
    q.qu_sat,
    q.qt_hours,
    q.qt_units,
    fm.start_date AS fiscal_month_start_date,
    fm.end_date AS fiscal_month_end_date
   FROM ((public.quota q
     LEFT JOIN public.route r ON ((r.route_id = q.route_id)))
     LEFT JOIN public.fiscal_month_dim fm ON ((fm.fiscal_month_id = q.fiscal_month_id)));


--
-- Name: ref_position_title_map; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ref_position_title_map (
    position_title text NOT NULL,
    role_type text NOT NULL,
    is_field boolean DEFAULT false NOT NULL,
    is_leadership boolean DEFAULT false NOT NULL,
    normalized_label text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: region_admin_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.region_admin_v AS
 SELECT region_id,
    region_name,
    region_code
   FROM public.region r;


--
-- Name: region_leadership; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.region_leadership (
    region_id uuid NOT NULL,
    role_key text NOT NULL,
    leader_user_id uuid,
    leader_person_id uuid,
    is_primary boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by_user_id uuid,
    CONSTRAINT region_leadership_one_target_chk CHECK ((((leader_user_id IS NOT NULL) AND (leader_person_id IS NULL)) OR ((leader_user_id IS NULL) AND (leader_person_id IS NOT NULL))))
);


--
-- Name: role_dim; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_dim (
    role_key text NOT NULL,
    role_level integer NOT NULL,
    description text
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    role_key text NOT NULL,
    label text NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: roster_invite_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roster_invite_log (
    invite_id uuid DEFAULT gen_random_uuid() NOT NULL,
    pc_org_id uuid NOT NULL,
    person_id uuid,
    assignment_id uuid,
    email text NOT NULL,
    invited_by_auth_user_id uuid NOT NULL,
    invited_at timestamp with time zone DEFAULT now() NOT NULL,
    resend_count integer DEFAULT 0 NOT NULL
);


--
-- Name: route_admin_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.route_admin_v AS
 SELECT r.route_id,
    r.route_name,
    r.pc_org_id,
    o.pc_org_name,
    o.pc_id AS pc_number,
    m.mso_name,
    d.division_name,
    d.division_code,
    g.region_name,
    g.region_code
   FROM ((((public.route r
     JOIN public.pc_org o ON ((o.pc_org_id = r.pc_org_id)))
     LEFT JOIN public.mso m ON ((m.mso_id = o.mso_id)))
     LEFT JOIN public.division d ON ((d.division_id = o.division_id)))
     LEFT JOIN public.region g ON ((g.region_id = o.region_id)));


--
-- Name: schedule_day_fact; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schedule_day_fact (
    pc_org_id uuid NOT NULL,
    shift_date date NOT NULL,
    tech_id text NOT NULL,
    fiscal_month_id uuid NOT NULL,
    fiscal_end_date date NOT NULL,
    assignment_id uuid,
    planned_route_id uuid,
    planned_hours numeric DEFAULT 0 NOT NULL,
    planned_units numeric DEFAULT 0 NOT NULL,
    plan_source text NOT NULL,
    schedule_exception_day_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: shift_validation_day_fact; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shift_validation_day_fact (
    pc_org_id uuid NOT NULL,
    shift_date date NOT NULL,
    tech_id text NOT NULL,
    fiscal_month_id uuid NOT NULL,
    fiscal_end_date date NOT NULL,
    fulfillment_center_id bigint NOT NULL,
    fulfillment_center text,
    company text,
    fsup_num text,
    fsup_last_name text,
    fsup_first_name text,
    tech_last_name text,
    tech_first_name text,
    tech_middle_initial text,
    title text,
    shift_start_time time without time zone,
    shift_end_time time without time zone,
    shift_duration numeric,
    break_start_time time without time zone,
    break_end_time time without time zone,
    break_duration numeric,
    work_duration numeric,
    skill_groups text,
    route_criteria text,
    shift_type text,
    productivity_indicator text,
    start_location text,
    route_area text,
    capacity_model text,
    will_not_generate_capacity text,
    office text,
    work_units numeric,
    target_unit numeric,
    shift_validation_row_id uuid,
    shift_validation_batch_id uuid,
    ingested_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_work boolean,
    is_bplow boolean,
    is_prjt boolean,
    is_trvl boolean,
    is_bptrl boolean
);


--
-- Name: route_lock_archive_day_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.route_lock_archive_day_v AS
 WITH fm AS (
         SELECT fiscal_month_dim.fiscal_month_id,
            fiscal_month_dim.start_date,
            fiscal_month_dim.end_date
           FROM public.fiscal_month_dim
        ), days AS (
         SELECT fm_1.fiscal_month_id,
            (gs.d)::date AS shift_date
           FROM (fm fm_1
             CROSS JOIN LATERAL generate_series((fm_1.start_date)::timestamp without time zone, (fm_1.end_date)::timestamp without time zone, '1 day'::interval) gs(d))
        ), q_day AS (
         SELECT quota_day_fact.pc_org_id,
            quota_day_fact.fiscal_month_id,
            quota_day_fact.shift_date,
            sum(COALESCE(quota_day_fact.quota_hours, (0)::numeric)) AS quota_hours,
            sum(COALESCE(quota_day_fact.quota_units, (0)::numeric)) AS quota_units,
            (count(*))::integer AS quota_routes
           FROM public.quota_day_fact
          GROUP BY quota_day_fact.pc_org_id, quota_day_fact.fiscal_month_id, quota_day_fact.shift_date
        ), s_day AS (
         SELECT schedule_day_fact.pc_org_id,
            schedule_day_fact.fiscal_month_id,
            schedule_day_fact.shift_date,
            (count(*))::integer AS scheduled_techs,
            (count(*))::integer AS scheduled_routes,
            sum(COALESCE(schedule_day_fact.planned_hours, (0)::numeric)) AS planned_hours,
            sum(COALESCE(schedule_day_fact.planned_units, (0)::numeric)) AS planned_units
           FROM public.schedule_day_fact
          GROUP BY schedule_day_fact.pc_org_id, schedule_day_fact.fiscal_month_id, schedule_day_fact.shift_date
        ), sv_day AS (
         SELECT shift_validation_day_fact.pc_org_id,
            shift_validation_day_fact.fiscal_month_id,
            shift_validation_day_fact.shift_date,
            (count(*))::integer AS sv_rows
           FROM public.shift_validation_day_fact
          GROUP BY shift_validation_day_fact.pc_org_id, shift_validation_day_fact.fiscal_month_id, shift_validation_day_fact.shift_date
        ), ci_day AS (
         SELECT check_in_day_fact.pc_org_id,
            check_in_day_fact.fiscal_month_id,
            check_in_day_fact.shift_date,
            (sum(COALESCE(check_in_day_fact.actual_jobs, 0)))::integer AS actual_jobs,
            sum(COALESCE(check_in_day_fact.actual_units, (0)::numeric)) AS actual_units,
            sum(COALESCE(check_in_day_fact.actual_hours, (0)::numeric)) AS actual_hours,
            min(check_in_day_fact.first_start_time) AS first_start_time,
            max(check_in_day_fact.last_cp_time) AS last_cp_time,
            (count(*))::integer AS ci_rows
           FROM public.check_in_day_fact
          GROUP BY check_in_day_fact.pc_org_id, check_in_day_fact.fiscal_month_id, check_in_day_fact.shift_date
        ), scoped AS (
         SELECT DISTINCT quota_day_fact.pc_org_id,
            quota_day_fact.fiscal_month_id
           FROM public.quota_day_fact
        UNION
         SELECT DISTINCT schedule_day_fact.pc_org_id,
            schedule_day_fact.fiscal_month_id
           FROM public.schedule_day_fact
        UNION
         SELECT DISTINCT shift_validation_day_fact.pc_org_id,
            shift_validation_day_fact.fiscal_month_id
           FROM public.shift_validation_day_fact
        UNION
         SELECT DISTINCT check_in_day_fact.pc_org_id,
            check_in_day_fact.fiscal_month_id
           FROM public.check_in_day_fact
        )
 SELECT sc.pc_org_id,
    d.fiscal_month_id,
    d.shift_date,
    fm.end_date AS fiscal_end_date,
    q.quota_hours,
    q.quota_units,
    q.quota_routes,
    (q.quota_hours IS NOT NULL) AS has_quota,
    COALESCE(s.scheduled_techs, 0) AS scheduled_techs,
    COALESCE(s.scheduled_routes, 0) AS scheduled_routes,
    s.planned_hours,
    s.planned_units,
    (s.scheduled_techs IS NOT NULL) AS has_schedule,
    (COALESCE(sv.sv_rows, 0) > 0) AS has_shift_validation,
    (COALESCE(ci.ci_rows, 0) > 0) AS has_actuals,
    ci.actual_jobs,
    ci.actual_units,
    ci.actual_hours,
    ci.first_start_time AS actual_first_start_time,
    ci.last_cp_time AS actual_last_cp_time,
        CASE
            WHEN (q.quota_hours IS NULL) THEN NULL::integer
            ELSE (((COALESCE(s.scheduled_routes, 0))::numeric - ceil((q.quota_hours / 8.0))))::integer
        END AS delta_forecast,
        CASE
            WHEN (q.quota_hours IS NULL) THEN NULL::integer
            ELSE (ceil((q.quota_hours / 8.0)))::integer
        END AS quota_routes_forecast
   FROM ((((((scoped sc
     JOIN days d ON ((d.fiscal_month_id = sc.fiscal_month_id)))
     JOIN public.fiscal_month_dim fm ON ((fm.fiscal_month_id = d.fiscal_month_id)))
     LEFT JOIN q_day q ON (((q.pc_org_id = sc.pc_org_id) AND (q.fiscal_month_id = d.fiscal_month_id) AND (q.shift_date = d.shift_date))))
     LEFT JOIN s_day s ON (((s.pc_org_id = sc.pc_org_id) AND (s.fiscal_month_id = d.fiscal_month_id) AND (s.shift_date = d.shift_date))))
     LEFT JOIN sv_day sv ON (((sv.pc_org_id = sc.pc_org_id) AND (sv.fiscal_month_id = d.fiscal_month_id) AND (sv.shift_date = d.shift_date))))
     LEFT JOIN ci_day ci ON (((ci.pc_org_id = sc.pc_org_id) AND (ci.fiscal_month_id = d.fiscal_month_id) AND (ci.shift_date = d.shift_date))));


--
-- Name: route_lock_archive_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.route_lock_archive_v AS
 SELECT s.pc_org_id,
    s.shift_date,
    s.tech_id,
    s.fiscal_month_id,
    s.fiscal_end_date,
    s.planned_route_id,
    s.planned_hours,
    s.planned_units,
    s.plan_source,
    s.schedule_exception_day_id,
    q.quota_hours,
    q.quota_units,
    q.quota_source,
    sv.work_duration AS sv_work_duration,
    sv.work_units AS sv_work_units,
    sv.route_area AS sv_route_area,
    sv.route_criteria AS sv_route_criteria,
    sv.shift_type AS sv_shift_type,
    sv.productivity_indicator AS sv_productivity_indicator,
    sv.start_location AS sv_start_location,
    sv.capacity_model AS sv_capacity_model,
    sv.will_not_generate_capacity AS sv_will_not_generate_capacity,
    sv.office AS sv_office,
    sv.ingested_at AS sv_ingested_at,
    ci.actual_jobs,
    ci.actual_units,
    ci.actual_hours,
    ci.first_start_time AS actual_first_start_time,
    ci.last_cp_time AS actual_last_cp_time,
    (ci.tech_id IS NOT NULL) AS has_actuals,
    (sv.tech_id IS NOT NULL) AS has_shift_validation,
    (q.route_id IS NOT NULL) AS has_quota
   FROM (((public.schedule_day_fact s
     LEFT JOIN public.quota_day_fact q ON (((q.pc_org_id = s.pc_org_id) AND (q.shift_date = s.shift_date) AND (q.route_id = s.planned_route_id))))
     LEFT JOIN public.shift_validation_day_fact sv ON (((sv.pc_org_id = s.pc_org_id) AND (sv.shift_date = s.shift_date) AND (sv.tech_id = s.tech_id))))
     LEFT JOIN public.check_in_day_fact ci ON (((ci.pc_org_id = s.pc_org_id) AND (ci.shift_date = s.shift_date) AND (ci.tech_id = s.tech_id))));


--
-- Name: rpc_policy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rpc_policy (
    rpc_policy_id bigint NOT NULL,
    schema_name text DEFAULT 'api'::text NOT NULL,
    function_name text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    mode text DEFAULT 'org_permission'::text NOT NULL,
    permission_key text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: rpc_policy_admin_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.rpc_policy_admin_v AS
 SELECT r.rpc_policy_id,
    r.schema_name,
    r.function_name,
    r.enabled,
    r.mode,
    r.permission_key,
    d.domain,
    d.scope_level,
    d.description AS permission_description,
    r.created_at,
    r.updated_at
   FROM (public.rpc_policy r
     LEFT JOIN public.permission_def d ON ((d.permission_key = r.permission_key)));


--
-- Name: rpc_policy_rpc_policy_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rpc_policy_rpc_policy_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rpc_policy_rpc_policy_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rpc_policy_rpc_policy_id_seq OWNED BY public.rpc_policy.rpc_policy_id;


--
-- Name: schedule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schedule (
    schedule_id uuid DEFAULT gen_random_uuid() NOT NULL,
    assignment_id uuid NOT NULL,
    schedule_name text NOT NULL,
    start_date date NOT NULL,
    end_date date,
    default_route_id uuid,
    sun boolean DEFAULT true,
    mon boolean DEFAULT true,
    tue boolean DEFAULT true,
    wed boolean DEFAULT true,
    thu boolean DEFAULT true,
    fri boolean DEFAULT true,
    sat boolean DEFAULT true,
    sch_hours_sun integer NOT NULL,
    sch_hours_mon integer NOT NULL,
    sch_hours_tue integer NOT NULL,
    sch_hours_wed integer NOT NULL,
    sch_hours_thu integer NOT NULL,
    sch_hours_fri integer NOT NULL,
    sch_hours_sat integer NOT NULL,
    sch_units_sun integer NOT NULL,
    sch_units_mon integer NOT NULL,
    sch_units_tue integer NOT NULL,
    sch_units_wed integer NOT NULL,
    sch_units_thu integer NOT NULL,
    sch_units_fri integer NOT NULL,
    sch_units_sat integer NOT NULL
);


--
-- Name: schedule_admin_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.schedule_admin_v AS
 SELECT s.schedule_id,
    s.assignment_id,
    s.schedule_name,
    s.start_date,
    s.end_date,
    s.default_route_id,
    s.sun,
    s.mon,
    s.tue,
    s.wed,
    s.thu,
    s.fri,
    s.sat,
    s.sch_hours_sun,
    s.sch_hours_mon,
    s.sch_hours_tue,
    s.sch_hours_wed,
    s.sch_hours_thu,
    s.sch_hours_fri,
    s.sch_hours_sat,
    s.sch_units_sun,
    s.sch_units_mon,
    s.sch_units_tue,
    s.sch_units_wed,
    s.sch_units_thu,
    s.sch_units_fri,
    s.sch_units_sat,
    a.pc_org_id,
    s.sch_hours_sun AS hours_sun,
    s.sch_hours_mon AS hours_mon,
    s.sch_hours_tue AS hours_tue,
    s.sch_hours_wed AS hours_wed,
    s.sch_hours_thu AS hours_thu,
    s.sch_hours_fri AS hours_fri,
    s.sch_hours_sat AS hours_sat,
    s.sch_units_sun AS units_sun,
    s.sch_units_mon AS units_mon,
    s.sch_units_tue AS units_tue,
    s.sch_units_wed AS units_wed,
    s.sch_units_thu AS units_thu,
    s.sch_units_fri AS units_fri,
    s.sch_units_sat AS units_sat
   FROM (public.schedule s
     JOIN public.assignment a ON ((a.assignment_id = s.assignment_id)));


--
-- Name: schedule_exception_day; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schedule_exception_day (
    schedule_exception_day_id uuid DEFAULT gen_random_uuid() NOT NULL,
    pc_org_id uuid NOT NULL,
    shift_date date NOT NULL,
    tech_id text NOT NULL,
    exception_type text NOT NULL,
    approved boolean DEFAULT false NOT NULL,
    override_route_id uuid,
    override_hours numeric,
    override_units numeric,
    force_off boolean DEFAULT false NOT NULL,
    notes text,
    requested_by uuid,
    approved_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    decision_notes text,
    decision_at timestamp with time zone,
    person_id uuid,
    assignment_id uuid,
    approval_status text DEFAULT 'PENDING'::text NOT NULL,
    approved_at timestamp with time zone,
    approved_by_auth_user_id uuid,
    approval_notes text,
    CONSTRAINT schedule_exception_day_status_check CHECK ((status = ANY (ARRAY['PENDING'::text, 'APPROVED'::text, 'DENIED'::text])))
);


--
-- Name: COLUMN schedule_exception_day.approval_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.schedule_exception_day.approval_status IS 'Draft exception approval state. Draft inserts should default to PENDING; manager approval sets approved_at.';


--
-- Name: shift_validation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shift_validation (
    sv_id uuid DEFAULT gen_random_uuid() NOT NULL,
    sv_route_id text NOT NULL,
    sv_tech_id text NOT NULL,
    sv_hours integer NOT NULL,
    sv_units integer NOT NULL,
    pc_org_id uuid
);


--
-- Name: shift_validation_batch; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shift_validation_batch (
    shift_validation_batch_id uuid DEFAULT gen_random_uuid() NOT NULL,
    pc_org_id uuid NOT NULL,
    fulfillment_center_id bigint NOT NULL,
    fulfillment_center_name text,
    uploaded_by_auth_user_id uuid NOT NULL,
    uploaded_at timestamp with time zone DEFAULT now() NOT NULL,
    row_count_total integer DEFAULT 0 NOT NULL,
    row_count_loaded integer DEFAULT 0 NOT NULL,
    min_shift_date date,
    max_shift_date date
);


--
-- Name: shift_validation_row; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shift_validation_row (
    shift_validation_row_id uuid DEFAULT gen_random_uuid() NOT NULL,
    pc_org_id uuid NOT NULL,
    shift_validation_batch_id uuid,
    fulfillment_center_id bigint NOT NULL,
    fulfillment_center text,
    company text,
    fsup_num text,
    fsup_last_name text,
    fsup_first_name text,
    tech_num text NOT NULL,
    tech_last_name text,
    tech_first_name text,
    tech_middle_initial text,
    title text,
    shift_date date NOT NULL,
    shift_start_time time without time zone,
    shift_end_time time without time zone,
    shift_duration numeric,
    break_start_time time without time zone,
    break_end_time time without time zone,
    break_duration numeric,
    work_duration numeric,
    skill_groups text,
    route_criteria text,
    shift_type text,
    productivity_indicator text,
    start_location text,
    route_area text,
    capacity_model text,
    will_not_generate_capacity text,
    office text,
    work_units numeric,
    target_unit numeric,
    ingested_at timestamp with time zone DEFAULT now() NOT NULL,
    is_work boolean,
    is_bplow boolean,
    is_prjt boolean,
    is_trvl boolean,
    is_bptrl boolean
);


--
-- Name: shift_validation_import_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.shift_validation_import_v AS
 SELECT shift_validation_row_id,
    pc_org_id,
    shift_validation_batch_id,
    fulfillment_center_id,
    fulfillment_center,
    company,
    fsup_num,
    fsup_last_name,
    fsup_first_name,
    tech_num,
    tech_last_name,
    tech_first_name,
    tech_middle_initial,
    title,
    shift_date,
    shift_start_time,
    shift_end_time,
    shift_duration,
    break_start_time,
    break_end_time,
    break_duration,
    work_duration,
    skill_groups,
    route_criteria,
    shift_type,
    productivity_indicator,
    start_location,
    route_area,
    capacity_model,
    will_not_generate_capacity,
    office,
    work_units,
    target_unit,
    ingested_at,
    tech_num AS tech_id,
    route_area AS route_areas
   FROM public.shift_validation_row r;


--
-- Name: ui_master_metric_v2; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.ui_master_metric_v2 AS
 SELECT s.batch_id,
    s.class_type,
    s.pc_org_id,
    s.metric_date,
    s.fiscal_end_date,
    s.tech_id,
    s.person_id,
    s.ownership_mode,
    s.ownership_effective_date,
    s.direct_reports_to_person_id,
    s.itg_rollup_person_id,
    s.office_id,
    s.position_title,
    s.co_ref,
    s.co_code,
    s.affiliation_type,
    s.affiliation_role,
    cs.composite_score,
    COALESCE(rp.rank, s.rank_org) AS rank_org,
    COALESCE(rp.n, s.population_size) AS population_size,
    COALESCE(rp.percentile, s.percentile) AS percentile,
    s.status_badge,
    ((s.is_totals IS NOT TRUE) AND ((s.ownership_mode IS DISTINCT FROM 'ACTIVE'::text) OR (cs.composite_score IS NULL))) AS is_outlier,
    s.is_totals,
    s.totals_owner_person_id,
    ((COALESCE(s.raw_metrics_json, '{}'::jsonb) || COALESCE(s.computed_metrics_json, '{}'::jsonb)) || jsonb_strip_nulls(jsonb_build_object('rank', rp.rank, 'n', rp.n, 'percentile', rp.percentile, 'total_weighted_points', cs.composite_score))) AS metrics_json,
    s.created_at
   FROM ((public.master_kpi_archive_snapshot s
     LEFT JOIN public.metrics_composite_score_current_v cs ON (((cs.pc_org_id = s.pc_org_id) AND (cs.fiscal_end_date = s.fiscal_end_date) AND (cs.metric_date = s.metric_date) AND (upper(cs.class_type) = upper(s.class_type)) AND (cs.tech_id = s.tech_id))))
     LEFT JOIN public.metrics_rank_partition rp ON (((rp.pc_org_id = s.pc_org_id) AND (rp.fiscal_end_date = s.fiscal_end_date) AND (rp.metric_date = s.metric_date) AND (upper(rp.class_type) = upper(s.class_type)) AND (rp.tech_id = s.tech_id))));


--
-- Name: ui_master_metric_v2_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.ui_master_metric_v2_v AS
 SELECT batch_id,
    pc_org_id,
    pc_org_name,
    metric_date,
    fiscal_end_date,
    class_type,
    person_id,
    tech_id,
    tech_id_list,
    composite_score_v2,
    score_source,
    source_computed_at,
    region_id,
    region_name,
    region_code,
    division_id,
    division_name,
    division_code,
    mso_id,
    mso_name,
    mso_lob,
    direct_reports_to_person_id,
    itg_rollup_person_id,
    status_badge,
    is_outlier,
    rank_company,
    n_company,
    percentile_company,
    rank_region,
    n_region,
    percentile_region,
    rank_division,
    n_division,
    percentile_division,
    rank_supervisor_itg,
    n_supervisor_itg,
    percentile_supervisor_itg,
    rank_supervisor_bp,
    n_supervisor_bp,
    percentile_supervisor_bp,
    rank_org,
    n_org,
    percentile_org,
    sort_rank,
    sort_score
   FROM metrics_vnext.ui_report_frame_v2_v;


--
-- Name: ui_master_metric_v_named_co; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.ui_master_metric_v_named_co AS
 SELECT v.batch_id,
    v.class_type,
    v.pc_org_id,
    v.metric_date,
    v.fiscal_end_date,
    v.tech_id,
    v.person_id,
    v.ownership_mode,
    v.ownership_effective_date,
    v.direct_reports_to_person_id,
    v.itg_rollup_person_id,
    v.office_id,
    v.position_title,
    v.co_ref,
    v.co_code,
    v.affiliation_type,
    v.affiliation_role,
    v.composite_score,
    v.rank_org,
    v.population_size,
    v.status_badge,
    v.is_outlier,
    v.is_totals,
    v.totals_owner_person_id,
    v.metrics_json,
    v.created_at,
        CASE
            WHEN (v.co_ref IS NULL) THEN NULL::text
            WHEN (v.affiliation_role ~~* '%contract%'::text) THEN k.contractor_name
            ELSE c.company_name
        END AS co_display_name
   FROM ((public.ui_master_metric_v v
     LEFT JOIN public.company c ON ((c.company_id = v.co_ref)))
     LEFT JOIN public.contractor k ON ((k.contractor_id = v.co_ref)));


--
-- Name: ui_metrics_report_snapshot_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.ui_metrics_report_snapshot_v AS
 SELECT m.batch_id,
    m.class_type,
    m.pc_org_id,
    m.metric_date,
    m.fiscal_end_date,
    m.tech_id,
    m.person_id,
    p.full_name AS person_name,
    m.ownership_mode,
    m.ownership_effective_date,
    m.direct_reports_to_person_id,
    dr.full_name AS direct_reports_to_name,
    m.itg_rollup_person_id,
    itg.full_name AS itg_rollup_name,
    m.office_id,
    m.position_title,
    m.co_ref,
    m.co_code,
    m.affiliation_type,
    m.affiliation_role,
    m.composite_score,
    m.rank_org,
    m.population_size,
    m.percentile,
    m.status_badge,
    m.is_outlier,
    m.raw_metrics_json,
    m.computed_metrics_json,
    m.created_at
   FROM (((public.master_kpi_archive_snapshot m
     LEFT JOIN public.person p ON ((p.person_id = m.person_id)))
     LEFT JOIN public.person dr ON ((dr.person_id = m.direct_reports_to_person_id)))
     LEFT JOIN public.person itg ON ((itg.person_id = m.itg_rollup_person_id)))
  WHERE (m.is_totals = false);


--
-- Name: ui_p4p_primary3_rollup_v2_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.ui_p4p_primary3_rollup_v2_v AS
 WITH base AS (
         SELECT s_1.pc_org_id,
            s_1.fiscal_end_date,
            s_1.tech_id,
            s_1.person_id,
            s_1.itg_rollup_person_id,
            s_1.direct_reports_to_person_id,
            s_1.co_code AS company_code,
            s_1.metrics_json
           FROM public.ui_master_metric_v s_1
          WHERE ((upper(s_1.class_type) = 'P4P'::text) AND (s_1.is_totals IS FALSE) AND (s_1.ownership_mode = 'ACTIVE'::text))
        ), m AS (
         SELECT b.pc_org_id,
            b.fiscal_end_date,
            b.tech_id,
            b.person_id,
            b.itg_rollup_person_id,
            b.direct_reports_to_person_id,
            b.company_code,
            b.metrics_json,
            COALESCE(((b.metrics_json ->> 'Installs'::text))::numeric, (0)::numeric) AS installs,
            COALESCE(((b.metrics_json ->> 'TCs'::text))::numeric, (0)::numeric) AS tcs,
            COALESCE(((b.metrics_json ->> 'SROs'::text))::numeric, (0)::numeric) AS sros,
            COALESCE(((b.metrics_json ->> 'TUResult'::text))::numeric, (0)::numeric) AS tu_result,
            COALESCE(((b.metrics_json ->> 'TUEligibleJobs'::text))::numeric, (0)::numeric) AS tu_eligible_jobs,
            COALESCE(((b.metrics_json ->> 'Promoters'::text))::numeric, (0)::numeric) AS promoters,
            COALESCE(((b.metrics_json ->> 'Detractors'::text))::numeric, (0)::numeric) AS detractors,
            COALESCE(((b.metrics_json ->> 'tNPS Surveys'::text))::numeric, (0)::numeric) AS tnps_surveys,
            COALESCE(((b.metrics_json ->> 'FTRFailJobs'::text))::numeric, (0)::numeric) AS ftr_fail_jobs,
            COALESCE(((b.metrics_json ->> 'Total FTR/Contact Jobs'::text))::numeric, (0)::numeric) AS total_ftr_contact_jobs,
            COALESCE(((b.metrics_json ->> 'Total Jobs'::text))::numeric, (0)::numeric) AS total_jobs,
            COALESCE(((b.metrics_json ->> 'No Test Taken'::text))::numeric, (0)::numeric) AS no_test_taken,
            COALESCE(((b.metrics_json ->> 'Completed Evals'::text))::numeric, (0)::numeric) AS completed_evals,
            COALESCE(((b.metrics_json ->> 'Ride Along'::text))::numeric, (0)::numeric) AS ride_along,
            COALESCE(((b.metrics_json ->> 'After The Fact'::text))::numeric, (0)::numeric) AS after_the_fact
           FROM base b
        ), rollup_calc AS (
         SELECT x.pc_org_id,
            x.fiscal_end_date,
            x.block_type,
            x.entity_id,
            x.entity_name,
            count(DISTINCT x.tech_id) AS tech_count,
            sum(x.installs) AS installs,
            sum(x.tcs) AS tcs,
            sum(x.sros) AS sros,
            sum(x.tu_result) AS tu_result,
            sum(x.tu_eligible_jobs) AS tu_eligible_jobs,
            sum(x.promoters) AS promoters,
            sum(x.detractors) AS detractors,
            sum(x.tnps_surveys) AS tnps_surveys,
            sum(x.ftr_fail_jobs) AS ftr_fail_jobs,
            sum(x.total_ftr_contact_jobs) AS total_ftr_contact_jobs,
            sum(x.no_test_taken) AS no_test_taken,
            sum(x.completed_evals) AS completed_evals,
            sum(x.ride_along) AS ride_along,
            sum(x.after_the_fact) AS after_the_fact,
            sum(x.total_jobs) AS total_jobs,
                CASE
                    WHEN (sum(x.tnps_surveys) > (0)::numeric) THEN (((sum(x.promoters) - sum(x.detractors)) / NULLIF(sum(x.tnps_surveys), (0)::numeric)) * (100)::numeric)
                    ELSE NULL::numeric
                END AS tnps_rate,
                CASE
                    WHEN (sum(x.total_ftr_contact_jobs) > (0)::numeric) THEN (((1)::numeric - (sum(x.ftr_fail_jobs) / NULLIF(sum(x.total_ftr_contact_jobs), (0)::numeric))) * (100)::numeric)
                    ELSE NULL::numeric
                END AS ftr_rate,
                CASE
                    WHEN (sum(x.tu_eligible_jobs) > (0)::numeric) THEN ((sum(x.tu_result) / NULLIF(sum(x.tu_eligible_jobs), (0)::numeric)) * (100)::numeric)
                    ELSE NULL::numeric
                END AS tool_usage_rate
           FROM ( SELECT m.pc_org_id,
                    m.fiscal_end_date,
                    'REGION'::text AS block_type,
                    (m.pc_org_id)::text AS entity_id,
                    'Region'::text AS entity_name,
                    m.tech_id,
                    m.person_id,
                    m.installs,
                    m.tcs,
                    m.sros,
                    m.tu_result,
                    m.tu_eligible_jobs,
                    m.promoters,
                    m.detractors,
                    m.tnps_surveys,
                    m.ftr_fail_jobs,
                    m.total_ftr_contact_jobs,
                    m.no_test_taken,
                    m.completed_evals,
                    m.ride_along,
                    m.after_the_fact,
                    m.total_jobs
                   FROM m
                UNION ALL
                 SELECT m.pc_org_id,
                    m.fiscal_end_date,
                    'ITG_SUPERVISOR'::text AS text,
                    (m.itg_rollup_person_id)::text AS itg_rollup_person_id,
                    COALESCE(rv.reports_to_full_name, (m.itg_rollup_person_id)::text) AS entity_name,
                    m.tech_id,
                    m.person_id,
                    m.installs,
                    m.tcs,
                    m.sros,
                    m.tu_result,
                    m.tu_eligible_jobs,
                    m.promoters,
                    m.detractors,
                    m.tnps_surveys,
                    m.ftr_fail_jobs,
                    m.total_ftr_contact_jobs,
                    m.no_test_taken,
                    m.completed_evals,
                    m.ride_along,
                    m.after_the_fact,
                    m.total_jobs
                   FROM (m
                     LEFT JOIN public.route_lock_roster_v rv ON (((rv.person_id = m.itg_rollup_person_id) AND (rv.pc_org_id = m.pc_org_id))))
                  WHERE (m.itg_rollup_person_id IS NOT NULL)
                UNION ALL
                 SELECT m.pc_org_id,
                    m.fiscal_end_date,
                    'COMPANY'::text AS text,
                    COALESCE(m.company_code, 'UNKNOWN'::text) AS entity_id,
                    COALESCE(m.company_code, 'UNKNOWN'::text) AS entity_name,
                    m.tech_id,
                    m.person_id,
                    m.installs,
                    m.tcs,
                    m.sros,
                    m.tu_result,
                    m.tu_eligible_jobs,
                    m.promoters,
                    m.detractors,
                    m.tnps_surveys,
                    m.ftr_fail_jobs,
                    m.total_ftr_contact_jobs,
                    m.no_test_taken,
                    m.completed_evals,
                    m.ride_along,
                    m.after_the_fact,
                    m.total_jobs
                   FROM m
                UNION ALL
                 SELECT m.pc_org_id,
                    m.fiscal_end_date,
                    'SUPERVISOR'::text AS text,
                    (m.direct_reports_to_person_id)::text AS direct_reports_to_person_id,
                    COALESCE(rt.reports_to_full_name, (m.direct_reports_to_person_id)::text) AS entity_name,
                    m.tech_id,
                    m.person_id,
                    m.installs,
                    m.tcs,
                    m.sros,
                    m.tu_result,
                    m.tu_eligible_jobs,
                    m.promoters,
                    m.detractors,
                    m.tnps_surveys,
                    m.ftr_fail_jobs,
                    m.total_ftr_contact_jobs,
                    m.no_test_taken,
                    m.completed_evals,
                    m.ride_along,
                    m.after_the_fact,
                    m.total_jobs
                   FROM (m
                     LEFT JOIN public.route_lock_roster_tech_v rt ON (((rt.reports_to_person_id = m.direct_reports_to_person_id) AND (rt.pc_org_id = m.pc_org_id))))
                  WHERE (m.direct_reports_to_person_id IS NOT NULL)) x
          GROUP BY x.pc_org_id, x.fiscal_end_date, x.block_type, x.entity_id, x.entity_name
        ), ranked AS (
         SELECT r.pc_org_id,
            r.fiscal_end_date,
            r.block_type,
            r.entity_id,
            r.entity_name,
            r.tech_count,
            r.installs,
            r.tcs,
            r.sros,
            r.tu_result,
            r.tu_eligible_jobs,
            r.promoters,
            r.detractors,
            r.tnps_surveys,
            r.ftr_fail_jobs,
            r.total_ftr_contact_jobs,
            r.no_test_taken,
            r.completed_evals,
            r.ride_along,
            r.after_the_fact,
            r.total_jobs,
            r.tnps_rate,
            r.ftr_rate,
            r.tool_usage_rate,
            dense_rank() OVER (PARTITION BY r.pc_org_id, r.fiscal_end_date, r.block_type ORDER BY r.tnps_rate DESC NULLS LAST, r.entity_name) AS rank_tnps,
            dense_rank() OVER (PARTITION BY r.pc_org_id, r.fiscal_end_date, r.block_type ORDER BY r.ftr_rate DESC NULLS LAST, r.entity_name) AS rank_ftr,
            dense_rank() OVER (PARTITION BY r.pc_org_id, r.fiscal_end_date, r.block_type ORDER BY r.tool_usage_rate DESC NULLS LAST, r.entity_name) AS rank_tool
           FROM rollup_calc r
        ), scored AS (
         SELECT r.pc_org_id,
            r.fiscal_end_date,
            r.block_type,
            r.entity_id,
            r.entity_name,
            r.tech_count,
            r.installs,
            r.tcs,
            r.sros,
            r.tu_result,
            r.tu_eligible_jobs,
            r.promoters,
            r.detractors,
            r.tnps_surveys,
            r.ftr_fail_jobs,
            r.total_ftr_contact_jobs,
            r.no_test_taken,
            r.completed_evals,
            r.ride_along,
            r.after_the_fact,
            r.total_jobs,
            r.tnps_rate,
            r.ftr_rate,
            r.tool_usage_rate,
            r.rank_tnps,
            r.rank_ftr,
            r.rank_tool,
            ((0.35 * (r.rank_tnps)::numeric))::numeric(10,3) AS ws_tnps,
            ((0.35 * (r.rank_ftr)::numeric))::numeric(10,3) AS ws_ftr,
            ((0.30 * (r.rank_tool)::numeric))::numeric(10,3) AS ws_tool,
            ((((0.35 * (r.rank_tnps)::numeric) + (0.35 * (r.rank_ftr)::numeric)) + (0.30 * (r.rank_tool)::numeric)))::numeric(10,3) AS weighted_score
           FROM ranked r
        )
 SELECT pc_org_id,
    fiscal_end_date,
    block_type,
    entity_id,
    entity_name,
    dense_rank() OVER (PARTITION BY pc_org_id, fiscal_end_date, block_type ORDER BY weighted_score, entity_name) AS rank_overall,
    tech_count AS "#_techs",
    tnps_rate AS tnps,
    ftr_rate AS ftr,
    tool_usage_rate AS tool_usage,
    installs,
    tcs,
    sros,
    tu_result,
    tu_eligible_jobs,
    promoters,
    detractors,
    tnps_surveys,
    ftr_fail_jobs,
    total_ftr_contact_jobs,
    total_jobs AS jobcount,
    no_test_taken,
    completed_evals,
    ride_along,
    after_the_fact,
    rank_tnps,
    rank_ftr,
    rank_tool,
    ws_tnps,
    ws_ftr,
    ws_tool,
    weighted_score,
    total_jobs
   FROM scored s;


--
-- Name: user_pc_org_eligibility; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_pc_org_eligibility (
    auth_user_id uuid NOT NULL,
    pc_org_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_pc_scope; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_pc_scope (
    user_id uuid NOT NULL,
    pc_org_id uuid NOT NULL,
    source text DEFAULT 'manual'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_person_link; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_person_link (
    user_id uuid NOT NULL,
    person_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_role; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_role (
    user_id uuid NOT NULL,
    role_key text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    auth_user_id uuid NOT NULL,
    role_key text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: v_company_profile_enriched; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_company_profile_enriched AS
 SELECT f.profile_fact_id,
    f.person_id,
    p.full_name,
    p.preferred_name,
    p.status AS person_status,
    f.pc_org_id,
    f.position_title,
    pt.role_type,
    COALESCE(pt.is_field, false) AS is_field,
    COALESCE(pt.is_leadership, false) AS is_leadership,
    COALESCE(pt.allows_tech, false) AS allows_tech,
    f.tech_id,
    parent_assignment.person_id AS reports_to_person_id,
    parent_person.full_name AS reports_to_full_name,
    f.effective_start_date,
    f.effective_end_date,
    f.active_flag,
    ((f.position_title IS NULL) OR (btrim(f.position_title) = ''::text) OR ((COALESCE(pt.allows_tech, false) = true) AND ((f.tech_id IS NULL) OR (btrim(f.tech_id) = ''::text))) OR (parent_assignment.person_id IS NULL)) AS is_incomplete,
    f.created_at,
    f.updated_at
   FROM (((((((core.company_profile_fact f
     LEFT JOIN core.people p ON ((p.person_id = f.person_id)))
     LEFT JOIN public.position_title pt ON ((pt.position_title = f.position_title)))
     LEFT JOIN core.workspaces w ON ((w.legacy_pc_org_id = f.pc_org_id)))
     LEFT JOIN LATERAL ( SELECT a.assignment_id,
            a.person_id,
            a.workspace_id,
            a.tech_id,
            a.start_date,
            a.end_date
           FROM core.assignments a
          WHERE ((a.person_id = f.person_id) AND (a.workspace_id = w.workspace_id) AND (a.start_date <= f.effective_start_date) AND ((a.end_date IS NULL) OR (a.end_date >= f.effective_start_date)) AND ((f.tech_id IS NULL) OR (btrim(f.tech_id) = ''::text) OR (a.tech_id = f.tech_id)))
          ORDER BY
                CASE
                    WHEN ((f.tech_id IS NOT NULL) AND (a.tech_id = f.tech_id)) THEN 0
                    ELSE 1
                END, a.start_date DESC, a.assignment_id
         LIMIT 1) child_assignment ON (true))
     LEFT JOIN LATERAL ( SELECT rl.parent_assignment_id,
            rl.effective_start,
            rl.effective_end
           FROM core.reporting_lines rl
          WHERE ((rl.child_assignment_id = child_assignment.assignment_id) AND (rl.workspace_id = child_assignment.workspace_id) AND (rl.effective_start <= f.effective_start_date) AND ((rl.effective_end IS NULL) OR (rl.effective_end >= f.effective_start_date)))
          ORDER BY rl.effective_start DESC, rl.reporting_line_id
         LIMIT 1) active_reporting_line ON (true))
     LEFT JOIN core.assignments parent_assignment ON ((parent_assignment.assignment_id = active_reporting_line.parent_assignment_id)))
     LEFT JOIN core.people parent_person ON ((parent_person.person_id = parent_assignment.person_id)));


--
-- Name: v_company_profile_fact; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_company_profile_fact AS
 SELECT profile_fact_id,
    person_id,
    pc_org_id,
    position_title,
    tech_id,
    reports_to_person_id,
    effective_start_date,
    effective_end_date,
    active_flag,
    created_at,
    updated_at
   FROM core.company_profile_fact;


--
-- Name: v_metrics_active_population; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_metrics_active_population AS
 SELECT m.archive_snapshot_id,
    m.batch_id,
    m.class_type,
    m.pc_org_id,
    m.metric_date,
    m.fiscal_end_date,
    m.tech_id,
    m.person_id,
    m.ownership_mode,
    m.ownership_effective_date,
    m.direct_reports_to_person_id,
    m.itg_rollup_person_id,
    m.office_id,
    m.position_title,
    m.co_ref,
    m.co_code,
    m.affiliation_type,
    m.affiliation_role,
    m.composite_score,
    m.rank_org,
    m.population_size,
    m.status_badge,
    m.is_outlier,
    m.created_at,
    m.is_totals,
    m.totals_owner_person_id,
    m.raw_metrics_json,
    m.computed_metrics_json,
    m.percentile,
    a.assignment_id,
    a.person_id AS assignment_person_id,
    r.person_id AS roster_person_id,
    r.pc_org_id AS roster_pc_org_id
   FROM ((public.master_kpi_archive_snapshot m
     JOIN public.assignment a ON (((a.pc_org_id = m.pc_org_id) AND (a.tech_id = m.tech_id) AND (COALESCE(a.active, true) = true) AND (a.end_date IS NULL))))
     JOIN public.v_roster_active r ON (((r.pc_org_id = m.pc_org_id) AND (r.person_id = a.person_id))))
  WHERE (m.is_totals = false);


--
-- Name: v_person_core; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_person_core AS
 SELECT cp.person_id,
    cp.full_name,
    pp.emails,
    pp.mobile,
    pp.fuse_emp_id,
    pp.person_notes,
    pp.person_nt_login,
    pp.person_csg_id,
    (cp.status = 'active'::text) AS active,
    pp.role,
    COALESCE(cp.prospecting_affiliation_id, pp.co_ref_id) AS co_ref_id,
    cp.prospecting_affiliation_id,
    pp.co_code
   FROM (core.people cp
     LEFT JOIN public.person pp ON ((pp.person_id = cp.person_id)));


--
-- Name: v_person_workspace_membership; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_person_workspace_membership AS
 SELECT ppo.person_id,
    ppo.pc_org_id,
    pc.pc_org_name,
    pc.region_id,
    cw.workspace_id,
    cw.workspace_key,
    cw.workspace_name,
    cw.status AS workspace_status,
    ppo.status AS membership_status,
    ppo.active AS membership_active,
    ppo.start_date,
    ppo.end_date
   FROM ((public.person_pc_org ppo
     LEFT JOIN public.pc_org pc ON ((pc.pc_org_id = ppo.pc_org_id)))
     LEFT JOIN core.workspaces cw ON ((cw.legacy_pc_org_id = ppo.pc_org_id)));


--
-- Name: v_route_lock_schedule_enriched; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_route_lock_schedule_enriched AS
 SELECT s.pc_org_id,
    s.shift_date,
    s.tech_id,
    s.fiscal_month_id,
    s.assignment_id,
    s.planned_hours,
    s.planned_units,
    s.plan_source,
    a.person_id,
    COALESCE(cpf.role_type, 'FIELD'::text) AS role_type
   FROM ((public.schedule_day_fact s
     LEFT JOIN core.assignments a ON ((a.assignment_id = s.assignment_id)))
     LEFT JOIN public.company_profile_fact cpf ON (((cpf.person_id = a.person_id) AND (cpf.pc_org_id = s.pc_org_id) AND (cpf.effective_start_date <= s.shift_date) AND ((cpf.effective_end_date IS NULL) OR (cpf.effective_end_date >= s.shift_date)))));


--
-- Name: workforce_person_identity_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.workforce_person_identity_v AS
 WITH contact_pivot AS (
         SELECT pc.person_id,
            max(pc.contact_value) FILTER (WHERE ((pc.contact_type = 'phone'::text) AND (pc.is_primary = true))) AS primary_phone,
            max(pc.contact_value) FILTER (WHERE (pc.contact_type = 'phone'::text)) AS any_phone,
            max(pc.contact_value) FILTER (WHERE ((pc.contact_type = 'email'::text) AND (pc.is_primary = true))) AS primary_email,
            max(pc.contact_value) FILTER (WHERE (pc.contact_type = 'email'::text)) AS any_email
           FROM core.person_contacts pc
          GROUP BY pc.person_id
        ), identifier_pivot AS (
         SELECT pi.person_id,
            max(pi.identifier_value) FILTER (WHERE ((pi.identifier_type = 'TECH_ID'::text) AND (pi.is_primary = true))) AS primary_tech_id,
            max(pi.identifier_value) FILTER (WHERE (pi.identifier_type = 'TECH_ID'::text)) AS any_tech_id,
            max(pi.identifier_value) FILTER (WHERE ((pi.identifier_type = 'NT_LOGIN'::text) AND (pi.is_primary = true))) AS primary_nt_login,
            max(pi.identifier_value) FILTER (WHERE (pi.identifier_type = 'NT_LOGIN'::text)) AS any_nt_login,
            max(pi.identifier_value) FILTER (WHERE ((pi.identifier_type = ANY (ARRAY['CSG_ID'::text, 'CSG'::text])) AND (pi.is_primary = true))) AS primary_csg,
            max(pi.identifier_value) FILTER (WHERE (pi.identifier_type = ANY (ARRAY['CSG_ID'::text, 'CSG'::text]))) AS any_csg
           FROM core.person_identifiers pi
          GROUP BY pi.person_id
        )
 SELECT p.person_id,
    p.full_name,
    p.legal_name,
    p.preferred_name,
    p.status,
    COALESCE(cp.primary_phone, cp.any_phone) AS mobile,
    COALESCE(cp.primary_email, cp.any_email) AS email,
    COALESCE(ip.primary_tech_id, ip.any_tech_id) AS tech_id,
    COALESCE(ip.primary_nt_login, ip.any_nt_login) AS nt_login,
    COALESCE(ip.primary_csg, ip.any_csg) AS csg
   FROM ((core.people p
     LEFT JOIN contact_pivot cp ON ((cp.person_id = p.person_id)))
     LEFT JOIN identifier_pivot ip ON ((ip.person_id = p.person_id)));


--
-- Name: workforce_reporting_audit_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.workforce_reporting_audit_v AS
 SELECT a.assignment_id,
    a.person_id,
    p.full_name,
    p.status AS person_status,
    a.tech_id,
    a.position_title,
    a.reports_to_assignment_id,
    parent.person_id AS reports_to_person_id,
    parent_person.full_name AS reports_to_name,
    parent.position_title AS reports_to_position_title,
    w.legacy_pc_org_id AS pc_org_id,
    po.pc_org_name,
    a.office_id,
    o.office_name,
    a.assignment_status,
    a.start_date,
    a.end_date,
        CASE
            WHEN ((upper(COALESCE(a.position_title, ''::text)) ~~ '%SUPERVISOR%'::text) OR (upper(COALESCE(a.position_title, ''::text)) ~~ '%MANAGER%'::text) OR (upper(COALESCE(a.position_title, ''::text)) ~~ '%OWNER%'::text) OR (upper(COALESCE(a.position_title, ''::text)) ~~ '%LEAD%'::text) OR (upper(COALESCE(a.position_title, ''::text)) ~~ '%DIRECTOR%'::text)) THEN 'LEADERSHIP'::text
            WHEN ((upper(COALESCE(a.position_title, ''::text)) ~~ '%DROP BURY%'::text) OR (upper(COALESCE(a.position_title, ''::text)) ~~ '%DROP_BURY%'::text) OR (upper(COALESCE(a.position_title, ''::text)) ~~ '%DROP-BURY%'::text)) THEN 'DROP_BURY'::text
            WHEN ((upper(COALESCE(a.position_title, ''::text)) ~~ '%TECHNICIAN%'::text) OR (upper(COALESCE(a.position_title, ''::text)) ~~ '%FIELD%'::text)) THEN 'FIELD'::text
            ELSE 'SUPPORT'::text
        END AS seat_type
   FROM ((((((core.assignments a
     JOIN core.workspaces w ON ((w.workspace_id = a.workspace_id)))
     LEFT JOIN core.people p ON ((p.person_id = a.person_id)))
     LEFT JOIN core.assignments parent ON ((parent.assignment_id = a.reports_to_assignment_id)))
     LEFT JOIN core.people parent_person ON ((parent_person.person_id = parent.person_id)))
     LEFT JOIN public.pc_org po ON ((po.pc_org_id = w.legacy_pc_org_id)))
     LEFT JOIN public.office o ON ((o.office_id = a.office_id)))
  WHERE ((a.assignment_status = 'active'::text) AND (a.start_date <= CURRENT_DATE) AND ((a.end_date IS NULL) OR (a.end_date >= CURRENT_DATE)));


--
-- Name: workforce_supervisor_audit_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.workforce_supervisor_audit_v AS
 WITH base AS (
         SELECT workforce_reporting_audit_v.reports_to_person_id,
            workforce_reporting_audit_v.reports_to_name,
            workforce_reporting_audit_v.seat_type
           FROM public.workforce_reporting_audit_v
          WHERE (workforce_reporting_audit_v.reports_to_person_id IS NOT NULL)
        ), agg AS (
         SELECT base.reports_to_person_id,
            base.reports_to_name,
            count(*) FILTER (WHERE (base.seat_type = 'FIELD'::text)) AS field,
            count(*) FILTER (WHERE (base.seat_type = 'TRAVEL'::text)) AS travel,
            count(*) FILTER (WHERE (base.seat_type = 'DROP_BURY'::text)) AS drop_bury,
            count(*) FILTER (WHERE (base.seat_type = 'LEADERSHIP'::text)) AS leadership,
            count(*) FILTER (WHERE (base.seat_type = 'SUPPORT'::text)) AS support,
            count(*) AS total_chain
           FROM base
          GROUP BY base.reports_to_person_id, base.reports_to_name
        )
 SELECT reports_to_person_id,
    reports_to_name,
    COALESCE(field, (0)::bigint) AS field,
    COALESCE(travel, (0)::bigint) AS travel,
    COALESCE(drop_bury, (0)::bigint) AS drop_bury,
    COALESCE(leadership, (0)::bigint) AS leadership,
    COALESCE(support, (0)::bigint) AS support,
    (COALESCE(field, (0)::bigint) + COALESCE(travel, (0)::bigint)) AS metrics_hc,
    total_chain,
    (total_chain - (COALESCE(field, (0)::bigint) + COALESCE(travel, (0)::bigint))) AS drift
   FROM agg
  ORDER BY total_chain DESC;


--
-- Name: admin_permission_grant_audit audit_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_permission_grant_audit ALTER COLUMN audit_id SET DEFAULT nextval('public.admin_permission_grant_audit_audit_id_seq'::regclass);


--
-- Name: pc_org_permission_grant_audit audit_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pc_org_permission_grant_audit ALTER COLUMN audit_id SET DEFAULT nextval('public.pc_org_permission_grant_audit_audit_id_seq'::regclass);


--
-- Name: rpc_policy rpc_policy_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rpc_policy ALTER COLUMN rpc_policy_id SET DEFAULT nextval('public.rpc_policy_rpc_policy_id_seq'::regclass);


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (activity_log_id);


--
-- Name: app_users app_users_auth_user_id_key; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.app_users
    ADD CONSTRAINT app_users_auth_user_id_key UNIQUE (auth_user_id);


--
-- Name: app_users app_users_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.app_users
    ADD CONSTRAINT app_users_pkey PRIMARY KEY (app_user_id);


--
-- Name: assignment_events assignment_events_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.assignment_events
    ADD CONSTRAINT assignment_events_pkey PRIMARY KEY (assignment_event_id);


--
-- Name: assignments assignments_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.assignments
    ADD CONSTRAINT assignments_pkey PRIMARY KEY (assignment_id);


--
-- Name: company_profile_fact company_profile_fact_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.company_profile_fact
    ADD CONSTRAINT company_profile_fact_pkey PRIMARY KEY (profile_fact_id);


--
-- Name: memberships core_memberships_workspace_user_uk; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.memberships
    ADD CONSTRAINT core_memberships_workspace_user_uk UNIQUE (workspace_id, app_user_id);


--
-- Name: metric_facts core_metric_facts_uk; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.metric_facts
    ADD CONSTRAINT core_metric_facts_uk UNIQUE (metric_batch_id, tech_id, metric_key);


--
-- Name: metric_profile_rules core_metric_profile_rules_uk; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.metric_profile_rules
    ADD CONSTRAINT core_metric_profile_rules_uk UNIQUE (metric_profile_id, metric_key);


--
-- Name: person_identifiers core_person_identifiers_unique_type_per_person; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.person_identifiers
    ADD CONSTRAINT core_person_identifiers_unique_type_per_person UNIQUE (person_id, identifier_type);


--
-- Name: home_workspace_preference home_workspace_preference_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.home_workspace_preference
    ADD CONSTRAINT home_workspace_preference_pkey PRIMARY KEY (workspace_id);


--
-- Name: membership_roles membership_roles_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.membership_roles
    ADD CONSTRAINT membership_roles_pkey PRIMARY KEY (membership_role_id);


--
-- Name: memberships memberships_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.memberships
    ADD CONSTRAINT memberships_pkey PRIMARY KEY (membership_id);


--
-- Name: metric_batch_events metric_batch_events_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.metric_batch_events
    ADD CONSTRAINT metric_batch_events_pkey PRIMARY KEY (metric_batch_event_id);


--
-- Name: metric_batches metric_batches_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.metric_batches
    ADD CONSTRAINT metric_batches_pkey PRIMARY KEY (metric_batch_id);


--
-- Name: metric_definitions metric_definitions_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.metric_definitions
    ADD CONSTRAINT metric_definitions_pkey PRIMARY KEY (metric_key);


--
-- Name: metric_facts metric_facts_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.metric_facts
    ADD CONSTRAINT metric_facts_pkey PRIMARY KEY (metric_fact_id);


--
-- Name: metric_profile_rules metric_profile_rules_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.metric_profile_rules
    ADD CONSTRAINT metric_profile_rules_pkey PRIMARY KEY (metric_profile_rule_id);


--
-- Name: metric_profiles metric_profiles_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.metric_profiles
    ADD CONSTRAINT metric_profiles_pkey PRIMARY KEY (metric_profile_id);


--
-- Name: metric_profiles metric_profiles_profile_key_key; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.metric_profiles
    ADD CONSTRAINT metric_profiles_profile_key_key UNIQUE (profile_key);


--
-- Name: metric_rows metric_rows_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.metric_rows
    ADD CONSTRAINT metric_rows_pkey PRIMARY KEY (metric_row_id);


--
-- Name: metric_scores_fact metric_scores_fact_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.metric_scores_fact
    ADD CONSTRAINT metric_scores_fact_pkey PRIMARY KEY (metric_batch_id, tech_id, profile_key, metric_key);


--
-- Name: metric_total_rows metric_total_rows_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.metric_total_rows
    ADD CONSTRAINT metric_total_rows_pkey PRIMARY KEY (metric_total_row_id);


--
-- Name: metric_total_rows metric_total_rows_unique_row_key_key; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.metric_total_rows
    ADD CONSTRAINT metric_total_rows_unique_row_key_key UNIQUE (unique_row_key);


--
-- Name: people people_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.people
    ADD CONSTRAINT people_pkey PRIMARY KEY (person_id);


--
-- Name: person_contacts person_contacts_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.person_contacts
    ADD CONSTRAINT person_contacts_pkey PRIMARY KEY (person_contact_id);


--
-- Name: person_identifiers person_identifiers_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.person_identifiers
    ADD CONSTRAINT person_identifiers_pkey PRIMARY KEY (person_identifier_id);


--
-- Name: reporting_lines reporting_lines_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.reporting_lines
    ADD CONSTRAINT reporting_lines_pkey PRIMARY KEY (reporting_line_id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (role_id);


--
-- Name: roles roles_role_key_key; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.roles
    ADD CONSTRAINT roles_role_key_key UNIQUE (role_key);


--
-- Name: workspaces workspaces_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.workspaces
    ADD CONSTRAINT workspaces_pkey PRIMARY KEY (workspace_id);


--
-- Name: workspaces workspaces_workspace_key_key; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.workspaces
    ADD CONSTRAINT workspaces_workspace_key_key UNIQUE (workspace_key);


--
-- Name: admin_permission_grant_audit admin_permission_grant_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_permission_grant_audit
    ADD CONSTRAINT admin_permission_grant_audit_pkey PRIMARY KEY (audit_id);


--
-- Name: admin_permission_grant admin_permission_grant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_permission_grant
    ADD CONSTRAINT admin_permission_grant_pkey PRIMARY KEY (admin_permission_grant_id);


--
-- Name: app_access_session_fact app_access_session_fact_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_access_session_fact
    ADD CONSTRAINT app_access_session_fact_pkey PRIMARY KEY (session_fact_id);


--
-- Name: app_access_session_fact app_access_session_fact_unique_scope; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_access_session_fact
    ADD CONSTRAINT app_access_session_fact_unique_scope UNIQUE (auth_user_id, person_id, pc_org_id);


--
-- Name: app_owners app_owners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_owners
    ADD CONSTRAINT app_owners_pkey PRIMARY KEY (auth_user_id);


--
-- Name: assignment assignment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignment
    ADD CONSTRAINT assignment_pkey PRIMARY KEY (assignment_id);


--
-- Name: assignment_reporting assignment_reporting_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignment_reporting
    ADD CONSTRAINT assignment_reporting_pkey PRIMARY KEY (assignment_reporting_id);


--
-- Name: calendar_blackout_rule calendar_blackout_rule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_blackout_rule
    ADD CONSTRAINT calendar_blackout_rule_pkey PRIMARY KEY (blackout_rule_id);


--
-- Name: calendar_holiday_baseline calendar_holiday_baseline_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_holiday_baseline
    ADD CONSTRAINT calendar_holiday_baseline_pkey PRIMARY KEY (holiday_id);


--
-- Name: calendar_holiday_baseline calendar_holiday_baseline_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_holiday_baseline
    ADD CONSTRAINT calendar_holiday_baseline_unique UNIQUE (country_code, holiday_date, holiday_name);


--
-- Name: check_in_batch check_in_batch_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.check_in_batch
    ADD CONSTRAINT check_in_batch_pkey PRIMARY KEY (check_in_batch_id);


--
-- Name: check_in_day_fact check_in_day_fact_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.check_in_day_fact
    ADD CONSTRAINT check_in_day_fact_pk PRIMARY KEY (pc_org_id, shift_date, tech_id);


--
-- Name: check_in_job_row check_in_job_row_natural_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.check_in_job_row
    ADD CONSTRAINT check_in_job_row_natural_key UNIQUE (pc_org_id, job_num, cp_date, tech_id);


--
-- Name: check_in_job_row check_in_job_row_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.check_in_job_row
    ADD CONSTRAINT check_in_job_row_pkey PRIMARY KEY (check_in_job_row_id);


--
-- Name: company company_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company
    ADD CONSTRAINT company_pkey PRIMARY KEY (company_id);


--
-- Name: company_profile_fact company_profile_fact_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_profile_fact
    ADD CONSTRAINT company_profile_fact_pkey PRIMARY KEY (company_profile_id);


--
-- Name: contractor_assignment contractor_assignment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contractor_assignment
    ADD CONSTRAINT contractor_assignment_pkey PRIMARY KEY (contractor_assignment_id);


--
-- Name: contractor contractor_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contractor
    ADD CONSTRAINT contractor_pkey PRIMARY KEY (contractor_id);


--
-- Name: dispatch_console_log_audit dispatch_console_log_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispatch_console_log_audit
    ADD CONSTRAINT dispatch_console_log_audit_pkey PRIMARY KEY (dispatch_console_log_audit_id);


--
-- Name: dispatch_console_log dispatch_console_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispatch_console_log
    ADD CONSTRAINT dispatch_console_log_pkey PRIMARY KEY (dispatch_console_log_id);


--
-- Name: dispatch_day_tech dispatch_day_tech_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispatch_day_tech
    ADD CONSTRAINT dispatch_day_tech_pk PRIMARY KEY (pc_org_id, shift_date, assignment_id);


--
-- Name: dispatch_schedule_action_queue dispatch_schedule_action_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispatch_schedule_action_queue
    ADD CONSTRAINT dispatch_schedule_action_queue_pkey PRIMARY KEY (dispatch_schedule_action_id);


--
-- Name: division division_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.division
    ADD CONSTRAINT division_pkey PRIMARY KEY (division_id);


--
-- Name: exec_pc_org_access_derived exec_pc_org_access_derived_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exec_pc_org_access_derived
    ADD CONSTRAINT exec_pc_org_access_derived_pkey PRIMARY KEY (leader_person_id, pc_org_id);


--
-- Name: field_input_map field_input_map_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_input_map
    ADD CONSTRAINT field_input_map_pkey PRIMARY KEY (table_name, column_name);


--
-- Name: field_log_attachment field_log_attachment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_attachment
    ADD CONSTRAINT field_log_attachment_pkey PRIMARY KEY (attachment_id);


--
-- Name: field_log_billing_email_log field_log_billing_email_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_billing_email_log
    ADD CONSTRAINT field_log_billing_email_log_pkey PRIMARY KEY (id);


--
-- Name: field_log_billing_email_recipient field_log_billing_email_recipient_pc_org_id_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_billing_email_recipient
    ADD CONSTRAINT field_log_billing_email_recipient_pc_org_id_email_key UNIQUE (pc_org_id, email);


--
-- Name: field_log_billing_email_recipient field_log_billing_email_recipient_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_billing_email_recipient
    ADD CONSTRAINT field_log_billing_email_recipient_pkey PRIMARY KEY (id);


--
-- Name: field_log_category field_log_category_config_version_id_category_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_category
    ADD CONSTRAINT field_log_category_config_version_id_category_key_key UNIQUE (config_version_id, category_key);


--
-- Name: field_log_category field_log_category_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_category
    ADD CONSTRAINT field_log_category_pkey PRIMARY KEY (category_id);


--
-- Name: field_log_comment field_log_comment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_comment
    ADD CONSTRAINT field_log_comment_pkey PRIMARY KEY (id);


--
-- Name: field_log_config_version field_log_config_version_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_config_version
    ADD CONSTRAINT field_log_config_version_pkey PRIMARY KEY (config_version_id);


--
-- Name: field_log_event field_log_event_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_event
    ADD CONSTRAINT field_log_event_pkey PRIMARY KEY (field_log_event_id);


--
-- Name: field_log_photo_label field_log_photo_label_config_version_id_photo_label_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_photo_label
    ADD CONSTRAINT field_log_photo_label_config_version_id_photo_label_key_key UNIQUE (config_version_id, photo_label_key);


--
-- Name: field_log_photo_label field_log_photo_label_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_photo_label
    ADD CONSTRAINT field_log_photo_label_pkey PRIMARY KEY (photo_label_id);


--
-- Name: field_log_report_not_done field_log_report_not_done_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_report_not_done
    ADD CONSTRAINT field_log_report_not_done_pkey PRIMARY KEY (report_id);


--
-- Name: field_log_report field_log_report_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_report
    ADD CONSTRAINT field_log_report_pkey PRIMARY KEY (report_id);


--
-- Name: field_log_report_post_call field_log_report_post_call_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_report_post_call
    ADD CONSTRAINT field_log_report_post_call_pkey PRIMARY KEY (report_id);


--
-- Name: field_log_report_qc field_log_report_qc_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_report_qc
    ADD CONSTRAINT field_log_report_qc_pkey PRIMARY KEY (report_id);


--
-- Name: field_log_review_action field_log_review_action_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_review_action
    ADD CONSTRAINT field_log_review_action_pkey PRIMARY KEY (review_action_id);


--
-- Name: field_log_rule field_log_rule_config_version_id_category_key_subcategory_k_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_rule
    ADD CONSTRAINT field_log_rule_config_version_id_category_key_subcategory_k_key UNIQUE (config_version_id, category_key, subcategory_key);


--
-- Name: field_log_rule_context field_log_rule_context_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_rule_context
    ADD CONSTRAINT field_log_rule_context_pkey PRIMARY KEY (rule_context_id);


--
-- Name: field_log_rule_context field_log_rule_context_uniq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_rule_context
    ADD CONSTRAINT field_log_rule_context_uniq UNIQUE (config_version_id, submission_type_key, job_type, situation_key);


--
-- Name: field_log_rule_photo_requirement field_log_rule_photo_requirement_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_rule_photo_requirement
    ADD CONSTRAINT field_log_rule_photo_requirement_pkey PRIMARY KEY (rule_photo_requirement_id);


--
-- Name: field_log_rule_photo_requirement field_log_rule_photo_requirement_rule_id_photo_label_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_rule_photo_requirement
    ADD CONSTRAINT field_log_rule_photo_requirement_rule_id_photo_label_key_key UNIQUE (rule_id, photo_label_key);


--
-- Name: field_log_rule field_log_rule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_rule
    ADD CONSTRAINT field_log_rule_pkey PRIMARY KEY (rule_id);


--
-- Name: field_log_rule_u_code_config field_log_rule_u_code_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_rule_u_code_config
    ADD CONSTRAINT field_log_rule_u_code_config_pkey PRIMARY KEY (rule_id);


--
-- Name: field_log_subcategory field_log_subcategory_config_version_id_category_key_subcat_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_subcategory
    ADD CONSTRAINT field_log_subcategory_config_version_id_category_key_subcat_key UNIQUE (config_version_id, category_key, subcategory_key);


--
-- Name: field_log_subcategory field_log_subcategory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_subcategory
    ADD CONSTRAINT field_log_subcategory_pkey PRIMARY KEY (subcategory_id);


--
-- Name: field_log_u_code field_log_u_code_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_u_code
    ADD CONSTRAINT field_log_u_code_pkey PRIMARY KEY (code);


--
-- Name: field_log_ucode field_log_ucode_config_version_id_ucode_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_ucode
    ADD CONSTRAINT field_log_ucode_config_version_id_ucode_key UNIQUE (config_version_id, ucode);


--
-- Name: field_log_ucode_group field_log_ucode_group_config_version_id_ucode_group_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_ucode_group
    ADD CONSTRAINT field_log_ucode_group_config_version_id_ucode_group_key_key UNIQUE (config_version_id, ucode_group_key);


--
-- Name: field_log_ucode_group_item field_log_ucode_group_item_config_version_id_ucode_group_ke_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_ucode_group_item
    ADD CONSTRAINT field_log_ucode_group_item_config_version_id_ucode_group_ke_key UNIQUE (config_version_id, ucode_group_key, ucode);


--
-- Name: field_log_ucode_group_item field_log_ucode_group_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_ucode_group_item
    ADD CONSTRAINT field_log_ucode_group_item_pkey PRIMARY KEY (ucode_group_item_id);


--
-- Name: field_log_ucode_group field_log_ucode_group_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_ucode_group
    ADD CONSTRAINT field_log_ucode_group_pkey PRIMARY KEY (ucode_group_id);


--
-- Name: field_log_ucode field_log_ucode_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_ucode
    ADD CONSTRAINT field_log_ucode_pkey PRIMARY KEY (ucode_id);


--
-- Name: fiscal_month_dim fiscal_month_dim_month_key_ux; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fiscal_month_dim
    ADD CONSTRAINT fiscal_month_dim_month_key_ux UNIQUE (month_key);


--
-- Name: fiscal_month_dim fiscal_month_dim_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fiscal_month_dim
    ADD CONSTRAINT fiscal_month_dim_pkey PRIMARY KEY (fiscal_month_id);


--
-- Name: fiscal_month_dim fiscal_month_dim_start_date_ux; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fiscal_month_dim
    ADD CONSTRAINT fiscal_month_dim_start_date_ux UNIQUE (start_date);


--
-- Name: fuse_onboarding_import_batch fuse_onboarding_import_batch_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuse_onboarding_import_batch
    ADD CONSTRAINT fuse_onboarding_import_batch_pkey PRIMARY KEY (batch_id);


--
-- Name: fuse_onboarding_import_row fuse_onboarding_import_row_batch_id_row_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuse_onboarding_import_row
    ADD CONSTRAINT fuse_onboarding_import_row_batch_id_row_number_key UNIQUE (batch_id, row_number);


--
-- Name: fuse_onboarding_import_row fuse_onboarding_import_row_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuse_onboarding_import_row
    ADD CONSTRAINT fuse_onboarding_import_row_pkey PRIMARY KEY (row_id);


--
-- Name: locate_cotp_report_row locate_cotp_report_row_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locate_cotp_report_row
    ADD CONSTRAINT locate_cotp_report_row_pkey PRIMARY KEY (locate_cotp_report_row_id);


--
-- Name: locate_daily_call_log locate_daily_call_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locate_daily_call_log
    ADD CONSTRAINT locate_daily_call_log_pkey PRIMARY KEY (locate_daily_call_log_id);


--
-- Name: locate_daily_call_log locate_daily_call_log_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locate_daily_call_log
    ADD CONSTRAINT locate_daily_call_log_unique UNIQUE (log_date, state_code);


--
-- Name: locate_metric_observation locate_metric_observation_metric_key_state_code_observation_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locate_metric_observation
    ADD CONSTRAINT locate_metric_observation_metric_key_state_code_observation_key UNIQUE (metric_key, state_code, observation_date, observation_status);


--
-- Name: locate_metric_observation locate_metric_observation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locate_metric_observation
    ADD CONSTRAINT locate_metric_observation_pkey PRIMARY KEY (locate_metric_observation_id);


--
-- Name: locate_reporting_record locate_reporting_record_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locate_reporting_record
    ADD CONSTRAINT locate_reporting_record_pkey PRIMARY KEY (locate_reporting_record_id);


--
-- Name: locate_state_resource locate_state_resource_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locate_state_resource
    ADD CONSTRAINT locate_state_resource_pkey PRIMARY KEY (state_code);


--
-- Name: master_kpi_archive_metric master_kpi_archive_metric_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_kpi_archive_metric
    ADD CONSTRAINT master_kpi_archive_metric_pkey PRIMARY KEY (archive_metric_id);


--
-- Name: master_kpi_archive_snapshot master_kpi_archive_snapshot_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_kpi_archive_snapshot
    ADD CONSTRAINT master_kpi_archive_snapshot_pkey PRIMARY KEY (archive_snapshot_id);


--
-- Name: metrics_band_style_selection metrics_band_style_selection_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metrics_band_style_selection
    ADD CONSTRAINT metrics_band_style_selection_pkey PRIMARY KEY (selection_key);


--
-- Name: metrics_class_kpi_config metrics_class_kpi_config_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metrics_class_kpi_config
    ADD CONSTRAINT metrics_class_kpi_config_pk PRIMARY KEY (class_type, kpi_key);


--
-- Name: metrics_class_kpi_rubric metrics_class_kpi_rubric_global_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metrics_class_kpi_rubric
    ADD CONSTRAINT metrics_class_kpi_rubric_global_pkey PRIMARY KEY (class_type, kpi_key, band_key);


--
-- Name: metrics_color_preset metrics_color_preset_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metrics_color_preset
    ADD CONSTRAINT metrics_color_preset_pkey PRIMARY KEY (preset_key);


--
-- Name: metrics_kpi_compute metrics_kpi_compute_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metrics_kpi_compute
    ADD CONSTRAINT metrics_kpi_compute_pkey PRIMARY KEY (id);


--
-- Name: metrics_kpi_def metrics_kpi_def_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metrics_kpi_def
    ADD CONSTRAINT metrics_kpi_def_pkey PRIMARY KEY (kpi_key);


--
-- Name: metrics_kpi_rubric metrics_kpi_rubric_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metrics_kpi_rubric
    ADD CONSTRAINT metrics_kpi_rubric_pkey PRIMARY KEY (kpi_key, band_key);


--
-- Name: metrics_pipeline_queue metrics_pipeline_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metrics_pipeline_queue
    ADD CONSTRAINT metrics_pipeline_queue_pkey PRIMARY KEY (job_id);


--
-- Name: metrics_pipeline_run_log metrics_pipeline_run_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metrics_pipeline_run_log
    ADD CONSTRAINT metrics_pipeline_run_log_pkey PRIMARY KEY (run_id);


--
-- Name: metrics_rank_partition metrics_rank_partition_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metrics_rank_partition
    ADD CONSTRAINT metrics_rank_partition_pkey PRIMARY KEY (id);


--
-- Name: metrics_raw_batch metrics_raw_batch_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metrics_raw_batch
    ADD CONSTRAINT metrics_raw_batch_pkey PRIMARY KEY (batch_id);


--
-- Name: metrics_raw_row metrics_raw_row_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metrics_raw_row
    ADD CONSTRAINT metrics_raw_row_pkey PRIMARY KEY (id);


--
-- Name: metrics_raw_row metrics_raw_row_unique_row_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metrics_raw_row
    ADD CONSTRAINT metrics_raw_row_unique_row_key_key UNIQUE (unique_row_key);


--
-- Name: metrics_raw_total_row metrics_raw_total_row_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metrics_raw_total_row
    ADD CONSTRAINT metrics_raw_total_row_pkey PRIMARY KEY (id);


--
-- Name: metrics_raw_total_row metrics_raw_total_row_unique_row_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metrics_raw_total_row
    ADD CONSTRAINT metrics_raw_total_row_unique_row_key_key UNIQUE (unique_row_key);


--
-- Name: metrics_scoring_class metrics_scoring_class_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metrics_scoring_class
    ADD CONSTRAINT metrics_scoring_class_pkey PRIMARY KEY (class_type);


--
-- Name: metrics_tech_rollup metrics_tech_rollup_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metrics_tech_rollup
    ADD CONSTRAINT metrics_tech_rollup_pkey PRIMARY KEY (id);


--
-- Name: mso mso_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mso
    ADD CONSTRAINT mso_pkey PRIMARY KEY (mso_id);


--
-- Name: office office_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.office
    ADD CONSTRAINT office_pkey PRIMARY KEY (office_id);


--
-- Name: org_event org_event_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_event
    ADD CONSTRAINT org_event_pkey PRIMARY KEY (org_event_id);


--
-- Name: password_setup_code password_setup_code_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_setup_code
    ADD CONSTRAINT password_setup_code_pkey PRIMARY KEY (password_setup_code_id);


--
-- Name: pc_org_console_eligibility_derived pc_org_console_eligibility_derived_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pc_org_console_eligibility_derived
    ADD CONSTRAINT pc_org_console_eligibility_derived_pkey PRIMARY KEY (pc_org_id, auth_user_id, source);


--
-- Name: pc_org_home_block pc_org_home_block_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pc_org_home_block
    ADD CONSTRAINT pc_org_home_block_pkey PRIMARY KEY (pc_org_home_block_id);


--
-- Name: pc_org_office pc_org_office_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pc_org_office
    ADD CONSTRAINT pc_org_office_pkey PRIMARY KEY (pc_org_office_id);


--
-- Name: pc_org_permission_grant_audit pc_org_permission_grant_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pc_org_permission_grant_audit
    ADD CONSTRAINT pc_org_permission_grant_audit_pkey PRIMARY KEY (audit_id);


--
-- Name: pc_org_permission_grant pc_org_permission_grant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pc_org_permission_grant
    ADD CONSTRAINT pc_org_permission_grant_pkey PRIMARY KEY (pc_org_permission_grant_id);


--
-- Name: pc_org_permission_grant pc_org_permission_grant_uniq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pc_org_permission_grant
    ADD CONSTRAINT pc_org_permission_grant_uniq UNIQUE (pc_org_id, auth_user_id, permission_key);


--
-- Name: pc_org_permission_grant pc_org_permission_grant_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pc_org_permission_grant
    ADD CONSTRAINT pc_org_permission_grant_unique UNIQUE (auth_user_id, pc_org_id, permission_key);


--
-- Name: pc_org_permissions pc_org_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pc_org_permissions
    ADD CONSTRAINT pc_org_permissions_pkey PRIMARY KEY (auth_user_id, pc_org_id);


--
-- Name: pc_org pc_org_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pc_org
    ADD CONSTRAINT pc_org_pkey PRIMARY KEY (pc_org_id);


--
-- Name: pc_org_state_coverage pc_org_state_coverage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pc_org_state_coverage
    ADD CONSTRAINT pc_org_state_coverage_pkey PRIMARY KEY (pc_org_state_coverage_id);


--
-- Name: pc_org_user_role pc_org_user_role_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pc_org_user_role
    ADD CONSTRAINT pc_org_user_role_pkey PRIMARY KEY (pc_org_user_role_id);


--
-- Name: pc_org_user_role pc_org_user_role_uniq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pc_org_user_role
    ADD CONSTRAINT pc_org_user_role_uniq UNIQUE (pc_org_id, auth_user_id);


--
-- Name: pc pc_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pc
    ADD CONSTRAINT pc_pkey PRIMARY KEY (pc_id);


--
-- Name: permission_def permission_def_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_def
    ADD CONSTRAINT permission_def_pkey PRIMARY KEY (permission_key);


--
-- Name: person_pc_org person_pc_org_person_id_pc_org_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.person_pc_org
    ADD CONSTRAINT person_pc_org_person_id_pc_org_id_key UNIQUE (person_id, pc_org_id);


--
-- Name: person_pc_org person_pc_org_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.person_pc_org
    ADD CONSTRAINT person_pc_org_pkey PRIMARY KEY (person_pc_org_id);


--
-- Name: person person_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.person
    ADD CONSTRAINT person_pkey PRIMARY KEY (person_id);


--
-- Name: person_tech_id_history person_tech_id_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.person_tech_id_history
    ADD CONSTRAINT person_tech_id_history_pkey PRIMARY KEY (tech_id_history_id);


--
-- Name: position_title position_title_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.position_title
    ADD CONSTRAINT position_title_pkey PRIMARY KEY (position_title_id);


--
-- Name: position_title position_title_position_title_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.position_title
    ADD CONSTRAINT position_title_position_title_key UNIQUE (position_title);


--
-- Name: position_title position_title_position_title_uniq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.position_title
    ADD CONSTRAINT position_title_position_title_uniq UNIQUE (position_title);


--
-- Name: quota_day_fact quota_day_fact_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quota_day_fact
    ADD CONSTRAINT quota_day_fact_pk PRIMARY KEY (pc_org_id, shift_date, route_id);


--
-- Name: quota quota_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quota
    ADD CONSTRAINT quota_pkey PRIMARY KEY (quota_id);


--
-- Name: quota quota_route_fiscal_month_ux; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quota
    ADD CONSTRAINT quota_route_fiscal_month_ux UNIQUE (route_id, fiscal_month_id);


--
-- Name: ref_position_title_map ref_position_title_map_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ref_position_title_map
    ADD CONSTRAINT ref_position_title_map_pkey PRIMARY KEY (position_title);


--
-- Name: region region_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.region
    ADD CONSTRAINT region_pkey PRIMARY KEY (region_id);


--
-- Name: role_dim role_dim_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_dim
    ADD CONSTRAINT role_dim_pkey PRIMARY KEY (role_key);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (role_key);


--
-- Name: roster_invite_log roster_invite_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roster_invite_log
    ADD CONSTRAINT roster_invite_log_pkey PRIMARY KEY (invite_id);


--
-- Name: route route_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.route
    ADD CONSTRAINT route_pkey PRIMARY KEY (route_id);


--
-- Name: rpc_policy rpc_policy_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rpc_policy
    ADD CONSTRAINT rpc_policy_pkey PRIMARY KEY (rpc_policy_id);


--
-- Name: rpc_policy rpc_policy_schema_name_function_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rpc_policy
    ADD CONSTRAINT rpc_policy_schema_name_function_name_key UNIQUE (schema_name, function_name);


--
-- Name: schedule_baseline_month schedule_baseline_month_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_baseline_month
    ADD CONSTRAINT schedule_baseline_month_pkey PRIMARY KEY (schedule_baseline_month_id);


--
-- Name: schedule_baseline_month schedule_baseline_month_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_baseline_month
    ADD CONSTRAINT schedule_baseline_month_unique UNIQUE (pc_org_id, fiscal_month_id, tech_id);


--
-- Name: schedule_day_fact schedule_day_fact_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_day_fact
    ADD CONSTRAINT schedule_day_fact_pk PRIMARY KEY (pc_org_id, shift_date, tech_id);


--
-- Name: schedule_day_fact schedule_day_fact_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_day_fact
    ADD CONSTRAINT schedule_day_fact_uq UNIQUE (pc_org_id, shift_date, tech_id);


--
-- Name: schedule_exception_day schedule_exception_day_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_exception_day
    ADD CONSTRAINT schedule_exception_day_pkey PRIMARY KEY (schedule_exception_day_id);


--
-- Name: schedule_exception_day schedule_exception_day_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_exception_day
    ADD CONSTRAINT schedule_exception_day_unique UNIQUE (pc_org_id, shift_date, tech_id, exception_type);


--
-- Name: schedule schedule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule
    ADD CONSTRAINT schedule_pkey PRIMARY KEY (schedule_id);


--
-- Name: shift_validation_batch shift_validation_batch_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_validation_batch
    ADD CONSTRAINT shift_validation_batch_pkey PRIMARY KEY (shift_validation_batch_id);


--
-- Name: shift_validation_day_fact shift_validation_day_fact_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_validation_day_fact
    ADD CONSTRAINT shift_validation_day_fact_pk PRIMARY KEY (pc_org_id, shift_date, tech_id);


--
-- Name: shift_validation shift_validation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_validation
    ADD CONSTRAINT shift_validation_pkey PRIMARY KEY (sv_id);


--
-- Name: shift_validation_row shift_validation_row_natural_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_validation_row
    ADD CONSTRAINT shift_validation_row_natural_key UNIQUE (pc_org_id, fulfillment_center_id, tech_num, shift_date);


--
-- Name: shift_validation_row shift_validation_row_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_validation_row
    ADD CONSTRAINT shift_validation_row_pkey PRIMARY KEY (shift_validation_row_id);


--
-- Name: user_pc_org_eligibility user_pc_org_eligibility_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_pc_org_eligibility
    ADD CONSTRAINT user_pc_org_eligibility_pkey PRIMARY KEY (auth_user_id, pc_org_id);


--
-- Name: user_pc_scope user_pc_scope_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_pc_scope
    ADD CONSTRAINT user_pc_scope_pkey PRIMARY KEY (user_id, pc_org_id);


--
-- Name: user_person_link user_person_link_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_person_link
    ADD CONSTRAINT user_person_link_pkey PRIMARY KEY (user_id);


--
-- Name: user_profile user_profile_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profile
    ADD CONSTRAINT user_profile_pkey PRIMARY KEY (auth_user_id);


--
-- Name: user_role user_role_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role
    ADD CONSTRAINT user_role_pkey PRIMARY KEY (user_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (auth_user_id, role_key);


--
-- Name: core_activity_logs_actor_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX core_activity_logs_actor_idx ON core.activity_logs USING btree (actor_app_user_id);


--
-- Name: core_activity_logs_created_at_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX core_activity_logs_created_at_idx ON core.activity_logs USING btree (created_at DESC);


--
-- Name: core_activity_logs_entity_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX core_activity_logs_entity_idx ON core.activity_logs USING btree (entity_type, entity_id);


--
-- Name: core_activity_logs_workspace_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX core_activity_logs_workspace_idx ON core.activity_logs USING btree (workspace_id);


--
-- Name: core_app_users_person_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX core_app_users_person_id_idx ON core.app_users USING btree (person_id);


--
-- Name: core_app_users_primary_email_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX core_app_users_primary_email_idx ON core.app_users USING btree (primary_email);


--
-- Name: core_assignment_events_assignment_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX core_assignment_events_assignment_id_idx ON core.assignment_events USING btree (assignment_id);


--
-- Name: core_assignment_events_event_type_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX core_assignment_events_event_type_idx ON core.assignment_events USING btree (event_type);


--
-- Name: core_assignments_person_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX core_assignments_person_id_idx ON core.assignments USING btree (person_id);


--
-- Name: core_assignments_reports_to_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX core_assignments_reports_to_idx ON core.assignments USING btree (reports_to_assignment_id);


--
-- Name: core_assignments_tech_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX core_assignments_tech_id_idx ON core.assignments USING btree (tech_id);


--
-- Name: core_assignments_workspace_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX core_assignments_workspace_id_idx ON core.assignments USING btree (workspace_id);


--
-- Name: core_membership_roles_membership_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX core_membership_roles_membership_id_idx ON core.membership_roles USING btree (membership_id);


--
-- Name: core_membership_roles_role_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX core_membership_roles_role_id_idx ON core.membership_roles USING btree (role_id);


--
-- Name: core_memberships_app_user_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX core_memberships_app_user_id_idx ON core.memberships USING btree (app_user_id);


--
-- Name: core_memberships_workspace_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX core_memberships_workspace_id_idx ON core.memberships USING btree (workspace_id);


--
-- Name: core_metric_batch_events_batch_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX core_metric_batch_events_batch_idx ON core.metric_batch_events USING btree (metric_batch_id);


--
-- Name: core_metric_batch_events_legacy_batch_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX core_metric_batch_events_legacy_batch_idx ON core.metric_batch_events USING btree (legacy_batch_id);


--
-- Name: core_metric_batch_events_type_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX core_metric_batch_events_type_idx ON core.metric_batch_events USING btree (event_type);


--
-- Name: core_metric_batches_fiscal_end_date_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX core_metric_batches_fiscal_end_date_idx ON core.metric_batches USING btree (fiscal_end_date);


--
-- Name: core_metric_batches_legacy_batch_id_uk; Type: INDEX; Schema: core; Owner: -
--

CREATE UNIQUE INDEX core_metric_batches_legacy_batch_id_uk ON core.metric_batches USING btree (legacy_batch_id) WHERE (legacy_batch_id IS NOT NULL);


--
-- Name: core_metric_batches_metric_date_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX core_metric_batches_metric_date_idx ON core.metric_batches USING btree (metric_date);


--
-- Name: core_metric_batches_workspace_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX core_metric_batches_workspace_id_idx ON core.metric_batches USING btree (workspace_id);


--
-- Name: core_metric_facts_assignment_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX core_metric_facts_assignment_id_idx ON core.metric_facts USING btree (assignment_id);


--
-- Name: core_metric_facts_batch_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX core_metric_facts_batch_id_idx ON core.metric_facts USING btree (metric_batch_id);


--
-- Name: core_metric_facts_metric_key_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX core_metric_facts_metric_key_idx ON core.metric_facts USING btree (metric_key);


--
-- Name: core_metric_facts_person_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX core_metric_facts_person_id_idx ON core.metric_facts USING btree (person_id);


--
-- Name: core_metric_facts_tech_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX core_metric_facts_tech_id_idx ON core.metric_facts USING btree (tech_id);


--
-- Name: core_metric_facts_workspace_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX core_metric_facts_workspace_id_idx ON core.metric_facts USING btree (workspace_id);


--
-- Name: core_metric_profile_rules_metric_key_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX core_metric_profile_rules_metric_key_idx ON core.metric_profile_rules USING btree (metric_key);


--
-- Name: core_metric_profile_rules_profile_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX core_metric_profile_rules_profile_id_idx ON core.metric_profile_rules USING btree (metric_profile_id);


--
-- Name: core_metric_profiles_active_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX core_metric_profiles_active_idx ON core.metric_profiles USING btree (is_active);


--
-- Name: core_metric_rows_batch_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX core_metric_rows_batch_id_idx ON core.metric_rows USING btree (metric_batch_id);


--
-- Name: core_metric_rows_legacy_metric_row_id_uk; Type: INDEX; Schema: core; Owner: -
--

CREATE UNIQUE INDEX core_metric_rows_legacy_metric_row_id_uk ON core.metric_rows USING btree (legacy_metric_row_id) WHERE (legacy_metric_row_id IS NOT NULL);


--
-- Name: core_metric_rows_legacy_unique_row_key_uk; Type: INDEX; Schema: core; Owner: -
--

CREATE UNIQUE INDEX core_metric_rows_legacy_unique_row_key_uk ON core.metric_rows USING btree (legacy_unique_row_key) WHERE (legacy_unique_row_key IS NOT NULL);


--
-- Name: core_metric_rows_reported_tech_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX core_metric_rows_reported_tech_id_idx ON core.metric_rows USING btree (reported_tech_id);


--
-- Name: core_metric_rows_workspace_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX core_metric_rows_workspace_id_idx ON core.metric_rows USING btree (workspace_id);


--
-- Name: core_people_full_name_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX core_people_full_name_idx ON core.people USING btree (full_name);


--
-- Name: core_person_contacts_person_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX core_person_contacts_person_id_idx ON core.person_contacts USING btree (person_id);


--
-- Name: core_person_contacts_primary_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX core_person_contacts_primary_idx ON core.person_contacts USING btree (person_id, contact_type, is_primary);


--
-- Name: core_reporting_lines_child_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX core_reporting_lines_child_idx ON core.reporting_lines USING btree (child_assignment_id);


--
-- Name: core_reporting_lines_parent_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX core_reporting_lines_parent_idx ON core.reporting_lines USING btree (parent_assignment_id);


--
-- Name: core_reporting_lines_workspace_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX core_reporting_lines_workspace_id_idx ON core.reporting_lines USING btree (workspace_id);


--
-- Name: core_roles_active_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX core_roles_active_idx ON core.roles USING btree (is_active);


--
-- Name: core_workspaces_legacy_pc_org_id_uk; Type: INDEX; Schema: core; Owner: -
--

CREATE UNIQUE INDEX core_workspaces_legacy_pc_org_id_uk ON core.workspaces USING btree (legacy_pc_org_id) WHERE (legacy_pc_org_id IS NOT NULL);


--
-- Name: core_workspaces_name_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX core_workspaces_name_idx ON core.workspaces USING btree (workspace_name);


--
-- Name: home_workspace_preference_one_default_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE UNIQUE INDEX home_workspace_preference_one_default_idx ON core.home_workspace_preference USING btree (auth_user_id, role, COALESCE(pc_org_id, '__global__'::text)) WHERE (is_default = true);


--
-- Name: home_workspace_preference_user_org_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX home_workspace_preference_user_org_idx ON core.home_workspace_preference USING btree (auth_user_id, pc_org_id);


--
-- Name: home_workspace_preference_user_role_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX home_workspace_preference_user_role_idx ON core.home_workspace_preference USING btree (auth_user_id, role);


--
-- Name: idx_core_people_onboarding_pc_org_id; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_core_people_onboarding_pc_org_id ON core.people USING btree (onboarding_pc_org_id);


--
-- Name: idx_cpf_active; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_cpf_active ON core.company_profile_fact USING btree (active_flag);


--
-- Name: idx_cpf_dates; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_cpf_dates ON core.company_profile_fact USING btree (effective_start_date, effective_end_date);


--
-- Name: idx_cpf_org; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_cpf_org ON core.company_profile_fact USING btree (pc_org_id);


--
-- Name: idx_cpf_person; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_cpf_person ON core.company_profile_fact USING btree (person_id);


--
-- Name: idx_metric_facts_batch; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_metric_facts_batch ON core.metric_facts USING btree (metric_batch_id);


--
-- Name: idx_metric_facts_lookup; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_metric_facts_lookup ON core.metric_facts USING btree (metric_batch_id, tech_id, metric_key);


--
-- Name: idx_metric_total_rows_batch; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_metric_total_rows_batch ON core.metric_total_rows USING btree (metric_batch_id);


--
-- Name: idx_metric_total_rows_summary; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_metric_total_rows_summary ON core.metric_total_rows USING btree (summary_type, summary_key);


--
-- Name: idx_metric_total_rows_workspace_fiscal; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_metric_total_rows_workspace_fiscal ON core.metric_total_rows USING btree (workspace_id, fiscal_end_date);


--
-- Name: idx_metric_total_rows_workspace_metric; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_metric_total_rows_workspace_metric ON core.metric_total_rows USING btree (workspace_id, metric_date);


--
-- Name: metric_scores_fact_metric_batch_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX metric_scores_fact_metric_batch_id_idx ON core.metric_scores_fact USING btree (metric_batch_id);


--
-- Name: metric_scores_fact_profile_key_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX metric_scores_fact_profile_key_idx ON core.metric_scores_fact USING btree (profile_key);


--
-- Name: metric_scores_fact_tech_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX metric_scores_fact_tech_id_idx ON core.metric_scores_fact USING btree (tech_id);


--
-- Name: metric_scores_fact_workspace_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX metric_scores_fact_workspace_id_idx ON core.metric_scores_fact USING btree (workspace_id);


--
-- Name: admin_perm_audit_perm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admin_perm_audit_perm_idx ON public.admin_permission_grant_audit USING btree (permission_key, occurred_at DESC);


--
-- Name: admin_perm_audit_target_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admin_perm_audit_target_idx ON public.admin_permission_grant_audit USING btree (target_user_id, occurred_at DESC);


--
-- Name: admin_permission_grant_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX admin_permission_grant_uniq ON public.admin_permission_grant USING btree (auth_user_id, permission_key);


--
-- Name: app_access_session_fact_assignment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX app_access_session_fact_assignment_idx ON public.app_access_session_fact USING btree (assignment_id);


--
-- Name: app_access_session_fact_auth_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX app_access_session_fact_auth_user_idx ON public.app_access_session_fact USING btree (auth_user_id);


--
-- Name: app_access_session_fact_pc_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX app_access_session_fact_pc_org_idx ON public.app_access_session_fact USING btree (pc_org_id);


--
-- Name: app_access_session_fact_person_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX app_access_session_fact_person_idx ON public.app_access_session_fact USING btree (person_id);


--
-- Name: assignment_pc_org_active_dates_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX assignment_pc_org_active_dates_idx ON public.assignment USING btree (pc_org_id, active, start_date, end_date);


--
-- Name: assignment_pc_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX assignment_pc_org_id_idx ON public.assignment USING btree (pc_org_id);


--
-- Name: assignment_person_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX assignment_person_id_idx ON public.assignment USING btree (person_id);


--
-- Name: assignment_reporting_child_dates_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX assignment_reporting_child_dates_idx ON public.assignment_reporting USING btree (child_assignment_id, start_date, end_date);


--
-- Name: assignment_reporting_child_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX assignment_reporting_child_idx ON public.assignment_reporting USING btree (child_assignment_id);


--
-- Name: assignment_reporting_parent_dates_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX assignment_reporting_parent_dates_idx ON public.assignment_reporting USING btree (parent_assignment_id, start_date, end_date);


--
-- Name: assignment_reporting_parent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX assignment_reporting_parent_idx ON public.assignment_reporting USING btree (parent_assignment_id);


--
-- Name: assignment_techid_unique_active_technician_per_org; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX assignment_techid_unique_active_technician_per_org ON public.assignment USING btree (pc_org_id, tech_id) WHERE ((tech_id IS NOT NULL) AND (btrim(tech_id) <> ''::text) AND (lower(btrim(COALESCE(position_title, ''::text))) = 'technician'::text) AND (end_date IS NULL) AND (COALESCE(active, true) = true));


--
-- Name: assignment_unique_active_tech_id_per_org; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX assignment_unique_active_tech_id_per_org ON public.assignment USING btree (pc_org_id, tech_id) WHERE ((tech_id IS NOT NULL) AND (COALESCE(active, true) = true) AND (end_date IS NULL));


--
-- Name: calendar_blackout_rule_range_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX calendar_blackout_rule_range_idx ON public.calendar_blackout_rule USING btree (country_code, start_date, end_date) WHERE (active = true);


--
-- Name: calendar_holiday_baseline_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX calendar_holiday_baseline_date_idx ON public.calendar_holiday_baseline USING btree (country_code, holiday_date);


--
-- Name: check_in_batch_pc_org_uploaded_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX check_in_batch_pc_org_uploaded_idx ON public.check_in_batch USING btree (pc_org_id, uploaded_at DESC);


--
-- Name: check_in_day_fact_pc_org_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX check_in_day_fact_pc_org_date_idx ON public.check_in_day_fact USING btree (pc_org_id, shift_date);


--
-- Name: check_in_day_fact_pc_org_tech_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX check_in_day_fact_pc_org_tech_idx ON public.check_in_day_fact USING btree (pc_org_id, tech_id, shift_date);


--
-- Name: check_in_job_row_pc_org_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX check_in_job_row_pc_org_date_idx ON public.check_in_job_row USING btree (pc_org_id, cp_date);


--
-- Name: check_in_job_row_pc_org_tech_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX check_in_job_row_pc_org_tech_date_idx ON public.check_in_job_row USING btree (pc_org_id, tech_id, cp_date);


--
-- Name: dispatch_console_log_assignment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dispatch_console_log_assignment_idx ON public.dispatch_console_log USING btree (pc_org_id, shift_date, assignment_id, created_at DESC);


--
-- Name: dispatch_console_log_day_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dispatch_console_log_day_idx ON public.dispatch_console_log USING btree (pc_org_id, shift_date, created_at DESC);


--
-- Name: dispatch_console_log_dedupe_scoped_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX dispatch_console_log_dedupe_scoped_uq ON public.dispatch_console_log USING btree (pc_org_id, shift_date, assignment_id, event_type, dedupe_key) WHERE ((event_type <> 'NOTE'::text) AND (dedupe_key IS NOT NULL));


--
-- Name: dispatch_console_log_event_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dispatch_console_log_event_type_idx ON public.dispatch_console_log USING btree (pc_org_id, shift_date, event_type);


--
-- Name: dispatch_console_log_group_dedupe_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX dispatch_console_log_group_dedupe_uniq ON public.dispatch_console_log USING btree (pc_org_id, shift_date, assignment_id, event_type, event_group_id, dedupe_key) WHERE ((event_type = ANY (ARRAY['INCIDENT'::text, 'TECH_MOVE'::text])) AND (event_group_id IS NOT NULL) AND (dedupe_key IS NOT NULL));


--
-- Name: dispatch_console_log_group_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dispatch_console_log_group_idx ON public.dispatch_console_log USING btree (pc_org_id, shift_date, assignment_id, event_type, event_group_id, created_at DESC) WHERE (event_group_id IS NOT NULL);


--
-- Name: dispatch_console_log_singleton_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX dispatch_console_log_singleton_uniq ON public.dispatch_console_log USING btree (pc_org_id, shift_date, assignment_id, event_type) WHERE (event_type = ANY (ARRAY['CALL_OUT'::text, 'ADD_IN'::text, 'BP_LOW'::text]));


--
-- Name: dispatch_day_tech_assignment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dispatch_day_tech_assignment_idx ON public.dispatch_day_tech USING btree (pc_org_id, assignment_id);


--
-- Name: dispatch_day_tech_day_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dispatch_day_tech_day_idx ON public.dispatch_day_tech USING btree (pc_org_id, shift_date);


--
-- Name: dispatch_day_tech_day_planned_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dispatch_day_tech_day_planned_idx ON public.dispatch_day_tech USING btree (pc_org_id, shift_date, planned_route_id);


--
-- Name: dispatch_day_tech_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dispatch_day_tech_name_idx ON public.dispatch_day_tech USING btree (pc_org_id, shift_date, full_name);


--
-- Name: dispatch_day_tech_tech_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dispatch_day_tech_tech_id_idx ON public.dispatch_day_tech USING btree (pc_org_id, tech_id);


--
-- Name: dispatch_schedule_action_queue_assignment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dispatch_schedule_action_queue_assignment_idx ON public.dispatch_schedule_action_queue USING btree (assignment_id);


--
-- Name: dispatch_schedule_action_queue_log_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dispatch_schedule_action_queue_log_idx ON public.dispatch_schedule_action_queue USING btree (dispatch_console_log_id);


--
-- Name: dispatch_schedule_action_queue_org_date_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dispatch_schedule_action_queue_org_date_status_idx ON public.dispatch_schedule_action_queue USING btree (pc_org_id, shift_date, status);


--
-- Name: division_leadership_primary_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX division_leadership_primary_uniq ON public.division_leadership USING btree (division_id, role_key) WHERE (is_primary = true);


--
-- Name: field_log_attachment_report_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_log_attachment_report_idx ON public.field_log_attachment USING btree (report_id, uploaded_at);


--
-- Name: field_log_billing_email_auto_sent_once_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX field_log_billing_email_auto_sent_once_idx ON public.field_log_billing_email_log USING btree (report_id, category_key) WHERE ((send_mode = 'auto'::text) AND (status = 'sent'::text));


--
-- Name: field_log_category_cfg_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_log_category_cfg_idx ON public.field_log_category USING btree (config_version_id, is_active, sort_order);


--
-- Name: field_log_config_version_one_published_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX field_log_config_version_one_published_idx ON public.field_log_config_version USING btree (status) WHERE (status = 'published'::text);


--
-- Name: field_log_event_report_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_log_event_report_idx ON public.field_log_event USING btree (report_id, event_at DESC);


--
-- Name: field_log_event_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_log_event_type_idx ON public.field_log_event USING btree (event_type, event_at DESC);


--
-- Name: field_log_photo_label_cfg_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_log_photo_label_cfg_idx ON public.field_log_photo_label USING btree (config_version_id, is_active, sort_order);


--
-- Name: field_log_report_creator_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_log_report_creator_idx ON public.field_log_report USING btree (created_by_user_id, created_at DESC);


--
-- Name: field_log_report_job_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_log_report_job_idx ON public.field_log_report USING btree (job_number);


--
-- Name: field_log_report_pc_org_creator_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_log_report_pc_org_creator_idx ON public.field_log_report USING btree (pc_org_id, created_by_user_id, created_at DESC);


--
-- Name: field_log_report_pc_org_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_log_report_pc_org_status_idx ON public.field_log_report USING btree (pc_org_id, status, submitted_at DESC);


--
-- Name: field_log_report_rule_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_log_report_rule_idx ON public.field_log_report USING btree (rule_id);


--
-- Name: field_log_report_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_log_report_status_idx ON public.field_log_report USING btree (status, submitted_at DESC);


--
-- Name: field_log_review_action_report_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_log_review_action_report_idx ON public.field_log_review_action USING btree (report_id, action_at DESC);


--
-- Name: field_log_rule_cfg_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_log_rule_cfg_idx ON public.field_log_rule USING btree (config_version_id, category_key, is_active, sort_order);


--
-- Name: field_log_rule_context_config_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_log_rule_context_config_idx ON public.field_log_rule_context USING btree (config_version_id, sort_order);


--
-- Name: field_log_rule_context_rule_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_log_rule_context_rule_idx ON public.field_log_rule_context USING btree (rule_id);


--
-- Name: field_log_rule_context_submission_job_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_log_rule_context_submission_job_idx ON public.field_log_rule_context USING btree (submission_type_key, job_type, sort_order);


--
-- Name: field_log_rule_photo_req_rule_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_log_rule_photo_req_rule_idx ON public.field_log_rule_photo_requirement USING btree (rule_id, is_active, sort_order);


--
-- Name: field_log_subcategory_cfg_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_log_subcategory_cfg_idx ON public.field_log_subcategory USING btree (config_version_id, category_key, is_active, sort_order);


--
-- Name: field_log_ucode_cfg_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_log_ucode_cfg_idx ON public.field_log_ucode USING btree (config_version_id, is_active, sort_order);


--
-- Name: field_log_ucode_group_item_cfg_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_log_ucode_group_item_cfg_idx ON public.field_log_ucode_group_item USING btree (config_version_id, ucode_group_key, is_active, sort_order);


--
-- Name: fiscal_month_dim_end_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fiscal_month_dim_end_date_idx ON public.fiscal_month_dim USING btree (end_date);


--
-- Name: fuse_onboarding_import_row_batch_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fuse_onboarding_import_row_batch_idx ON public.fuse_onboarding_import_row USING btree (batch_id);


--
-- Name: fuse_onboarding_import_row_company_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fuse_onboarding_import_row_company_name_idx ON public.fuse_onboarding_import_row USING btree (company_name);


--
-- Name: fuse_onboarding_import_row_office_text_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fuse_onboarding_import_row_office_text_idx ON public.fuse_onboarding_import_row USING btree (office_text);


--
-- Name: fuse_onboarding_import_row_signature_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fuse_onboarding_import_row_signature_idx ON public.fuse_onboarding_import_row USING btree (row_signature);


--
-- Name: idx_ar_child; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ar_child ON public.assignment_reporting USING btree (child_assignment_id);


--
-- Name: idx_ar_child_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ar_child_active ON public.assignment_reporting USING btree (child_assignment_id) WHERE (end_date IS NULL);


--
-- Name: idx_ar_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ar_parent ON public.assignment_reporting USING btree (parent_assignment_id);


--
-- Name: idx_ar_parent_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ar_parent_active ON public.assignment_reporting USING btree (parent_assignment_id) WHERE (end_date IS NULL);


--
-- Name: idx_archive_metric_batch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_archive_metric_batch ON public.master_kpi_archive_metric USING btree (batch_id);


--
-- Name: idx_archive_metric_batch_class; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_archive_metric_batch_class ON public.master_kpi_archive_metric USING btree (batch_id, class_type);


--
-- Name: idx_archive_metric_canonical; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_archive_metric_canonical ON public.master_kpi_archive_metric USING btree (batch_id, class_type, metric_key_canonical);


--
-- Name: idx_archive_metric_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_archive_metric_lookup ON public.master_kpi_archive_metric USING btree (pc_org_id, metric_date, metric_key);


--
-- Name: idx_archive_metric_tech; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_archive_metric_tech ON public.master_kpi_archive_metric USING btree (tech_id, metric_key);


--
-- Name: idx_archive_snapshot_batch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_archive_snapshot_batch ON public.master_kpi_archive_snapshot USING btree (batch_id);


--
-- Name: idx_archive_snapshot_batch_class; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_archive_snapshot_batch_class ON public.master_kpi_archive_snapshot USING btree (batch_id, class_type);


--
-- Name: idx_archive_snapshot_direct; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_archive_snapshot_direct ON public.master_kpi_archive_snapshot USING btree (batch_id, class_type, direct_reports_to_person_id);


--
-- Name: idx_archive_snapshot_is_totals; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_archive_snapshot_is_totals ON public.master_kpi_archive_snapshot USING btree (batch_id, class_type, is_totals);


--
-- Name: idx_archive_snapshot_itg_rollup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_archive_snapshot_itg_rollup ON public.master_kpi_archive_snapshot USING btree (itg_rollup_person_id);


--
-- Name: idx_archive_snapshot_org_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_archive_snapshot_org_date ON public.master_kpi_archive_snapshot USING btree (pc_org_id, fiscal_end_date, metric_date);


--
-- Name: idx_archive_snapshot_rank; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_archive_snapshot_rank ON public.master_kpi_archive_snapshot USING btree (pc_org_id, batch_id, rank_org);


--
-- Name: idx_archive_snapshot_rollup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_archive_snapshot_rollup ON public.master_kpi_archive_snapshot USING btree (batch_id, class_type, itg_rollup_person_id);


--
-- Name: idx_archive_snapshot_supervisor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_archive_snapshot_supervisor ON public.master_kpi_archive_snapshot USING btree (direct_reports_to_person_id);


--
-- Name: idx_assignment_pc_tech_active_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assignment_pc_tech_active_dates ON public.assignment USING btree (pc_org_id, tech_id, start_date, end_date);


--
-- Name: idx_check_in_job_row_is_sla_bptrl; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_check_in_job_row_is_sla_bptrl ON public.check_in_job_row USING btree (is_sla_bptrl);


--
-- Name: idx_contractor_assignment_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contractor_assignment_active ON public.contractor_assignment USING btree (((end_date IS NULL)));


--
-- Name: idx_contractor_assignment_contractor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contractor_assignment_contractor ON public.contractor_assignment USING btree (contractor_id);


--
-- Name: idx_contractor_assignment_contractor_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contractor_assignment_contractor_active ON public.contractor_assignment USING btree (contractor_id) WHERE (end_date IS NULL);


--
-- Name: idx_contractor_assignment_pc_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contractor_assignment_pc_org ON public.contractor_assignment USING btree (pc_org_id);


--
-- Name: idx_contractor_assignment_pc_org_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contractor_assignment_pc_org_active ON public.contractor_assignment USING btree (pc_org_id) WHERE (end_date IS NULL);


--
-- Name: idx_cpf_active_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cpf_active_lookup ON public.company_profile_fact USING btree (person_id, pc_org_id, effective_end_date);


--
-- Name: idx_dcl_audit_changed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dcl_audit_changed_at ON public.dispatch_console_log_audit USING btree (changed_at);


--
-- Name: idx_dcl_audit_log_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dcl_audit_log_id ON public.dispatch_console_log_audit USING btree (dispatch_console_log_id);


--
-- Name: idx_dispatch_console_log_org_day_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dispatch_console_log_org_day_created ON public.dispatch_console_log USING btree (pc_org_id, shift_date, created_at DESC);


--
-- Name: idx_metrics_class_kpi_config_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_metrics_class_kpi_config_order ON public.metrics_class_kpi_config USING btree (class_type, sort_order, kpi_key);


--
-- Name: idx_metrics_class_kpi_config_report_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_metrics_class_kpi_config_report_order ON public.metrics_class_kpi_config USING btree (class_type, report_order);


--
-- Name: idx_metrics_kpi_compute_pc_fm_md_tech_batch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_metrics_kpi_compute_pc_fm_md_tech_batch ON public.metrics_kpi_compute USING btree (pc_org_id, fiscal_end_date, metric_date, tech_id, batch_id);


--
-- Name: idx_metrics_pipeline_log_batch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_metrics_pipeline_log_batch ON public.metrics_pipeline_run_log USING btree (batch_id);


--
-- Name: idx_metrics_rank_partition_pc_fm_md_tech_batch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_metrics_rank_partition_pc_fm_md_tech_batch ON public.metrics_rank_partition USING btree (pc_org_id, fiscal_end_date, metric_date, tech_id, batch_id);


--
-- Name: idx_office_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_office_active ON public.office USING btree (active);


--
-- Name: idx_pc_org_perm_grant_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pc_org_perm_grant_active ON public.pc_org_permission_grant USING btree (pc_org_id, permission_key, expires_at, revoked_at);


--
-- Name: idx_pc_org_perm_grant_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pc_org_perm_grant_lookup ON public.pc_org_permission_grant USING btree (auth_user_id, pc_org_id, permission_key);


--
-- Name: idx_pc_org_user_role_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pc_org_user_role_lookup ON public.pc_org_user_role USING btree (pc_org_id, auth_user_id, active);


--
-- Name: idx_person_pc_org_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_person_pc_org_active ON public.person_pc_org USING btree (active);


--
-- Name: idx_person_pc_org_pc_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_person_pc_org_pc_org_id ON public.person_pc_org USING btree (pc_org_id);


--
-- Name: idx_person_pc_org_person_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_person_pc_org_person_id ON public.person_pc_org USING btree (person_id);


--
-- Name: idx_raw_batch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_raw_batch ON public.metrics_raw_row USING btree (batch_id);


--
-- Name: idx_raw_pc_fiscal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_raw_pc_fiscal ON public.metrics_raw_row USING btree (pc_org_id, fiscal_end_date);


--
-- Name: idx_raw_pc_metricdate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_raw_pc_metricdate ON public.metrics_raw_row USING btree (pc_org_id, metric_date);


--
-- Name: idx_raw_tech; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_raw_tech ON public.metrics_raw_row USING btree (tech_id);


--
-- Name: idx_raw_total_batch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_raw_total_batch ON public.metrics_raw_total_row USING btree (batch_id);


--
-- Name: idx_raw_total_pc_fiscal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_raw_total_pc_fiscal ON public.metrics_raw_total_row USING btree (pc_org_id, fiscal_end_date);


--
-- Name: idx_raw_total_pc_metricdate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_raw_total_pc_metricdate ON public.metrics_raw_total_row USING btree (pc_org_id, metric_date);


--
-- Name: idx_raw_total_pc_type_fiscal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_raw_total_pc_type_fiscal ON public.metrics_raw_total_row USING btree (pc_org_id, summary_type, fiscal_end_date);


--
-- Name: idx_raw_total_summary_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_raw_total_summary_key ON public.metrics_raw_total_row USING btree (summary_key);


--
-- Name: idx_raw_total_summary_label; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_raw_total_summary_label ON public.metrics_raw_total_row USING btree (summary_label);


--
-- Name: idx_raw_total_summary_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_raw_total_summary_type ON public.metrics_raw_total_row USING btree (summary_type);


--
-- Name: idx_rpc_policy_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rpc_policy_lookup ON public.rpc_policy USING btree (schema_name, function_name);


--
-- Name: idx_rpc_policy_permission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rpc_policy_permission ON public.rpc_policy USING btree (permission_key);


--
-- Name: idx_user_pc_scope_pc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_pc_scope_pc ON public.user_pc_scope USING btree (pc_org_id);


--
-- Name: idx_user_person_link_person; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_person_link_person ON public.user_person_link USING btree (person_id);


--
-- Name: idx_user_profile_core_person_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_profile_core_person_id ON public.user_profile USING btree (core_person_id);


--
-- Name: idx_user_role_role_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_role_role_key ON public.user_role USING btree (role_key);


--
-- Name: ix_pc_org_office_office_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_pc_org_office_office_id ON public.pc_org_office USING btree (office_id);


--
-- Name: ix_pc_org_office_pc_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_pc_org_office_pc_org_id ON public.pc_org_office USING btree (pc_org_id);


--
-- Name: ix_person_pc_org_pcorg; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_person_pc_org_pcorg ON public.person_pc_org USING btree (pc_org_id);


--
-- Name: ix_person_pc_org_person; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_person_pc_org_person ON public.person_pc_org USING btree (person_id);


--
-- Name: ix_person_pc_org_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_person_pc_org_status ON public.person_pc_org USING btree (status);


--
-- Name: locate_cotp_report_row_record_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX locate_cotp_report_row_record_idx ON public.locate_cotp_report_row USING btree (locate_reporting_record_id);


--
-- Name: locate_cotp_report_row_state_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX locate_cotp_report_row_state_idx ON public.locate_cotp_report_row USING btree (state_code);


--
-- Name: locate_metric_observation_metric_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX locate_metric_observation_metric_date_idx ON public.locate_metric_observation USING btree (metric_key, observation_date DESC);


--
-- Name: locate_metric_observation_state_metric_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX locate_metric_observation_state_metric_date_idx ON public.locate_metric_observation USING btree (state_code, metric_key, observation_date DESC);


--
-- Name: locate_reporting_record_source_as_of_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX locate_reporting_record_source_as_of_idx ON public.locate_reporting_record USING btree (report_type, week_ending_date, source_as_of_at);


--
-- Name: locate_reporting_record_type_week_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX locate_reporting_record_type_week_idx ON public.locate_reporting_record USING btree (report_type, week_ending_date);


--
-- Name: metrics_class_one_tiebreaker_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX metrics_class_one_tiebreaker_uq ON public.metrics_class_kpi_config USING btree (upper(class_type)) WHERE (is_tiebreaker = true);


--
-- Name: metrics_kpi_compute_batch_id_class_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX metrics_kpi_compute_batch_id_class_type_idx ON public.metrics_kpi_compute USING btree (batch_id, class_type);


--
-- Name: metrics_kpi_compute_mso_id_class_type_kpi_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX metrics_kpi_compute_mso_id_class_type_kpi_key_idx ON public.metrics_kpi_compute USING btree (mso_id, class_type, kpi_key);


--
-- Name: metrics_kpi_compute_pc_org_id_metric_date_class_type_tech_i_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX metrics_kpi_compute_pc_org_id_metric_date_class_type_tech_i_idx ON public.metrics_kpi_compute USING btree (pc_org_id, metric_date, class_type, tech_id);


--
-- Name: metrics_kpi_compute_pc_org_id_metric_date_fiscal_end_date_c_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX metrics_kpi_compute_pc_org_id_metric_date_fiscal_end_date_c_idx ON public.metrics_kpi_compute USING btree (pc_org_id, metric_date, fiscal_end_date, class_type);


--
-- Name: metrics_rank_partition_batch_id_class_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX metrics_rank_partition_batch_id_class_type_idx ON public.metrics_rank_partition USING btree (batch_id, class_type);


--
-- Name: metrics_rank_partition_pc_org_id_metric_date_class_type_tec_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX metrics_rank_partition_pc_org_id_metric_date_class_type_tec_idx ON public.metrics_rank_partition USING btree (pc_org_id, metric_date, class_type, tech_id);


--
-- Name: metrics_rank_partition_pc_org_id_metric_date_fiscal_end_dat_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX metrics_rank_partition_pc_org_id_metric_date_fiscal_end_dat_idx ON public.metrics_rank_partition USING btree (pc_org_id, metric_date, fiscal_end_date, class_type);


--
-- Name: metrics_raw_batch_org_fm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX metrics_raw_batch_org_fm_idx ON public.metrics_raw_batch USING btree (pc_org_id, fiscal_end_date, uploaded_at DESC);


--
-- Name: metrics_raw_batch_pc_org_fiscal_metric_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX metrics_raw_batch_pc_org_fiscal_metric_idx ON public.metrics_raw_batch USING btree (pc_org_id, fiscal_end_date, metric_date);


--
-- Name: metrics_raw_batch_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX metrics_raw_batch_status_idx ON public.metrics_raw_batch USING btree (status);


--
-- Name: metrics_tech_rollup_batch_id_class_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX metrics_tech_rollup_batch_id_class_type_idx ON public.metrics_tech_rollup USING btree (batch_id, class_type);


--
-- Name: metrics_tech_rollup_pc_org_id_metric_date_class_type_tech_i_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX metrics_tech_rollup_pc_org_id_metric_date_class_type_tech_i_idx ON public.metrics_tech_rollup USING btree (pc_org_id, metric_date, class_type, tech_id);


--
-- Name: metrics_tech_rollup_pc_org_id_metric_date_fiscal_end_date_c_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX metrics_tech_rollup_pc_org_id_metric_date_fiscal_end_date_c_idx ON public.metrics_tech_rollup USING btree (pc_org_id, metric_date, fiscal_end_date, class_type);


--
-- Name: org_event_event_type_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX org_event_event_type_created_at_idx ON public.org_event USING btree (event_type, created_at DESC);


--
-- Name: org_event_pc_org_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX org_event_pc_org_id_created_at_idx ON public.org_event USING btree (pc_org_id, created_at DESC);


--
-- Name: org_event_person_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX org_event_person_id_created_at_idx ON public.org_event USING btree (person_id, created_at DESC);


--
-- Name: p2_assignment_active_pc_org_id_bt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX p2_assignment_active_pc_org_id_bt ON public.assignment USING btree (active, pc_org_id);


--
-- Name: p2_assignment_active_person_id_bt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX p2_assignment_active_person_id_bt ON public.assignment USING btree (active, person_id);


--
-- Name: p2_assignment_pc_org_id_bt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX p2_assignment_pc_org_id_bt ON public.assignment USING btree (pc_org_id);


--
-- Name: p2_assignment_person_id_bt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX p2_assignment_person_id_bt ON public.assignment USING btree (person_id);


--
-- Name: p2_assignment_position_title_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX p2_assignment_position_title_trgm ON public.assignment USING gin (position_title public.gin_trgm_ops);


--
-- Name: p2_assignment_start_date_bt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX p2_assignment_start_date_bt ON public.assignment USING btree (start_date, assignment_id);


--
-- Name: p2_assignment_tech_id_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX p2_assignment_tech_id_trgm ON public.assignment USING gin (tech_id public.gin_trgm_ops);


--
-- Name: p2_company_company_name_bt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX p2_company_company_name_bt ON public.company USING btree (company_name, company_id);


--
-- Name: p2_fiscal_month_dim_label_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX p2_fiscal_month_dim_label_trgm ON public.fiscal_month_dim USING gin (label public.gin_trgm_ops);


--
-- Name: p2_fiscal_month_dim_month_key_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX p2_fiscal_month_dim_month_key_trgm ON public.fiscal_month_dim USING gin (month_key public.gin_trgm_ops);


--
-- Name: p2_mso_mso_name_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX p2_mso_mso_name_trgm ON public.mso USING gin (mso_name public.gin_trgm_ops);


--
-- Name: p2_pc_org_pc_org_name_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX p2_pc_org_pc_org_name_trgm ON public.pc_org USING gin (pc_org_name public.gin_trgm_ops);


--
-- Name: p2_pc_pc_number_bt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX p2_pc_pc_number_bt ON public.pc USING btree (pc_number);


--
-- Name: p2_person_active_full_name_c; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX p2_person_active_full_name_c ON public.person USING btree (active, full_name, person_id);


--
-- Name: p2_person_co_ref_id_bt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX p2_person_co_ref_id_bt ON public.person USING btree (co_ref_id);


--
-- Name: p2_person_emails_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX p2_person_emails_trgm ON public.person USING gin (emails public.gin_trgm_ops);


--
-- Name: p2_person_full_name_bt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX p2_person_full_name_bt ON public.person USING btree (full_name, person_id);


--
-- Name: p2_person_full_name_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX p2_person_full_name_trgm ON public.person USING gin (full_name public.gin_trgm_ops);


--
-- Name: p2_route_pc_org_id_bt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX p2_route_pc_org_id_bt ON public.route USING btree (pc_org_id);


--
-- Name: p2_route_route_name_bt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX p2_route_route_name_bt ON public.route USING btree (route_name, route_id);


--
-- Name: p2_route_route_name_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX p2_route_route_name_trgm ON public.route USING gin (route_name public.gin_trgm_ops);


--
-- Name: p2_schedule_assignment_id_bt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX p2_schedule_assignment_id_bt ON public.schedule USING btree (assignment_id);


--
-- Name: p2_schedule_end_date_bt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX p2_schedule_end_date_bt ON public.schedule USING btree (end_date, schedule_id);


--
-- Name: p2_schedule_schedule_name_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX p2_schedule_schedule_name_trgm ON public.schedule USING gin (schedule_name public.gin_trgm_ops);


--
-- Name: p2_schedule_start_date_bt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX p2_schedule_start_date_bt ON public.schedule USING btree (start_date, schedule_id);


--
-- Name: p2_user_pc_org_eligibility_user_bt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX p2_user_pc_org_eligibility_user_bt ON public.user_pc_org_eligibility USING btree (auth_user_id, pc_org_id);


--
-- Name: password_setup_code_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX password_setup_code_email_idx ON public.password_setup_code USING btree (email);


--
-- Name: password_setup_code_expires_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX password_setup_code_expires_idx ON public.password_setup_code USING btree (expires_at);


--
-- Name: password_setup_code_one_unused_per_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX password_setup_code_one_unused_per_email ON public.password_setup_code USING btree (email) WHERE (used_at IS NULL);


--
-- Name: pc_org_fulfillment_center_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pc_org_fulfillment_center_id_idx ON public.pc_org USING btree (fulfillment_center_id);


--
-- Name: pc_org_home_block_org_lob_area_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pc_org_home_block_org_lob_area_sort_idx ON public.pc_org_home_block USING btree (pc_org_id, lob, area, sort);


--
-- Name: pc_org_home_block_org_lob_enabled_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pc_org_home_block_org_lob_enabled_idx ON public.pc_org_home_block USING btree (pc_org_id, lob, is_enabled);


--
-- Name: pc_org_leadership_primary_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX pc_org_leadership_primary_uniq ON public.pc_org_leadership USING btree (pc_org_id, role_key) WHERE (is_primary = true);


--
-- Name: pc_org_perm_audit_pcorg_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pc_org_perm_audit_pcorg_idx ON public.pc_org_permission_grant_audit USING btree (pc_org_id, occurred_at DESC);


--
-- Name: pc_org_perm_audit_perm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pc_org_perm_audit_perm_idx ON public.pc_org_permission_grant_audit USING btree (permission_key, occurred_at DESC);


--
-- Name: pc_org_perm_audit_target_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pc_org_perm_audit_target_idx ON public.pc_org_permission_grant_audit USING btree (target_user_id, occurred_at DESC);


--
-- Name: pc_org_permission_grant_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pc_org_permission_grant_lookup ON public.pc_org_permission_grant USING btree (auth_user_id, pc_org_id, permission_key);


--
-- Name: pc_org_state_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pc_org_state_code_idx ON public.pc_org USING btree (state_code);


--
-- Name: pc_org_state_coverage_one_active_state_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX pc_org_state_coverage_one_active_state_uq ON public.pc_org_state_coverage USING btree (pc_org_id, state_code) WHERE (coverage_status = 'active'::text);


--
-- Name: pc_org_state_coverage_pc_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pc_org_state_coverage_pc_org_id_idx ON public.pc_org_state_coverage USING btree (pc_org_id);


--
-- Name: pc_org_state_coverage_state_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pc_org_state_coverage_state_code_idx ON public.pc_org_state_coverage USING btree (state_code);


--
-- Name: person_pc_org_one_active_membership; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX person_pc_org_one_active_membership ON public.person_pc_org USING btree (pc_org_id, person_id) WHERE ((COALESCE(active, true) = true) AND (end_date IS NULL));


--
-- Name: person_tech_id_history_lookup_org_tech; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX person_tech_id_history_lookup_org_tech ON public.person_tech_id_history USING btree (pc_org_id, tech_id, start_date);


--
-- Name: person_tech_id_history_lookup_person; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX person_tech_id_history_lookup_person ON public.person_tech_id_history USING btree (person_id, pc_org_id, start_date);


--
-- Name: person_tech_id_history_one_open_per_person_org; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX person_tech_id_history_one_open_per_person_org ON public.person_tech_id_history USING btree (pc_org_id, person_id) WHERE (end_date IS NULL);


--
-- Name: quota_day_fact_pc_org_month_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX quota_day_fact_pc_org_month_date_idx ON public.quota_day_fact USING btree (pc_org_id, fiscal_month_id, shift_date);


--
-- Name: quota_day_fact_pc_org_route_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX quota_day_fact_pc_org_route_date_idx ON public.quota_day_fact USING btree (pc_org_id, route_id, shift_date);


--
-- Name: quota_pc_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX quota_pc_org_id_idx ON public.quota USING btree (pc_org_id);


--
-- Name: region_leadership_primary_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX region_leadership_primary_uniq ON public.region_leadership USING btree (region_id, role_key) WHERE (is_primary = true);


--
-- Name: roster_invite_log_assignment_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX roster_invite_log_assignment_id_idx ON public.roster_invite_log USING btree (assignment_id);


--
-- Name: roster_invite_log_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX roster_invite_log_email_idx ON public.roster_invite_log USING btree (email);


--
-- Name: roster_invite_log_invited_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX roster_invite_log_invited_at_idx ON public.roster_invite_log USING btree (invited_at);


--
-- Name: roster_invite_log_pc_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX roster_invite_log_pc_org_id_idx ON public.roster_invite_log USING btree (pc_org_id);


--
-- Name: schedule_baseline_month_pc_org_month_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schedule_baseline_month_pc_org_month_idx ON public.schedule_baseline_month USING btree (pc_org_id, fiscal_month_id);


--
-- Name: schedule_baseline_month_pc_org_month_route_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schedule_baseline_month_pc_org_month_route_idx ON public.schedule_baseline_month USING btree (pc_org_id, fiscal_month_id, default_route_id);


--
-- Name: schedule_baseline_month_pc_org_tech_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schedule_baseline_month_pc_org_tech_idx ON public.schedule_baseline_month USING btree (pc_org_id, tech_id);


--
-- Name: schedule_day_fact_pc_org_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schedule_day_fact_pc_org_date_idx ON public.schedule_day_fact USING btree (pc_org_id, shift_date);


--
-- Name: schedule_day_fact_pc_org_month_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schedule_day_fact_pc_org_month_date_idx ON public.schedule_day_fact USING btree (pc_org_id, fiscal_month_id, shift_date);


--
-- Name: schedule_day_fact_pc_org_route_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schedule_day_fact_pc_org_route_date_idx ON public.schedule_day_fact USING btree (pc_org_id, planned_route_id, shift_date);


--
-- Name: schedule_day_fact_pc_org_tech_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schedule_day_fact_pc_org_tech_date_idx ON public.schedule_day_fact USING btree (pc_org_id, tech_id, shift_date);


--
-- Name: schedule_exception_day_org_date_tech_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX schedule_exception_day_org_date_tech_uidx ON public.schedule_exception_day USING btree (pc_org_id, shift_date, tech_id);


--
-- Name: schedule_exception_day_pc_org_approved_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schedule_exception_day_pc_org_approved_date_idx ON public.schedule_exception_day USING btree (pc_org_id, approved, shift_date);


--
-- Name: schedule_exception_day_pc_org_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schedule_exception_day_pc_org_date_idx ON public.schedule_exception_day USING btree (pc_org_id, shift_date);


--
-- Name: schedule_exception_day_pc_org_status_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schedule_exception_day_pc_org_status_date_idx ON public.schedule_exception_day USING btree (pc_org_id, status, shift_date);


--
-- Name: schedule_exception_day_pc_org_tech_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schedule_exception_day_pc_org_tech_date_idx ON public.schedule_exception_day USING btree (pc_org_id, tech_id, shift_date);


--
-- Name: schedule_exception_day_pc_org_tech_date_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schedule_exception_day_pc_org_tech_date_type_idx ON public.schedule_exception_day USING btree (pc_org_id, tech_id, shift_date, exception_type);


--
-- Name: shift_validation_batch_pc_org_id_uploaded_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shift_validation_batch_pc_org_id_uploaded_at_idx ON public.shift_validation_batch USING btree (pc_org_id, uploaded_at DESC);


--
-- Name: shift_validation_day_fact_pc_org_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shift_validation_day_fact_pc_org_date_idx ON public.shift_validation_day_fact USING btree (pc_org_id, shift_date);


--
-- Name: shift_validation_day_fact_pc_org_tech_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shift_validation_day_fact_pc_org_tech_date_idx ON public.shift_validation_day_fact USING btree (pc_org_id, tech_id, shift_date);


--
-- Name: shift_validation_pc_org_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shift_validation_pc_org_id_idx ON public.shift_validation USING btree (pc_org_id);


--
-- Name: shift_validation_row_pc_org_id_shift_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shift_validation_row_pc_org_id_shift_date_idx ON public.shift_validation_row USING btree (pc_org_id, shift_date);


--
-- Name: shift_validation_row_pc_org_id_tech_num_shift_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shift_validation_row_pc_org_id_tech_num_shift_date_idx ON public.shift_validation_row USING btree (pc_org_id, tech_num, shift_date);


--
-- Name: uq_ar_grain; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_ar_grain ON public.assignment_reporting USING btree (child_assignment_id, parent_assignment_id, start_date);


--
-- Name: uq_contractor_assignment_grain; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_contractor_assignment_grain ON public.contractor_assignment USING btree (contractor_id, pc_org_id, start_date);


--
-- Name: uq_person_pc_org_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_person_pc_org_active ON public.person_pc_org USING btree (person_id, pc_org_id) WHERE (active = true);


--
-- Name: ux_assignment_one_active_per_person; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_assignment_one_active_per_person ON public.assignment USING btree (person_id) WHERE (active = true);


--
-- Name: ux_pc_org_office_pair; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_pc_org_office_pair ON public.pc_org_office USING btree (pc_org_id, office_id);


--
-- Name: ux_pc_org_office_primary_per_org; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_pc_org_office_primary_per_org ON public.pc_org_office USING btree (pc_org_id) WHERE (is_primary = true);


--
-- Name: app_users trg_core_app_users_seed_person; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER trg_core_app_users_seed_person BEFORE INSERT ON core.app_users FOR EACH ROW EXECUTE FUNCTION core.ensure_app_user_person();


--
-- Name: app_users trg_core_app_users_updated_at; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER trg_core_app_users_updated_at BEFORE UPDATE ON core.app_users FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: assignments trg_core_assignments_updated_at; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER trg_core_assignments_updated_at BEFORE UPDATE ON core.assignments FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: membership_roles trg_core_membership_roles_updated_at; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER trg_core_membership_roles_updated_at BEFORE UPDATE ON core.membership_roles FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: memberships trg_core_memberships_updated_at; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER trg_core_memberships_updated_at BEFORE UPDATE ON core.memberships FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: metric_batches trg_core_metric_batches_updated_at; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER trg_core_metric_batches_updated_at BEFORE UPDATE ON core.metric_batches FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: metric_profile_rules trg_core_metric_profile_rules_updated_at; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER trg_core_metric_profile_rules_updated_at BEFORE UPDATE ON core.metric_profile_rules FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: metric_profiles trg_core_metric_profiles_updated_at; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER trg_core_metric_profiles_updated_at BEFORE UPDATE ON core.metric_profiles FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: people trg_core_people_updated_at; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER trg_core_people_updated_at BEFORE UPDATE ON core.people FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: person_contacts trg_core_person_contacts_updated_at; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER trg_core_person_contacts_updated_at BEFORE UPDATE ON core.person_contacts FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: reporting_lines trg_core_reporting_lines_updated_at; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER trg_core_reporting_lines_updated_at BEFORE UPDATE ON core.reporting_lines FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: roles trg_core_roles_updated_at; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER trg_core_roles_updated_at BEFORE UPDATE ON core.roles FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: workspaces trg_core_workspaces_updated_at; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER trg_core_workspaces_updated_at BEFORE UPDATE ON core.workspaces FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: person_identifiers trg_normalize_person_identifier_type; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER trg_normalize_person_identifier_type BEFORE INSERT OR UPDATE OF identifier_type ON core.person_identifiers FOR EACH ROW EXECUTE FUNCTION core.normalize_person_identifier_type();


--
-- Name: person_identifiers trg_sync_assignment_identity; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER trg_sync_assignment_identity AFTER INSERT OR UPDATE ON core.person_identifiers FOR EACH ROW WHEN ((new.identifier_type = 'TECH_ID'::text)) EXECUTE FUNCTION core.sync_assignment_identity();


--
-- Name: assignment assignment_refresh_console_eligibility_derived_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER assignment_refresh_console_eligibility_derived_del AFTER DELETE ON public.assignment REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION public.trg_refresh_console_eligibility_derived_del();


--
-- Name: assignment assignment_refresh_console_eligibility_derived_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER assignment_refresh_console_eligibility_derived_ins AFTER INSERT ON public.assignment REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.trg_refresh_console_eligibility_derived_ins();


--
-- Name: assignment assignment_refresh_console_eligibility_derived_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER assignment_refresh_console_eligibility_derived_upd AFTER UPDATE ON public.assignment REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.trg_refresh_console_eligibility_derived_upd();


--
-- Name: person_pc_org person_pc_org_activate_person_trg; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER person_pc_org_activate_person_trg AFTER INSERT OR UPDATE OF active, status ON public.person_pc_org FOR EACH ROW EXECUTE FUNCTION public.trg_person_pc_org_activate_person();


--
-- Name: rpc_policy rpc_policy_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER rpc_policy_touch BEFORE UPDATE ON public.rpc_policy FOR EACH ROW EXECUTE FUNCTION public.rpc_policy_touch_updated_at();


--
-- Name: check_in_day_fact tr_check_in_actual_hours_v5; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tr_check_in_actual_hours_v5 BEFORE INSERT OR UPDATE OF shift_date, first_start_time, last_cp_time, actual_units, actual_jobs ON public.check_in_day_fact FOR EACH ROW EXECUTE FUNCTION public.tg_check_in_actual_hours_v5();


--
-- Name: assignment trg_assignment_end_previous_active; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_assignment_end_previous_active BEFORE INSERT ON public.assignment FOR EACH ROW EXECUTE FUNCTION public.assignment_end_previous_active();


--
-- Name: assignment trg_assignment_set_active_from_dates; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_assignment_set_active_from_dates BEFORE INSERT OR UPDATE OF start_date, end_date ON public.assignment FOR EACH ROW EXECUTE FUNCTION public.assignment_set_active_from_dates();


--
-- Name: assignment trg_assignment_sync_tech_id_history; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_assignment_sync_tech_id_history AFTER INSERT OR UPDATE OF tech_id, start_date, end_date, active, position_title, pc_org_id, person_id ON public.assignment FOR EACH ROW EXECUTE FUNCTION public.sync_person_tech_id_history_from_assignment();


--
-- Name: calendar_blackout_rule trg_calendar_blackout_rule_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_calendar_blackout_rule_updated_at BEFORE UPDATE ON public.calendar_blackout_rule FOR EACH ROW EXECUTE FUNCTION public.set_calendar_blackout_rule_updated_at();


--
-- Name: dispatch_console_log trg_dispatch_console_log_audit_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_dispatch_console_log_audit_update BEFORE UPDATE ON public.dispatch_console_log FOR EACH ROW EXECUTE FUNCTION public.dispatch_console_log_audit_update();


--
-- Name: dispatch_console_log trg_dispatch_console_log_before_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_dispatch_console_log_before_ins BEFORE INSERT ON public.dispatch_console_log FOR EACH ROW EXECUTE FUNCTION public.dispatch_console_log_before_ins_trg();


--
-- Name: dispatch_day_tech trg_dispatch_day_tech_set_route_name; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_dispatch_day_tech_set_route_name BEFORE INSERT OR UPDATE OF planned_route_id ON public.dispatch_day_tech FOR EACH ROW EXECUTE FUNCTION public.dispatch_day_tech_set_route_name();


--
-- Name: field_log_attachment trg_field_log_attachment_refresh_photo_count_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_field_log_attachment_refresh_photo_count_del AFTER DELETE ON public.field_log_attachment FOR EACH ROW EXECUTE FUNCTION public.trg_field_log_attachment_refresh_photo_count();


--
-- Name: field_log_attachment trg_field_log_attachment_refresh_photo_count_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_field_log_attachment_refresh_photo_count_ins AFTER INSERT ON public.field_log_attachment FOR EACH ROW EXECUTE FUNCTION public.trg_field_log_attachment_refresh_photo_count();


--
-- Name: field_log_attachment trg_field_log_attachment_refresh_photo_count_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_field_log_attachment_refresh_photo_count_upd AFTER UPDATE ON public.field_log_attachment FOR EACH ROW EXECUTE FUNCTION public.trg_field_log_attachment_refresh_photo_count();


--
-- Name: field_log_category trg_field_log_category_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_field_log_category_updated_at BEFORE UPDATE ON public.field_log_category FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: field_log_photo_label trg_field_log_photo_label_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_field_log_photo_label_updated_at BEFORE UPDATE ON public.field_log_photo_label FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: field_log_report trg_field_log_report_event_stream; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_field_log_report_event_stream AFTER INSERT OR UPDATE ON public.field_log_report FOR EACH ROW EXECUTE FUNCTION public.trg_field_log_report_event_stream();


--
-- Name: field_log_report trg_field_log_report_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_field_log_report_updated_at BEFORE UPDATE ON public.field_log_report FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: field_log_rule trg_field_log_rule_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_field_log_rule_updated_at BEFORE UPDATE ON public.field_log_rule FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: field_log_subcategory trg_field_log_subcategory_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_field_log_subcategory_updated_at BEFORE UPDATE ON public.field_log_subcategory FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: field_log_ucode_group trg_field_log_ucode_group_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_field_log_ucode_group_updated_at BEFORE UPDATE ON public.field_log_ucode_group FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: field_log_ucode trg_field_log_ucode_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_field_log_ucode_updated_at BEFORE UPDATE ON public.field_log_ucode FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: fiscal_month_dim trg_fiscal_month_dim_set_derived; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fiscal_month_dim_set_derived BEFORE INSERT OR UPDATE OF start_date ON public.fiscal_month_dim FOR EACH ROW EXECUTE FUNCTION public.fiscal_month_dim_set_derived();


--
-- Name: locate_metric_observation trg_locate_metric_observation_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_locate_metric_observation_updated_at BEFORE UPDATE ON public.locate_metric_observation FOR EACH ROW EXECUTE FUNCTION public.touch_locate_metric_observation_updated_at();


--
-- Name: metrics_class_kpi_config trg_metrics_class_kpi_config_default_no_data_behavior; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_metrics_class_kpi_config_default_no_data_behavior BEFORE INSERT OR UPDATE ON public.metrics_class_kpi_config FOR EACH ROW EXECUTE FUNCTION public.metrics_class_kpi_config_default_no_data_behavior();


--
-- Name: metrics_class_kpi_config trg_metrics_class_kpi_config_guard_defaults; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_metrics_class_kpi_config_guard_defaults BEFORE INSERT OR UPDATE ON public.metrics_class_kpi_config FOR EACH ROW EXECUTE FUNCTION public.metrics_class_kpi_config_guard_defaults();


--
-- Name: metrics_class_kpi_config trg_metrics_class_kpi_config_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_metrics_class_kpi_config_touch BEFORE UPDATE ON public.metrics_class_kpi_config FOR EACH ROW EXECUTE FUNCTION public._touch_updated_at();


--
-- Name: metrics_kpi_def trg_metrics_kpi_def_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_metrics_kpi_def_touch BEFORE UPDATE ON public.metrics_kpi_def FOR EACH ROW EXECUTE FUNCTION public._touch_updated_at();


--
-- Name: metrics_raw_batch trg_metrics_raw_batch_compute_on_loaded; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_metrics_raw_batch_compute_on_loaded AFTER INSERT OR UPDATE OF status ON public.metrics_raw_batch FOR EACH ROW EXECUTE FUNCTION public.metrics_after_batch_loaded_v3();

ALTER TABLE public.metrics_raw_batch DISABLE TRIGGER trg_metrics_raw_batch_compute_on_loaded;


--
-- Name: metrics_scoring_class trg_metrics_scoring_class_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_metrics_scoring_class_touch BEFORE UPDATE ON public.metrics_scoring_class FOR EACH ROW EXECUTE FUNCTION public._touch_updated_at();


--
-- Name: pc_org_permission_grant trg_pc_org_permission_grant_ensure_eligibility; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pc_org_permission_grant_ensure_eligibility AFTER INSERT OR UPDATE OF auth_user_id, pc_org_id ON public.pc_org_permission_grant FOR EACH ROW EXECUTE FUNCTION public.trg_grant_ensures_eligibility();


--
-- Name: pc_org trg_pc_org_set_name_from_pc; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pc_org_set_name_from_pc BEFORE INSERT OR UPDATE OF pc_id ON public.pc_org FOR EACH ROW EXECUTE FUNCTION public.pc_org_set_name_from_pc();


--
-- Name: pc_org_state_coverage trg_pc_org_state_coverage_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pc_org_state_coverage_touch_updated_at BEFORE UPDATE ON public.pc_org_state_coverage FOR EACH ROW EXECUTE FUNCTION public.pc_org_state_coverage_touch_updated_at();


--
-- Name: pc_org_user_role trg_pc_org_user_role_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pc_org_user_role_updated_at BEFORE UPDATE ON public.pc_org_user_role FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: pc trg_pc_propagate_number_to_pc_org; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pc_propagate_number_to_pc_org AFTER UPDATE OF pc_number ON public.pc FOR EACH ROW EXECUTE FUNCTION public.pc_propagate_number_to_pc_org();


--
-- Name: person_pc_org trg_person_pc_org_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_person_pc_org_updated_at BEFORE UPDATE ON public.person_pc_org FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: person_tech_id_history trg_person_tech_id_history_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_person_tech_id_history_updated_at BEFORE UPDATE ON public.person_tech_id_history FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: quota trg_quota_set_pc_org_id_from_route; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_quota_set_pc_org_id_from_route BEFORE INSERT OR UPDATE OF route_id ON public.quota FOR EACH ROW EXECUTE FUNCTION public.quota_set_pc_org_id_from_route();


--
-- Name: user_profile trg_sync_user_profile_to_user_person_link; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_user_profile_to_user_person_link AFTER INSERT OR UPDATE OF person_id ON public.user_profile FOR EACH ROW EXECUTE FUNCTION public.sync_user_profile_to_user_person_link();


--
-- Name: user_profile trg_user_profile_ensure_eligibility; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_user_profile_ensure_eligibility AFTER INSERT OR UPDATE OF selected_pc_org_id ON public.user_profile FOR EACH ROW EXECUTE FUNCTION public.ensure_user_pc_org_eligibility();


--
-- Name: user_profile trg_user_profile_sync_user_person_link; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_user_profile_sync_user_person_link AFTER INSERT OR UPDATE OF person_id ON public.user_profile FOR EACH ROW EXECUTE FUNCTION public.sync_user_person_link_from_profile();


--
-- Name: user_profile trg_user_profile_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_user_profile_updated_at BEFORE UPDATE ON public.user_profile FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: activity_logs activity_logs_actor_app_user_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.activity_logs
    ADD CONSTRAINT activity_logs_actor_app_user_id_fkey FOREIGN KEY (actor_app_user_id) REFERENCES core.app_users(app_user_id) ON DELETE SET NULL;


--
-- Name: activity_logs activity_logs_workspace_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.activity_logs
    ADD CONSTRAINT activity_logs_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES core.workspaces(workspace_id) ON DELETE CASCADE;


--
-- Name: app_users app_users_created_by_app_user_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.app_users
    ADD CONSTRAINT app_users_created_by_app_user_id_fkey FOREIGN KEY (created_by_app_user_id) REFERENCES core.app_users(app_user_id);


--
-- Name: app_users app_users_person_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.app_users
    ADD CONSTRAINT app_users_person_id_fkey FOREIGN KEY (person_id) REFERENCES core.people(person_id) ON DELETE SET NULL;


--
-- Name: app_users app_users_updated_by_app_user_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.app_users
    ADD CONSTRAINT app_users_updated_by_app_user_id_fkey FOREIGN KEY (updated_by_app_user_id) REFERENCES core.app_users(app_user_id);


--
-- Name: assignment_events assignment_events_assignment_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.assignment_events
    ADD CONSTRAINT assignment_events_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES core.assignments(assignment_id) ON DELETE CASCADE;


--
-- Name: assignment_events assignment_events_changed_by_app_user_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.assignment_events
    ADD CONSTRAINT assignment_events_changed_by_app_user_id_fkey FOREIGN KEY (changed_by_app_user_id) REFERENCES core.app_users(app_user_id) ON DELETE SET NULL;


--
-- Name: assignments assignments_created_by_app_user_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.assignments
    ADD CONSTRAINT assignments_created_by_app_user_id_fkey FOREIGN KEY (created_by_app_user_id) REFERENCES core.app_users(app_user_id);


--
-- Name: assignments assignments_office_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.assignments
    ADD CONSTRAINT assignments_office_id_fkey FOREIGN KEY (office_id) REFERENCES public.office(office_id) ON DELETE SET NULL;


--
-- Name: assignments assignments_person_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.assignments
    ADD CONSTRAINT assignments_person_id_fkey FOREIGN KEY (person_id) REFERENCES core.people(person_id) ON DELETE RESTRICT;


--
-- Name: assignments assignments_reports_to_assignment_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.assignments
    ADD CONSTRAINT assignments_reports_to_assignment_id_fkey FOREIGN KEY (reports_to_assignment_id) REFERENCES core.assignments(assignment_id) ON DELETE SET NULL;


--
-- Name: assignments assignments_updated_by_app_user_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.assignments
    ADD CONSTRAINT assignments_updated_by_app_user_id_fkey FOREIGN KEY (updated_by_app_user_id) REFERENCES core.app_users(app_user_id);


--
-- Name: assignments assignments_workspace_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.assignments
    ADD CONSTRAINT assignments_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES core.workspaces(workspace_id) ON DELETE RESTRICT;


--
-- Name: company_profile_fact company_profile_fact_person_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.company_profile_fact
    ADD CONSTRAINT company_profile_fact_person_fkey FOREIGN KEY (person_id) REFERENCES core.people(person_id);


--
-- Name: company_profile_fact company_profile_fact_reports_to_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.company_profile_fact
    ADD CONSTRAINT company_profile_fact_reports_to_fkey FOREIGN KEY (reports_to_person_id) REFERENCES core.people(person_id);


--
-- Name: membership_roles membership_roles_created_by_app_user_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.membership_roles
    ADD CONSTRAINT membership_roles_created_by_app_user_id_fkey FOREIGN KEY (created_by_app_user_id) REFERENCES core.app_users(app_user_id);


--
-- Name: membership_roles membership_roles_membership_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.membership_roles
    ADD CONSTRAINT membership_roles_membership_id_fkey FOREIGN KEY (membership_id) REFERENCES core.memberships(membership_id) ON DELETE CASCADE;


--
-- Name: membership_roles membership_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.membership_roles
    ADD CONSTRAINT membership_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES core.roles(role_id) ON DELETE CASCADE;


--
-- Name: membership_roles membership_roles_updated_by_app_user_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.membership_roles
    ADD CONSTRAINT membership_roles_updated_by_app_user_id_fkey FOREIGN KEY (updated_by_app_user_id) REFERENCES core.app_users(app_user_id);


--
-- Name: memberships memberships_app_user_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.memberships
    ADD CONSTRAINT memberships_app_user_id_fkey FOREIGN KEY (app_user_id) REFERENCES core.app_users(app_user_id) ON DELETE CASCADE;


--
-- Name: memberships memberships_created_by_app_user_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.memberships
    ADD CONSTRAINT memberships_created_by_app_user_id_fkey FOREIGN KEY (created_by_app_user_id) REFERENCES core.app_users(app_user_id);


--
-- Name: memberships memberships_updated_by_app_user_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.memberships
    ADD CONSTRAINT memberships_updated_by_app_user_id_fkey FOREIGN KEY (updated_by_app_user_id) REFERENCES core.app_users(app_user_id);


--
-- Name: memberships memberships_workspace_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.memberships
    ADD CONSTRAINT memberships_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES core.workspaces(workspace_id) ON DELETE CASCADE;


--
-- Name: metric_batch_events metric_batch_events_actor_app_user_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.metric_batch_events
    ADD CONSTRAINT metric_batch_events_actor_app_user_id_fkey FOREIGN KEY (actor_app_user_id) REFERENCES core.app_users(app_user_id) ON DELETE SET NULL;


--
-- Name: metric_batch_events metric_batch_events_metric_batch_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.metric_batch_events
    ADD CONSTRAINT metric_batch_events_metric_batch_id_fkey FOREIGN KEY (metric_batch_id) REFERENCES core.metric_batches(metric_batch_id) ON DELETE CASCADE;


--
-- Name: metric_batches metric_batches_created_by_app_user_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.metric_batches
    ADD CONSTRAINT metric_batches_created_by_app_user_id_fkey FOREIGN KEY (created_by_app_user_id) REFERENCES core.app_users(app_user_id) ON DELETE SET NULL;


--
-- Name: metric_batches metric_batches_updated_by_app_user_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.metric_batches
    ADD CONSTRAINT metric_batches_updated_by_app_user_id_fkey FOREIGN KEY (updated_by_app_user_id) REFERENCES core.app_users(app_user_id);


--
-- Name: metric_batches metric_batches_workspace_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.metric_batches
    ADD CONSTRAINT metric_batches_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES core.workspaces(workspace_id) ON DELETE RESTRICT;


--
-- Name: metric_facts metric_facts_assignment_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.metric_facts
    ADD CONSTRAINT metric_facts_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES core.assignments(assignment_id) ON DELETE SET NULL;


--
-- Name: metric_facts metric_facts_metric_batch_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.metric_facts
    ADD CONSTRAINT metric_facts_metric_batch_id_fkey FOREIGN KEY (metric_batch_id) REFERENCES core.metric_batches(metric_batch_id) ON DELETE CASCADE;


--
-- Name: metric_facts metric_facts_person_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.metric_facts
    ADD CONSTRAINT metric_facts_person_id_fkey FOREIGN KEY (person_id) REFERENCES core.people(person_id) ON DELETE SET NULL;


--
-- Name: metric_facts metric_facts_workspace_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.metric_facts
    ADD CONSTRAINT metric_facts_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES core.workspaces(workspace_id) ON DELETE RESTRICT;


--
-- Name: metric_profile_rules metric_profile_rules_created_by_app_user_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.metric_profile_rules
    ADD CONSTRAINT metric_profile_rules_created_by_app_user_id_fkey FOREIGN KEY (created_by_app_user_id) REFERENCES core.app_users(app_user_id);


--
-- Name: metric_profile_rules metric_profile_rules_metric_profile_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.metric_profile_rules
    ADD CONSTRAINT metric_profile_rules_metric_profile_id_fkey FOREIGN KEY (metric_profile_id) REFERENCES core.metric_profiles(metric_profile_id) ON DELETE CASCADE;


--
-- Name: metric_profile_rules metric_profile_rules_updated_by_app_user_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.metric_profile_rules
    ADD CONSTRAINT metric_profile_rules_updated_by_app_user_id_fkey FOREIGN KEY (updated_by_app_user_id) REFERENCES core.app_users(app_user_id);


--
-- Name: metric_rows metric_rows_metric_batch_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.metric_rows
    ADD CONSTRAINT metric_rows_metric_batch_id_fkey FOREIGN KEY (metric_batch_id) REFERENCES core.metric_batches(metric_batch_id) ON DELETE CASCADE;


--
-- Name: metric_rows metric_rows_workspace_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.metric_rows
    ADD CONSTRAINT metric_rows_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES core.workspaces(workspace_id) ON DELETE RESTRICT;


--
-- Name: metric_total_rows metric_total_rows_metric_batch_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.metric_total_rows
    ADD CONSTRAINT metric_total_rows_metric_batch_id_fkey FOREIGN KEY (metric_batch_id) REFERENCES core.metric_batches(metric_batch_id) ON DELETE CASCADE;


--
-- Name: metric_total_rows metric_total_rows_workspace_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.metric_total_rows
    ADD CONSTRAINT metric_total_rows_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES core.workspaces(workspace_id) ON DELETE CASCADE;


--
-- Name: people people_created_by_app_user_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.people
    ADD CONSTRAINT people_created_by_app_user_id_fkey FOREIGN KEY (created_by_app_user_id) REFERENCES core.app_users(app_user_id);


--
-- Name: people people_updated_by_app_user_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.people
    ADD CONSTRAINT people_updated_by_app_user_id_fkey FOREIGN KEY (updated_by_app_user_id) REFERENCES core.app_users(app_user_id);


--
-- Name: person_contacts person_contacts_created_by_app_user_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.person_contacts
    ADD CONSTRAINT person_contacts_created_by_app_user_id_fkey FOREIGN KEY (created_by_app_user_id) REFERENCES core.app_users(app_user_id);


--
-- Name: person_contacts person_contacts_person_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.person_contacts
    ADD CONSTRAINT person_contacts_person_id_fkey FOREIGN KEY (person_id) REFERENCES core.people(person_id) ON DELETE CASCADE;


--
-- Name: person_contacts person_contacts_updated_by_app_user_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.person_contacts
    ADD CONSTRAINT person_contacts_updated_by_app_user_id_fkey FOREIGN KEY (updated_by_app_user_id) REFERENCES core.app_users(app_user_id);


--
-- Name: person_identifiers person_identifiers_person_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.person_identifiers
    ADD CONSTRAINT person_identifiers_person_id_fkey FOREIGN KEY (person_id) REFERENCES core.people(person_id) ON DELETE CASCADE;


--
-- Name: reporting_lines reporting_lines_child_assignment_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.reporting_lines
    ADD CONSTRAINT reporting_lines_child_assignment_id_fkey FOREIGN KEY (child_assignment_id) REFERENCES core.assignments(assignment_id) ON DELETE CASCADE;


--
-- Name: reporting_lines reporting_lines_created_by_app_user_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.reporting_lines
    ADD CONSTRAINT reporting_lines_created_by_app_user_id_fkey FOREIGN KEY (created_by_app_user_id) REFERENCES core.app_users(app_user_id);


--
-- Name: reporting_lines reporting_lines_parent_assignment_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.reporting_lines
    ADD CONSTRAINT reporting_lines_parent_assignment_id_fkey FOREIGN KEY (parent_assignment_id) REFERENCES core.assignments(assignment_id) ON DELETE CASCADE;


--
-- Name: reporting_lines reporting_lines_updated_by_app_user_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.reporting_lines
    ADD CONSTRAINT reporting_lines_updated_by_app_user_id_fkey FOREIGN KEY (updated_by_app_user_id) REFERENCES core.app_users(app_user_id);


--
-- Name: reporting_lines reporting_lines_workspace_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.reporting_lines
    ADD CONSTRAINT reporting_lines_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES core.workspaces(workspace_id) ON DELETE CASCADE;


--
-- Name: admin_permission_grant admin_permission_grant_auth_user_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_permission_grant
    ADD CONSTRAINT admin_permission_grant_auth_user_fk FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: admin_permission_grant admin_permission_grant_permission_key_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_permission_grant
    ADD CONSTRAINT admin_permission_grant_permission_key_fk FOREIGN KEY (permission_key) REFERENCES public.permission_def(permission_key) ON DELETE RESTRICT;


--
-- Name: app_owners app_owners_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_owners
    ADD CONSTRAINT app_owners_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: assignment assignment_office_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignment
    ADD CONSTRAINT assignment_office_id_fkey FOREIGN KEY (office_id) REFERENCES public.office(office_id) ON DELETE SET NULL;


--
-- Name: assignment assignment_pc_org_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignment
    ADD CONSTRAINT assignment_pc_org_id_fk FOREIGN KEY (pc_org_id) REFERENCES public.pc_org(pc_org_id);


--
-- Name: assignment assignment_person_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignment
    ADD CONSTRAINT assignment_person_id_fk FOREIGN KEY (person_id) REFERENCES public.person(person_id);


--
-- Name: assignment assignment_position_title_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignment
    ADD CONSTRAINT assignment_position_title_fk FOREIGN KEY (position_title) REFERENCES public.position_title(position_title) ON UPDATE RESTRICT ON DELETE SET NULL;


--
-- Name: calendar_blackout_rule calendar_blackout_rule_source_holiday_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_blackout_rule
    ADD CONSTRAINT calendar_blackout_rule_source_holiday_id_fkey FOREIGN KEY (source_holiday_id) REFERENCES public.calendar_holiday_baseline(holiday_id);


--
-- Name: check_in_batch check_in_batch_pc_org_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.check_in_batch
    ADD CONSTRAINT check_in_batch_pc_org_fkey FOREIGN KEY (pc_org_id) REFERENCES public.pc_org(pc_org_id) ON DELETE CASCADE;


--
-- Name: check_in_day_fact check_in_day_fact_fiscal_month_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.check_in_day_fact
    ADD CONSTRAINT check_in_day_fact_fiscal_month_fkey FOREIGN KEY (fiscal_month_id) REFERENCES public.fiscal_month_dim(fiscal_month_id) ON DELETE RESTRICT;


--
-- Name: check_in_day_fact check_in_day_fact_pc_org_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.check_in_day_fact
    ADD CONSTRAINT check_in_day_fact_pc_org_fkey FOREIGN KEY (pc_org_id) REFERENCES public.pc_org(pc_org_id) ON DELETE CASCADE;


--
-- Name: check_in_job_row check_in_job_row_batch_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.check_in_job_row
    ADD CONSTRAINT check_in_job_row_batch_fkey FOREIGN KEY (check_in_batch_id) REFERENCES public.check_in_batch(check_in_batch_id) ON DELETE CASCADE;


--
-- Name: check_in_job_row check_in_job_row_pc_org_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.check_in_job_row
    ADD CONSTRAINT check_in_job_row_pc_org_fkey FOREIGN KEY (pc_org_id) REFERENCES public.pc_org(pc_org_id) ON DELETE CASCADE;


--
-- Name: dispatch_console_log_audit dispatch_console_log_audit_dispatch_console_log_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispatch_console_log_audit
    ADD CONSTRAINT dispatch_console_log_audit_dispatch_console_log_id_fkey FOREIGN KEY (dispatch_console_log_id) REFERENCES public.dispatch_console_log(dispatch_console_log_id) ON DELETE CASCADE;


--
-- Name: dispatch_schedule_action_queue dispatch_schedule_action_queue_dispatch_console_log_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispatch_schedule_action_queue
    ADD CONSTRAINT dispatch_schedule_action_queue_dispatch_console_log_id_fkey FOREIGN KEY (dispatch_console_log_id) REFERENCES public.dispatch_console_log(dispatch_console_log_id) ON DELETE CASCADE;


--
-- Name: field_log_attachment field_log_attachment_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_attachment
    ADD CONSTRAINT field_log_attachment_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.field_log_report(report_id) ON DELETE CASCADE;


--
-- Name: field_log_billing_email_log field_log_billing_email_log_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_billing_email_log
    ADD CONSTRAINT field_log_billing_email_log_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.field_log_report(report_id);


--
-- Name: field_log_category field_log_category_config_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_category
    ADD CONSTRAINT field_log_category_config_version_id_fkey FOREIGN KEY (config_version_id) REFERENCES public.field_log_config_version(config_version_id) ON DELETE CASCADE;


--
-- Name: field_log_comment field_log_comment_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_comment
    ADD CONSTRAINT field_log_comment_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.field_log_report(report_id) ON DELETE CASCADE;


--
-- Name: field_log_event field_log_event_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_event
    ADD CONSTRAINT field_log_event_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.field_log_report(report_id) ON DELETE CASCADE;


--
-- Name: field_log_photo_label field_log_photo_label_config_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_photo_label
    ADD CONSTRAINT field_log_photo_label_config_version_id_fkey FOREIGN KEY (config_version_id) REFERENCES public.field_log_config_version(config_version_id) ON DELETE CASCADE;


--
-- Name: field_log_report field_log_report_config_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_report
    ADD CONSTRAINT field_log_report_config_version_id_fkey FOREIGN KEY (config_version_id) REFERENCES public.field_log_config_version(config_version_id);


--
-- Name: field_log_report_not_done field_log_report_not_done_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_report_not_done
    ADD CONSTRAINT field_log_report_not_done_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.field_log_report(report_id) ON DELETE CASCADE;


--
-- Name: field_log_report_post_call field_log_report_post_call_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_report_post_call
    ADD CONSTRAINT field_log_report_post_call_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.field_log_report(report_id) ON DELETE CASCADE;


--
-- Name: field_log_report_qc field_log_report_qc_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_report_qc
    ADD CONSTRAINT field_log_report_qc_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.field_log_report(report_id) ON DELETE CASCADE;


--
-- Name: field_log_report field_log_report_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_report
    ADD CONSTRAINT field_log_report_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.field_log_rule(rule_id);


--
-- Name: field_log_report field_log_report_u_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_report
    ADD CONSTRAINT field_log_report_u_code_fkey FOREIGN KEY (u_code) REFERENCES public.field_log_u_code(code);


--
-- Name: field_log_review_action field_log_review_action_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_review_action
    ADD CONSTRAINT field_log_review_action_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.field_log_report(report_id) ON DELETE CASCADE;


--
-- Name: field_log_rule field_log_rule_config_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_rule
    ADD CONSTRAINT field_log_rule_config_version_id_fkey FOREIGN KEY (config_version_id) REFERENCES public.field_log_config_version(config_version_id) ON DELETE CASCADE;


--
-- Name: field_log_rule_context field_log_rule_context_config_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_rule_context
    ADD CONSTRAINT field_log_rule_context_config_version_id_fkey FOREIGN KEY (config_version_id) REFERENCES public.field_log_config_version(config_version_id) ON DELETE CASCADE;


--
-- Name: field_log_rule_context field_log_rule_context_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_rule_context
    ADD CONSTRAINT field_log_rule_context_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.field_log_rule(rule_id) ON DELETE CASCADE;


--
-- Name: field_log_rule_photo_requirement field_log_rule_photo_requirement_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_rule_photo_requirement
    ADD CONSTRAINT field_log_rule_photo_requirement_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.field_log_rule(rule_id) ON DELETE CASCADE;


--
-- Name: field_log_subcategory field_log_subcategory_config_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_subcategory
    ADD CONSTRAINT field_log_subcategory_config_version_id_fkey FOREIGN KEY (config_version_id) REFERENCES public.field_log_config_version(config_version_id) ON DELETE CASCADE;


--
-- Name: field_log_ucode field_log_ucode_config_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_ucode
    ADD CONSTRAINT field_log_ucode_config_version_id_fkey FOREIGN KEY (config_version_id) REFERENCES public.field_log_config_version(config_version_id) ON DELETE CASCADE;


--
-- Name: field_log_ucode_group field_log_ucode_group_config_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_ucode_group
    ADD CONSTRAINT field_log_ucode_group_config_version_id_fkey FOREIGN KEY (config_version_id) REFERENCES public.field_log_config_version(config_version_id) ON DELETE CASCADE;


--
-- Name: field_log_ucode_group_item field_log_ucode_group_item_config_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_log_ucode_group_item
    ADD CONSTRAINT field_log_ucode_group_item_config_version_id_fkey FOREIGN KEY (config_version_id) REFERENCES public.field_log_config_version(config_version_id) ON DELETE CASCADE;


--
-- Name: assignment_reporting fk_assignment_reporting_child; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignment_reporting
    ADD CONSTRAINT fk_assignment_reporting_child FOREIGN KEY (child_assignment_id) REFERENCES public.assignment(assignment_id);


--
-- Name: assignment_reporting fk_assignment_reporting_parent; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignment_reporting
    ADD CONSTRAINT fk_assignment_reporting_parent FOREIGN KEY (parent_assignment_id) REFERENCES public.assignment(assignment_id);


--
-- Name: contractor_assignment fk_contractor_assignment_contractor; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contractor_assignment
    ADD CONSTRAINT fk_contractor_assignment_contractor FOREIGN KEY (contractor_id) REFERENCES public.contractor(contractor_id);


--
-- Name: contractor_assignment fk_contractor_assignment_pc_org; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contractor_assignment
    ADD CONSTRAINT fk_contractor_assignment_pc_org FOREIGN KEY (pc_org_id) REFERENCES public.pc_org(pc_org_id);


--
-- Name: fuse_onboarding_import_batch fuse_onboarding_import_batch_uploaded_by_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuse_onboarding_import_batch
    ADD CONSTRAINT fuse_onboarding_import_batch_uploaded_by_auth_user_id_fkey FOREIGN KEY (uploaded_by_auth_user_id) REFERENCES public.user_profile(auth_user_id);


--
-- Name: fuse_onboarding_import_row fuse_onboarding_import_row_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuse_onboarding_import_row
    ADD CONSTRAINT fuse_onboarding_import_row_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.fuse_onboarding_import_batch(batch_id) ON DELETE CASCADE;


--
-- Name: locate_cotp_report_row locate_cotp_report_row_locate_reporting_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locate_cotp_report_row
    ADD CONSTRAINT locate_cotp_report_row_locate_reporting_record_id_fkey FOREIGN KEY (locate_reporting_record_id) REFERENCES public.locate_reporting_record(locate_reporting_record_id) ON DELETE CASCADE;


--
-- Name: locate_cotp_report_row locate_cotp_report_row_state_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locate_cotp_report_row
    ADD CONSTRAINT locate_cotp_report_row_state_code_fkey FOREIGN KEY (state_code) REFERENCES public.locate_state_resource(state_code) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: locate_daily_call_log locate_daily_call_log_state_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locate_daily_call_log
    ADD CONSTRAINT locate_daily_call_log_state_code_fkey FOREIGN KEY (state_code) REFERENCES public.locate_state_resource(state_code);


--
-- Name: metrics_class_kpi_config metrics_class_kpi_config_class_type_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metrics_class_kpi_config
    ADD CONSTRAINT metrics_class_kpi_config_class_type_fkey FOREIGN KEY (class_type) REFERENCES public.metrics_scoring_class(class_type) ON DELETE CASCADE;


--
-- Name: metrics_class_kpi_config metrics_class_kpi_config_kpi_key_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metrics_class_kpi_config
    ADD CONSTRAINT metrics_class_kpi_config_kpi_key_fkey FOREIGN KEY (kpi_key) REFERENCES public.metrics_kpi_def(kpi_key) ON DELETE RESTRICT;


--
-- Name: metrics_raw_row metrics_raw_row_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metrics_raw_row
    ADD CONSTRAINT metrics_raw_row_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.metrics_raw_batch(batch_id) ON DELETE CASCADE;


--
-- Name: metrics_raw_total_row metrics_raw_total_row_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metrics_raw_total_row
    ADD CONSTRAINT metrics_raw_total_row_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.metrics_raw_batch(batch_id) ON DELETE CASCADE;


--
-- Name: org_event org_event_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_event
    ADD CONSTRAINT org_event_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.assignment(assignment_id) ON DELETE SET NULL;


--
-- Name: org_event org_event_pc_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_event
    ADD CONSTRAINT org_event_pc_org_id_fkey FOREIGN KEY (pc_org_id) REFERENCES public.pc_org(pc_org_id) ON DELETE CASCADE;


--
-- Name: org_event org_event_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_event
    ADD CONSTRAINT org_event_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.person(person_id) ON DELETE RESTRICT;


--
-- Name: pc_org pc_org_division_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pc_org
    ADD CONSTRAINT pc_org_division_id_fk FOREIGN KEY (division_id) REFERENCES public.division(division_id);


--
-- Name: pc_org_home_block pc_org_home_block_pc_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pc_org_home_block
    ADD CONSTRAINT pc_org_home_block_pc_org_id_fkey FOREIGN KEY (pc_org_id) REFERENCES public.pc_org(pc_org_id) ON DELETE CASCADE;


--
-- Name: pc_org pc_org_mso_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pc_org
    ADD CONSTRAINT pc_org_mso_id_fk FOREIGN KEY (mso_id) REFERENCES public.mso(mso_id);


--
-- Name: pc_org pc_org_mso_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pc_org
    ADD CONSTRAINT pc_org_mso_id_fkey FOREIGN KEY (mso_id) REFERENCES public.mso(mso_id);


--
-- Name: pc_org_office pc_org_office_office_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pc_org_office
    ADD CONSTRAINT pc_org_office_office_id_fkey FOREIGN KEY (office_id) REFERENCES public.office(office_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: pc_org_office pc_org_office_pc_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pc_org_office
    ADD CONSTRAINT pc_org_office_pc_org_id_fkey FOREIGN KEY (pc_org_id) REFERENCES public.pc_org(pc_org_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: pc_org pc_org_pc_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pc_org
    ADD CONSTRAINT pc_org_pc_id_fk FOREIGN KEY (pc_id) REFERENCES public.pc(pc_id);


--
-- Name: pc_org_permission_grant pc_org_permission_grant_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pc_org_permission_grant
    ADD CONSTRAINT pc_org_permission_grant_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: pc_org_permission_grant pc_org_permission_grant_pc_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pc_org_permission_grant
    ADD CONSTRAINT pc_org_permission_grant_pc_org_id_fkey FOREIGN KEY (pc_org_id) REFERENCES public.pc_org(pc_org_id) ON DELETE CASCADE;


--
-- Name: pc_org_permission_grant pc_org_permission_grant_permission_key_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pc_org_permission_grant
    ADD CONSTRAINT pc_org_permission_grant_permission_key_fkey FOREIGN KEY (permission_key) REFERENCES public.permission_def(permission_key) ON DELETE RESTRICT;


--
-- Name: pc_org_permissions pc_org_permissions_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pc_org_permissions
    ADD CONSTRAINT pc_org_permissions_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: pc_org_permissions pc_org_permissions_pc_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pc_org_permissions
    ADD CONSTRAINT pc_org_permissions_pc_org_id_fkey FOREIGN KEY (pc_org_id) REFERENCES public.pc_org(pc_org_id) ON DELETE CASCADE;


--
-- Name: pc_org pc_org_region_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pc_org
    ADD CONSTRAINT pc_org_region_id_fk FOREIGN KEY (region_id) REFERENCES public.region(region_id);


--
-- Name: pc_org pc_org_state_code_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pc_org
    ADD CONSTRAINT pc_org_state_code_fk FOREIGN KEY (state_code) REFERENCES public.locate_state_resource(state_code);


--
-- Name: pc_org_state_coverage pc_org_state_coverage_pc_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pc_org_state_coverage
    ADD CONSTRAINT pc_org_state_coverage_pc_org_id_fkey FOREIGN KEY (pc_org_id) REFERENCES public.pc_org(pc_org_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: pc_org_state_coverage pc_org_state_coverage_state_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pc_org_state_coverage
    ADD CONSTRAINT pc_org_state_coverage_state_code_fkey FOREIGN KEY (state_code) REFERENCES public.locate_state_resource(state_code) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: pc_org_user_role pc_org_user_role_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pc_org_user_role
    ADD CONSTRAINT pc_org_user_role_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: pc_org_user_role pc_org_user_role_pc_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pc_org_user_role
    ADD CONSTRAINT pc_org_user_role_pc_org_id_fkey FOREIGN KEY (pc_org_id) REFERENCES public.pc_org(pc_org_id) ON DELETE CASCADE;


--
-- Name: pc_org_user_role pc_org_user_role_position_title_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pc_org_user_role
    ADD CONSTRAINT pc_org_user_role_position_title_id_fkey FOREIGN KEY (position_title_id) REFERENCES public.position_title(position_title_id) ON DELETE RESTRICT;


--
-- Name: person_pc_org person_pc_org_pc_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.person_pc_org
    ADD CONSTRAINT person_pc_org_pc_org_id_fkey FOREIGN KEY (pc_org_id) REFERENCES public.pc_org(pc_org_id) ON DELETE RESTRICT;


--
-- Name: person_pc_org person_pc_org_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.person_pc_org
    ADD CONSTRAINT person_pc_org_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.person(person_id) ON DELETE RESTRICT;


--
-- Name: quota_day_fact quota_day_fact_fiscal_month_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quota_day_fact
    ADD CONSTRAINT quota_day_fact_fiscal_month_fkey FOREIGN KEY (fiscal_month_id) REFERENCES public.fiscal_month_dim(fiscal_month_id) ON DELETE RESTRICT;


--
-- Name: quota_day_fact quota_day_fact_pc_org_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quota_day_fact
    ADD CONSTRAINT quota_day_fact_pc_org_fkey FOREIGN KEY (pc_org_id) REFERENCES public.pc_org(pc_org_id) ON DELETE CASCADE;


--
-- Name: quota_day_fact quota_day_fact_route_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quota_day_fact
    ADD CONSTRAINT quota_day_fact_route_fkey FOREIGN KEY (route_id) REFERENCES public.route(route_id) ON DELETE CASCADE;


--
-- Name: quota quota_fiscal_month_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quota
    ADD CONSTRAINT quota_fiscal_month_id_fkey FOREIGN KEY (fiscal_month_id) REFERENCES public.fiscal_month_dim(fiscal_month_id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: quota quota_pc_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quota
    ADD CONSTRAINT quota_pc_org_id_fkey FOREIGN KEY (pc_org_id) REFERENCES public.pc_org(pc_org_id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: quota quota_route_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quota
    ADD CONSTRAINT quota_route_id_fk FOREIGN KEY (route_id) REFERENCES public.route(route_id);


--
-- Name: route route_pc_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.route
    ADD CONSTRAINT route_pc_org_id_fkey FOREIGN KEY (pc_org_id) REFERENCES public.pc_org(pc_org_id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: rpc_policy rpc_policy_permission_key_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rpc_policy
    ADD CONSTRAINT rpc_policy_permission_key_fkey FOREIGN KEY (permission_key) REFERENCES public.permission_def(permission_key) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: schedule schedule_assignment_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule
    ADD CONSTRAINT schedule_assignment_id_fk FOREIGN KEY (assignment_id) REFERENCES public.assignment(assignment_id);


--
-- Name: schedule schedule_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule
    ADD CONSTRAINT schedule_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.assignment(assignment_id) ON DELETE CASCADE;


--
-- Name: schedule_baseline_month schedule_baseline_month_default_route_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_baseline_month
    ADD CONSTRAINT schedule_baseline_month_default_route_fkey FOREIGN KEY (default_route_id) REFERENCES public.route(route_id) ON DELETE SET NULL;


--
-- Name: schedule_baseline_month schedule_baseline_month_fiscal_month_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_baseline_month
    ADD CONSTRAINT schedule_baseline_month_fiscal_month_fkey FOREIGN KEY (fiscal_month_id) REFERENCES public.fiscal_month_dim(fiscal_month_id) ON DELETE RESTRICT;


--
-- Name: schedule_baseline_month schedule_baseline_month_pc_org_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_baseline_month
    ADD CONSTRAINT schedule_baseline_month_pc_org_fkey FOREIGN KEY (pc_org_id) REFERENCES public.pc_org(pc_org_id) ON DELETE CASCADE;


--
-- Name: schedule_day_fact schedule_day_fact_exception_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_day_fact
    ADD CONSTRAINT schedule_day_fact_exception_fkey FOREIGN KEY (schedule_exception_day_id) REFERENCES public.schedule_exception_day(schedule_exception_day_id) ON DELETE SET NULL;


--
-- Name: schedule_day_fact schedule_day_fact_fiscal_month_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_day_fact
    ADD CONSTRAINT schedule_day_fact_fiscal_month_fkey FOREIGN KEY (fiscal_month_id) REFERENCES public.fiscal_month_dim(fiscal_month_id) ON DELETE RESTRICT;


--
-- Name: schedule_day_fact schedule_day_fact_pc_org_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_day_fact
    ADD CONSTRAINT schedule_day_fact_pc_org_fkey FOREIGN KEY (pc_org_id) REFERENCES public.pc_org(pc_org_id) ON DELETE CASCADE;


--
-- Name: schedule_day_fact schedule_day_fact_planned_route_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_day_fact
    ADD CONSTRAINT schedule_day_fact_planned_route_fkey FOREIGN KEY (planned_route_id) REFERENCES public.route(route_id) ON DELETE SET NULL;


--
-- Name: schedule_exception_day schedule_exception_day_override_route_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_exception_day
    ADD CONSTRAINT schedule_exception_day_override_route_fkey FOREIGN KEY (override_route_id) REFERENCES public.route(route_id) ON DELETE SET NULL;


--
-- Name: schedule_exception_day schedule_exception_day_pc_org_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_exception_day
    ADD CONSTRAINT schedule_exception_day_pc_org_fkey FOREIGN KEY (pc_org_id) REFERENCES public.pc_org(pc_org_id) ON DELETE CASCADE;


--
-- Name: shift_validation_batch shift_validation_batch_pc_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_validation_batch
    ADD CONSTRAINT shift_validation_batch_pc_org_id_fkey FOREIGN KEY (pc_org_id) REFERENCES public.pc_org(pc_org_id) ON DELETE CASCADE;


--
-- Name: shift_validation_day_fact shift_validation_day_fact_fiscal_month_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_validation_day_fact
    ADD CONSTRAINT shift_validation_day_fact_fiscal_month_fkey FOREIGN KEY (fiscal_month_id) REFERENCES public.fiscal_month_dim(fiscal_month_id) ON DELETE RESTRICT;


--
-- Name: shift_validation_day_fact shift_validation_day_fact_pc_org_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_validation_day_fact
    ADD CONSTRAINT shift_validation_day_fact_pc_org_fkey FOREIGN KEY (pc_org_id) REFERENCES public.pc_org(pc_org_id) ON DELETE CASCADE;


--
-- Name: shift_validation_row shift_validation_row_pc_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_validation_row
    ADD CONSTRAINT shift_validation_row_pc_org_id_fkey FOREIGN KEY (pc_org_id) REFERENCES public.pc_org(pc_org_id) ON DELETE CASCADE;


--
-- Name: shift_validation_row shift_validation_row_shift_validation_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_validation_row
    ADD CONSTRAINT shift_validation_row_shift_validation_batch_id_fkey FOREIGN KEY (shift_validation_batch_id) REFERENCES public.shift_validation_batch(shift_validation_batch_id) ON DELETE SET NULL;


--
-- Name: user_pc_org_eligibility user_pc_org_eligibility_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_pc_org_eligibility
    ADD CONSTRAINT user_pc_org_eligibility_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES public.user_profile(auth_user_id) ON DELETE CASCADE;


--
-- Name: user_pc_org_eligibility user_pc_org_eligibility_pc_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_pc_org_eligibility
    ADD CONSTRAINT user_pc_org_eligibility_pc_org_id_fkey FOREIGN KEY (pc_org_id) REFERENCES public.pc_org(pc_org_id) ON DELETE CASCADE;


--
-- Name: user_profile user_profile_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profile
    ADD CONSTRAINT user_profile_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_profile user_profile_core_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profile
    ADD CONSTRAINT user_profile_core_person_id_fkey FOREIGN KEY (core_person_id) REFERENCES core.people(person_id);


--
-- Name: user_profile user_profile_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profile
    ADD CONSTRAINT user_profile_person_id_fkey FOREIGN KEY (person_id) REFERENCES core.people(person_id) ON DELETE SET NULL;


--
-- Name: user_profile user_profile_selected_pc_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profile
    ADD CONSTRAINT user_profile_selected_pc_org_id_fkey FOREIGN KEY (selected_pc_org_id) REFERENCES public.pc_org(pc_org_id);


--
-- Name: user_role user_role_role_key_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role
    ADD CONSTRAINT user_role_role_key_fkey FOREIGN KEY (role_key) REFERENCES public.role_dim(role_key);


--
-- Name: user_roles user_roles_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_role_key_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_key_fkey FOREIGN KEY (role_key) REFERENCES public.roles(role_key) ON DELETE RESTRICT;


--
-- Name: app_users; Type: ROW SECURITY; Schema: core; Owner: -
--

ALTER TABLE core.app_users ENABLE ROW LEVEL SECURITY;

--
-- Name: home_workspace_preference; Type: ROW SECURITY; Schema: core; Owner: -
--

ALTER TABLE core.home_workspace_preference ENABLE ROW LEVEL SECURITY;

--
-- Name: metric_total_rows; Type: ROW SECURITY; Schema: core; Owner: -
--

ALTER TABLE core.metric_total_rows ENABLE ROW LEVEL SECURITY;

--
-- Name: person_identifiers; Type: ROW SECURITY; Schema: core; Owner: -
--

ALTER TABLE core.person_identifiers ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_permission_grant; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_permission_grant ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_permission_grant_audit; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_permission_grant_audit ENABLE ROW LEVEL SECURITY;

--
-- Name: app_access_session_fact; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_access_session_fact ENABLE ROW LEVEL SECURITY;

--
-- Name: assignment; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.assignment ENABLE ROW LEVEL SECURITY;

--
-- Name: calendar_blackout_rule; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.calendar_blackout_rule ENABLE ROW LEVEL SECURITY;

--
-- Name: calendar_holiday_baseline; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.calendar_holiday_baseline ENABLE ROW LEVEL SECURITY;

--
-- Name: check_in_batch; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.check_in_batch ENABLE ROW LEVEL SECURITY;

--
-- Name: check_in_batch check_in_batch_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY check_in_batch_select ON public.check_in_batch FOR SELECT USING ((public.is_owner() OR api.has_pc_org_permission(pc_org_id, 'roster_manage'::text)));


--
-- Name: check_in_day_fact; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.check_in_day_fact ENABLE ROW LEVEL SECURITY;

--
-- Name: check_in_day_fact check_in_day_fact_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY check_in_day_fact_select ON public.check_in_day_fact FOR SELECT USING ((public.is_owner() OR api.has_pc_org_permission(pc_org_id, 'roster_manage'::text)));


--
-- Name: check_in_job_row; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.check_in_job_row ENABLE ROW LEVEL SECURITY;

--
-- Name: check_in_job_row check_in_job_row_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY check_in_job_row_select ON public.check_in_job_row FOR SELECT USING ((public.is_owner() OR api.has_pc_org_permission(pc_org_id, 'roster_manage'::text)));


--
-- Name: company_profile_fact; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.company_profile_fact ENABLE ROW LEVEL SECURITY;

--
-- Name: dispatch_console_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dispatch_console_log ENABLE ROW LEVEL SECURITY;

--
-- Name: dispatch_console_log_audit; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dispatch_console_log_audit ENABLE ROW LEVEL SECURITY;

--
-- Name: dispatch_console_log_audit dispatch_console_log_audit_insert_none; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dispatch_console_log_audit_insert_none ON public.dispatch_console_log_audit FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: dispatch_console_log_audit dispatch_console_log_audit_select_creator_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dispatch_console_log_audit_select_creator_only ON public.dispatch_console_log_audit FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.dispatch_console_log l
  WHERE ((l.dispatch_console_log_id = dispatch_console_log_audit.dispatch_console_log_id) AND (l.created_by_user_id = auth.uid())))));


--
-- Name: dispatch_console_log dispatch_console_log_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dispatch_console_log_delete_own ON public.dispatch_console_log FOR DELETE TO authenticated USING ((created_by_user_id = auth.uid()));


--
-- Name: dispatch_console_log dispatch_console_log_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dispatch_console_log_insert ON public.dispatch_console_log FOR INSERT TO authenticated WITH CHECK ((public.has_dispatch_console_access(pc_org_id) AND (created_by_user_id = auth.uid())));


--
-- Name: dispatch_console_log dispatch_console_log_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dispatch_console_log_select ON public.dispatch_console_log FOR SELECT TO authenticated USING (public.has_dispatch_console_access(pc_org_id));


--
-- Name: dispatch_console_log dispatch_console_log_update_creator_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dispatch_console_log_update_creator_only ON public.dispatch_console_log FOR UPDATE TO authenticated USING ((created_by_user_id = auth.uid())) WITH CHECK ((created_by_user_id = auth.uid()));


--
-- Name: dispatch_console_log dispatch_console_update_creator; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dispatch_console_update_creator ON public.dispatch_console_log FOR UPDATE TO authenticated USING ((created_by_user_id = auth.uid())) WITH CHECK ((created_by_user_id = auth.uid()));


--
-- Name: dispatch_day_tech; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dispatch_day_tech ENABLE ROW LEVEL SECURITY;

--
-- Name: dispatch_day_tech dispatch_day_tech_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dispatch_day_tech_select ON public.dispatch_day_tech FOR SELECT TO authenticated USING (public.dispatch_has_supervisor_plus(pc_org_id));


--
-- Name: dispatch_schedule_action_queue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dispatch_schedule_action_queue ENABLE ROW LEVEL SECURITY;

--
-- Name: field_log_attachment; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.field_log_attachment ENABLE ROW LEVEL SECURITY;

--
-- Name: field_log_billing_email_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.field_log_billing_email_log ENABLE ROW LEVEL SECURITY;

--
-- Name: field_log_billing_email_recipient; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.field_log_billing_email_recipient ENABLE ROW LEVEL SECURITY;

--
-- Name: field_log_category; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.field_log_category ENABLE ROW LEVEL SECURITY;

--
-- Name: field_log_comment; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.field_log_comment ENABLE ROW LEVEL SECURITY;

--
-- Name: field_log_config_version; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.field_log_config_version ENABLE ROW LEVEL SECURITY;

--
-- Name: field_log_event; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.field_log_event ENABLE ROW LEVEL SECURITY;

--
-- Name: field_log_photo_label; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.field_log_photo_label ENABLE ROW LEVEL SECURITY;

--
-- Name: field_log_report; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.field_log_report ENABLE ROW LEVEL SECURITY;

--
-- Name: field_log_report_not_done; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.field_log_report_not_done ENABLE ROW LEVEL SECURITY;

--
-- Name: field_log_report_post_call; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.field_log_report_post_call ENABLE ROW LEVEL SECURITY;

--
-- Name: field_log_report_qc; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.field_log_report_qc ENABLE ROW LEVEL SECURITY;

--
-- Name: field_log_review_action; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.field_log_review_action ENABLE ROW LEVEL SECURITY;

--
-- Name: field_log_rule; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.field_log_rule ENABLE ROW LEVEL SECURITY;

--
-- Name: field_log_rule_context; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.field_log_rule_context ENABLE ROW LEVEL SECURITY;

--
-- Name: field_log_rule_photo_requirement; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.field_log_rule_photo_requirement ENABLE ROW LEVEL SECURITY;

--
-- Name: field_log_rule_u_code_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.field_log_rule_u_code_config ENABLE ROW LEVEL SECURITY;

--
-- Name: field_log_subcategory; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.field_log_subcategory ENABLE ROW LEVEL SECURITY;

--
-- Name: field_log_u_code; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.field_log_u_code ENABLE ROW LEVEL SECURITY;

--
-- Name: field_log_ucode; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.field_log_ucode ENABLE ROW LEVEL SECURITY;

--
-- Name: field_log_ucode_group; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.field_log_ucode_group ENABLE ROW LEVEL SECURITY;

--
-- Name: field_log_ucode_group_item; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.field_log_ucode_group_item ENABLE ROW LEVEL SECURITY;

--
-- Name: fuse_onboarding_import_batch; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fuse_onboarding_import_batch ENABLE ROW LEVEL SECURITY;

--
-- Name: fuse_onboarding_import_row; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fuse_onboarding_import_row ENABLE ROW LEVEL SECURITY;

--
-- Name: locate_cotp_report_row; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.locate_cotp_report_row ENABLE ROW LEVEL SECURITY;

--
-- Name: locate_metric_observation; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.locate_metric_observation ENABLE ROW LEVEL SECURITY;

--
-- Name: locate_reporting_record; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.locate_reporting_record ENABLE ROW LEVEL SECURITY;

--
-- Name: master_kpi_archive_metric; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.master_kpi_archive_metric ENABLE ROW LEVEL SECURITY;

--
-- Name: master_kpi_archive_snapshot; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.master_kpi_archive_snapshot ENABLE ROW LEVEL SECURITY;

--
-- Name: master_kpi_archive_snapshot master_kpi_archive_snapshot_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY master_kpi_archive_snapshot_read ON public.master_kpi_archive_snapshot FOR SELECT TO authenticated USING ((COALESCE(public.is_owner(), false) OR COALESCE(api.has_any_pc_org_permission(pc_org_id, ARRAY['metrics_manage'::text, 'metrics_access'::text, 'leadership_manage'::text, 'roster_manage'::text]), false) OR ((person_id IS NOT NULL) AND (person_id = ( SELECT up.person_id
   FROM public.user_profile up
  WHERE (up.auth_user_id = auth.uid())
 LIMIT 1)))));


--
-- Name: metrics_band_style_selection; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.metrics_band_style_selection ENABLE ROW LEVEL SECURITY;

--
-- Name: metrics_class_kpi_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.metrics_class_kpi_config ENABLE ROW LEVEL SECURITY;

--
-- Name: metrics_class_kpi_config metrics_class_kpi_config_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY metrics_class_kpi_config_delete_admin ON public.metrics_class_kpi_config FOR DELETE TO authenticated USING (public.is_admin_or_higher());


--
-- Name: metrics_class_kpi_config metrics_class_kpi_config_delete_admin_or_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY metrics_class_kpi_config_delete_admin_or_owner ON public.metrics_class_kpi_config FOR DELETE TO authenticated USING ((public.is_owner() OR public.is_admin_or_higher()));


--
-- Name: metrics_class_kpi_config metrics_class_kpi_config_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY metrics_class_kpi_config_insert_admin ON public.metrics_class_kpi_config FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_higher());


--
-- Name: metrics_class_kpi_config metrics_class_kpi_config_insert_admin_or_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY metrics_class_kpi_config_insert_admin_or_owner ON public.metrics_class_kpi_config FOR INSERT TO authenticated WITH CHECK ((public.is_owner() OR public.is_admin_or_higher()));


--
-- Name: metrics_class_kpi_config metrics_class_kpi_config_owner_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY metrics_class_kpi_config_owner_insert ON public.metrics_class_kpi_config FOR INSERT TO authenticated WITH CHECK (public.is_owner());


--
-- Name: metrics_class_kpi_config metrics_class_kpi_config_owner_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY metrics_class_kpi_config_owner_select ON public.metrics_class_kpi_config FOR SELECT TO authenticated USING (public.is_owner());


--
-- Name: metrics_class_kpi_config metrics_class_kpi_config_owner_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY metrics_class_kpi_config_owner_update ON public.metrics_class_kpi_config FOR UPDATE TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());


--
-- Name: metrics_class_kpi_config metrics_class_kpi_config_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY metrics_class_kpi_config_read ON public.metrics_class_kpi_config FOR SELECT TO authenticated USING (true);


--
-- Name: metrics_class_kpi_config metrics_class_kpi_config_select_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY metrics_class_kpi_config_select_auth ON public.metrics_class_kpi_config FOR SELECT TO authenticated USING (true);


--
-- Name: metrics_class_kpi_config metrics_class_kpi_config_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY metrics_class_kpi_config_update_admin ON public.metrics_class_kpi_config FOR UPDATE TO authenticated USING (public.is_admin_or_higher()) WITH CHECK (public.is_admin_or_higher());


--
-- Name: metrics_class_kpi_config metrics_class_kpi_config_update_admin_or_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY metrics_class_kpi_config_update_admin_or_owner ON public.metrics_class_kpi_config FOR UPDATE TO authenticated USING ((public.is_owner() OR public.is_admin_or_higher())) WITH CHECK ((public.is_owner() OR public.is_admin_or_higher()));


--
-- Name: metrics_class_kpi_rubric; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.metrics_class_kpi_rubric ENABLE ROW LEVEL SECURITY;

--
-- Name: metrics_class_kpi_rubric metrics_class_kpi_rubric_delete_admin_or_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY metrics_class_kpi_rubric_delete_admin_or_owner ON public.metrics_class_kpi_rubric FOR DELETE TO authenticated USING ((public.is_owner() OR public.is_admin_or_higher()));


--
-- Name: metrics_class_kpi_rubric metrics_class_kpi_rubric_insert_admin_or_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY metrics_class_kpi_rubric_insert_admin_or_owner ON public.metrics_class_kpi_rubric FOR INSERT TO authenticated WITH CHECK ((public.is_owner() OR public.is_admin_or_higher()));


--
-- Name: metrics_class_kpi_rubric metrics_class_kpi_rubric_owner_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY metrics_class_kpi_rubric_owner_insert ON public.metrics_class_kpi_rubric FOR INSERT TO authenticated WITH CHECK (public.is_owner());


--
-- Name: metrics_class_kpi_rubric metrics_class_kpi_rubric_owner_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY metrics_class_kpi_rubric_owner_select ON public.metrics_class_kpi_rubric FOR SELECT TO authenticated USING (public.is_owner());


--
-- Name: metrics_class_kpi_rubric metrics_class_kpi_rubric_owner_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY metrics_class_kpi_rubric_owner_update ON public.metrics_class_kpi_rubric FOR UPDATE TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());


--
-- Name: metrics_class_kpi_rubric metrics_class_kpi_rubric_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY metrics_class_kpi_rubric_read ON public.metrics_class_kpi_rubric FOR SELECT TO authenticated USING (true);


--
-- Name: metrics_class_kpi_rubric metrics_class_kpi_rubric_select_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY metrics_class_kpi_rubric_select_auth ON public.metrics_class_kpi_rubric FOR SELECT TO authenticated USING (true);


--
-- Name: metrics_class_kpi_rubric metrics_class_kpi_rubric_update_admin_or_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY metrics_class_kpi_rubric_update_admin_or_owner ON public.metrics_class_kpi_rubric FOR UPDATE TO authenticated USING ((public.is_owner() OR public.is_admin_or_higher())) WITH CHECK ((public.is_owner() OR public.is_admin_or_higher()));


--
-- Name: metrics_color_preset; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.metrics_color_preset ENABLE ROW LEVEL SECURITY;

--
-- Name: metrics_kpi_compute; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.metrics_kpi_compute ENABLE ROW LEVEL SECURITY;

--
-- Name: metrics_kpi_compute metrics_kpi_compute_delete_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY metrics_kpi_compute_delete_scoped ON public.metrics_kpi_compute FOR DELETE TO authenticated USING (api.has_any_pc_org_permission(pc_org_id, ARRAY['metrics_manage'::text, 'roster_manage'::text]));


--
-- Name: metrics_kpi_compute metrics_kpi_compute_insert_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY metrics_kpi_compute_insert_scoped ON public.metrics_kpi_compute FOR INSERT TO authenticated WITH CHECK (api.has_any_pc_org_permission(pc_org_id, ARRAY['metrics_manage'::text, 'roster_manage'::text]));


--
-- Name: metrics_kpi_compute metrics_kpi_compute_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY metrics_kpi_compute_select_scoped ON public.metrics_kpi_compute FOR SELECT TO authenticated USING (api.has_any_pc_org_permission(pc_org_id, ARRAY['metrics_manage'::text, 'roster_manage'::text]));


--
-- Name: metrics_kpi_compute metrics_kpi_compute_update_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY metrics_kpi_compute_update_scoped ON public.metrics_kpi_compute FOR UPDATE TO authenticated USING (api.has_any_pc_org_permission(pc_org_id, ARRAY['metrics_manage'::text, 'roster_manage'::text])) WITH CHECK (api.has_any_pc_org_permission(pc_org_id, ARRAY['metrics_manage'::text, 'roster_manage'::text]));


--
-- Name: metrics_kpi_def; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.metrics_kpi_def ENABLE ROW LEVEL SECURITY;

--
-- Name: metrics_kpi_def metrics_kpi_def_owner_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY metrics_kpi_def_owner_insert ON public.metrics_kpi_def FOR INSERT TO authenticated WITH CHECK (public.is_owner());


--
-- Name: metrics_kpi_def metrics_kpi_def_owner_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY metrics_kpi_def_owner_select ON public.metrics_kpi_def FOR SELECT TO authenticated USING (public.is_owner());


--
-- Name: metrics_kpi_def metrics_kpi_def_owner_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY metrics_kpi_def_owner_update ON public.metrics_kpi_def FOR UPDATE TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());


--
-- Name: metrics_kpi_def metrics_kpi_def_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY metrics_kpi_def_read ON public.metrics_kpi_def FOR SELECT TO authenticated USING (true);


--
-- Name: metrics_kpi_rubric; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.metrics_kpi_rubric ENABLE ROW LEVEL SECURITY;

--
-- Name: metrics_pipeline_queue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.metrics_pipeline_queue ENABLE ROW LEVEL SECURITY;

--
-- Name: metrics_pipeline_run_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.metrics_pipeline_run_log ENABLE ROW LEVEL SECURITY;

--
-- Name: metrics_rank_partition; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.metrics_rank_partition ENABLE ROW LEVEL SECURITY;

--
-- Name: metrics_rank_partition metrics_rank_partition_delete_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY metrics_rank_partition_delete_scoped ON public.metrics_rank_partition FOR DELETE TO authenticated USING (api.has_any_pc_org_permission(pc_org_id, ARRAY['metrics_manage'::text, 'roster_manage'::text]));


--
-- Name: metrics_rank_partition metrics_rank_partition_insert_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY metrics_rank_partition_insert_scoped ON public.metrics_rank_partition FOR INSERT TO authenticated WITH CHECK (api.has_any_pc_org_permission(pc_org_id, ARRAY['metrics_manage'::text, 'roster_manage'::text]));


--
-- Name: metrics_rank_partition metrics_rank_partition_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY metrics_rank_partition_select_scoped ON public.metrics_rank_partition FOR SELECT TO authenticated USING (api.has_any_pc_org_permission(pc_org_id, ARRAY['metrics_manage'::text, 'roster_manage'::text]));


--
-- Name: metrics_rank_partition metrics_rank_partition_update_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY metrics_rank_partition_update_scoped ON public.metrics_rank_partition FOR UPDATE TO authenticated USING (api.has_any_pc_org_permission(pc_org_id, ARRAY['metrics_manage'::text, 'roster_manage'::text])) WITH CHECK (api.has_any_pc_org_permission(pc_org_id, ARRAY['metrics_manage'::text, 'roster_manage'::text]));


--
-- Name: metrics_raw_batch; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.metrics_raw_batch ENABLE ROW LEVEL SECURITY;

--
-- Name: metrics_raw_row; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.metrics_raw_row ENABLE ROW LEVEL SECURITY;

--
-- Name: metrics_raw_row metrics_raw_row_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY metrics_raw_row_insert ON public.metrics_raw_row FOR INSERT TO authenticated WITH CHECK (public.can_upload_metrics_rows(pc_org_id));


--
-- Name: metrics_raw_row metrics_raw_row_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY metrics_raw_row_select ON public.metrics_raw_row FOR SELECT TO authenticated USING (public.can_upload_metrics_rows(pc_org_id));


--
-- Name: metrics_raw_total_row; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.metrics_raw_total_row ENABLE ROW LEVEL SECURITY;

--
-- Name: metrics_scoring_class; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.metrics_scoring_class ENABLE ROW LEVEL SECURITY;

--
-- Name: metrics_scoring_class metrics_scoring_class_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY metrics_scoring_class_read ON public.metrics_scoring_class FOR SELECT TO authenticated USING (true);


--
-- Name: metrics_tech_rollup; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.metrics_tech_rollup ENABLE ROW LEVEL SECURITY;

--
-- Name: metrics_tech_rollup metrics_tech_rollup_delete_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY metrics_tech_rollup_delete_scoped ON public.metrics_tech_rollup FOR DELETE TO authenticated USING (api.has_any_pc_org_permission(pc_org_id, ARRAY['metrics_manage'::text, 'roster_manage'::text]));


--
-- Name: metrics_tech_rollup metrics_tech_rollup_insert_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY metrics_tech_rollup_insert_scoped ON public.metrics_tech_rollup FOR INSERT TO authenticated WITH CHECK (api.has_any_pc_org_permission(pc_org_id, ARRAY['metrics_manage'::text, 'roster_manage'::text]));


--
-- Name: metrics_tech_rollup metrics_tech_rollup_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY metrics_tech_rollup_select_scoped ON public.metrics_tech_rollup FOR SELECT TO authenticated USING (api.has_any_pc_org_permission(pc_org_id, ARRAY['metrics_manage'::text, 'roster_manage'::text]));


--
-- Name: metrics_tech_rollup metrics_tech_rollup_update_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY metrics_tech_rollup_update_scoped ON public.metrics_tech_rollup FOR UPDATE TO authenticated USING (api.has_any_pc_org_permission(pc_org_id, ARRAY['metrics_manage'::text, 'roster_manage'::text])) WITH CHECK (api.has_any_pc_org_permission(pc_org_id, ARRAY['metrics_manage'::text, 'roster_manage'::text]));


--
-- Name: assignment p_assignment_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_assignment_read_all ON public.assignment FOR SELECT TO authenticated USING (true);


--
-- Name: metrics_band_style_selection p_metrics_band_style_selection_admin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_metrics_band_style_selection_admin_only ON public.metrics_band_style_selection TO authenticated USING (public.is_admin_or_higher()) WITH CHECK (public.is_admin_or_higher());


--
-- Name: metrics_class_kpi_config p_metrics_class_kpi_config_mutate_admin_plus; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_metrics_class_kpi_config_mutate_admin_plus ON public.metrics_class_kpi_config TO authenticated USING (public.is_admin_or_higher()) WITH CHECK (public.is_admin_or_higher());


--
-- Name: metrics_class_kpi_rubric p_metrics_class_kpi_rubric_mutate_admin_plus; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_metrics_class_kpi_rubric_mutate_admin_plus ON public.metrics_class_kpi_rubric TO authenticated USING (public.is_admin_or_higher()) WITH CHECK (public.is_admin_or_higher());


--
-- Name: metrics_kpi_def p_metrics_kpi_def_mutate_admin_plus; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_metrics_kpi_def_mutate_admin_plus ON public.metrics_kpi_def TO authenticated USING (public.is_admin_or_higher()) WITH CHECK (public.is_admin_or_higher());


--
-- Name: metrics_raw_batch p_metrics_raw_batch_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_metrics_raw_batch_delete ON public.metrics_raw_batch FOR DELETE TO authenticated USING ((public.is_admin_or_higher() OR api.has_pc_org_permission(pc_org_id, 'metrics_manage'::text) OR api.has_pc_org_permission(pc_org_id, 'roster_manage'::text)));


--
-- Name: metrics_raw_batch p_metrics_raw_batch_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_metrics_raw_batch_insert ON public.metrics_raw_batch FOR INSERT TO authenticated WITH CHECK ((public.is_admin_or_higher() OR api.has_pc_org_permission(pc_org_id, 'metrics_manage'::text) OR api.has_pc_org_permission(pc_org_id, 'roster_manage'::text)));


--
-- Name: metrics_raw_batch p_metrics_raw_batch_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_metrics_raw_batch_select ON public.metrics_raw_batch FOR SELECT TO authenticated USING ((public.is_admin_or_higher() OR api.has_pc_org_permission(pc_org_id, 'metrics_manage'::text) OR api.has_pc_org_permission(pc_org_id, 'roster_manage'::text)));


--
-- Name: metrics_raw_batch p_metrics_raw_batch_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_metrics_raw_batch_update ON public.metrics_raw_batch FOR UPDATE TO authenticated USING ((public.is_admin_or_higher() OR api.has_pc_org_permission(pc_org_id, 'metrics_manage'::text) OR api.has_pc_org_permission(pc_org_id, 'roster_manage'::text))) WITH CHECK ((public.is_admin_or_higher() OR api.has_pc_org_permission(pc_org_id, 'metrics_manage'::text) OR api.has_pc_org_permission(pc_org_id, 'roster_manage'::text)));


--
-- Name: metrics_scoring_class p_mutate_admin_plus; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_mutate_admin_plus ON public.metrics_scoring_class TO authenticated USING (public.is_admin_or_higher()) WITH CHECK (public.is_admin_or_higher());


--
-- Name: pc_org_permission_grant p_pc_org_permission_grant_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_pc_org_permission_grant_read_all ON public.pc_org_permission_grant FOR SELECT TO authenticated USING (true);


--
-- Name: pc_org p_pc_org_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_pc_org_read_all ON public.pc_org FOR SELECT TO authenticated USING (true);


--
-- Name: person_pc_org p_person_pc_org_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_person_pc_org_read_all ON public.person_pc_org FOR SELECT TO authenticated USING (true);


--
-- Name: person p_person_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_person_read_all ON public.person FOR SELECT TO authenticated USING (true);


--
-- Name: pc_org; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pc_org ENABLE ROW LEVEL SECURITY;

--
-- Name: pc_org_home_block; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pc_org_home_block ENABLE ROW LEVEL SECURITY;

--
-- Name: pc_org_home_block pc_org_home_block_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pc_org_home_block_select ON public.pc_org_home_block FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM api.pc_org_choices() c(pc_org_id, pc_org_name)
  WHERE (c.pc_org_id = pc_org_home_block.pc_org_id))));


--
-- Name: pc_org_home_block pc_org_home_block_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pc_org_home_block_write ON public.pc_org_home_block TO authenticated USING ((public.is_owner() OR api.can_manage_pc_org_console(pc_org_id))) WITH CHECK ((public.is_owner() OR api.can_manage_pc_org_console(pc_org_id)));


--
-- Name: pc_org_permission_grant; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pc_org_permission_grant ENABLE ROW LEVEL SECURITY;

--
-- Name: pc_org_permission_grant_audit; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pc_org_permission_grant_audit ENABLE ROW LEVEL SECURITY;

--
-- Name: pc_org_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pc_org_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: pc_org_state_coverage; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pc_org_state_coverage ENABLE ROW LEVEL SECURITY;

--
-- Name: pc_org_user_role; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pc_org_user_role ENABLE ROW LEVEL SECURITY;

--
-- Name: pc_org_user_role pc_org_user_role_owner_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pc_org_user_role_owner_select ON public.pc_org_user_role FOR SELECT USING (api.is_app_owner());


--
-- Name: pc_org_user_role pc_org_user_role_owner_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pc_org_user_role_owner_write ON public.pc_org_user_role USING (api.is_app_owner()) WITH CHECK (api.is_app_owner());


--
-- Name: person; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.person ENABLE ROW LEVEL SECURITY;

--
-- Name: person_pc_org; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.person_pc_org ENABLE ROW LEVEL SECURITY;

--
-- Name: person_tech_id_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.person_tech_id_history ENABLE ROW LEVEL SECURITY;

--
-- Name: quota_day_fact; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quota_day_fact ENABLE ROW LEVEL SECURITY;

--
-- Name: master_kpi_archive_metric read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_all ON public.master_kpi_archive_metric FOR SELECT TO authenticated USING (true);


--
-- Name: master_kpi_archive_snapshot read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_all ON public.master_kpi_archive_snapshot FOR SELECT TO authenticated USING (true);


--
-- Name: metrics_kpi_rubric read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_all ON public.metrics_kpi_rubric FOR SELECT TO authenticated USING (true);


--
-- Name: ref_position_title_map; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ref_position_title_map ENABLE ROW LEVEL SECURITY;

--
-- Name: role_dim; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.role_dim ENABLE ROW LEVEL SECURITY;

--
-- Name: roster_invite_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.roster_invite_log ENABLE ROW LEVEL SECURITY;

--
-- Name: schedule_baseline_month; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.schedule_baseline_month ENABLE ROW LEVEL SECURITY;

--
-- Name: schedule_baseline_month schedule_baseline_month_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY schedule_baseline_month_delete ON public.schedule_baseline_month FOR DELETE TO authenticated USING ((public.is_owner() OR api.has_any_pc_org_permission(pc_org_id, ARRAY['route_lock_manage'::text])));


--
-- Name: schedule_baseline_month schedule_baseline_month_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY schedule_baseline_month_insert ON public.schedule_baseline_month FOR INSERT TO authenticated WITH CHECK ((public.is_owner() OR api.has_any_pc_org_permission(pc_org_id, ARRAY['route_lock_manage'::text])));


--
-- Name: schedule_baseline_month schedule_baseline_month_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY schedule_baseline_month_select ON public.schedule_baseline_month FOR SELECT TO authenticated USING ((public.is_owner() OR api.has_any_pc_org_permission(pc_org_id, ARRAY['route_lock_read'::text, 'route_lock_manage'::text])));


--
-- Name: schedule_baseline_month schedule_baseline_month_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY schedule_baseline_month_update ON public.schedule_baseline_month FOR UPDATE TO authenticated USING ((public.is_owner() OR api.has_any_pc_org_permission(pc_org_id, ARRAY['route_lock_manage'::text]))) WITH CHECK ((public.is_owner() OR api.has_any_pc_org_permission(pc_org_id, ARRAY['route_lock_manage'::text])));


--
-- Name: schedule_day_fact; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.schedule_day_fact ENABLE ROW LEVEL SECURITY;

--
-- Name: schedule_day_fact schedule_day_fact_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY schedule_day_fact_select ON public.schedule_day_fact FOR SELECT TO authenticated USING ((public.is_owner() OR api.has_any_pc_org_permission(pc_org_id, ARRAY['route_lock_read'::text, 'route_lock_manage'::text])));


--
-- Name: schedule_exception_day; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.schedule_exception_day ENABLE ROW LEVEL SECURITY;

--
-- Name: shift_validation_day_fact; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shift_validation_day_fact ENABLE ROW LEVEL SECURITY;

--
-- Name: user_pc_scope; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_pc_scope ENABLE ROW LEVEL SECURITY;

--
-- Name: user_person_link; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_person_link ENABLE ROW LEVEL SECURITY;

--
-- Name: user_profile; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_profile ENABLE ROW LEVEL SECURITY;

--
-- Name: user_profile user_profile_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_profile_select_own ON public.user_profile FOR SELECT TO authenticated USING ((auth.uid() = auth_user_id));


--
-- Name: user_profile user_profile_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_profile_update_own ON public.user_profile FOR UPDATE TO authenticated USING ((auth.uid() = auth_user_id)) WITH CHECK ((auth.uid() = auth_user_id));


--
-- Name: user_role; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_role ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict ns63T16wJF3ZDB5QDXkgfkNoEXEFiLzt0ljCWyHEA1foxU4EvYestWYQ6Kq3jk9


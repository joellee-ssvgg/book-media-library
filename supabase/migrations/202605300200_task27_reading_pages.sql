-- Page-based reading logging.
--
-- Users log "read to page X"; the server computes pages_read as the delta from
-- the previously recorded page and records a session_logged event (which feeds
-- the reading-traces heatmap). The reading heatmap now aggregates pages_read
-- instead of active_minutes.

-- 1) Relax book session_logged validation: a book reading session may be logged
--    by pages alone, so require at least one of active_minutes / pages_read.
create or replace function public.task09_validate_progress_payload(
  input_model_key text,
  input_event_type text,
  input_payload jsonb
)
returns boolean
language plpgsql
immutable
as $$
declare
  normalized_model_key text := lower(trim(coalesce(input_model_key, '')));
  normalized_event_type text := lower(trim(coalesce(input_event_type, '')));
  current_page integer;
  total_pages integer;
begin
  if input_payload is null or jsonb_typeof(input_payload) <> 'object' then
    return false;
  end if;

  if normalized_model_key = 'book_page_progress' then
    if normalized_event_type = 'progress_set' then
      if not public.task09_json_positive_integer(input_payload, 'current_page') then
        return false;
      end if;

      current_page := (input_payload ->> 'current_page')::integer;

      if input_payload ? 'total_pages' then
        if not public.task09_json_positive_integer(input_payload, 'total_pages') then
          return false;
        end if;

        total_pages := (input_payload ->> 'total_pages')::integer;
        if current_page > total_pages then
          return false;
        end if;
      end if;

      return true;
    end if;

    if normalized_event_type = 'session_logged' then
      -- A book session can be logged by time, by pages, or both.
      if not (input_payload ? 'active_minutes' or input_payload ? 'pages_read') then
        return false;
      end if;

      if input_payload ? 'active_minutes' and not public.task09_json_positive_integer(input_payload, 'active_minutes') then
        return false;
      end if;

      if input_payload ? 'pages_read' and not public.task09_json_positive_integer(input_payload, 'pages_read') then
        return false;
      end if;

      if input_payload ? 'current_page' and not public.task09_json_positive_integer(input_payload, 'current_page') then
        return false;
      end if;

      if input_payload ? 'total_pages' and not public.task09_json_positive_integer(input_payload, 'total_pages') then
        return false;
      end if;

      if input_payload ? 'current_page' and input_payload ? 'total_pages' then
        current_page := (input_payload ->> 'current_page')::integer;
        total_pages := (input_payload ->> 'total_pages')::integer;
        if current_page > total_pages then
          return false;
        end if;
      end if;

      return true;
    end if;

    return normalized_event_type in ('completed', 'abandoned');
  end if;

  if normalized_model_key = 'watch_log' then
    if normalized_event_type = 'session_logged' then
      return public.task09_json_positive_integer(input_payload, 'active_minutes');
    end if;

    if normalized_event_type = 'progress_set' then
      return not (input_payload ? 'timestamp_seconds')
        or public.task09_json_nonnegative_number(input_payload, 'timestamp_seconds');
    end if;

    if normalized_event_type = 'completed' then
      return not (input_payload ? 'runtime_minutes')
        or public.task09_json_positive_integer(input_payload, 'runtime_minutes');
    end if;

    return normalized_event_type = 'abandoned';
  end if;

  return false;
exception
  when invalid_text_representation or numeric_value_out_of_range then
    return false;
end;
$$;

-- 2) Keep the seeded model schema in sync (documentation of the relaxed rule).
update public.progress_models
set schema_json = '{
  "type": "object",
  "events": {
    "progress_set": {
      "required": ["current_page"],
      "properties": {
        "current_page": "positive_integer",
        "total_pages": "positive_integer_optional"
      }
    },
    "session_logged": {
      "one_of_required": ["active_minutes", "pages_read"],
      "properties": {
        "active_minutes": "positive_integer_optional",
        "pages_read": "positive_integer_optional",
        "current_page": "positive_integer_optional",
        "total_pages": "positive_integer_optional"
      }
    },
    "completed": {},
    "abandoned": {}
  }
}'::jsonb,
    updated_at = now(),
    row_version = row_version + 1
where model_key = 'book_page_progress';

-- 3) Latest recorded page/total for an entry, so the client can prefill and show
--    "last read to page X".
create or replace function public.get_entry_reading_progress(
  input_entry_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  actor_profile_id uuid;
  last_page integer;
  last_total integer;
begin
  actor_profile_id := public.current_profile_id();
  if actor_profile_id is null then
    raise exception 'authenticated profile required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.user_entries e
    where e.id = input_entry_id
      and e.profile_id = actor_profile_id
      and e.deleted_at is null
  ) then
    raise exception 'entry must belong to the current profile' using errcode = '42501';
  end if;

  select (pl.payload_json ->> 'current_page')::int
  into last_page
  from public.progress_logs pl
  where pl.entry_id = input_entry_id
    and pl.profile_id = actor_profile_id
    and pl.payload_json ? 'current_page'
  order by pl.occurred_at desc, pl.id desc
  limit 1;

  select (pl.payload_json ->> 'total_pages')::int
  into last_total
  from public.progress_logs pl
  where pl.entry_id = input_entry_id
    and pl.profile_id = actor_profile_id
    and pl.payload_json ? 'total_pages'
  order by pl.occurred_at desc, pl.id desc
  limit 1;

  return jsonb_build_object(
    'current_page', last_page,
    'total_pages', last_total
  );
end;
$$;

revoke all on function public.get_entry_reading_progress(uuid) from public, anon;
grant execute on function public.get_entry_reading_progress(uuid) to authenticated;

-- 4) Log reading by page. Computes pages_read from the prior page (default 0).
--    pages_read > 0 -> session_logged (counts toward the heatmap);
--    pages_read = 0 (no forward progress) -> progress_set (updates progress only).
create or replace function public.log_reading_pages(
  input_entry_id uuid,
  input_current_page integer,
  input_total_pages integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  actor_profile_id uuid;
  prev_page integer;
  pages_read integer;
  payload jsonb;
  event_type text;
begin
  actor_profile_id := public.current_profile_id();
  if actor_profile_id is null then
    raise exception 'authenticated profile required to log reading' using errcode = '42501';
  end if;

  if input_current_page is null or input_current_page < 1 then
    raise exception 'current_page must be a positive integer' using errcode = '22023';
  end if;

  if input_total_pages is not null and input_total_pages < input_current_page then
    raise exception 'total_pages cannot be smaller than current_page' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.user_entries e
    where e.id = input_entry_id
      and e.profile_id = actor_profile_id
      and e.deleted_at is null
  ) then
    raise exception 'entry must belong to the current profile' using errcode = '42501';
  end if;

  select (pl.payload_json ->> 'current_page')::int
  into prev_page
  from public.progress_logs pl
  where pl.entry_id = input_entry_id
    and pl.profile_id = actor_profile_id
    and pl.payload_json ? 'current_page'
  order by pl.occurred_at desc, pl.id desc
  limit 1;

  pages_read := greatest(0, input_current_page - coalesce(prev_page, 0));

  payload := jsonb_build_object('current_page', input_current_page);
  if input_total_pages is not null then
    payload := payload || jsonb_build_object('total_pages', input_total_pages);
  end if;

  if pages_read > 0 then
    event_type := 'session_logged';
    payload := payload || jsonb_build_object('pages_read', pages_read);
  else
    event_type := 'progress_set';
  end if;

  perform public.record_progress(
    input_entry_id,
    'book_page_progress',
    event_type,
    payload
  );

  return jsonb_build_object(
    'ok', true,
    'event_type', event_type,
    'pages_read', pages_read,
    'current_page', input_current_page,
    'total_pages', input_total_pages
  );
end;
$$;

revoke all on function public.log_reading_pages(uuid, integer, integer) from public, anon;
grant execute on function public.log_reading_pages(uuid, integer, integer) to authenticated;

-- 5) Reading-traces heatmap now aggregates pages_read per day (was active_minutes).
create or replace function public.get_reading_traces(
  input_year integer default null,
  input_month integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  current_profile_id uuid;
  profile_tz text := 'Asia/Shanghai';
  now_local date;
  resolved_year integer;
  resolved_month integer;
  today_day integer;
  local_start timestamp;
  range_start timestamptz;
  range_end timestamptz;
  days_obj jsonb;
  total_pages integer;
begin
  select p.id, coalesce(p.tz, 'Asia/Shanghai')
  into current_profile_id, profile_tz
  from public.profiles p
  where p.auth_user_id = auth.uid();

  profile_tz := coalesce(profile_tz, 'Asia/Shanghai');
  now_local := (now() at time zone profile_tz)::date;

  resolved_year := coalesce(input_year, extract(year from now_local)::int);
  resolved_month := coalesce(input_month, extract(month from now_local)::int);

  if resolved_month < 1 or resolved_month > 12
     or resolved_year < 1970 or resolved_year > 9999 then
    raise exception 'get_reading_traces requires a valid year and month' using errcode = '22023';
  end if;

  if extract(year from now_local)::int = resolved_year
     and extract(month from now_local)::int = resolved_month then
    today_day := extract(day from now_local)::int;
  else
    today_day := null;
  end if;

  if current_profile_id is null then
    return jsonb_build_object(
      'year', resolved_year,
      'month', resolved_month,
      'days', '{}'::jsonb,
      'total_pages', 0,
      'today', today_day
    );
  end if;

  local_start := make_timestamp(resolved_year, resolved_month, 1, 0, 0, 0);
  range_start := local_start at time zone profile_tz;
  range_end := (local_start + interval '1 month') at time zone profile_tz;

  with per_day as (
    select
      extract(day from (pl.occurred_at at time zone profile_tz))::int as day_num,
      sum((pl.payload_json ->> 'pages_read')::int) as pages
    from public.progress_logs pl
    where pl.profile_id = current_profile_id
      and pl.event_type = 'session_logged'
      and pl.payload_json ? 'pages_read'
      and pl.occurred_at >= range_start
      and pl.occurred_at < range_end
    group by 1
  )
  select
    coalesce(jsonb_object_agg(per_day.day_num::text, per_day.pages), '{}'::jsonb),
    coalesce(sum(per_day.pages), 0)::int
  into days_obj, total_pages
  from per_day;

  return jsonb_build_object(
    'year', resolved_year,
    'month', resolved_month,
    'days', days_obj,
    'total_pages', total_pages,
    'today', today_day
  );
end;
$$;

revoke all on function public.get_reading_traces(integer, integer) from public, anon;
grant execute on function public.get_reading_traces(integer, integer) to authenticated;

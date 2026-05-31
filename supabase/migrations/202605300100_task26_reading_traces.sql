-- Reading traces heatmap: per-day reading minutes for a given month, scoped to
-- the current profile. Reading time comes from progress_logs 'session_logged'
-- events (payload active_minutes), aggregated by local day in the profile's tz.
--
-- When year/month are null the current month (in the profile's tz) is used, so
-- the database is the single source of truth for "today" — the client never
-- computes dates and there is no SSR/browser timezone hydration mismatch.
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
  total_minutes integer;
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

  -- today_day is non-null only when the resolved month is the current local month.
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
      'total_minutes', 0,
      'today', today_day
    );
  end if;

  -- Month boundaries expressed as wall-clock midnight in the profile tz.
  local_start := make_timestamp(resolved_year, resolved_month, 1, 0, 0, 0);
  range_start := local_start at time zone profile_tz;
  range_end := (local_start + interval '1 month') at time zone profile_tz;

  with per_day as (
    select
      extract(day from (pl.occurred_at at time zone profile_tz))::int as day_num,
      sum((pl.payload_json ->> 'active_minutes')::int) as minutes
    from public.progress_logs pl
    where pl.profile_id = current_profile_id
      and pl.event_type = 'session_logged'
      and pl.payload_json ? 'active_minutes'
      and pl.occurred_at >= range_start
      and pl.occurred_at < range_end
    group by 1
  )
  select
    coalesce(jsonb_object_agg(per_day.day_num::text, per_day.minutes), '{}'::jsonb),
    coalesce(sum(per_day.minutes), 0)::int
  into days_obj, total_minutes
  from per_day;

  return jsonb_build_object(
    'year', resolved_year,
    'month', resolved_month,
    'days', days_obj,
    'total_minutes', total_minutes,
    'today', today_day
  );
end;
$$;

revoke all on function public.get_reading_traces(integer, integer) from public, anon;
grant execute on function public.get_reading_traces(integer, integer) to authenticated;

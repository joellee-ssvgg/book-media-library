create or replace function public.task16_seed_recommendations()
returns jsonb
language plpgsql
stable
set search_path = public, auth, extensions
as $$
begin
  if public.current_profile_id() is null then
    raise exception 'authenticated profile required to read task16 seed recommendations' using errcode = '42501';
  end if;

  return jsonb_build_array(
    jsonb_build_object(
      'media_type', 'book',
      'title', 'The Pragmatic Programmer',
      'subtitle', 'P0 seed recommendation',
      'year', 1999,
      'provider', 'openlibrary',
      'href', '/add/book?q=The%20Pragmatic%20Programmer'
    ),
    jsonb_build_object(
      'media_type', 'book',
      'title', 'Dune',
      'subtitle', 'P0 seed recommendation',
      'year', 1965,
      'provider', 'openlibrary',
      'href', '/add/book?q=Dune'
    ),
    jsonb_build_object(
      'media_type', 'movie',
      'title', 'Inception',
      'subtitle', 'P0 seed recommendation',
      'year', 2010,
      'provider', 'tmdb',
      'href', '/add/movie?q=Inception'
    )
  );
end;
$$;

create or replace function public.task16_get_library_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  actor_profile_id uuid;
  entry_count integer;
  library_json jsonb;
  continue_json jsonb;
  recent_finished_json jsonb;
  stalled_json jsonb;
  completed_this_year integer;
begin
  actor_profile_id := public.current_profile_id();
  if actor_profile_id is null then
    raise exception 'authenticated profile required to read library dashboard' using errcode = '42501';
  end if;

  with owner_entries as (
    select
      e.id as entry_id,
      e.work_id,
      e.edition_id,
      w.media_type,
      w.canonical_title,
      w.first_release_year,
      ed.cover_url,
      ed.runtime_minutes,
      ed.page_count,
      e.status,
      e.rating_x10,
      e.visibility_scope,
      e.favorite,
      e.imported,
      e.started_at,
      e.finished_at,
      e.created_at,
      e.updated_at,
      ps.snapshot_json
    from public.user_entries e
    join public.works w on w.id = e.work_id and w.deleted_at is null
    join public.editions ed on ed.id = e.edition_id and ed.deleted_at is null
    left join lateral (
      select ps.snapshot_json
      from public.progress_snapshots ps
      where ps.entry_id = e.id
        and ps.profile_id = actor_profile_id
      order by ps.updated_at desc
      limit 1
    ) ps on true
    where e.profile_id = actor_profile_id
      and e.deleted_at is null
  )
  select
    count(*)::integer,
    coalesce(
      jsonb_agg(
        jsonb_strip_nulls(jsonb_build_object(
          'entry_id', entry_id,
          'work_id', work_id,
          'edition_id', edition_id,
          'media_type', media_type,
          'title', canonical_title,
          'year', first_release_year,
          'cover_url', cover_url,
          'runtime_minutes', runtime_minutes,
          'page_count', page_count,
          'status', status,
          'rating_x10', rating_x10,
          'visibility_scope', visibility_scope,
          'favorite', favorite,
          'imported', imported,
          'started_at', started_at,
          'finished_at', finished_at,
          'updated_at', updated_at,
          'progress', snapshot_json
        ))
        order by updated_at desc
      ),
      '[]'::jsonb
    )
  into entry_count, library_json
  from owner_entries;

  with active_entries as (
    select
      e.id as entry_id,
      w.media_type,
      w.canonical_title,
      ed.cover_url,
      e.status,
      e.updated_at,
      ps.snapshot_json
    from public.user_entries e
    join public.works w on w.id = e.work_id and w.deleted_at is null
    join public.editions ed on ed.id = e.edition_id and ed.deleted_at is null
    left join lateral (
      select ps.snapshot_json
      from public.progress_snapshots ps
      where ps.entry_id = e.id
        and ps.profile_id = actor_profile_id
      order by ps.updated_at desc
      limit 1
    ) ps on true
    where e.profile_id = actor_profile_id
      and e.deleted_at is null
      and e.status in ('reading', 'watching')
  )
  select coalesce(
    jsonb_agg(
      jsonb_strip_nulls(jsonb_build_object(
        'entry_id', entry_id,
        'media_type', media_type,
        'title', canonical_title,
        'cover_url', cover_url,
        'status', status,
        'updated_at', updated_at,
        'progress', snapshot_json
      ))
      order by updated_at desc
    ),
    '[]'::jsonb
  )
  into continue_json
  from active_entries;

  with finished_entries as (
    select
      e.id as entry_id,
      w.media_type,
      w.canonical_title,
      ed.cover_url,
      e.status,
      e.rating_x10,
      e.finished_at,
      e.updated_at
    from public.user_entries e
    join public.works w on w.id = e.work_id and w.deleted_at is null
    join public.editions ed on ed.id = e.edition_id and ed.deleted_at is null
    where e.profile_id = actor_profile_id
      and e.deleted_at is null
      and e.status in ('finished', 'watched')
  )
  select coalesce(
    jsonb_agg(
      jsonb_strip_nulls(jsonb_build_object(
        'entry_id', entry_id,
        'media_type', media_type,
        'title', canonical_title,
        'cover_url', cover_url,
        'status', status,
        'rating_x10', rating_x10,
        'finished_at', finished_at,
        'updated_at', updated_at
      ))
      order by coalesce(finished_at, updated_at) desc
    ),
    '[]'::jsonb
  )
  into recent_finished_json
  from (select * from finished_entries order by coalesce(finished_at, updated_at) desc limit 6) limited_finished;

  with stalled_entries as (
    select
      e.id as entry_id,
      w.media_type,
      w.canonical_title,
      e.status,
      e.updated_at
    from public.user_entries e
    join public.works w on w.id = e.work_id and w.deleted_at is null
    where e.profile_id = actor_profile_id
      and e.deleted_at is null
      and e.status in ('reading', 'watching')
      and e.updated_at < now() - interval '14 days'
    order by e.updated_at asc
    limit 6
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'entry_id', entry_id,
        'media_type', media_type,
        'title', canonical_title,
        'status', status,
        'updated_at', updated_at
      )
      order by updated_at asc
    ),
    '[]'::jsonb
  )
  into stalled_json
  from stalled_entries;

  select count(*)::integer
  into completed_this_year
  from public.user_entries e
  where e.profile_id = actor_profile_id
    and e.deleted_at is null
    and e.status in ('finished', 'watched')
    and coalesce(e.finished_at, e.updated_at) >= date_trunc('year', now());

  return jsonb_build_object(
    'status', 'loaded',
    'profile_id', actor_profile_id,
    'entry_count', entry_count,
    'use_seed', entry_count = 0,
    'seed_recommendations', case when entry_count = 0 then public.task16_seed_recommendations() else '[]'::jsonb end,
    'library', library_json,
    'dashboard', jsonb_build_object(
      'continue_reading', continue_json,
      'recent_finished', recent_finished_json,
      'stalled', stalled_json,
      'heatmap_placeholder', jsonb_build_object(
        'status', 'placeholder',
        'reason', 'P0 reserves the heatmap surface until progress density data exists'
      ),
      'year_ring', jsonb_build_object(
        'completed_this_year', completed_this_year,
        'goal', 12
      )
    )
  );
end;
$$;

revoke all on function public.task16_seed_recommendations() from public;
revoke all on function public.task16_get_library_dashboard() from public;
grant execute on function public.task16_get_library_dashboard() to authenticated;

create or replace function public.task17_public_profile_state(input_username text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth, extensions
as $$
declare
  normalized_username text := lower(trim(coalesce(input_username, '')));
  target_profile record;
begin
  if normalized_username !~ '^[a-z0-9_]{3,20}$' then
    return jsonb_build_object('status', 'not_found');
  end if;

  select p.id, p.deleted_at, p.public_visibility
  into target_profile
  from public.profiles p
  where lower(p.username) = normalized_username
  limit 1;

  if target_profile.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  if target_profile.deleted_at is not null then
    return jsonb_build_object('status', 'gone');
  end if;

  if target_profile.public_visibility not in ('public', 'unlisted') then
    return jsonb_build_object('status', 'not_found');
  end if;

  return jsonb_build_object('status', 'active');
end;
$$;

create or replace function public.task17_get_public_profile(input_username text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth, extensions
as $$
declare
  normalized_username text := lower(trim(coalesce(input_username, '')));
  target_profile record;
  top3_json jsonb := '[]'::jsonb;
  recent_finished_json jsonb := '[]'::jsonb;
  public_reviews_json jsonb := '[]'::jsonb;
  stats_json jsonb := '{}'::jsonb;
begin
  if normalized_username !~ '^[a-z0-9_]{3,20}$' then
    return jsonb_build_object('status', 'not_found');
  end if;

  select
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.bio,
    p.public_top3,
    p.public_visibility,
    p.deleted_at
  into target_profile
  from public.profiles p
  where lower(p.username) = normalized_username
  limit 1;

  if target_profile.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  if target_profile.deleted_at is not null then
    return jsonb_build_object('status', 'gone');
  end if;

  if target_profile.public_visibility not in ('public', 'unlisted') then
    return jsonb_build_object('status', 'not_found');
  end if;

  with selected_top3 as (
    select
      case
        when item ->> 'entry_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then (item ->> 'entry_id')::uuid
        else null
      end as entry_id,
      coalesce(nullif(item ->> 'position', '')::integer, ordinality::integer) as position
    from jsonb_array_elements(coalesce(target_profile.public_top3, '[]'::jsonb)) with ordinality as top3(item, ordinality)
  ),
  visible_top3 as (
    select
      pe.id as entry_id,
      pe.work_id,
      pe.edition_id,
      pe.status,
      pe.rating_x10,
      pe.review,
      pe.favorite,
      pe.finished_at,
      pe.updated_at,
      w.media_type,
      w.canonical_title,
      w.first_release_year,
      ed.cover_url,
      st.position
    from selected_top3 st
    join public.public_entries_v pe on pe.id = st.entry_id and pe.profile_id = target_profile.id
    join public.works w on w.id = pe.work_id and w.deleted_at is null
    join public.editions ed on ed.id = pe.edition_id and ed.deleted_at is null
    where st.entry_id is not null
    order by st.position asc
  )
  select coalesce(
    jsonb_agg(
      jsonb_strip_nulls(jsonb_build_object(
        'entry_id', entry_id,
        'work_id', work_id,
        'edition_id', edition_id,
        'media_type', media_type,
        'title', canonical_title,
        'year', first_release_year,
        'cover_url', cover_url,
        'status', status,
        'rating_x10', rating_x10,
        'review', review,
        'favorite', favorite,
        'finished_at', finished_at,
        'updated_at', updated_at,
        'position', position
      ))
      order by position asc
    ),
    '[]'::jsonb
  )
  into top3_json
  from visible_top3;

  with visible_finished as (
    select
      pe.id as entry_id,
      pe.work_id,
      pe.edition_id,
      pe.status,
      pe.rating_x10,
      pe.review,
      pe.favorite,
      pe.finished_at,
      pe.updated_at,
      w.media_type,
      w.canonical_title,
      w.first_release_year,
      ed.cover_url
    from public.public_entries_v pe
    join public.works w on w.id = pe.work_id and w.deleted_at is null
    join public.editions ed on ed.id = pe.edition_id and ed.deleted_at is null
    where pe.profile_id = target_profile.id
      and pe.status in ('finished', 'watched')
    order by coalesce(pe.finished_at, pe.updated_at) desc
    limit 6
  )
  select coalesce(
    jsonb_agg(
      jsonb_strip_nulls(jsonb_build_object(
        'entry_id', entry_id,
        'work_id', work_id,
        'edition_id', edition_id,
        'media_type', media_type,
        'title', canonical_title,
        'year', first_release_year,
        'cover_url', cover_url,
        'status', status,
        'rating_x10', rating_x10,
        'review', review,
        'favorite', favorite,
        'finished_at', finished_at,
        'updated_at', updated_at
      ))
      order by coalesce(finished_at, updated_at) desc
    ),
    '[]'::jsonb
  )
  into recent_finished_json
  from visible_finished;

  with visible_reviews as (
    select
      pe.id as entry_id,
      pe.work_id,
      pe.edition_id,
      pe.status,
      pe.rating_x10,
      pe.review,
      pe.finished_at,
      pe.updated_at,
      w.media_type,
      w.canonical_title,
      w.first_release_year
    from public.public_entries_v pe
    join public.works w on w.id = pe.work_id and w.deleted_at is null
    where pe.profile_id = target_profile.id
      and pe.review is not null
    order by pe.updated_at desc
    limit 6
  )
  select coalesce(
    jsonb_agg(
      jsonb_strip_nulls(jsonb_build_object(
        'entry_id', entry_id,
        'work_id', work_id,
        'edition_id', edition_id,
        'media_type', media_type,
        'title', canonical_title,
        'year', first_release_year,
        'status', status,
        'rating_x10', rating_x10,
        'review', review,
        'finished_at', finished_at,
        'updated_at', updated_at
      ))
      order by updated_at desc
    ),
    '[]'::jsonb
  )
  into public_reviews_json
  from visible_reviews;

  select jsonb_build_object(
    'public_entries', count(*)::integer,
    'books', count(*) filter (where w.media_type = 'book')::integer,
    'movies', count(*) filter (where w.media_type = 'movie')::integer,
    'completed', count(*) filter (where pe.status in ('finished', 'watched'))::integer,
    'reviewed', count(*) filter (where pe.review is not null)::integer,
    'average_rating_x10', round(avg(pe.rating_x10), 2)
  )
  into stats_json
  from public.public_entries_v pe
  join public.works w on w.id = pe.work_id and w.deleted_at is null
  where pe.profile_id = target_profile.id;

  return jsonb_build_object(
    'status', 'active',
    'profile', jsonb_strip_nulls(jsonb_build_object(
      'username', target_profile.username,
      'display_name', target_profile.display_name,
      'avatar_url', target_profile.avatar_url,
      'bio', target_profile.bio,
      'public_visibility', target_profile.public_visibility
    )),
    'top3', top3_json,
    'recent_finished', recent_finished_json,
    'public_reviews', public_reviews_json,
    'stats', stats_json
  );
end;
$$;

create or replace function public.task17_get_public_work(
  input_work_id uuid,
  input_slug text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth, extensions
as $$
declare
  target_work record;
  default_edition record;
  stats_json jsonb := '{}'::jsonb;
  recent_reviews_json jsonb := '[]'::jsonb;
begin
  select
    w.id,
    w.media_type,
    w.canonical_title,
    w.original_title,
    w.description,
    w.original_language,
    w.first_release_year
  into target_work
  from public.works w
  where w.id = input_work_id
    and w.deleted_at is null;

  if target_work.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  select
    ed.id,
    ed.title,
    ed.cover_url,
    ed.language,
    ed.edition_type,
    ed.page_count,
    ed.runtime_minutes,
    ed.release_date
  into default_edition
  from public.editions ed
  where ed.work_id = target_work.id
    and ed.is_default
    and ed.deleted_at is null
  order by ed.created_at asc
  limit 1;

  select jsonb_build_object(
    'public_entries', count(*)::integer,
    'completed', count(*) filter (where pe.status in ('finished', 'watched'))::integer,
    'reviewed', count(*) filter (where pe.review is not null)::integer,
    'average_rating_x10', round(avg(pe.rating_x10), 2)
  )
  into stats_json
  from public.public_entries_v pe
  where pe.work_id = target_work.id;

  with visible_reviews as (
    select
      pe.id as entry_id,
      pe.status,
      pe.rating_x10,
      pe.review,
      pe.finished_at,
      pe.updated_at,
      case
        when p.deleted_at is not null then '已注销用户'
        else coalesce(nullif(p.display_name, ''), p.username)
      end as author_name,
      case
        when p.deleted_at is null and p.public_visibility in ('public', 'unlisted') then p.username
        else null
      end as author_username,
      p.deleted_at is not null as author_deleted
    from public.public_entries_v pe
    left join public.profiles p on p.id = pe.profile_id
    where pe.work_id = target_work.id
      and pe.review is not null
    order by pe.updated_at desc
    limit 8
  )
  select coalesce(
    jsonb_agg(
      jsonb_strip_nulls(jsonb_build_object(
        'entry_id', entry_id,
        'status', status,
        'rating_x10', rating_x10,
        'review', review,
        'finished_at', finished_at,
        'updated_at', updated_at,
        'author_name', author_name,
        'author_username', author_username,
        'author_deleted', author_deleted
      ))
      order by updated_at desc
    ),
    '[]'::jsonb
  )
  into recent_reviews_json
  from visible_reviews;

  return jsonb_build_object(
    'status', 'active',
    'work', jsonb_strip_nulls(jsonb_build_object(
      'work_id', target_work.id,
      'media_type', target_work.media_type,
      'title', target_work.canonical_title,
      'original_title', target_work.original_title,
      'description', target_work.description,
      'original_language', target_work.original_language,
      'year', target_work.first_release_year
    )),
    'edition', jsonb_strip_nulls(jsonb_build_object(
      'edition_id', default_edition.id,
      'title', default_edition.title,
      'cover_url', default_edition.cover_url,
      'language', default_edition.language,
      'edition_type', default_edition.edition_type,
      'page_count', default_edition.page_count,
      'runtime_minutes', default_edition.runtime_minutes,
      'release_date', default_edition.release_date
    )),
    'stats', stats_json,
    'recent_reviews', recent_reviews_json
  );
end;
$$;

create or replace function public.task17_update_public_profile(
  input_public_visibility text,
  input_public_top3 jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  actor_profile_id uuid;
  normalized_visibility text := lower(trim(coalesce(input_public_visibility, 'public')));
  top3 jsonb := coalesce(input_public_top3, '[]'::jsonb);
  item jsonb;
  item_entry_id uuid;
  position integer := 0;
  seen_entry_ids uuid[] := '{}';
  normalized_top3 jsonb := '[]'::jsonb;
begin
  actor_profile_id := public.current_profile_id();
  if actor_profile_id is null then
    raise exception 'authenticated profile required to update public profile' using errcode = '42501';
  end if;

  if normalized_visibility not in ('private', 'unlisted', 'followers', 'public') then
    raise exception 'public_visibility is invalid: %', input_public_visibility using errcode = '23514';
  end if;

  if jsonb_typeof(top3) <> 'array' then
    raise exception 'public_top3 must be an array' using errcode = '23514';
  end if;

  if jsonb_array_length(top3) > 3 then
    raise exception 'public_top3 accepts at most 3 entries' using errcode = '23514';
  end if;

  for item in
    select value from jsonb_array_elements(top3)
  loop
    position := position + 1;

    if jsonb_typeof(item) <> 'object'
      or coalesce(item ->> 'entry_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then
      raise exception 'public_top3 item % must include a valid entry_id', position using errcode = '23514';
    end if;

    item_entry_id := (item ->> 'entry_id')::uuid;

    if item_entry_id = any(seen_entry_ids) then
      raise exception 'public_top3 contains duplicate entry_id: %', item_entry_id using errcode = '23505';
    end if;

    if not exists (
      select 1
      from public.user_entries e
      where e.id = item_entry_id
        and e.profile_id = actor_profile_id
        and e.deleted_at is null
    ) then
      raise exception 'public_top3 entry must belong to the current profile' using errcode = '42501';
    end if;

    seen_entry_ids := array_append(seen_entry_ids, item_entry_id);
    normalized_top3 := normalized_top3 || jsonb_build_array(jsonb_build_object(
      'entry_id', item_entry_id,
      'position', position
    ));
  end loop;

  if cardinality(seen_entry_ids) > 0 then
    update public.user_entries e
    set
      visibility_scope = 'public',
      field_visibility_json = coalesce(e.field_visibility_json, '{}'::jsonb)
        || jsonb_build_object(
          'rating_x10', 'public',
          'rating', 'public',
          'review', 'public',
          'favorite', 'public',
          'finished_at', 'public'
        )
    where e.profile_id = actor_profile_id
      and e.id = any(seen_entry_ids)
      and e.deleted_at is null;
  end if;

  update public.profiles p
  set
    public_visibility = normalized_visibility,
    public_top3 = normalized_top3
  where p.id = actor_profile_id
    and p.deleted_at is null;

  return jsonb_build_object(
    'status', 'updated',
    'profile_id', actor_profile_id,
    'public_visibility', normalized_visibility,
    'public_top3', normalized_top3
  );
end;
$$;

revoke all on function public.task17_public_profile_state(text) from public;
revoke all on function public.task17_get_public_profile(text) from public;
revoke all on function public.task17_get_public_work(uuid, text) from public;
revoke all on function public.task17_update_public_profile(text, jsonb) from public;

grant execute on function public.task17_public_profile_state(text) to anon, authenticated;
grant execute on function public.task17_get_public_profile(text) to anon, authenticated;
grant execute on function public.task17_get_public_work(uuid, text) to anon, authenticated;
grant execute on function public.task17_update_public_profile(text, jsonb) to authenticated;

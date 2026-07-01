create or replace function public.task15_create_movie_entry_from_provider(
  input_provider text,
  input_external_id text,
  input_title text,
  input_status text default 'want_to_watch',
  input_rating_x10 integer default null,
  input_year integer default null,
  input_original_title text default null,
  input_language text default null,
  input_description text default null,
  input_cover_url text default null,
  input_runtime_minutes integer default null,
  input_external_ids jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  actor_profile_id uuid;
  provider_id text := lower(trim(coalesce(input_provider, '')));
  provider_external_id text := nullif(trim(coalesce(input_external_id, '')), '');
  normalized_status text := lower(trim(coalesce(input_status, 'want_to_watch')));
  external_ids jsonb;
  item_payload jsonb;
begin
  actor_profile_id := public.current_profile_id();
  if actor_profile_id is null then
    raise exception 'authenticated profile required to add provider movie' using errcode = '42501';
  end if;

  if provider_id <> 'tmdb' then
    raise exception 'unsupported movie provider: %', input_provider using errcode = '23514';
  end if;

  if provider_external_id is null then
    raise exception 'provider external id is required' using errcode = '23514';
  end if;

  if normalized_status not in ('want_to_watch', 'watching', 'watched', 'abandoned') then
    raise exception 'movie entry status is invalid: %', input_status using errcode = '23514';
  end if;

  if input_rating_x10 is not null and (input_rating_x10 < 5 or input_rating_x10 > 50 or input_rating_x10 % 5 <> 0) then
    raise exception 'movie entry rating_x10 is invalid: %', input_rating_x10 using errcode = '23514';
  end if;

  if input_runtime_minutes is not null and input_runtime_minutes <= 0 then
    raise exception 'movie runtime_minutes must be positive: %', input_runtime_minutes using errcode = '23514';
  end if;

  external_ids := case
    when jsonb_typeof(input_external_ids) = 'array' then input_external_ids
    else '[]'::jsonb
  end;

  if not exists (
    select 1
    from jsonb_array_elements(external_ids) item
    where lower(trim(item ->> 'source')) = provider_id
      and trim(coalesce(item ->> 'external_id', item ->> 'externalId')) = provider_external_id
  ) then
    external_ids := external_ids || jsonb_build_array(jsonb_build_object(
      'source', provider_id,
      'external_id', provider_external_id
    ));
  end if;

  item_payload := jsonb_strip_nulls(jsonb_build_object(
    'media_type', 'movie',
    'canonical_title', input_title,
    'status', normalized_status,
    'rating_x10', input_rating_x10,
    'first_release_year', input_year,
    'original_title', input_original_title,
    'original_language', input_language,
    'description', input_description,
    'cover_url', input_cover_url,
    'edition_language', input_language,
    'edition_type', 'theatrical',
    'runtime_minutes', input_runtime_minutes,
    'external_ids', external_ids
  ));

  return public.task14_create_entry_for_profile(actor_profile_id, item_payload, false, 'provider');
end;
$$;

revoke all on function public.task15_create_movie_entry_from_provider(text, text, text, text, integer, integer, text, text, text, text, integer, jsonb) from public;
grant execute on function public.task15_create_movie_entry_from_provider(text, text, text, text, integer, integer, text, text, text, text, integer, jsonb) to authenticated;

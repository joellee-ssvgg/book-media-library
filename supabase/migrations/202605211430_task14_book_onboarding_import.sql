set search_path = public, extensions;

create or replace function public.create_default_edition_for_work()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  metadata jsonb := coalesce(new.metadata_json, '{}'::jsonb);
begin
  insert into public.editions (
    work_id,
    title,
    cover_url,
    language,
    edition_type,
    page_count,
    runtime_minutes,
    is_default,
    metadata_json
  )
  values (
    new.id,
    coalesce(nullif(metadata ->> 'edition_title', ''), new.canonical_title),
    nullif(metadata ->> 'cover_url', ''),
    coalesce(nullif(metadata ->> 'edition_language', ''), new.original_language),
    coalesce(nullif(metadata ->> 'edition_type', ''), 'default'),
    case
      when coalesce(metadata ->> 'page_count', '') ~ '^[1-9][0-9]*$'
      then (metadata ->> 'page_count')::integer
      else null
    end,
    case
      when coalesce(metadata ->> 'runtime_minutes', '') ~ '^[1-9][0-9]*$'
      then (metadata ->> 'runtime_minutes')::integer
      else null
    end,
    true,
    coalesce(metadata -> 'edition_metadata', '{}'::jsonb)
  );

  return new;
end;
$$;

drop policy if exists works_authenticated_insert on public.works;
create policy works_authenticated_insert
on public.works
for insert
to authenticated
with check (
  created_by = (select public.current_profile_id())
  and deleted_at is null
  and visibility_scope = 'global_public'
  and promotion_status = 'promoted'
  and created_via in ('manual_global', 'provider')
);

create or replace function public.task14_set_auth_context_for_profile(input_profile_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_auth_user_id uuid;
begin
  select p.auth_user_id
  into target_auth_user_id
  from public.profiles p
  where p.id = input_profile_id
    and p.deleted_at is null;

  if target_auth_user_id is null then
    raise exception 'import target profile does not exist' using errcode = '23503';
  end if;

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', target_auth_user_id::text, 'role', 'authenticated')::text,
    true
  );
  perform set_config('request.jwt.claim.sub', target_auth_user_id::text, true);

  return target_auth_user_id;
end;
$$;

create or replace function public.task14_record_entry_activity(
  input_entry_id uuid,
  input_event_type text,
  input_imported boolean default false,
  input_payload_json jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  target_entry public.user_entries%rowtype;
  normalized_event_type text := lower(trim(coalesce(input_event_type, 'entry_created')));
  new_activity_id uuid;
begin
  select *
  into target_entry
  from public.user_entries e
  where e.id = input_entry_id
    and e.deleted_at is null;

  if target_entry.id is null then
    raise exception 'entry does not exist for activity event' using errcode = '23503';
  end if;

  if normalized_event_type not in ('entry_created', 'status_changed') then
    raise exception 'unsupported task14 activity event: %', normalized_event_type using errcode = '23514';
  end if;

  if target_entry.visibility_scope = 'private' then
    insert into public.private_activity_log (
      profile_id,
      profile_hash,
      event_type,
      subject_type,
      subject_id,
      entry_id,
      work_id,
      visibility_scope_snapshot,
      payload_json,
      imported,
      occurred_at,
      created_by
    )
    values (
      target_entry.profile_id,
      public.task10_profile_hash(target_entry.profile_id),
      normalized_event_type,
      'entry',
      target_entry.id,
      target_entry.id,
      target_entry.work_id,
      target_entry.visibility_scope,
      coalesce(input_payload_json, '{}'::jsonb),
      coalesce(input_imported, false),
      now(),
      target_entry.profile_id
    )
    returning id into new_activity_id;

    return new_activity_id;
  end if;

  insert into public.activity_events (
    profile_id,
    profile_hash,
    event_type,
    subject_type,
    subject_id,
    entry_id,
    work_id,
    visibility_scope_snapshot,
    payload_json,
    imported,
    occurred_at,
    created_by
  )
  values (
    target_entry.profile_id,
    public.task10_profile_hash(target_entry.profile_id),
    normalized_event_type,
    'entry',
    target_entry.id,
    target_entry.id,
    target_entry.work_id,
    target_entry.visibility_scope,
    coalesce(input_payload_json, '{}'::jsonb),
    coalesce(input_imported, false),
    now(),
    target_entry.profile_id
  )
  returning id into new_activity_id;

  return new_activity_id;
end;
$$;

create or replace function public.task14_entry_item_external_ids(input_item jsonb)
returns jsonb
language sql
immutable
as $$
  select case
    when jsonb_typeof(input_item -> 'external_ids') = 'array' then input_item -> 'external_ids'
    else '[]'::jsonb
  end;
$$;

create or replace function public.task14_create_entry_for_profile(
  input_profile_id uuid,
  input_item jsonb,
  input_imported boolean default false,
  input_origin text default 'provider'
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  actor_profile_id uuid;
  normalized_origin text := lower(trim(coalesce(input_origin, 'provider')));
  normalized_media_type text;
  normalized_title text;
  normalized_status text;
  normalized_visibility text;
  normalized_language text;
  normalized_original_title text;
  normalized_description text;
  release_year integer;
  rating_value integer;
  item_favorite boolean;
  started_value timestamptz;
  finished_value timestamptz;
  external_ids jsonb;
  external_item jsonb;
  normalized_external_source text;
  normalized_external_id text;
  normalized_external_source_url text;
  existing_work_id uuid;
  target_work_id uuid;
  target_edition_id uuid;
  new_entry_id uuid;
  activity_id uuid;
  work_fingerprint text;
  work_metadata jsonb;
  field_visibility jsonb;
  insert_created boolean := false;
begin
  perform public.task14_set_auth_context_for_profile(input_profile_id);
  actor_profile_id := public.current_profile_id();

  if actor_profile_id is null or actor_profile_id <> input_profile_id then
    raise exception 'authenticated profile required to create task14 entry' using errcode = '42501';
  end if;

  if input_item is null or jsonb_typeof(input_item) <> 'object' then
    raise exception 'task14 import item must be an object' using errcode = '23514';
  end if;

  normalized_media_type := lower(trim(coalesce(input_item ->> 'media_type', 'book')));
  normalized_title := trim(regexp_replace(coalesce(input_item ->> 'canonical_title', input_item ->> 'title', ''), '\s+', ' ', 'g'));
  normalized_status := lower(trim(coalesce(input_item ->> 'status', case when normalized_media_type = 'movie' then 'watched' else 'want_to_read' end)));
  normalized_visibility := lower(trim(coalesce(input_item ->> 'visibility_scope', 'private')));
  normalized_language := nullif(trim(coalesce(input_item ->> 'original_language', input_item ->> 'language', '')), '');
  normalized_original_title := nullif(trim(regexp_replace(coalesce(input_item ->> 'original_title', ''), '\s+', ' ', 'g')), '');
  normalized_description := nullif(trim(coalesce(input_item ->> 'description', '')), '');
  external_ids := public.task14_entry_item_external_ids(input_item);
  field_visibility := case
    when jsonb_typeof(input_item -> 'field_visibility_json') = 'object' then input_item -> 'field_visibility_json'
    else '{}'::jsonb
  end;
  item_favorite := coalesce((input_item ->> 'favorite')::boolean, false);

  if normalized_media_type not in ('book', 'movie') then
    raise exception 'task14 supports only P0 media types, got %', normalized_media_type using errcode = '23514';
  end if;

  if normalized_title = '' then
    raise exception 'task14 entry title is required' using errcode = '23514';
  end if;

  if normalized_visibility not in ('private', 'unlisted', 'followers', 'public') then
    raise exception 'task14 entry visibility is invalid: %', normalized_visibility using errcode = '23514';
  end if;

  if coalesce(input_item ->> 'first_release_year', input_item ->> 'year', '') ~ '^[0-9]{1,4}$' then
    release_year := coalesce(input_item ->> 'first_release_year', input_item ->> 'year')::integer;
  end if;

  if coalesce(input_item ->> 'rating_x10', '') ~ '^[0-9]+$' then
    rating_value := (input_item ->> 'rating_x10')::integer;
  end if;

  if nullif(input_item ->> 'started_at', '') is not null then
    started_value := (input_item ->> 'started_at')::timestamptz;
  end if;

  if nullif(input_item ->> 'finished_at', '') is not null then
    finished_value := (input_item ->> 'finished_at')::timestamptz;
  end if;

  for external_item in
    select value from jsonb_array_elements(external_ids)
  loop
    normalized_external_source := nullif(lower(trim(coalesce(external_item ->> 'source', ''))), '');
    normalized_external_id := nullif(trim(coalesce(external_item ->> 'external_id', external_item ->> 'externalId', '')), '');

    if normalized_external_source is not null and normalized_external_id is not null then
      select ei.target_id
      into existing_work_id
      from public.external_ids ei
      join public.works w on w.id = ei.target_id
      where ei.target_type = 'work'
        and ei.source = normalized_external_source
        and ei.external_id = normalized_external_id
        and ei.deleted_at is null
        and w.deleted_at is null
      limit 1;

      if existing_work_id is not null then
        target_work_id := existing_work_id;
        exit;
      end if;
    end if;
  end loop;

  if target_work_id is null then
    normalized_external_source := null;
    normalized_external_id := null;

    select nullif(lower(trim(value ->> 'source')), ''), nullif(trim(coalesce(value ->> 'external_id', value ->> 'externalId')), '')
    into normalized_external_source, normalized_external_id
    from jsonb_array_elements(external_ids)
    where nullif(trim(coalesce(value ->> 'external_id', value ->> 'externalId')), '') is not null
      and nullif(lower(trim(value ->> 'source')), '') is not null
    limit 1;

    if normalized_external_source is not null and normalized_external_id is not null then
      work_fingerprint := 'external:' || normalized_external_source || ':' || normalized_external_id;
    else
      work_fingerprint := 'import:'
        || normalized_origin
        || ':'
        || encode(extensions.digest(
          normalized_media_type || ':' || normalized_title || ':' || coalesce(release_year::text, '') || ':' || coalesce(input_item ->> 'original_work_id', ''),
          'sha256'
        ), 'hex');
    end if;

    work_metadata := jsonb_strip_nulls(jsonb_build_object(
      'cover_url', nullif(input_item ->> 'cover_url', ''),
      'edition_title', nullif(input_item ->> 'edition_title', ''),
      'edition_language', nullif(input_item ->> 'edition_language', ''),
      'edition_type', nullif(input_item ->> 'edition_type', ''),
      'page_count', nullif(input_item ->> 'page_count', ''),
      'runtime_minutes', nullif(input_item ->> 'runtime_minutes', ''),
      'task14_origin', normalized_origin,
      'original_work_id', nullif(input_item ->> 'original_work_id', ''),
      'description', normalized_description
    ));

    insert into public.works (
      media_type,
      canonical_title,
      original_title,
      description,
      original_language,
      first_release_year,
      visibility_scope,
      promotion_status,
      created_via,
      metadata_json,
      fingerprint,
      dedup_skipped_reason
    )
    values (
      normalized_media_type,
      normalized_title,
      normalized_original_title,
      normalized_description,
      normalized_language,
      release_year,
      'global_public',
      'promoted',
      case when normalized_origin = 'provider' then 'provider' else 'manual_global' end,
      work_metadata,
      work_fingerprint,
      case when jsonb_array_length(external_ids) = 0 then 'task14_import_without_exact_external_id' else null end
    )
    on conflict (fingerprint) do nothing
    returning id into target_work_id;

    if target_work_id is null then
      select w.id
      into target_work_id
      from public.works w
      where w.fingerprint = work_fingerprint
        and w.deleted_at is null
      limit 1;
    end if;
  end if;

  if target_work_id is null then
    raise exception 'task14 could not resolve work for entry' using errcode = '23503';
  end if;

  select e.id
  into target_edition_id
  from public.editions e
  where e.work_id = target_work_id
    and e.is_default
    and e.deleted_at is null
  order by e.created_at asc
  limit 1;

  if target_edition_id is null then
    raise exception 'task14 work has no default edition: %', target_work_id using errcode = '23514';
  end if;

  for external_item in
    select value from jsonb_array_elements(external_ids)
  loop
    normalized_external_source := nullif(lower(trim(coalesce(external_item ->> 'source', ''))), '');
    normalized_external_id := nullif(trim(coalesce(external_item ->> 'external_id', external_item ->> 'externalId', '')), '');
    normalized_external_source_url := nullif(trim(coalesce(external_item ->> 'source_url', external_item ->> 'sourceUrl', '')), '');

    if normalized_external_source is not null and normalized_external_id is not null then
      insert into public.external_ids (
        target_type,
        target_id,
        source,
        external_id,
        source_url,
        match_method,
        confidence_score,
        verified_by_user,
        metadata_json
      )
      values (
        'work',
        target_work_id,
        normalized_external_source,
        normalized_external_id,
        normalized_external_source_url,
        case when normalized_origin = 'provider' then 'provider' else 'import' end,
        case when normalized_origin = 'provider' then 1.000 else null end,
        normalized_origin = 'provider',
        jsonb_strip_nulls(jsonb_build_object(
          'task14_origin', normalized_origin,
          'imported', input_imported
        ))
      )
      on conflict (source, external_id) do nothing;
    end if;
  end loop;

  insert into public.user_entries (
    work_id,
    edition_id,
    status,
    rating_x10,
    visibility_scope,
    field_visibility_json,
    favorite,
    imported,
    started_at,
    finished_at
  )
  values (
    target_work_id,
    target_edition_id,
    normalized_status,
    rating_value,
    normalized_visibility,
    field_visibility,
    item_favorite,
    coalesce(input_imported, false),
    started_value,
    finished_value
  )
  on conflict do nothing
  returning id into new_entry_id;

  insert_created := new_entry_id is not null;

  if new_entry_id is null then
    select e.id
    into new_entry_id
    from public.user_entries e
    where e.profile_id = actor_profile_id
      and e.work_id = target_work_id
      and e.deleted_at is null
    limit 1;
  end if;

  if new_entry_id is null then
    raise exception 'task14 could not create or resolve user entry' using errcode = '23514';
  end if;

  if insert_created then
    activity_id := public.task14_record_entry_activity(
      new_entry_id,
      'entry_created',
      coalesce(input_imported, false),
      jsonb_strip_nulls(jsonb_build_object(
        'source', normalized_origin,
        'status', normalized_status,
        'work_id', target_work_id
      ))
    );
  end if;

  return jsonb_build_object(
    'status', case when insert_created then 'created' else 'already_exists' end,
    'work_id', target_work_id,
    'edition_id', target_edition_id,
    'entry_id', new_entry_id,
    'activity_event_id', activity_id,
    'imported', coalesce(input_imported, false)
  );
end;
$$;

create or replace function public.task14_create_book_entry_from_provider(
  input_provider text,
  input_external_id text,
  input_title text,
  input_status text default 'want_to_read',
  input_year integer default null,
  input_original_title text default null,
  input_language text default null,
  input_description text default null,
  input_cover_url text default null,
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
  external_ids jsonb;
  item_payload jsonb;
begin
  actor_profile_id := public.current_profile_id();
  if actor_profile_id is null then
    raise exception 'authenticated profile required to add provider book' using errcode = '42501';
  end if;

  if provider_id not in ('openlibrary', 'googlebooks') then
    raise exception 'unsupported book provider: %', input_provider using errcode = '23514';
  end if;

  if provider_external_id is null then
    raise exception 'provider external id is required' using errcode = '23514';
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
    'media_type', 'book',
    'canonical_title', input_title,
    'status', input_status,
    'first_release_year', input_year,
    'original_title', input_original_title,
    'original_language', input_language,
    'description', input_description,
    'cover_url', input_cover_url,
    'edition_language', input_language,
    'external_ids', external_ids
  ));

  return public.task14_create_entry_for_profile(actor_profile_id, item_payload, false, 'provider');
end;
$$;

create or replace function public.task14_complete_onboarding(
  input_username text,
  input_display_name text default null,
  input_avatar_url text default null,
  input_favorites_json jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  actor_profile_id uuid;
  normalized_username text := lower(trim(coalesce(input_username, '')));
  normalized_display_name text := nullif(trim(coalesce(input_display_name, '')), '');
  normalized_avatar_url text := nullif(trim(coalesce(input_avatar_url, '')), '');
  favorites jsonb;
  favorite_item jsonb;
  favorite_count integer := 0;
  created_count integer := 0;
  entry_result jsonb;
begin
  actor_profile_id := public.current_profile_id();
  if actor_profile_id is null then
    raise exception 'authenticated profile required to complete onboarding' using errcode = '42501';
  end if;

  if normalized_username !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'username must match ^[a-z0-9_]{3,20}$' using errcode = '23514';
  end if;

  favorites := case
    when jsonb_typeof(input_favorites_json) = 'array' then input_favorites_json
    else '[]'::jsonb
  end;

  if jsonb_array_length(favorites) > 3 then
    raise exception 'onboarding favorites accepts at most 3 items' using errcode = '23514';
  end if;

  update public.profiles
  set
    username = normalized_username,
    display_name = normalized_display_name,
    avatar_url = normalized_avatar_url,
    onboarding_completed = true
  where id = actor_profile_id
    and deleted_at is null;

  for favorite_item in
    select value from jsonb_array_elements(favorites)
  loop
    favorite_count := favorite_count + 1;
    favorite_item := favorite_item || jsonb_build_object(
      'favorite', true,
      'status', coalesce(
        nullif(favorite_item ->> 'status', ''),
        case when lower(coalesce(favorite_item ->> 'media_type', 'book')) = 'movie' then 'watched' else 'finished' end
      )
    );
    entry_result := public.task14_create_entry_for_profile(actor_profile_id, favorite_item, false, 'onboarding');

    if entry_result ->> 'status' = 'created' then
      created_count := created_count + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'status', 'completed',
    'profile_id', actor_profile_id,
    'username', normalized_username,
    'favorite_count', favorite_count,
    'created_count', created_count
  );
end;
$$;

create or replace function public.task14_enqueue_import_job(
  input_source text,
  input_payload_json jsonb,
  input_config_json jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  actor_profile_id uuid;
  normalized_source text := lower(trim(coalesce(input_source, '')));
  normalized_payload jsonb := coalesce(input_payload_json, '{}'::jsonb);
  normalized_config jsonb := coalesce(input_config_json, '{}'::jsonb);
  new_job_id uuid;
begin
  actor_profile_id := public.current_profile_id();
  if actor_profile_id is null then
    raise exception 'authenticated profile required to enqueue import job' using errcode = '42501';
  end if;

  if normalized_source not in ('csv', 'mspf') then
    raise exception 'unsupported task14 import source: %', input_source using errcode = '23514';
  end if;

  if jsonb_typeof(normalized_payload) <> 'object' then
    raise exception 'task14 import payload must be an object' using errcode = '23514';
  end if;

  if jsonb_typeof(normalized_config) <> 'object' then
    raise exception 'task14 import config must be an object' using errcode = '23514';
  end if;

  insert into public.import_jobs (
    profile_id,
    source,
    job_kind,
    config_json,
    payload_json
  )
  values (
    actor_profile_id,
    normalized_source,
    'task14_' || normalized_source || '_import',
    normalized_config,
    normalized_payload || jsonb_build_object('source', normalized_source)
  )
  returning id into new_job_id;

  return jsonb_build_object(
    'status', 'queued',
    'job_id', new_job_id,
    'source', normalized_source
  );
end;
$$;

create or replace function public.task14_execute_import_job(
  input_profile_id uuid,
  input_payload_json jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  normalized_payload jsonb := coalesce(input_payload_json, '{}'::jsonb);
  items jsonb;
  item jsonb;
  item_result jsonb;
  imported_count integer := 0;
  skipped_count integer := 0;
  failed_count integer := 0;
  errors jsonb := '[]'::jsonb;
begin
  if input_profile_id is null then
    raise exception 'task14 import job profile_id is required' using errcode = '23514';
  end if;

  items := case
    when jsonb_typeof(normalized_payload -> 'items') = 'array' then normalized_payload -> 'items'
    else '[]'::jsonb
  end;

  if jsonb_array_length(items) = 0 then
    raise exception 'task14 import payload contains no items' using errcode = '23514';
  end if;

  for item in
    select value from jsonb_array_elements(items)
  loop
    begin
      item_result := public.task14_create_entry_for_profile(
        input_profile_id,
        item,
        true,
        coalesce(normalized_payload ->> 'source', 'import')
      );

      if item_result ->> 'status' = 'created' then
        imported_count := imported_count + 1;
      else
        skipped_count := skipped_count + 1;
      end if;
    exception
      when others then
        failed_count := failed_count + 1;
        errors := errors || jsonb_build_array(jsonb_build_object(
          'title', coalesce(item ->> 'canonical_title', item ->> 'title'),
          'error', sqlerrm
        ));
    end;
  end loop;

  return jsonb_build_object(
    'status', case when failed_count = 0 then 'imported' else 'imported_with_errors' end,
    'total', jsonb_array_length(items),
    'imported', imported_count,
    'skipped', skipped_count,
    'failed', failed_count,
    'errors', errors,
    'processed_at', now()
  );
end;
$$;

create or replace function public.task13_execute_job_payload(
  input_queue_name text,
  input_job_kind text,
  input_payload_json jsonb,
  input_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if input_queue_name = 'import_jobs'
    and input_job_kind in ('task14_mspf_import', 'task14_csv_import')
  then
    return public.task14_execute_import_job(input_profile_id, input_payload_json);
  end if;

  if input_job_kind = 'dummy_success' then
    return jsonb_build_object(
      'queue', input_queue_name,
      'job_kind', input_job_kind,
      'payload', input_payload_json,
      'processed_at', now()
    );
  end if;

  if input_job_kind = 'dummy_failure' then
    raise exception 'forced dummy job failure for %', input_queue_name using errcode = 'XX000';
  end if;

  raise exception 'unsupported job kind % for %', input_job_kind, input_queue_name
    using errcode = '23514';
end;
$$;

create or replace function public.task13_execute_job_payload(
  input_queue_name text,
  input_job_kind text,
  input_payload_json jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return public.task13_execute_job_payload(input_queue_name, input_job_kind, input_payload_json, null);
end;
$$;

create or replace function public.task13_process_job_queue(
  input_queue_name text,
  input_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  safe_queue_name text := lower(trim(coalesce(input_queue_name, '')));
  safe_limit integer := least(greatest(coalesce(input_limit, 100), 1), 5000);
  job_record record;
  processed_count integer := 0;
  done_count integer := 0;
  dead_letter_count integer := 0;
  next_attempts integer;
  job_result jsonb;
  sentry_payload jsonb;
begin
  if safe_queue_name not in ('import_jobs', 'export_jobs', 'cover_cache_jobs') then
    raise exception 'unsupported task13 job queue: %', input_queue_name using errcode = '23514';
  end if;

  if not pg_try_advisory_xact_lock(hashtext('task13_job_queue:' || safe_queue_name)) then
    return jsonb_build_object(
      'queue', safe_queue_name,
      'processed', 0,
      'done', 0,
      'dead_letter', 0,
      'locked', true
    );
  end if;

  for job_record in execute format(
    'select id, profile_id, job_kind, payload_json, attempts, max_attempts
       from public.%I
      where status in (''pending'', ''running'')
        and next_retry_at <= now()
      order by created_at asc, id asc
      limit %s
      for update skip locked',
    safe_queue_name,
    safe_limit
  )
  loop
    processed_count := processed_count + 1;

    begin
      execute format(
        'update public.%I
            set status = ''running'', updated_at = now()
          where id = $1',
        safe_queue_name
      ) using job_record.id;

      job_result := public.task13_execute_job_payload(
        safe_queue_name,
        job_record.job_kind,
        job_record.payload_json,
        job_record.profile_id
      );

      execute format(
        'update public.%I
            set status = ''done'',
                result_json = $2,
                completed_at = now(),
                updated_at = now(),
                last_error = null,
                next_retry_at = now()
          where id = $1',
        safe_queue_name
      ) using job_record.id, job_result;

      done_count := done_count + 1;
    exception
      when others then
        next_attempts := job_record.attempts + 1;

        if next_attempts >= job_record.max_attempts then
          sentry_payload := jsonb_build_object(
            'queue', safe_queue_name,
            'job_id', job_record.id,
            'job_kind', job_record.job_kind,
            'last_error', sqlerrm
          );

          execute format(
            'update public.%I
                set status = ''dead_letter'',
                    attempts = $2,
                    last_error = $3,
                    next_retry_at = now(),
                    dead_lettered_at = now(),
                    sentry_alert_required = true,
                    sentry_alert_payload_json = $4,
                    updated_at = now()
              where id = $1',
            safe_queue_name
          ) using job_record.id, next_attempts, sqlerrm, sentry_payload;

          dead_letter_count := dead_letter_count + 1;
        else
          execute format(
            'update public.%I
                set status = ''pending'',
                    attempts = $2,
                    last_error = $3,
                    next_retry_at = $4,
                    updated_at = now()
              where id = $1',
            safe_queue_name
          ) using
            job_record.id,
            next_attempts,
            sqlerrm,
            now() + make_interval(secs => least(3600, next_attempts * 60));
        end if;
    end;
  end loop;

  return jsonb_build_object(
    'queue', safe_queue_name,
    'processed', processed_count,
    'done', done_count,
    'dead_letter', dead_letter_count,
    'locked', false
  );
end;
$$;

revoke all on function public.task14_set_auth_context_for_profile(uuid) from public;
revoke all on function public.task14_record_entry_activity(uuid, text, boolean, jsonb) from public;
revoke all on function public.task14_entry_item_external_ids(jsonb) from public;
revoke all on function public.task14_create_entry_for_profile(uuid, jsonb, boolean, text) from public;
revoke all on function public.task14_create_book_entry_from_provider(text, text, text, text, integer, text, text, text, text, jsonb) from public;
revoke all on function public.task14_complete_onboarding(text, text, text, jsonb) from public;
revoke all on function public.task14_enqueue_import_job(text, jsonb, jsonb) from public;
revoke all on function public.task14_execute_import_job(uuid, jsonb) from public;
revoke all on function public.task13_execute_job_payload(text, text, jsonb, uuid) from public;

grant execute on function public.task14_create_book_entry_from_provider(text, text, text, text, integer, text, text, text, text, jsonb) to authenticated;
grant execute on function public.task14_complete_onboarding(text, text, text, jsonb) to authenticated;
grant execute on function public.task14_enqueue_import_job(text, jsonb, jsonb) to authenticated;

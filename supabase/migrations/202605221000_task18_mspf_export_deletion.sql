set search_path = public, extensions;

create or replace function public.set_task07_user_entry_fields()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  actor_profile_id uuid;
  maintenance_profile_id uuid;
  target_media_type text;
begin
  maintenance_profile_id := nullif(current_setting('app.task18_hard_delete_profile_id', true), '')::uuid;

  if tg_op = 'UPDATE'
    and current_setting('app.task18_hard_delete_active', true) = 'on'
    and current_setting('request.jwt.claim.role', true) = 'service_role'
    and maintenance_profile_id = old.profile_id
  then
    actor_profile_id := old.profile_id;
  else
    actor_profile_id := public.current_profile_id();
  end if;

  if actor_profile_id is null then
    raise exception 'authenticated profile required to write user entry' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    new.id := coalesce(new.id, public.uuid_v7());
    new.profile_id := actor_profile_id;
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := coalesce(new.updated_at, new.created_at);
    new.created_by := actor_profile_id;
    new.updated_by := actor_profile_id;
    new.row_version := coalesce(new.row_version, 1);
  else
    new.id := old.id;
    new.profile_id := old.profile_id;
    new.work_id := old.work_id;
    new.edition_id := old.edition_id;
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.deleted_at := old.deleted_at;
    new.deleted_by := old.deleted_by;
    new.delete_reason := old.delete_reason;
    new.updated_at := now();
    new.updated_by := actor_profile_id;
    new.row_version := old.row_version + 1;
  end if;

  new.status := lower(trim(coalesce(new.status, '')));
  new.review := nullif(trim(regexp_replace(coalesce(new.review, ''), '\s+', ' ', 'g')), '');
  new.visibility_scope := lower(trim(coalesce(new.visibility_scope, 'private')));
  new.field_visibility_json := coalesce(new.field_visibility_json, '{}'::jsonb);
  new.favorite := coalesce(new.favorite, false);
  new.imported := coalesce(new.imported, false);

  select w.media_type
  into target_media_type
  from public.works w
  join public.editions e on e.work_id = w.id
  where w.id = new.work_id
    and e.id = new.edition_id
    and w.deleted_at is null
    and e.deleted_at is null;

  if target_media_type is null then
    raise exception 'entry work and edition target must exist and match' using errcode = '23503';
  end if;

  if target_media_type = 'book' and new.status not in ('want_to_read', 'reading', 'finished', 'abandoned') then
    raise exception 'book entry status is invalid: %', new.status using errcode = '23514';
  end if;

  if target_media_type = 'movie' and new.status not in ('want_to_watch', 'watching', 'watched', 'abandoned') then
    raise exception 'movie entry status is invalid: %', new.status using errcode = '23514';
  end if;

  return new;
end;
$$;

create table public.account_deletion_requests (
  id uuid primary key default public.uuid_v7(),
  profile_id uuid not null references public.profiles(id) on delete restrict,
  channel text not null,
  status text not null,
  export_job_id uuid,
  requested_at timestamptz not null default now(),
  confirmed_at timestamptz,
  cooling_until timestamptz,
  soft_delete_until timestamptz,
  hard_deleted_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_deletion_requests_channel_check check (
    channel in ('export_then_delete', 'gdpr')
  ),
  constraint account_deletion_requests_status_check check (
    status in ('soft_deleted', 'cooling_off', 'hard_deleted', 'cancelled')
  ),
  constraint account_deletion_requests_metadata_object check (
    jsonb_typeof(metadata_json) = 'object'
  ),
  constraint account_deletion_requests_channel_status_check check (
    (channel = 'export_then_delete' and status in ('soft_deleted', 'hard_deleted', 'cancelled'))
    or (channel = 'gdpr' and status in ('cooling_off', 'hard_deleted', 'cancelled'))
  ),
  constraint account_deletion_requests_export_channel_check check (
    (channel = 'export_then_delete' and export_job_id is not null)
    or (channel = 'gdpr' and export_job_id is null)
  )
);

create index idx_account_deletion_requests_profile_created
  on public.account_deletion_requests(profile_id, created_at desc);
create index idx_account_deletion_requests_status_soft_delete
  on public.account_deletion_requests(status, soft_delete_until)
  where status = 'soft_deleted';
create index idx_account_deletion_requests_status_cooling
  on public.account_deletion_requests(status, cooling_until)
  where status = 'cooling_off';

create or replace function public.task18_iso8601(input_value timestamptz)
returns text
language sql
stable
as $$
  select case
    when input_value is null then null
    else to_char(input_value at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  end;
$$;

create or replace function public.task18_build_mspf_export(input_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  target_profile record;
  exported_at_text text := public.task18_iso8601(clock_timestamp());
  document jsonb;
begin
  select
    p.id,
    p.username,
    p.display_name,
    p.bio,
    p.public_visibility
  into target_profile
  from public.profiles p
  where p.id = input_profile_id
    and p.deleted_at is null;

  if target_profile.id is null then
    raise exception 'active profile is required for MSPF export' using errcode = '42501';
  end if;

  with entry_scope as (
    select e.*
    from public.user_entries e
    where e.profile_id = input_profile_id
      and e.deleted_at is null
  ),
  list_scope as (
    select l.*
    from public.lists l
    where l.profile_id = input_profile_id
      and l.deleted_at is null
  ),
  list_item_scope as (
    select li.*
    from public.list_items li
    where li.profile_id = input_profile_id
      and li.deleted_at is null
  ),
  work_scope as (
    select distinct work_id from entry_scope
    union
    select distinct work_id from list_item_scope
  ),
  series_scope as (
    select distinct s.*
    from public.series s
    join public.work_series ws on ws.series_id = s.id and ws.deleted_at is null
    join work_scope scoped on scoped.work_id = ws.work_id
    where s.deleted_at is null
  ),
  person_scope as (
    select distinct p.*
    from public.persons p
    join public.work_credits wc on wc.person_id = p.id and wc.deleted_at is null
    join work_scope scoped on scoped.work_id = wc.work_id
    where p.deleted_at is null
  )
  select jsonb_strip_nulls(jsonb_build_object(
    'format', 'MSPF',
    'version', '1.0.0',
    'exported_at', exported_at_text,
    'app', jsonb_build_object(
      'app_name', 'book-media-library',
      'app_version', '0.0.0'
    ),
    'profile', jsonb_strip_nulls(jsonb_build_object(
      'id', target_profile.id,
      'username', target_profile.username,
      'display_name', target_profile.display_name,
      'bio', target_profile.bio,
      'profile_visibility', target_profile.public_visibility
    )),
    'works', (
      select coalesce(jsonb_agg(
        jsonb_strip_nulls(jsonb_build_object(
          'id', w.id,
          'media_type', w.media_type,
          'canonical_title', w.canonical_title,
          'original_title', w.original_title,
          'localized_titles_json', w.localized_titles_json,
          'description', w.description,
          'first_release_year', w.first_release_year,
          'original_language', w.original_language,
          'metadata_json', w.metadata_json,
          'external_ids', (
            select coalesce(jsonb_agg(
              jsonb_strip_nulls(jsonb_build_object(
                'source', ei.source,
                'external_id', ei.external_id,
                'source_url', ei.source_url
              ))
              order by ei.source, ei.external_id
            ), '[]'::jsonb)
            from public.external_ids ei
            where ei.target_type = 'work'
              and ei.target_id = w.id
              and ei.deleted_at is null
          )
        ))
        order by w.canonical_title, w.id
      ), '[]'::jsonb)
      from public.works w
      join work_scope scoped on scoped.work_id = w.id
      where w.deleted_at is null
    ),
    'editions', (
      select coalesce(jsonb_agg(
        jsonb_strip_nulls(jsonb_build_object(
          'id', ed.id,
          'work_id', ed.work_id,
          'title', ed.title,
          'subtitle', ed.subtitle,
          'cover_url', ed.cover_url,
          'language', ed.language,
          'edition_type', ed.edition_type,
          'publisher', ed.publisher,
          'page_count', ed.page_count,
          'runtime_minutes', ed.runtime_minutes,
          'release_date', ed.release_date,
          'is_default', ed.is_default,
          'metadata_json', ed.metadata_json
        ))
        order by ed.is_default desc, ed.title, ed.id
      ), '[]'::jsonb)
      from public.editions ed
      join work_scope scoped on scoped.work_id = ed.work_id
      where ed.deleted_at is null
    ),
    'series', (
      select coalesce(jsonb_agg(to_jsonb(s) - 'search_vector' order by s.name, s.id), '[]'::jsonb)
      from series_scope s
    ),
    'work_series', (
      select coalesce(jsonb_agg(to_jsonb(ws) order by ws.series_id, ws.work_id), '[]'::jsonb)
      from public.work_series ws
      join work_scope scoped on scoped.work_id = ws.work_id
      where ws.deleted_at is null
    ),
    'work_relations', (
      select coalesce(jsonb_agg(to_jsonb(wr) order by wr.from_work_id, wr.to_work_id), '[]'::jsonb)
      from public.work_relations wr
      where wr.deleted_at is null
        and (
          wr.from_work_id in (select work_id from work_scope)
          or wr.to_work_id in (select work_id from work_scope)
        )
    ),
    'persons', (
      select coalesce(jsonb_agg(to_jsonb(p) - 'search_vector' order by p.canonical_name, p.id), '[]'::jsonb)
      from person_scope p
    ),
    'work_credits', (
      select coalesce(jsonb_agg(to_jsonb(wc) order by wc.work_id, wc.billing_order nulls last, wc.id), '[]'::jsonb)
      from public.work_credits wc
      join work_scope scoped on scoped.work_id = wc.work_id
      where wc.deleted_at is null
    ),
    'entries', (
      select coalesce(jsonb_agg(
        jsonb_strip_nulls(jsonb_build_object(
          'id', e.id,
          'edition_id', e.edition_id,
          'work_id', e.work_id,
          'status', e.status,
          'rating_x10', e.rating_x10,
          'review', e.review,
          'visibility_scope', e.visibility_scope,
          'field_visibility_json', e.field_visibility_json,
          'favorite', e.favorite,
          'started_at', public.task18_iso8601(e.started_at),
          'finished_at', public.task18_iso8601(e.finished_at),
          'imported', e.imported,
          'created_at', public.task18_iso8601(e.created_at),
          'updated_at', public.task18_iso8601(e.updated_at)
        ))
        order by e.updated_at desc, e.id
      ), '[]'::jsonb)
      from entry_scope e
    ),
    'private_notes', (
      select coalesce(jsonb_agg(
        jsonb_strip_nulls(jsonb_build_object(
          'id', n.id,
          'entry_id', n.entry_id,
          'note', n.note,
          'ai_extracted_tags_json', n.ai_extracted_tags_json,
          'created_at', public.task18_iso8601(n.created_at),
          'updated_at', public.task18_iso8601(n.updated_at)
        ))
        order by n.updated_at desc, n.id
      ), '[]'::jsonb)
      from public.user_private_notes n
      where n.profile_id = input_profile_id
        and n.deleted_at is null
    ),
    'annotations', (
      select coalesce(jsonb_agg(
        jsonb_strip_nulls(jsonb_build_object(
          'id', a.id,
          'entry_id', a.entry_id,
          'kind', a.kind,
          'content', a.content,
          'location_json', a.location_json,
          'visibility_scope', a.visibility_scope,
          'created_at', public.task18_iso8601(a.created_at),
          'updated_at', public.task18_iso8601(a.updated_at)
        ))
        order by a.updated_at desc, a.id
      ), '[]'::jsonb)
      from public.annotations a
      where a.profile_id = input_profile_id
        and a.deleted_at is null
    ),
    'progress_logs', (
      select coalesce(jsonb_agg(
        jsonb_strip_nulls(jsonb_build_object(
          'id', pl.id,
          'entry_id', pl.entry_id,
          'progress_model_id', pl.progress_model_id,
          'event_type', pl.event_type,
          'payload_json', pl.payload_json,
          'reason_code', pl.reason_code,
          'reason_note', pl.reason_note,
          'visibility_scope_snapshot', pl.visibility_scope_snapshot,
          'imported', pl.imported,
          'occurred_at', public.task18_iso8601(pl.occurred_at),
          'created_at', public.task18_iso8601(pl.created_at)
        ))
        order by pl.occurred_at desc, pl.id
      ), '[]'::jsonb)
      from public.progress_logs pl
      where pl.profile_id = input_profile_id
    ),
    'activity_events', (
      select coalesce(jsonb_agg(event_payload order by occurred_at desc, id), '[]'::jsonb)
      from (
        select
          ae.id,
          ae.occurred_at,
          jsonb_strip_nulls(jsonb_build_object(
            'id', ae.id,
            'stream', 'public',
            'event_type', ae.event_type,
            'subject_type', ae.subject_type,
            'subject_id', ae.subject_id,
            'entry_id', ae.entry_id,
            'work_id', ae.work_id,
            'visibility_scope_snapshot', ae.visibility_scope_snapshot,
            'payload_json', ae.payload_json,
            'imported', ae.imported,
            'occurred_at', public.task18_iso8601(ae.occurred_at),
            'created_at', public.task18_iso8601(ae.created_at)
          )) as event_payload
        from public.activity_events ae
        where ae.profile_id = input_profile_id
        union all
        select
          pal.id,
          pal.occurred_at,
          jsonb_strip_nulls(jsonb_build_object(
            'id', pal.id,
            'stream', 'private',
            'event_type', pal.event_type,
            'subject_type', pal.subject_type,
            'subject_id', pal.subject_id,
            'entry_id', pal.entry_id,
            'work_id', pal.work_id,
            'visibility_scope_snapshot', pal.visibility_scope_snapshot,
            'payload_json', pal.payload_json,
            'imported', pal.imported,
            'occurred_at', public.task18_iso8601(pal.occurred_at),
            'created_at', public.task18_iso8601(pal.created_at)
          )) as event_payload
        from public.private_activity_log pal
        where pal.profile_id = input_profile_id
      ) events
    ),
    'tags', (
      select coalesce(jsonb_agg(
        jsonb_strip_nulls(jsonb_build_object(
          'id', t.id,
          'name', t.name,
          'color', t.color,
          'source', t.source,
          'canonical_tag_id', t.canonical_tag_id,
          'created_at', public.task18_iso8601(t.created_at),
          'updated_at', public.task18_iso8601(t.updated_at)
        ))
        order by lower(t.name), t.id
      ), '[]'::jsonb)
      from public.tags t
      where t.profile_id = input_profile_id
        and t.deleted_at is null
    ),
    'entry_tags', (
      select coalesce(jsonb_agg(
        jsonb_strip_nulls(jsonb_build_object(
          'entry_id', et.entry_id,
          'tag_id', et.tag_id,
          'created_at', public.task18_iso8601(et.created_at)
        ))
        order by et.entry_id, et.tag_id
      ), '[]'::jsonb)
      from public.entry_tags et
      where et.profile_id = input_profile_id
        and et.deleted_at is null
    ),
    'lists', (
      select coalesce(jsonb_agg(
        jsonb_strip_nulls(jsonb_build_object(
          'id', l.id,
          'title', l.title,
          'description', l.description,
          'visibility_scope', l.visibility_scope,
          'ordered', l.ordered,
          'cover_strategy', l.cover_strategy,
          'created_at', public.task18_iso8601(l.created_at),
          'updated_at', public.task18_iso8601(l.updated_at)
        ))
        order by l.updated_at desc, l.id
      ), '[]'::jsonb)
      from list_scope l
    ),
    'list_items', (
      select coalesce(jsonb_agg(
        jsonb_strip_nulls(jsonb_build_object(
          'id', li.id,
          'list_id', li.list_id,
          'entry_id', li.entry_id,
          'work_id', li.work_id,
          'position', li.position,
          'note', li.note,
          'created_at', public.task18_iso8601(li.created_at),
          'updated_at', public.task18_iso8601(li.updated_at)
        ))
        order by li.list_id, li.position, li.id
      ), '[]'::jsonb)
      from list_item_scope li
    ),
    'metadata_json', jsonb_build_object(
      'task', 'Task18',
      'export_scope', 'owner_only',
      'generated_by', 'task18_build_mspf_export'
    )
  ))
  into document;

  return document;
end;
$$;

create or replace function public.task18_execute_mspf_export(input_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  document jsonb;
  generated_at timestamptz := clock_timestamp();
begin
  document := public.task18_build_mspf_export(input_profile_id);

  update public.profiles
  set exported_at = generated_at
  where id = input_profile_id
    and deleted_at is null;

  return jsonb_build_object(
    'status', 'exported',
    'format', 'MSPF',
    'version', '1.0.0',
    'generated_at', public.task18_iso8601(generated_at),
    'mspf', document
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

  if input_queue_name = 'export_jobs'
    and input_job_kind = 'task18_mspf_export'
  then
    return public.task18_execute_mspf_export(input_profile_id);
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

create or replace function public.task18_enqueue_mspf_export()
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  actor_profile_id uuid;
  new_job_id uuid;
begin
  actor_profile_id := public.current_profile_id();
  if actor_profile_id is null then
    raise exception 'authenticated profile required to enqueue MSPF export' using errcode = '42501';
  end if;

  insert into public.export_jobs (
    profile_id,
    format,
    job_kind,
    config_json,
    payload_json
  )
  values (
    actor_profile_id,
    'mspf',
    'task18_mspf_export',
    '{"version":"1.0.0"}'::jsonb,
    jsonb_build_object('profile_id', actor_profile_id)
  )
  returning id into new_job_id;

  return jsonb_build_object(
    'status', 'queued',
    'job_id', new_job_id,
    'format', 'mspf'
  );
end;
$$;

create or replace function public.task18_process_own_export_job(input_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  actor_profile_id uuid;
  job_record record;
  job_result jsonb;
begin
  actor_profile_id := public.current_profile_id();
  if actor_profile_id is null then
    raise exception 'authenticated profile required to process MSPF export' using errcode = '42501';
  end if;

  select
    ej.id,
    ej.profile_id,
    ej.job_kind,
    ej.payload_json,
    ej.status,
    ej.result_json
  into job_record
  from public.export_jobs ej
  where ej.id = input_job_id
    and ej.profile_id = actor_profile_id
    and ej.job_kind = 'task18_mspf_export'
  for update;

  if job_record.id is null then
    raise exception 'MSPF export job does not belong to the current profile' using errcode = '42501';
  end if;

  if job_record.status = 'done' then
    return jsonb_build_object(
      'status', 'exported',
      'job_id', job_record.id,
      'mspf', job_record.result_json -> 'mspf',
      'generated_at', job_record.result_json ->> 'generated_at'
    );
  end if;

  if job_record.status = 'dead_letter' then
    raise exception 'MSPF export job is dead-lettered' using errcode = 'XX000';
  end if;

  update public.export_jobs
  set status = 'running', updated_at = now()
  where id = job_record.id;

  job_result := public.task13_execute_job_payload(
    'export_jobs',
    job_record.job_kind,
    job_record.payload_json,
    actor_profile_id
  );

  update public.export_jobs
  set
    status = 'done',
    result_json = job_result,
    completed_at = now(),
    updated_at = now(),
    last_error = null,
    next_retry_at = now()
  where id = job_record.id;

  return jsonb_build_object(
    'status', 'exported',
    'job_id', job_record.id,
    'mspf', job_result -> 'mspf',
    'generated_at', job_result ->> 'generated_at'
  );
end;
$$;

create or replace function public.task18_request_account_deletion(
  input_channel text,
  input_confirmation text,
  input_export_job_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  actor_profile_id uuid;
  normalized_channel text := lower(trim(coalesce(input_channel, '')));
  normalized_confirmation text := trim(coalesce(input_confirmation, ''));
  export_job_record record;
  new_request_id uuid;
  soft_delete_until_value timestamptz;
  cooling_until_value timestamptz;
begin
  actor_profile_id := public.current_profile_id();
  if actor_profile_id is null then
    raise exception 'authenticated profile required to request account deletion' using errcode = '42501';
  end if;

  if normalized_confirmation <> 'DELETE' then
    raise exception 'account deletion confirmation must be DELETE' using errcode = '23514';
  end if;

  if normalized_channel not in ('export_then_delete', 'gdpr') then
    raise exception 'unsupported account deletion channel: %', input_channel using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.account_deletion_requests adr
    where adr.profile_id = actor_profile_id
      and adr.status in ('soft_deleted', 'cooling_off')
  ) then
    raise exception 'an active account deletion request already exists' using errcode = '23505';
  end if;

  if normalized_channel = 'export_then_delete' then
    if input_export_job_id is null then
      raise exception 'export_then_delete requires a completed MSPF export job' using errcode = '23514';
    end if;

    select ej.id, ej.status, ej.job_kind, ej.result_json
    into export_job_record
    from public.export_jobs ej
    where ej.id = input_export_job_id
      and ej.profile_id = actor_profile_id
      and ej.job_kind = 'task18_mspf_export';

    if export_job_record.id is null
      or export_job_record.status <> 'done'
      or export_job_record.result_json ->> 'status' <> 'exported'
    then
      raise exception 'export_then_delete requires a completed MSPF export job' using errcode = '23514';
    end if;

    soft_delete_until_value := now() + interval '30 days';

    insert into public.account_deletion_requests (
      profile_id,
      channel,
      status,
      export_job_id,
      confirmed_at,
      soft_delete_until,
      metadata_json
    )
    values (
      actor_profile_id,
      'export_then_delete',
      'soft_deleted',
      export_job_record.id,
      now(),
      soft_delete_until_value,
      jsonb_build_object('export_job_id', export_job_record.id)
    )
    returning id into new_request_id;

    update public.profiles
    set
      deleted_at = now(),
      deleted_by = actor_profile_id,
      public_visibility = 'private',
      delete_reason = 'task18_export_then_delete_soft_deleted'
    where id = actor_profile_id
      and deleted_at is null;

    return jsonb_build_object(
      'status', 'soft_deleted',
      'request_id', new_request_id,
      'channel', 'export_then_delete',
      'soft_delete_until', public.task18_iso8601(soft_delete_until_value)
    );
  end if;

  if input_export_job_id is not null then
    raise exception 'gdpr deletion channel must not include an export job' using errcode = '23514';
  end if;

  cooling_until_value := now() + interval '24 hours';

  insert into public.account_deletion_requests (
    profile_id,
    channel,
    status,
    confirmed_at,
    cooling_until,
    metadata_json
  )
  values (
    actor_profile_id,
    'gdpr',
    'cooling_off',
    now(),
    cooling_until_value,
    jsonb_build_object('export_waived', true)
  )
  returning id into new_request_id;

  return jsonb_build_object(
    'status', 'cooling_off',
    'request_id', new_request_id,
    'channel', 'gdpr',
    'cooling_until', public.task18_iso8601(cooling_until_value)
  );
end;
$$;

create or replace function public.task18_hard_delete_profile(
  input_profile_id uuid,
  input_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  deleted_counts jsonb := '{}'::jsonb;
  affected_rows integer;
begin
  if input_profile_id is null then
    raise exception 'profile_id is required for hard deletion' using errcode = '23514';
  end if;

  with deleted as (
    delete from public.notifications n
    where n.recipient_profile_id = input_profile_id
       or n.actor_profile_id = input_profile_id
    returning 1
  )
  select count(*) into affected_rows from deleted;
  deleted_counts := deleted_counts || jsonb_build_object('notifications', affected_rows);

  with deleted as (
    delete from public.event_outbox eo
    where eo.profile_id = input_profile_id
    returning 1
  )
  select count(*) into affected_rows from deleted;
  deleted_counts := deleted_counts || jsonb_build_object('event_outbox', affected_rows);

  with deleted as (
    delete from public.events_visibility_sync_jobs evsj
    where evsj.profile_id = input_profile_id
    returning 1
  )
  select count(*) into affected_rows from deleted;
  deleted_counts := deleted_counts || jsonb_build_object('events_visibility_sync_jobs', affected_rows);

  with deleted as (
    delete from public.activity_events ae
    where ae.profile_id = input_profile_id
    returning 1
  )
  select count(*) into affected_rows from deleted;
  deleted_counts := deleted_counts || jsonb_build_object('activity_events', affected_rows);

  with deleted as (
    delete from public.private_activity_log pal
    where pal.profile_id = input_profile_id
    returning 1
  )
  select count(*) into affected_rows from deleted;
  deleted_counts := deleted_counts || jsonb_build_object('private_activity_log', affected_rows);

  with deleted as (
    delete from public.progress_snapshots ps
    where ps.profile_id = input_profile_id
    returning 1
  )
  select count(*) into affected_rows from deleted;
  deleted_counts := deleted_counts || jsonb_build_object('progress_snapshots', affected_rows);

  with deleted as (
    delete from public.progress_logs pl
    where pl.profile_id = input_profile_id
    returning 1
  )
  select count(*) into affected_rows from deleted;
  deleted_counts := deleted_counts || jsonb_build_object('progress_logs', affected_rows);

  with deleted as (
    delete from public.annotation_tags atg
    where atg.profile_id = input_profile_id
    returning 1
  )
  select count(*) into affected_rows from deleted;
  deleted_counts := deleted_counts || jsonb_build_object('annotation_tags', affected_rows);

  with deleted as (
    delete from public.entry_tags et
    where et.profile_id = input_profile_id
    returning 1
  )
  select count(*) into affected_rows from deleted;
  deleted_counts := deleted_counts || jsonb_build_object('entry_tags', affected_rows);

  with deleted as (
    delete from public.user_private_notes n
    where n.profile_id = input_profile_id
    returning 1
  )
  select count(*) into affected_rows from deleted;
  deleted_counts := deleted_counts || jsonb_build_object('private_notes', affected_rows);

  with deleted as (
    delete from public.annotations a
    where a.profile_id = input_profile_id
    returning 1
  )
  select count(*) into affected_rows from deleted;
  deleted_counts := deleted_counts || jsonb_build_object('annotations', affected_rows);

  with deleted as (
    delete from public.list_items li
    where li.profile_id = input_profile_id
    returning 1
  )
  select count(*) into affected_rows from deleted;
  deleted_counts := deleted_counts || jsonb_build_object('list_items', affected_rows);

  with deleted as (
    delete from public.lists l
    where l.profile_id = input_profile_id
    returning 1
  )
  select count(*) into affected_rows from deleted;
  deleted_counts := deleted_counts || jsonb_build_object('lists', affected_rows);

  update public.tags t
  set canonical_tag_id = null
  where t.profile_id = input_profile_id
    and t.canonical_tag_id is not null;

  with deleted as (
    delete from public.tags t
    where t.profile_id = input_profile_id
    returning 1
  )
  select count(*) into affected_rows from deleted;
  deleted_counts := deleted_counts || jsonb_build_object('tags', affected_rows);

  with deleted as (
    delete from public.import_jobs ij
    where ij.profile_id = input_profile_id
    returning 1
  )
  select count(*) into affected_rows from deleted;
  deleted_counts := deleted_counts || jsonb_build_object('import_jobs', affected_rows);

  with deleted as (
    delete from public.export_jobs ej
    where ej.profile_id = input_profile_id
    returning 1
  )
  select count(*) into affected_rows from deleted;
  deleted_counts := deleted_counts || jsonb_build_object('export_jobs', affected_rows);

  with deleted as (
    delete from public.cover_cache_jobs ccj
    where ccj.profile_id = input_profile_id
    returning 1
  )
  select count(*) into affected_rows from deleted;
  deleted_counts := deleted_counts || jsonb_build_object('cover_cache_jobs', affected_rows);

  with deleted as (
    delete from public.auth_identities ai
    where ai.profile_id = input_profile_id
    returning 1
  )
  select count(*) into affected_rows from deleted;
  deleted_counts := deleted_counts || jsonb_build_object('auth_identities', affected_rows);

  perform set_config('app.task18_hard_delete_active', 'on', true);
  perform set_config('app.task18_hard_delete_profile_id', input_profile_id::text, true);

  update public.user_entries e
  set
    rating_x10 = case
      when e.field_visibility_json ->> 'rating_x10' = 'public'
        or e.field_visibility_json ->> 'rating' = 'public'
      then e.rating_x10
      else null
    end,
    review = case
      when e.field_visibility_json ->> 'review' = 'public' then e.review
      else null
    end,
    favorite = case
      when e.field_visibility_json ->> 'favorite' = 'public' then e.favorite
      else false
    end,
    started_at = case
      when e.field_visibility_json ->> 'started_at' = 'public' then e.started_at
      else null
    end,
    finished_at = case
      when e.field_visibility_json ->> 'finished_at' = 'public' then e.finished_at
      else null
    end,
    field_visibility_json = coalesce(e.field_visibility_json, '{}'::jsonb)
  where e.profile_id = input_profile_id
    and e.deleted_at is null
    and e.visibility_scope = 'public';

  get diagnostics affected_rows = row_count;
  deleted_counts := deleted_counts || jsonb_build_object('public_entries_anonymized', affected_rows);

  with deleted as (
    delete from public.user_entries e
    where e.profile_id = input_profile_id
      and (e.deleted_at is not null or e.visibility_scope <> 'public')
    returning 1
  )
  select count(*) into affected_rows from deleted;
  deleted_counts := deleted_counts || jsonb_build_object('private_entries', affected_rows);

  update public.profiles p
  set
    display_name = null,
    avatar_url = null,
    bio = null,
    public_top3 = null,
    public_visibility = 'private',
    onboarding_completed = false,
    deleted_at = coalesce(p.deleted_at, now()),
    deleted_by = coalesce(p.deleted_by, input_profile_id),
    delete_reason = 'task18_hard_deleted_anonymized'
  where p.id = input_profile_id;

  get diagnostics affected_rows = row_count;
  deleted_counts := deleted_counts || jsonb_build_object('profiles_anonymized', affected_rows);

  refresh materialized view public.public_activity_feed_v;

  return jsonb_build_object(
    'status', 'hard_deleted',
    'profile_id', input_profile_id,
    'request_id', input_request_id,
    'counts', deleted_counts
  );
end;
$$;

create or replace function public.task18_process_due_account_deletions(input_limit integer default 100)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  safe_limit integer := least(greatest(coalesce(input_limit, 100), 1), 5000);
  request_record record;
  processed_count integer := 0;
  hard_deleted_count integer := 0;
  hard_delete_result jsonb;
begin
  if not pg_try_advisory_xact_lock(hashtext('task18_account_deletions')) then
    return jsonb_build_object(
      'processed', 0,
      'hard_deleted', 0,
      'locked', true
    );
  end if;

  for request_record in
    select *
    from public.account_deletion_requests adr
    where (
        adr.status = 'soft_deleted'
        and adr.soft_delete_until <= now()
      )
      or (
        adr.status = 'cooling_off'
        and adr.cooling_until <= now()
      )
    order by adr.created_at asc, adr.id asc
    limit safe_limit
    for update skip locked
  loop
    processed_count := processed_count + 1;

    if request_record.status = 'cooling_off' then
      update public.profiles p
      set
        deleted_at = coalesce(p.deleted_at, now()),
        deleted_by = coalesce(p.deleted_by, request_record.profile_id),
        public_visibility = 'private',
        delete_reason = 'task18_gdpr_cooling_elapsed'
      where p.id = request_record.profile_id;
    end if;

    perform set_config('request.jwt.claim.role', 'service_role', true);

    hard_delete_result := public.task18_hard_delete_profile(
      request_record.profile_id,
      request_record.id
    );

    update public.account_deletion_requests adr
    set
      status = 'hard_deleted',
      hard_deleted_at = now(),
      updated_at = now(),
      metadata_json = adr.metadata_json || jsonb_build_object(
        'hard_delete_result', hard_delete_result
      )
    where adr.id = request_record.id;

    hard_deleted_count := hard_deleted_count + 1;
  end loop;

  return jsonb_build_object(
    'processed', processed_count,
    'hard_deleted', hard_deleted_count,
    'locked', false
  );
end;
$$;

alter table public.account_deletion_requests enable row level security;
alter table public.account_deletion_requests force row level security;

create policy account_deletion_requests_owner_select
on public.account_deletion_requests
for select
to authenticated
using (profile_id = (select public.current_profile_id()));

revoke all on public.account_deletion_requests from anon, authenticated;
grant select on public.account_deletion_requests to authenticated;

revoke all on function public.task18_iso8601(timestamptz) from public;
revoke all on function public.task18_build_mspf_export(uuid) from public;
revoke all on function public.task18_execute_mspf_export(uuid) from public;
revoke all on function public.task18_enqueue_mspf_export() from public;
revoke all on function public.task18_process_own_export_job(uuid) from public;
revoke all on function public.task18_request_account_deletion(text, text, uuid) from public;
revoke all on function public.task18_hard_delete_profile(uuid, uuid) from public;
revoke all on function public.task18_process_due_account_deletions(integer) from public;
revoke all on function public.task13_execute_job_payload(text, text, jsonb, uuid) from public;
revoke all on function public.task13_execute_job_payload(text, text, jsonb) from public;

grant execute on function public.task18_enqueue_mspf_export() to authenticated;
grant execute on function public.task18_process_own_export_job(uuid) to authenticated;
grant execute on function public.task18_request_account_deletion(text, text, uuid) to authenticated;
grant execute on function public.task18_process_due_account_deletions(integer) to service_role;

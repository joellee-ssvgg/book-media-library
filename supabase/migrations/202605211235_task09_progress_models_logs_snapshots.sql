set search_path = public, extensions;

create table public.progress_models (
  id uuid primary key default public.uuid_v7(),
  media_type text not null,
  model_key text not null,
  supported_edition_types text[] not null,
  schema_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  row_version integer not null default 1,
  constraint progress_models_media_type_check check (media_type in ('book', 'movie')),
  constraint progress_models_model_key_not_blank check (length(trim(model_key)) > 0),
  constraint progress_models_supported_edition_types_not_empty check (cardinality(supported_edition_types) > 0),
  constraint progress_models_schema_object check (jsonb_typeof(schema_json) = 'object'),
  constraint progress_models_row_version_positive check (row_version > 0),
  unique (model_key)
);

insert into public.progress_models (
  id,
  media_type,
  model_key,
  supported_edition_types,
  schema_json
) values
(
  '00000000-0000-0000-0000-000000090001',
  'book',
  'book_page_progress',
  array['default', 'paperback', 'hardcover', 'ebook'],
  '{
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
        "required": ["active_minutes"],
        "properties": {
          "active_minutes": "positive_integer",
          "pages_read": "positive_integer_optional",
          "current_page": "positive_integer_optional",
          "total_pages": "positive_integer_optional"
        }
      },
      "completed": {},
      "abandoned": {}
    }
  }'::jsonb
),
(
  '00000000-0000-0000-0000-000000090002',
  'movie',
  'watch_log',
  array['default', 'theatrical', 'tv_cut', 'director_cut', 'streaming'],
  '{
    "type": "object",
    "events": {
      "completed": {
        "properties": {
          "watched_at": "iso8601_optional",
          "runtime_minutes": "positive_integer_optional"
        }
      },
      "session_logged": {
        "required": ["active_minutes"],
        "properties": {
          "active_minutes": "positive_integer"
        }
      },
      "progress_set": {
        "properties": {
          "timestamp_seconds": "nonnegative_number_optional"
        }
      },
      "abandoned": {}
    }
  }'::jsonb
);

create table public.progress_logs (
  id uuid not null default public.uuid_v7(),
  profile_id uuid not null references public.profiles(id) on delete restrict,
  entry_id uuid not null references public.user_entries(id) on delete restrict,
  progress_model_id uuid not null references public.progress_models(id) on delete restrict,
  event_type text not null,
  payload_json jsonb not null default '{}'::jsonb,
  reason_code text,
  reason_note text,
  visibility_scope_snapshot text not null,
  imported boolean not null default false,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id),
  row_version integer not null default 1,
  constraint progress_logs_pk primary key (id, occurred_at),
  constraint progress_logs_event_type_check check (
    event_type in ('progress_set', 'session_logged', 'completed', 'abandoned')
  ),
  constraint progress_logs_payload_object check (jsonb_typeof(payload_json) = 'object'),
  constraint progress_logs_reason_code_not_blank check (
    reason_code is null or length(trim(reason_code)) > 0
  ),
  constraint progress_logs_reason_note_length check (
    reason_note is null or char_length(reason_note) <= 500
  ),
  constraint progress_logs_visibility_scope_check check (
    visibility_scope_snapshot in ('private', 'unlisted', 'followers', 'public')
  ),
  constraint progress_logs_row_version_positive check (row_version > 0)
) partition by range (occurred_at);

create table public.progress_logs_2026_05
  partition of public.progress_logs
  for values from ('2026-05-01 00:00:00+00') to ('2026-06-01 00:00:00+00');

create table public.progress_logs_2026_06
  partition of public.progress_logs
  for values from ('2026-06-01 00:00:00+00') to ('2026-07-01 00:00:00+00');

create table public.progress_logs_default
  partition of public.progress_logs default;

create index idx_progress_logs_entry_time
  on public.progress_logs(entry_id, occurred_at desc);
create index idx_progress_logs_profile_time
  on public.progress_logs(profile_id, occurred_at desc);
create index idx_progress_logs_model_time
  on public.progress_logs(progress_model_id, occurred_at desc);

create table public.progress_snapshots (
  profile_id uuid not null references public.profiles(id) on delete restrict,
  entry_id uuid not null references public.user_entries(id) on delete restrict,
  progress_model_id uuid not null references public.progress_models(id) on delete restrict,
  snapshot_json jsonb not null default '{}'::jsonb,
  last_progress_log_id uuid,
  visibility_scope_snapshot text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  row_version integer not null default 1,
  primary key (entry_id, progress_model_id),
  constraint progress_snapshots_snapshot_object check (jsonb_typeof(snapshot_json) = 'object'),
  constraint progress_snapshots_visibility_scope_check check (
    visibility_scope_snapshot in ('private', 'unlisted', 'followers', 'public')
  ),
  constraint progress_snapshots_row_version_positive check (row_version > 0)
);

create index idx_progress_snapshots_profile
  on public.progress_snapshots(profile_id);
create index idx_progress_snapshots_model
  on public.progress_snapshots(progress_model_id);

create or replace function public.task09_json_positive_integer(input_json jsonb, input_key text)
returns boolean
language sql
immutable
as $$
  select
    coalesce(input_json ->> input_key, '') ~ '^[1-9][0-9]*$';
$$;

create or replace function public.task09_json_nonnegative_integer(input_json jsonb, input_key text)
returns boolean
language sql
immutable
as $$
  select
    coalesce(input_json ->> input_key, '') ~ '^(0|[1-9][0-9]*)$';
$$;

create or replace function public.task09_json_nonnegative_number(input_json jsonb, input_key text)
returns boolean
language sql
immutable
as $$
  select
    coalesce(input_json ->> input_key, '') ~ '^(0|[1-9][0-9]*)(\.[0-9]+)?$';
$$;

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
      if not public.task09_json_positive_integer(input_payload, 'active_minutes') then
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

create or replace function public.task09_build_progress_snapshot(
  input_entry_id uuid,
  input_progress_model_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  log_row public.progress_logs%rowtype;
  model_key text;
  snapshot_payload jsonb := '{}'::jsonb;
  sessions_count integer := 0;
  total_active_minutes integer := 0;
  pages_read_total integer := 0;
begin
  select pm.model_key
  into model_key
  from public.progress_models pm
  where pm.id = input_progress_model_id;

  if model_key is null then
    raise exception 'progress model does not exist' using errcode = '23503';
  end if;

  snapshot_payload := jsonb_build_object(
    'model_key', model_key,
    'sessions_count', 0,
    'total_active_minutes', 0
  );

  for log_row in
    select *
    from public.progress_logs pl
    where pl.entry_id = input_entry_id
      and pl.progress_model_id = input_progress_model_id
    order by pl.occurred_at asc, pl.id asc
  loop
    snapshot_payload := snapshot_payload || jsonb_build_object(
      'last_event_type', log_row.event_type,
      'last_occurred_at', log_row.occurred_at,
      'latest_payload', log_row.payload_json
    );

    if log_row.event_type = 'session_logged' then
      sessions_count := sessions_count + 1;
      if log_row.payload_json ? 'active_minutes' then
        total_active_minutes := total_active_minutes + (log_row.payload_json ->> 'active_minutes')::integer;
      end if;
      if log_row.payload_json ? 'pages_read' then
        pages_read_total := pages_read_total + (log_row.payload_json ->> 'pages_read')::integer;
      end if;
    end if;

    if model_key = 'book_page_progress' then
      if log_row.payload_json ? 'current_page' then
        snapshot_payload := snapshot_payload || jsonb_build_object(
          'unit', 'page',
          'current_page', (log_row.payload_json ->> 'current_page')::integer
        );
      end if;

      if log_row.payload_json ? 'total_pages' then
        snapshot_payload := snapshot_payload || jsonb_build_object(
          'total_pages', (log_row.payload_json ->> 'total_pages')::integer
        );
      end if;

      if log_row.event_type = 'completed' then
        snapshot_payload := snapshot_payload || jsonb_build_object('completed_at', log_row.occurred_at);
      end if;

      if log_row.event_type = 'abandoned' then
        snapshot_payload := snapshot_payload || jsonb_build_object('abandoned_at', log_row.occurred_at);
      end if;
    end if;

    if model_key = 'watch_log' then
      if log_row.payload_json ? 'timestamp_seconds' then
        snapshot_payload := snapshot_payload || jsonb_build_object(
          'unit', 'second',
          'timestamp_seconds', (log_row.payload_json ->> 'timestamp_seconds')::numeric
        );
      end if;

      if log_row.event_type = 'completed' then
        snapshot_payload := snapshot_payload || jsonb_build_object(
          'completed_at', log_row.occurred_at,
          'watched', true
        );
      end if;

      if log_row.event_type = 'abandoned' then
        snapshot_payload := snapshot_payload || jsonb_build_object('abandoned_at', log_row.occurred_at);
      end if;
    end if;
  end loop;

  if not exists (
    select 1
    from public.progress_logs pl
    where pl.entry_id = input_entry_id
      and pl.progress_model_id = input_progress_model_id
  ) then
    return null;
  end if;

  return snapshot_payload || jsonb_build_object(
    'sessions_count', sessions_count,
    'total_active_minutes', total_active_minutes,
    'pages_read_total', pages_read_total
  );
end;
$$;

create or replace function public.replay_progress_snapshot(
  input_entry_id uuid,
  input_progress_model_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  actor_profile_id uuid;
  normalized_model_key text;
  target_entry public.user_entries%rowtype;
  target_model public.progress_models%rowtype;
  rebuilt_snapshot jsonb;
  last_log_id uuid;
  snapshot_visibility text;
begin
  actor_profile_id := public.current_profile_id();
  if actor_profile_id is null then
    raise exception 'authenticated profile required to replay progress snapshot' using errcode = '42501';
  end if;

  normalized_model_key := lower(trim(coalesce(input_progress_model_key, '')));

  select *
  into target_entry
  from public.user_entries e
  where e.id = input_entry_id
    and e.profile_id = actor_profile_id
    and e.deleted_at is null;

  if target_entry.id is null then
    raise exception 'progress entry must belong to the current profile' using errcode = '42501';
  end if;

  select *
  into target_model
  from public.progress_models pm
  where pm.model_key = normalized_model_key;

  if target_model.id is null then
    raise exception 'progress model does not exist' using errcode = '23503';
  end if;

  rebuilt_snapshot := public.task09_build_progress_snapshot(target_entry.id, target_model.id);

  if rebuilt_snapshot is null then
    delete from public.progress_snapshots ps
    where ps.entry_id = target_entry.id
      and ps.progress_model_id = target_model.id;

    return jsonb_build_object(
      'entry_id', target_entry.id,
      'progress_model_id', target_model.id,
      'snapshot_json', null
    );
  end if;

  select pl.id, pl.visibility_scope_snapshot
  into last_log_id, snapshot_visibility
  from public.progress_logs pl
  where pl.entry_id = target_entry.id
    and pl.progress_model_id = target_model.id
  order by pl.occurred_at desc, pl.id desc
  limit 1;

  insert into public.progress_snapshots (
    profile_id,
    entry_id,
    progress_model_id,
    snapshot_json,
    last_progress_log_id,
    visibility_scope_snapshot
  )
  values (
    actor_profile_id,
    target_entry.id,
    target_model.id,
    rebuilt_snapshot,
    last_log_id,
    snapshot_visibility
  )
  on conflict (entry_id, progress_model_id)
  do update set
    snapshot_json = excluded.snapshot_json,
    last_progress_log_id = excluded.last_progress_log_id,
    visibility_scope_snapshot = excluded.visibility_scope_snapshot,
    updated_at = now(),
    row_version = public.progress_snapshots.row_version + 1;

  return jsonb_build_object(
    'entry_id', target_entry.id,
    'progress_model_id', target_model.id,
    'snapshot_json', rebuilt_snapshot
  );
end;
$$;

create or replace function public.record_progress(
  input_entry_id uuid,
  input_progress_model_key text,
  input_event_type text default 'progress_set',
  input_payload_json jsonb default '{}'::jsonb,
  input_occurred_at timestamptz default now(),
  input_reason_code text default null,
  input_reason_note text default null,
  input_imported boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  actor_profile_id uuid;
  normalized_model_key text;
  normalized_event_type text;
  target_media_type text;
  target_edition_type text;
  target_entry public.user_entries%rowtype;
  target_model public.progress_models%rowtype;
  new_log_id uuid;
  new_occurred_at timestamptz;
  replay_payload jsonb;
begin
  actor_profile_id := public.current_profile_id();
  if actor_profile_id is null then
    raise exception 'authenticated profile required to record progress' using errcode = '42501';
  end if;

  normalized_model_key := lower(trim(coalesce(input_progress_model_key, '')));
  normalized_event_type := lower(trim(coalesce(input_event_type, 'progress_set')));
  new_occurred_at := coalesce(input_occurred_at, now());

  select e.*
  into target_entry
  from public.user_entries e
  where e.id = input_entry_id
    and e.profile_id = actor_profile_id
    and e.deleted_at is null;

  if target_entry.id is null then
    raise exception 'progress entry must belong to the current profile' using errcode = '42501';
  end if;

  select w.media_type, ed.edition_type
  into target_media_type, target_edition_type
  from public.works w
  join public.editions ed on ed.id = target_entry.edition_id and ed.work_id = w.id
  where w.id = target_entry.work_id
    and w.deleted_at is null
    and ed.deleted_at is null;

  if target_media_type is null then
    raise exception 'progress entry work and edition must exist' using errcode = '23503';
  end if;

  select *
  into target_model
  from public.progress_models pm
  where pm.model_key = normalized_model_key;

  if target_model.id is null then
    raise exception 'progress model does not exist' using errcode = '23503';
  end if;

  if target_model.media_type <> target_media_type
    or not (coalesce(target_edition_type, 'default') = any(target_model.supported_edition_types))
  then
    raise exception 'progress model is not compatible with entry edition' using errcode = '23514';
  end if;

  if not public.task09_validate_progress_payload(
    target_model.model_key,
    normalized_event_type,
    coalesce(input_payload_json, '{}'::jsonb)
  ) then
    raise exception 'progress payload does not match progress model schema' using errcode = '23514';
  end if;

  insert into public.progress_logs (
    profile_id,
    entry_id,
    progress_model_id,
    event_type,
    payload_json,
    reason_code,
    reason_note,
    visibility_scope_snapshot,
    imported,
    occurred_at,
    created_by
  )
  values (
    actor_profile_id,
    target_entry.id,
    target_model.id,
    normalized_event_type,
    coalesce(input_payload_json, '{}'::jsonb),
    nullif(trim(coalesce(input_reason_code, '')), ''),
    nullif(trim(coalesce(input_reason_note, '')), ''),
    target_entry.visibility_scope,
    coalesce(input_imported, false),
    new_occurred_at,
    actor_profile_id
  )
  returning id into new_log_id;

  replay_payload := public.replay_progress_snapshot(target_entry.id, target_model.model_key);

  return jsonb_build_object(
    'progress_log_id', new_log_id,
    'entry_id', target_entry.id,
    'progress_model_id', target_model.id,
    'snapshot', replay_payload -> 'snapshot_json'
  );
end;
$$;

create view public.public_progress_logs_v with (security_barrier = true) as
select
  pl.id,
  pl.entry_id,
  pl.progress_model_id,
  pm.model_key,
  pl.event_type,
  pl.payload_json,
  pl.reason_code,
  pl.reason_note,
  pl.occurred_at,
  pl.imported,
  pl.created_at
from public.progress_logs pl
join public.progress_models pm on pm.id = pl.progress_model_id
join public.user_entries e on e.id = pl.entry_id
where pl.visibility_scope_snapshot = 'public'
  and e.visibility_scope = 'public'
  and e.deleted_at is null;

create view public.public_progress_snapshots_v with (security_barrier = true) as
select
  ps.entry_id,
  ps.progress_model_id,
  pm.model_key,
  ps.snapshot_json,
  ps.updated_at
from public.progress_snapshots ps
join public.progress_models pm on pm.id = ps.progress_model_id
join public.user_entries e on e.id = ps.entry_id
where ps.visibility_scope_snapshot = 'public'
  and e.visibility_scope = 'public'
  and e.deleted_at is null;

alter table public.progress_models enable row level security;
alter table public.progress_models force row level security;
alter table public.progress_logs enable row level security;
alter table public.progress_logs force row level security;
alter table public.progress_snapshots enable row level security;
alter table public.progress_snapshots force row level security;

create policy progress_models_public_select
on public.progress_models
for select
to anon, authenticated
using (true);

create policy progress_logs_owner_select
on public.progress_logs
for select
to authenticated
using (profile_id = (select public.current_profile_id()));

create policy progress_snapshots_owner_select
on public.progress_snapshots
for select
to authenticated
using (profile_id = (select public.current_profile_id()));

revoke all on public.progress_models from anon, authenticated;
revoke all on public.progress_logs from anon, authenticated;
revoke all on public.progress_snapshots from anon, authenticated;
revoke all on public.public_progress_logs_v from anon, authenticated;
revoke all on public.public_progress_snapshots_v from anon, authenticated;
revoke all on function public.task09_json_positive_integer(jsonb, text) from public;
revoke all on function public.task09_json_nonnegative_integer(jsonb, text) from public;
revoke all on function public.task09_json_nonnegative_number(jsonb, text) from public;
revoke all on function public.task09_validate_progress_payload(text, text, jsonb) from public;
revoke all on function public.task09_build_progress_snapshot(uuid, uuid) from public;
revoke all on function public.replay_progress_snapshot(uuid, text) from public;
revoke all on function public.record_progress(uuid, text, text, jsonb, timestamptz, text, text, boolean) from public;

grant select on public.progress_models to anon, authenticated;
grant select on public.progress_logs to authenticated;
grant select on public.progress_snapshots to authenticated;
grant select on public.public_progress_logs_v to anon, authenticated;
grant select on public.public_progress_snapshots_v to anon, authenticated;
grant execute on function public.replay_progress_snapshot(uuid, text) to authenticated;
grant execute on function public.record_progress(uuid, text, text, jsonb, timestamptz, text, text, boolean) to authenticated;

set search_path = public, extensions;

create or replace function public.task10_profile_hash(input_profile_id uuid)
returns smallint
language sql
immutable
as $$
  select ((hashtextextended(input_profile_id::text, 10) & 2147483647)::bigint % 4)::smallint;
$$;

create or replace function public.task10_activity_event_type_from_progress(input_event_type text)
returns text
language sql
immutable
as $$
  select case lower(trim(coalesce(input_event_type, '')))
    when 'progress_set' then 'progress_updated'
    when 'session_logged' then 'session_logged'
    when 'completed' then 'entry_completed'
    when 'abandoned' then 'entry_archived'
    else 'progress_updated'
  end;
$$;

create or replace function public.task10_activity_rollup_key(
  input_event_type text,
  input_entry_id uuid,
  input_subject_id uuid,
  input_occurred_at timestamptz
)
returns text
language sql
immutable
as $$
  select case
    when input_event_type in ('progress_updated', 'session_logged') then
      split_part(input_event_type, '_', 1)
        || ':'
        || coalesce(input_entry_id::text, input_subject_id::text)
        || ':'
        || floor(extract(epoch from input_occurred_at) / 21600)::bigint::text
    when input_event_type in ('status_changed', 'entry_created', 'entry_completed', 'entry_archived') then
      'status:'
        || coalesce(input_entry_id::text, input_subject_id::text)
        || ':'
        || floor(extract(epoch from input_occurred_at) / 86400)::bigint::text
    when input_event_type in ('rating_added', 'review_added', 'review_edited') then
      'rating:' || coalesce(input_entry_id::text, input_subject_id::text)
    when input_event_type = 'tag_added' then
      'tags:'
        || coalesce(input_entry_id::text, input_subject_id::text)
        || ':'
        || floor(extract(epoch from input_occurred_at) / 86400)::bigint::text
    when input_event_type like 'annotation_%' then
      'annotation:' || coalesce(input_subject_id::text, input_entry_id::text)
    else
      input_event_type || ':' || coalesce(input_subject_id::text, input_entry_id::text)
  end;
$$;

create table public.activity_events (
  id uuid not null default public.uuid_v7(),
  profile_id uuid not null references public.profiles(id) on delete restrict,
  profile_hash smallint not null,
  source_progress_log_id uuid,
  event_type text not null,
  subject_type text not null,
  subject_id uuid not null,
  entry_id uuid references public.user_entries(id) on delete restrict,
  work_id uuid references public.works(id) on delete restrict,
  visibility_scope_snapshot text not null,
  rollup_key text generated always as (
    public.task10_activity_rollup_key(event_type, entry_id, subject_id, occurred_at)
  ) stored,
  payload_json jsonb not null default '{}'::jsonb,
  imported boolean not null default false,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id),
  row_version integer not null default 1,
  constraint activity_events_pk primary key (id, profile_hash, occurred_at),
  constraint activity_events_profile_hash_check check (
    profile_hash = public.task10_profile_hash(profile_id)
  ),
  constraint activity_events_type_check check (
    event_type in (
      'entry_created',
      'entry_completed',
      'entry_archived',
      'status_changed',
      'progress_updated',
      'session_logged',
      'rating_added',
      'review_added',
      'review_edited',
      'tag_added',
      'annotation_created',
      'export_created'
    )
  ),
  constraint activity_events_subject_type_check check (
    subject_type in ('entry', 'progress_log', 'annotation', 'tag', 'export', 'work')
  ),
  constraint activity_events_visibility_scope_check check (
    visibility_scope_snapshot in ('private', 'unlisted', 'followers', 'public')
  ),
  constraint activity_events_payload_object check (jsonb_typeof(payload_json) = 'object'),
  constraint activity_events_row_version_positive check (row_version > 0)
) partition by list (profile_hash);

create table public.activity_events_h0
  partition of public.activity_events for values in (0)
  partition by range (occurred_at);
create table public.activity_events_h1
  partition of public.activity_events for values in (1)
  partition by range (occurred_at);
create table public.activity_events_h2
  partition of public.activity_events for values in (2)
  partition by range (occurred_at);
create table public.activity_events_h3
  partition of public.activity_events for values in (3)
  partition by range (occurred_at);

create table public.activity_events_h0_2026_05
  partition of public.activity_events_h0
  for values from ('2026-05-01 00:00:00+00') to ('2026-06-01 00:00:00+00');
create table public.activity_events_h0_2026_06
  partition of public.activity_events_h0
  for values from ('2026-06-01 00:00:00+00') to ('2026-07-01 00:00:00+00');
create table public.activity_events_h0_default
  partition of public.activity_events_h0 default;

create table public.activity_events_h1_2026_05
  partition of public.activity_events_h1
  for values from ('2026-05-01 00:00:00+00') to ('2026-06-01 00:00:00+00');
create table public.activity_events_h1_2026_06
  partition of public.activity_events_h1
  for values from ('2026-06-01 00:00:00+00') to ('2026-07-01 00:00:00+00');
create table public.activity_events_h1_default
  partition of public.activity_events_h1 default;

create table public.activity_events_h2_2026_05
  partition of public.activity_events_h2
  for values from ('2026-05-01 00:00:00+00') to ('2026-06-01 00:00:00+00');
create table public.activity_events_h2_2026_06
  partition of public.activity_events_h2
  for values from ('2026-06-01 00:00:00+00') to ('2026-07-01 00:00:00+00');
create table public.activity_events_h2_default
  partition of public.activity_events_h2 default;

create table public.activity_events_h3_2026_05
  partition of public.activity_events_h3
  for values from ('2026-05-01 00:00:00+00') to ('2026-06-01 00:00:00+00');
create table public.activity_events_h3_2026_06
  partition of public.activity_events_h3
  for values from ('2026-06-01 00:00:00+00') to ('2026-07-01 00:00:00+00');
create table public.activity_events_h3_default
  partition of public.activity_events_h3 default;

create index idx_activity_events_profile_time
  on public.activity_events(profile_id, occurred_at desc);
create index idx_activity_events_profile_rollup
  on public.activity_events(profile_id, rollup_key, occurred_at desc);
create index idx_activity_events_entry_time
  on public.activity_events(entry_id, occurred_at desc);
create index idx_activity_events_source_progress_log
  on public.activity_events(source_progress_log_id)
  where source_progress_log_id is not null;

create table public.private_activity_log (
  id uuid primary key default public.uuid_v7(),
  profile_id uuid not null references public.profiles(id) on delete restrict,
  profile_hash smallint not null,
  source_progress_log_id uuid,
  event_type text not null,
  subject_type text not null,
  subject_id uuid not null,
  entry_id uuid references public.user_entries(id) on delete restrict,
  work_id uuid references public.works(id) on delete restrict,
  visibility_scope_snapshot text not null default 'private',
  rollup_key text generated always as (
    public.task10_activity_rollup_key(event_type, entry_id, subject_id, occurred_at)
  ) stored,
  payload_json jsonb not null default '{}'::jsonb,
  imported boolean not null default false,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id),
  row_version integer not null default 1,
  constraint private_activity_log_profile_hash_check check (
    profile_hash = public.task10_profile_hash(profile_id)
  ),
  constraint private_activity_log_type_check check (
    event_type in (
      'entry_created',
      'entry_completed',
      'entry_archived',
      'status_changed',
      'progress_updated',
      'session_logged',
      'rating_added',
      'review_added',
      'review_edited',
      'tag_added',
      'annotation_created',
      'export_created'
    )
  ),
  constraint private_activity_log_subject_type_check check (
    subject_type in ('entry', 'progress_log', 'annotation', 'tag', 'export', 'work')
  ),
  constraint private_activity_log_visibility_scope_check check (
    visibility_scope_snapshot in ('private', 'unlisted', 'followers', 'public')
  ),
  constraint private_activity_log_payload_object check (jsonb_typeof(payload_json) = 'object'),
  constraint private_activity_log_row_version_positive check (row_version > 0)
);

create index idx_private_activity_log_profile_time
  on public.private_activity_log(profile_id, occurred_at desc);
create index idx_private_activity_log_entry_time
  on public.private_activity_log(entry_id, occurred_at desc);
create index idx_private_activity_log_source_progress_log
  on public.private_activity_log(source_progress_log_id)
  where source_progress_log_id is not null;

create table public.event_outbox (
  id uuid primary key default public.uuid_v7(),
  profile_id uuid not null references public.profiles(id) on delete restrict,
  source_event_id uuid not null,
  source_event_occurred_at timestamptz not null,
  target_kind text not null,
  payload_json jsonb not null default '{}'::jsonb,
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  last_error text,
  next_retry_at timestamptz not null default now(),
  status text not null default 'pending',
  sentry_alert_required boolean not null default false,
  sentry_alert_payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_outbox_target_kind_check check (
    target_kind in ('snapshot', 'activity_event')
  ),
  constraint event_outbox_payload_object check (jsonb_typeof(payload_json) = 'object'),
  constraint event_outbox_attempts_check check (attempts >= 0 and max_attempts between 1 and 20),
  constraint event_outbox_status_check check (
    status in ('pending', 'done', 'dead_letter')
  ),
  constraint event_outbox_sentry_payload_object check (
    jsonb_typeof(sentry_alert_payload_json) = 'object'
  )
);

create index idx_event_outbox_status_retry
  on public.event_outbox(status, next_retry_at, created_at);
create index idx_event_outbox_profile_created
  on public.event_outbox(profile_id, created_at desc);
create index idx_event_outbox_source_event
  on public.event_outbox(source_event_id, source_event_occurred_at);

create table public.events_visibility_sync_jobs (
  id uuid primary key default public.uuid_v7(),
  profile_id uuid not null references public.profiles(id) on delete restrict,
  entry_id uuid not null references public.user_entries(id) on delete restrict,
  old_visibility_scope text not null,
  new_visibility_scope text not null,
  batch_size integer not null default 5000,
  status text not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  locked_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_visibility_sync_jobs_visibility_check check (
    old_visibility_scope in ('private', 'unlisted', 'followers', 'public')
    and new_visibility_scope in ('private', 'unlisted', 'followers', 'public')
  ),
  constraint events_visibility_sync_jobs_batch_size_check check (
    batch_size between 1 and 5000
  ),
  constraint events_visibility_sync_jobs_status_check check (
    status in ('pending', 'running', 'done', 'dead_letter')
  ),
  constraint events_visibility_sync_jobs_attempts_check check (attempts >= 0)
);

create index idx_events_visibility_sync_jobs_status
  on public.events_visibility_sync_jobs(status, created_at);
create index idx_events_visibility_sync_jobs_entry
  on public.events_visibility_sync_jobs(entry_id, created_at desc);

create materialized view public.public_activity_feed_v as
select
  ae.id,
  ae.profile_id,
  ae.event_type,
  ae.subject_type,
  ae.subject_id,
  ae.entry_id,
  ae.work_id,
  ae.rollup_key,
  ae.payload_json,
  ae.occurred_at,
  ae.created_at
from public.activity_events ae
where ae.visibility_scope_snapshot = 'public'
  and ae.imported = false;

create unique index public_activity_feed_v_id_key
  on public.public_activity_feed_v(id);
create index idx_public_activity_feed_v_profile_time
  on public.public_activity_feed_v(profile_id, occurred_at desc);
create index idx_public_activity_feed_v_rollup_time
  on public.public_activity_feed_v(rollup_key, occurred_at desc);

create or replace function public.refresh_public_activity_feed()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view public.public_activity_feed_v;
end;
$$;

create or replace function public.task10_enqueue_event_outbox(
  input_profile_id uuid,
  input_source_event_id uuid,
  input_source_event_occurred_at timestamptz,
  input_target_kind text,
  input_payload_json jsonb,
  input_error text
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  new_outbox_id uuid;
begin
  insert into public.event_outbox (
    profile_id,
    source_event_id,
    source_event_occurred_at,
    target_kind,
    payload_json,
    last_error,
    next_retry_at
  )
  values (
    input_profile_id,
    input_source_event_id,
    input_source_event_occurred_at,
    lower(trim(input_target_kind)),
    coalesce(input_payload_json, '{}'::jsonb),
    nullif(input_error, ''),
    now()
  )
  returning id into new_outbox_id;

  return new_outbox_id;
end;
$$;

create or replace function public.task10_rebuild_progress_snapshot_for_log(
  input_source_event_id uuid,
  input_source_event_occurred_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  source_log public.progress_logs%rowtype;
  rebuilt_snapshot jsonb;
  last_log_id uuid;
  snapshot_visibility text;
begin
  select *
  into source_log
  from public.progress_logs pl
  where pl.id = input_source_event_id
    and pl.occurred_at = input_source_event_occurred_at;

  if source_log.id is null then
    raise exception 'source progress log does not exist' using errcode = '23503';
  end if;

  rebuilt_snapshot := public.task09_build_progress_snapshot(
    source_log.entry_id,
    source_log.progress_model_id
  );

  if rebuilt_snapshot is null then
    delete from public.progress_snapshots ps
    where ps.entry_id = source_log.entry_id
      and ps.progress_model_id = source_log.progress_model_id;

    return jsonb_build_object(
      'entry_id', source_log.entry_id,
      'progress_model_id', source_log.progress_model_id,
      'snapshot_json', null
    );
  end if;

  select pl.id, pl.visibility_scope_snapshot
  into last_log_id, snapshot_visibility
  from public.progress_logs pl
  where pl.entry_id = source_log.entry_id
    and pl.progress_model_id = source_log.progress_model_id
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
    source_log.profile_id,
    source_log.entry_id,
    source_log.progress_model_id,
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
    'entry_id', source_log.entry_id,
    'progress_model_id', source_log.progress_model_id,
    'snapshot_json', rebuilt_snapshot
  );
end;
$$;

create or replace function public.task10_dispatch_progress_activity(
  input_source_event_id uuid,
  input_source_event_occurred_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  source_log public.progress_logs%rowtype;
  target_entry public.user_entries%rowtype;
  normalized_event_type text;
  new_activity_id uuid;
  activity_payload jsonb;
begin
  select *
  into source_log
  from public.progress_logs pl
  where pl.id = input_source_event_id
    and pl.occurred_at = input_source_event_occurred_at;

  if source_log.id is null then
    raise exception 'source progress log does not exist' using errcode = '23503';
  end if;

  select *
  into target_entry
  from public.user_entries e
  where e.id = source_log.entry_id
    and e.deleted_at is null;

  if target_entry.id is null then
    raise exception 'activity entry does not exist' using errcode = '23503';
  end if;

  normalized_event_type := public.task10_activity_event_type_from_progress(source_log.event_type);
  activity_payload := jsonb_build_object(
    'progress_log_id', source_log.id,
    'progress_model_id', source_log.progress_model_id,
    'progress_event_type', source_log.event_type,
    'payload', source_log.payload_json,
    'reason_code', source_log.reason_code,
    'reason_note', source_log.reason_note
  );

  if source_log.visibility_scope_snapshot = 'private' then
    select pal.id
    into new_activity_id
    from public.private_activity_log pal
    where pal.source_progress_log_id = source_log.id
      and pal.occurred_at = source_log.occurred_at
    limit 1;

    if new_activity_id is null then
      insert into public.private_activity_log (
        profile_id,
        profile_hash,
        source_progress_log_id,
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
        source_log.profile_id,
        public.task10_profile_hash(source_log.profile_id),
        source_log.id,
        normalized_event_type,
        'progress_log',
        source_log.id,
        source_log.entry_id,
        target_entry.work_id,
        source_log.visibility_scope_snapshot,
        activity_payload,
        source_log.imported,
        source_log.occurred_at,
        source_log.created_by
      )
      returning id into new_activity_id;
    end if;

    return new_activity_id;
  end if;

  select ae.id
  into new_activity_id
  from public.activity_events ae
  where ae.source_progress_log_id = source_log.id
    and ae.occurred_at = source_log.occurred_at
  limit 1;

  if new_activity_id is null then
    insert into public.activity_events (
      profile_id,
      profile_hash,
      source_progress_log_id,
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
      source_log.profile_id,
      public.task10_profile_hash(source_log.profile_id),
      source_log.id,
      normalized_event_type,
      'progress_log',
      source_log.id,
      source_log.entry_id,
      target_entry.work_id,
      source_log.visibility_scope_snapshot,
      activity_payload,
      source_log.imported,
      source_log.occurred_at,
      source_log.created_by
    )
    returning id into new_activity_id;
  end if;

  return new_activity_id;
end;
$$;

create or replace function public.process_event_outbox(input_limit integer default 100)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  outbox_row public.event_outbox%rowtype;
  processed_count integer := 0;
  done_count integer := 0;
  dead_letter_count integer := 0;
  safe_limit integer := least(greatest(coalesce(input_limit, 100), 1), 5000);
  next_attempts integer;
begin
  if not pg_try_advisory_xact_lock(hashtext('task10_event_outbox_reconciler')) then
    return jsonb_build_object('processed', 0, 'done', 0, 'dead_letter', 0, 'locked', true);
  end if;

  for outbox_row in
    select *
    from public.event_outbox eo
    where eo.status = 'pending'
      and eo.next_retry_at <= now()
    order by eo.created_at asc, eo.id asc
    limit safe_limit
    for update skip locked
  loop
    processed_count := processed_count + 1;

    begin
      if outbox_row.target_kind = 'snapshot' then
        perform public.task10_rebuild_progress_snapshot_for_log(
          outbox_row.source_event_id,
          outbox_row.source_event_occurred_at
        );
      elsif outbox_row.target_kind = 'activity_event' then
        perform public.task10_dispatch_progress_activity(
          outbox_row.source_event_id,
          outbox_row.source_event_occurred_at
        );
      else
        raise exception 'unsupported outbox target kind: %', outbox_row.target_kind using errcode = '23514';
      end if;

      update public.event_outbox
      set
        status = 'done',
        updated_at = now(),
        last_error = null,
        next_retry_at = now()
      where id = outbox_row.id;

      done_count := done_count + 1;
    exception
      when others then
        next_attempts := outbox_row.attempts + 1;
        update public.event_outbox
        set
          attempts = next_attempts,
          last_error = sqlerrm,
          status = case
            when next_attempts >= outbox_row.max_attempts then 'dead_letter'
            else 'pending'
          end,
          next_retry_at = case
            when next_attempts >= outbox_row.max_attempts then now()
            else now() + make_interval(secs => least(3600, next_attempts * 60))
          end,
          sentry_alert_required = next_attempts >= outbox_row.max_attempts,
          sentry_alert_payload_json = case
            when next_attempts >= outbox_row.max_attempts then jsonb_build_object(
              'event_outbox_id', outbox_row.id,
              'source_event_id', outbox_row.source_event_id,
              'target_kind', outbox_row.target_kind,
              'last_error', sqlerrm
            )
            else sentry_alert_payload_json
          end,
          updated_at = now()
        where id = outbox_row.id;

        if next_attempts >= outbox_row.max_attempts then
          dead_letter_count := dead_letter_count + 1;
        end if;
    end;
  end loop;

  return jsonb_build_object(
    'processed', processed_count,
    'done', done_count,
    'dead_letter', dead_letter_count,
    'locked', false
  );
end;
$$;

create or replace function public.set_task10_visibility_sync_job()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if tg_op = 'UPDATE'
    and old.visibility_scope is distinct from new.visibility_scope
    and new.deleted_at is null
  then
    insert into public.events_visibility_sync_jobs (
      profile_id,
      entry_id,
      old_visibility_scope,
      new_visibility_scope
    )
    values (
      new.profile_id,
      new.id,
      old.visibility_scope,
      new.visibility_scope
    );
  end if;

  return new;
end;
$$;

create trigger enqueue_task10_visibility_sync_job
after update of visibility_scope on public.user_entries
for each row execute function public.set_task10_visibility_sync_job();

create or replace function public.process_events_visibility_sync_jobs(input_limit integer default 1)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  job_row public.events_visibility_sync_jobs%rowtype;
  processed_jobs integer := 0;
  done_jobs integer := 0;
  dead_letter_jobs integer := 0;
  moved_rows integer := 0;
  updated_rows integer := 0;
  safe_limit integer := least(greatest(coalesce(input_limit, 1), 1), 100);
  remaining_rows integer := 0;
begin
  if not pg_try_advisory_xact_lock(hashtext('task10_events_visibility_sync_jobs')) then
    return jsonb_build_object('processed', 0, 'done', 0, 'dead_letter', 0, 'locked', true);
  end if;

  for job_row in
    select *
    from public.events_visibility_sync_jobs evsj
    where evsj.status in ('pending', 'running')
    order by evsj.created_at asc, evsj.id asc
    limit safe_limit
    for update skip locked
  loop
    processed_jobs := processed_jobs + 1;

    begin
      update public.events_visibility_sync_jobs
      set status = 'running', locked_at = now(), attempts = attempts + 1, updated_at = now()
      where id = job_row.id;

      if job_row.new_visibility_scope = 'private' then
        with moved as (
          select
            ae.id,
            ae.profile_id,
            ae.profile_hash,
            ae.source_progress_log_id,
            ae.event_type,
            ae.subject_type,
            ae.subject_id,
            ae.entry_id,
            ae.work_id,
            ae.payload_json,
            ae.imported,
            ae.occurred_at,
            ae.created_at,
            ae.created_by,
            ae.row_version
          from public.activity_events ae
          where ae.entry_id = job_row.entry_id
          order by ae.occurred_at asc, ae.id asc
          limit job_row.batch_size
        ),
        inserted as (
          insert into public.private_activity_log (
            id,
            profile_id,
            profile_hash,
            source_progress_log_id,
            event_type,
            subject_type,
            subject_id,
            entry_id,
            work_id,
            visibility_scope_snapshot,
            payload_json,
            imported,
            occurred_at,
            created_at,
            created_by,
            row_version
          )
          select
            id,
            profile_id,
            profile_hash,
            source_progress_log_id,
            event_type,
            subject_type,
            subject_id,
            entry_id,
            work_id,
            'private',
            payload_json,
            imported,
            occurred_at,
            created_at,
            created_by,
            row_version
          from moved
          returning id
        ),
        deleted as (
          delete from public.activity_events ae
          using inserted i
          where ae.id = i.id
          returning ae.id
        )
        select count(*) into moved_rows from deleted;
      else
        with moved as (
          select *
          from public.private_activity_log pal
          where pal.entry_id = job_row.entry_id
          order by pal.occurred_at asc, pal.id asc
          limit job_row.batch_size
        ),
        inserted as (
          insert into public.activity_events (
            id,
            profile_id,
            profile_hash,
            source_progress_log_id,
            event_type,
            subject_type,
            subject_id,
            entry_id,
            work_id,
            visibility_scope_snapshot,
            payload_json,
            imported,
            occurred_at,
            created_at,
            created_by,
            row_version
          )
          select
            id,
            profile_id,
            profile_hash,
            source_progress_log_id,
            event_type,
            subject_type,
            subject_id,
            entry_id,
            work_id,
            job_row.new_visibility_scope,
            payload_json,
            imported,
            occurred_at,
            created_at,
            created_by,
            row_version
          from moved
          returning id
        ),
        deleted as (
          delete from public.private_activity_log pal
          using inserted i
          where pal.id = i.id
          returning pal.id
        )
        select count(*) into moved_rows from deleted;

        with updated as (
          update public.activity_events ae
          set visibility_scope_snapshot = job_row.new_visibility_scope
          where ae.entry_id = job_row.entry_id
            and ae.visibility_scope_snapshot is distinct from job_row.new_visibility_scope
          returning ae.id
        )
        select count(*) into updated_rows from updated;
      end if;

      select
        (
          select count(*) from public.activity_events ae
          where ae.entry_id = job_row.entry_id
            and ae.visibility_scope_snapshot is distinct from job_row.new_visibility_scope
        )
        +
        case
          when job_row.new_visibility_scope = 'private' then
            (select count(*) from public.activity_events ae where ae.entry_id = job_row.entry_id)
          else
            (select count(*) from public.private_activity_log pal where pal.entry_id = job_row.entry_id)
        end
      into remaining_rows;

      if remaining_rows = 0 then
        update public.events_visibility_sync_jobs
        set status = 'done', completed_at = now(), updated_at = now(), last_error = null
        where id = job_row.id;
        done_jobs := done_jobs + 1;
      else
        update public.events_visibility_sync_jobs
        set status = 'pending', updated_at = now(), last_error = null
        where id = job_row.id;
      end if;
    exception
      when others then
        update public.events_visibility_sync_jobs
        set
          status = case when attempts + 1 >= 5 then 'dead_letter' else 'pending' end,
          attempts = attempts + 1,
          last_error = sqlerrm,
          updated_at = now()
        where id = job_row.id;

        if job_row.attempts + 1 >= 5 then
          dead_letter_jobs := dead_letter_jobs + 1;
        end if;
    end;
  end loop;

  return jsonb_build_object(
    'processed', processed_jobs,
    'done', done_jobs,
    'dead_letter', dead_letter_jobs,
    'moved_rows', moved_rows,
    'updated_rows', updated_rows,
    'locked', false
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
  snapshot_payload jsonb := null;
  outbox_ids uuid[] := array[]::uuid[];
  new_outbox_id uuid;
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
  returning id, occurred_at into new_log_id, new_occurred_at;

  begin
    snapshot_payload := public.task10_rebuild_progress_snapshot_for_log(
      new_log_id,
      new_occurred_at
    ) -> 'snapshot_json';
  exception
    when others then
      new_outbox_id := public.task10_enqueue_event_outbox(
        actor_profile_id,
        new_log_id,
        new_occurred_at,
        'snapshot',
        jsonb_build_object('entry_id', target_entry.id, 'progress_model_id', target_model.id),
        sqlerrm
      );
      outbox_ids := array_append(outbox_ids, new_outbox_id);
  end;

  begin
    perform public.task10_dispatch_progress_activity(new_log_id, new_occurred_at);
  exception
    when others then
      new_outbox_id := public.task10_enqueue_event_outbox(
        actor_profile_id,
        new_log_id,
        new_occurred_at,
        'activity_event',
        jsonb_build_object('entry_id', target_entry.id, 'progress_model_id', target_model.id),
        sqlerrm
      );
      outbox_ids := array_append(outbox_ids, new_outbox_id);
  end;

  return jsonb_build_object(
    'progress_log_id', new_log_id,
    'entry_id', target_entry.id,
    'progress_model_id', target_model.id,
    'snapshot', snapshot_payload,
    'outbox_ids', to_jsonb(outbox_ids)
  );
end;
$$;

alter table public.activity_events enable row level security;
alter table public.activity_events force row level security;
alter table public.private_activity_log enable row level security;
alter table public.private_activity_log force row level security;
alter table public.event_outbox enable row level security;
alter table public.event_outbox force row level security;
alter table public.events_visibility_sync_jobs enable row level security;
alter table public.events_visibility_sync_jobs force row level security;

create policy activity_events_owner_select
on public.activity_events
for select
to authenticated
using (profile_id = (select public.current_profile_id()));

create policy private_activity_log_owner_select
on public.private_activity_log
for select
to authenticated
using (profile_id = (select public.current_profile_id()));

revoke all on public.activity_events from anon, authenticated;
revoke all on public.private_activity_log from anon, authenticated;
revoke all on public.event_outbox from anon, authenticated;
revoke all on public.events_visibility_sync_jobs from anon, authenticated;
revoke all on public.public_activity_feed_v from anon, authenticated;
revoke all on function public.task10_profile_hash(uuid) from public;
revoke all on function public.task10_activity_event_type_from_progress(text) from public;
revoke all on function public.task10_activity_rollup_key(text, uuid, uuid, timestamptz) from public;
revoke all on function public.refresh_public_activity_feed() from public;
revoke all on function public.task10_enqueue_event_outbox(uuid, uuid, timestamptz, text, jsonb, text) from public;
revoke all on function public.task10_rebuild_progress_snapshot_for_log(uuid, timestamptz) from public;
revoke all on function public.task10_dispatch_progress_activity(uuid, timestamptz) from public;
revoke all on function public.process_event_outbox(integer) from public;
revoke all on function public.set_task10_visibility_sync_job() from public;
revoke all on function public.process_events_visibility_sync_jobs(integer) from public;

grant select on public.activity_events to authenticated;
grant select on public.private_activity_log to authenticated;
grant select on public.public_activity_feed_v to anon, authenticated;
grant execute on function public.refresh_public_activity_feed() to service_role;
grant execute on function public.process_event_outbox(integer) to service_role;
grant execute on function public.process_events_visibility_sync_jobs(integer) to service_role;

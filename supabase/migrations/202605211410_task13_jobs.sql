set search_path = public, extensions;

create table public.import_jobs (
  id uuid primary key default public.uuid_v7(),
  profile_id uuid not null references public.profiles(id) on delete restrict,
  source text not null default 'mspf',
  job_kind text not null,
  config_json jsonb not null default '{}'::jsonb,
  payload_json jsonb not null default '{}'::jsonb,
  result_json jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  next_retry_at timestamptz not null default now(),
  last_error text,
  sentry_alert_required boolean not null default false,
  sentry_alert_payload_json jsonb not null default '{}'::jsonb,
  dead_lettered_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint import_jobs_source_not_blank check (length(trim(source)) > 0),
  constraint import_jobs_kind_not_blank check (length(trim(job_kind)) > 0),
  constraint import_jobs_config_object check (jsonb_typeof(config_json) = 'object'),
  constraint import_jobs_payload_object check (jsonb_typeof(payload_json) = 'object'),
  constraint import_jobs_result_object check (jsonb_typeof(result_json) = 'object'),
  constraint import_jobs_sentry_payload_object check (
    jsonb_typeof(sentry_alert_payload_json) = 'object'
  ),
  constraint import_jobs_status_check check (
    status in ('pending', 'running', 'done', 'dead_letter')
  ),
  constraint import_jobs_attempts_check check (attempts >= 0 and max_attempts between 1 and 20),
  constraint import_jobs_terminal_state_check check (
    (status = 'done' and completed_at is not null)
    or (status <> 'done' and completed_at is null)
  ),
  constraint import_jobs_dead_letter_state_check check (
    (status = 'dead_letter' and dead_lettered_at is not null)
    or (status <> 'dead_letter' and dead_lettered_at is null)
  )
);

create index idx_import_jobs_profile_created
  on public.import_jobs(profile_id, created_at desc);
create index idx_import_jobs_status_retry
  on public.import_jobs(status, next_retry_at, created_at);

create table public.export_jobs (
  id uuid primary key default public.uuid_v7(),
  profile_id uuid not null references public.profiles(id) on delete restrict,
  format text not null default 'mspf',
  job_kind text not null,
  config_json jsonb not null default '{}'::jsonb,
  payload_json jsonb not null default '{}'::jsonb,
  result_json jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  next_retry_at timestamptz not null default now(),
  last_error text,
  sentry_alert_required boolean not null default false,
  sentry_alert_payload_json jsonb not null default '{}'::jsonb,
  dead_lettered_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint export_jobs_format_not_blank check (length(trim(format)) > 0),
  constraint export_jobs_kind_not_blank check (length(trim(job_kind)) > 0),
  constraint export_jobs_config_object check (jsonb_typeof(config_json) = 'object'),
  constraint export_jobs_payload_object check (jsonb_typeof(payload_json) = 'object'),
  constraint export_jobs_result_object check (jsonb_typeof(result_json) = 'object'),
  constraint export_jobs_sentry_payload_object check (
    jsonb_typeof(sentry_alert_payload_json) = 'object'
  ),
  constraint export_jobs_status_check check (
    status in ('pending', 'running', 'done', 'dead_letter')
  ),
  constraint export_jobs_attempts_check check (attempts >= 0 and max_attempts between 1 and 20),
  constraint export_jobs_terminal_state_check check (
    (status = 'done' and completed_at is not null)
    or (status <> 'done' and completed_at is null)
  ),
  constraint export_jobs_dead_letter_state_check check (
    (status = 'dead_letter' and dead_lettered_at is not null)
    or (status <> 'dead_letter' and dead_lettered_at is null)
  )
);

create index idx_export_jobs_profile_created
  on public.export_jobs(profile_id, created_at desc);
create index idx_export_jobs_status_retry
  on public.export_jobs(status, next_retry_at, created_at);

create table public.cover_cache_jobs (
  id uuid primary key default public.uuid_v7(),
  profile_id uuid not null references public.profiles(id) on delete restrict,
  work_id uuid references public.works(id) on delete restrict,
  edition_id uuid references public.editions(id) on delete restrict,
  source_url text,
  job_kind text not null,
  payload_json jsonb not null default '{}'::jsonb,
  result_json jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  next_retry_at timestamptz not null default now(),
  last_error text,
  sentry_alert_required boolean not null default false,
  sentry_alert_payload_json jsonb not null default '{}'::jsonb,
  dead_lettered_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cover_cache_jobs_source_url_not_blank check (
    source_url is null or length(trim(source_url)) > 0
  ),
  constraint cover_cache_jobs_kind_not_blank check (length(trim(job_kind)) > 0),
  constraint cover_cache_jobs_payload_object check (jsonb_typeof(payload_json) = 'object'),
  constraint cover_cache_jobs_result_object check (jsonb_typeof(result_json) = 'object'),
  constraint cover_cache_jobs_sentry_payload_object check (
    jsonb_typeof(sentry_alert_payload_json) = 'object'
  ),
  constraint cover_cache_jobs_status_check check (
    status in ('pending', 'running', 'done', 'dead_letter')
  ),
  constraint cover_cache_jobs_attempts_check check (attempts >= 0 and max_attempts between 1 and 20),
  constraint cover_cache_jobs_terminal_state_check check (
    (status = 'done' and completed_at is not null)
    or (status <> 'done' and completed_at is null)
  ),
  constraint cover_cache_jobs_dead_letter_state_check check (
    (status = 'dead_letter' and dead_lettered_at is not null)
    or (status <> 'dead_letter' and dead_lettered_at is null)
  )
);

create index idx_cover_cache_jobs_profile_created
  on public.cover_cache_jobs(profile_id, created_at desc);
create index idx_cover_cache_jobs_status_retry
  on public.cover_cache_jobs(status, next_retry_at, created_at);
create index idx_cover_cache_jobs_work
  on public.cover_cache_jobs(work_id, created_at desc)
  where work_id is not null;
create index idx_cover_cache_jobs_edition
  on public.cover_cache_jobs(edition_id, created_at desc)
  where edition_id is not null;

alter table public.events_visibility_sync_jobs
  add column max_attempts integer not null default 5,
  add column next_retry_at timestamptz not null default now(),
  add column sentry_alert_required boolean not null default false,
  add column sentry_alert_payload_json jsonb not null default '{}'::jsonb,
  add column dead_lettered_at timestamptz;

alter table public.events_visibility_sync_jobs
  add constraint events_visibility_sync_jobs_max_attempts_check
    check (max_attempts between 1 and 20),
  add constraint events_visibility_sync_jobs_sentry_payload_object
    check (jsonb_typeof(sentry_alert_payload_json) = 'object'),
  add constraint events_visibility_sync_jobs_dead_letter_state_check
    check (
      (status = 'dead_letter' and dead_lettered_at is not null)
      or (status <> 'dead_letter' and dead_lettered_at is null)
    );

create index idx_events_visibility_sync_jobs_status_retry
  on public.events_visibility_sync_jobs(status, next_retry_at, created_at);

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
    'select id, job_kind, payload_json, attempts, max_attempts
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
        job_record.payload_json
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
  next_attempts integer;
begin
  if not pg_try_advisory_xact_lock(hashtext('task10_events_visibility_sync_jobs')) then
    return jsonb_build_object('processed', 0, 'done', 0, 'dead_letter', 0, 'locked', true);
  end if;

  for job_row in
    select *
    from public.events_visibility_sync_jobs evsj
    where evsj.status in ('pending', 'running')
      and evsj.next_retry_at <= now()
    order by evsj.created_at asc, evsj.id asc
    limit safe_limit
    for update skip locked
  loop
    processed_jobs := processed_jobs + 1;
    moved_rows := 0;
    updated_rows := 0;
    remaining_rows := 0;

    begin
      update public.events_visibility_sync_jobs
      set status = 'running', locked_at = now(), updated_at = now()
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
        set
          status = 'done',
          completed_at = now(),
          updated_at = now(),
          last_error = null,
          next_retry_at = now()
        where id = job_row.id;
        done_jobs := done_jobs + 1;
      else
        update public.events_visibility_sync_jobs
        set status = 'pending', updated_at = now(), last_error = null, next_retry_at = now()
        where id = job_row.id;
      end if;
    exception
      when others then
        next_attempts := job_row.attempts + 1;

        update public.events_visibility_sync_jobs
        set
          status = case when next_attempts >= job_row.max_attempts then 'dead_letter' else 'pending' end,
          attempts = next_attempts,
          last_error = sqlerrm,
          next_retry_at = case
            when next_attempts >= job_row.max_attempts then now()
            else now() + make_interval(secs => least(3600, next_attempts * 60))
          end,
          dead_lettered_at = case
            when next_attempts >= job_row.max_attempts then now()
            else dead_lettered_at
          end,
          sentry_alert_required = next_attempts >= job_row.max_attempts,
          sentry_alert_payload_json = case
            when next_attempts >= job_row.max_attempts then jsonb_build_object(
              'queue', 'events_visibility_sync_jobs',
              'job_id', job_row.id,
              'entry_id', job_row.entry_id,
              'last_error', sqlerrm
            )
            else sentry_alert_payload_json
          end,
          updated_at = now()
        where id = job_row.id;

        if next_attempts >= job_row.max_attempts then
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

create or replace function public.process_task13_due_jobs(input_limit integer default 100)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  safe_limit integer := least(greatest(coalesce(input_limit, 100), 1), 5000);
begin
  return jsonb_build_object(
    'import_jobs', public.task13_process_job_queue('import_jobs', safe_limit),
    'export_jobs', public.task13_process_job_queue('export_jobs', safe_limit),
    'cover_cache_jobs', public.task13_process_job_queue('cover_cache_jobs', safe_limit),
    'events_visibility_sync_jobs', public.process_events_visibility_sync_jobs(least(safe_limit, 100))
  );
end;
$$;

alter table public.import_jobs enable row level security;
alter table public.import_jobs force row level security;
alter table public.export_jobs enable row level security;
alter table public.export_jobs force row level security;
alter table public.cover_cache_jobs enable row level security;
alter table public.cover_cache_jobs force row level security;

create policy import_jobs_owner_select
on public.import_jobs
for select
to authenticated
using (profile_id = (select public.current_profile_id()));

create policy export_jobs_owner_select
on public.export_jobs
for select
to authenticated
using (profile_id = (select public.current_profile_id()));

create policy cover_cache_jobs_owner_select
on public.cover_cache_jobs
for select
to authenticated
using (profile_id = (select public.current_profile_id()));

create policy events_visibility_sync_jobs_owner_select
on public.events_visibility_sync_jobs
for select
to authenticated
using (profile_id = (select public.current_profile_id()));

revoke all on public.import_jobs from anon, authenticated;
revoke all on public.export_jobs from anon, authenticated;
revoke all on public.cover_cache_jobs from anon, authenticated;

revoke all on function public.task13_execute_job_payload(text, text, jsonb) from public;
revoke all on function public.task13_process_job_queue(text, integer) from public;
revoke all on function public.process_task13_due_jobs(integer) from public;

grant select on public.import_jobs to authenticated;
grant select on public.export_jobs to authenticated;
grant select on public.cover_cache_jobs to authenticated;
grant select on public.events_visibility_sync_jobs to authenticated;

grant execute on function public.task13_process_job_queue(text, integer) to service_role;
grant execute on function public.process_task13_due_jobs(integer) to service_role;

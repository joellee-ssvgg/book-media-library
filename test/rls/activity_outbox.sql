begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select no_plan();

create or replace function public._set_auth_user(test_user uuid)
returns void
language plpgsql
as $$
begin
  if test_user is null then
    perform set_config('request.jwt.claims', '{}', true);
    perform set_config('request.jwt.claim.sub', '', true);
  else
    perform set_config(
      'request.jwt.claims',
      json_build_object('sub', test_user::text, 'role', 'authenticated')::text,
      true
    );
    perform set_config('request.jwt.claim.sub', test_user::text, true);
  end if;
end;
$$;

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data
) values
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-00000000aa10',
  'authenticated',
  'authenticated',
  'task10-owner@example.com',
  'test-password-hash',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"username":"task10_owner","display_name":"Task10 Owner"}'::jsonb
),
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-00000000bb10',
  'authenticated',
  'authenticated',
  'task10-other@example.com',
  'test-password-hash',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"username":"task10_other","display_name":"Task10 Other"}'::jsonb
);

select is(
  (select count(*)::integer from public.profiles where username in ('task10_owner', 'task10_other')),
  2,
  'task10 auth users create profiles'
);

select is(
  (select count(*)::integer from pg_partitioned_table where partrelid = 'public.activity_events'::regclass),
  1,
  'activity_events is partitioned by profile hash'
);

select is(
  (select count(*)::integer from pg_partitioned_table where partrelid in (
    'public.activity_events_h0'::regclass,
    'public.activity_events_h1'::regclass,
    'public.activity_events_h2'::regclass,
    'public.activity_events_h3'::regclass
  )),
  4,
  'activity_events hash buckets are range-partitioned by occurred_at'
);

select is(
  (
    select count(*)::integer
    from pg_attribute
    where attrelid = 'public.activity_events'::regclass
      and attname = 'rollup_key'
      and attgenerated = 's'
  ),
  1,
  'activity_events.rollup_key is a generated column'
);

set local role authenticated;
select public._set_auth_user('00000000-0000-0000-0000-00000000aa10');

select lives_ok(
  $$ select public.create_manual_work('book', 'Task10 Public Book', 2026, null, 'zh', null, null, false, null) $$,
  'owner creates public-book work'
);

select lives_ok(
  $$ select public.create_manual_work('book', 'Task10 Private Book', 2026, null, 'zh', null, null, false, null) $$,
  'owner creates private-book work'
);

select lives_ok(
  $$ insert into public.user_entries (
       id,
       work_id,
       edition_id,
       status,
       visibility_scope,
       field_visibility_json
     )
     select
       '00000000-0000-0000-0000-000000100901'::uuid,
       w.id,
       e.id,
       'reading',
       'public',
       '{"progress":"public"}'::jsonb
     from public.works w
     join public.editions e on e.work_id = w.id and e.is_default
     where w.canonical_title = 'Task10 Public Book'
     limit 1 $$,
  'owner inserts a public entry'
);

select lives_ok(
  $$ insert into public.user_entries (
       id,
       work_id,
       edition_id,
       status,
       visibility_scope,
       field_visibility_json
     )
     select
       '00000000-0000-0000-0000-000000100902'::uuid,
       w.id,
       e.id,
       'reading',
       'private',
       '{}'::jsonb
     from public.works w
     join public.editions e on e.work_id = w.id and e.is_default
     where w.canonical_title = 'Task10 Private Book'
     limit 1 $$,
  'owner inserts a private entry'
);

select is(
  public.record_progress(
    '00000000-0000-0000-0000-000000100901'::uuid,
    'book_page_progress',
    'progress_set',
    '{"current_page":80,"total_pages":240}'::jsonb,
    '2026-05-21 09:00:00+00'::timestamptz,
    null,
    'public activity event',
    false
  ) -> 'snapshot' ->> 'current_page',
  '80',
  'record_progress writes snapshot after Task10 override'
);

select is(
  (select count(*)::integer from public.activity_events where entry_id = '00000000-0000-0000-0000-000000100901'::uuid),
  1,
  'public progress dispatches to activity_events'
);

select is(
  (select count(*)::integer from public.private_activity_log where entry_id = '00000000-0000-0000-0000-000000100901'::uuid),
  0,
  'public progress does not enter private_activity_log'
);

select matches(
  (
    select tableoid::regclass::text
    from public.activity_events
    where entry_id = '00000000-0000-0000-0000-000000100901'::uuid
    limit 1
  ),
  '^activity_events_h[0-3]_2026_05$',
  'May 2026 activity event lands in a profile-hash monthly partition'
);

select matches(
  (
    select rollup_key
    from public.activity_events
    where entry_id = '00000000-0000-0000-0000-000000100901'::uuid
    limit 1
  ),
  '^progress:00000000-0000-0000-0000-000000100901:[0-9]+$',
  'progress_updated rollup_key uses the 6 hour bucket rule'
);

reset role;
select public.refresh_public_activity_feed();
set local role authenticated;
select public._set_auth_user('00000000-0000-0000-0000-00000000aa10');

select is(
  (select count(*)::integer from public.public_activity_feed_v),
  1,
  'public activity materialized view exposes the public imported=false event'
);

select is(
  public.record_progress(
    '00000000-0000-0000-0000-000000100902'::uuid,
    'book_page_progress',
    'progress_set',
    '{"current_page":25,"total_pages":200}'::jsonb,
    '2026-05-21 10:00:00+00'::timestamptz,
    null,
    'private activity event',
    false
  ) -> 'snapshot' ->> 'current_page',
  '25',
  'private progress still updates snapshot'
);

select is(
  (select count(*)::integer from public.private_activity_log where entry_id = '00000000-0000-0000-0000-000000100902'::uuid),
  1,
  'private progress dispatches to physically isolated private_activity_log'
);

select is(
  (select count(*)::integer from public.activity_events where entry_id = '00000000-0000-0000-0000-000000100902'::uuid),
  0,
  'private progress does not enter public activity_events'
);

select public._set_auth_user('00000000-0000-0000-0000-00000000bb10');

select is(
  (select count(*)::integer from public.activity_events),
  0,
  'other authenticated user cannot read owner activity_events base rows'
);

select is(
  (select count(*)::integer from public.private_activity_log),
  0,
  'other authenticated user cannot read owner private_activity_log rows'
);

select is(
  (select count(*)::integer from public.public_activity_feed_v),
  1,
  'other authenticated user can read controlled public activity view'
);

select throws_ok(
  $$ insert into public.activity_events (
       profile_id,
       profile_hash,
       event_type,
       subject_type,
       subject_id,
       visibility_scope_snapshot,
       occurred_at,
       created_by
     )
     values (
       public.current_profile_id(),
       public.task10_profile_hash(public.current_profile_id()),
       'progress_updated',
       'entry',
       '00000000-0000-0000-0000-000000100901'::uuid,
       'public',
       '2026-05-21 11:00:00+00'::timestamptz,
       public.current_profile_id()
     ) $$,
  '42501',
  null,
  'direct activity_events insert is not granted'
);

select throws_ok(
  $$ select count(*) from public.event_outbox $$,
  '42501',
  null,
  'client roles cannot read event_outbox directly'
);

select public._set_auth_user(null);
set local role anon;

select throws_ok(
  $$ select count(*) from public.activity_events $$,
  '42501',
  null,
  'anonymous user cannot read activity_events directly'
);

select is(
  (select count(*)::integer from public.public_activity_feed_v),
  1,
  'anonymous user can read controlled public activity feed'
);

reset role;

create or replace function public._task10_raise_activity_event_failure()
returns trigger
language plpgsql
as $$
begin
  raise exception 'forced activity dispatch failure for outbox test' using errcode = 'XX000';
end;
$$;

create trigger task10_force_activity_event_failure
before insert on public.activity_events
for each row execute function public._task10_raise_activity_event_failure();

set local role authenticated;
select public._set_auth_user('00000000-0000-0000-0000-00000000aa10');

select lives_ok(
  $$ select public.record_progress(
       '00000000-0000-0000-0000-000000100901'::uuid,
       'book_page_progress',
       'progress_set',
       '{"current_page":90,"total_pages":240}'::jsonb,
       '2026-05-21 12:00:00+00'::timestamptz,
       null,
       'force outbox',
       false
     ) $$,
  'activity dispatch failure degrades to event_outbox without losing progress_log'
);

reset role;

select is(
  (
    select count(*)::integer
    from public.event_outbox
    where target_kind = 'activity_event'
      and status = 'pending'
      and last_error like '%forced activity dispatch failure%'
  ),
  1,
  'event_outbox stores the failed activity dispatch'
);

set local role authenticated;
select public._set_auth_user('00000000-0000-0000-0000-00000000aa10');

select is(
  (select snapshot_json ->> 'current_page' from public.progress_snapshots where entry_id = '00000000-0000-0000-0000-000000100901'::uuid),
  '90',
  'snapshot path still succeeds when activity dispatch falls back to outbox'
);

reset role;
drop trigger task10_force_activity_event_failure on public.activity_events;
drop function public._task10_raise_activity_event_failure();

select is(
  public.process_event_outbox(10) ->> 'done',
  '1',
  'event_outbox reconciler replays the pending activity event'
);

select is(
  (
    select count(*)::integer
    from public.event_outbox
    where target_kind = 'activity_event'
      and status = 'done'
  ),
  1,
  'reconciled outbox row is marked done'
);

select is(
  (
    select count(*)::integer
    from public.activity_events
    where entry_id = '00000000-0000-0000-0000-000000100901'::uuid
      and payload_json ->> 'reason_note' = 'force outbox'
  ),
  1,
  'reconciler writes the missing activity event'
);

select public.task10_enqueue_event_outbox(
  (select id from public.profiles where username = 'task10_owner'),
  '00000000-0000-0000-0000-000000109999'::uuid,
  '2026-05-21 13:00:00+00'::timestamptz,
  'activity_event',
  '{}'::jsonb,
  'fake missing source for dead letter'
);

update public.event_outbox
set max_attempts = 1
where source_event_id = '00000000-0000-0000-0000-000000109999'::uuid;

select is(
  public.process_event_outbox(10) ->> 'dead_letter',
  '1',
  'outbox reconciler moves exhausted failures to dead_letter'
);

select is(
  (
    select sentry_alert_required
    from public.event_outbox
    where source_event_id = '00000000-0000-0000-0000-000000109999'::uuid
  ),
  true,
  'dead_letter outbox rows require Sentry alert emission'
);

set local role authenticated;
select public._set_auth_user('00000000-0000-0000-0000-00000000aa10');

select lives_ok(
  $$ update public.user_entries
     set visibility_scope = 'private'
     where id = '00000000-0000-0000-0000-000000100901'::uuid $$,
  'owner changes entry visibility to private'
);

reset role;

select is(
  (
    select count(*)::integer
    from public.events_visibility_sync_jobs
    where entry_id = '00000000-0000-0000-0000-000000100901'::uuid
      and old_visibility_scope = 'public'
      and new_visibility_scope = 'private'
      and batch_size = 5000
  ),
  1,
  'visibility change enqueues a 5000-row sync job'
);

select is(
  public.process_events_visibility_sync_jobs(1) ->> 'done',
  '1',
  'visibility sync worker processes one job with advisory lock protection'
);

select is(
  (select count(*)::integer from public.activity_events where entry_id = '00000000-0000-0000-0000-000000100901'::uuid),
  0,
  'private visibility sync removes rows from activity_events'
);

select is(
  (select count(*)::integer from public.private_activity_log where entry_id = '00000000-0000-0000-0000-000000100901'::uuid),
  2,
  'private visibility sync moves public-entry rows into private_activity_log'
);

select public.refresh_public_activity_feed();

set local role anon;
select public._set_auth_user(null);

select is(
  (select count(*)::integer from public.public_activity_feed_v),
  0,
  'public activity view no longer exposes events after private visibility sync'
);

reset role;

select throws_ok(
  $$ insert into public.events_visibility_sync_jobs (
       profile_id,
       entry_id,
       old_visibility_scope,
       new_visibility_scope,
       batch_size
     )
     values (
       (select id from public.profiles where username = 'task10_owner'),
       '00000000-0000-0000-0000-000000100901'::uuid,
       'private',
       'public',
       5001
     ) $$,
  '23514',
  null,
  'visibility sync jobs enforce the 5000-row batch ceiling'
);

select ok(
  position(
    'user_entries' in lower((select definition from pg_matviews where schemaname = 'public' and matviewname = 'public_activity_feed_v'))
  ) = 0,
  'public activity feed does not join entries at query time'
);

select ok(
  position(
    'private_notes' in lower((select definition from pg_matviews where schemaname = 'public' and matviewname = 'public_activity_feed_v'))
  ) = 0,
  'public activity feed does not join private notes'
);

select * from finish();

rollback;

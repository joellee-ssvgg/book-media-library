begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(41);

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
  '00000000-0000-0000-0000-00000000aaa9',
  'authenticated',
  'authenticated',
  'task09-owner@example.com',
  'test-password-hash',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"username":"task09_owner","display_name":"Task09 Owner"}'::jsonb
),
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-00000000bbb9',
  'authenticated',
  'authenticated',
  'task09-other@example.com',
  'test-password-hash',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"username":"task09_other","display_name":"Task09 Other"}'::jsonb
);

select is(
  (select count(*)::integer from public.profiles where username in ('task09_owner', 'task09_other')),
  2,
  'task09 auth users create profiles'
);

select is(
  (select array_agg(model_key order by model_key) from public.progress_models),
  array['book_page_progress', 'watch_log'],
  'Task09 seeds the two P0 progress models'
);

select is(
  (select count(*)::integer from pg_partitioned_table where partrelid = 'public.progress_logs'::regclass),
  1,
  'progress_logs is partitioned'
);

select is(
  (
    select count(*)::integer
    from pg_trigger
    where tgrelid in ('public.progress_logs'::regclass, 'public.progress_snapshots'::regclass)
      and not tgisinternal
  ),
  0,
  'Task09 does not use DB triggers for snapshot sync'
);

set local role authenticated;
select public._set_auth_user('00000000-0000-0000-0000-00000000aaa9');

select lives_ok(
  $$ select public.create_manual_work('book', 'Task09 Book', 2026, null, 'zh', null, null, false, null) $$,
  'owner creates a book work'
);

select lives_ok(
  $$ select public.create_manual_work('book', 'Task09 Private Book', 2026, null, 'zh', null, null, false, null) $$,
  'owner creates a second book work for private entry checks'
);

select lives_ok(
  $$ select public.create_manual_work('movie', 'Task09 Movie', 2026, null, 'en', null, null, false, null) $$,
  'owner creates a movie work'
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
       '00000000-0000-0000-0000-000000090901'::uuid,
       w.id,
       e.id,
       'reading',
       'public',
       '{"progress":"public"}'::jsonb
     from public.works w
     join public.editions e on e.work_id = w.id and e.is_default
     where w.canonical_title = 'Task09 Book'
     limit 1 $$,
  'owner inserts a public book entry'
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
       '00000000-0000-0000-0000-000000090902'::uuid,
       w.id,
       e.id,
       'watched',
       'public',
       '{"progress":"public"}'::jsonb
     from public.works w
     join public.editions e on e.work_id = w.id and e.is_default
     where w.canonical_title = 'Task09 Movie'
     limit 1 $$,
  'owner inserts a public movie entry'
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
       '00000000-0000-0000-0000-000000090903'::uuid,
       w.id,
       e.id,
       'reading',
       'private',
       '{}'::jsonb
     from public.works w
     join public.editions e on e.work_id = w.id and e.is_default
     where w.canonical_title = 'Task09 Private Book'
     limit 1 $$,
  'owner inserts a private book entry for visibility checks'
);

select is(
  public.record_progress(
    '00000000-0000-0000-0000-000000090901'::uuid,
    'book_page_progress',
    'progress_set',
    '{"current_page":120,"total_pages":352}'::jsonb,
    '2026-05-21 12:00:00+00'::timestamptz,
    'reading_session',
    '今天一口气读到第 6 章',
    false
  ) -> 'snapshot' ->> 'current_page',
  '120',
  'record_progress writes a book log and updates snapshot in one call'
);

select is(
  (
    select tableoid::regclass::text
    from public.progress_logs
    where entry_id = '00000000-0000-0000-0000-000000090901'::uuid
    limit 1
  ),
  'progress_logs_2026_05',
  'May 2026 progress log lands in the monthly partition'
);

select is(
  (select snapshot_json ->> 'total_pages' from public.progress_snapshots where entry_id = '00000000-0000-0000-0000-000000090901'::uuid),
  '352',
  'snapshot stores total page count'
);

select is(
  (select visibility_scope_snapshot from public.progress_logs where entry_id = '00000000-0000-0000-0000-000000090901'::uuid limit 1),
  'public',
  'progress log snapshots entry visibility at write time'
);

select throws_ok(
  $$ select public.record_progress(
       '00000000-0000-0000-0000-000000090901'::uuid,
       'book_page_progress',
       'progress_set',
       '{"current_page":400,"total_pages":352}'::jsonb,
       '2026-05-21 12:05:00+00'::timestamptz,
       null,
       null,
       false
     ) $$,
  '23514',
  null,
  'book progress payload rejects current_page greater than total_pages'
);

select throws_ok(
  $$ select public.record_progress(
       '00000000-0000-0000-0000-000000090901'::uuid,
       'watch_log',
       'completed',
       '{"runtime_minutes":136}'::jsonb,
       '2026-05-21 12:10:00+00'::timestamptz,
       null,
       null,
       false
     ) $$,
  '23514',
  null,
  'book entry rejects movie watch_log model'
);

select lives_ok(
  $$ select public.record_progress(
       '00000000-0000-0000-0000-000000090902'::uuid,
       'watch_log',
       'completed',
       '{"runtime_minutes":136}'::jsonb,
       '2026-05-21 13:00:00+00'::timestamptz,
       null,
       null,
       false
     ) $$,
  'owner records a movie watch log'
);

select is(
  (select snapshot_json ->> 'watched' from public.progress_snapshots where entry_id = '00000000-0000-0000-0000-000000090902'::uuid),
  'true',
  'movie watch snapshot records watched=true'
);

select lives_ok(
  $$ select public.record_progress(
       '00000000-0000-0000-0000-000000090903'::uuid,
       'book_page_progress',
       'progress_set',
       '{"current_page":10,"total_pages":352}'::jsonb,
       '2026-05-21 14:00:00+00'::timestamptz,
       null,
       'private entry progress',
       false
     ) $$,
  'owner records progress for a private entry'
);

select is(
  (select count(*)::integer from public.progress_logs),
  3,
  'owner reads all own progress logs from base table'
);

select is(
  (select count(*)::integer from public.public_progress_logs_v),
  2,
  'owner public progress view exposes only public-entry logs'
);

select is(
  (select count(*)::integer from public.public_progress_snapshots_v),
  2,
  'owner public progress snapshot view exposes only public-entry snapshots'
);

select throws_ok(
  $$ insert into public.progress_logs(
       profile_id,
       entry_id,
       progress_model_id,
       event_type,
       visibility_scope_snapshot,
       occurred_at,
       created_by
     )
     values (
       public.current_profile_id(),
       '00000000-0000-0000-0000-000000090901'::uuid,
       (select id from public.progress_models where model_key = 'book_page_progress'),
       'progress_set',
       'public',
       '2026-05-21 15:00:00+00'::timestamptz,
       public.current_profile_id()
     ) $$,
  '42501',
  null,
  'direct progress log insert is not granted; record_progress is the write path'
);

select throws_ok(
  $$ delete from public.progress_snapshots where entry_id = '00000000-0000-0000-0000-000000090901'::uuid $$,
  '42501',
  null,
  'direct snapshot delete is not granted to clients'
);

select lives_ok(
  $$ select public.record_progress(
       '00000000-0000-0000-0000-000000090901'::uuid,
       'book_page_progress',
       'progress_set',
       '{"current_page":150,"total_pages":352}'::jsonb,
       '2026-05-21 16:00:00+00'::timestamptz,
       null,
       null,
       false
     ) $$,
  'owner records a later progress event before replay proof'
);

reset role;
delete from public.progress_snapshots
where entry_id = '00000000-0000-0000-0000-000000090901'::uuid
  and progress_model_id = (select id from public.progress_models where model_key = 'book_page_progress');
set local role authenticated;
select public._set_auth_user('00000000-0000-0000-0000-00000000aaa9');

select is(
  (select count(*)::integer from public.progress_snapshots where entry_id = '00000000-0000-0000-0000-000000090901'::uuid),
  0,
  'e2e proof setup deletes the derived snapshot while logs remain'
);

select is(
  public.replay_progress_snapshot(
    '00000000-0000-0000-0000-000000090901'::uuid,
    'book_page_progress'
  ) -> 'snapshot_json' ->> 'current_page',
  '150',
  'replay_progress_snapshot rebuilds deleted snapshot from progress_logs'
);

select is(
  (select snapshot_json ->> 'current_page' from public.progress_snapshots where entry_id = '00000000-0000-0000-0000-000000090901'::uuid),
  '150',
  'rebuilt snapshot is persisted'
);

select ok(
  position(
    'private_notes' in lower((select definition from pg_views where schemaname = 'public' and viewname = 'public_progress_logs_v'))
  ) = 0,
  'public progress view does not reference private notes'
);

select public._set_auth_user('00000000-0000-0000-0000-00000000bbb9');

select is(
  (select count(*)::integer from public.progress_logs),
  0,
  'other authenticated user cannot read owner logs from base table'
);

select is(
  (select count(*)::integer from public.progress_snapshots),
  0,
  'other authenticated user cannot read owner snapshots from base table'
);

select is(
  (select count(*)::integer from public.public_progress_logs_v),
  3,
  'other authenticated user reads public-entry logs through controlled view'
);

select is(
  (select count(*)::integer from public.public_progress_snapshots_v),
  2,
  'other authenticated user reads public-entry snapshots through controlled view'
);

select throws_ok(
  $$ select public.record_progress(
       '00000000-0000-0000-0000-000000090901'::uuid,
       'book_page_progress',
       'progress_set',
       '{"current_page":200,"total_pages":352}'::jsonb,
       '2026-05-21 17:00:00+00'::timestamptz,
       null,
       null,
       false
     ) $$,
  '42501',
  null,
  'other authenticated user cannot record progress on owner entry'
);

select throws_ok(
  $$ select public.replay_progress_snapshot(
       '00000000-0000-0000-0000-000000090901'::uuid,
       'book_page_progress'
     ) $$,
  '42501',
  null,
  'other authenticated user cannot replay owner snapshot'
);

select public._set_auth_user(null);
set local role anon;

select throws_ok(
  $$ select count(*) from public.progress_logs $$,
  '42501',
  null,
  'anonymous user has no direct progress_logs access'
);

select throws_ok(
  $$ select count(*) from public.progress_snapshots $$,
  '42501',
  null,
  'anonymous user has no direct progress_snapshots access'
);

select is(
  (select count(*)::integer from public.public_progress_logs_v),
  3,
  'anonymous user reads public-entry logs through controlled view'
);

select is(
  (select count(*)::integer from public.public_progress_snapshots_v),
  2,
  'anonymous user reads public-entry snapshots through controlled view'
);

select throws_ok(
  $$ select public.record_progress(
       '00000000-0000-0000-0000-000000090901'::uuid,
       'book_page_progress',
       'progress_set',
       '{"current_page":180,"total_pages":352}'::jsonb,
       '2026-05-21 18:00:00+00'::timestamptz,
       null,
       null,
       false
     ) $$,
  '42501',
  null,
  'anonymous user cannot record progress'
);

select is(
  (select count(*)::integer from public.progress_models),
  2,
  'anonymous user can read progress model registry'
);

select * from finish();

rollback;

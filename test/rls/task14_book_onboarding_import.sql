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
  '00000000-0000-0000-0000-00000000aa14',
  'authenticated',
  'authenticated',
  'task14-owner@example.com',
  'test-password-hash',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"username":"task14_owner","display_name":"Task14 Owner"}'::jsonb
),
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-00000000bb14',
  'authenticated',
  'authenticated',
  'task14-other@example.com',
  'test-password-hash',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"username":"task14_other","display_name":"Task14 Other"}'::jsonb
);

set local role authenticated;
select public._set_auth_user('00000000-0000-0000-0000-00000000aa14');

select is(
  public.task14_complete_onboarding(
    'demo01',
    'Demo 01',
    null,
    '[{"media_type":"book","canonical_title":"Task14 Favorite Book","status":"finished"}]'::jsonb
  ) ->> 'status',
  'completed',
  'owner completes onboarding with one favorite'
);

select ok(
  (select onboarding_completed from public.profiles where username = 'demo01'),
  'onboarding_completed is true'
);

select is(
  (select count(*)::integer from public.user_entries where favorite and status = 'finished'),
  1,
  'onboarding favorite creates a real entry'
);

select is(
  public.task14_create_book_entry_from_provider(
    'openlibrary',
    '/works/OL-TASK14',
    'The Pragmatic Programmer',
    'want_to_read',
    1999,
    null,
    'en',
    'provider description',
    'https://example.invalid/pragmatic.jpg',
    '[{"source":"openlibrary","external_id":"/works/OL-TASK14"}]'::jsonb
  ) ->> 'status',
  'created',
  'provider book add creates an entry'
);

select is(
  (
    select e.status
    from public.user_entries e
    join public.works w on w.id = e.work_id
    where w.canonical_title = 'The Pragmatic Programmer'
    limit 1
  ),
  'want_to_read',
  'provider book entry stores initial status'
);

select is(
  (
    select count(*)::integer
    from public.private_activity_log pal
    where pal.event_type = 'entry_created'
      and pal.imported = false
  ),
  2,
  'entry_created activity is recorded for onboarding and provider add'
);

select is(
  public.task14_create_book_entry_from_provider(
    'openlibrary',
    '/works/OL-TASK14',
    'The Pragmatic Programmer',
    'reading',
    1999,
    null,
    'en',
    null,
    null,
    '[{"source":"openlibrary","external_id":"/works/OL-TASK14"}]'::jsonb
  ) ->> 'status',
  'already_exists',
  'adding the same provider work does not create a duplicate active entry'
);

select throws_ok(
  $$ insert into public.import_jobs(profile_id, source, job_kind)
     values (public.current_profile_id(), 'csv', 'task14_csv_import') $$,
  '42501',
  null,
  'authenticated users still cannot insert import_jobs directly'
);

select is(
  public.task14_enqueue_import_job(
    'csv',
    '{
      "source":"csv",
      "items":[
        {
          "media_type":"book",
          "canonical_title":"Imported CSV Book",
          "status":"reading",
          "first_release_year":2020,
          "visibility_scope":"private",
          "external_ids":[{"source":"csv","external_id":"task14-csv-book"}]
        }
      ]
    }'::jsonb,
    '{"source_file_name":"history.csv","item_count":1}'::jsonb
  ) ->> 'status',
  'queued',
  'owner can enqueue a real task14 csv import job'
);

select public._set_auth_user('00000000-0000-0000-0000-00000000bb14');

select is(
  (select count(*)::integer from public.import_jobs where source = 'csv'),
  0,
  'other authenticated user cannot read owner import job'
);

reset role;
set local role service_role;

select is(
  (public.task13_process_job_queue('import_jobs', 10) ->> 'done')::integer,
  1,
  'service runner processes the real task14 import job'
);

reset role;
set local role authenticated;
select public._set_auth_user('00000000-0000-0000-0000-00000000aa14');

select is(
  (
    select status
    from public.import_jobs
    where source = 'csv'
    order by created_at desc
    limit 1
  ),
  'done',
  'import job reaches done state'
);

select is(
  (
    select result_json ->> 'imported'
    from public.import_jobs
    where source = 'csv'
    order by created_at desc
    limit 1
  ),
  '1',
  'import job result reports one imported item'
);

select is(
  (
    select count(*)::integer
    from public.user_entries e
    join public.works w on w.id = e.work_id
    where w.canonical_title = 'Imported CSV Book'
      and e.imported
      and e.status = 'reading'
  ),
  1,
  'task14 csv import creates an imported entry'
);

select public._set_auth_user(null);
set local role anon;

select throws_ok(
  $$ select public.task14_enqueue_import_job('csv', '{"items":[]}'::jsonb, '{}'::jsonb) $$,
  '42501',
  null,
  'anonymous users cannot enqueue imports'
);

reset role;

select * from finish();

rollback;

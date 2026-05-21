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
  '00000000-0000-0000-0000-00000000aa13',
  'authenticated',
  'authenticated',
  'task13-owner@example.com',
  'test-password-hash',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"username":"task13_owner","display_name":"Task13 Owner"}'::jsonb
),
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-00000000bb13',
  'authenticated',
  'authenticated',
  'task13-other@example.com',
  'test-password-hash',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"username":"task13_other","display_name":"Task13 Other"}'::jsonb
);

select is(
  (select count(*)::integer from public.profiles where username in ('task13_owner', 'task13_other')),
  2,
  'task13 auth users create profiles'
);

select is(
  (
    select count(*)::integer
    from information_schema.tables
    where table_schema = 'public'
      and table_name in (
        'import_jobs',
        'export_jobs',
        'cover_cache_jobs',
        'events_visibility_sync_jobs'
      )
  ),
  4,
  'Task13 has all four job tables'
);

select is(
  (
    select count(*)::integer
    from information_schema.columns
    where table_schema = 'public'
      and table_name in (
        'import_jobs',
        'export_jobs',
        'cover_cache_jobs',
        'events_visibility_sync_jobs'
      )
      and column_name in ('status', 'attempts', 'next_retry_at', 'last_error')
  ),
  16,
  'all Task13 job tables expose the required status, attempts, next_retry_at, and last_error columns'
);

select is(
  (
    select count(*)::integer
    from pg_class
    where oid in (
      'public.import_jobs'::regclass,
      'public.export_jobs'::regclass,
      'public.cover_cache_jobs'::regclass,
      'public.events_visibility_sync_jobs'::regclass
    )
      and relrowsecurity
      and relforcerowsecurity
  ),
  4,
  'all Task13 job tables enable and force RLS'
);

select is(
  (
    select count(*)::integer
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in (
        'import_jobs',
        'export_jobs',
        'cover_cache_jobs',
        'events_visibility_sync_jobs'
      )
      and grantee = 'authenticated'
      and privilege_type = 'SELECT'
  ),
  4,
  'authenticated receives owner-scoped select on all Task13 job tables'
);

select is(
  (
    select count(*)::integer
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in (
        'import_jobs',
        'export_jobs',
        'cover_cache_jobs',
        'events_visibility_sync_jobs'
      )
      and grantee = 'authenticated'
      and privilege_type <> 'SELECT'
  ),
  0,
  'authenticated receives no direct write grants on Task13 job tables'
);

insert into public.import_jobs (
  id,
  profile_id,
  source,
  job_kind,
  payload_json
)
select
  '00000000-0000-0000-0000-000000130001'::uuid,
  id,
  'mspf',
  'dummy_success',
  '{"source":"task13-owner-import"}'::jsonb
from public.profiles
where username = 'task13_owner';

insert into public.import_jobs (
  id,
  profile_id,
  source,
  job_kind,
  payload_json
)
select
  '00000000-0000-0000-0000-000000130002'::uuid,
  id,
  'csv',
  'dummy_success',
  '{"source":"task13-other-import"}'::jsonb
from public.profiles
where username = 'task13_other';

insert into public.export_jobs (
  id,
  profile_id,
  format,
  job_kind,
  payload_json
)
select
  '00000000-0000-0000-0000-000000130003'::uuid,
  id,
  'mspf',
  'dummy_success',
  '{"source":"task13-owner-export"}'::jsonb
from public.profiles
where username = 'task13_owner';

insert into public.cover_cache_jobs (
  id,
  profile_id,
  source_url,
  job_kind,
  payload_json
)
select
  '00000000-0000-0000-0000-000000130004'::uuid,
  id,
  'https://example.invalid/task13-cover.jpg',
  'dummy_success',
  '{"source":"task13-owner-cover"}'::jsonb
from public.profiles
where username = 'task13_owner';

set local role authenticated;
select public._set_auth_user('00000000-0000-0000-0000-00000000aa13');

select is(
  (select count(*)::integer from public.import_jobs),
  1,
  'owner reads only own import jobs'
);

select is(
  (select count(*)::integer from public.export_jobs),
  1,
  'owner reads own export jobs'
);

select is(
  (select count(*)::integer from public.cover_cache_jobs),
  1,
  'owner reads own cover cache jobs'
);

select is(
  (
    select count(*)::integer
    from public.import_jobs
    where payload_json ->> 'source' = 'task13-other-import'
  ),
  0,
  'owner cannot read another profile import job payload'
);

select throws_ok(
  $$ insert into public.import_jobs (
       profile_id,
       source,
       job_kind
     )
     values (
       public.current_profile_id(),
       'mspf',
       'client_created'
     ) $$,
  '42501',
  null,
  'authenticated users cannot directly insert import jobs'
);

select throws_ok(
  $$ update public.export_jobs
     set status = 'done'
     where id = '00000000-0000-0000-0000-000000130003'::uuid $$,
  '42501',
  null,
  'authenticated users cannot directly update export jobs'
);

select throws_ok(
  $$ delete from public.cover_cache_jobs
     where id = '00000000-0000-0000-0000-000000130004'::uuid $$,
  '42501',
  null,
  'authenticated users cannot directly delete cover cache jobs'
);

select public._set_auth_user('00000000-0000-0000-0000-00000000bb13');

select is(
  (select count(*)::integer from public.import_jobs),
  1,
  'other authenticated user reads only their import job'
);

select is(
  (
    select count(*)::integer
    from public.import_jobs
    where payload_json ->> 'source' = 'task13-owner-import'
  ),
  0,
  'other authenticated user cannot read owner import job payload'
);

select public._set_auth_user(null);
set local role anon;

select throws_ok(
  $$ select count(*) from public.import_jobs $$,
  '42501',
  null,
  'anonymous users cannot read import jobs directly'
);

reset role;
set local role service_role;

select is(
  (public.task13_process_job_queue('import_jobs', 10) ->> 'done')::integer,
  2,
  'generic Task13 worker processes due import jobs'
);

select is(
  (public.process_task13_due_jobs(10) -> 'export_jobs' ->> 'done')::integer,
  1,
  'generic Task13 due runner processes export jobs'
);

select is(
  (
    select result_json ->> 'queue'
    from public.export_jobs
    where id = '00000000-0000-0000-0000-000000130003'::uuid
  ),
  'export_jobs',
  'dummy export job stores runner result payload'
);

select is(
  (
    select status || ':' || (result_json ->> 'queue')
    from public.cover_cache_jobs
    where id = '00000000-0000-0000-0000-000000130004'::uuid
  ),
  'done:cover_cache_jobs',
  'dummy cover cache job runs through the full queue path'
);

reset role;

insert into public.export_jobs (
  id,
  profile_id,
  format,
  job_kind,
  payload_json,
  max_attempts
)
select
  '00000000-0000-0000-0000-000000130005'::uuid,
  id,
  'mspf',
  'dummy_failure',
  '{"source":"task13-dead-letter"}'::jsonb,
  1
from public.profiles
where username = 'task13_owner';

set local role service_role;

select is(
  (public.task13_process_job_queue('export_jobs', 10) ->> 'dead_letter')::integer,
  1,
  'generic Task13 worker moves exhausted failures to dead_letter'
);

reset role;

select is(
  (
    select status || ':' || sentry_alert_required::text
    from public.export_jobs
    where id = '00000000-0000-0000-0000-000000130005'::uuid
  ),
  'dead_letter:true',
  'dead_letter export job requires Sentry alert emission'
);

select matches(
  (
    select sentry_alert_payload_json ->> 'last_error'
    from public.export_jobs
    where id = '00000000-0000-0000-0000-000000130005'::uuid
  ),
  'forced dummy job failure',
  'dead_letter export job stores a readable error payload'
);

select throws_ok(
  $$ select public.task13_process_job_queue('unsupported_jobs', 10) $$,
  '23514',
  null,
  'generic Task13 worker rejects unsupported queues'
);

select * from finish();

rollback;

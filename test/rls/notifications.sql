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
  '00000000-0000-0000-0000-00000000aa12',
  'authenticated',
  'authenticated',
  'task12-owner@example.com',
  'test-password-hash',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"username":"task12_owner","display_name":"Task12 Owner"}'::jsonb
),
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-00000000bb12',
  'authenticated',
  'authenticated',
  'task12-other@example.com',
  'test-password-hash',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"username":"task12_other","display_name":"Task12 Other"}'::jsonb
);

select is(
  (select count(*)::integer from public.profiles where username in ('task12_owner', 'task12_other')),
  2,
  'task12 auth users create profiles'
);

select is(
  (
    select count(*)::integer
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'notifications'
  ),
  1,
  'Task12 creates notifications table'
);

select is(
  (
    select count(*)::integer
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'notifications'
      and column_name in (
        'id',
        'recipient_profile_id',
        'actor_profile_id',
        'kind',
        'payload_json',
        'read_at',
        'created_at'
      )
  ),
  7,
  'notifications exposes the v6 schema-only columns'
);

select is(
  (
    select relrowsecurity::text || ':' || relforcerowsecurity::text
    from pg_class
    where oid = 'public.notifications'::regclass
  ),
  'true:true',
  'notifications enables and forces RLS'
);

select is(
  (
    select count(*)::integer
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'notifications'
      and indexname = 'idx_notifications_recipient_created_at'
      and indexdef like '%(recipient_profile_id, created_at)%'
  ),
  1,
  'notifications has the required recipient-created index'
);

select is(
  (
    select array_agg(privilege_type::text order by privilege_type)::text[]
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'notifications'
      and grantee = 'authenticated'
  ),
  array['SELECT']::text[],
  'authenticated only receives select on schema-only notifications'
);

insert into public.notifications (
  id,
  recipient_profile_id,
  actor_profile_id,
  kind,
  payload_json,
  created_at
)
select
  '00000000-0000-0000-0000-000000120001'::uuid,
  owner_profile.id,
  other_profile.id,
  'follow_started',
  '{"source":"task12-owner"}'::jsonb,
  '2026-05-21 12:00:00+00'::timestamptz
from public.profiles owner_profile
cross join public.profiles other_profile
where owner_profile.username = 'task12_owner'
  and other_profile.username = 'task12_other';

insert into public.notifications (
  id,
  recipient_profile_id,
  actor_profile_id,
  kind,
  payload_json,
  read_at,
  created_at
)
select
  '00000000-0000-0000-0000-000000120002'::uuid,
  owner_profile.id,
  null,
  'import_finished',
  '{"source":"task12-system"}'::jsonb,
  '2026-05-21 12:05:00+00'::timestamptz,
  '2026-05-21 12:01:00+00'::timestamptz
from public.profiles owner_profile
where owner_profile.username = 'task12_owner';

insert into public.notifications (
  id,
  recipient_profile_id,
  actor_profile_id,
  kind,
  payload_json,
  created_at
)
select
  '00000000-0000-0000-0000-000000120003'::uuid,
  other_profile.id,
  owner_profile.id,
  'follow_started',
  '{"source":"task12-other"}'::jsonb,
  '2026-05-21 12:02:00+00'::timestamptz
from public.profiles owner_profile
cross join public.profiles other_profile
where owner_profile.username = 'task12_owner'
  and other_profile.username = 'task12_other';

select throws_ok(
  $$ insert into public.notifications (
       recipient_profile_id,
       kind,
       payload_json
     )
     select id, '', '{}'::jsonb
     from public.profiles
     where username = 'task12_owner' $$,
  '23514',
  null,
  'notifications reject blank kind'
);

select throws_ok(
  $$ insert into public.notifications (
       recipient_profile_id,
       kind,
       payload_json
     )
     select id, 'bad_payload', '[]'::jsonb
     from public.profiles
     where username = 'task12_owner' $$,
  '23514',
  null,
  'notifications require object payload_json'
);

select throws_ok(
  $$ insert into public.notifications (
       recipient_profile_id,
       kind,
       payload_json,
       read_at,
       created_at
     )
     select
       id,
       'bad_read_time',
       '{}'::jsonb,
       '2026-05-21 11:59:00+00'::timestamptz,
       '2026-05-21 12:00:00+00'::timestamptz
     from public.profiles
     where username = 'task12_owner' $$,
  '23514',
  null,
  'notifications reject read_at before created_at'
);

set local role authenticated;
select public._set_auth_user('00000000-0000-0000-0000-00000000aa12');

select is(
  (select count(*)::integer from public.notifications),
  2,
  'recipient reads only own notifications'
);

select is(
  (
    select count(*)::integer
    from public.notifications
    where actor_profile_id is null
  ),
  1,
  'recipient can read system notification with null actor_profile_id'
);

select is(
  (
    select count(*)::integer
    from public.notifications
    where payload_json ->> 'source' = 'task12-other'
  ),
  0,
  'recipient cannot read another profile notification payload'
);

select throws_ok(
  $$ insert into public.notifications (
       recipient_profile_id,
       kind,
       payload_json
     )
     values (
       public.current_profile_id(),
       'client_created',
       '{}'::jsonb
     ) $$,
  '42501',
  null,
  'authenticated recipient cannot insert notifications in P0 schema-only phase'
);

select throws_ok(
  $$ update public.notifications
     set read_at = now()
     where id = '00000000-0000-0000-0000-000000120001'::uuid $$,
  '42501',
  null,
  'authenticated recipient cannot update notifications in P0 schema-only phase'
);

select throws_ok(
  $$ delete from public.notifications
     where id = '00000000-0000-0000-0000-000000120001'::uuid $$,
  '42501',
  null,
  'authenticated recipient cannot delete notifications in P0 schema-only phase'
);

select public._set_auth_user('00000000-0000-0000-0000-00000000bb12');

select is(
  (select count(*)::integer from public.notifications),
  1,
  'other authenticated recipient reads only their notification'
);

select is(
  (
    select count(*)::integer
    from public.notifications
    where payload_json ->> 'source' in ('task12-owner', 'task12-system')
  ),
  0,
  'other authenticated user cannot read owner notification payloads'
);

select public._set_auth_user(null);
set local role anon;

select throws_ok(
  $$ select count(*) from public.notifications $$,
  '42501',
  null,
  'anonymous user cannot read notifications directly'
);

select * from finish();

rollback;

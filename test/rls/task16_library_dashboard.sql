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
  '00000000-0000-0000-0000-00000000aa16',
  'authenticated',
  'authenticated',
  'task16-owner@example.com',
  'test-password-hash',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"username":"task16_owner","display_name":"Task16 Owner"}'::jsonb
),
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-00000000bb16',
  'authenticated',
  'authenticated',
  'task16-other@example.com',
  'test-password-hash',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"username":"task16_other","display_name":"Task16 Other"}'::jsonb
);

set local role authenticated;
select public._set_auth_user('00000000-0000-0000-0000-00000000aa16');

select is(
  (public.task16_get_library_dashboard() ->> 'entry_count')::integer,
  0,
  'zero-entry owner dashboard reports no real entries'
);

select is(
  public.task16_get_library_dashboard() ->> 'use_seed',
  'true',
  'zero-entry owner dashboard switches on P0 seed'
);

select is(
  jsonb_array_length(public.task16_get_library_dashboard() -> 'seed_recommendations'),
  3,
  'zero-entry owner dashboard returns the hardcoded P0 seed set'
);

select is(
  public.task14_create_book_entry_from_provider(
    'openlibrary',
    '/works/OL-TASK16',
    'Task16 Active Book',
    'reading',
    2024,
    null,
    'en',
    null,
    null,
    '[{"source":"openlibrary","external_id":"/works/OL-TASK16"}]'::jsonb
  ) ->> 'status',
  'created',
  'owner creates a real active book entry'
);

select is(
  public.task15_create_movie_entry_from_provider(
    'tmdb',
    '161616',
    'Task16 Finished Movie',
    'watched',
    45,
    2025,
    null,
    'en',
    null,
    null,
    120,
    '[{"source":"tmdb","external_id":"161616"}]'::jsonb
  ) ->> 'status',
  'created',
  'owner creates a real finished movie entry'
);

select is(
  (public.task16_get_library_dashboard() ->> 'entry_count')::integer,
  2,
  'dashboard reports real entries after first successful adds'
);

select is(
  public.task16_get_library_dashboard() ->> 'use_seed',
  'false',
  'real entries switch seed off'
);

select is(
  jsonb_array_length(public.task16_get_library_dashboard() -> 'library'),
  2,
  'library payload includes owner entries'
);

select is(
  jsonb_array_length(public.task16_get_library_dashboard() #> '{dashboard,continue_reading}'),
  1,
  'dashboard continue_reading includes active entry'
);

select is(
  jsonb_array_length(public.task16_get_library_dashboard() #> '{dashboard,recent_finished}'),
  1,
  'dashboard recent_finished includes finished movie'
);

select is(
  (public.task16_get_library_dashboard() #>> '{dashboard,year_ring,completed_this_year}')::integer,
  1,
  'dashboard year ring counts current-year finished items'
);

select public._set_auth_user('00000000-0000-0000-0000-00000000bb16');

select is(
  (public.task16_get_library_dashboard() ->> 'entry_count')::integer,
  0,
  'other authenticated user cannot read owner library entries'
);

select is(
  public.task16_get_library_dashboard() ->> 'use_seed',
  'true',
  'other zero-entry dashboard still sees only seed state'
);

select public._set_auth_user(null);
set local role anon;

select throws_ok(
  $$ select public.task16_get_library_dashboard() $$,
  '42501',
  null,
  'anonymous users cannot read library dashboard'
);

select throws_ok(
  $$ select public.task16_seed_recommendations() $$,
  '42501',
  null,
  'anonymous users cannot execute internal seed helper directly'
);

reset role;

select * from finish();

rollback;

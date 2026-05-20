begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(24);

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
  '00000000-0000-0000-0000-00000000aaa1',
  'authenticated',
  'authenticated',
  'owner@example.com',
  'test-password-hash',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"username":"owner","display_name":"Owner"}'::jsonb
),
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-00000000bbb1',
  'authenticated',
  'authenticated',
  'other@example.com',
  'test-password-hash',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"username":"other","display_name":"Other"}'::jsonb
);

select is(
  (select count(*)::integer from public.profiles where auth_user_id in (
    '00000000-0000-0000-0000-00000000aaa1',
    '00000000-0000-0000-0000-00000000bbb1'
  )),
  2,
  'auth.users insert creates profiles'
);

select is(
  (select count(*)::integer from public.auth_identities where provider = 'supabase'),
  2,
  'auth.users insert creates supabase auth identities'
);

select is(
  (select username from public.profiles where auth_user_id = '00000000-0000-0000-0000-00000000aaa1'),
  'owner',
  'profile username is taken from auth metadata'
);

select isnt(
  (select id from public.profiles where auth_user_id = '00000000-0000-0000-0000-00000000aaa1'),
  '00000000-0000-0000-0000-00000000aaa1'::uuid,
  'profile id is separate from auth user id'
);

set local role authenticated;
select public._set_auth_user('00000000-0000-0000-0000-00000000aaa1');

select is(
  (select count(*)::integer from public.profiles),
  1,
  'owner can select only own profile'
);

select lives_ok(
  $$ update public.profiles set display_name = 'Owner Edited' where username = 'owner' $$,
  'owner can update own profile'
);

select is_empty(
  $$ update public.profiles
     set display_name = 'Other Edited By Owner'
     where username = 'other'
     returning 1 $$,
  'owner cannot update other profile'
);

select throws_ok(
  $$ insert into public.profiles(auth_user_id, username) values ('00000000-0000-0000-0000-00000000bbb1', 'spoof') $$,
  '42501',
  null,
  'owner cannot insert profile for another auth user'
);

select throws_ok(
  $$ delete from public.profiles where username = 'owner' returning 1 $$,
  '42501',
  null,
  'owner cannot directly delete profile before Task 18 deletion flow'
);

select is(
  (select count(*)::integer from public.auth_identities),
  1,
  'owner can select own auth identity'
);

select lives_ok(
  $$ update public.auth_identities set email = 'owner-updated@example.com' where provider = 'supabase' $$,
  'owner can update own auth identity row'
);

select throws_ok(
  $$ insert into public.auth_identities(profile_id, provider, provider_user_id, email)
     select id, 'github', 'gh-owner', 'owner-github@example.com'
     from public.profiles where username = 'owner' $$,
  '42501',
  null,
  'owner cannot insert P1 OAuth identity in P0'
);

select throws_ok(
  $$ delete from public.auth_identities where provider = 'supabase' returning 1 $$,
  '42501',
  null,
  'owner cannot delete auth identity directly'
);

select public._set_auth_user('00000000-0000-0000-0000-00000000bbb1');

select is(
  (select count(*)::integer from public.profiles where username = 'owner'),
  0,
  'other cannot select owner profile through table'
);

select is(
  (select count(*)::integer from public.auth_identities where email = 'owner-updated@example.com'),
  0,
  'other cannot select owner auth identity'
);

select is_empty(
  $$ update public.profiles
     set display_name = 'Owner Edited By Other'
     where username = 'owner'
     returning 1 $$,
  'other cannot update owner profile'
);

select public._set_auth_user(null);
set local role anon;

select throws_ok(
  $$ select count(*) from public.profiles $$,
  '42501',
  null,
  'anonymous cannot read profiles table'
);

select throws_ok(
  $$ select count(*) from public.auth_identities $$,
  '42501',
  null,
  'anonymous cannot read auth identities table'
);

select is(
  (select count(*)::integer from public.public_profile_view where username in ('owner', 'other')),
  2,
  'anonymous can read public profiles through public_profile_view'
);

select throws_ok(
  $$ select id from public.public_profile_view $$,
  '42703',
  null,
  'public_profile_view does not expose profile id'
);

select throws_ok(
  $$ select auth_user_id from public.public_profile_view $$,
  '42703',
  null,
  'public_profile_view does not expose auth user id'
);

select throws_ok(
  $$ select created_by from public.public_profile_view $$,
  '42703',
  null,
  'public_profile_view does not expose audit fields'
);

reset role;

select matches(
  (select id::text from public.profiles where username = 'owner'),
  '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
  'profile id is UUID v7-shaped'
);

select is(
  (select row_version from public.profiles where username = 'owner'),
  2,
  'profile row_version increments on update'
);

select * from finish();

rollback;

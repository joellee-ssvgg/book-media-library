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
  '00000000-0000-0000-0000-00000000aa17',
  'authenticated',
  'authenticated',
  'task17-owner@example.com',
  'test-password-hash',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"username":"task17_owner","display_name":"Task17 Owner"}'::jsonb
),
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-00000000bb17',
  'authenticated',
  'authenticated',
  'task17-other@example.com',
  'test-password-hash',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"username":"task17_other","display_name":"Task17 Other"}'::jsonb
),
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-00000000dd17',
  'authenticated',
  'authenticated',
  'task17-deleted@example.com',
  'test-password-hash',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"username":"task17_deleted","display_name":"Task17 Deleted"}'::jsonb
);

update public.profiles
set
  username = 'task17_owner',
  display_name = 'Task17 Owner',
  bio = 'Public Task17 profile'
where auth_user_id = '00000000-0000-0000-0000-00000000aa17';

update public.profiles
set
  username = 'task17_other',
  public_visibility = 'private'
where auth_user_id = '00000000-0000-0000-0000-00000000bb17';

update public.profiles
set
  username = 'task17_deleted',
  deleted_at = now(),
  delete_reason = 'task17 placeholder proof'
where auth_user_id = '00000000-0000-0000-0000-00000000dd17';

set local role authenticated;
select public._set_auth_user('00000000-0000-0000-0000-00000000aa17');

create temp table task17_book_result as
select public.task14_create_book_entry_from_provider(
  'openlibrary',
  '/works/OL-TASK17',
  'Task17 Public Book',
  'finished',
  2026,
  null,
  'en',
  'Task17 public book description',
  null,
  '[{"source":"openlibrary","external_id":"/works/OL-TASK17"}]'::jsonb
) as payload;

create temp table task17_movie_result as
select public.task15_create_movie_entry_from_provider(
  'tmdb',
  '171717',
  'Task17 Public Movie',
  'watched',
  40,
  2025,
  null,
  'en',
  'Task17 public movie description',
  null,
  110,
  '[{"source":"tmdb","external_id":"171717"}]'::jsonb
) as payload;

grant select on task17_book_result to anon, authenticated;
grant select on task17_movie_result to anon, authenticated;

update public.user_entries
set
  rating_x10 = 45,
  review = 'Task17 public review',
  finished_at = now()
where id = (select (payload ->> 'entry_id')::uuid from task17_book_result);

insert into public.user_private_notes(entry_id, note)
values (
  (select (payload ->> 'entry_id')::uuid from task17_book_result),
  'Task17 private note must not leak'
);

select is(
  public.task17_update_public_profile(
    'public',
    jsonb_build_array(
      jsonb_build_object('entry_id', (select payload ->> 'entry_id' from task17_book_result)),
      jsonb_build_object('entry_id', (select payload ->> 'entry_id' from task17_movie_result))
    )
  ) ->> 'status',
  'updated',
  'owner can publish public homepage top entries'
);

select is(
  (select visibility_scope from public.user_entries where id = (select (payload ->> 'entry_id')::uuid from task17_book_result)),
  'public',
  'publishing top entries switches selected entry to public visibility'
);

select is(
  (select field_visibility_json ->> 'review' from public.user_entries where id = (select (payload ->> 'entry_id')::uuid from task17_book_result)),
  'public',
  'publishing top entries exposes the selected public review field'
);

select public._set_auth_user('00000000-0000-0000-0000-00000000bb17');

select throws_ok(
  $$ select public.task17_update_public_profile(
       'public',
       jsonb_build_array(jsonb_build_object('entry_id', (select payload ->> 'entry_id' from task17_book_result)))
     ) $$,
  '42501',
  null,
  'other authenticated user cannot publish owner top entries'
);

select public._set_auth_user(null);
set local role anon;

select is(
  public.task17_public_profile_state('task17_owner') ->> 'status',
  'active',
  'anonymous profile state sees active public profile'
);

select is(
  public.task17_public_profile_state('task17_deleted') ->> 'status',
  'gone',
  'anonymous profile state sees deleted profile as gone'
);

select is(
  public.task17_public_profile_state('task17_other') ->> 'status',
  'not_found',
  'anonymous profile state hides private profiles'
);

select is(
  public.task17_get_public_profile('task17_owner') ->> 'status',
  'active',
  'anonymous can load active public profile payload'
);

select is(
  jsonb_array_length(public.task17_get_public_profile('task17_owner') -> 'top3'),
  2,
  'public profile payload includes selected top entries'
);

select is(
  jsonb_array_length(public.task17_get_public_profile('task17_owner') -> 'recent_finished'),
  2,
  'public profile payload includes recent finished public entries'
);

select ok(
  (public.task17_get_public_profile('task17_owner')::text like '%Task17 public review%')
  and (public.task17_get_public_profile('task17_owner')::text not like '%Task17 private note must not leak%'),
  'public profile includes public review but never leaks private note text'
);

select is(
  public.task17_get_public_profile('task17_deleted') ->> 'status',
  'gone',
  'public profile RPC preserves deleted placeholder state'
);

select is(
  public.task17_get_public_work(
    (select (payload ->> 'work_id')::uuid from task17_book_result),
    'task17-public-book'
  ) ->> 'status',
  'active',
  'anonymous can load public work payload'
);

select is(
  (public.task17_get_public_work(
    (select (payload ->> 'work_id')::uuid from task17_book_result),
    'task17-public-book'
  ) #>> '{stats,reviewed}')::integer,
  1,
  'public work payload counts public reviews'
);

select ok(
  public.task17_get_public_work(
    (select (payload ->> 'work_id')::uuid from task17_book_result),
    'task17-public-book'
  )::text not like '%Task17 private note must not leak%',
  'public work payload never leaks private note text'
);

select throws_ok(
  $$ select public.task17_update_public_profile('public', '[]'::jsonb) $$,
  '42501',
  null,
  'anonymous users cannot update public profile settings'
);

select is(
  position('user_private_notes' in lower(pg_get_functiondef('public.task17_get_public_profile(text)'::regprocedure))),
  0,
  'public profile RPC does not reference user_private_notes'
);

select is(
  position('private_activity_log' in lower(pg_get_functiondef('public.task17_get_public_profile(text)'::regprocedure))),
  0,
  'public profile RPC does not reference private_activity_log'
);

select is(
  position('join public.user_entries' in lower(pg_get_functiondef('public.task17_get_public_profile(text)'::regprocedure))),
  0,
  'public profile RPC does not join user_entries directly'
);

select is(
  position('join public.user_entries' in lower(pg_get_functiondef('public.task17_get_public_work(uuid,text)'::regprocedure))),
  0,
  'public work RPC does not join user_entries directly'
);

reset role;

select * from finish();

rollback;

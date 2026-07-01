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
  '00000000-0000-0000-0000-00000000aa15',
  'authenticated',
  'authenticated',
  'task15-owner@example.com',
  'test-password-hash',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"username":"task15_owner","display_name":"Task15 Owner"}'::jsonb
),
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-00000000bb15',
  'authenticated',
  'authenticated',
  'task15-other@example.com',
  'test-password-hash',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"username":"task15_other","display_name":"Task15 Other"}'::jsonb
);

set local role authenticated;
select public._set_auth_user('00000000-0000-0000-0000-00000000aa15');

select is(
  public.task15_create_movie_entry_from_provider(
    'tmdb',
    '27205',
    'Inception',
    'watched',
    45,
    2010,
    'Inception',
    'en',
    'A thief who steals corporate secrets through dream-sharing technology.',
    'https://image.tmdb.org/t/p/w500/inception.jpg',
    148,
    '[{"source":"tmdb","external_id":"27205","source_url":"https://www.themoviedb.org/movie/27205"}]'::jsonb
  ) ->> 'status',
  'created',
  'tmdb movie add creates an entry'
);

select is(
  (
    select w.media_type
    from public.user_entries e
    join public.works w on w.id = e.work_id
    where w.canonical_title = 'Inception'
    limit 1
  ),
  'movie',
  'provider movie add creates a movie work'
);

select results_eq(
  $$
    select e.status, e.rating_x10
    from public.user_entries e
    join public.works w on w.id = e.work_id
    where w.canonical_title = 'Inception'
  $$,
  $$ values ('watched'::text, 45::integer) $$,
  'provider movie entry stores status and rating'
);

select is(
  (
    select e.runtime_minutes
    from public.editions e
    join public.works w on w.id = e.work_id
    where w.canonical_title = 'Inception'
      and e.is_default
    limit 1
  ),
  148,
  'provider movie add stores runtime on default edition'
);

select is(
  (
    select count(*)::integer
    from public.private_activity_log pal
    where pal.event_type = 'entry_created'
      and pal.imported = false
  ),
  1,
  'entry_created activity is recorded for movie add'
);

select is(
  public.task15_create_movie_entry_from_provider(
    'tmdb',
    '27205',
    'Inception',
    'watching',
    40,
    2010,
    null,
    'en',
    null,
    null,
    148,
    '[{"source":"tmdb","external_id":"27205"}]'::jsonb
  ) ->> 'status',
  'already_exists',
  'adding the same tmdb movie does not create a duplicate active entry'
);

select throws_ok(
  $$ select public.task15_create_movie_entry_from_provider(
    'openlibrary',
    'OL-TASK15',
    'Wrong Provider',
    'want_to_watch',
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    '[]'::jsonb
  ) $$,
  '23514',
  null,
  'book providers are rejected by the movie add RPC'
);

select throws_ok(
  $$ select public.task15_create_movie_entry_from_provider(
    'tmdb',
    '999',
    'Bad Rating',
    'watched',
    44,
    2020,
    null,
    null,
    null,
    null,
    null,
    '[]'::jsonb
  ) $$,
  '23514',
  null,
  'rating_x10 must respect the P0 five-point step'
);

select public._set_auth_user('00000000-0000-0000-0000-00000000bb15');

select is(
  (
    select count(*)::integer
    from public.user_entries e
    join public.works w on w.id = e.work_id
    where w.canonical_title = 'Inception'
  ),
  0,
  'other authenticated user cannot read owner movie entry'
);

select public._set_auth_user(null);
set local role anon;

select throws_ok(
  $$ select public.task15_create_movie_entry_from_provider(
    'tmdb',
    '27205',
    'Inception',
    'want_to_watch',
    null,
    2010,
    null,
    'en',
    null,
    null,
    null,
    '[]'::jsonb
  ) $$,
  '42501',
  null,
  'anonymous users cannot add provider movies'
);

reset role;

select * from finish();

rollback;

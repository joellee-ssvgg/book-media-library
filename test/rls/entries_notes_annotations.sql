begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(36);

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
  '00000000-0000-0000-0000-00000000aaa7',
  'authenticated',
  'authenticated',
  'task07-owner@example.com',
  'test-password-hash',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"username":"task07_owner","display_name":"Task07 Owner"}'::jsonb
),
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-00000000bbb7',
  'authenticated',
  'authenticated',
  'task07-other@example.com',
  'test-password-hash',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"username":"task07_other","display_name":"Task07 Other"}'::jsonb
);

select is(
  (select count(*)::integer from public.profiles where username in ('task07_owner', 'task07_other')),
  2,
  'task07 auth users create profiles'
);

set local role authenticated;
select public._set_auth_user('00000000-0000-0000-0000-00000000aaa7');

select lives_ok(
  $$ select public.create_manual_work('book', 'Task07 Book', 2026, null, 'zh', null, null, false, null) $$,
  'owner creates a book work'
);

select lives_ok(
  $$ select public.create_manual_work('movie', 'Task07 Movie', 2026, null, 'en', null, null, false, null) $$,
  'owner creates a movie work'
);

select lives_ok(
  $$ insert into public.user_entries (
       work_id,
       edition_id,
       status,
       rating_x10,
       review,
       visibility_scope,
       field_visibility_json,
       started_at,
       finished_at
     )
     select
       w.id,
       e.id,
       'finished',
       45,
       'owner review should stay masked',
       'public',
       '{"rating_x10":"public","review":"private"}'::jsonb,
       now() - interval '2 days',
       now() - interval '1 day'
     from public.works w
     join public.editions e on e.work_id = w.id and e.is_default
     where w.canonical_title = 'Task07 Book'
     limit 1 $$,
  'owner inserts a public book entry'
);

select is(
  (select profile_id from public.user_entries where status = 'finished' limit 1),
  public.current_profile_id(),
  'entry profile_id is forced to current profile'
);

select is(
  (select rating_x10 from public.public_entries_v where status = 'finished' limit 1),
  45,
  'public entry view exposes public rating field'
);

select is(
  (select review from public.public_entries_v where status = 'finished' limit 1),
  null,
  'public entry view masks private review field'
);

select ok(
  position(
    'private_notes' in lower((select definition from pg_views where schemaname = 'public' and viewname = 'public_entries_v'))
  ) = 0,
  'public entry view does not reference private notes'
);

select throws_ok(
  $$ insert into public.user_entries (
       work_id,
       edition_id,
       status,
       rating_x10
     )
     select w.id, e.id, 'reading', 43
     from public.works w
     join public.editions e on e.work_id = w.id and e.is_default
     where w.canonical_title = 'Task07 Book'
     limit 1 $$,
  '23514',
  null,
  'rating_x10 rejects values outside five-point steps'
);

select throws_ok(
  $$ insert into public.user_entries (
       work_id,
       edition_id,
       status
     )
     select w.id, e.id, 'watching'
     from public.works w
     join public.editions e on e.work_id = w.id and e.is_default
     where w.canonical_title = 'Task07 Book'
     limit 1 $$,
  '23514',
  null,
  'book entry rejects movie-only status'
);

select throws_ok(
  $$ insert into public.user_entries (
       work_id,
       edition_id,
       status
     )
     select w.id, e.id, 'reading'
     from public.works w
     join public.editions e on e.work_id = w.id and e.is_default
     where w.canonical_title = 'Task07 Book'
     limit 1 $$,
  '23505',
  null,
  'one active entry per profile and work is enforced'
);

select lives_ok(
  $$ update public.user_entries set rating_x10 = 50 where status = 'finished' $$,
  'owner updates own entry'
);

select is(
  (select rating_x10 from public.user_entries where status = 'finished' limit 1),
  50,
  'owner update persists entry rating'
);

select throws_ok(
  $$ delete from public.user_entries where status = 'finished' $$,
  '42501',
  null,
  'direct entry delete is not granted'
);

select lives_ok(
  $$ insert into public.user_private_notes(entry_id, note)
     select id, 'private synthesis only owner can read'
     from public.user_entries
     where status = 'finished'
     limit 1 $$,
  'owner inserts private note for own entry'
);

select is(
  (select count(*)::integer from public.user_private_notes where note like 'private synthesis%'),
  1,
  'owner can read own private note'
);

select throws_ok(
  $$ insert into public.user_private_notes(entry_id, note)
     select id, 'duplicate private note'
     from public.user_entries
     where status = 'finished'
     limit 1 $$,
  '23505',
  null,
  'one private note per entry is enforced'
);

select lives_ok(
  $$ update public.user_private_notes set note = 'private synthesis updated' $$,
  'owner updates own private note'
);

select throws_ok(
  $$ delete from public.user_private_notes $$,
  '42501',
  null,
  'direct private note delete is not granted'
);

select lives_ok(
  $$ insert into public.annotations(entry_id, kind, content, location_json, visibility_scope)
     select id, 'highlight', 'book highlight', '{"type":"book","page":10}'::jsonb, 'public'
     from public.user_entries
     where status = 'finished'
     limit 1 $$,
  'owner inserts valid book annotation'
);

select throws_ok(
  $$ insert into public.annotations(entry_id, kind, content, location_json)
     select id, 'note', 'bad location', '{"type":"video","timestamp_seconds":10}'::jsonb
     from public.user_entries
     where status = 'finished'
     limit 1 $$,
  '23514',
  null,
  'book annotation rejects video location'
);

select lives_ok(
  $$ insert into public.user_entries (
       work_id,
       edition_id,
       status,
       visibility_scope,
       field_visibility_json
     )
     select
       w.id,
       e.id,
       'watched',
       'public',
       '{}'::jsonb
     from public.works w
     join public.editions e on e.work_id = w.id and e.is_default
     where w.canonical_title = 'Task07 Movie'
     limit 1 $$,
  'owner inserts movie entry'
);

select lives_ok(
  $$ insert into public.annotations(entry_id, kind, content, location_json, visibility_scope)
     select id, 'note', 'movie timestamp note', '{"type":"video","timestamp_seconds":120.5}'::jsonb, 'private'
     from public.user_entries
     where status = 'watched'
     limit 1 $$,
  'owner inserts valid movie annotation'
);

select throws_ok(
  $$ insert into public.annotations(entry_id, kind, content, location_json)
     select id, 'quote', 'bad movie location', '{"type":"book","page":3}'::jsonb
     from public.user_entries
     where status = 'watched'
     limit 1 $$,
  '23514',
  null,
  'movie annotation rejects book location'
);

select is(
  (select count(*)::integer from public.annotations),
  2,
  'owner sees own public and private annotations'
);

select public._set_auth_user('00000000-0000-0000-0000-00000000bbb7');

select is(
  (select count(*)::integer from public.user_entries),
  0,
  'other authenticated user cannot read owner entries from base table'
);

select is(
  (select count(*)::integer from public.public_entries_v),
  2,
  'other authenticated user can read public entries through masked view'
);

select is(
  (select count(*)::integer from public.user_private_notes),
  0,
  'other authenticated user cannot read owner private notes'
);

select is(
  (select count(*)::integer from public.annotations),
  1,
  'other authenticated user sees only public annotation'
);

select throws_ok(
  $$ insert into public.user_private_notes(entry_id, note)
     values ((select id from public.public_entries_v where status = 'finished' limit 1), 'other note') $$,
  '42501',
  null,
  'other authenticated user cannot attach private note to owner entry'
);

select lives_ok(
  $$
    do $do$
    declare
      affected_rows integer;
    begin
      update public.user_entries
      set rating_x10 = 35
      where id = (select id from public.public_entries_v where status = 'finished' limit 1);

      get diagnostics affected_rows = row_count;

      if affected_rows <> 0 then
        raise exception 'other user updated owner entry';
      end if;
    end
    $do$
  $$,
  'other authenticated user cannot update owner entry'
);

select public._set_auth_user(null);
set local role anon;

select throws_ok(
  $$ select count(*) from public.user_entries $$,
  '42501',
  null,
  'anonymous user has no direct entry table access'
);

select is(
  (select count(*)::integer from public.public_entries_v),
  2,
  'anonymous user can read public entries through masked view'
);

select throws_ok(
  $$ select count(*) from public.user_private_notes $$,
  '42501',
  null,
  'anonymous user has no private note table access'
);

select is(
  (select count(*)::integer from public.annotations),
  1,
  'anonymous user sees only public annotation'
);

select throws_ok(
  $$ insert into public.annotations(entry_id, kind, location_json)
     values ((select id from public.public_entries_v where status = 'finished' limit 1), 'note', '{"type":"book","page":1}'::jsonb) $$,
  '42501',
  null,
  'anonymous user cannot create annotation'
);

select * from finish();

rollback;

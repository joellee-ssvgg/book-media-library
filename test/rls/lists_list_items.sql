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
  '00000000-0000-0000-0000-00000000aa11',
  'authenticated',
  'authenticated',
  'task11-owner@example.com',
  'test-password-hash',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"username":"task11_owner","display_name":"Task11 Owner"}'::jsonb
),
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-00000000bb11',
  'authenticated',
  'authenticated',
  'task11-other@example.com',
  'test-password-hash',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"username":"task11_other","display_name":"Task11 Other"}'::jsonb
);

select is(
  (select count(*)::integer from public.profiles where username in ('task11_owner', 'task11_other')),
  2,
  'task11 auth users create profiles'
);

select is(
  (
    select count(*)::integer
    from information_schema.tables
    where table_schema = 'public'
      and table_name in ('lists', 'list_items')
  ),
  2,
  'Task11 creates the two schema-only list tables'
);

set local role authenticated;
select public._set_auth_user('00000000-0000-0000-0000-00000000aa11');

select lives_ok(
  $$ select public.create_manual_work('book', 'Task11 Entry Book', 2026, null, 'zh', null, null, false, null) $$,
  'owner creates a book work for entry-backed list item'
);

select lives_ok(
  $$ select public.create_manual_work('book', 'Task11 Work Only Book', 2026, null, 'zh', null, null, false, null) $$,
  'owner creates a book work for work-only list item'
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
       '00000000-0000-0000-0000-000000110901'::uuid,
       w.id,
       e.id,
       'reading',
       'public',
       '{"rating":"public"}'::jsonb
     from public.works w
     join public.editions e on e.work_id = w.id and e.is_default
     where w.canonical_title = 'Task11 Entry Book'
     limit 1 $$,
  'owner inserts an entry for list item validation'
);

select lives_ok(
  $$ insert into public.lists (
       id,
       title,
       description,
       visibility_scope,
       ordered,
       cover_strategy
     )
     values (
       '00000000-0000-0000-0000-000000110001'::uuid,
       '  My   P0   List  ',
       '  schema only  ',
       'public',
       true,
       'first_n'
     ) $$,
  'owner inserts a list row directly through RLS'
);

select is(
  (select title from public.lists where id = '00000000-0000-0000-0000-000000110001'::uuid),
  'My P0 List',
  'list trigger normalizes title whitespace'
);

select is(
  (select profile_id from public.lists where id = '00000000-0000-0000-0000-000000110001'::uuid),
  public.current_profile_id(),
  'list trigger stamps current owner profile'
);

select lives_ok(
  $$ insert into public.list_items (
       id,
       list_id,
       entry_id,
       work_id,
       position,
       note
     )
     values (
       '00000000-0000-0000-0000-000000110101'::uuid,
       '00000000-0000-0000-0000-000000110001'::uuid,
       '00000000-0000-0000-0000-000000110901'::uuid,
       null,
       1,
       '  entry backed item  '
     ) $$,
  'owner inserts entry-backed list item; trigger fills work_id'
);

select is(
  (
    select li.work_id
    from public.list_items li
    where li.id = '00000000-0000-0000-0000-000000110101'::uuid
  ),
  (select work_id from public.user_entries where id = '00000000-0000-0000-0000-000000110901'::uuid),
  'entry-backed list item stores matching work_id'
);

select is(
  (select note from public.list_items where id = '00000000-0000-0000-0000-000000110101'::uuid),
  'entry backed item',
  'list item trigger normalizes note whitespace'
);

select lives_ok(
  $$ insert into public.list_items (
       id,
       list_id,
       work_id,
       position,
       note
     )
     select
       '00000000-0000-0000-0000-000000110102'::uuid,
       '00000000-0000-0000-0000-000000110001'::uuid,
       w.id,
       2,
       null
     from public.works w
     where w.canonical_title = 'Task11 Work Only Book'
     limit 1 $$,
  'owner inserts work-only list item'
);

select is(
  (select count(*)::integer from public.list_items where list_id = '00000000-0000-0000-0000-000000110001'::uuid),
  2,
  'owner sees both own list items'
);

select throws_ok(
  $$ insert into public.list_items (
       list_id,
       entry_id,
       work_id,
       position
     )
     select
       '00000000-0000-0000-0000-000000110001'::uuid,
       '00000000-0000-0000-0000-000000110901'::uuid,
       w.id,
       3
     from public.works w
     where w.canonical_title = 'Task11 Work Only Book'
     limit 1 $$,
  '23514',
  null,
  'entry-backed list item rejects mismatched work_id'
);

select throws_ok(
  $$ insert into public.list_items (
       list_id,
       work_id,
       position
     )
     select
       '00000000-0000-0000-0000-000000110001'::uuid,
       w.id,
       2
     from public.works w
     where w.canonical_title = 'Task11 Work Only Book'
     limit 1 $$,
  '23505',
  null,
  'list item positions are unique within an active list'
);

select lives_ok(
  $$ update public.lists
     set title = 'Updated P0 List', cover_strategy = 'manual'
     where id = '00000000-0000-0000-0000-000000110001'::uuid $$,
  'owner updates list metadata directly through RLS'
);

select is(
  (select row_version from public.lists where id = '00000000-0000-0000-0000-000000110001'::uuid),
  2,
  'list row_version increments on update'
);

select lives_ok(
  $$ update public.list_items
     set note = 'updated note'
     where id = '00000000-0000-0000-0000-000000110102'::uuid $$,
  'owner updates list item note directly through RLS'
);

select is(
  (select row_version from public.list_items where id = '00000000-0000-0000-0000-000000110102'::uuid),
  2,
  'list item row_version increments on update'
);

select throws_ok(
  $$ delete from public.lists where id = '00000000-0000-0000-0000-000000110001'::uuid $$,
  '42501',
  null,
  'direct list delete is not granted'
);

select public._set_auth_user('00000000-0000-0000-0000-00000000bb11');

select is(
  (select count(*)::integer from public.lists),
  0,
  'other authenticated user cannot read owner lists'
);

select is(
  (select count(*)::integer from public.list_items),
  0,
  'other authenticated user cannot read owner list items'
);

select throws_ok(
  $$ insert into public.list_items (
       list_id,
       work_id,
       position
     )
     select
       '00000000-0000-0000-0000-000000110001'::uuid,
       w.id,
       10
     from public.works w
     where w.canonical_title = 'Task11 Work Only Book'
     limit 1 $$,
  '42501',
  null,
  'other authenticated user cannot insert into owner list'
);

select lives_ok(
  $$ insert into public.lists (
       id,
       profile_id,
       title,
       visibility_scope
     )
     values (
       '00000000-0000-0000-0000-000000110002'::uuid,
       '00000000-0000-0000-0000-00000000aa11'::uuid,
       'Spoofed owner list',
       'private'
     ) $$,
  'list insert cannot spoof profile_id because trigger stamps current user'
);

select is(
  (select profile_id from public.lists where id = '00000000-0000-0000-0000-000000110002'::uuid),
  public.current_profile_id(),
  'spoofed profile_id is overwritten by trigger'
);

select public._set_auth_user(null);
set local role anon;

select throws_ok(
  $$ select count(*) from public.lists $$,
  '42501',
  null,
  'anonymous user cannot read lists directly even when visibility_scope is public'
);

select throws_ok(
  $$ select count(*) from public.list_items $$,
  '42501',
  null,
  'anonymous user cannot read list_items directly in P0 schema-only phase'
);

select * from finish();

rollback;

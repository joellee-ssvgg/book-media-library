begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(37);

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
  '00000000-0000-0000-0000-00000000aaa8',
  'authenticated',
  'authenticated',
  'task08-owner@example.com',
  'test-password-hash',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"username":"task08_owner","display_name":"Task08 Owner"}'::jsonb
),
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-00000000bbb8',
  'authenticated',
  'authenticated',
  'task08-other@example.com',
  'test-password-hash',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"username":"task08_other","display_name":"Task08 Other"}'::jsonb
);

select is(
  (select count(*)::integer from public.profiles where username in ('task08_owner', 'task08_other')),
  2,
  'task08 auth users create profiles'
);

set local role authenticated;
select public._set_auth_user('00000000-0000-0000-0000-00000000aaa8');

select lives_ok(
  $$ select public.create_manual_work('book', 'Task08 Book', 2026, null, 'zh', null, null, false, null) $$,
  'owner creates a book work'
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
       '00000000-0000-0000-0000-000000070801'::uuid,
       w.id,
       e.id,
       'finished',
       'public',
       '{"tags":"public"}'::jsonb
     from public.works w
     join public.editions e on e.work_id = w.id and e.is_default
     where w.canonical_title = 'Task08 Book'
     limit 1 $$,
  'owner inserts an entry for tagging'
);

select lives_ok(
  $$ insert into public.annotations (
       id,
       entry_id,
       kind,
       content,
       location_json,
       visibility_scope
     )
     values (
       '00000000-0000-0000-0000-000000070802'::uuid,
       '00000000-0000-0000-0000-000000070801'::uuid,
       'highlight',
       'taggable highlight',
       '{"type":"book","page":8}'::jsonb,
       'public'
     ) $$,
  'owner inserts an annotation for tagging'
);

select lives_ok(
  $$ insert into public.tags(id, name, color)
     values ('00000000-0000-0000-0000-000000080801'::uuid, '技术书', '#3366CC') $$,
  'owner inserts a manual tag'
);

select is(
  (select profile_id from public.tags where id = '00000000-0000-0000-0000-000000080801'::uuid),
  public.current_profile_id(),
  'tag profile_id is forced to current profile'
);

select is(
  (select source from public.tags where id = '00000000-0000-0000-0000-000000080801'::uuid),
  'manual',
  'tag source defaults to manual'
);

select throws_ok(
  $$ insert into public.tags(name, source) values ('坏来源', 'external') $$,
  '23514',
  null,
  'tag source rejects unknown values'
);

select throws_ok(
  $$ insert into public.tags(name) values (' 技术书 ') $$,
  '23505',
  null,
  'tag names are unique per profile after normalization'
);

select lives_ok(
  $$ insert into public.tags(id, name, source)
     values ('00000000-0000-0000-0000-000000080802'::uuid, '重读', 'manual') $$,
  'owner inserts a second tag for merge testing'
);

select lives_ok(
  $$ insert into public.entry_tags(entry_id, tag_id)
     values (
       '00000000-0000-0000-0000-000000070801'::uuid,
       '00000000-0000-0000-0000-000000080801'::uuid
     ) $$,
  'owner tags own entry'
);

select lives_ok(
  $$ insert into public.annotation_tags(annotation_id, tag_id)
     values (
       '00000000-0000-0000-0000-000000070802'::uuid,
       '00000000-0000-0000-0000-000000080801'::uuid
     ) $$,
  'owner tags own annotation'
);

select is(
  (select count(*)::integer from public.entry_tags),
  1,
  'owner reads own entry tag'
);

select is(
  (select count(*)::integer from public.annotation_tags),
  1,
  'owner reads own annotation tag'
);

select throws_ok(
  $$ delete from public.tags where id = '00000000-0000-0000-0000-000000080801'::uuid $$,
  '42501',
  null,
  'direct tag delete is not granted'
);

select lives_ok(
  $$ update public.tags
     set name = '技术书改名', color = '#224466'
     where id = '00000000-0000-0000-0000-000000080801'::uuid $$,
  'owner updates own tag name and color'
);

select is(
  (select name from public.tags where id = '00000000-0000-0000-0000-000000080801'::uuid),
  '技术书改名',
  'owner tag update persists normalized name'
);

select lives_ok(
  $$ insert into public.entry_tags(entry_id, tag_id)
     values (
       '00000000-0000-0000-0000-000000070801'::uuid,
       '00000000-0000-0000-0000-000000080802'::uuid
     ) $$,
  'owner adds source tag to entry before merge'
);

select lives_ok(
  $$ insert into public.annotation_tags(annotation_id, tag_id)
     values (
       '00000000-0000-0000-0000-000000070802'::uuid,
       '00000000-0000-0000-0000-000000080802'::uuid
     ) $$,
  'owner adds source tag to annotation before merge'
);

select is(
  public.merge_tag_into(
    '00000000-0000-0000-0000-000000080802'::uuid,
    '00000000-0000-0000-0000-000000080801'::uuid
  ) ->> 'merged_to',
  '00000000-0000-0000-0000-000000080801',
  'merge_tag_into returns the canonical target'
);

select is(
  (select canonical_tag_id from public.tags where id = '00000000-0000-0000-0000-000000080802'::uuid),
  '00000000-0000-0000-0000-000000080801'::uuid,
  'source tag records canonical_tag_id after merge'
);

select is(
  (select count(*)::integer from public.entry_tags where tag_id = '00000000-0000-0000-0000-000000080802'::uuid),
  0,
  'merge removes active source entry links'
);

select is(
  (select count(*)::integer from public.annotation_tags where tag_id = '00000000-0000-0000-0000-000000080802'::uuid),
  0,
  'merge removes active source annotation links'
);

select is(
  (select count(*)::integer from public.entry_tags where tag_id = '00000000-0000-0000-0000-000000080801'::uuid),
  1,
  'merge keeps one canonical entry link'
);

select is(
  (select count(*)::integer from public.annotation_tags where tag_id = '00000000-0000-0000-0000-000000080801'::uuid),
  1,
  'merge keeps one canonical annotation link'
);

select throws_ok(
  $$ select public.merge_tag_into(
       '00000000-0000-0000-0000-000000080801'::uuid,
       '00000000-0000-0000-0000-000000080801'::uuid
     ) $$,
  '23514',
  null,
  'merge rejects self merge'
);

select public._set_auth_user('00000000-0000-0000-0000-00000000bbb8');

select lives_ok(
  $$ insert into public.tags(id, name)
     values ('00000000-0000-0000-0000-000000080803'::uuid, '技术书改名') $$,
  'other user can reuse the same tag name in own namespace'
);

select is(
  (select count(*)::integer from public.tags),
  1,
  'other authenticated user reads only own tags'
);

select is(
  (select count(*)::integer from public.entry_tags),
  0,
  'other authenticated user cannot read owner entry tags'
);

select is(
  (select count(*)::integer from public.annotation_tags),
  0,
  'other authenticated user cannot read owner annotation tags'
);

select throws_ok(
  $$ insert into public.entry_tags(entry_id, tag_id)
     values (
       '00000000-0000-0000-0000-000000070801'::uuid,
       '00000000-0000-0000-0000-000000080803'::uuid
     ) $$,
  '42501',
  null,
  'other authenticated user cannot tag owner entry'
);

select throws_ok(
  $$ insert into public.annotation_tags(annotation_id, tag_id)
     values (
       '00000000-0000-0000-0000-000000070802'::uuid,
       '00000000-0000-0000-0000-000000080803'::uuid
     ) $$,
  '42501',
  null,
  'other authenticated user cannot tag owner annotation'
);

select throws_ok(
  $$ select public.merge_tag_into(
       '00000000-0000-0000-0000-000000080802'::uuid,
       '00000000-0000-0000-0000-000000080803'::uuid
     ) $$,
  '42501',
  null,
  'other authenticated user cannot merge owner tag'
);

select public._set_auth_user(null);
set local role anon;

select throws_ok(
  $$ select count(*) from public.tags $$,
  '42501',
  null,
  'anonymous user has no direct tags access'
);

select throws_ok(
  $$ select count(*) from public.entry_tags $$,
  '42501',
  null,
  'anonymous user has no direct entry_tags access'
);

select throws_ok(
  $$ select count(*) from public.annotation_tags $$,
  '42501',
  null,
  'anonymous user has no direct annotation_tags access'
);

select throws_ok(
  $$ insert into public.tags(name) values ('anon-tag') $$,
  '42501',
  null,
  'anonymous user cannot create tags'
);

select * from finish();

rollback;

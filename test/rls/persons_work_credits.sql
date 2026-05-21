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

select is(
  (
    select count(*)::integer
    from information_schema.tables
    where table_schema = 'public'
      and table_name in ('persons', 'work_credits')
  ),
  2,
  'task04 creates persons and work_credits tables'
);

select is(
  (
    select count(*)::integer
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'persons'
      and column_name in ('canonical_name', 'original_name', 'disambiguation', 'localized_names_json', 'name_variants_json', 'bio_json')
  ),
  6,
  'persons exposes v6 identity and localization fields'
);

select is(
  (
    select count(*)::integer
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'work_credits'
      and column_name in ('work_id', 'person_id', 'role', 'character_name', 'billing_order', 'uncredited')
  ),
  6,
  'work_credits exposes v6 credit fields'
);

select is(
  (
    select count(*)::integer
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'work_credits'
      and indexname in ('idx_work_credits_work_role', 'idx_work_credits_person_role')
  ),
  2,
  'work_credits has required work-role and person-role indexes'
);

select is(
  (
    select count(*)::integer
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'series'
      and constraint_name = 'series_primary_creator_id_fkey'
      and constraint_type = 'FOREIGN KEY'
  ),
  1,
  'task04 adds series.primary_creator_id foreign key to persons'
);

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
  '00000000-0000-0000-0000-00000000aaa4',
  'authenticated',
  'authenticated',
  'task04-owner@example.com',
  'test-password-hash',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"username":"task04_owner","display_name":"Task04 Owner"}'::jsonb
),
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-00000000bbb4',
  'authenticated',
  'authenticated',
  'task04-other@example.com',
  'test-password-hash',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"username":"task04_other","display_name":"Task04 Other"}'::jsonb
);

select is(
  (select count(*)::integer from public.profiles where username in ('task04_owner', 'task04_other')),
  2,
  'task04 auth users create profiles'
);

set local role authenticated;
select public._set_auth_user('00000000-0000-0000-0000-00000000aaa4');

select is(
  public.create_manual_work('book', '沙丘', 1965, null, 'zh', null, null, false, null) ->> 'status',
  'created',
  'owner creates a work before adding credits'
);

select lives_ok(
  $$ insert into public.persons(
       canonical_name,
       original_name,
       disambiguation,
       localized_names_json,
       name_variants_json,
       bio_json
     )
     values (
       '  弗兰克   赫伯特  ',
       'Frank Herbert',
       '美国科幻作家',
       '{"en":"Frank Herbert","zh-CN":"弗兰克·赫伯特"}'::jsonb,
       '["Franklin Patrick Herbert Jr."]'::jsonb,
       '{"summary":"Dune author"}'::jsonb
     ) $$,
  'owner can insert a person'
);

select is(
  (select canonical_name || ':' || original_name from public.persons where original_name = 'Frank Herbert'),
  '弗兰克 赫伯特:Frank Herbert',
  'person trigger normalizes display names'
);

select is(
  (
    select localized_names_json ->> 'en'
    from public.persons
    where original_name = 'Frank Herbert'
  ),
  'Frank Herbert',
  'person stores localized names json'
);

select lives_ok(
  $$ insert into public.work_credits(work_id, person_id, role, billing_order)
     values (
       (select id from public.works where canonical_title = '沙丘' limit 1),
       (select id from public.persons where original_name = 'Frank Herbert'),
       'author',
       1
     ) $$,
  'owner can insert an author credit'
);

select is(
  (
    select role || ':' || billing_order::text || ':' || (created_by = (select public.current_profile_id()))::text
    from public.work_credits
    where role = 'author'
  ),
  'author:1:true',
  'work credit stores role, order, and audit profile'
);

select throws_ok(
  $$ insert into public.work_credits(work_id, person_id, role)
     values (
       (select id from public.works where canonical_title = '沙丘' limit 1),
       (select id from public.persons where original_name = 'Frank Herbert'),
       'producer'
     ) $$,
  '23514',
  null,
  'work_credits rejects unsupported roles'
);

select throws_ok(
  $$ insert into public.work_credits(work_id, person_id, role, billing_order)
     values (
       (select id from public.works where canonical_title = '沙丘' limit 1),
       (select id from public.persons where original_name = 'Frank Herbert'),
       'translator',
       0
     ) $$,
  '23514',
  null,
  'work_credits rejects non-positive billing order'
);

select throws_ok(
  $$ insert into public.persons(canonical_name) values ('   ') $$,
  '23514',
  null,
  'persons rejects blank canonical names'
);

select throws_ok(
  $$ insert into public.persons(canonical_name, localized_names_json)
     values ('Invalid JSON Shape', '[]'::jsonb) $$,
  '23514',
  null,
  'persons requires localized_names_json to be an object'
);

select lives_ok(
  $$ insert into public.external_ids(target_type, target_id, source, external_id)
     values (
       'person',
       (select id from public.persons where original_name = 'Frank Herbert'),
       'wikidata',
       'Q172168'
     ) $$,
  'owner can attach external id to a person'
);

select throws_ok(
  $$ insert into public.external_ids(target_type, target_id, source, external_id)
     values (
       'person',
       (select id from public.works where canonical_title = '沙丘' limit 1),
       'wikidata',
       'not-a-person'
     ) $$,
  '23503',
  null,
  'person external id requires an existing person target'
);

select is(
  (select count(*)::integer from public.external_ids where target_type = 'person' and external_id = 'Q172168'),
  1,
  'owner can read person external id'
);

select lives_ok(
  $$ insert into public.series(name, series_type, ordering_method, primary_creator_id)
     values (
       '沙丘宇宙',
       'saga',
       'publication',
       (select id from public.persons where original_name = 'Frank Herbert')
     ) $$,
  'owner can insert a series with primary creator'
);

select isnt(
  (select primary_creator_id from public.series where name = '沙丘宇宙'),
  null::uuid,
  'series stores primary_creator_id after Task04 foreign key'
);

select throws_ok(
  $$ insert into public.series(name, primary_creator_id)
     values ('孤儿系列', '00000000-0000-0000-0000-000000000404') $$,
  '23503',
  null,
  'series.primary_creator_id rejects missing person references'
);

select public._set_auth_user('00000000-0000-0000-0000-00000000bbb4');

select is(
  (select count(*)::integer from public.persons where original_name = 'Frank Herbert'),
  1,
  'other authenticated user can read public persons'
);

select is(
  (select count(*)::integer from public.work_credits where role = 'author'),
  1,
  'other authenticated user can read public work credits'
);

select is(
  (select count(*)::integer from public.external_ids where target_type = 'person' and external_id = 'Q172168'),
  1,
  'other authenticated user can read public person external ids'
);

select throws_ok(
  $$ insert into public.work_credits(work_id, person_id, role, billing_order)
     values (
       (select id from public.works where canonical_title = '沙丘' limit 1),
       (select id from public.persons where original_name = 'Frank Herbert'),
       'translator',
       2
     ) $$,
  '42501',
  null,
  'other authenticated user cannot credit owner work and person'
);

select throws_ok(
  $$ insert into public.external_ids(target_type, target_id, source, external_id)
     values (
       'person',
       (select id from public.persons where original_name = 'Frank Herbert'),
       'local',
       'other-person-id'
     ) $$,
  '42501',
  null,
  'other authenticated user cannot attach external id to owner person'
);

select public._set_auth_user(null);
set local role anon;

select is(
  (select count(*)::integer from public.persons where original_name = 'Frank Herbert'),
  1,
  'anonymous user can read public persons'
);

select is(
  (select count(*)::integer from public.work_credits where role = 'author'),
  1,
  'anonymous user can read public work credits'
);

select is(
  (select count(*)::integer from public.external_ids where target_type = 'person' and external_id = 'Q172168'),
  1,
  'anonymous user can read public person external ids'
);

select throws_ok(
  $$ insert into public.persons(canonical_name) values ('Anonymous Person') $$,
  '42501',
  null,
  'anonymous user cannot insert persons'
);

select throws_ok(
  $$ insert into public.work_credits(work_id, person_id, role)
     values (
       (select id from public.works where canonical_title = '沙丘' limit 1),
       (select id from public.persons where original_name = 'Frank Herbert'),
       'author'
     ) $$,
  '42501',
  null,
  'anonymous user cannot insert work credits'
);

set local role authenticated;
select public._set_auth_user('00000000-0000-0000-0000-00000000aaa4');

select throws_ok(
  $$ update public.persons
     set canonical_name = 'Frank Herbert Edited'
     where original_name = 'Frank Herbert' $$,
  '42501',
  null,
  'owner cannot update persons in Task04'
);

select throws_ok(
  $$ update public.work_credits
     set billing_order = 2
     where role = 'author' $$,
  '42501',
  null,
  'owner cannot update work credits in Task04'
);

select throws_ok(
  $$ delete from public.persons where original_name = 'Frank Herbert' $$,
  '42501',
  null,
  'owner cannot delete persons in Task04'
);

select throws_ok(
  $$ delete from public.work_credits where role = 'author' $$,
  '42501',
  null,
  'owner cannot delete work credits in Task04'
);

select is(
  (
    select count(*)::integer
    from public.work_credits wc
    join public.works w on w.id = wc.work_id
    join public.persons p on p.id = wc.person_id
    where w.canonical_title = '沙丘'
      and p.original_name = 'Frank Herbert'
  ),
  1,
  'work_credits joins works to persons for provider credits'
);

reset role;

select * from finish();

rollback;

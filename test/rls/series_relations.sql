begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(32);

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
      and table_name in ('series', 'work_series', 'work_relations')
  ),
  3,
  'task03 creates the series relation tables'
);

select is(
  (
    select count(*)::integer
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'work_relations'
      and column_name in ('created_by', 'created_source')
  ),
  2,
  'work_relations keeps audit created_by and separate created_source'
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
  '00000000-0000-0000-0000-00000000aaa3',
  'authenticated',
  'authenticated',
  'task03-owner@example.com',
  'test-password-hash',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"username":"task03_owner","display_name":"Task03 Owner"}'::jsonb
),
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-00000000bbb3',
  'authenticated',
  'authenticated',
  'task03-other@example.com',
  'test-password-hash',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"username":"task03_other","display_name":"Task03 Other"}'::jsonb
);

select is(
  (select count(*)::integer from public.profiles where username in ('task03_owner', 'task03_other')),
  2,
  'task03 auth users create profiles'
);

set local role authenticated;
select public._set_auth_user('00000000-0000-0000-0000-00000000aaa3');

select is(
  public.create_manual_work('book', '沙丘', 1965, null, 'zh', null, null, false, null) ->> 'status',
  'created',
  'owner creates first work for series tests'
);

select is(
  public.create_manual_work('book', '沙丘救世主', 1969, null, 'zh', null, null, false, null) ->> 'status',
  'created',
  'owner creates second work for relation tests'
);

select is(
  public.create_manual_work('book', '沙丘之子', 1976, null, 'zh', null, null, false, null) ->> 'status',
  'created',
  'owner creates third work for RLS negative tests'
);

select lives_ok(
  $$ insert into public.series(name, localized_names_json, series_type, ordering_method)
     values ('沙丘宇宙', '{"en":"Dune Universe"}'::jsonb, 'saga', 'publication') $$,
  'owner can insert a parent series'
);

select is(
  (select series_type || ':' || ordering_method from public.series where name = '沙丘宇宙'),
  'saga:publication',
  'series stores v6 type and ordering fields'
);

select lives_ok(
  $$ insert into public.series(name, series_type, ordering_method, parent_series_id)
     values (
       '沙丘原六部',
       'saga',
       'reading_order',
       (select id from public.series where name = '沙丘宇宙')
     ) $$,
  'owner can insert a child series'
);

select isnt(
  (select parent_series_id from public.series where name = '沙丘原六部'),
  null::uuid,
  'child series stores parent_series_id self reference'
);

select is(
  (
    select count(*)::integer
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'series'
      and constraint_name = 'series_not_own_parent'
      and constraint_type = 'CHECK'
  ),
  1,
  'series has a self-parent check constraint'
);

select lives_ok(
  $$ insert into public.work_series(series_id, work_id, position_in_series, is_canonical)
     values (
       (select id from public.series where name = '沙丘宇宙'),
       (select id from public.works where canonical_title = '沙丘'),
       1,
       true
     ) $$,
  'owner can link first work into a series'
);

select lives_ok(
  $$ insert into public.work_series(series_id, work_id, position_in_series, is_canonical)
     values (
       (select id from public.series where name = '沙丘宇宙'),
       (select id from public.works where canonical_title = '沙丘救世主'),
       2,
       true
     ) $$,
  'owner can link second work into a series'
);

select is(
  (select count(*)::integer from public.work_series where series_id = (select id from public.series where name = '沙丘宇宙')),
  2,
  'work_series stores two members'
);

select throws_ok(
  $$ insert into public.work_series(series_id, work_id, position_in_series)
     values (
       (select id from public.series where name = '沙丘宇宙'),
       (select id from public.works where canonical_title = '沙丘'),
       1
     ) $$,
  '23505',
  null,
  'work_series primary key prevents duplicate membership'
);

select lives_ok(
  $$ insert into public.work_relations(from_work_id, to_work_id, relation_type, directionality, confidence_score, created_source, verified)
     values (
       (select id from public.works where canonical_title = '沙丘'),
       (select id from public.works where canonical_title = '沙丘救世主'),
       'sequel',
       'directed',
       1.000,
       'user_manual',
       true
     ) $$,
  'owner can create a directed work relation'
);

select is(
  (
    select created_source || ':' || (created_by = (select public.current_profile_id()))::text
    from public.work_relations
    where relation_type = 'sequel'
  ),
  'user_manual:true',
  'work relation separates source enum from created_by audit profile'
);

select throws_ok(
  $$ insert into public.work_relations(from_work_id, to_work_id, relation_type)
     values (
       (select id from public.works where canonical_title = '沙丘'),
       (select id from public.works where canonical_title = '沙丘救世主'),
       'sequel'
     ) $$,
  '23505',
  null,
  'work_relations unique key prevents duplicate relation type'
);

select throws_ok(
  $$ insert into public.work_relations(from_work_id, to_work_id, relation_type, created_source)
     values (
       (select id from public.works where canonical_title = '沙丘救世主'),
       (select id from public.works where canonical_title = '沙丘'),
       'prequel',
       'manual_user'
     ) $$,
  '23514',
  null,
  'work_relations rejects invalid created_source values'
);

select throws_ok(
  $$ insert into public.work_relations(from_work_id, to_work_id, relation_type)
     values (
       (select id from public.works where canonical_title = '沙丘'),
       (select id from public.works where canonical_title = '沙丘'),
       'companion'
     ) $$,
  '23514',
  null,
  'work_relations rejects self relations'
);

select lives_ok(
  $$ insert into public.external_ids(target_type, target_id, source, external_id)
     values ('series', (select id from public.series where name = '沙丘宇宙'), 'local', 'dune-series') $$,
  'owner can attach external id to a series'
);

select throws_ok(
  $$ insert into public.external_ids(target_type, target_id, source, external_id)
     values ('person', (select id from public.series where name = '沙丘宇宙'), 'local', 'reserved-person') $$,
  '23503',
  null,
  'person external id remains reserved until Task 04'
);

select is(
  (select count(*)::integer from public.external_ids where target_type = 'series' and external_id = 'dune-series'),
  1,
  'owner can read series external id'
);

select public._set_auth_user('00000000-0000-0000-0000-00000000bbb3');

select is(
  (select count(*)::integer from public.series where name like '沙丘%'),
  2,
  'other authenticated user can read public series'
);

select is(
  (select count(*)::integer from public.work_series),
  2,
  'other authenticated user can read public work series rows'
);

select is(
  (select count(*)::integer from public.work_relations),
  1,
  'other authenticated user can read public work relations'
);

select throws_ok(
  $$ insert into public.work_series(series_id, work_id, position_in_series)
     values (
       (select id from public.series where name = '沙丘宇宙'),
       (select id from public.works where canonical_title = '沙丘之子'),
       3
     ) $$,
  '42501',
  null,
  'other authenticated user cannot add membership to owner series and work'
);

select throws_ok(
  $$ insert into public.external_ids(target_type, target_id, source, external_id)
     values ('series', (select id from public.series where name = '沙丘宇宙'), 'local', 'other-series-id') $$,
  '42501',
  null,
  'other authenticated user cannot attach external id to owner series'
);

select public._set_auth_user(null);
set local role anon;

select is(
  (select count(*)::integer from public.series where name like '沙丘%'),
  2,
  'anonymous user can read public series'
);

select throws_ok(
  $$ insert into public.series(name) values ('匿名系列') $$,
  '42501',
  null,
  'anonymous user cannot insert series'
);

set local role authenticated;
select public._set_auth_user('00000000-0000-0000-0000-00000000aaa3');

select throws_ok(
  $$ update public.series set name = '沙丘宇宙 edited' where name = '沙丘宇宙' $$,
  '42501',
  null,
  'owner cannot update series in Task 03'
);

select throws_ok(
  $$ delete from public.work_relations where relation_type = 'sequel' $$,
  '42501',
  null,
  'owner cannot delete work relations in Task 03'
);

reset role;

select * from finish();

rollback;

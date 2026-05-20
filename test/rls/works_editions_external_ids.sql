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
  '00000000-0000-0000-0000-00000000aaa2',
  'authenticated',
  'authenticated',
  'task02-owner@example.com',
  'test-password-hash',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"username":"task02_owner","display_name":"Task02 Owner"}'::jsonb
),
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-00000000bbb2',
  'authenticated',
  'authenticated',
  'task02-other@example.com',
  'test-password-hash',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"username":"task02_other","display_name":"Task02 Other"}'::jsonb
);

select is(
  (select count(*)::integer from public.profiles where username in ('task02_owner', 'task02_other')),
  2,
  'task02 auth users create profiles'
);

set local role authenticated;
select public._set_auth_user('00000000-0000-0000-0000-00000000aaa2');

select is(
  public.create_manual_work('book', '沙丘', 1965, null, 'zh', null, null, false, null) ->> 'status',
  'created',
  'owner creates a manual work through RPC'
);

select is(
  (select count(*)::integer from public.works where canonical_title = '沙丘'),
  1,
  'manual creation inserts one work'
);

select is(
  (select count(*)::integer from public.editions e join public.works w on w.id = e.work_id where w.canonical_title = '沙丘' and e.is_default),
  1,
  'manual creation creates one default edition'
);

select is(
  (select e.title from public.editions e join public.works w on w.id = e.work_id where w.canonical_title = '沙丘' and e.is_default limit 1),
  '沙丘',
  'default edition title follows canonical work title'
);

select is(
  public.create_manual_work('book', '沙丘', 1965, null, 'zh', null, null, false, null) ->> 'status',
  'duplicate_found',
  'second matching creation returns duplicate candidates'
);

select is(
  public.create_manual_work('book', '沙丘', 1965, null, 'zh', null, null, false, null) -> 'candidates' -> 0 ->> 'canonical_title',
  '沙丘',
  'duplicate candidate includes existing work title'
);

select is(
  (select count(*)::integer from public.works where canonical_title = '沙丘'),
  1,
  'duplicate warning does not insert another work'
);

select is(
  public.create_manual_work('book', '沙丘', 1965, null, 'zh', null, null, true, 'confirmed separate imported copy') ->> 'status',
  'created',
  'explicit duplicate override can create a second work'
);

select is(
  (select count(*)::integer from public.works where canonical_title = '沙丘'),
  2,
  'duplicate override inserts another work'
);

select is(
  (select count(*)::integer from public.works where dedup_skipped_reason = 'confirmed separate imported copy'),
  1,
  'duplicate override stores governance reason'
);

select lives_ok(
  $$ insert into public.external_ids(target_type, target_id, source, external_id, match_method, confidence_score, verified_by_user)
     values (
       'work',
       (select id from public.works where canonical_title = '沙丘' order by created_at limit 1),
       'douban',
       'book-001',
       'manual',
       1.000,
       true
     ) $$,
  'owner can attach external id to own work'
);

select throws_ok(
  $$ insert into public.external_ids(target_type, target_id, source, external_id)
     values (
       'work',
       (select id from public.works where canonical_title = '沙丘' order by created_at desc limit 1),
       'douban',
       'book-001'
     ) $$,
  '23505',
  null,
  'external ids are unique by source and external id'
);

select throws_ok(
  $$ insert into public.external_ids(target_type, target_id, source, external_id)
     values ('series', (select id from public.works where canonical_title = '沙丘' limit 1), 'local', 'reserved-series') $$,
  '23503',
  null,
  'reserved external id target types fail loudly before later tasks'
);

select is(
  (select count(*)::integer from public.works where canonical_title = '沙丘'),
  2,
  'owner can read created public works'
);

select throws_ok(
  $$ update public.works set canonical_title = '沙丘 edited' where canonical_title = '沙丘' $$,
  '42501',
  null,
  'owner cannot update shared works in Task 02'
);

select throws_ok(
  $$ delete from public.editions where title = '沙丘' $$,
  '42501',
  null,
  'owner cannot delete editions in Task 02'
);

select public._set_auth_user('00000000-0000-0000-0000-00000000bbb2');

select is(
  (select count(*)::integer from public.works where canonical_title = '沙丘'),
  2,
  'other authenticated user can read global public works'
);

select throws_ok(
  $$ insert into public.editions(work_id, title, edition_type)
     values ((select id from public.works where canonical_title = '沙丘' order by created_at limit 1), 'Other User Edition', 'manual') $$,
  '42501',
  null,
  'other authenticated user cannot add edition to owner work'
);

select throws_ok(
  $$ insert into public.external_ids(target_type, target_id, source, external_id)
     values ('work', (select id from public.works where canonical_title = '沙丘' order by created_at limit 1), 'imdb', 'tt-task02') $$,
  '42501',
  null,
  'other authenticated user cannot attach external id to owner work'
);

select public._set_auth_user(null);
set local role anon;

select is(
  (select count(*)::integer from public.works where canonical_title = '沙丘'),
  2,
  'anonymous user can read global public works'
);

select throws_ok(
  $$ insert into public.works(media_type, canonical_title, fingerprint)
     values ('book', '匿名创建', 'anon:test') $$,
  '42501',
  null,
  'anonymous user cannot insert works'
);

select throws_ok(
  $$ select public.create_manual_work('book', '匿名创建', 2026, null, 'zh', null, null, false, null) $$,
  '42501',
  null,
  'anonymous user cannot execute create manual work RPC'
);

reset role;

select is(
  (select count(*)::integer from public.editions e join public.works w on w.id = e.work_id where w.canonical_title = '沙丘' and e.is_default),
  2,
  'every inserted work has a default edition'
);

select * from finish();

rollback;

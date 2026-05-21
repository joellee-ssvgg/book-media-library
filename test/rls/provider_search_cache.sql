begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(25);

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
      and table_name = 'provider_search_cache'
  ),
  1,
  'task06 creates provider_search_cache table'
);

select is(
  (
    select count(*)::integer
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'provider_search_cache'
      and column_name in ('query_hash', 'media_type', 'provider', 'query_json', 'results_json', 'negative', 'expires_at')
  ),
  7,
  'provider_search_cache exposes required cache columns'
);

select is(
  (
    select count(*)::integer
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'provider_search_cache'
      and column_name in ('profile_id', 'created_by', 'updated_by')
  ),
  0,
  'provider_search_cache intentionally has no profile-linked columns'
);

select is(
  (
    select count(*)::integer
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'provider_search_cache'
      and indexname in (
        'provider_search_cache_key',
        'idx_provider_search_cache_lookup',
        'idx_provider_search_cache_expires_at'
      )
  ),
  3,
  'provider_search_cache has lookup, unique, and expiry indexes'
);

select is(
  (
    select relrowsecurity::text || ':' || relforcerowsecurity::text
    from pg_class
    where oid = 'public.provider_search_cache'::regclass
  ),
  'true:true',
  'provider_search_cache enables and forces RLS'
);

select is(
  (
    select count(*)::integer
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname in ('get_provider_search_cache', 'upsert_provider_search_cache')
  ),
  2,
  'task06 exposes exact-key cache RPC functions'
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
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-00000000aaa6',
  'authenticated',
  'authenticated',
  'task06-owner@example.com',
  'test-password-hash',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"username":"task06_owner","display_name":"Task06 Owner"}'::jsonb
);

select is(
  (select count(*)::integer from public.profiles where username = 'task06_owner'),
  1,
  'task06 auth user creates a profile'
);

set local role anon;
select public._set_auth_user(null);

select throws_ok(
  $$ select public.get_provider_search_cache('book', 'openlibrary', 'hash') $$,
  '42501',
  null,
  'anon cannot execute provider cache read RPC'
);

select throws_ok(
  $$ select public.upsert_provider_search_cache('book', 'openlibrary', 'hash', '{}'::jsonb, '[]'::jsonb, false) $$,
  '42501',
  null,
  'anon cannot execute provider cache write RPC'
);

select throws_ok(
  $$ select * from public.provider_search_cache $$,
  '42501',
  null,
  'anon cannot list provider_search_cache directly'
);

set local role authenticated;
select public._set_auth_user('00000000-0000-0000-0000-00000000aaa6');

select lives_ok(
  $$ select public.upsert_provider_search_cache(
       'BOOK',
       'OPENLIBRARY',
       'ABC123',
       '{"text":"Dune"}'::jsonb,
       '[{"title":"Dune","provider":"openlibrary"}]'::jsonb,
       false
     ) $$,
  'authenticated user can write normal provider cache through RPC'
);

select is(
  public.get_provider_search_cache('book', 'openlibrary', 'abc123') #>> '{results_json,0,title}',
  'Dune',
  'authenticated user reads exact non-expired cache row through RPC'
);

select ok(
  (
    (public.get_provider_search_cache('book', 'openlibrary', 'abc123') ->> 'expires_at')::timestamptz
      between now() + interval '23 hours' and now() + interval '25 hours'
  ),
  'normal cache TTL is about 24 hours'
);

select is(
  public.get_provider_search_cache('book', 'openlibrary', 'abc123') ->> 'query_hash',
  'abc123',
  'cache RPC normalizes query_hash, media_type, and provider'
);

select throws_ok(
  $$ select * from public.provider_search_cache $$,
  '42501',
  null,
  'authenticated user cannot list provider_search_cache directly'
);

select throws_ok(
  $$ insert into public.provider_search_cache(media_type, provider, query_hash, expires_at)
     values ('book', 'openlibrary', 'direct-insert', now() + interval '1 hour') $$,
  '42501',
  null,
  'authenticated user cannot insert provider_search_cache directly'
);

select lives_ok(
  $$ select public.upsert_provider_search_cache(
       'book',
       'googlebooks',
       'empty-hit',
       '{"text":"missing"}'::jsonb,
       '[]'::jsonb,
       true
     ) $$,
  'authenticated user can write negative cache through RPC'
);

select is(
  public.get_provider_search_cache('book', 'googlebooks', 'empty-hit') ->> 'negative',
  'true',
  'negative cache marks empty result sets'
);

select ok(
  (
    (public.get_provider_search_cache('book', 'googlebooks', 'empty-hit') ->> 'expires_at')::timestamptz
      between now() + interval '50 minutes' and now() + interval '70 minutes'
  ),
  'negative cache TTL is about 1 hour'
);

select throws_ok(
  $$ select public.upsert_provider_search_cache(
       'book',
       'unsupported',
       'bad-provider',
       '{}'::jsonb,
       '[]'::jsonb,
       false
     ) $$,
  '23514',
  null,
  'provider_search_cache rejects unsupported providers'
);

select throws_ok(
  $$ select public.upsert_provider_search_cache(
       'book',
       'openlibrary',
       'bad-json',
       '{}'::jsonb,
       '{}'::jsonb,
       false
     ) $$,
  '23514',
  null,
  'provider_search_cache requires results_json to be an array'
);

select lives_ok(
  $$ select public.upsert_provider_search_cache(
       'book',
       'openlibrary',
       'abc123',
       '{"text":"Dune Messiah"}'::jsonb,
       '[{"title":"Dune Messiah","provider":"openlibrary"}]'::jsonb,
       false
     ) $$,
  'same provider query key can refresh the cached payload'
);

select is(
  public.get_provider_search_cache('book', 'openlibrary', 'abc123') #>> '{results_json,0,title}',
  'Dune Messiah',
  'upsert refreshes existing provider cache payload'
);

select throws_ok(
  $$ update public.provider_search_cache set negative = true $$,
  '42501',
  null,
  'authenticated user cannot update provider_search_cache directly'
);

select throws_ok(
  $$ delete from public.provider_search_cache $$,
  '42501',
  null,
  'authenticated user cannot delete provider_search_cache directly'
);

select * from finish();
rollback;

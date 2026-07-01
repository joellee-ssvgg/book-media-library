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
  '00000000-0000-0000-0000-00000000aa20',
  'authenticated',
  'authenticated',
  'task20-owner@example.com',
  'test-password-hash',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"username":"task20_owner","display_name":"Task20 Owner"}'::jsonb
);

select is(
  (
    select count(*)::integer
    from public.slo_alert_thresholds
  ),
  9,
  'Task20 seeds the P0 SLO and alert threshold table'
);

select is(
  (
    select count(*)::integer
    from public.slo_alert_thresholds
    where metric_key in (
      'task20.ip_requests_per_minute',
      'task20.profile_requests_per_day'
    )
      and panel = 'abuse'
      and sentry_alert_required
      and p0_required
  ),
  2,
  'Task20 stores both required Upstash rate-limit thresholds'
);

select is(
  (
    select threshold_operator || threshold_value::text || ':' || window_seconds::text
    from public.slo_alert_thresholds
    where metric_key = 'task20.ip_requests_per_minute'
  ),
  '<=20:60',
  'IP rate limit is fixed at 20 requests per minute'
);

select is(
  (
    select threshold_operator || threshold_value::text || ':' || window_seconds::text
    from public.slo_alert_thresholds
    where metric_key = 'task20.profile_requests_per_day'
  ),
  '<=1000:86400',
  'profile rate limit is fixed at 1000 requests per day'
);

select is(
  (
    select count(*)::integer
    from public.slo_alert_thresholds
    where panel in ('business', 'reliability', 'abuse', 'cost')
  ),
  9,
  'Task20 covers the four ADR-030 alert panels'
);

select ok(
  (
    select relrowsecurity and relforcerowsecurity
    from pg_class
    where oid = 'public.slo_alert_thresholds'::regclass
  ),
  'slo_alert_thresholds enables and forces RLS'
);

select is(
  (
    select count(*)::integer
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'slo_alert_thresholds'
      and grantee in ('anon', 'authenticated')
      and privilege_type = 'SELECT'
  ),
  2,
  'anon and authenticated can read enabled SLO thresholds'
);

select is(
  (
    select count(*)::integer
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'slo_alert_thresholds'
      and grantee in ('anon', 'authenticated')
      and privilege_type <> 'SELECT'
  ),
  0,
  'anon and authenticated cannot directly write SLO thresholds'
);

set local role anon;
select public._set_auth_user(null);

select is(
  (select count(*)::integer from public.slo_alert_thresholds),
  9,
  'anonymous can read enabled Task20 SLO thresholds'
);

select throws_ok(
  $$
    insert into public.slo_alert_thresholds (
      panel,
      metric_key,
      metric_label,
      threshold_operator,
      threshold_value,
      threshold_unit,
      window_seconds,
      severity,
      notification_channel,
      description
    ) values (
      'abuse',
      'task20.anon_write_attempt',
      'Anon write attempt',
      '>',
      1,
      'count',
      60,
      'warning',
      'sentry',
      'anon must not write threshold config'
    )
  $$,
  '42501',
  null,
  'anonymous cannot insert SLO thresholds'
);

reset role;

set local role authenticated;
select public._set_auth_user('00000000-0000-0000-0000-00000000aa20');

select is(
  public.task20_current_profile_id(),
  (select id from public.profiles where username = 'task20_owner'),
  'Task20 profile RPC returns the current profile id for edge profile limits'
);

select throws_ok(
  $$
    update public.slo_alert_thresholds
    set threshold_value = 21
    where metric_key = 'task20.ip_requests_per_minute'
  $$,
  '42501',
  null,
  'authenticated cannot update SLO thresholds'
);

reset role;

select * from finish();

rollback;

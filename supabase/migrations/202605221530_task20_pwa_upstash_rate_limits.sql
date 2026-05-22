set search_path = public, extensions;

create table public.slo_alert_thresholds (
  id uuid primary key default public.uuid_v7(),
  panel text not null,
  metric_key text not null,
  metric_label text not null,
  threshold_operator text not null,
  threshold_value numeric not null,
  threshold_unit text not null,
  window_seconds integer not null,
  severity text not null,
  notification_channel text not null,
  sentry_alert_required boolean not null default true,
  p0_required boolean not null default false,
  enabled boolean not null default true,
  description text not null,
  metadata_json jsonb not null default '{}'::jsonb,
  runbook_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  row_version integer not null default 1,
  constraint slo_alert_thresholds_panel_check check (
    panel in ('business', 'reliability', 'abuse', 'cost')
  ),
  constraint slo_alert_thresholds_key_not_blank check (length(trim(metric_key)) > 0),
  constraint slo_alert_thresholds_label_not_blank check (length(trim(metric_label)) > 0),
  constraint slo_alert_thresholds_operator_check check (
    threshold_operator in ('<', '<=', '=', '>=', '>')
  ),
  constraint slo_alert_thresholds_window_positive check (window_seconds > 0),
  constraint slo_alert_thresholds_severity_check check (
    severity in ('info', 'warning', 'critical')
  ),
  constraint slo_alert_thresholds_channel_not_blank check (length(trim(notification_channel)) > 0),
  constraint slo_alert_thresholds_description_not_blank check (length(trim(description)) > 0),
  constraint slo_alert_thresholds_metadata_object check (jsonb_typeof(metadata_json) = 'object'),
  constraint slo_alert_thresholds_row_version_positive check (row_version > 0),
  unique (metric_key)
);

create index idx_slo_alert_thresholds_panel_enabled
  on public.slo_alert_thresholds(panel, enabled, severity);
create index idx_slo_alert_thresholds_p0
  on public.slo_alert_thresholds(p0_required, severity)
  where p0_required;

insert into public.slo_alert_thresholds (
  id,
  panel,
  metric_key,
  metric_label,
  threshold_operator,
  threshold_value,
  threshold_unit,
  window_seconds,
  severity,
  notification_channel,
  sentry_alert_required,
  p0_required,
  description,
  metadata_json,
  runbook_url
) values
(
  '00000000-0000-0000-0000-000000200001',
  'abuse',
  'task20.ip_requests_per_minute',
  'IP requests per minute',
  '<=',
  20,
  'requests',
  60,
  'warning',
  'sentry',
  true,
  true,
  'Task20 anonymous crawler protection: rl:ip:{ip}:{minute_bucket}.',
  '{"redis_key_prefix":"rl:ip","scope":"ip"}'::jsonb,
  'docs/runbooks/task20-pwa-upstash-rate-limit.md'
),
(
  '00000000-0000-0000-0000-000000200002',
  'abuse',
  'task20.profile_requests_per_day',
  'Profile requests per day',
  '<=',
  1000,
  'requests',
  86400,
  'warning',
  'sentry',
  true,
  true,
  'Task20 provider quota abuse protection: rl:profile:{profile_id}:{day_bucket}.',
  '{"redis_key_prefix":"rl:profile","scope":"profile"}'::jsonb,
  'docs/runbooks/task20-pwa-upstash-rate-limit.md'
),
(
  '00000000-0000-0000-0000-000000200003',
  'business',
  'slo.add_work_latency_p99_ms',
  'P99 add-work latency',
  '<',
  800,
  'ms',
  300,
  'warning',
  'sentry,email',
  true,
  true,
  'Product v6 SLO: adding a work should stay under 800ms at P99.',
  '{"surface":"add_work"}'::jsonb,
  'docs/runbooks/task20-pwa-upstash-rate-limit.md'
),
(
  '00000000-0000-0000-0000-000000200004',
  'business',
  'slo.public_profile_ttfb_p99_ms',
  'P99 public profile TTFB',
  '<',
  500,
  'ms',
  300,
  'warning',
  'sentry,email',
  true,
  true,
  'Product v6 SLO: public profile SSR/ISR TTFB should stay under 500ms at P99.',
  '{"surface":"public_profile"}'::jsonb,
  'docs/runbooks/task20-pwa-upstash-rate-limit.md'
),
(
  '00000000-0000-0000-0000-000000200005',
  'reliability',
  'slo.private_note_leak_events',
  'Private note leak events',
  '=',
  0,
  'events',
  60,
  'critical',
  'sentry,email,sms',
  true,
  true,
  'Product v6 invariant: private-note leakage is a P0 incident on the first event.',
  '{"invariant":"private_notes_physical_isolation"}'::jsonb,
  'docs/runbooks/task20-pwa-upstash-rate-limit.md'
),
(
  '00000000-0000-0000-0000-000000200006',
  'reliability',
  'slo.monthly_availability_percent',
  'Monthly availability',
  '>=',
  99.5,
  'percent',
  2592000,
  'warning',
  'monthly_review',
  false,
  true,
  'Product v6 SLO: monthly availability must stay at or above 99.5%.',
  '{"review":"monthly"}'::jsonb,
  'docs/runbooks/task20-pwa-upstash-rate-limit.md'
),
(
  '00000000-0000-0000-0000-000000200007',
  'reliability',
  'slo.event_outbox_backlog',
  'Event outbox backlog',
  '<=',
  1000,
  'rows',
  600,
  'warning',
  'sentry,email',
  true,
  false,
  'Product v6 alert table: event_outbox backlog above 1k for 10 minutes alerts Sentry and email.',
  '{"table":"event_outbox"}'::jsonb,
  'docs/runbooks/task20-pwa-upstash-rate-limit.md'
),
(
  '00000000-0000-0000-0000-000000200008',
  'reliability',
  'slo.rls_pgtap_ci_failure',
  'RLS pgTAP CI failures',
  '=',
  0,
  'failures',
  60,
  'critical',
  'github,email',
  false,
  true,
  'Product v6 alert table: RLS pgTAP failure must block the PR and alert via GitHub/email.',
  '{"workflow":"pgtap"}'::jsonb,
  'docs/runbooks/task19-rls-ci-gates.md'
),
(
  '00000000-0000-0000-0000-000000200009',
  'cost',
  'slo.provider_quota_monthly_usage_percent',
  'Provider quota monthly usage',
  '<=',
  80,
  'percent',
  2592000,
  'warning',
  'sentry,email',
  true,
  false,
  'Product v6 alert table: provider quota usage above 80% monthly quota alerts before provider exhaustion.',
  '{"resource":"provider_quota"}'::jsonb,
  'docs/runbooks/task20-pwa-upstash-rate-limit.md'
);

create or replace function public.set_task20_slo_alert_threshold_fields()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if tg_op = 'INSERT' then
    new.id := coalesce(new.id, public.uuid_v7());
    new.panel := lower(trim(new.panel));
    new.metric_key := lower(trim(new.metric_key));
    new.metric_label := trim(new.metric_label);
    new.threshold_operator := trim(new.threshold_operator);
    new.threshold_unit := lower(trim(new.threshold_unit));
    new.severity := lower(trim(new.severity));
    new.notification_channel := lower(trim(new.notification_channel));
    new.metadata_json := coalesce(new.metadata_json, '{}'::jsonb);
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := coalesce(new.updated_at, new.created_at);
    new.row_version := coalesce(new.row_version, 1);

    return new;
  end if;

  new.id := old.id;
  new.metric_key := old.metric_key;
  new.created_at := old.created_at;
  new.updated_at := now();
  new.row_version := old.row_version + 1;
  new.panel := lower(trim(new.panel));
  new.metric_label := trim(new.metric_label);
  new.threshold_operator := trim(new.threshold_operator);
  new.threshold_unit := lower(trim(new.threshold_unit));
  new.severity := lower(trim(new.severity));
  new.notification_channel := lower(trim(new.notification_channel));
  new.metadata_json := coalesce(new.metadata_json, '{}'::jsonb);

  return new;
end;
$$;

create trigger set_slo_alert_thresholds_task20_fields
before insert or update on public.slo_alert_thresholds
for each row execute function public.set_task20_slo_alert_threshold_fields();

create or replace function public.task20_current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.current_profile_id();
$$;

alter table public.slo_alert_thresholds enable row level security;
alter table public.slo_alert_thresholds force row level security;

create policy slo_alert_thresholds_public_select
on public.slo_alert_thresholds
for select
to anon, authenticated
using (enabled);

revoke all on public.slo_alert_thresholds from anon, authenticated;
revoke all on function public.task20_current_profile_id() from public;

grant select on public.slo_alert_thresholds to anon, authenticated;
grant execute on function public.task20_current_profile_id() to authenticated;

set search_path = public, extensions;

create table public.notifications (
  id uuid primary key default public.uuid_v7(),
  recipient_profile_id uuid not null references public.profiles(id) on delete restrict,
  actor_profile_id uuid references public.profiles(id) on delete restrict,
  kind text not null,
  payload_json jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_kind_not_blank check (length(trim(kind)) > 0),
  constraint notifications_payload_json_object check (jsonb_typeof(payload_json) = 'object'),
  constraint notifications_read_at_not_before_created check (
    read_at is null or read_at >= created_at
  )
);

create index idx_notifications_recipient_created_at
  on public.notifications(recipient_profile_id, created_at);
create index idx_notifications_actor_profile
  on public.notifications(actor_profile_id)
  where actor_profile_id is not null;

alter table public.notifications enable row level security;
alter table public.notifications force row level security;

create policy notifications_recipient_select
on public.notifications
for select
to authenticated
using (recipient_profile_id = (select public.current_profile_id()));

revoke all on public.notifications from anon, authenticated;

grant select on public.notifications to authenticated;

-- task35: 观影记录（watch_events）—— 「足迹」板块「观影月历」的数据源。
-- 每条 = 一次观影事件（电影 + 日期 + 备注）；支持重看 / 一天多部 / 补登过去某天。
-- 这是新表，所以从一开始就把 RLS/触发器设计成「owner 可直接软删」——
-- owner_update 的 WITH CHECK 不含 deleted_at is null，触发器允许 deleted_at NULL→非NULL，
-- 因此移除记录走普通 UPDATE 即可，不必像 task33/34 那样事后放宽 + 加 security-definer RPC。

create table public.watch_events (
  id uuid primary key default public.uuid_v7(),
  profile_id uuid not null references public.profiles(id) on delete restrict,
  work_id uuid not null references public.works(id) on delete restrict,
  entry_id uuid references public.user_entries(id) on delete restrict,
  watched_on date not null,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id),
  row_version integer not null default 1,
  delete_reason text,
  constraint watch_events_note_not_blank check (note is null or length(trim(note)) > 0)
);

create index idx_watch_events_profile_day
  on public.watch_events(profile_id, watched_on)
  where deleted_at is null;
create index idx_watch_events_work
  on public.watch_events(work_id)
  where deleted_at is null;

create or replace function public.set_task35_watch_event_fields()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  actor_profile_id uuid;
  target_media_type text;
begin
  actor_profile_id := public.current_profile_id();
  if actor_profile_id is null then
    raise exception 'authenticated profile required to log watch' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    new.id := coalesce(new.id, public.uuid_v7());
    new.profile_id := actor_profile_id;
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := coalesce(new.updated_at, new.created_at);
    new.created_by := actor_profile_id;
    new.updated_by := actor_profile_id;
    new.row_version := coalesce(new.row_version, 1);
  else
    new.id := old.id;
    new.profile_id := old.profile_id;
    new.work_id := old.work_id;
    new.entry_id := old.entry_id;
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    -- 允许软删除（deleted_at NULL→非NULL），其余情况钉死
    if old.deleted_at is null and new.deleted_at is not null then
      new.deleted_by := coalesce(new.deleted_by, actor_profile_id);
    else
      new.deleted_at := old.deleted_at;
      new.deleted_by := old.deleted_by;
      new.delete_reason := old.delete_reason;
    end if;
    new.updated_at := now();
    new.updated_by := actor_profile_id;
    new.row_version := old.row_version + 1;
  end if;

  -- work 必须是存在的电影
  select w.media_type into target_media_type
  from public.works w
  where w.id = new.work_id and w.deleted_at is null;
  if target_media_type is null then
    raise exception 'watch event work must exist' using errcode = '23503';
  end if;
  if target_media_type <> 'movie' then
    raise exception 'watch event work must be a movie' using errcode = '23514';
  end if;

  -- entry 若给定，须属于本人且指向同一 work
  if new.entry_id is not null then
    if not exists (
      select 1 from public.user_entries e
      where e.id = new.entry_id
        and e.profile_id = actor_profile_id
        and e.work_id = new.work_id
        and e.deleted_at is null
    ) then
      raise exception 'watch event entry must belong to the current profile and match the work' using errcode = '42501';
    end if;
  end if;

  new.note := nullif(trim(regexp_replace(coalesce(new.note, ''), '\s+', ' ', 'g')), '');
  return new;
end;
$$;

create trigger set_watch_events_task35_fields
before insert or update on public.watch_events
for each row execute function public.set_task35_watch_event_fields();

alter table public.watch_events enable row level security;
alter table public.watch_events force row level security;

create policy watch_events_owner_select
on public.watch_events
for select
to authenticated
using (
  profile_id = (select public.current_profile_id())
  and deleted_at is null
);

create policy watch_events_owner_insert
on public.watch_events
for insert
to authenticated
with check (
  profile_id = (select public.current_profile_id())
  and created_by = (select public.current_profile_id())
  and updated_by = (select public.current_profile_id())
);

-- WITH CHECK 故意不含 deleted_at is null —— 允许 owner 直接软删
create policy watch_events_owner_update
on public.watch_events
for update
to authenticated
using (
  profile_id = (select public.current_profile_id())
  and deleted_at is null
)
with check (
  profile_id = (select public.current_profile_id())
  and updated_by = (select public.current_profile_id())
);

revoke all on public.watch_events from anon, authenticated;
grant select, insert, update on public.watch_events to authenticated;

-- 软删一条观影记录。owner_select 策略要求 deleted_at is null，会让「把 deleted_at 设为
-- 非空」的普通 UPDATE 失败（新行不再满足 select 策略），所以移除必须走 security-definer
-- RPC（绕 RLS）。普通字段编辑（note/日期）仍可直接 UPDATE。
create or replace function public.task35_remove_watch_event(input_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  actor_profile_id uuid;
  owner_profile_id uuid;
begin
  actor_profile_id := public.current_profile_id();
  if actor_profile_id is null then
    raise exception 'authenticated profile required to remove watch event' using errcode = '42501';
  end if;

  select profile_id into owner_profile_id
  from public.watch_events
  where id = input_event_id and deleted_at is null;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if owner_profile_id <> actor_profile_id then
    raise exception 'watch event must belong to the current profile' using errcode = '42501';
  end if;

  update public.watch_events
  set deleted_at = now(), deleted_by = actor_profile_id
  where id = input_event_id and deleted_at is null;

  return jsonb_build_object('status', 'deleted', 'event_id', input_event_id);
end;
$$;

revoke all on function public.task35_remove_watch_event(uuid) from public, anon;
grant execute on function public.task35_remove_watch_event(uuid) to authenticated;

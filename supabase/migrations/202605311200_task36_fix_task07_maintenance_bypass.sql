-- task36: 修复落地 task23–35 时引入的两处回归。
--
-- (1) task33 重定义 set_task07_user_entry_fields() 时丢掉了 task18 的「硬删除维护旁路」，
--     导致账号注销流程（task18 以 service_role 匿名化公开字段的 UPDATE，期间无 auth.uid()）
--     撞上「authenticated profile required」鉴权校验（p0-redline 失败）。
--     这里恢复该旁路，同时保留 task33 的软删除放宽逻辑。
-- (2) task23 的 book_countries 仅 ENABLE 未 FORCE 行级安全；Task19 RLS 治理要求
--     每张 public 业务表都必须 FORCE RLS。补上（watch_events 已 FORCE）。

create or replace function public.set_task07_user_entry_fields()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  actor_profile_id uuid;
  maintenance_profile_id uuid;
  target_media_type text;
begin
  -- task18 维护旁路：硬删除注销期间以 service_role 匿名化本人公开字段，此时无 auth.uid()
  maintenance_profile_id := nullif(current_setting('app.task18_hard_delete_profile_id', true), '')::uuid;

  if tg_op = 'UPDATE'
    and current_setting('app.task18_hard_delete_active', true) = 'on'
    and current_setting('request.jwt.claim.role', true) = 'service_role'
    and maintenance_profile_id = old.profile_id
  then
    actor_profile_id := old.profile_id;
  else
    actor_profile_id := public.current_profile_id();
  end if;

  if actor_profile_id is null then
    raise exception 'authenticated profile required to write user entry' using errcode = '42501';
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
    new.edition_id := old.edition_id;
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    -- 允许软删除（deleted_at 从 NULL 变为非 NULL）；其余情况仍锁死，防篡改/反删
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

  new.status := lower(trim(coalesce(new.status, '')));
  new.review := nullif(trim(regexp_replace(coalesce(new.review, ''), '\s+', ' ', 'g')), '');
  new.visibility_scope := lower(trim(coalesce(new.visibility_scope, 'private')));
  new.field_visibility_json := coalesce(new.field_visibility_json, '{}'::jsonb);
  new.favorite := coalesce(new.favorite, false);
  new.imported := coalesce(new.imported, false);

  select w.media_type
  into target_media_type
  from public.works w
  join public.editions e on e.work_id = w.id
  where w.id = new.work_id
    and e.id = new.edition_id
    and w.deleted_at is null
    and e.deleted_at is null;

  if target_media_type is null then
    raise exception 'entry work and edition target must exist and match' using errcode = '23503';
  end if;

  if target_media_type = 'book' and new.status not in ('want_to_read', 'reading', 'finished', 'abandoned') then
    raise exception 'book entry status is invalid: %', new.status using errcode = '23514';
  end if;

  if target_media_type = 'movie' and new.status not in ('want_to_watch', 'watching', 'watched', 'abandoned') then
    raise exception 'movie entry status is invalid: %', new.status using errcode = '23514';
  end if;

  return new;
end;
$$;

-- task23 的 book_countries 当初只 ENABLE 未 FORCE，补齐以满足 Task19 RLS 治理
alter table public.book_countries force row level security;

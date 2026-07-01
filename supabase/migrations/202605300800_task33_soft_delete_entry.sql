-- task33: allow soft-deleting a library entry.
--
-- Two parts:
-- (1) The task07 before-update trigger pinned deleted_at/deleted_by/delete_reason
--     to their old values on EVERY update, so an entry could never be removed.
--     We relax it to permit exactly the soft-delete transition (deleted_at NULL ->
--     non-NULL), stamping deleted_by; all other cases stay pinned, so a row still
--     can't be un-deleted or have its delete metadata tampered with via a normal
--     update. (Direct PostgREST updates are also still blocked by the owner-update
--     RLS WITH CHECK that requires deleted_at IS NULL.)
-- (2) A security-definer RPC scoped to the caller's own profile that performs the
--     soft-delete (RLS-bypassing, the only sanctioned removal path).

create or replace function public.set_task07_user_entry_fields()
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

create or replace function public.task33_soft_delete_entry(input_entry_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  actor_profile_id uuid;
  target_profile_id uuid;
begin
  actor_profile_id := public.current_profile_id();
  if actor_profile_id is null then
    raise exception 'authenticated profile required to delete entry' using errcode = '42501';
  end if;

  select profile_id into target_profile_id
  from public.user_entries
  where id = input_entry_id and deleted_at is null;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if target_profile_id <> actor_profile_id then
    raise exception 'entry must belong to the current profile' using errcode = '42501';
  end if;

  update public.user_entries
  set deleted_at = now(),
      deleted_by = actor_profile_id
  where id = input_entry_id and deleted_at is null;

  return jsonb_build_object('status', 'deleted', 'entry_id', input_entry_id);
end;
$$;

revoke all on function public.task33_soft_delete_entry(uuid) from public, anon;
grant execute on function public.task33_soft_delete_entry(uuid) to authenticated;

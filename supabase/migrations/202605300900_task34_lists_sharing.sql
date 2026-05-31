-- task34: make lists usable — soft-delete (lists + items) and public sharing.
--
-- Like task07 entries, the task11 list/list_item before-update triggers pinned
-- deleted_at to old values, so lists/items could never be removed. We relax both
-- to permit exactly the soft-delete transition (NULL -> non-NULL), and add
-- security-definer RPCs for removal (owner-update RLS WITH CHECK forbids
-- deleted_at being set, so PostgREST can't do it). Plus a public-read RPC mirroring
-- task17_get_public_profile, since lists/list_items have owner-only RLS.

-- 1) relax the lists trigger
create or replace function public.set_task11_list_fields()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  actor_profile_id uuid;
begin
  actor_profile_id := public.current_profile_id();
  if actor_profile_id is null then
    raise exception 'authenticated profile required to write list' using errcode = '42501';
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
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    -- 允许软删除（deleted_at 从 NULL → 非 NULL），其余情况仍钉死
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

  new.title := trim(regexp_replace(coalesce(new.title, ''), '\s+', ' ', 'g'));
  new.description := nullif(trim(regexp_replace(coalesce(new.description, ''), '\s+', ' ', 'g')), '');
  new.visibility_scope := lower(coalesce(nullif(trim(new.visibility_scope), ''), 'private'));
  new.cover_strategy := lower(coalesce(nullif(trim(new.cover_strategy), ''), 'first_n'));
  new.ordered := coalesce(new.ordered, true);

  return new;
end;
$$;

-- 2) relax the list_items trigger
create or replace function public.set_task11_list_item_fields()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  actor_profile_id uuid;
  entry_work_id uuid;
begin
  actor_profile_id := public.current_profile_id();
  if actor_profile_id is null then
    raise exception 'authenticated profile required to write list item' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.lists l
    where l.id = new.list_id
      and l.profile_id = actor_profile_id
      and l.deleted_at is null
  ) then
    raise exception 'list item list must belong to the current profile' using errcode = '42501';
  end if;

  if new.entry_id is not null then
    select e.work_id
    into entry_work_id
    from public.user_entries e
    where e.id = new.entry_id
      and e.profile_id = actor_profile_id
      and e.deleted_at is null;

    if entry_work_id is null then
      raise exception 'list item entry must belong to the current profile' using errcode = '42501';
    end if;

    if new.work_id is null then
      new.work_id := entry_work_id;
    elsif new.work_id <> entry_work_id then
      raise exception 'list item work_id must match entry work_id' using errcode = '23514';
    end if;
  elsif new.work_id is null then
    raise exception 'list item requires entry_id or work_id' using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.works w
    where w.id = new.work_id
      and w.deleted_at is null
  ) then
    raise exception 'list item work must exist' using errcode = '23503';
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
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    -- 允许软删除（deleted_at 从 NULL → 非 NULL），其余情况仍钉死
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

  new.note := nullif(trim(regexp_replace(coalesce(new.note, ''), '\s+', ' ', 'g')), '');

  return new;
end;
$$;

-- 3) soft-delete a whole list (+ its items), scoped to the caller's profile
create or replace function public.task34_soft_delete_list(input_list_id uuid)
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
    raise exception 'authenticated profile required to delete list' using errcode = '42501';
  end if;

  select profile_id into owner_profile_id
  from public.lists
  where id = input_list_id and deleted_at is null;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if owner_profile_id <> actor_profile_id then
    raise exception 'list must belong to the current profile' using errcode = '42501';
  end if;

  update public.list_items
  set deleted_at = now(), deleted_by = actor_profile_id
  where list_id = input_list_id and deleted_at is null;

  update public.lists
  set deleted_at = now(), deleted_by = actor_profile_id
  where id = input_list_id and deleted_at is null;

  return jsonb_build_object('status', 'deleted', 'list_id', input_list_id);
end;
$$;

-- 4) soft-delete a single list item
create or replace function public.task34_soft_delete_list_item(input_item_id uuid)
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
    raise exception 'authenticated profile required to remove list item' using errcode = '42501';
  end if;

  select profile_id into owner_profile_id
  from public.list_items
  where id = input_item_id and deleted_at is null;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if owner_profile_id <> actor_profile_id then
    raise exception 'list item must belong to the current profile' using errcode = '42501';
  end if;

  update public.list_items
  set deleted_at = now(), deleted_by = actor_profile_id
  where id = input_item_id and deleted_at is null;

  return jsonb_build_object('status', 'deleted', 'item_id', input_item_id);
end;
$$;

-- 5) public read of a list (public/unlisted only), mirroring task17_get_public_profile
create or replace function public.task34_get_public_list(input_list_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  target record;
begin
  select l.id, l.title, l.description, l.visibility_scope, l.deleted_at,
         p.username, p.display_name
  into target
  from public.lists l
  join public.profiles p on p.id = l.profile_id
  where l.id = input_list_id;

  if not found or target.deleted_at is not null then
    return jsonb_build_object('status', 'not_found');
  end if;
  if target.visibility_scope not in ('public', 'unlisted') then
    return jsonb_build_object('status', 'private');
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'list', jsonb_build_object(
      'id', target.id,
      'title', target.title,
      'description', target.description,
      'visibility', target.visibility_scope,
      'owner_username', target.username,
      'owner_display_name', target.display_name
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'work_id', li.work_id,
        'title', w.canonical_title,
        'media_type', w.media_type,
        'year', w.first_release_year,
        'note', li.note,
        'position', li.position,
        'cover_url', (
          select e.cover_url
          from public.editions e
          where e.work_id = li.work_id and e.cover_url is not null and e.deleted_at is null
          order by e.created_at
          limit 1
        )
      ) order by li.position)
      from public.list_items li
      join public.works w on w.id = li.work_id and w.deleted_at is null
      where li.list_id = target.id and li.deleted_at is null
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.task34_soft_delete_list(uuid) from public, anon;
revoke all on function public.task34_soft_delete_list_item(uuid) from public, anon;
grant execute on function public.task34_soft_delete_list(uuid) to authenticated;
grant execute on function public.task34_soft_delete_list_item(uuid) to authenticated;
grant execute on function public.task34_get_public_list(uuid) to anon, authenticated;

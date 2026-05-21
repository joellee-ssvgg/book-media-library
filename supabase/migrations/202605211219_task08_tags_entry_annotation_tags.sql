set search_path = public, extensions;

create table public.tags (
  id uuid primary key default public.uuid_v7(),
  profile_id uuid not null references public.profiles(id) on delete restrict,
  name text not null,
  color text,
  source text not null default 'manual',
  canonical_tag_id uuid references public.tags(id) on delete restrict,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id),
  row_version integer not null default 1,
  delete_reason text,
  constraint tags_name_not_blank check (length(trim(name)) > 0),
  constraint tags_source_check check (source in ('manual', 'ai', 'imported', 'system')),
  constraint tags_color_hex_check check (
    color is null or color ~ '^#[0-9a-f]{6}$'
  ),
  constraint tags_not_own_canonical check (
    canonical_tag_id is null or canonical_tag_id <> id
  ),
  constraint tags_row_version_positive check (row_version > 0)
);

create unique index tags_profile_name_key
  on public.tags(profile_id, lower(name))
  where deleted_at is null;
create index idx_tags_profile_source
  on public.tags(profile_id, source)
  where deleted_at is null;
create index idx_tags_canonical_tag_id
  on public.tags(canonical_tag_id)
  where canonical_tag_id is not null and deleted_at is null;

create table public.entry_tags (
  profile_id uuid not null references public.profiles(id) on delete restrict,
  entry_id uuid not null references public.user_entries(id) on delete restrict,
  tag_id uuid not null references public.tags(id) on delete restrict,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id),
  row_version integer not null default 1,
  delete_reason text,
  primary key (entry_id, tag_id),
  constraint entry_tags_row_version_positive check (row_version > 0)
);

create index idx_entry_tags_profile
  on public.entry_tags(profile_id)
  where deleted_at is null;
create index idx_entry_tags_tag
  on public.entry_tags(tag_id)
  where deleted_at is null;

create table public.annotation_tags (
  profile_id uuid not null references public.profiles(id) on delete restrict,
  annotation_id uuid not null references public.annotations(id) on delete restrict,
  tag_id uuid not null references public.tags(id) on delete restrict,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id),
  row_version integer not null default 1,
  delete_reason text,
  primary key (annotation_id, tag_id),
  constraint annotation_tags_row_version_positive check (row_version > 0)
);

create index idx_annotation_tags_profile
  on public.annotation_tags(profile_id)
  where deleted_at is null;
create index idx_annotation_tags_tag
  on public.annotation_tags(tag_id)
  where deleted_at is null;

create or replace function public.task08_canonical_tag_id(
  input_tag_id uuid,
  input_profile_id uuid
)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  current_tag_id uuid := input_tag_id;
  next_tag_id uuid;
  seen_tag_ids uuid[] := array[]::uuid[];
begin
  if current_tag_id is null or input_profile_id is null then
    raise exception 'tag and profile are required' using errcode = '23514';
  end if;

  loop
    if current_tag_id = any(seen_tag_ids) then
      raise exception 'tag alias cycle detected' using errcode = '23514';
    end if;

    seen_tag_ids := array_append(seen_tag_ids, current_tag_id);

    select t.canonical_tag_id
    into next_tag_id
    from public.tags t
    where t.id = current_tag_id
      and t.profile_id = input_profile_id
      and t.deleted_at is null;

    if not found then
      raise exception 'tag must belong to the current profile' using errcode = '42501';
    end if;

    if next_tag_id is null then
      return current_tag_id;
    end if;

    if array_length(seen_tag_ids, 1) > 32 then
      raise exception 'tag alias chain is too deep' using errcode = '23514';
    end if;

    current_tag_id := next_tag_id;
  end loop;
end;
$$;

create or replace function public.set_task08_tag_fields()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  actor_profile_id uuid;
  canonical_root_id uuid;
begin
  actor_profile_id := public.current_profile_id();
  if actor_profile_id is null then
    raise exception 'authenticated profile required to write tag' using errcode = '42501';
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
    new.deleted_at := old.deleted_at;
    new.deleted_by := old.deleted_by;
    new.delete_reason := old.delete_reason;
    new.updated_at := now();
    new.updated_by := actor_profile_id;
    new.row_version := old.row_version + 1;
  end if;

  new.name := trim(regexp_replace(coalesce(new.name, ''), '\s+', ' ', 'g'));
  new.color := nullif(lower(trim(coalesce(new.color, ''))), '');
  new.source := lower(coalesce(nullif(trim(new.source), ''), 'manual'));

  if new.canonical_tag_id is not null then
    canonical_root_id := public.task08_canonical_tag_id(new.canonical_tag_id, actor_profile_id);
    if canonical_root_id = new.id then
      raise exception 'tag cannot point to itself as canonical' using errcode = '23514';
    end if;
    new.canonical_tag_id := canonical_root_id;
  end if;

  return new;
end;
$$;

create or replace function public.set_task08_entry_tag_fields()
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
    raise exception 'authenticated profile required to write entry tag' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.user_entries e
    where e.id = new.entry_id
      and e.profile_id = actor_profile_id
      and e.deleted_at is null
  ) then
    raise exception 'entry tag entry must belong to the current profile' using errcode = '42501';
  end if;

  new.tag_id := public.task08_canonical_tag_id(new.tag_id, actor_profile_id);
  new.profile_id := actor_profile_id;
  new.created_at := coalesce(new.created_at, now());
  new.updated_at := coalesce(new.updated_at, new.created_at);
  new.created_by := actor_profile_id;
  new.updated_by := actor_profile_id;
  new.row_version := coalesce(new.row_version, 1);

  return new;
end;
$$;

create or replace function public.set_task08_annotation_tag_fields()
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
    raise exception 'authenticated profile required to write annotation tag' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.annotations a
    where a.id = new.annotation_id
      and a.profile_id = actor_profile_id
      and a.deleted_at is null
  ) then
    raise exception 'annotation tag annotation must belong to the current profile' using errcode = '42501';
  end if;

  new.tag_id := public.task08_canonical_tag_id(new.tag_id, actor_profile_id);
  new.profile_id := actor_profile_id;
  new.created_at := coalesce(new.created_at, now());
  new.updated_at := coalesce(new.updated_at, new.created_at);
  new.created_by := actor_profile_id;
  new.updated_by := actor_profile_id;
  new.row_version := coalesce(new.row_version, 1);

  return new;
end;
$$;

create or replace function public.merge_tag_into(
  input_source_tag_id uuid,
  input_target_tag_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  actor_profile_id uuid;
  source_root_id uuid;
  target_root_id uuid;
  entry_links_removed integer := 0;
  annotation_links_removed integer := 0;
begin
  actor_profile_id := public.current_profile_id();
  if actor_profile_id is null then
    raise exception 'authenticated profile required to merge tags' using errcode = '42501';
  end if;

  if input_source_tag_id is null or input_target_tag_id is null then
    raise exception 'source and target tags are required' using errcode = '23514';
  end if;

  source_root_id := public.task08_canonical_tag_id(input_source_tag_id, actor_profile_id);
  target_root_id := public.task08_canonical_tag_id(input_target_tag_id, actor_profile_id);

  if source_root_id = target_root_id then
    raise exception 'cannot merge a tag into itself' using errcode = '23514';
  end if;

  insert into public.entry_tags (
    profile_id,
    entry_id,
    tag_id
  )
  select
    actor_profile_id,
    et.entry_id,
    target_root_id
  from public.entry_tags et
  where et.profile_id = actor_profile_id
    and et.tag_id = source_root_id
    and et.deleted_at is null
  on conflict (entry_id, tag_id) do nothing;

  delete from public.entry_tags et
  where et.profile_id = actor_profile_id
    and et.tag_id = source_root_id
    and et.deleted_at is null;
  get diagnostics entry_links_removed = row_count;

  insert into public.annotation_tags (
    profile_id,
    annotation_id,
    tag_id
  )
  select
    actor_profile_id,
    at.annotation_id,
    target_root_id
  from public.annotation_tags at
  where at.profile_id = actor_profile_id
    and at.tag_id = source_root_id
    and at.deleted_at is null
  on conflict (annotation_id, tag_id) do nothing;

  delete from public.annotation_tags at
  where at.profile_id = actor_profile_id
    and at.tag_id = source_root_id
    and at.deleted_at is null;
  get diagnostics annotation_links_removed = row_count;

  update public.tags
  set canonical_tag_id = target_root_id
  where id = source_root_id
    and profile_id = actor_profile_id
    and deleted_at is null;

  return jsonb_build_object(
    'source_tag_id', source_root_id,
    'merged_to', target_root_id,
    'entry_links_removed', entry_links_removed,
    'annotation_links_removed', annotation_links_removed
  );
end;
$$;

create trigger set_tags_task08_fields
before insert or update on public.tags
for each row execute function public.set_task08_tag_fields();

create trigger set_entry_tags_task08_fields
before insert on public.entry_tags
for each row execute function public.set_task08_entry_tag_fields();

create trigger set_annotation_tags_task08_fields
before insert on public.annotation_tags
for each row execute function public.set_task08_annotation_tag_fields();

alter table public.tags enable row level security;
alter table public.tags force row level security;
alter table public.entry_tags enable row level security;
alter table public.entry_tags force row level security;
alter table public.annotation_tags enable row level security;
alter table public.annotation_tags force row level security;

create policy tags_owner_select
on public.tags
for select
to authenticated
using (
  profile_id = (select public.current_profile_id())
  and deleted_at is null
);

create policy tags_owner_insert
on public.tags
for insert
to authenticated
with check (
  profile_id = (select public.current_profile_id())
  and created_by = (select public.current_profile_id())
  and updated_by = (select public.current_profile_id())
  and deleted_at is null
);

create policy tags_owner_update
on public.tags
for update
to authenticated
using (
  profile_id = (select public.current_profile_id())
  and deleted_at is null
)
with check (
  profile_id = (select public.current_profile_id())
  and updated_by = (select public.current_profile_id())
  and deleted_at is null
);

create policy entry_tags_owner_select
on public.entry_tags
for select
to authenticated
using (
  profile_id = (select public.current_profile_id())
  and deleted_at is null
);

create policy entry_tags_owner_insert
on public.entry_tags
for insert
to authenticated
with check (
  profile_id = (select public.current_profile_id())
  and created_by = (select public.current_profile_id())
  and updated_by = (select public.current_profile_id())
  and deleted_at is null
  and exists (
    select 1
    from public.user_entries e
    where e.id = entry_tags.entry_id
      and e.profile_id = (select public.current_profile_id())
      and e.deleted_at is null
  )
  and exists (
    select 1
    from public.tags t
    where t.id = entry_tags.tag_id
      and t.profile_id = (select public.current_profile_id())
      and t.deleted_at is null
  )
);

create policy annotation_tags_owner_select
on public.annotation_tags
for select
to authenticated
using (
  profile_id = (select public.current_profile_id())
  and deleted_at is null
);

create policy annotation_tags_owner_insert
on public.annotation_tags
for insert
to authenticated
with check (
  profile_id = (select public.current_profile_id())
  and created_by = (select public.current_profile_id())
  and updated_by = (select public.current_profile_id())
  and deleted_at is null
  and exists (
    select 1
    from public.annotations a
    where a.id = annotation_tags.annotation_id
      and a.profile_id = (select public.current_profile_id())
      and a.deleted_at is null
  )
  and exists (
    select 1
    from public.tags t
    where t.id = annotation_tags.tag_id
      and t.profile_id = (select public.current_profile_id())
      and t.deleted_at is null
  )
);

revoke all on public.tags from anon, authenticated;
revoke all on public.entry_tags from anon, authenticated;
revoke all on public.annotation_tags from anon, authenticated;
revoke all on function public.task08_canonical_tag_id(uuid, uuid) from public;
revoke all on function public.merge_tag_into(uuid, uuid) from public;

grant select, insert, update on public.tags to authenticated;
grant select, insert on public.entry_tags to authenticated;
grant select, insert on public.annotation_tags to authenticated;
grant execute on function public.merge_tag_into(uuid, uuid) to authenticated;

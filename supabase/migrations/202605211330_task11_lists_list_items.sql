set search_path = public, extensions;

create table public.lists (
  id uuid primary key default public.uuid_v7(),
  profile_id uuid not null references public.profiles(id) on delete restrict,
  title text not null,
  description text,
  visibility_scope text not null default 'private',
  ordered boolean not null default true,
  cover_strategy text not null default 'first_n',
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id),
  row_version integer not null default 1,
  delete_reason text,
  constraint lists_title_not_blank check (length(trim(title)) > 0),
  constraint lists_description_not_blank check (
    description is null or length(trim(description)) > 0
  ),
  constraint lists_visibility_scope_check check (
    visibility_scope in ('private', 'unlisted', 'followers', 'public')
  ),
  constraint lists_cover_strategy_check check (
    cover_strategy in ('manual', 'first_n', 'collage')
  ),
  constraint lists_row_version_positive check (row_version > 0)
);

create index idx_lists_profile_updated
  on public.lists(profile_id, updated_at desc)
  where deleted_at is null;
create index idx_lists_profile_visibility
  on public.lists(profile_id, visibility_scope, updated_at desc)
  where deleted_at is null;

create table public.list_items (
  id uuid primary key default public.uuid_v7(),
  profile_id uuid not null references public.profiles(id) on delete restrict,
  list_id uuid not null references public.lists(id) on delete restrict,
  entry_id uuid references public.user_entries(id) on delete restrict,
  work_id uuid not null references public.works(id) on delete restrict,
  position integer not null,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id),
  row_version integer not null default 1,
  delete_reason text,
  constraint list_items_position_positive check (position > 0),
  constraint list_items_note_not_blank check (
    note is null or length(trim(note)) > 0
  ),
  constraint list_items_row_version_positive check (row_version > 0)
);

create unique index list_items_list_position_key
  on public.list_items(list_id, position)
  where deleted_at is null;
create index idx_list_items_profile
  on public.list_items(profile_id, list_id, position)
  where deleted_at is null;
create index idx_list_items_entry
  on public.list_items(entry_id)
  where entry_id is not null and deleted_at is null;
create index idx_list_items_work
  on public.list_items(work_id)
  where deleted_at is null;

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
    new.deleted_at := old.deleted_at;
    new.deleted_by := old.deleted_by;
    new.delete_reason := old.delete_reason;
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
    new.deleted_at := old.deleted_at;
    new.deleted_by := old.deleted_by;
    new.delete_reason := old.delete_reason;
    new.updated_at := now();
    new.updated_by := actor_profile_id;
    new.row_version := old.row_version + 1;
  end if;

  new.note := nullif(trim(regexp_replace(coalesce(new.note, ''), '\s+', ' ', 'g')), '');

  return new;
end;
$$;

create trigger set_lists_task11_fields
before insert or update on public.lists
for each row execute function public.set_task11_list_fields();

create trigger set_list_items_task11_fields
before insert or update on public.list_items
for each row execute function public.set_task11_list_item_fields();

alter table public.lists enable row level security;
alter table public.lists force row level security;
alter table public.list_items enable row level security;
alter table public.list_items force row level security;

create policy lists_owner_select
on public.lists
for select
to authenticated
using (
  profile_id = (select public.current_profile_id())
  and deleted_at is null
);

create policy lists_owner_insert
on public.lists
for insert
to authenticated
with check (
  profile_id = (select public.current_profile_id())
  and created_by = (select public.current_profile_id())
  and updated_by = (select public.current_profile_id())
  and deleted_at is null
);

create policy lists_owner_update
on public.lists
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

create policy list_items_owner_select
on public.list_items
for select
to authenticated
using (
  profile_id = (select public.current_profile_id())
  and deleted_at is null
);

create policy list_items_owner_insert
on public.list_items
for insert
to authenticated
with check (
  profile_id = (select public.current_profile_id())
  and created_by = (select public.current_profile_id())
  and updated_by = (select public.current_profile_id())
  and deleted_at is null
);

create policy list_items_owner_update
on public.list_items
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

revoke all on public.lists from anon, authenticated;
revoke all on public.list_items from anon, authenticated;
revoke all on function public.set_task11_list_fields() from public;
revoke all on function public.set_task11_list_item_fields() from public;

grant select, insert, update on public.lists to authenticated;
grant select, insert, update on public.list_items to authenticated;

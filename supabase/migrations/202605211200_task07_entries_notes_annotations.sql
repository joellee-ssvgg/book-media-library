set search_path = public, extensions;

create or replace function public.task07_visibility_json_values_valid(input_json jsonb)
returns boolean
language sql
immutable
as $$
  select
    jsonb_typeof(coalesce(input_json, '{}'::jsonb)) = 'object'
    and not exists (
      select 1
      from jsonb_each_text(coalesce(input_json, '{}'::jsonb)) as field_visibility(field_name, field_visibility_scope)
      where field_visibility_scope not in ('private', 'unlisted', 'followers', 'public')
    );
$$;

create or replace function public.task07_validate_annotation_location(
  input_media_type text,
  input_location jsonb
)
returns boolean
language plpgsql
immutable
as $$
declare
  normalized_media_type text;
  location_type text;
  timestamp_value numeric;
begin
  normalized_media_type := lower(trim(coalesce(input_media_type, '')));

  if input_location is null or jsonb_typeof(input_location) <> 'object' then
    return false;
  end if;

  location_type := input_location ->> 'type';

  if normalized_media_type = 'book' then
    if location_type <> 'book' then
      return false;
    end if;

    if not (
      input_location ? 'page'
      or input_location ? 'chapter'
      or input_location ? 'paragraph'
    ) then
      return false;
    end if;

    if input_location ? 'page' and coalesce(input_location ->> 'page', '') !~ '^[1-9][0-9]*$' then
      return false;
    end if;

    if input_location ? 'paragraph' and coalesce(input_location ->> 'paragraph', '') !~ '^[1-9][0-9]*$' then
      return false;
    end if;

    if input_location ? 'chapter' and length(trim(coalesce(input_location ->> 'chapter', ''))) = 0 then
      return false;
    end if;

    return true;
  end if;

  if normalized_media_type = 'movie' then
    if location_type <> 'video' then
      return false;
    end if;

    if not (input_location ? 'timestamp_seconds') then
      return false;
    end if;

    if coalesce(input_location ->> 'timestamp_seconds', '') !~ '^(0|[1-9][0-9]*)(\.[0-9]+)?$' then
      return false;
    end if;

    timestamp_value := (input_location ->> 'timestamp_seconds')::numeric;
    return timestamp_value >= 0;
  end if;

  return false;
exception
  when invalid_text_representation or numeric_value_out_of_range then
    return false;
end;
$$;

create table public.user_entries (
  id uuid primary key default public.uuid_v7(),
  profile_id uuid not null references public.profiles(id) on delete restrict,
  work_id uuid not null references public.works(id) on delete restrict,
  edition_id uuid not null references public.editions(id) on delete restrict,
  status text not null,
  rating_x10 integer,
  review text,
  visibility_scope text not null default 'private',
  field_visibility_json jsonb not null default '{}'::jsonb,
  favorite boolean not null default false,
  imported boolean not null default false,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id),
  row_version integer not null default 1,
  delete_reason text,
  constraint user_entries_status_check check (
    status in (
      'want_to_read',
      'reading',
      'finished',
      'abandoned',
      'want_to_watch',
      'watching',
      'watched'
    )
  ),
  constraint user_entries_rating_x10_check check (
    rating_x10 is null
    or (rating_x10 between 5 and 50 and rating_x10 % 5 = 0)
  ),
  constraint user_entries_review_not_blank check (
    review is null or length(trim(review)) > 0
  ),
  constraint user_entries_visibility_scope_check check (
    visibility_scope in ('private', 'unlisted', 'followers', 'public')
  ),
  constraint user_entries_field_visibility_object check (
    jsonb_typeof(field_visibility_json) = 'object'
  ),
  constraint user_entries_field_visibility_values_check check (
    public.task07_visibility_json_values_valid(field_visibility_json)
  ),
  constraint user_entries_timeline_check check (
    started_at is null
    or finished_at is null
    or started_at <= finished_at
  ),
  constraint user_entries_row_version_positive check (row_version > 0)
);

create unique index user_entries_one_active_per_profile_work
  on public.user_entries(profile_id, work_id)
  where deleted_at is null;
create index idx_user_entries_profile_status_updated
  on public.user_entries(profile_id, status, updated_at desc)
  where deleted_at is null;
create index idx_user_entries_profile_updated
  on public.user_entries(profile_id, updated_at desc)
  where deleted_at is null;
create index idx_user_entries_work
  on public.user_entries(work_id)
  where deleted_at is null;
create index idx_user_entries_edition
  on public.user_entries(edition_id)
  where deleted_at is null;

create table public.user_private_notes (
  id uuid primary key default public.uuid_v7(),
  profile_id uuid not null references public.profiles(id) on delete restrict,
  entry_id uuid not null references public.user_entries(id) on delete restrict,
  note text not null,
  search_vector tsvector,
  ai_extracted_tags_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id),
  row_version integer not null default 1,
  delete_reason text,
  constraint user_private_notes_entry_unique unique (entry_id),
  constraint user_private_notes_note_not_blank check (length(trim(note)) > 0),
  constraint user_private_notes_ai_tags_array check (
    jsonb_typeof(ai_extracted_tags_json) = 'array'
  ),
  constraint user_private_notes_row_version_positive check (row_version > 0)
);

create index idx_user_private_notes_profile
  on public.user_private_notes(profile_id)
  where deleted_at is null;
create index idx_user_private_notes_entry
  on public.user_private_notes(entry_id)
  where deleted_at is null;
create index idx_user_private_notes_search
  on public.user_private_notes using gin (search_vector)
  where deleted_at is null;

create table public.annotations (
  id uuid primary key default public.uuid_v7(),
  profile_id uuid not null references public.profiles(id) on delete restrict,
  entry_id uuid not null references public.user_entries(id) on delete restrict,
  kind text not null,
  content text,
  location_json jsonb not null,
  visibility_scope text not null default 'private',
  search_vector tsvector,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id),
  row_version integer not null default 1,
  delete_reason text,
  constraint annotations_kind_check check (kind in ('quote', 'highlight', 'note')),
  constraint annotations_content_not_blank check (
    content is null or length(trim(content)) > 0
  ),
  constraint annotations_location_object check (
    jsonb_typeof(location_json) = 'object'
  ),
  constraint annotations_visibility_scope_check check (
    visibility_scope in ('private', 'unlisted', 'followers', 'public')
  ),
  constraint annotations_row_version_positive check (row_version > 0)
);

create index idx_annotations_profile
  on public.annotations(profile_id)
  where deleted_at is null;
create index idx_annotations_entry
  on public.annotations(entry_id)
  where deleted_at is null;
create index idx_annotations_entry_visibility
  on public.annotations(entry_id, visibility_scope)
  where deleted_at is null;
create index idx_annotations_search
  on public.annotations using gin (search_vector)
  where deleted_at is null;

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
    new.deleted_at := old.deleted_at;
    new.deleted_by := old.deleted_by;
    new.delete_reason := old.delete_reason;
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

create or replace function public.set_task07_private_note_fields()
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
    raise exception 'authenticated profile required to write private note' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if not exists (
      select 1
      from public.user_entries e
      where e.id = new.entry_id
        and e.profile_id = actor_profile_id
        and e.deleted_at is null
    ) then
      raise exception 'private note entry must belong to the current profile' using errcode = '42501';
    end if;

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
    new.entry_id := old.entry_id;
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.deleted_at := old.deleted_at;
    new.deleted_by := old.deleted_by;
    new.delete_reason := old.delete_reason;
    new.updated_at := now();
    new.updated_by := actor_profile_id;
    new.row_version := old.row_version + 1;
  end if;

  new.ai_extracted_tags_json := coalesce(new.ai_extracted_tags_json, '[]'::jsonb);
  new.search_vector := to_tsvector('simple', coalesce(new.note, ''));

  return new;
end;
$$;

create or replace function public.set_task07_annotation_fields()
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
    raise exception 'authenticated profile required to write annotation' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    select w.media_type
    into target_media_type
    from public.user_entries e
    join public.works w on w.id = e.work_id
    where e.id = new.entry_id
      and e.profile_id = actor_profile_id
      and e.deleted_at is null
      and w.deleted_at is null;

    if target_media_type is null then
      raise exception 'annotation entry must belong to the current profile' using errcode = '42501';
    end if;

    new.id := coalesce(new.id, public.uuid_v7());
    new.profile_id := actor_profile_id;
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := coalesce(new.updated_at, new.created_at);
    new.created_by := actor_profile_id;
    new.updated_by := actor_profile_id;
    new.row_version := coalesce(new.row_version, 1);
  else
    select w.media_type
    into target_media_type
    from public.user_entries e
    join public.works w on w.id = e.work_id
    where e.id = old.entry_id
      and e.profile_id = actor_profile_id
      and e.deleted_at is null
      and w.deleted_at is null;

    if target_media_type is null then
      raise exception 'annotation entry must belong to the current profile' using errcode = '42501';
    end if;

    new.id := old.id;
    new.profile_id := old.profile_id;
    new.entry_id := old.entry_id;
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.deleted_at := old.deleted_at;
    new.deleted_by := old.deleted_by;
    new.delete_reason := old.delete_reason;
    new.updated_at := now();
    new.updated_by := actor_profile_id;
    new.row_version := old.row_version + 1;
  end if;

  new.kind := lower(trim(coalesce(new.kind, '')));
  new.visibility_scope := lower(trim(coalesce(new.visibility_scope, 'private')));
  new.search_vector := to_tsvector('simple', coalesce(new.content, ''));

  if not public.task07_validate_annotation_location(target_media_type, new.location_json) then
    raise exception 'annotation location does not match entry media type' using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.task07_entry_is_public(input_entry_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_entries e
    where e.id = input_entry_id
      and e.visibility_scope = 'public'
      and e.deleted_at is null
  );
$$;

create trigger set_user_entries_task07_fields
before insert or update on public.user_entries
for each row execute function public.set_task07_user_entry_fields();

create trigger set_user_private_notes_task07_fields
before insert or update on public.user_private_notes
for each row execute function public.set_task07_private_note_fields();

create trigger set_annotations_task07_fields
before insert or update on public.annotations
for each row execute function public.set_task07_annotation_fields();

create view public.public_entries_v with (security_barrier = true) as
select
  e.id,
  e.profile_id,
  e.work_id,
  e.edition_id,
  e.status,
  case
    when e.field_visibility_json ->> 'rating_x10' = 'public'
      or e.field_visibility_json ->> 'rating' = 'public'
    then e.rating_x10
    else null
  end as rating_x10,
  case
    when e.field_visibility_json ->> 'review' = 'public' then e.review
    else null
  end as review,
  case
    when e.field_visibility_json ->> 'favorite' = 'public' then e.favorite
    else null
  end as favorite,
  case
    when e.field_visibility_json ->> 'started_at' = 'public' then e.started_at
    else null
  end as started_at,
  case
    when e.field_visibility_json ->> 'finished_at' = 'public' then e.finished_at
    else null
  end as finished_at,
  e.created_at,
  e.updated_at
from public.user_entries e
where e.deleted_at is null
  and e.visibility_scope = 'public';

alter table public.user_entries enable row level security;
alter table public.user_entries force row level security;
alter table public.user_private_notes enable row level security;
alter table public.user_private_notes force row level security;
alter table public.annotations enable row level security;
alter table public.annotations force row level security;

create policy user_entries_owner_select
on public.user_entries
for select
to authenticated
using (
  profile_id = (select public.current_profile_id())
  and deleted_at is null
);

create policy user_entries_owner_insert
on public.user_entries
for insert
to authenticated
with check (
  profile_id = (select public.current_profile_id())
  and created_by = (select public.current_profile_id())
  and updated_by = (select public.current_profile_id())
  and deleted_at is null
);

create policy user_entries_owner_update
on public.user_entries
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

create policy user_private_notes_owner_select
on public.user_private_notes
for select
to authenticated
using (
  profile_id = (select public.current_profile_id())
  and deleted_at is null
);

create policy user_private_notes_owner_insert
on public.user_private_notes
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
    where e.id = user_private_notes.entry_id
      and e.profile_id = (select public.current_profile_id())
      and e.deleted_at is null
  )
);

create policy user_private_notes_owner_update
on public.user_private_notes
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

create policy annotations_owner_select
on public.annotations
for select
to authenticated
using (
  profile_id = (select public.current_profile_id())
  and deleted_at is null
);

create policy annotations_public_select
on public.annotations
for select
to anon, authenticated
using (
  deleted_at is null
  and visibility_scope = 'public'
  and public.task07_entry_is_public(entry_id)
);

create policy annotations_owner_insert
on public.annotations
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
    where e.id = annotations.entry_id
      and e.profile_id = (select public.current_profile_id())
      and e.deleted_at is null
  )
);

create policy annotations_owner_update
on public.annotations
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

revoke all on public.user_entries from anon, authenticated;
revoke all on public.user_private_notes from anon, authenticated;
revoke all on public.annotations from anon, authenticated;
revoke all on public.public_entries_v from anon, authenticated;
revoke all on function public.task07_visibility_json_values_valid(jsonb) from public;
revoke all on function public.task07_validate_annotation_location(text, jsonb) from public;
revoke all on function public.task07_entry_is_public(uuid) from public;

grant select, insert, update on public.user_entries to authenticated;
grant select, insert, update on public.user_private_notes to authenticated;
grant select on public.annotations to anon, authenticated;
grant insert, update on public.annotations to authenticated;
grant select on public.public_entries_v to anon, authenticated;
grant execute on function public.task07_visibility_json_values_valid(jsonb) to authenticated;
grant execute on function public.task07_validate_annotation_location(text, jsonb) to authenticated;
grant execute on function public.task07_entry_is_public(uuid) to anon, authenticated;

set search_path = public, extensions;

create table public.series (
  id uuid primary key default public.uuid_v7(),
  name text not null,
  localized_names_json jsonb not null default '{}'::jsonb,
  series_type text not null default 'franchise',
  primary_creator_id uuid,
  ordering_method text not null default 'publication',
  parent_series_id uuid references public.series(id) on delete restrict,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id),
  row_version integer not null default 1,
  delete_reason text,
  constraint series_name_not_blank check (length(trim(name)) > 0),
  constraint series_localized_names_object check (jsonb_typeof(localized_names_json) = 'object'),
  constraint series_type_check check (series_type in ('trilogy', 'saga', 'franchise', 'universe')),
  constraint series_ordering_method_check check (ordering_method in ('numeric', 'chronological', 'publication', 'reading_order')),
  constraint series_not_own_parent check (parent_series_id is null or parent_series_id <> id)
);

comment on column public.series.primary_creator_id is
  'Nullable until Task 04 creates persons and can add the foreign key.';

create index idx_series_parent_series_id on public.series(parent_series_id);
create index idx_series_name_trgm
  on public.series using gin (name gin_trgm_ops)
  where deleted_at is null;

create table public.work_series (
  series_id uuid not null references public.series(id) on delete restrict,
  work_id uuid not null references public.works(id) on delete restrict,
  position_in_series numeric(10, 3),
  is_canonical boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id),
  row_version integer not null default 1,
  delete_reason text,
  primary key (series_id, work_id),
  constraint work_series_position_positive check (position_in_series is null or position_in_series > 0)
);

create index idx_work_series_work_id on public.work_series(work_id);
create index idx_work_series_series_position
  on public.work_series(series_id, position_in_series)
  where deleted_at is null;

create table public.work_relations (
  from_work_id uuid not null references public.works(id) on delete restrict,
  to_work_id uuid not null references public.works(id) on delete restrict,
  relation_type text not null,
  directionality text not null default 'directed',
  confidence_score numeric(4, 3),
  created_source text not null default 'user_manual',
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id),
  row_version integer not null default 1,
  delete_reason text,
  constraint work_relations_distinct_works check (from_work_id <> to_work_id),
  constraint work_relations_relation_type_check check (
    relation_type in ('adaptation', 'sequel', 'prequel', 'remake', 'companion', 'spinoff', 'tie_in')
  ),
  constraint work_relations_directionality_check check (directionality in ('directed', 'bidirectional')),
  constraint work_relations_confidence_score_check check (confidence_score is null or confidence_score between 0 and 1),
  constraint work_relations_created_source_check check (created_source in ('user_manual', 'system', 'provider')),
  unique (from_work_id, to_work_id, relation_type)
);

create index idx_work_relations_to_work_id on public.work_relations(to_work_id);
create index idx_work_relations_from_work_id on public.work_relations(from_work_id);

create or replace function public.set_task03_series_fields()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  actor_profile_id uuid;
begin
  if tg_op = 'INSERT' then
    actor_profile_id := public.current_profile_id();
    if actor_profile_id is null then
      raise exception 'authenticated profile required to insert series' using errcode = '42501';
    end if;

    new.id := coalesce(new.id, public.uuid_v7());
    new.name := trim(regexp_replace(new.name, '\s+', ' ', 'g'));
    new.localized_names_json := coalesce(new.localized_names_json, '{}'::jsonb);
    new.series_type := lower(coalesce(nullif(trim(new.series_type), ''), 'franchise'));
    new.ordering_method := lower(coalesce(nullif(trim(new.ordering_method), ''), 'publication'));
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := coalesce(new.updated_at, new.created_at);
    new.created_by := actor_profile_id;
    new.updated_by := actor_profile_id;
    new.row_version := coalesce(new.row_version, 1);

    return new;
  end if;

  actor_profile_id := public.current_profile_id();
  if actor_profile_id is null then
    raise exception 'authenticated profile required to update series' using errcode = '42501';
  end if;

  new.id := old.id;
  new.created_at := old.created_at;
  new.created_by := old.created_by;
  new.updated_at := now();
  new.updated_by := actor_profile_id;
  new.row_version := old.row_version + 1;

  return new;
end;
$$;

create or replace function public.set_task03_work_series_fields()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  actor_profile_id uuid;
begin
  if tg_op = 'INSERT' then
    actor_profile_id := public.current_profile_id();
    if actor_profile_id is null then
      raise exception 'authenticated profile required to insert work series' using errcode = '42501';
    end if;

    new.is_canonical := coalesce(new.is_canonical, true);
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := coalesce(new.updated_at, new.created_at);
    new.created_by := actor_profile_id;
    new.updated_by := actor_profile_id;
    new.row_version := coalesce(new.row_version, 1);

    return new;
  end if;

  actor_profile_id := public.current_profile_id();
  if actor_profile_id is null then
    raise exception 'authenticated profile required to update work series' using errcode = '42501';
  end if;

  new.series_id := old.series_id;
  new.work_id := old.work_id;
  new.created_at := old.created_at;
  new.created_by := old.created_by;
  new.updated_at := now();
  new.updated_by := actor_profile_id;
  new.row_version := old.row_version + 1;

  return new;
end;
$$;

create or replace function public.set_task03_work_relation_fields()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  actor_profile_id uuid;
begin
  if tg_op = 'INSERT' then
    actor_profile_id := public.current_profile_id();
    if actor_profile_id is null then
      raise exception 'authenticated profile required to insert work relation' using errcode = '42501';
    end if;

    new.relation_type := lower(trim(new.relation_type));
    new.directionality := lower(coalesce(nullif(trim(new.directionality), ''), 'directed'));
    new.created_source := lower(coalesce(nullif(trim(new.created_source), ''), 'user_manual'));
    new.verified := coalesce(new.verified, false);
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := coalesce(new.updated_at, new.created_at);
    new.created_by := actor_profile_id;
    new.updated_by := actor_profile_id;
    new.row_version := coalesce(new.row_version, 1);

    return new;
  end if;

  actor_profile_id := public.current_profile_id();
  if actor_profile_id is null then
    raise exception 'authenticated profile required to update work relation' using errcode = '42501';
  end if;

  new.from_work_id := old.from_work_id;
  new.to_work_id := old.to_work_id;
  new.relation_type := old.relation_type;
  new.created_at := old.created_at;
  new.created_by := old.created_by;
  new.updated_at := now();
  new.updated_by := actor_profile_id;
  new.row_version := old.row_version + 1;

  return new;
end;
$$;

create trigger set_series_task03_fields
before insert or update on public.series
for each row execute function public.set_task03_series_fields();

create trigger set_work_series_task03_fields
before insert or update on public.work_series
for each row execute function public.set_task03_work_series_fields();

create trigger set_work_relations_task03_fields
before insert or update on public.work_relations
for each row execute function public.set_task03_work_relation_fields();

create or replace function public.validate_external_id_target()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.target_type = 'work' then
    if not exists (select 1 from public.works w where w.id = new.target_id and w.deleted_at is null) then
      raise exception 'external id work target does not exist' using errcode = '23503';
    end if;
  elsif new.target_type = 'edition' then
    if not exists (select 1 from public.editions e where e.id = new.target_id and e.deleted_at is null) then
      raise exception 'external id edition target does not exist' using errcode = '23503';
    end if;
  elsif new.target_type = 'series' then
    if not exists (select 1 from public.series s where s.id = new.target_id and s.deleted_at is null) then
      raise exception 'external id series target does not exist' using errcode = '23503';
    end if;
  else
    raise exception 'external id target type is reserved for a later task' using errcode = '23503';
  end if;

  return new;
end;
$$;

create or replace function public.task03_series_parent_insert_allowed(input_parent_series_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    input_parent_series_id is null
    or exists (
      select 1
      from public.series s
      where s.id = input_parent_series_id
        and s.created_by = (select public.current_profile_id())
        and s.deleted_at is null
    );
$$;

alter table public.series enable row level security;
alter table public.series force row level security;
alter table public.work_series enable row level security;
alter table public.work_series force row level security;
alter table public.work_relations enable row level security;
alter table public.work_relations force row level security;

create policy series_public_select
on public.series
for select
to anon, authenticated
using (deleted_at is null);

create policy series_creator_select
on public.series
for select
to authenticated
using (
  created_by = (select public.current_profile_id())
  and deleted_at is null
);

create policy series_authenticated_insert
on public.series
for insert
to authenticated
with check (
  created_by = (select public.current_profile_id())
  and deleted_at is null
  and public.task03_series_parent_insert_allowed(parent_series_id)
);

create policy work_series_public_select
on public.work_series
for select
to anon, authenticated
using (
  deleted_at is null
  and exists (
    select 1
    from public.series s
    where s.id = work_series.series_id
      and s.deleted_at is null
  )
  and exists (
    select 1
    from public.works w
    where w.id = work_series.work_id
      and w.deleted_at is null
      and w.visibility_scope = 'global_public'
  )
);

create policy work_series_creator_select
on public.work_series
for select
to authenticated
using (
  created_by = (select public.current_profile_id())
  and deleted_at is null
);

create policy work_series_authenticated_insert
on public.work_series
for insert
to authenticated
with check (
  created_by = (select public.current_profile_id())
  and deleted_at is null
  and exists (
    select 1
    from public.series s
    where s.id = work_series.series_id
      and s.created_by = (select public.current_profile_id())
      and s.deleted_at is null
  )
  and exists (
    select 1
    from public.works w
    where w.id = work_series.work_id
      and w.created_by = (select public.current_profile_id())
      and w.deleted_at is null
  )
);

create policy work_relations_public_select
on public.work_relations
for select
to anon, authenticated
using (
  deleted_at is null
  and exists (
    select 1
    from public.works w
    where w.id = work_relations.from_work_id
      and w.deleted_at is null
      and w.visibility_scope = 'global_public'
  )
  and exists (
    select 1
    from public.works w
    where w.id = work_relations.to_work_id
      and w.deleted_at is null
      and w.visibility_scope = 'global_public'
  )
);

create policy work_relations_creator_select
on public.work_relations
for select
to authenticated
using (
  created_by = (select public.current_profile_id())
  and deleted_at is null
);

create policy work_relations_authenticated_insert
on public.work_relations
for insert
to authenticated
with check (
  created_by = (select public.current_profile_id())
  and deleted_at is null
  and exists (
    select 1
    from public.works w
    where w.id = work_relations.from_work_id
      and w.created_by = (select public.current_profile_id())
      and w.deleted_at is null
  )
  and exists (
    select 1
    from public.works w
    where w.id = work_relations.to_work_id
      and w.created_by = (select public.current_profile_id())
      and w.deleted_at is null
  )
);

drop policy if exists external_ids_public_select on public.external_ids;
drop policy if exists external_ids_authenticated_insert on public.external_ids;

create policy external_ids_public_select
on public.external_ids
for select
to anon, authenticated
using (
  deleted_at is null
  and (
    (
      target_type = 'work'
      and exists (
        select 1
        from public.works w
        where w.id = external_ids.target_id
          and w.deleted_at is null
          and w.visibility_scope = 'global_public'
      )
    )
    or (
      target_type = 'edition'
      and exists (
        select 1
        from public.editions e
        join public.works w on w.id = e.work_id
        where e.id = external_ids.target_id
          and e.deleted_at is null
          and w.deleted_at is null
          and w.visibility_scope = 'global_public'
      )
    )
    or (
      target_type = 'series'
      and exists (
        select 1
        from public.series s
        where s.id = external_ids.target_id
          and s.deleted_at is null
      )
    )
  )
);

create policy external_ids_authenticated_insert
on public.external_ids
for insert
to authenticated
with check (
  created_by = (select public.current_profile_id())
  and deleted_at is null
  and (
    (
      target_type = 'work'
      and exists (
        select 1
        from public.works w
        where w.id = external_ids.target_id
          and w.created_by = (select public.current_profile_id())
          and w.deleted_at is null
      )
    )
    or (
      target_type = 'edition'
      and exists (
        select 1
        from public.editions e
        where e.id = external_ids.target_id
          and e.created_by = (select public.current_profile_id())
          and e.deleted_at is null
      )
    )
    or (
      target_type = 'series'
      and exists (
        select 1
        from public.series s
        where s.id = external_ids.target_id
          and s.created_by = (select public.current_profile_id())
          and s.deleted_at is null
      )
    )
  )
);

revoke all on public.series from anon, authenticated;
revoke all on public.work_series from anon, authenticated;
revoke all on public.work_relations from anon, authenticated;
revoke all on function public.task03_series_parent_insert_allowed(uuid) from public;

grant select on public.series to anon, authenticated;
grant select on public.work_series to anon, authenticated;
grant select on public.work_relations to anon, authenticated;
grant insert on public.series to authenticated;
grant insert on public.work_series to authenticated;
grant insert on public.work_relations to authenticated;
grant execute on function public.task03_series_parent_insert_allowed(uuid) to authenticated;

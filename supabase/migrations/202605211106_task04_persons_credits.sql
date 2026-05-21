set search_path = public, extensions;

create table public.persons (
  id uuid primary key default public.uuid_v7(),
  canonical_name text not null,
  original_name text,
  disambiguation text,
  localized_names_json jsonb not null default '{}'::jsonb,
  name_variants_json jsonb not null default '[]'::jsonb,
  bio_json jsonb not null default '{}'::jsonb,
  search_vector tsvector,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id),
  row_version integer not null default 1,
  delete_reason text,
  constraint persons_canonical_name_not_blank check (length(trim(canonical_name)) > 0),
  constraint persons_original_name_not_blank check (original_name is null or length(trim(original_name)) > 0),
  constraint persons_disambiguation_not_blank check (disambiguation is null or length(trim(disambiguation)) > 0),
  constraint persons_localized_names_object check (jsonb_typeof(localized_names_json) = 'object'),
  constraint persons_name_variants_array check (jsonb_typeof(name_variants_json) = 'array'),
  constraint persons_bio_object check (jsonb_typeof(bio_json) = 'object')
);

create index idx_persons_canonical_name_trgm
  on public.persons using gin (canonical_name gin_trgm_ops)
  where deleted_at is null;
create index idx_persons_search_vector
  on public.persons using gin (search_vector)
  where deleted_at is null;

create table public.work_credits (
  id uuid primary key default public.uuid_v7(),
  work_id uuid not null references public.works(id) on delete restrict,
  person_id uuid not null references public.persons(id) on delete restrict,
  role text not null,
  character_name text,
  billing_order integer,
  uncredited boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id),
  row_version integer not null default 1,
  delete_reason text,
  constraint work_credits_role_check check (
    role in ('author', 'director', 'actor', 'translator', 'illustrator', 'composer')
  ),
  constraint work_credits_character_name_not_blank check (
    character_name is null or length(trim(character_name)) > 0
  ),
  constraint work_credits_billing_order_positive check (billing_order is null or billing_order > 0)
);

create index idx_work_credits_work_role
  on public.work_credits(work_id, role)
  where deleted_at is null;
create index idx_work_credits_person_role
  on public.work_credits(person_id, role)
  where deleted_at is null;

create or replace function public.set_task04_person_fields()
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
      raise exception 'authenticated profile required to insert person' using errcode = '42501';
    end if;

    new.id := coalesce(new.id, public.uuid_v7());
    new.canonical_name := trim(regexp_replace(new.canonical_name, '\s+', ' ', 'g'));
    new.original_name := nullif(trim(regexp_replace(coalesce(new.original_name, ''), '\s+', ' ', 'g')), '');
    new.disambiguation := nullif(trim(regexp_replace(coalesce(new.disambiguation, ''), '\s+', ' ', 'g')), '');
    new.localized_names_json := coalesce(new.localized_names_json, '{}'::jsonb);
    new.name_variants_json := coalesce(new.name_variants_json, '[]'::jsonb);
    new.bio_json := coalesce(new.bio_json, '{}'::jsonb);
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := coalesce(new.updated_at, new.created_at);
    new.created_by := actor_profile_id;
    new.updated_by := actor_profile_id;
    new.row_version := coalesce(new.row_version, 1);

    return new;
  end if;

  actor_profile_id := public.current_profile_id();
  if actor_profile_id is null then
    raise exception 'authenticated profile required to update person' using errcode = '42501';
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

create or replace function public.set_task04_work_credit_fields()
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
      raise exception 'authenticated profile required to insert work credit' using errcode = '42501';
    end if;

    new.id := coalesce(new.id, public.uuid_v7());
    new.role := lower(trim(new.role));
    new.character_name := nullif(trim(regexp_replace(coalesce(new.character_name, ''), '\s+', ' ', 'g')), '');
    new.uncredited := coalesce(new.uncredited, false);
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := coalesce(new.updated_at, new.created_at);
    new.created_by := actor_profile_id;
    new.updated_by := actor_profile_id;
    new.row_version := coalesce(new.row_version, 1);

    return new;
  end if;

  actor_profile_id := public.current_profile_id();
  if actor_profile_id is null then
    raise exception 'authenticated profile required to update work credit' using errcode = '42501';
  end if;

  new.id := old.id;
  new.work_id := old.work_id;
  new.person_id := old.person_id;
  new.role := old.role;
  new.created_at := old.created_at;
  new.created_by := old.created_by;
  new.updated_at := now();
  new.updated_by := actor_profile_id;
  new.row_version := old.row_version + 1;

  return new;
end;
$$;

create trigger set_persons_task04_fields
before insert or update on public.persons
for each row execute function public.set_task04_person_fields();

create trigger set_work_credits_task04_fields
before insert or update on public.work_credits
for each row execute function public.set_task04_work_credit_fields();

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
  elsif new.target_type = 'person' then
    if not exists (select 1 from public.persons p where p.id = new.target_id and p.deleted_at is null) then
      raise exception 'external id person target does not exist' using errcode = '23503';
    end if;
  else
    raise exception 'external id target type is unsupported' using errcode = '23503';
  end if;

  return new;
end;
$$;

do $$
begin
  if exists (
    select 1
    from public.series s
    where s.primary_creator_id is not null
      and not exists (
        select 1
        from public.persons p
        where p.id = s.primary_creator_id
      )
  ) then
    raise exception 'series.primary_creator_id contains values without matching persons rows';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'series_primary_creator_id_fkey'
      and conrelid = 'public.series'::regclass
  ) then
    alter table public.series
      add constraint series_primary_creator_id_fkey
      foreign key (primary_creator_id) references public.persons(id) on delete restrict;
  end if;
end $$;

comment on column public.series.primary_creator_id is
  'Nullable foreign key to persons(id), added in Task 04 after persons exists.';

alter table public.persons enable row level security;
alter table public.persons force row level security;
alter table public.work_credits enable row level security;
alter table public.work_credits force row level security;

create policy persons_public_select
on public.persons
for select
to anon, authenticated
using (deleted_at is null);

create policy persons_authenticated_insert
on public.persons
for insert
to authenticated
with check (
  created_by = (select public.current_profile_id())
  and deleted_at is null
);

create policy work_credits_public_select
on public.work_credits
for select
to anon, authenticated
using (
  deleted_at is null
  and exists (
    select 1
    from public.works w
    where w.id = work_credits.work_id
      and w.deleted_at is null
      and w.visibility_scope = 'global_public'
  )
  and exists (
    select 1
    from public.persons p
    where p.id = work_credits.person_id
      and p.deleted_at is null
  )
);

create policy work_credits_authenticated_insert
on public.work_credits
for insert
to authenticated
with check (
  created_by = (select public.current_profile_id())
  and deleted_at is null
  and exists (
    select 1
    from public.works w
    where w.id = work_credits.work_id
      and w.created_by = (select public.current_profile_id())
      and w.deleted_at is null
  )
  and exists (
    select 1
    from public.persons p
    where p.id = work_credits.person_id
      and p.created_by = (select public.current_profile_id())
      and p.deleted_at is null
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
    or (
      target_type = 'person'
      and exists (
        select 1
        from public.persons p
        where p.id = external_ids.target_id
          and p.deleted_at is null
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
    or (
      target_type = 'person'
      and exists (
        select 1
        from public.persons p
        where p.id = external_ids.target_id
          and p.created_by = (select public.current_profile_id())
          and p.deleted_at is null
      )
    )
  )
);

revoke all on public.persons from anon, authenticated;
revoke all on public.work_credits from anon, authenticated;

grant select on public.persons to anon, authenticated;
grant select on public.work_credits to anon, authenticated;
grant insert on public.persons to authenticated;
grant insert on public.work_credits to authenticated;

create extension if not exists pg_trgm with schema extensions;

set search_path = public, extensions;

create or replace function public.normalize_work_title(input_title text)
returns text
language sql
immutable
as $$
  select trim(regexp_replace(lower(coalesce(input_title, '')), '\s+', ' ', 'g'));
$$;

create table public.works (
  id uuid primary key default public.uuid_v7(),
  media_type text not null,
  canonical_title text not null,
  original_title text,
  localized_titles_json jsonb not null default '{}'::jsonb,
  description text,
  localized_descriptions_json jsonb not null default '{}'::jsonb,
  original_language text,
  first_release_year integer,
  visibility_scope text not null default 'global_public',
  promotion_status text not null default 'promoted',
  created_via text not null default 'manual_global',
  metadata_json jsonb not null default '{}'::jsonb,
  metadata_version integer not null default 1,
  metadata_locked boolean not null default false,
  fingerprint text not null,
  dedup_skipped_reason text,
  search_vector tsvector,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id),
  row_version integer not null default 1,
  delete_reason text,
  constraint works_media_type_check check (media_type in ('book', 'movie')),
  constraint works_canonical_title_not_blank check (length(trim(canonical_title)) > 0),
  constraint works_original_title_not_blank check (original_title is null or length(trim(original_title)) > 0),
  constraint works_original_language_not_blank check (original_language is null or length(trim(original_language)) > 0),
  constraint works_first_release_year_check check (first_release_year is null or first_release_year between 0 and 3000),
  constraint works_visibility_scope_check check (visibility_scope in ('global_public', 'private_to_creator')),
  constraint works_promotion_status_check check (promotion_status in ('private', 'promotion_requested', 'promoted')),
  constraint works_created_via_check check (created_via in ('provider', 'manual_global', 'manual_private')),
  constraint works_localized_titles_object check (jsonb_typeof(localized_titles_json) = 'object'),
  constraint works_localized_descriptions_object check (jsonb_typeof(localized_descriptions_json) = 'object'),
  constraint works_metadata_object check (jsonb_typeof(metadata_json) = 'object'),
  constraint works_metadata_version_positive check (metadata_version > 0),
  constraint works_fingerprint_not_blank check (length(trim(fingerprint)) > 0)
);

create unique index works_fingerprint_key on public.works(fingerprint);
create index idx_works_media_type on public.works(media_type);
create index idx_works_release_year on public.works(first_release_year);
create index idx_works_canonical_title_trgm
  on public.works using gin (canonical_title gin_trgm_ops)
  where deleted_at is null;

create table public.editions (
  id uuid primary key default public.uuid_v7(),
  work_id uuid not null references public.works(id) on delete restrict,
  title text not null,
  subtitle text,
  localized_titles_json jsonb not null default '{}'::jsonb,
  cover_url text,
  language text,
  edition_type text not null default 'default',
  publisher text,
  page_count integer,
  runtime_minutes integer,
  release_date date,
  is_default boolean not null default false,
  metadata_json jsonb not null default '{}'::jsonb,
  search_vector tsvector,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id),
  row_version integer not null default 1,
  delete_reason text,
  constraint editions_title_not_blank check (length(trim(title)) > 0),
  constraint editions_subtitle_not_blank check (subtitle is null or length(trim(subtitle)) > 0),
  constraint editions_language_not_blank check (language is null or length(trim(language)) > 0),
  constraint editions_edition_type_not_blank check (length(trim(edition_type)) > 0),
  constraint editions_page_count_positive check (page_count is null or page_count > 0),
  constraint editions_runtime_minutes_positive check (runtime_minutes is null or runtime_minutes > 0),
  constraint editions_localized_titles_object check (jsonb_typeof(localized_titles_json) = 'object'),
  constraint editions_metadata_object check (jsonb_typeof(metadata_json) = 'object')
);

create index idx_editions_work_id on public.editions(work_id);
create index idx_editions_title_trgm
  on public.editions using gin (title gin_trgm_ops)
  where deleted_at is null;
create unique index editions_one_default_per_work
  on public.editions(work_id)
  where is_default and deleted_at is null;

create table public.external_ids (
  id uuid primary key default public.uuid_v7(),
  target_type text not null,
  target_id uuid not null,
  source text not null,
  external_id text not null,
  source_url text,
  match_method text not null default 'manual',
  confidence_score numeric(4, 3),
  verified_by_user boolean not null default true,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id),
  row_version integer not null default 1,
  delete_reason text,
  constraint external_ids_target_type_check check (target_type in ('work', 'edition', 'person', 'series')),
  constraint external_ids_source_not_blank check (length(trim(source)) > 0),
  constraint external_ids_external_id_not_blank check (length(trim(external_id)) > 0),
  constraint external_ids_source_url_not_blank check (source_url is null or length(trim(source_url)) > 0),
  constraint external_ids_match_method_check check (match_method in ('manual', 'provider', 'import', 'user_verified')),
  constraint external_ids_confidence_score_check check (confidence_score is null or confidence_score between 0 and 1),
  constraint external_ids_metadata_object check (jsonb_typeof(metadata_json) = 'object'),
  unique (source, external_id)
);

create index idx_external_ids_target on public.external_ids(target_type, target_id);
create index idx_external_ids_source_external_id on public.external_ids(source, external_id);

create or replace function public.set_task02_work_fields()
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
      raise exception 'authenticated profile required to insert work' using errcode = '42501';
    end if;

    new.id := coalesce(new.id, public.uuid_v7());
    new.media_type := lower(trim(new.media_type));
    new.canonical_title := trim(regexp_replace(new.canonical_title, '\s+', ' ', 'g'));
    new.original_title := nullif(trim(regexp_replace(coalesce(new.original_title, ''), '\s+', ' ', 'g')), '');
    new.original_language := nullif(trim(coalesce(new.original_language, '')), '');
    new.localized_titles_json := coalesce(new.localized_titles_json, '{}'::jsonb);
    new.localized_descriptions_json := coalesce(new.localized_descriptions_json, '{}'::jsonb);
    new.metadata_json := coalesce(new.metadata_json, '{}'::jsonb);
    new.visibility_scope := coalesce(new.visibility_scope, 'global_public');
    new.promotion_status := coalesce(new.promotion_status, 'promoted');
    new.created_via := coalesce(new.created_via, 'manual_global');
    new.metadata_version := coalesce(new.metadata_version, 1);
    new.metadata_locked := coalesce(new.metadata_locked, false);
    new.fingerprint := coalesce(nullif(trim(new.fingerprint), ''), 'manual:' || new.id::text);
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := coalesce(new.updated_at, new.created_at);
    new.created_by := actor_profile_id;
    new.updated_by := actor_profile_id;
    new.row_version := coalesce(new.row_version, 1);

    return new;
  end if;

  actor_profile_id := public.current_profile_id();
  if actor_profile_id is null then
    raise exception 'authenticated profile required to update work' using errcode = '42501';
  end if;

  new.id := old.id;
  new.created_at := old.created_at;
  new.created_by := old.created_by;
  new.fingerprint := old.fingerprint;
  new.updated_at := now();
  new.updated_by := actor_profile_id;
  new.row_version := old.row_version + 1;

  return new;
end;
$$;

create or replace function public.set_task02_edition_fields()
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
      raise exception 'authenticated profile required to insert edition' using errcode = '42501';
    end if;

    new.id := coalesce(new.id, public.uuid_v7());
    new.title := trim(regexp_replace(new.title, '\s+', ' ', 'g'));
    new.subtitle := nullif(trim(regexp_replace(coalesce(new.subtitle, ''), '\s+', ' ', 'g')), '');
    new.language := nullif(trim(coalesce(new.language, '')), '');
    new.localized_titles_json := coalesce(new.localized_titles_json, '{}'::jsonb);
    new.edition_type := coalesce(nullif(trim(new.edition_type), ''), 'default');
    new.metadata_json := coalesce(new.metadata_json, '{}'::jsonb);
    new.is_default := coalesce(new.is_default, false);
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := coalesce(new.updated_at, new.created_at);
    new.created_by := actor_profile_id;
    new.updated_by := actor_profile_id;
    new.row_version := coalesce(new.row_version, 1);

    return new;
  end if;

  actor_profile_id := public.current_profile_id();
  if actor_profile_id is null then
    raise exception 'authenticated profile required to update edition' using errcode = '42501';
  end if;

  new.id := old.id;
  new.work_id := old.work_id;
  new.created_at := old.created_at;
  new.created_by := old.created_by;
  new.updated_at := now();
  new.updated_by := actor_profile_id;
  new.row_version := old.row_version + 1;

  return new;
end;
$$;

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
  else
    raise exception 'external id target type is reserved for a later task' using errcode = '23503';
  end if;

  return new;
end;
$$;

create or replace function public.set_task02_external_id_fields()
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
      raise exception 'authenticated profile required to insert external id' using errcode = '42501';
    end if;

    new.id := coalesce(new.id, public.uuid_v7());
    new.target_type := lower(trim(new.target_type));
    new.source := lower(trim(new.source));
    new.external_id := trim(new.external_id);
    new.source_url := nullif(trim(coalesce(new.source_url, '')), '');
    new.match_method := coalesce(nullif(trim(new.match_method), ''), 'manual');
    new.verified_by_user := coalesce(new.verified_by_user, true);
    new.metadata_json := coalesce(new.metadata_json, '{}'::jsonb);
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := coalesce(new.updated_at, new.created_at);
    new.created_by := actor_profile_id;
    new.updated_by := actor_profile_id;
    new.row_version := coalesce(new.row_version, 1);

    return new;
  end if;

  actor_profile_id := public.current_profile_id();
  if actor_profile_id is null then
    raise exception 'authenticated profile required to update external id' using errcode = '42501';
  end if;

  new.id := old.id;
  new.target_type := old.target_type;
  new.target_id := old.target_id;
  new.source := old.source;
  new.external_id := old.external_id;
  new.created_at := old.created_at;
  new.created_by := old.created_by;
  new.updated_at := now();
  new.updated_by := actor_profile_id;
  new.row_version := old.row_version + 1;

  return new;
end;
$$;

create trigger set_works_task02_fields
before insert or update on public.works
for each row execute function public.set_task02_work_fields();

create trigger set_editions_task02_fields
before insert or update on public.editions
for each row execute function public.set_task02_edition_fields();

create trigger validate_external_ids_task02_target
before insert or update on public.external_ids
for each row execute function public.validate_external_id_target();

create trigger set_external_ids_task02_fields
before insert or update on public.external_ids
for each row execute function public.set_task02_external_id_fields();

create or replace function public.create_default_edition_for_work()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  insert into public.editions (
    work_id,
    title,
    language,
    edition_type,
    is_default,
    metadata_json
  )
  values (
    new.id,
    new.canonical_title,
    new.original_language,
    'default',
    true,
    '{}'::jsonb
  );

  return new;
end;
$$;

create trigger create_default_edition_after_work_insert
after insert on public.works
for each row execute function public.create_default_edition_for_work();

create or replace function public.find_work_duplicates(
  input_media_type text,
  input_title text,
  input_year integer default null
)
returns table (
  work_id uuid,
  canonical_title text,
  first_release_year integer,
  similarity_score numeric
)
language sql
stable
set search_path = public, extensions
as $$
  select
    w.id,
    w.canonical_title,
    w.first_release_year,
    round(similarity(public.normalize_work_title(w.canonical_title), public.normalize_work_title(input_title))::numeric, 3) as similarity_score
  from public.works w
  where w.deleted_at is null
    and w.media_type = lower(trim(input_media_type))
    and similarity(public.normalize_work_title(w.canonical_title), public.normalize_work_title(input_title)) >= 0.85
    and (
      input_year is null
      or w.first_release_year is null
      or abs(w.first_release_year - input_year) <= 1
    )
  order by similarity_score desc, w.first_release_year nulls last, w.created_at asc
  limit 10;
$$;

create or replace function public.create_manual_work(
  input_media_type text,
  input_title text,
  input_year integer default null,
  input_original_title text default null,
  input_original_language text default null,
  input_external_source text default null,
  input_external_id text default null,
  input_dedup_override boolean default false,
  input_dedup_skipped_reason text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  actor_profile_id uuid;
  normalized_media_type text;
  normalized_title text;
  normalized_original_title text;
  normalized_original_language text;
  normalized_external_source text;
  normalized_external_id text;
  normalized_reason text;
  duplicate_candidates jsonb;
  new_work_id uuid;
  new_default_edition_id uuid;
  work_fingerprint text;
begin
  actor_profile_id := public.current_profile_id();
  if actor_profile_id is null then
    raise exception 'authenticated profile required to create manual work' using errcode = '42501';
  end if;

  normalized_media_type := lower(trim(coalesce(input_media_type, '')));
  normalized_title := trim(regexp_replace(coalesce(input_title, ''), '\s+', ' ', 'g'));
  normalized_original_title := nullif(trim(regexp_replace(coalesce(input_original_title, ''), '\s+', ' ', 'g')), '');
  normalized_original_language := nullif(trim(coalesce(input_original_language, '')), '');
  normalized_external_source := nullif(lower(trim(coalesce(input_external_source, ''))), '');
  normalized_external_id := nullif(trim(coalesce(input_external_id, '')), '');
  normalized_reason := nullif(trim(coalesce(input_dedup_skipped_reason, '')), '');

  if normalized_title = '' then
    raise exception 'title is required' using errcode = '23514';
  end if;

  if (normalized_external_source is null) <> (normalized_external_id is null) then
    raise exception 'external source and external id must be provided together' using errcode = '23514';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'work_id', d.work_id,
        'canonical_title', d.canonical_title,
        'first_release_year', d.first_release_year,
        'similarity_score', d.similarity_score
      )
      order by d.similarity_score desc
    ),
    '[]'::jsonb
  )
  into duplicate_candidates
  from public.find_work_duplicates(normalized_media_type, normalized_title, input_year) d;

  if jsonb_array_length(duplicate_candidates) > 0 and not coalesce(input_dedup_override, false) then
    return jsonb_build_object(
      'status', 'duplicate_found',
      'candidates', duplicate_candidates
    );
  end if;

  if jsonb_array_length(duplicate_candidates) > 0 and normalized_reason is null then
    raise exception 'dedup skipped reason is required when overriding duplicate candidates' using errcode = '23514';
  end if;

  if normalized_external_source is not null then
    work_fingerprint := 'external:' || normalized_external_source || ':' || normalized_external_id;
  end if;

  insert into public.works (
    media_type,
    canonical_title,
    original_title,
    original_language,
    first_release_year,
    visibility_scope,
    promotion_status,
    created_via,
    fingerprint,
    dedup_skipped_reason
  )
  values (
    normalized_media_type,
    normalized_title,
    normalized_original_title,
    normalized_original_language,
    input_year,
    'global_public',
    'promoted',
    'manual_global',
    work_fingerprint,
    normalized_reason
  )
  returning id into new_work_id;

  select e.id
  into new_default_edition_id
  from public.editions e
  where e.work_id = new_work_id
    and e.is_default
    and e.deleted_at is null
  limit 1;

  if new_default_edition_id is null then
    raise exception 'default edition was not created for work %', new_work_id using errcode = '23514';
  end if;

  if normalized_external_source is not null then
    insert into public.external_ids (
      target_type,
      target_id,
      source,
      external_id,
      match_method,
      confidence_score,
      verified_by_user
    )
    values (
      'work',
      new_work_id,
      normalized_external_source,
      normalized_external_id,
      'manual',
      1.000,
      true
    );
  end if;

  return jsonb_build_object(
    'status', 'created',
    'work_id', new_work_id,
    'default_edition_id', new_default_edition_id,
    'candidates', duplicate_candidates
  );
end;
$$;

alter table public.works enable row level security;
alter table public.works force row level security;
alter table public.editions enable row level security;
alter table public.editions force row level security;
alter table public.external_ids enable row level security;
alter table public.external_ids force row level security;

create policy works_public_select
on public.works
for select
to anon, authenticated
using (
  deleted_at is null
  and visibility_scope = 'global_public'
);

create policy works_creator_select
on public.works
for select
to authenticated
using (
  created_by = (select public.current_profile_id())
  and deleted_at is null
);

create policy works_authenticated_insert
on public.works
for insert
to authenticated
with check (
  created_by = (select public.current_profile_id())
  and deleted_at is null
  and visibility_scope = 'global_public'
  and promotion_status = 'promoted'
  and created_via = 'manual_global'
);

create policy editions_public_select
on public.editions
for select
to anon, authenticated
using (
  deleted_at is null
  and exists (
    select 1
    from public.works w
    where w.id = editions.work_id
      and w.deleted_at is null
      and w.visibility_scope = 'global_public'
  )
);

create policy editions_creator_select
on public.editions
for select
to authenticated
using (
  created_by = (select public.current_profile_id())
  and deleted_at is null
);

create policy editions_authenticated_insert
on public.editions
for insert
to authenticated
with check (
  created_by = (select public.current_profile_id())
  and deleted_at is null
  and exists (
    select 1
    from public.works w
    where w.id = editions.work_id
      and w.created_by = (select public.current_profile_id())
      and w.deleted_at is null
  )
);

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
  )
);

create policy external_ids_creator_select
on public.external_ids
for select
to authenticated
using (
  created_by = (select public.current_profile_id())
  and deleted_at is null
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
  )
);

revoke all on public.works from anon, authenticated;
revoke all on public.editions from anon, authenticated;
revoke all on public.external_ids from anon, authenticated;
revoke all on function public.normalize_work_title(text) from public;
revoke all on function public.find_work_duplicates(text, text, integer) from public;
revoke all on function public.create_manual_work(text, text, integer, text, text, text, text, boolean, text) from public;

grant select on public.works to anon, authenticated;
grant select on public.editions to anon, authenticated;
grant select on public.external_ids to anon, authenticated;
grant insert on public.works to authenticated;
grant insert on public.editions to authenticated;
grant insert on public.external_ids to authenticated;
grant execute on function public.normalize_work_title(text) to anon, authenticated;
grant execute on function public.find_work_duplicates(text, text, integer) to anon, authenticated;
grant execute on function public.create_manual_work(text, text, integer, text, text, text, text, boolean, text) to authenticated;

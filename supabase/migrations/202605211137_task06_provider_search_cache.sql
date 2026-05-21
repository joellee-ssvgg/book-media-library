set search_path = public, extensions;

create table public.provider_search_cache (
  id uuid primary key default public.uuid_v7(),
  query_hash text not null,
  media_type text not null,
  provider text not null,
  query_json jsonb not null default '{}'::jsonb,
  results_json jsonb not null default '[]'::jsonb,
  negative boolean not null default false,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  row_version integer not null default 1,
  constraint provider_search_cache_media_type_check check (media_type in ('book', 'movie')),
  constraint provider_search_cache_provider_check check (
    provider in ('openlibrary', 'googlebooks', 'tmdb', 'manual')
  ),
  constraint provider_search_cache_query_hash_not_blank check (length(trim(query_hash)) > 0),
  constraint provider_search_cache_query_json_object check (jsonb_typeof(query_json) = 'object'),
  constraint provider_search_cache_results_json_array check (jsonb_typeof(results_json) = 'array'),
  constraint provider_search_cache_expires_after_created check (expires_at > created_at),
  constraint provider_search_cache_row_version_positive check (row_version > 0)
);

create unique index provider_search_cache_key
  on public.provider_search_cache(media_type, provider, query_hash);
create index idx_provider_search_cache_lookup
  on public.provider_search_cache(media_type, provider, query_hash, expires_at);
create index idx_provider_search_cache_expires_at
  on public.provider_search_cache(expires_at);

create or replace function public.set_task06_provider_search_cache_fields()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if tg_op = 'INSERT' then
    new.id := coalesce(new.id, public.uuid_v7());
    new.query_hash := lower(trim(new.query_hash));
    new.media_type := lower(trim(new.media_type));
    new.provider := lower(trim(new.provider));
    new.query_json := coalesce(new.query_json, '{}'::jsonb);
    new.results_json := coalesce(new.results_json, '[]'::jsonb);
    new.negative := coalesce(new.negative, false);
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := coalesce(new.updated_at, new.created_at);
    new.row_version := coalesce(new.row_version, 1);

    return new;
  end if;

  new.id := old.id;
  new.query_hash := old.query_hash;
  new.media_type := old.media_type;
  new.provider := old.provider;
  new.query_json := coalesce(new.query_json, '{}'::jsonb);
  new.results_json := coalesce(new.results_json, '[]'::jsonb);
  new.negative := coalesce(new.negative, false);
  new.created_at := old.created_at;
  new.updated_at := now();
  new.row_version := old.row_version + 1;

  return new;
end;
$$;

create trigger set_provider_search_cache_task06_fields
before insert or update on public.provider_search_cache
for each row execute function public.set_task06_provider_search_cache_fields();

alter table public.provider_search_cache enable row level security;
alter table public.provider_search_cache force row level security;

create or replace function public.get_provider_search_cache(
  input_media_type text,
  input_provider text,
  input_query_hash text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  actor_profile_id uuid;
  cache_payload jsonb;
begin
  actor_profile_id := public.current_profile_id();
  if actor_profile_id is null then
    raise exception 'authenticated profile required to read provider cache' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'id', c.id,
    'query_hash', c.query_hash,
    'media_type', c.media_type,
    'provider', c.provider,
    'query_json', c.query_json,
    'results_json', c.results_json,
    'negative', c.negative,
    'expires_at', c.expires_at
  )
  into cache_payload
  from public.provider_search_cache c
  where c.media_type = lower(trim(coalesce(input_media_type, '')))
    and c.provider = lower(trim(coalesce(input_provider, '')))
    and c.query_hash = lower(trim(coalesce(input_query_hash, '')))
    and c.expires_at > now()
  limit 1;

  return cache_payload;
end;
$$;

create or replace function public.upsert_provider_search_cache(
  input_media_type text,
  input_provider text,
  input_query_hash text,
  input_query_json jsonb default '{}'::jsonb,
  input_results_json jsonb default '[]'::jsonb,
  input_negative boolean default false
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, auth, extensions
as $$
declare
  actor_profile_id uuid;
  normalized_media_type text;
  normalized_provider text;
  normalized_query_hash text;
  cache_expires_at timestamptz;
  cache_payload jsonb;
begin
  actor_profile_id := public.current_profile_id();
  if actor_profile_id is null then
    raise exception 'authenticated profile required to write provider cache' using errcode = '42501';
  end if;

  normalized_media_type := lower(trim(coalesce(input_media_type, '')));
  normalized_provider := lower(trim(coalesce(input_provider, '')));
  normalized_query_hash := lower(trim(coalesce(input_query_hash, '')));
  cache_expires_at := now() + case
    when coalesce(input_negative, false) then interval '1 hour'
    else interval '24 hours'
  end;

  insert into public.provider_search_cache (
    media_type,
    provider,
    query_hash,
    query_json,
    results_json,
    negative,
    expires_at
  ) values (
    normalized_media_type,
    normalized_provider,
    normalized_query_hash,
    coalesce(input_query_json, '{}'::jsonb),
    coalesce(input_results_json, '[]'::jsonb),
    coalesce(input_negative, false),
    cache_expires_at
  )
  on conflict (media_type, provider, query_hash)
  do update set
    query_json = excluded.query_json,
    results_json = excluded.results_json,
    negative = excluded.negative,
    expires_at = excluded.expires_at
  returning jsonb_build_object(
    'id', provider_search_cache.id,
    'query_hash', provider_search_cache.query_hash,
    'media_type', provider_search_cache.media_type,
    'provider', provider_search_cache.provider,
    'query_json', provider_search_cache.query_json,
    'results_json', provider_search_cache.results_json,
    'negative', provider_search_cache.negative,
    'expires_at', provider_search_cache.expires_at
  )
  into cache_payload;

  return cache_payload;
end;
$$;

revoke all on public.provider_search_cache from anon, authenticated;
revoke all on function public.get_provider_search_cache(text, text, text) from public;
revoke all on function public.upsert_provider_search_cache(text, text, text, jsonb, jsonb, boolean) from public;

grant execute on function public.get_provider_search_cache(text, text, text) to authenticated;
grant execute on function public.upsert_provider_search_cache(text, text, text, jsonb, jsonb, boolean) to authenticated;

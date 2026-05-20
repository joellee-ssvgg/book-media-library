create extension if not exists pgcrypto with schema extensions;

create or replace function public.uuid_v7()
returns uuid
language plpgsql
volatile
set search_path = public, extensions
as $$
declare
  timestamp_hex text;
  random_hex text;
  variant_hex text;
begin
  timestamp_hex := lpad(to_hex(floor(extract(epoch from clock_timestamp()) * 1000)::bigint), 12, '0');
  random_hex := encode(extensions.gen_random_bytes(10), 'hex');
  variant_hex := substr('89ab', (get_byte(decode(substr(random_hex, 4, 2), 'hex'), 0) % 4) + 1, 1);

  return (
    substr(timestamp_hex, 1, 8) || '-' ||
    substr(timestamp_hex, 9, 4) || '-' ||
    '7' || substr(random_hex, 1, 3) || '-' ||
    variant_hex || substr(random_hex, 4, 3) || '-' ||
    substr(random_hex, 7, 12)
  )::uuid;
end;
$$;

create table public.profiles (
  id uuid primary key default public.uuid_v7(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  username text not null,
  display_name text,
  avatar_url text,
  bio text,
  public_top3 jsonb,
  public_visibility text not null default 'public',
  onboarding_completed boolean not null default false,
  locale text not null default 'zh-CN',
  tz text not null default 'Asia/Shanghai',
  exported_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid not null,
  updated_at timestamptz not null default now(),
  updated_by uuid not null,
  deleted_at timestamptz,
  deleted_by uuid,
  row_version integer not null default 1,
  delete_reason text,
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,20}$'),
  constraint profiles_bio_length check (bio is null or char_length(bio) <= 200),
  constraint profiles_public_visibility_check check (public_visibility in ('private', 'unlisted', 'followers', 'public')),
  constraint profiles_public_top3_array check (
    public_top3 is null
    or (
      jsonb_typeof(public_top3) = 'array'
      and jsonb_array_length(public_top3) <= 3
    )
  )
);

create unique index profiles_username_lower_key on public.profiles (lower(username));
create index idx_profiles_username on public.profiles(username);
create index idx_profiles_visibility on public.profiles(public_visibility) where public_visibility != 'private';
create index idx_profiles_auth_user_id on public.profiles(auth_user_id);

create table public.auth_identities (
  id uuid primary key default public.uuid_v7(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null,
  provider_user_id text not null,
  email text,
  created_at timestamptz not null default now(),
  created_by uuid not null,
  updated_at timestamptz not null default now(),
  updated_by uuid not null,
  deleted_at timestamptz,
  deleted_by uuid,
  row_version integer not null default 1,
  delete_reason text,
  constraint auth_identities_provider_check check (provider in ('supabase', 'google', 'github', 'apple')),
  constraint auth_identities_provider_user_not_blank check (length(trim(provider_user_id)) > 0),
  constraint auth_identities_email_length check (email is null or char_length(email) <= 320),
  unique (provider, provider_user_id),
  unique (profile_id, provider, provider_user_id)
);

create index idx_auth_identities_profile on public.auth_identities(profile_id);
create index idx_auth_identities_provider_user on public.auth_identities(provider, provider_user_id);

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select p.id
  from public.profiles p
  where p.auth_user_id = (select auth.uid())
    and p.deleted_at is null
  limit 1;
$$;

revoke all on function public.current_profile_id() from public;
grant execute on function public.current_profile_id() to authenticated;

create or replace function public.set_task01_audit_fields()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  actor_profile_id uuid;
begin
  if tg_op = 'INSERT' then
    if new.id is null then
      new.id := public.uuid_v7();
    end if;

    new.created_at := coalesce(new.created_at, now());
    new.updated_at := coalesce(new.updated_at, new.created_at);
    new.row_version := coalesce(new.row_version, 1);

    if tg_table_name = 'profiles' then
      new.created_by := coalesce(new.created_by, new.id);
      new.updated_by := coalesce(new.updated_by, new.created_by);
    elsif tg_table_name = 'auth_identities' then
      new.created_by := coalesce(new.created_by, new.profile_id);
      new.updated_by := coalesce(new.updated_by, new.created_by);
    end if;

    return new;
  end if;

  actor_profile_id := public.current_profile_id();

  new.created_at := old.created_at;
  new.created_by := old.created_by;
  new.updated_at := now();
  new.updated_by := coalesce(actor_profile_id, old.updated_by, old.created_by);
  new.row_version := old.row_version + 1;

  return new;
end;
$$;

create trigger set_profiles_audit_fields
before insert or update on public.profiles
for each row execute function public.set_task01_audit_fields();

create trigger set_auth_identities_audit_fields
before insert or update on public.auth_identities
for each row execute function public.set_task01_audit_fields();

create or replace function public.build_profile_username(auth_user auth.users)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  base_username text;
  candidate text;
  suffix integer := 0;
begin
  base_username := lower(coalesce(
    auth_user.raw_user_meta_data ->> 'username',
    split_part(auth_user.email, '@', 1),
    'user'
  ));
  base_username := regexp_replace(base_username, '[^a-z0-9_]', '_', 'g');
  base_username := regexp_replace(base_username, '_+', '_', 'g');
  base_username := trim(both '_' from base_username);

  if base_username !~ '^[a-z0-9_]{3,20}$' then
    base_username := 'user_' || substr(replace(auth_user.id::text, '-', ''), 1, 12);
  end if;

  base_username := substr(base_username, 1, 20);
  candidate := base_username;

  while exists (
    select 1
    from public.profiles p
    where lower(p.username) = candidate
  ) loop
    suffix := suffix + 1;
    candidate := substr(base_username, 1, greatest(3, 20 - char_length(('_' || suffix)::text)))
      || '_' || suffix;
  end loop;

  return candidate;
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  new_profile_id uuid;
begin
  insert into public.profiles (
    auth_user_id,
    username,
    display_name,
    avatar_url
  )
  values (
    new.id,
    public.build_profile_username(new),
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (auth_user_id) do nothing
  returning id into new_profile_id;

  if new_profile_id is null then
    select id into new_profile_id
    from public.profiles
    where auth_user_id = new.id;
  end if;

  insert into public.auth_identities (
    profile_id,
    provider,
    provider_user_id,
    email
  )
  values (
    new_profile_id,
    'supabase',
    new.id::text,
    new.email
  )
  on conflict (provider, provider_user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_profile on auth.users;
create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row execute function public.handle_new_auth_user();

alter table public.profiles enable row level security;
alter table public.profiles force row level security;
alter table public.auth_identities enable row level security;
alter table public.auth_identities force row level security;

create policy profiles_owner_select
on public.profiles
for select
to authenticated
using (
  auth_user_id = (select auth.uid())
  and deleted_at is null
);

create policy profiles_owner_insert
on public.profiles
for insert
to authenticated
with check (
  auth_user_id = (select auth.uid())
  and deleted_at is null
);

create policy profiles_owner_update
on public.profiles
for update
to authenticated
using (
  auth_user_id = (select auth.uid())
  and deleted_at is null
)
with check (
  auth_user_id = (select auth.uid())
);

create policy auth_identities_owner_select
on public.auth_identities
for select
to authenticated
using (
  profile_id = (select public.current_profile_id())
  and deleted_at is null
);

create policy auth_identities_owner_update
on public.auth_identities
for update
to authenticated
using (
  profile_id = (select public.current_profile_id())
  and deleted_at is null
)
with check (
  profile_id = (select public.current_profile_id())
);

create view public.public_profile_view as
select
  p.username,
  p.display_name,
  p.avatar_url,
  p.bio,
  p.public_top3,
  p.public_visibility
from public.profiles p
where p.public_visibility in ('public', 'unlisted')
  and p.deleted_at is null;

revoke all on public.profiles from anon, authenticated;
revoke all on public.auth_identities from anon, authenticated;
revoke all on public.public_profile_view from anon, authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, update on public.auth_identities to authenticated;
grant select on public.public_profile_view to anon, authenticated;

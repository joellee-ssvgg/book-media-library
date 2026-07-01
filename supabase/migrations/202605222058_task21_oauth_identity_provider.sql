create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  new_profile_id uuid;
  identity_provider text;
  identity_provider_user_id text;
begin
  identity_provider := lower(trim(coalesce(new.raw_app_meta_data ->> 'provider', '')));

  if identity_provider not in ('github', 'google', 'apple') then
    identity_provider := 'supabase';
  end if;

  identity_provider_user_id := case
    when identity_provider = 'supabase' then new.id::text
    else coalesce(
      nullif(trim(coalesce(new.raw_user_meta_data ->> 'provider_id', '')), ''),
      nullif(trim(coalesce(new.raw_user_meta_data ->> 'sub', '')), ''),
      new.id::text
    )
  end;

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
    identity_provider,
    identity_provider_user_id,
    new.email
  )
  on conflict (provider, provider_user_id) do nothing;

  return new;
end;
$$;

with oauth_users as (
  select
    p.id as profile_id,
    p.auth_user_id,
    lower(trim(coalesce(u.raw_app_meta_data ->> 'provider', ''))) as provider,
    coalesce(
      nullif(trim(coalesce(u.raw_user_meta_data ->> 'provider_id', '')), ''),
      nullif(trim(coalesce(u.raw_user_meta_data ->> 'sub', '')), ''),
      u.id::text
    ) as provider_user_id,
    u.email
  from public.profiles p
  join auth.users u on u.id = p.auth_user_id
  where lower(trim(coalesce(u.raw_app_meta_data ->> 'provider', ''))) in ('github', 'google', 'apple')
)
insert into public.auth_identities (
  profile_id,
  provider,
  provider_user_id,
  email
)
select
  profile_id,
  provider,
  provider_user_id,
  email
from oauth_users
on conflict (provider, provider_user_id) do update
set
  profile_id = excluded.profile_id,
  email = excluded.email;

with oauth_users as (
  select
    p.id as profile_id,
    p.auth_user_id
  from public.profiles p
  join auth.users u on u.id = p.auth_user_id
  where lower(trim(coalesce(u.raw_app_meta_data ->> 'provider', ''))) in ('github', 'google', 'apple')
)
delete from public.auth_identities ai
using oauth_users ou
where ai.profile_id = ou.profile_id
  and ai.provider = 'supabase'
  and ai.provider_user_id = ou.auth_user_id::text;

-- task30: let an authenticated user change their own username.
-- Username is case-insensitively unique (profiles_username_lower_key) and changes
-- the public URL /u/<username>, so this is a dedicated RPC with conflict handling.

create or replace function public.task30_update_username(input_username text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  actor_profile_id uuid;
  v_username text := lower(btrim(coalesce(input_username, '')));
begin
  actor_profile_id := public.current_profile_id();
  if actor_profile_id is null then
    raise exception 'authenticated profile required to update username' using errcode = '42501';
  end if;

  if v_username !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'username_invalid' using errcode = '23514';
  end if;

  -- Fast, friendly pre-check against live profiles (the unique index also covers
  -- soft-deleted rows, so the exception handler below is the real safety net).
  if exists (
    select 1
    from public.profiles p
    where lower(p.username) = v_username
      and p.id <> actor_profile_id
      and p.deleted_at is null
  ) then
    raise exception 'username_taken' using errcode = '23505';
  end if;

  update public.profiles p
  set username = v_username
  where p.id = actor_profile_id
    and p.deleted_at is null;

  return jsonb_build_object(
    'status', 'updated',
    'profile_id', actor_profile_id,
    'username', v_username
  );
exception
  when unique_violation then
    raise exception 'username_taken' using errcode = '23505';
end;
$$;

revoke all on function public.task30_update_username(text) from public;
grant execute on function public.task30_update_username(text) to authenticated;

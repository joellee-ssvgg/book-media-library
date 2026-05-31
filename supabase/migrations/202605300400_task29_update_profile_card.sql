-- task29: let an authenticated user edit their own profile card (display name + bio).
-- Visibility and the public top-3 stay in task17_update_public_profile; this only
-- covers the identity fields the public-profile settings form exposes.

create or replace function public.task29_update_profile_card(
  input_display_name text default null,
  input_bio text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  actor_profile_id uuid;
  v_display_name text := nullif(btrim(coalesce(input_display_name, '')), '');
  v_bio text := nullif(btrim(coalesce(input_bio, '')), '');
begin
  actor_profile_id := public.current_profile_id();
  if actor_profile_id is null then
    raise exception 'authenticated profile required to update profile card' using errcode = '42501';
  end if;

  if v_display_name is not null and char_length(v_display_name) > 30 then
    raise exception 'display_name must be at most 30 characters' using errcode = '23514';
  end if;

  if v_bio is not null and char_length(v_bio) > 200 then
    raise exception 'bio must be at most 200 characters' using errcode = '23514';
  end if;

  update public.profiles p
  set
    display_name = v_display_name,
    bio = v_bio
  where p.id = actor_profile_id
    and p.deleted_at is null;

  return jsonb_build_object(
    'status', 'updated',
    'profile_id', actor_profile_id,
    'display_name', v_display_name,
    'bio', v_bio
  );
end;
$$;

revoke all on function public.task29_update_profile_card(text, text) from public;
grant execute on function public.task29_update_profile_card(text, text) to authenticated;

create or replace function public.task22_ensure_current_profile()
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  current_auth_user_id uuid;
  profile_record public.profiles%rowtype;
  auth_user_record auth.users%rowtype;
  deletion_request_record record;
  result_status text := 'active';
begin
  current_auth_user_id := auth.uid();
  if current_auth_user_id is null then
    raise exception 'authenticated user required to ensure profile' using errcode = '42501';
  end if;

  select p.*
  into profile_record
  from public.profiles p
  where p.auth_user_id = current_auth_user_id
  limit 1;

  if profile_record.id is null then
    select u.*
    into auth_user_record
    from auth.users u
    where u.id = current_auth_user_id;

    if auth_user_record.id is null then
      raise exception 'authenticated user does not exist' using errcode = '42501';
    end if;

    insert into public.profiles (
      auth_user_id,
      username,
      display_name,
      avatar_url
    )
    values (
      auth_user_record.id,
      public.build_profile_username(auth_user_record),
      coalesce(
        auth_user_record.raw_user_meta_data ->> 'display_name',
        auth_user_record.raw_user_meta_data ->> 'name'
      ),
      auth_user_record.raw_user_meta_data ->> 'avatar_url'
    )
    returning *
    into profile_record;

    result_status := 'created';
  end if;

  select adr.*
  into deletion_request_record
  from public.account_deletion_requests adr
  where adr.profile_id = profile_record.id
    and adr.status in ('soft_deleted', 'cooling_off')
  order by adr.created_at desc, adr.id desc
  limit 1
  for update;

  if deletion_request_record.id is not null then
    if deletion_request_record.status = 'soft_deleted'
      and deletion_request_record.soft_delete_until is not null
      and deletion_request_record.soft_delete_until <= now()
    then
      raise exception 'account deletion soft delete window has elapsed' using errcode = '42501';
    end if;

    if deletion_request_record.status = 'cooling_off'
      and deletion_request_record.cooling_until is not null
      and deletion_request_record.cooling_until <= now()
    then
      raise exception 'account deletion cooling window has elapsed' using errcode = '42501';
    end if;

    update public.account_deletion_requests adr
    set
      status = 'cancelled',
      updated_at = now(),
      metadata_json = coalesce(adr.metadata_json, '{}'::jsonb)
        || jsonb_build_object(
          'cancelled_at', public.task18_iso8601(now()),
          'cancelled_by', 'task22_login_reactivation'
        )
    where adr.id = deletion_request_record.id;

    result_status := 'reactivated';
  end if;

  if profile_record.deleted_at is not null then
    if profile_record.delete_reason = 'task18_hard_deleted_anonymized' then
      raise exception 'account profile has already been hard deleted' using errcode = '42501';
    end if;

    update public.profiles p
    set
      deleted_at = null,
      deleted_by = null,
      delete_reason = null,
      public_visibility = 'private'
    where p.id = profile_record.id
    returning *
    into profile_record;

    if result_status = 'active' then
      result_status := 'restored';
    end if;
  end if;

  select u.*
  into auth_user_record
  from auth.users u
  where u.id = current_auth_user_id;

  if auth_user_record.id is not null then
    insert into public.auth_identities (
      profile_id,
      provider,
      provider_user_id,
      email
    )
    values (
      profile_record.id,
      'supabase',
      auth_user_record.id::text,
      auth_user_record.email
    )
    on conflict (provider, provider_user_id) do nothing;
  end if;

  return jsonb_build_object(
    'username', profile_record.username,
    'status', result_status
  );
end;
$$;

revoke all on function public.task22_ensure_current_profile() from public;
grant execute on function public.task22_ensure_current_profile() to authenticated;

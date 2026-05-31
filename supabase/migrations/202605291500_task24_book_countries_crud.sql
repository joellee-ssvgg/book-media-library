create or replace function public.add_book_country(
  input_entry_id uuid,
  input_country_code text,
  input_country_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  current_profile_id uuid;
begin
  select p.id into current_profile_id
  from public.profiles p
  where p.auth_user_id = auth.uid();

  if current_profile_id is null then
    return jsonb_build_object('ok', false, 'error', 'not authenticated');
  end if;

  if not exists (
    select 1 from public.user_entries ue
    where ue.id = input_entry_id
      and ue.profile_id = current_profile_id
      and ue.deleted_at is null
  ) then
    return jsonb_build_object('ok', false, 'error', 'entry not found or not owned by you');
  end if;

  if not (input_country_code ~ '^[A-Z]{3}$') then
    return jsonb_build_object('ok', false, 'error', 'invalid country code format');
  end if;

  insert into public.book_countries (user_entry_id, country_code, country_name)
  values (input_entry_id, input_country_code, input_country_name)
  on conflict (user_entry_id, country_code) do nothing;

  return jsonb_build_object('ok', true, 'error', null);
end;
$$;

create or replace function public.remove_book_country(
  input_entry_id uuid,
  input_country_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  current_profile_id uuid;
begin
  select p.id into current_profile_id
  from public.profiles p
  where p.auth_user_id = auth.uid();

  if current_profile_id is null then
    return jsonb_build_object('ok', false, 'error', 'not authenticated');
  end if;

  delete from public.book_countries bc
  where bc.user_entry_id = input_entry_id
    and bc.country_code = input_country_code
    and exists (
      select 1 from public.user_entries ue
      where ue.id = bc.user_entry_id
        and ue.profile_id = current_profile_id
    );

  return jsonb_build_object('ok', true, 'error', null);
end;
$$;

revoke all on function public.add_book_country from public, anon;
grant execute on function public.add_book_country to authenticated;

revoke all on function public.remove_book_country from public, anon;
grant execute on function public.remove_book_country to authenticated;

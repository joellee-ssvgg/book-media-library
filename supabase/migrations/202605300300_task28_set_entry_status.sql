-- Update a library entry's status (want_to_read / reading / finished / abandoned
-- for books; want_to_watch / watching / watched / abandoned for movies).
-- Scoped to the current profile; sets started_at / finished_at on first transition.
create or replace function public.set_entry_status(
  input_entry_id uuid,
  input_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  actor_profile_id uuid;
  target public.user_entries%rowtype;
  target_media_type text;
  normalized_status text := lower(trim(coalesce(input_status, '')));
  allowed_statuses text[];
begin
  actor_profile_id := public.current_profile_id();
  if actor_profile_id is null then
    raise exception 'authenticated profile required to change status' using errcode = '42501';
  end if;

  select e.*
  into target
  from public.user_entries e
  where e.id = input_entry_id
    and e.profile_id = actor_profile_id
    and e.deleted_at is null;

  if target.id is null then
    raise exception 'entry must belong to the current profile' using errcode = '42501';
  end if;

  select w.media_type
  into target_media_type
  from public.works w
  where w.id = target.work_id;

  if target_media_type = 'movie' then
    allowed_statuses := array['want_to_watch', 'watching', 'watched', 'abandoned'];
  else
    allowed_statuses := array['want_to_read', 'reading', 'finished', 'abandoned'];
  end if;

  if not (normalized_status = any(allowed_statuses)) then
    raise exception 'invalid status % for media type %', normalized_status, target_media_type using errcode = '22023';
  end if;

  update public.user_entries
  set status = normalized_status,
      started_at = case
        when normalized_status in ('reading', 'watching') and started_at is null then now()
        else started_at
      end,
      finished_at = case
        when normalized_status in ('finished', 'watched') and finished_at is null then now()
        else finished_at
      end,
      updated_at = now(),
      updated_by = actor_profile_id,
      row_version = row_version + 1
  where id = input_entry_id;

  return jsonb_build_object(
    'ok', true,
    'entry_id', input_entry_id,
    'status', normalized_status
  );
end;
$$;

revoke all on function public.set_entry_status(uuid, text) from public, anon;
grant execute on function public.set_entry_status(uuid, text) to authenticated;

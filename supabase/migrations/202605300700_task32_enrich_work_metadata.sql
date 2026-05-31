-- task32: enrich a (shared) works row with cleaned subjects + canonical genres
-- captured from the provider at add time. works has no owner-update RLS policy,
-- so this is security definer; it only fills when genres are absent, so one user
-- can't clobber another's enrichment.

create or replace function public.task32_enrich_work_metadata(
  input_work_id uuid,
  input_subjects jsonb default '[]'::jsonb,
  input_genres jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  actor_profile_id uuid;
  existing jsonb;
begin
  actor_profile_id := public.current_profile_id();
  if actor_profile_id is null then
    raise exception 'authenticated profile required to enrich work metadata' using errcode = '42501';
  end if;

  select metadata_json into existing
  from public.works
  where id = input_work_id and deleted_at is null;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if existing ? 'genres' and jsonb_array_length(coalesce(existing -> 'genres', '[]'::jsonb)) > 0 then
    return jsonb_build_object('status', 'skipped');
  end if;

  if coalesce(jsonb_array_length(coalesce(input_subjects, '[]'::jsonb)), 0) = 0
     and coalesce(jsonb_array_length(coalesce(input_genres, '[]'::jsonb)), 0) = 0 then
    return jsonb_build_object('status', 'empty');
  end if;

  update public.works
  set metadata_json = coalesce(metadata_json, '{}'::jsonb)
    || jsonb_build_object(
      'subjects', coalesce(input_subjects, '[]'::jsonb),
      'genres', coalesce(input_genres, '[]'::jsonb)
    )
  where id = input_work_id and deleted_at is null;

  return jsonb_build_object('status', 'enriched', 'work_id', input_work_id);
end;
$$;

revoke all on function public.task32_enrich_work_metadata(uuid, jsonb, jsonb) from public;
grant execute on function public.task32_enrich_work_metadata(uuid, jsonb, jsonb) to authenticated;

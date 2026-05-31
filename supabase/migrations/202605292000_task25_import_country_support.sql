create or replace function public.task14_set_entry_countries(
  input_entry_id uuid,
  input_countries jsonb
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  country_item jsonb;
  v_country_code text;
  v_country_name text;
begin
  if input_entry_id is null then
    return;
  end if;

  if input_countries is null or jsonb_typeof(input_countries) <> 'array' then
    return;
  end if;

  for country_item in
    select value from jsonb_array_elements(input_countries)
  loop
    v_country_code := upper(trim(coalesce(country_item ->> 'country_code', '')));
    v_country_name := trim(coalesce(country_item ->> 'country_name', country_item ->> 'name', ''));

    if v_country_code ~ '^[A-Z]{3}$' and v_country_name != '' then
      insert into public.book_countries (user_entry_id, country_code, country_name)
      values (input_entry_id, v_country_code, v_country_name)
      on conflict (user_entry_id, country_code) do nothing;
    end if;
  end loop;
end;
$$;

revoke all on function public.task14_set_entry_countries from public, anon;
grant execute on function public.task14_set_entry_countries to authenticated;

create or replace function public.task14_execute_import_job(
  input_profile_id uuid,
  input_payload_json jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  normalized_payload jsonb := coalesce(input_payload_json, '{}'::jsonb);
  items jsonb;
  item jsonb;
  item_result jsonb;
  new_entry_id uuid;
  imported_count integer := 0;
  skipped_count integer := 0;
  failed_count integer := 0;
  errors jsonb := '[]'::jsonb;
begin
  if input_profile_id is null then
    raise exception 'task14 import job profile_id is required' using errcode = '23514';
  end if;

  items := case
    when jsonb_typeof(normalized_payload -> 'items') = 'array' then normalized_payload -> 'items'
    else '[]'::jsonb
  end;

  if jsonb_array_length(items) = 0 then
    raise exception 'task14 import payload contains no items' using errcode = '23514';
  end if;

  for item in
    select value from jsonb_array_elements(items)
  loop
    begin
      item_result := public.task14_create_entry_for_profile(
        input_profile_id,
        item,
        true,
        coalesce(normalized_payload ->> 'source', 'import')
      );

      if item_result ->> 'status' = 'created' then
        imported_count := imported_count + 1;
      else
        skipped_count := skipped_count + 1;
      end if;

      new_entry_id := (item_result ->> 'entry_id')::uuid;
      if new_entry_id is not null and item ? 'countries' then
        perform public.task14_set_entry_countries(new_entry_id, item -> 'countries');
      end if;
    exception
      when others then
        failed_count := failed_count + 1;
        errors := errors || jsonb_build_array(jsonb_build_object(
          'title', coalesce(item ->> 'canonical_title', item ->> 'title'),
          'error', sqlerrm
        ));
    end;
  end loop;

  return jsonb_build_object(
    'status', case when failed_count = 0 then 'imported' else 'imported_with_errors' end,
    'total', jsonb_array_length(items),
    'imported', imported_count,
    'skipped', skipped_count,
    'failed', failed_count,
    'errors', errors,
    'processed_at', now()
  );
end;
$$;

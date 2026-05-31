create table public.book_countries (
  id uuid primary key default public.uuid_v7(),
  user_entry_id uuid not null references public.user_entries(id) on delete cascade,
  country_code text not null,
  country_name text not null,
  created_at timestamptz not null default now(),
  constraint book_countries_code_format check (country_code ~ '^[A-Z]{3}$'),
  constraint book_countries_name_not_blank check (length(trim(country_name)) > 0)
);

create unique index idx_book_countries_entry_code
  on public.book_countries(user_entry_id, country_code);

create index idx_book_countries_code
  on public.book_countries(country_code);

alter table public.book_countries enable row level security;

create policy "Users can view their own book countries"
  on public.book_countries for select
  using (
    user_entry_id in (
      select ue.id from public.user_entries ue
      join public.profiles p on p.id = ue.profile_id
      where p.auth_user_id = auth.uid()
    )
  );

create policy "Users can insert their own book countries"
  on public.book_countries for insert
  with check (
    user_entry_id in (
      select ue.id from public.user_entries ue
      join public.profiles p on p.id = ue.profile_id
      where p.auth_user_id = auth.uid()
    )
  );

create policy "Users can delete their own book countries"
  on public.book_countries for delete
  using (
    user_entry_id in (
      select ue.id from public.user_entries ue
      join public.profiles p on p.id = ue.profile_id
      where p.auth_user_id = auth.uid()
    )
  );

create or replace function public.get_reading_map_countries()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  current_profile_id uuid;
  result jsonb;
begin
  select p.id into current_profile_id
  from public.profiles p
  where p.auth_user_id = auth.uid();

  if current_profile_id is null then
    return jsonb_build_object(
      'country_counts', '{}'::jsonb,
      'entries', '[]'::jsonb
    );
  end if;

  with entry_countries_agg as (
    select
      ue.id as entry_id,
      ue.work_id,
      ue.edition_id,
      ue.status,
      ue.rating_x10,
      ue.created_at,
      w.canonical_title as title,
      e.cover_url,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'country_code', bc.country_code,
            'country_name', bc.country_name
          )
          order by bc.country_code
        ) filter (where bc.id is not null),
        '[]'::jsonb
      ) as countries
    from public.user_entries ue
    join public.works w on w.id = ue.work_id
    join public.editions e on e.id = ue.edition_id
    left join public.book_countries bc on bc.user_entry_id = ue.id
    where ue.profile_id = current_profile_id
      and ue.deleted_at is null
    group by ue.id, w.canonical_title, e.cover_url
  ),
  country_counts_agg as (
    select
      bc.country_code,
      bc.country_name,
      count(*)::int as count
    from public.book_countries bc
    join public.user_entries ue on ue.id = bc.user_entry_id
    where ue.profile_id = current_profile_id
      and ue.deleted_at is null
    group by bc.country_code, bc.country_name
    order by count(*) desc
  )
  select jsonb_build_object(
    'country_counts', coalesce((
      select jsonb_object_agg(
        c.country_code,
        jsonb_build_object(
          'count', c.count,
          'country_name', c.country_name
        )
      )
      from country_counts_agg c
    ), '{}'::jsonb),
    'entries', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'entry_id', e.entry_id,
          'work_id', e.work_id,
          'edition_id', e.edition_id,
          'title', e.title,
          'cover_url', e.cover_url,
          'status', e.status,
          'rating_x10', e.rating_x10,
          'created_at', e.created_at,
          'countries', e.countries
        )
        order by e.created_at desc
      )
      from entry_countries_agg e
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_reading_map_countries() from public, anon;
grant execute on function public.get_reading_map_countries() to authenticated;

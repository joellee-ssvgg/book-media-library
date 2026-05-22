begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select no_plan();

create temp table task19_expected_rls_tables (
  table_name text primary key
);

insert into task19_expected_rls_tables (table_name) values
  ('account_deletion_requests'),
  ('activity_events'),
  ('annotation_tags'),
  ('annotations'),
  ('auth_identities'),
  ('cover_cache_jobs'),
  ('editions'),
  ('entry_tags'),
  ('event_outbox'),
  ('events_visibility_sync_jobs'),
  ('export_jobs'),
  ('external_ids'),
  ('import_jobs'),
  ('list_items'),
  ('lists'),
  ('notifications'),
  ('persons'),
  ('private_activity_log'),
  ('profiles'),
  ('progress_logs'),
  ('progress_models'),
  ('progress_snapshots'),
  ('provider_search_cache'),
  ('series'),
  ('slo_alert_thresholds'),
  ('tags'),
  ('user_entries'),
  ('user_private_notes'),
  ('work_credits'),
  ('work_relations'),
  ('work_series'),
  ('works');

select is_empty(
  $$
    select e.table_name
    from task19_expected_rls_tables e
    left join pg_class c
      on c.oid = to_regclass(format('public.%I', e.table_name))
     and c.relkind in ('r', 'p')
    where c.oid is null
    order by e.table_name
  $$,
  'Task19 RLS inventory tables exist as public base or partitioned tables'
);

select is_empty(
  $$
    select e.table_name
    from task19_expected_rls_tables e
    join pg_class c
      on c.oid = to_regclass(format('public.%I', e.table_name))
    where c.relkind in ('r', 'p')
      and (not c.relrowsecurity or not c.relforcerowsecurity)
    order by e.table_name
  $$,
  'Task19 RLS inventory tables all enable and force row level security'
);

select is_empty(
  $$
    with recursive protected_partition_descendants as (
      select root.oid
      from pg_class root
      where root.oid in (
        'public.activity_events'::regclass,
        'public.progress_logs'::regclass
      )
      union all
      select child.inhrelid
      from pg_inherits child
      join protected_partition_descendants parent
        on parent.oid = child.inhparent
    )
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and not exists (
        select 1
        from task19_expected_rls_tables e
        where e.table_name = c.relname
      )
      and c.oid not in (
        select oid
        from protected_partition_descendants
        where oid not in (
          'public.activity_events'::regclass,
          'public.progress_logs'::regclass
        )
      )
    order by c.relname
  $$,
  'Task19 public table inventory has no untracked business tables'
);

select is_empty(
  $$
    with recursive protected_partition_descendants as (
      select root.oid
      from pg_class root
      where root.oid in (
        'public.activity_events'::regclass,
        'public.progress_logs'::regclass
      )
        and root.relrowsecurity
        and root.relforcerowsecurity
      union all
      select child.inhrelid
      from pg_inherits child
      join protected_partition_descendants parent
        on parent.oid = child.inhparent
    )
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and (not c.relrowsecurity or not c.relforcerowsecurity)
      and c.oid not in (
        select oid
        from protected_partition_descendants
        where oid not in (
          'public.activity_events'::regclass,
          'public.progress_logs'::regclass
        )
      )
    order by c.relname
  $$,
  'Task19 only protected partition children may omit direct FORCE RLS'
);

select ok(
  exists (
    select 1
    from pg_partitioned_table
    where partrelid = 'public.activity_events'::regclass
  )
  and exists (
    select 1
    from pg_partitioned_table
    where partrelid = 'public.progress_logs'::regclass
  ),
  'Task19 partitioned RLS parents stay partitioned'
);

select * from finish();

rollback;

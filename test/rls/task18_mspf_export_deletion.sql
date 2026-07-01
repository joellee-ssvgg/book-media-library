begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select no_plan();

create or replace function public._set_auth_user(test_user uuid)
returns void
language plpgsql
as $$
begin
  if test_user is null then
    perform set_config('request.jwt.claims', '{}', true);
    perform set_config('request.jwt.claim.sub', '', true);
  else
    perform set_config(
      'request.jwt.claims',
      json_build_object('sub', test_user::text, 'role', 'authenticated')::text,
      true
    );
    perform set_config('request.jwt.claim.sub', test_user::text, true);
  end if;
end;
$$;

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data
) values
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-00000000aa18',
  'authenticated',
  'authenticated',
  'task18-owner@example.com',
  'test-password-hash',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"username":"task18_owner","display_name":"Task18 Owner"}'::jsonb
),
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-00000000bb18',
  'authenticated',
  'authenticated',
  'task18-other@example.com',
  'test-password-hash',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"username":"task18_other","display_name":"Task18 Other"}'::jsonb
),
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-00000000cc18',
  'authenticated',
  'authenticated',
  'task18-gdpr@example.com',
  'test-password-hash',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"username":"task18_gdpr","display_name":"Task18 GDPR"}'::jsonb
);

create temp table task18_profiles as
select username, id as profile_id
from public.profiles
where username in ('task18_owner', 'task18_other', 'task18_gdpr');

grant select on task18_profiles to anon, authenticated;

set local role authenticated;
select public._set_auth_user('00000000-0000-0000-0000-00000000aa18');

create temp table task18_owner_entry as
select public.task14_create_book_entry_from_provider(
  'openlibrary',
  '/works/OL-TASK18-OWNER',
  'Task18 Owner Book',
  'finished',
  2026,
  null,
  'en',
  'Task18 owner description',
  null,
  '[{"source":"openlibrary","external_id":"/works/OL-TASK18-OWNER"}]'::jsonb
) as payload;

grant select on task18_owner_entry to anon, authenticated;

update public.user_entries
set
  rating_x10 = 45,
  review = 'Task18 public retained review',
  visibility_scope = 'public',
  field_visibility_json = jsonb_build_object(
    'rating_x10', 'public',
    'rating', 'public',
    'review', 'public',
    'favorite', 'public',
    'finished_at', 'public'
  ),
  favorite = true,
  finished_at = now()
where id = (select (payload ->> 'entry_id')::uuid from task18_owner_entry);

insert into public.user_private_notes(entry_id, note)
values (
  (select (payload ->> 'entry_id')::uuid from task18_owner_entry),
  'Task18 private note'
);

insert into public.annotations(entry_id, kind, content, location_json, visibility_scope)
values (
  (select (payload ->> 'entry_id')::uuid from task18_owner_entry),
  'note',
  'Task18 private annotation',
  '{"kind":"page","page":10}'::jsonb,
  'private'
);

insert into public.tags(name, color, source)
values ('Task18 Tag', '#aabbcc', 'manual');

insert into public.entry_tags(entry_id, tag_id)
select
  (select (payload ->> 'entry_id')::uuid from task18_owner_entry),
  id
from public.tags
where name = 'Task18 Tag';

insert into public.lists(title, description, visibility_scope)
values ('Task18 private list', 'Task18 deletion target', 'private');

insert into public.list_items(list_id, entry_id, work_id, position, note)
select
  l.id,
  (select (payload ->> 'entry_id')::uuid from task18_owner_entry),
  (select (payload ->> 'work_id')::uuid from task18_owner_entry),
  1,
  'Task18 list note'
from public.lists l
where l.title = 'Task18 private list';

select public.record_progress(
  (select (payload ->> 'entry_id')::uuid from task18_owner_entry),
  'book_page_progress',
  'progress_set',
  '{"current_page":10,"total_pages":100}'::jsonb,
  now(),
  'manual',
  null,
  false
);

select public._set_auth_user('00000000-0000-0000-0000-00000000bb18');

create temp table task18_other_entry as
select public.task14_create_book_entry_from_provider(
  'openlibrary',
  '/works/OL-TASK18-OTHER',
  'Task18 Other Book',
  'finished',
  2026,
  null,
  'en',
  'Task18 other description',
  null,
  '[{"source":"openlibrary","external_id":"/works/OL-TASK18-OTHER"}]'::jsonb
) as payload;

grant select on task18_other_entry to anon, authenticated;

reset role;

insert into public.notifications(recipient_profile_id, actor_profile_id, kind, payload_json)
values (
  (select profile_id from task18_profiles where username = 'task18_owner'),
  (select profile_id from task18_profiles where username = 'task18_other'),
  'task18_notice',
  '{"message":"Task18 notification"}'::jsonb
);

set local role authenticated;
select public._set_auth_user('00000000-0000-0000-0000-00000000aa18');

create temp table task18_export_job as
select public.task18_enqueue_mspf_export() as payload;

grant select on task18_export_job to anon, authenticated;

create temp table task18_export_result as
select public.task18_process_own_export_job(
  (select (payload ->> 'job_id')::uuid from task18_export_job)
) as payload;

grant select on task18_export_result to anon, authenticated;

select is(
  (select payload ->> 'status' from task18_export_result),
  'exported',
  'owner can enqueue and process MSPF export job'
);

select is(
  (select payload #>> '{mspf,format}' from task18_export_result),
  'MSPF',
  'export result contains MSPF document'
);

select is(
  (select jsonb_array_length(payload #> '{mspf,works}') from task18_export_result),
  1,
  'MSPF export includes only owner referenced works'
);

select ok(
  (select payload #> '{mspf,works}' from task18_export_result)::text like '%Task18 Owner Book%'
  and (select payload #> '{mspf,works}' from task18_export_result)::text not like '%Task18 Other Book%',
  'MSPF export excludes other-user works'
);

select is(
  (select jsonb_array_length(payload #> '{mspf,private_notes}') from task18_export_result),
  1,
  'MSPF export includes owner private notes'
);

select is(
  (select jsonb_array_length(payload #> '{mspf,progress_logs}') from task18_export_result),
  1,
  'MSPF export includes owner progress logs'
);

select is(
  (select jsonb_array_length(payload #> '{mspf,tags}') from task18_export_result),
  1,
  'MSPF export includes owner tags'
);

select public._set_auth_user('00000000-0000-0000-0000-00000000bb18');

select is(
  (select count(*)::integer from public.export_jobs where job_kind = 'task18_mspf_export'),
  0,
  'other authenticated user cannot read owner MSPF export job'
);

select public._set_auth_user('00000000-0000-0000-0000-00000000aa18');

select is(
  public.task18_request_account_deletion(
    'export_then_delete',
    'DELETE',
    (select (payload ->> 'job_id')::uuid from task18_export_job)
  ) ->> 'status',
  'soft_deleted',
  'channel A requires completed export and soft-deletes profile'
);

select public._set_auth_user(null);
set local role anon;

select is(
  public.task17_public_profile_state('task18_owner') ->> 'status',
  'gone',
  'soft-deleted username route returns gone'
);

reset role;

update public.account_deletion_requests
set soft_delete_until = now() - interval '1 second'
where profile_id = (select profile_id from task18_profiles where username = 'task18_owner');

set local role service_role;

select is(
  (public.task18_process_due_account_deletions(10) ->> 'hard_deleted')::integer,
  1,
  'service processor hard-deletes due channel A request'
);

reset role;

select is(
  (
    select count(*)::integer
    from public.user_private_notes
    where profile_id = (select profile_id from task18_profiles where username = 'task18_owner')
  ),
  0,
  'hard deletion removes private notes'
);

select is(
  (
    select count(*)::integer
    from public.annotations
    where profile_id = (select profile_id from task18_profiles where username = 'task18_owner')
  ),
  0,
  'hard deletion removes annotations'
);

select is(
  (
    select count(*)::integer
    from public.progress_logs
    where profile_id = (select profile_id from task18_profiles where username = 'task18_owner')
  ),
  0,
  'hard deletion removes progress logs'
);

select is(
  (
    select count(*)::integer
    from public.tags
    where profile_id = (select profile_id from task18_profiles where username = 'task18_owner')
  ),
  0,
  'hard deletion removes tags'
);

select is(
  (
    select count(*)::integer
    from public.import_jobs
    where profile_id = (select profile_id from task18_profiles where username = 'task18_owner')
  )
  +
  (
    select count(*)::integer
    from public.export_jobs
    where profile_id = (select profile_id from task18_profiles where username = 'task18_owner')
  ),
  0,
  'hard deletion removes import/export jobs'
);

select is(
  (
    select count(*)::integer
    from public.auth_identities
    where profile_id = (select profile_id from task18_profiles where username = 'task18_owner')
  ),
  0,
  'hard deletion removes auth identities'
);

select is(
  (
    select count(*)::integer
    from public.user_entries
    where profile_id = (select profile_id from task18_profiles where username = 'task18_owner')
      and visibility_scope = 'public'
      and review = 'Task18 public retained review'
  ),
  1,
  'hard deletion retains anonymized public entry content'
);

select is(
  (
    public.task17_get_public_work(
      (select (payload ->> 'work_id')::uuid from task18_owner_entry),
      'task18-owner-book'
    ) #>> '{recent_reviews,0,author_name}'
  ),
  '已注销用户',
  'public work payload uses deleted-user placeholder'
);

set local role authenticated;
select public._set_auth_user('00000000-0000-0000-0000-00000000aa18');

select is(
  (select count(*)::integer from public.user_entries),
  0,
  'same auth login cannot see old rows after deletion'
);

select public._set_auth_user('00000000-0000-0000-0000-00000000cc18');

select is(
  public.task18_request_account_deletion('gdpr', 'DELETE', null) ->> 'status',
  'cooling_off',
  'channel B starts a 24-hour cooling period'
);

reset role;

select is(
  (select deleted_at is null from public.profiles where username = 'task18_gdpr'),
  true,
  'GDPR channel does not delete before cooling period is due'
);

update public.account_deletion_requests
set cooling_until = now() - interval '1 second'
where profile_id = (select profile_id from task18_profiles where username = 'task18_gdpr');

set local role service_role;

select is(
  (public.task18_process_due_account_deletions(10) ->> 'hard_deleted')::integer,
  1,
  'service processor hard-deletes due GDPR request'
);

reset role;

select ok(
  (select deleted_at is not null from public.profiles where username = 'task18_gdpr')
  and (
    select count(*)::integer
    from public.auth_identities
    where profile_id = (select profile_id from task18_profiles where username = 'task18_gdpr')
  ) = 0,
  'GDPR hard deletion anonymizes profile and removes auth identity'
);

select * from finish();

rollback;

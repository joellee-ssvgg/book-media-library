begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(1);

select ok(
  false,
  'Task19 merge-block probe intentionally fails required pgTAP status check'
);

select * from finish();

rollback;

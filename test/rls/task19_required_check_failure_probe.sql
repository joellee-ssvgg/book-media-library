begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(1);

select ok(
  false,
  'Task19 required-check failure probe intentionally fails pgtap'
);

select * from finish();

rollback;

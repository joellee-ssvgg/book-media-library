# Task19 RLS and CI Gate Runbook

Task19 keeps the RLS suite merge-blocking by making the database checks explicit and keeping the CI gates visible. The current project has domain-grouped pgTAP files plus a Task19 inventory guard instead of physically splitting every table into a standalone file.

## Local Gates

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:mspf:schema`
- `pnpm db:migrate:smoke`
- `pnpm db:test:rls`
- `pnpm task19:check`

## CI Gates

- `.github/workflows/lint-and-type.yml` runs lint, typecheck, unit tests, and MSPF AJV schema validation on every pull request.
- `.github/workflows/migration-smoke.yml` runs `supabase db reset` on every pull request.
- `.github/workflows/pgtap.yml` runs `supabase db reset` and `supabase test db test/rls` on every pull request.
- Protected `dev` and `main` branches require `lint-and-type`, `migration-smoke`, and `pgtap`.

## RLS Drift Guard

`test/rls/task19_rls_ci_guard.sql` is a catalog-level pgTAP guard. It fails if:

- a required public business table is missing;
- a required business table does not have both RLS and FORCE RLS enabled;
- a new public table appears without being added to the Task19 inventory;
- a non-partition public table omits direct FORCE RLS;
- `activity_events` or `progress_logs` stop being partitioned parents.

Partition children may omit direct FORCE RLS only when they inherit from a protected `activity_events` or `progress_logs` parent.

## Merge-Block Evidence

The strict acceptance item "CI fails -> cannot merge" is enforced through GitHub branch protection.

- The repository is public so branch protection is available.
- `dev` and `main` both require `lint-and-type`, `migration-smoke`, and `pgtap`.
- PR #2 proved all three required checks materialize on pull requests and can pass before merge.
- PR #3 intentionally failed `pgtap`; GitHub reported `mergeStateStatus=BLOCKED`, with `lint-and-type=SUCCESS`, `migration-smoke=SUCCESS`, and `pgtap=FAILURE`.

Temporary failure branches must be closed and deleted after evidence is captured.

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

- `.github/workflows/lint-and-type.yml` runs lint, typecheck, unit tests, and MSPF AJV schema validation.
- `.github/workflows/migration-smoke.yml` runs `supabase db reset`.
- `.github/workflows/pgtap.yml` runs `supabase db reset` and `supabase test db test/rls`.

## RLS Drift Guard

`test/rls/task19_rls_ci_guard.sql` is a catalog-level pgTAP guard. It fails if:

- a required public business table is missing;
- a required business table does not have both RLS and FORCE RLS enabled;
- a new public table appears without being added to the Task19 inventory;
- a non-partition public table omits direct FORCE RLS;
- `activity_events` or `progress_logs` stop being partitioned parents.

Partition children may omit direct FORCE RLS only when they inherit from a protected `activity_events` or `progress_logs` parent.

## Current External Blocker

The strict acceptance item "CI fails -> cannot merge" requires branch protection or a repository ruleset with required checks. GitHub currently rejects branch protection and ruleset APIs for this private repository:

- `gh api repos/joellee-ssvgg/book-media-library/branches/dev/protection` returned `403` because private repositories require GitHub Pro or a public repository for protected branches.
- `gh api repos/joellee-ssvgg/book-media-library/rulesets` returned the same plan-level `403`.

Until that account/repository boundary changes, CI failure can be demonstrated, but the merge-blocking enforcement cannot be truthfully marked complete.

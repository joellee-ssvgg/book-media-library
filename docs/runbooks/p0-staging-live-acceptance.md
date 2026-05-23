# P0 Staging Live Acceptance

## Scope

This runbook records live staging checks that are outside the local-only `p0:redline` script.

Authoritative staging targets:

- App alias: `https://book-media-library-staging.vercel.app`
- Supabase project ref: `bnmaolnecfywfbozsrxx`
- GitHub Project: `书影库 P0 Task Board`

## Current Live Evidence

Last checked: 2026-05-23

| Area | Evidence |
| --- | --- |
| GitHub CLI Project access | `gh auth status` includes `project`; `gh project list --owner joellee-ssvgg` returns `书影库 P0 Task Board`. |
| GitHub OAuth | Staging sign-in completes through GitHub and returns to the app. |
| OAuth identity provider | Remote migration `202605222058` is applied; GitHub-created profile records a `github` identity instead of a stale `supabase` identity. |
| Onboarding | Live profile `demo01` is onboarded with display name `Demo`. |
| Book add | Open Library add flow created `Programming Ruby` and `The Pragmatic Programmer`; Google Books staging search returns `The Pragmatic Programmer` and `Clean Code` results after configuring `GOOGLE_BOOKS_API_KEY`. |
| Movie add | TMDB add flow created `Inception`. |
| Library before deletion | `/library` loaded 3 real owner entries and switched from seed mode to real library mode. |
| Dashboard before deletion | `/dashboard` loaded 3 real owner entries and switched from seed mode to real library mode. |
| Public profile before deletion | `/u/demo01` returned public profile stats with 3 public entries and Top-3 visible. |
| Public work page | `/w/019e4fca-2648-7967-8188-20e1338e7c85/inception` returned the public Inception work page before deletion; after soft delete it no longer exposes `Demo` as an active public profile. |
| MSPF export | `/settings/data/export` generated job `019e5075-ddf6-7cc0-a56d-489bfcdf48df`; downloaded ZIP contains `data.json` with version `1.0.0`, username `demo01`, 3 works, and 3 entries. |
| Vercel Preview env | `GOOGLE_BOOKS_API_KEY` is configured for Preview; deployment `dpl_4znX2HJ5NUP9wt9jivCmhkyYXeBt` is aliased to `https://book-media-library-staging.vercel.app`. |
| Export-then-delete | User confirmed `确认删除 staging demo01`; deletion request `019e5076-fff8-78d0-a06d-fb5803f59037` entered `soft_deleted` with channel `export_then_delete` and export job `019e5075-ddf6-7cc0-a56d-489bfcdf48df`. |
| Public profile after deletion | `/u/demo01` returns HTTP `410`; `task17_public_profile_state('demo01')` returns `{"status":"gone"}`. |
| Owner views after deletion | Same browser session shows `/library` and `/dashboard` with `0` real entries and `Seed` mode. |

## Current Live Blockers

| Blocker | Evidence | Impact |
| --- | --- | --- |
| OAuth document precedence | Resolved by ADR-058: keep GitHub OAuth for P0 live acceptance because the P0 acceptance script explicitly requires it. | No current OAuth-precedence blocker; do not add other third-party OAuth providers in P0. |
| Provider config | `pnpm task01:check` returns `READY`; staging `/add/book` returns Google Books results for `The Pragmatic Programmer` and `Clean Code`. | No current provider-config blocker. |

## Verification Commands

Latest local verification after the OAuth/provider migration:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm p0:redline
pnpm db:migrate:smoke
pnpm db:test:rls
```

Expected current result:

- lint/typecheck/test/build pass;
- `pnpm p0:redline` passes local steps 11-13;
- `pnpm db:migrate:smoke` applies through `202605222058_task21_oauth_identity_provider.sql`;
- `pnpm db:test:rls` reports 19 files and 469 tests passing after a clean reset.

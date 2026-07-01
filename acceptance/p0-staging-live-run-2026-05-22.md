# P0 Staging Live Run 2026-05-22

## Source

- Environment: Vercel Preview alias `https://book-media-library-staging.vercel.app`
- Supabase project ref: `bnmaolnecfywfbozsrxx`
- User flow: GitHub OAuth, onboarding, provider add, library/dashboard, public pages, MSPF export.

## Checklist

- [x] GitHub CLI can read Project board with `project` scope.
- [x] GitHub OAuth completes against staging and returns to the app.
- [x] Remote migration `202605222058` is applied.
- [x] GitHub OAuth identity is stored as provider `github`.
- [x] Onboarding completed for `demo01`.
- [x] Open Library book add created `Programming Ruby`.
- [x] TMDB movie add created `Inception`.
- [x] Existing Open Library book add created `The Pragmatic Programmer`.
- [x] `/library` loads 3 real entries and switches to real library mode.
- [x] `/dashboard` loads 3 real entries and switches to real library mode.
- [x] `/settings/public` saves public Top-3.
- [x] `/u/demo01` shows 3 public entries and the Top-3.
- [x] Public work page for Inception renders with public stats and metadata.
- [x] MSPF export generated job `019e4fd2-06d5-7ecb-9190-17c6a2a56469`.
- [x] Downloaded `mspf-export.zip` contains `data.json` with version `1.0.0`, 3 works, and 3 entries.
- [x] Google Books provider is live-ready after configuring `GOOGLE_BOOKS_API_KEY`; staging search returns Google Books results for `The Pragmatic Programmer` and `Clean Code`.
- [x] Fresh MSPF export generated job `019e5075-ddf6-7cc0-a56d-489bfcdf48df`.
- [x] Downloaded `mspf-export (1).zip` contains `data.json` with version `1.0.0`, username `demo01`, 3 works, and 3 entries.
- [x] Live `export_then_delete` executed after explicit user confirmation.
- [x] Account deletion request `019e5076-fff8-78d0-a06d-fb5803f59037` entered `soft_deleted` through channel `export_then_delete`.
- [x] `/u/demo01` returns HTTP `410`; public profile RPC returns `{"status":"gone"}`.
- [x] Same browser session sees `/library` and `/dashboard` with `0` real entries and `Seed` mode.

## Live Entity Evidence

Profile:

- username: `demo01`
- display name: `Demo`
- public entries: `3`
- public visibility: `public`

Entries:

- `019e4fce-4537-75f0-a8a6-5db5cc0634a7` - book - `Programming Ruby`
- `019e4fca-265c-797a-8f46-f25c81c5ae41` - movie - `Inception`
- `019e4fc9-8f71-7e0b-a2af-8725f5a6e922` - book - `The Pragmatic Programmer`

Public URLs:

- `https://book-media-library-staging.vercel.app/u/demo01` - returns HTTP `410` after deletion.
- `https://book-media-library-staging.vercel.app/w/019e4fca-2648-7967-8188-20e1338e7c85/inception`

Deployment:

- `https://book-media-library-7wh6k66bz-joellee-s-projects.vercel.app`
- Vercel deployment id: `dpl_4znX2HJ5NUP9wt9jivCmhkyYXeBt`
- Staging alias: `https://book-media-library-staging.vercel.app`

## Local Verification

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm p0:redline
pnpm db:migrate:smoke
pnpm db:test:rls
```

Result:

- `pnpm test`: 47 tests passed.
- `pnpm p0:redline`: passed local acceptance steps 11, 12, and 13.
- `pnpm db:test:rls`: 19 files, 469 tests passed after clean reset.

## Remaining Decision

No remaining action-time confirmation is pending for this live staging run. The account entered the 30-day soft-delete window; service-role inspection still sees retained rows until the hard-delete processor becomes due.

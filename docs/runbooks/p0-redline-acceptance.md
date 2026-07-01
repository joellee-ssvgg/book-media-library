# P0 Redline Acceptance

This runbook covers the required automated checks for P0 acceptance steps 11, 12, and 13 from the P0 acceptance script.

## Scope

- Step 11: anonymous `/u/demo01` public payload and rendered HTML must not include the private note text, `private_note`, or `user_private_notes`.
- Step 12: MSPF export must pass the v1.0.0 AJV schema check, include the demo book, movie, progress, private note, and tags, and exclude other-user data and server secret-shaped values.
- Step 13: export-then-delete must make `/u/demo01` unavailable and the same auth user must not see old owner data.

The script uses only a local Supabase stack. It refuses non-local `API_URL` or `DB_URL`.

## Command

```bash
supabase start
supabase db reset
pnpm p0:redline
```

`pnpm p0:redline` starts a local Next.js dev server with local Supabase public config, creates demo-only data, verifies the public route before and after deletion, and validates the generated MSPF document with the same schema used by `scripts/validate-mspf.ts`.

For the acceptance deliverables required by the P0 script:

```bash
pnpm p0:artifacts
```

This runs the same redline checks and writes:

- `acceptance/p0-run-<date>.md`
- `acceptance/p0-mspf-<date>.json`
- `acceptance/p0-demo01-public-<date>.png`
- `acceptance/p0-demo01-deleted-<date>.png`

## NOT-GO Conditions

Treat any script failure as P0 NOT-GO until fixed. The relevant hard failures are:

- public JSON or HTML includes the private note fragment `重新思考 DRY`;
- public JSON or HTML includes `private_note` or `user_private_notes`;
- MSPF fails AJV validation;
- MSPF includes other-user demo data;
- MSPF contains a server secret-shaped value;
- deletion leaves `/u/demo01` accessible;
- the same auth user can still see old owner entries after deletion;
- private notes, progress logs, tags, export jobs, or auth identities remain after hard deletion.

## CI

The `p0-redline` workflow runs the same script on pull requests and on `dev` / `main` pushes.

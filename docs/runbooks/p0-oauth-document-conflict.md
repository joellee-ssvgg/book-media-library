# P0 OAuth Document Conflict

## Status

Resolved by ADR-058.

This runbook records the source-document conflict that led to ADR-058. The current decision is to keep GitHub OAuth for P0 live acceptance because the P0 acceptance script explicitly requires it.

## Conflict Evidence

| Source | Evidence | Implication |
| --- | --- | --- |
| `P0 任务清单(20 步实例化)` | Page 3 extraction: Task 01 `不接第三方 OAuth`. | P0 implementation should not connect third-party OAuth. |
| `个人书影库平台产品方案v6` | Page 35 extraction: `auth_identities (P0 schema 预留, P1 启用)` and provider values include `supabase / google / github / apple`. | OAuth identity rows are reserved in P0 schema but third-party use appears deferred to P1. |
| `P0 验收演示脚本` | Page 1 extraction: an empty GitHub test account can be used for OAuth; page 1 says to use GitHub OAuth; page 2 says to log in again with the same GitHub OAuth after deletion. | The acceptance script expects GitHub OAuth to be executable during P0 acceptance. |
| `docs/adr/ADR-052-profile-identity-model.md` | Original accepted consequence: P0 creates the `supabase` identity automatically on signup and does not enable third-party OAuth flows. | ADR-058 now qualifies this consequence for GitHub OAuth live acceptance. |
| Current staging evidence | `docs/runbooks/p0-staging-live-acceptance.md` records GitHub OAuth completion, provider `github`, and successful export-then-delete for `demo01`. | Current live acceptance evidence depends on GitHub OAuth. |

## Current Local Change Set Affected

- `apps/web/app/auth/`
- `apps/web/lib/supabase/auth.ts`
- `apps/web/lib/supabase/server.ts`
- `apps/web/app/page.tsx`
- `apps/web/schemas/auth.ts`
- action and form changes that remove manual access-token fields
- `supabase/migrations/202605222058_task21_oauth_identity_provider.sql`
- `test/rls/profiles_auth.sql`
- `acceptance/p0-staging-live-run-2026-05-22.md`
- `docs/runbooks/p0-staging-live-acceptance.md`

## Decision

User confirmed on 2026-05-23 to keep GitHub OAuth for P0 live acceptance.

ADR-058 records the rule:

- the P0 acceptance script has precedence for the live staging acceptance flow;
- GitHub OAuth is the only P0 third-party OAuth provider currently allowed;
- all other third-party OAuth providers remain out of P0 scope unless a separate decision changes that.

## Follow-up Rule

Do not:

- add Google, Apple, or any other third-party OAuth provider in P0;
- expose `auth_identities` through public pages, public RPCs, MSPF export, or Open Graph metadata;
- claim final P0 live acceptance without rerunning the relevant local checks and preserving the staging evidence.

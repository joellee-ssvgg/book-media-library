# ADR-058: P0 GitHub OAuth Acceptance Exception

Status: Accepted
Date: 2026-05-23

## Context

The P0 authentication documents conflict:

- `P0 任务清单(20 步实例化)` says Task 01 does not connect third-party OAuth.
- `个人书影库平台产品方案v6` says `auth_identities` is P0 schema-reserved and P1-enabled, while listing provider values `supabase / google / github / apple`.
- `P0 验收演示脚本` requires an empty GitHub test account, a GitHub OAuth login flow, and a post-deletion login with the same GitHub OAuth account.
- ADR-052 originally recorded that P0 creates a `supabase` identity automatically on signup and does not enable third-party OAuth flows.

Current staging evidence was produced with GitHub OAuth enabled:

- GitHub OAuth completed against `https://book-media-library-staging.vercel.app`.
- The remote migration `202605222058` maps GitHub-created users to `auth_identities.provider = 'github'` instead of a stale `supabase` identity.
- The `demo01` live acceptance flow completed onboarding, provider add, library/dashboard, public pages, MSPF export, and export-then-delete through the GitHub OAuth session.

The user confirmed on 2026-05-23 to follow the recommendation to keep GitHub OAuth for P0 live acceptance and record the exception.

## Decision

Keep GitHub OAuth enabled for P0 live acceptance.

The P0 acceptance script has precedence for the live staging acceptance flow because it defines the executable acceptance path. The no-third-party-OAuth language in Task 01 and the P1 wording in the product plan remain the default rule for non-acceptance providers, but GitHub OAuth is an explicit P0 acceptance exception.

Keep the current OAuth-aligned implementation:

- `/auth/sign-in`, `/auth/callback`, and `/auth/sign-out` routes;
- cookie-backed Supabase server client for app actions;
- removal of manual access-token fields from user-facing action forms;
- provider-aware `auth_identities` mapping for `github`, with existing `supabase` identity behavior retained for non-OAuth users;
- RLS coverage proving GitHub-created auth users receive a `github` identity row;
- staging acceptance evidence tied to the GitHub OAuth test account flow.

Do not enable Google, Apple, or any other third-party OAuth provider in P0.

## Consequences

- ADR-052 is qualified by this ADR. Its profile identity model remains active, but its original no-OAuth consequence is no longer absolute for P0 live acceptance.
- `auth_identities` remains private and must not be exposed by public pages, public RPCs, MSPF export, or Open Graph metadata.
- GitHub OAuth is allowed only because the P0 acceptance script requires it. Any additional OAuth provider still needs a separate decision.
- Local tests and migration smoke checks must cover both non-OAuth Supabase users and GitHub OAuth users.
- If a future acceptance script removes the GitHub OAuth requirement, this exception should be re-reviewed before keeping OAuth as general P0 product behavior.

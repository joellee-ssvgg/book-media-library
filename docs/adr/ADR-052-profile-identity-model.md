# ADR-052: Profile Identity Model

Status: Accepted
Date: 2026-05-20

## Context

Task 01 touches the application identity model. The source documents conflict:

- `DB Schema v1.0.0` says `profiles.id = auth.users.id`.
- `个人书影库平台产品方案 v6` appendix C says `profiles.id` is the application-layer identity and `auth_user_id` links to Supabase Auth.

The user confirmed option 2 on 2026-05-20: follow v6 appendix C for Task 01.

## Decision

Use `profiles.id` as the application-layer profile id.

Add `profiles.auth_user_id uuid not null unique references auth.users(id) on delete cascade`.

Use `profiles.id` as the foreign key target for application-owned tables, including `auth_identities.profile_id`.

RLS policies should compare Supabase Auth identity through `auth.uid()` and resolve the application identity through `profiles.auth_user_id`.

## Consequences

- This intentionally deviates from `DB Schema v1.0.0` for the `profiles` primary key meaning.
- Future migrations must reference `profiles(id)` for app identity and `profiles(auth_user_id)` only for Supabase Auth linkage.
- `auth_identities` remains a P0 schema-reserved table for providers beyond the acceptance path. P0 creates the `supabase` identity automatically for non-OAuth Supabase Auth users.
- ADR-058 qualifies the original no-OAuth consequence: GitHub OAuth is enabled for P0 live acceptance because the P0 acceptance script explicitly requires it. No other third-party OAuth provider is enabled for P0.
- Public views must not expose `id`, `auth_user_id`, audit fields, or `auth_identities`.

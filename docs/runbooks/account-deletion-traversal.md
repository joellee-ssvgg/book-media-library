# Account Deletion Traversal

This runbook tracks tables that contain account-owned data and must be handled by the account deletion/export implementation task. It is a traversal register, not the deletion implementation.

## Task07 additions

### `public.user_entries`

- Owner key: `profile_id`
- Content risk: user status, rating, review, favorite flag, dates, and field visibility preferences.
- Deletion handling: Task18 must remove or anonymize rows owned by the profile, and must preserve referential safety for works/editions that are global catalog data.

### `public.user_private_notes`

- Owner key: `profile_id`
- Content risk: private user-authored notes, search vectors, and AI-extracted private-note metadata.
- Deletion handling: Task18 must hard-delete rows owned by the profile. These rows must never be retained for public profile, AI, search, or recommendation surfaces.

### `public.annotations`

- Owner key: `profile_id`
- Content risk: user-authored quotes, highlights, notes, media locations, and search vectors.
- Deletion handling: Task18 must delete or anonymize rows owned by the profile. Private annotations should be hard-deleted; public annotations require an explicit product decision before retention.

## Required verification when Task18 lands

- Owner deletion removes `user_private_notes`.
- Owner deletion removes or anonymizes `user_entries.review`.
- Owner deletion removes or anonymizes `annotations.content`.
- Public views and APIs do not retain deleted-profile Task07 content.

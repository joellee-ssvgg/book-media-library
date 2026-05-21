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

## Task08 additions

### `public.tags`

- Owner key: `profile_id`
- Content risk: user-authored organization labels, AI/imported tag provenance, aliases, and merge history via `canonical_tag_id`.
- Deletion handling: Task18 must remove rows owned by the profile, including aliases. Public tag presentation must be rebuilt from retained public entry/list data only if the product explicitly allows retention.

### `public.entry_tags`

- Owner key: `profile_id`
- Content risk: associations between private library entries and user-owned tags.
- Deletion handling: Task18 must remove rows owned by the profile before or with `user_entries`.

### `public.annotation_tags`

- Owner key: `profile_id`
- Content risk: associations between annotations and user-owned tags, including tags on private annotations.
- Deletion handling: Task18 must remove rows owned by the profile before or with `annotations`.

## Task09 additions

### `public.progress_logs`

- Owner key: `profile_id`
- Content risk: permanent Domain event source for progress, sessions, completion, abandonment, public-class progress notes, payloads, and imported-history markers.
- Deletion handling: Task18 must remove rows owned by the profile when executing GDPR hard deletion. During the 30-day recoverable window, these rows remain the rebuild source for snapshots and activity.
- Public boundary: direct anonymous table access is not granted. Public reads must use controlled views that follow entry visibility and never join `user_private_notes`.

### `public.progress_snapshots`

- Owner key: `profile_id`
- Content risk: derived latest progress state rebuilt from `progress_logs`.
- Deletion handling: Task18 may delete rows owned by the profile after or with `progress_logs`. Snapshots are rebuildable and must not be treated as the source of truth.

## Required verification when Task18 lands

- Owner deletion removes `user_private_notes`.
- Owner deletion removes or anonymizes `user_entries.review`.
- Owner deletion removes or anonymizes `annotations.content`.
- Owner deletion removes `tags`, `entry_tags`, and `annotation_tags`.
- Owner deletion removes `progress_logs` and `progress_snapshots`.
- Public views and APIs do not retain deleted-profile Task07 content.

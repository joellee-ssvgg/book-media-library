# Account Deletion Traversal

This runbook tracks tables that contain account-owned data and are handled by the Task18 account deletion/export implementation. It is a traversal register plus verification pointer; the implementation lives in `supabase/migrations/202605221000_task18_mspf_export_deletion.sql`.

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

## Task10 additions

### `public.activity_events`

- Owner key: `profile_id`
- Content risk: derived application activity stream for public, unlisted, and followers-visible user events. It includes progress-derived payloads and visibility snapshots.
- Deletion handling: Task18 must remove or anonymize rows owned by the profile. Activity rows are rebuildable from domain events and must not be treated as the source of truth.
- Public boundary: public feeds must use `public_activity_feed_v`, which is built from activity rows without joining `user_entries` or `user_private_notes` at query time.

### `public.private_activity_log`

- Owner key: `profile_id`
- Content risk: physically isolated private activity stream for private entries and progress events.
- Deletion handling: Task18 must hard-delete rows owned by the profile. These rows must never be surfaced in public activity feeds, recommendations, or anonymous APIs.

### `public.event_outbox`

- Owner key: `profile_id`
- Content risk: fallback payloads and error details for failed snapshot or activity dispatch from progress-domain events.
- Deletion handling: Task18 must remove rows owned by the profile before or with `progress_logs`. Dead-letter rows may contain diagnostic text and must not be retained after GDPR hard deletion.

### `public.events_visibility_sync_jobs`

- Owner key: `profile_id`
- Content risk: entry visibility transitions and job state used to backfill activity visibility snapshots.
- Deletion handling: Task18 must remove rows owned by the profile before or with activity tables.

## Task11 additions

### `public.lists`

- Owner key: `profile_id`
- Content risk: user-authored list title, description, visibility, ordering preference, and cover strategy. P0 keeps this schema-only; P1 may expose list workflows.
- Deletion handling: Task18 must remove rows owned by the profile before or with list items. Public list retention requires an explicit product decision before P1 enablement.

### `public.list_items`

- Owner key: `profile_id`
- Content risk: associations between user-owned lists and entries or works, including user-authored item notes and ordering.
- Deletion handling: Task18 must remove rows owned by the profile before or with `lists`. Item notes must not be retained after GDPR hard deletion.

## Task12 additions

### `public.notifications`

- Owner key: `recipient_profile_id`
- Content risk: private notification payloads, read state, actor linkage, and system-generated notification context. P0 keeps this schema-only; P3 may expose notification workflows.
- Deletion handling: Task18 must remove rows where the profile is the recipient. Rows where the profile appears as `actor_profile_id` require anonymization or removal before P3 enablement.

## Task13 additions

### `public.import_jobs`

- Owner key: `profile_id`
- Content risk: import source, import config, payloads, result summaries, retry errors, and dead-letter diagnostics. Import jobs may include original MSPF or CSV metadata and must stay owner-only.
- Deletion handling: Task18 must remove rows owned by the profile before or with imported domain rows. Dead-letter rows and Sentry payloads must not retain profile-owned import diagnostics after GDPR hard deletion.

### `public.export_jobs`

- Owner key: `profile_id`
- Content risk: export format, payloads, result summaries, retry errors, and dead-letter diagnostics. Export jobs are part of data sovereignty and may reveal what private data was prepared for export.
- Deletion handling: Task18 must remove rows owned by the profile after any required export handoff completes or is cancelled. GDPR hard deletion must remove export job payloads and dead-letter diagnostics.

### `public.cover_cache_jobs`

- Owner key: `profile_id`
- Content risk: cover source URLs, cache payloads, work/edition associations, retry errors, and dead-letter diagnostics.
- Deletion handling: Task18 must remove rows owned by the profile. Cached cover artifacts outside Postgres need their own deletion traversal when storage is enabled.

### `public.events_visibility_sync_jobs` Task13 fields

- Owner key: `profile_id`
- Content risk: Task13 adds retry scheduling, max attempts, dead-letter state, and Sentry alert payloads to the existing visibility sync job state.
- Deletion handling: Task18 must remove Task13 retry and dead-letter diagnostics together with the visibility sync job row.

## Task18 verification coverage

Primary test file: `test/rls/task18_mspf_export_deletion.sql`.

- Owner deletion removes `user_private_notes`.
- Owner deletion removes or anonymizes `user_entries.review`.
- Owner deletion removes or anonymizes `annotations.content`.
- Owner deletion removes `tags`, `entry_tags`, and `annotation_tags`.
- Owner deletion removes `progress_logs` and `progress_snapshots`.
- Owner deletion removes `activity_events`, `private_activity_log`, `event_outbox`, and `events_visibility_sync_jobs`.
- Owner deletion removes `lists` and `list_items`.
- Owner deletion removes recipient `notifications` and handles actor-linked notification references.
- Owner deletion removes `import_jobs`, `export_jobs`, `cover_cache_jobs`, and all job dead-letter / Sentry diagnostic payloads.
- Public views and APIs do not retain deleted-profile Task07 content.
- Export channel requires a completed `task18_mspf_export` job before soft deletion and keeps username routes at `410 Gone`.
- GDPR channel skips export, enters a 24-hour cooling period, and hard-deletes only after the due processor runs.

# ADR-053 Task 02 Work, Edition, External ID Model

## Status

Accepted

## Context

Task 02 requires three shared metadata tables: `works`, `editions`, and `external_ids`.
The P0 task list and product plan v6 define the current model:

- `works` stores shared canonical work identity.
- `editions` stores concrete manifestations and must be non-empty for every work.
- `external_ids` targets multiple entity kinds through `target_type` and `target_id`.
- Manual P0 creation is single-tenant but shared-public by default.
- Duplicate handling is soft: title trigram similarity >= 0.85 plus release year +/- 1 returns candidates before insert.

The older database schema draft used `external_ids.work_id/provider/external_id`, while v6 and the P0 task list use `external_ids.target_type/target_id/source/external_id`.
Project skeleton guidance says conflicts are resolved by product plan v6 first, then the task list and ADRs.

## Decision

Use the v6/P0 `external_ids` shape:

- `target_type`
- `target_id`
- `source`
- `external_id`
- `source_url`
- `match_method`
- `confidence_score`
- `verified_by_user`

Keep the uniqueness invariant as `unique (source, external_id)`.
Task 02 supports `work` and `edition` targets now; `person` and `series` remain reserved target types for later tasks.

Use v6 field names for work and edition identity:

- `works.first_release_year`
- `works.localized_titles_json`
- `works.localized_descriptions_json`
- `works.visibility_scope`
- `works.promotion_status`
- `works.created_via`
- `editions.edition_type`
- `editions.runtime_minutes`
- `editions.release_date`

Do not add `creators_json` to `works`.
Product plan appendix F deprecates that shape in favor of later `persons` and `work_credits`.

## Consequences

The hard duplicate guard is external identity uniqueness, not title uniqueness.
Manual rows without an external id receive a row-identity fingerprint, allowing a user to explicitly continue after a soft duplicate warning while still preserving exact external id uniqueness.

Every inserted work creates a default edition in the same transaction.
The default edition exists before the create RPC returns.

Task 02 UI and server actions call database RPCs with an authenticated user token and do not use service-role bypass.

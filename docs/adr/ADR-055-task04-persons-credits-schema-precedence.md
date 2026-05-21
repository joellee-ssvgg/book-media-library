# ADR-055 Task 04 Persons Credits Schema Precedence

## Status

Accepted

## Context

Task 04 requires schema-only support for `persons` and `work_credits`.
The P0 task list names Task 04 as `persons / work_credits`, with `persons(canonical_name / disambiguation / localized_names_json)` and `work_credits(role / character_name / billing_order)` as required outputs.

Product plan v6 expands that shape:

- `persons`: `id`, `canonical_name`, `original_name`, `disambiguation`, `localized_names_json`, `name_variants_json`, `bio_json`, `search_vector`, and audit fields.
- `work_credits`: `work_id`, `person_id`, `role`, `character_name`, `billing_order`, `uncredited`, plus `(work_id, role)` and `(person_id, role)` indexes.
- `external_ids.target_type`: `work`, `edition`, `person`, and `series`.

The older DB Schema v1.0.0 draft conflicts with this path because it still models creator identity through `works.creators`/`creators_json`-style data and an older work-only `external_ids` shape.
ADR-053 already rejected `creators_json` and adopted the v6/P0 `external_ids.target_type` model.
ADR-054 kept `series.primary_creator_id` nullable until Task 04 creates `persons`.

## Decision

Implement Task 04 from product plan v6, the P0 task list, ADR-053, and ADR-054.

Add:

- `persons`
- `work_credits`
- `external_ids` validation and RLS support for `target_type = 'person'`
- `series.primary_creator_id` foreign key to `persons(id)`

Do not add `works.creators`, `works.creators_json`, or another denormalized creator field.

Keep Task 04 schema-only:

- No UI
- No routes
- No server actions
- No provider implementation yet

`work_credits` uses a surrogate `id` primary key to keep audit, soft-delete, and future provider reconciliation stable while preserving the v6 fields and required indexes.

## Consequences

Task 06 can write provider credits through normalized `persons` and `work_credits`.
Person external IDs are now live instead of reserved.
Series primary creators are referentially checked after `persons` exists.

Creator display and localization must be read through `work_credits` joined to `persons.localized_names_json`.
Any future reintroduction of denormalized creator JSON requires a new ADR.

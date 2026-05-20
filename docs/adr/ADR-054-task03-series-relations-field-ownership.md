# ADR-054 Task 03 Series Relations Field Ownership

## Status

Accepted

## Context

Task 03 adds P0 schema-only support for `series`, `work_series`, and `work_relations`.
The P0 task list and product plan v6 explicitly require these tables before any UI or business workflow is exposed.

Two document seams need a precise decision:

- Product plan v6 lists `work_relations.created_by` as one of `user_manual`, `system`, or `provider`.
- The database audit model uses `created_by` consistently as a profile UUID.
- Product plan v6 includes `series.primary_creator_id`, but `persons` is Task 04 and does not exist yet.
- The older DB schema draft omits P0 series tables while the newer P0 task list and product plan v6 require them.

Project precedence is product plan v6 first, then the P0 task list and ADRs, while preserving established audit invariants.

## Decision

Add `series`, `work_series`, and `work_relations` now as schema-only P0 tables.
Do not add UI, server actions, routes, or business code in Task 03.

Keep `created_by` and `updated_by` as profile UUID audit fields on Task 03 tables.
Represent the v6 source semantics for work relations with a separate field:

- `work_relations.created_source`
- Allowed values: `user_manual`, `system`, `provider`
- Default value: `user_manual`

Keep `series.primary_creator_id` as nullable UUID in Task 03, but do not add a foreign key until Task 04 creates `persons`.
The column is retained so the v6 shape is visible without creating the Task 04 table early.

Extend `external_ids` support from `work` and `edition` to include `series`.
Keep `person` as a reserved target type until Task 04.

## Consequences

The audit meaning of `created_by` stays stable across the schema.
The origin of a work relation is still represented explicitly without overloading the audit field.

Task 03 can be migrated and tested before `persons` exists.
When Task 04 lands, it should add the `series.primary_creator_id` foreign key only after validating existing nullable values.

Series data is shared-public-read, but authenticated inserts remain owner-scoped for referenced rows.
No UPDATE or DELETE grants are exposed in Task 03.

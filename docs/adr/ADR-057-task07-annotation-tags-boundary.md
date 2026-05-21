# ADR-057: Task07 annotation tag boundary

Status: Accepted

Date: 2026-05-21

## Context

The P0 task list names `annotation_tags` in Task07 and also assigns `tags / entry_tags / annotation_tags` to Task08. `annotation_tags` cannot be modeled safely without the canonical `tags` table and tag governance rules owned by Task08.

Task07 is also the privacy red-line task for entries, owner-only private notes, and media-type-aware annotations. Expanding it into tag storage would mix the privacy table boundary with a separate taxonomy boundary.

## Decision

Task07 implements:

- `user_entries`
- `user_private_notes`
- `annotations`
- the masked public entry view
- RLS and pgTAP coverage for the three Task07 tables

Task08 remains responsible for creating `tags`, `entry_tags`, and `annotation_tags` together.

## Consequences

Task07 annotations are taggable in the product model but do not expose a tag join table yet. Task08 must add `annotation_tags` against the Task07 `annotations` primary key and include its own RLS coverage.

This avoids an orphaned `annotation_tags` table with no authoritative `tags` reference and keeps the private-note boundary auditable in Task07.

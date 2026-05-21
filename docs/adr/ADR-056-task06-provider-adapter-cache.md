# ADR-056 Task 06 Provider Adapter Cache

## Status

Accepted

## Context

Task 06 requires a `MediaProvider` interface, P0 providers for Open Library, Google Books, TMDB Movie, and manual entry, plus a `provider_search_cache` table.
Product plan v6 defines the cache shape as `query_hash`, `media_type`, `provider`, `results_json`, `negative`, and `expires_at`.
The P0 task list also requires app-level LRU plus DB cache, a `canonicalize` function, 24 hour TTL for normal results, 1 hour TTL for negative results, API keys through env, and no `profile_id` on the cache table.

Existing schema tables normally carry profile-backed audit columns.
Applying that pattern to provider search cache would link search interest to a profile, which conflicts with the explicit Task 06 privacy requirement.

## Decision

Implement provider search cache as a shared, non-profile table:

- no `profile_id`
- no `created_by`
- no `updated_by`
- no direct table grants to `anon` or `authenticated`
- RLS enabled and forced
- access only through exact-key RPC functions

`get_provider_search_cache` only returns one non-expired row matching the caller-provided `media_type`, `provider`, and `query_hash`.
`upsert_provider_search_cache` computes TTL server-side:

- normal hit: 24 hours
- negative hit: 1 hour

The provider adapter layer normalizes upstream records into `CanonicalCandidate` and `CanonicalRecord`.
Provider modules use official upstream shapes for P0 fields:

- Open Library Search API: `key`, `title`, `author_name`, `first_publish_year`, `cover_i`, `isbn`
- Google Books Volumes API: `id`, `volumeInfo.title`, `authors`, `publishedDate`, `industryIdentifiers`, `imageLinks`
- TMDB Search Movie API: `id`, `title`, `original_title`, `release_date`, `overview`, `poster_path`

## Consequences

Cache rows are not user-owned records.
This is an explicit exception to the profile audit pattern and must not be reused for personal collection data.

The table is not listable from client roles, reducing search-interest leakage.
A caller with an exact key can retrieve the cached payload, which is acceptable because the key is derived from the same normalized query the caller already has.

Task 20 can add provider-aware rate-limit storage without changing this cache ownership model.
Future providers can be added behind the same adapter interface, but new external APIs still require a separate decision.

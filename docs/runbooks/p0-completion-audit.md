# P0 Completion Audit

Date: 2026-05-23

## Scope

This audit maps the `P0 任务清单(20 步实例化)` requirements to current repository evidence, local verification, and live staging evidence.

It does not mark the whole P0 objective complete. The current change set is still local and uncommitted.

## Current Verification

Latest local checks run on 2026-05-23:

| Check | Result |
| --- | --- |
| `pnpm task01:check` | PASS, `READY: Task 01 startup gates passed. warnings=0` |
| `pnpm p0:check` | PASS |
| `pnpm test` inside `p0:check` | 14 files, 47 tests passed |
| `pnpm db:test:rls` inside `p0:check` | 19 files, 469 pgTAP tests passed |
| `pnpm build` inside `p0:check` | PASS, Next.js production build generated expected routes |
| `pnpm p0:redline` inside `p0:check` | PASS for acceptance steps 11, 12, and 13 |
| `pnpm task20:rate-limit:smoke` | PASS, Upstash 20/min/IP and 1000/day/profile boundaries verified |
| `pnpm task20:sentry:smoke` | PASS, Sentry ingest accepted event `bcfd6bda580d4a4cb9cb9c3ed785c6b7` |
| Task14/15 browser timing | PASS, onboarding 2254 ms, book add 8829 ms, movie add 2389 ms against 60000 ms threshold |
| `git diff --check` | PASS |

Latest staging checks:

| Check | Result |
| --- | --- |
| `https://book-media-library-staging.vercel.app/manifest.webmanifest` | HTTP 200, installable manifest, `display=standalone`, `start_url=/` |
| `https://book-media-library-staging.vercel.app/sw.js` | HTTP 200 JavaScript service worker |
| Work OG image `/w/019e4fca-2648-7967-8188-20e1338e7c85/inception/opengraph-image` | HTTP 200 PNG, `1200x630` |
| `demo01` export-then-delete | `/u/demo01` returns HTTP 410; public RPC returns `{"status":"gone"}`; owner `/library` and `/dashboard` show 0 real entries |

## Task Map

| Task | Evidence-backed status | Current evidence |
| --- | --- | --- |
| Task 01 - Supabase + Auth + profiles + auth_identities | Evidence-backed with ADR exception | `supabase/migrations/202605202309_task01_profiles_auth.sql`, `supabase/migrations/202605222058_task21_oauth_identity_provider.sql`, `test/rls/profiles_auth.sql`, ADR-052, ADR-058, `pnpm task01:check`, `pnpm db:migrate:smoke`, `pnpm db:test:rls`. GitHub OAuth is allowed only by ADR-058 for live acceptance. |
| Task 02 - works / editions / external_ids | Mostly evidence-backed | `supabase/migrations/202605210013_task02_works_editions_external_ids.sql`, `test/rls/works_editions_external_ids.sql`, ADR-053. Default edition and external id constraints are covered by migration and RLS tests. |
| Task 03 - series / work_series / work_relations | Evidence-backed for schema-only P0 | `supabase/migrations/202605210123_task03_series_relations.sql`, `test/rls/series_relations.sql`, ADR-054. No P0 UI exposure found in current route list. |
| Task 04 - persons / work_credits | Evidence-backed | `supabase/migrations/202605211106_task04_persons_credits.sql`, `test/rls/persons_work_credits.sql`, ADR-055. |
| Task 05 - Media Type Registry + i18n bundle | Partially evidence-backed | `apps/web/lib/registry/*`, `apps/web/lib/i18n/*`, `apps/web/lib/registry/registry.test.ts`, `apps/web/lib/i18n/i18n.test.ts`. Broad grep still finds expected media-type branching in validation/RPC code, so the stricter "no media hardcoding" wording should be interpreted through the registry boundary, not as a literal zero-match rule. |
| Task 06 - Provider Adapter + provider_search_cache | Evidence-backed | `apps/web/lib/providers/*`, `apps/web/lib/books/search.ts`, `apps/web/lib/movies/search.ts`, `supabase/migrations/202605211137_task06_provider_search_cache.sql`, `test/rls/provider_search_cache.sql`, ADR-056. Staging Google Books search returns results after `GOOGLE_BOOKS_API_KEY` configuration. |
| Task 07 - entries / private_notes / annotations | Evidence-backed for privacy boundary | `supabase/migrations/202605211200_task07_entries_notes_annotations.sql`, `test/rls/entries_notes_annotations.sql`, `pnpm p0:redline`. Redline checks public JSON/HTML do not expose private note content or private-note field names. |
| Task 08 - tags / entry_tags / annotation_tags | Evidence-backed | `supabase/migrations/202605211219_task08_tags_entry_annotation_tags.sql`, `test/rls/tags_entry_annotation_tags.sql`, ADR-057. |
| Task 09 - progress_models / progress_logs / progress_snapshots | Evidence-backed | `supabase/migrations/202605211235_task09_progress_models_logs_snapshots.sql`, `test/rls/progress_models_logs_snapshots.sql`. pgTAP includes no-trigger snapshot sync and `replay_progress_snapshot` rebuild from remaining logs after deleting a derived snapshot. |
| Task 10 - activity_events + private_activity_log + event_outbox | Evidence-backed | `supabase/migrations/202605211315_task10_activity_outbox.sql`, `test/rls/activity_outbox.sql`. Tests cover fallback outbox behavior and visibility sync job processing. |
| Task 11 - lists / list_items | Evidence-backed for schema-only P0 | `supabase/migrations/202605211330_task11_lists_list_items.sql`, `test/rls/lists_list_items.sql`. |
| Task 12 - notifications | Evidence-backed for schema-only P0 | `supabase/migrations/202605211345_task12_notifications.sql`, `test/rls/notifications.sql`. |
| Task 13 - jobs series | Evidence-backed | `supabase/migrations/202605211410_task13_jobs.sql`, `test/rls/jobs.sql`, job queue coverage in `test/rls/task14_book_onboarding_import.sql`, deletion traversal runbook. |
| Task 14 - book add flow + 60 second onboarding | Evidence-backed including timing | `supabase/migrations/202605211430_task14_book_onboarding_import.sql`, `test/rls/task14_book_onboarding_import.sql`, `/onboarding`, `/add/book`, staging `demo01` onboarding and Open Library / Google Books book add evidence, plus `acceptance/p0-task14-15-timing-2026-05-23.md`. Browser timing measured onboarding at 2254 ms and book add at 8829 ms against the 60000 ms threshold. |
| Task 15 - movie add flow | Evidence-backed including timing | `supabase/migrations/202605211520_task15_movie_add.sql`, `test/rls/task15_movie_add.sql`, `/add/movie`, staging TMDB `Inception` add evidence, plus `acceptance/p0-task14-15-timing-2026-05-23.md`. Browser timing measured movie add at 2389 ms against the 60000 ms threshold. |
| Task 16 - library + dashboard + seed | Evidence-backed | `supabase/migrations/202605211610_task16_library_dashboard.sql`, `test/rls/task16_library_dashboard.sql`, `/library`, `/dashboard`, staging evidence for 3 real entries before deletion and 0 real entries with seed mode after deletion. |
| Task 17 - public homepage SSR + OG | Evidence-backed | `supabase/migrations/202605211700_task17_public_pages.sql`, `test/rls/task17_public_pages.sql`, `/u/[username]`, `/w/[workId]/[slug]`, OG routes. Staging `/u/demo01` returns 410 after deletion; work OG image returns `1200x630` PNG. |
| Task 18 - MSPF export + deletion | Evidence-backed | `supabase/migrations/202605221000_task18_mspf_export_deletion.sql`, `test/rls/task18_mspf_export_deletion.sql`, `apps/web/lib/mspf/*`, `scripts/p0-redline-acceptance.ts`, local artifacts under `acceptance/`, staging fresh export job `019e5075-ddf6-7cc0-a56d-489bfcdf48df`, live deletion request `019e5076-fff8-78d0-a06d-fb5803f59037`. |
| Task 19 - RLS pgTAP test suite / CI blocking | Evidence-backed locally and historically in CI | `.github/workflows/lint-and-type.yml`, `.github/workflows/migration-smoke.yml`, `.github/workflows/pgtap.yml`, `.github/workflows/p0-redline.yml`, `test/rls/task19_rls_ci_guard.sql`, `docs/runbooks/task19-rls-ci-gates.md`, local `pnpm p0:check`. Current local changes have not yet run through a fresh PR CI cycle. |
| Task 20 - PWA + Upstash rate limiting | Evidence-backed | `apps/web/public/manifest.webmanifest`, `apps/web/public/sw.js`, `apps/web/proxy.ts`, `apps/web/lib/rate-limit/*`, `apps/web/lib/observability/*`, `supabase/migrations/202605221530_task20_pwa_upstash_rate_limits.sql`, `test/rls/task20_pwa_upstash_rate_limit.sql`, `docs/runbooks/task20-pwa-upstash-rate-limit.md`, local and external smoke checks. |

## Known Evidence Gaps

| Gap | Impact | Next evidence needed |
| --- | --- | --- |
| Current local change set has not run through PR CI | Local checks passed, but branch protection evidence does not yet apply to this exact diff. | Push a branch/PR and verify required GitHub checks if publishing is requested. |

## Current Conclusion

Local P0 verification is green and the GitHub OAuth document conflict is resolved by ADR-058.

Do not mark the full thread goal complete yet because:

- the current change set is still local and uncommitted;
- current PR CI evidence is missing for this exact local diff.
